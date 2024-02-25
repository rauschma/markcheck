#!/usr/bin/env -S node --no-warnings=ExperimentalWarning
// Importing JSON is experimental

import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { clearDirectorySync, ensureParentDirectory } from '@rauschma/helpers/nodejs/file.js';
import { ink } from '@rauschma/helpers/nodejs/text-ink.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import json5 from 'json5';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { isOutputEqual, logDiff } from '../util/diffing.js';
import { UserError, contextDescription, contextLineNumber } from '../util/errors.js';
import { trimTrailingEmptyLines } from '../util/string.js';
import { Config, ConfigModJsonSchema, PROP_KEY_COMMANDS, PROP_KEY_DEFAULT_FILE_NAME, fillInCommandVariables, type LangDef, type LangDefCommand } from './config.js';
import { ATTR_KEY_EXTERNAL, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME } from './directive.js';
import { ConfigMod, GlobalVisitationMode, Heading, LineMod, Snippet, VisitationMode, assembleLines, assembleLinesForId, type MarktestEntity, LogLevel, type CliState } from './entities.js';
import { parseMarkdown } from './parse-markdown.js';
//@ts-expect-error: Module '#package_json' has no default export.
import pkg from '#package_json' with { type: "json" };

const MARKTEST_DIR_NAME = 'marktest-data';
const MARKTEST_TMP_DIR_NAME = 'tmp';
const CONFIG_FILE_NAME = 'marktest-config.jsonc';
const { stringify } = JSON;

//#################### runFile() ####################

export function runFile(logLevel: LogLevel, absFilePath: string, entities: Array<MarktestEntity>, idToSnippet: Map<string, Snippet>): void {
  const marktestDir = findMarktestDir(absFilePath, entities);
  console.log('Marktest directory: ' + relPath(marktestDir));

  const tmpDir = path.resolve(marktestDir, MARKTEST_TMP_DIR_NAME);
  // `marktest/` must exist, `marktest/tmp/` may not exist
  if (fs.existsSync(tmpDir)) {
    clearDirectorySync(tmpDir);
  } else {
    fs.mkdirSync(tmpDir);
  }

  let globalVisitationMode = GlobalVisitationMode.Normal;
  if (entities.some((e) => e instanceof Snippet && e.visitationMode === VisitationMode.Only)) {
    globalVisitationMode = GlobalVisitationMode.Only;
  }

  const config = new Config();
  const configFilePath = path.resolve(marktestDir, CONFIG_FILE_NAME);
  if (fs.existsSync(configFilePath)) {
    const json = json5.parse(fs.readFileSync(configFilePath, 'utf-8'));
    const configModJson = ConfigModJsonSchema.parse(json);
    config.applyMod(
      contextDescription('Config file ' + stringify(configFilePath)),
      configModJson
    );
  }

  const cliState: CliState = {
    tmpDir,
    logLevel,
    idToSnippet,
    globalVisitationMode,
    globalLineMods: new Map(),
  };

  const globalLineMods = new Map<string, Array<LineMod>>();
  // A heading is only shown if it directly precedes a snippet that is run
  // (and therefore shows up in the UI output).
  let prevHeading: null | Heading = null;
  for (const entity of entities) {
    handleOneEntity(cliState, config, prevHeading, entity);
    prevHeading = entity instanceof Heading ? entity : null;
  }
}

function findMarktestDir(absFilePath: string, entities: Array<MarktestEntity>): string {
  const firstConfigMod = entities.find((entity) => entity instanceof ConfigMod);
  if (firstConfigMod instanceof ConfigMod) {
    const dir = firstConfigMod.configModJson.marktestDirectory;
    if (dir) {
      return dir;
    }
  }

  const startDir = absFilePath;
  let parentDir = startDir;
  while (true) {
    const mtd = path.resolve(parentDir, MARKTEST_DIR_NAME);
    if (fs.existsSync(mtd)) {
      return mtd;
    }
    const nextParentDir = path.dirname(parentDir);
    if (nextParentDir === parentDir) {
      break;
    }
    parentDir = nextParentDir;
  }
  throw new UserError(
    `Could not find a ${stringify(MARKTEST_DIR_NAME)} directory neither configured not in the following directory or its ancestors: ${stringify(parentDir)}`
  );
}

function handleOneEntity(cliState: CliState, config: Config, prevHeading: null | Heading, entity: MarktestEntity): void {
  if (entity instanceof ConfigMod) {
    config.applyMod(contextLineNumber(entity.lineNumber), entity.configModJson);
  } else if (entity instanceof LineMod) {
    assertNonNullable(entity.targetLanguage);
    let lineModArr = cliState.globalLineMods.get(entity.targetLanguage);
    if (!lineModArr) {
      lineModArr = [];
      cliState.globalLineMods.set(entity.targetLanguage, lineModArr);
    }
    lineModArr.push(entity);
  } else if (entity instanceof Snippet) {
    handleSnippet(cliState, config, prevHeading, entity);
  } else if (entity instanceof Heading) {
    // Ignore
  } else {
    throw new UnsupportedValueError(entity);
  }
}

function handleSnippet(cliState: CliState, config: Config, prevHeading: null | Heading, snippet: Snippet): void {
  if (!snippet.isVisited(cliState.globalVisitationMode)) {
    return;
  }

  const langDef = config.getLang(snippet.lang);
  if (langDef === undefined) {
    throw new UserError(
      `Unknown language: ${JSON.stringify(snippet.lang)}`,
      { lineNumber: snippet.lineNumber }
    );
  }
  if (langDef.kind === 'LangDefSkip') {
    return;
  }
  if (langDef.kind === 'LangDefError') {
    throw new UserError(
      `Language must be skipped: ${JSON.stringify(snippet.lang)}`,
      { lineNumber: snippet.lineNumber }
    );
  }

  writeFiles(cliState, config, snippet, langDef);

  if (langDef.kind === 'LangDefErrorIfRun') {
    throw new UserError(
      `Language can’t be run: ${JSON.stringify(snippet.lang)}`,
      { lineNumber: snippet.lineNumber }
    );
  }
  if (langDef.kind === 'LangDefNeverRun') {
    return;
  }
  assertTrue(langDef.kind === 'LangDefCommand');
  const fileName = snippet.getFileName(langDef);
  if (fileName === null) {
    throw new UserError(
      `Snippet is runnable but its language does not have a ${stringify(PROP_KEY_DEFAULT_FILE_NAME)} nor does it override the default with its own filename`,
      { lineNumber: snippet.lineNumber }
    );
  }
  if (fileName === null) {
    throw new UserError(
      `Snippet is runnable but its language does not have a ${stringify(PROP_KEY_DEFAULT_FILE_NAME)} nor does it override the default with its own filename.`,
      { lineNumber: snippet.lineNumber }
    );
  }
  if (!langDef.commands) {
    throw new UserError(
      `Snippet is runnable but its language does not have ${stringify(PROP_KEY_COMMANDS)}.`,
      { lineNumber: snippet.lineNumber }
    );
  }
  if (langDef.commands.length > 0) {
    if (prevHeading) {
      console.log(ink.Bold(prevHeading.content));
    }
    runShellCommands(cliState, config, snippet, langDef, fileName, langDef.commands);
  }
}

function writeFiles(cliState: CliState, config: Config, snippet: Snippet, langDef: LangDef): void {
  const fileName = snippet.getFileName(langDef);
  if (fileName) {
    const lines = assembleLines(cliState, config, snippet);
    writeOneFile(cliState, config, fileName, lines);
  }

  for (const { id, fileName } of snippet.externalSpecs) {
    if (!id) continue;
    const lines = assembleLinesForId(cliState, config, snippet.lineNumber, id, `attribute ${ATTR_KEY_EXTERNAL}`);
    writeOneFile(cliState, config, fileName, lines);
  }
}

function writeOneFile(cliState: CliState, config: Config, fileName: string, lines: Array<string>) {
  const filePath = path.resolve(cliState.tmpDir, fileName);
  if (cliState.logLevel === LogLevel.Verbose) {
    console.log('Write ' + filePath);
  }
  let content = lines.join(os.EOL);
  content = config.searchAndReplaceFunc(content);
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, content, 'utf-8');
}

//#################### runShellCommands() ####################

function runShellCommands(cliState: CliState, config: Config, snippet: Snippet, langDef: LangDefCommand, fileName: string, commandsWithVars: Array<Array<string>>): void {
  process.stdout.write(`L${snippet.lineNumber} (${snippet.lang})`);
  const commands: Array<Array<string>> = fillInCommandVariables(commandsWithVars, {
    [CMD_VAR_FILE_NAME]: [fileName],
    [CMD_VAR_ALL_FILE_NAMES]: snippet.getAllFileNames(langDef),
  });
  commandLoop: {
    for (const commandParts of commands) {
      if (cliState.logLevel === LogLevel.Verbose) {
        console.log(commandParts.join(' '));
      }
      const [command, ...args] = commandParts;
      const result = child_process.spawnSync(command, args, {
        shell: true,
        cwd: cliState.tmpDir,
        encoding: 'utf-8',
      });
      const status = checkShellCommandResult(cliState, config, snippet, result);
      if (status === 'failure') {
        break commandLoop;
      }
    }
    // Success only if all commands succeeded
    console.log(' ✅');
  }
}

function checkShellCommandResult(cliState: CliState, config: Config, snippet: Snippet, commandResult: child_process.SpawnSyncReturns<string>): 'success' | 'failure' {
  if (commandResult.error) {
    // Spawning didn’t work
    throw commandResult.error;
  }

  const stdoutLines = splitLinesExclEol(commandResult.stdout);
  trimTrailingEmptyLines(stdoutLines);
  const stderrLines = splitLinesExclEol(commandResult.stderr);
  trimTrailingEmptyLines(stderrLines);

  if (commandResult.status !== null && commandResult.status !== 0) {
    console.log(' ❌');
    console.log(`Snippet exited with non-zero code ${commandResult.status}`);
    logStdout(stdoutLines);
    logStderr(stderrLines);
    return 'failure';
  }
  if (commandResult.signal !== null) {
    console.log(' ❌');
    console.log(`Snippet was terminated by signal ${commandResult.signal}`);
    logStdout(stdoutLines);
    logStderr(stderrLines);
    return 'failure';
  }
  if (commandResult.stderr.length > 0) {
    if (snippet.stderrId) {
      // We expected stderr output
      const expectedLines = assembleLinesForId(cliState, config, snippet.lineNumber, snippet.stderrId, `attribute ${ATTR_KEY_STDERR}`);
      trimTrailingEmptyLines(expectedLines);
      if (!isOutputEqual(expectedLines, stderrLines)) {
        console.log(' ❌');
        console.log('stderr was not as expected');
        logStderr(stderrLines, expectedLines);
        return 'failure';
      }
    } else {
      console.log(' ❌');
      console.log('There was unexpected stderr output');
      logStderr(stderrLines);
      return 'failure';
    }
  }
  if (snippet.stdoutId) {
    // Normally stdout is ignored. But in this case, we examine it.
    const expectedLines = assembleLinesForId(cliState, config, snippet.lineNumber, snippet.stdoutId, `attribute ${ATTR_KEY_STDOUT}`);
    trimTrailingEmptyLines(expectedLines);
    if (!isOutputEqual(stdoutLines, expectedLines)) {
      console.log(' ❌');
      console.log('stdout was not as expected');
      logStdout(stdoutLines, expectedLines);
      return 'failure';
    }
  }
  return 'success';
}

function logStdout(stdoutLines: Array<string>, expectedLines?: Array<string>) {
  if (expectedLines === undefined && stdoutLines.length === 0) {
    return;
  }
  console.log('----- stdout -----');
  logAll(stdoutLines);
  console.log('------------------');
  if (expectedLines) {
    logDiff(expectedLines, stdoutLines);
    console.log('------------------');
  }
}
function logStderr(stderrLines: Array<string>, expectedLines?: Array<string>) {
  if (expectedLines === undefined && stderrLines.length === 0) {
    return;
  }
  console.log('----- stderr -----');
  logAll(stderrLines);
  console.log('------------------');
  if (expectedLines) {
    logDiff(expectedLines, stderrLines);
    console.log('------------------');
  }
}

function logAll(lines: Array<string>) {
  for (const line of lines) {
    console.log(line);
  }
}

//#################### main() ####################

const BIN_NAME = 'marktest';

const ARG_OPTIONS = {
  'help': {
    type: 'boolean',
    short: 'h',
  },
  'version': {
    type: 'boolean',
  },
  'print-config': {
    type: 'boolean',
    short: 'c',
  },
  'verbose': {
    type: 'boolean',
    short: 'v',
  },
} satisfies ParseArgsConfig['options'];

function main() {
  const args = parseArgs({ allowPositionals: true, options: ARG_OPTIONS });

  if (args.values.version) {
    console.log(pkg.version);
    return;
  }
  if (args.values['print-config']) {
    console.log(JSON.stringify(new Config().toJson(), null, 2));
    return;
  }
  if (args.values.help || args.positionals.length === 0) {
    const helpLines = [
      `${BIN_NAME} «file1.md» «file2.md» ...`,
      '',
      'More options:',
      '--help -h: get help',
      '--version -v: print version',
      '--print-config -c: print built-in configuration',
    ];
    for (const line of helpLines) {
      console.log(line);
    }
    return;
  }
  for (const filePath of args.positionals) {
    const absFilePath = path.resolve(filePath);
    console.log();
    console.log('===== ' + relPath(absFilePath));
    const text = fs.readFileSync(absFilePath, 'utf-8');
    const { entities, idToSnippet } = parseMarkdown(text);
    const logLevel = (args.values.verbose ? LogLevel.Verbose : LogLevel.Normal);
    runFile(logLevel, absFilePath, entities, idToSnippet);
  }
}

main();

function relPath(absPath: string) {
  return path.relative(process.cwd(), absPath);
}