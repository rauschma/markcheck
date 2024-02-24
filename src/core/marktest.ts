#!/usr/bin/env -S node --no-warnings=ExperimentalWarning
// Importing JSON is experimental

import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { clearDirectorySync } from '@rauschma/helpers/nodejs/file.js';
import { ink } from '@rauschma/helpers/nodejs/text-ink.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { isOutputEqual, logDiff } from '../util/diffing.js';
import { UserError } from '../util/errors.js';
import { trimTrailingEmptyLines } from '../util/string.js';
import { Config, PROP_KEY_COMMANDS, PROP_KEY_DEFAULT_FILE_NAME, fillInCommandVariables, type LangDef, type LangDefCommand } from './config.js';
import { ATTR_KEY_EXTERNAL, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME } from './directive.js';
import { ConfigMod, GlobalVisitationMode, Heading, LineMod, Snippet, VisitationMode, assembleLines, assembleLinesForId, type MarktestEntity } from './entities.js';
import { parseMarkdown } from './parse-markdown.js';
//@ts-expect-error: Module '#package_json' has no default export.
import pkg from '#package_json' with { type: "json" };

const MARKTEST_DIR_NAME = 'marktest';
const MARKTEST_TMP_DIR_NAME = 'tmp';
const { stringify } = JSON;

enum LogLevel {
  Verbose,
  Normal,
}

const LOG_LEVEL: LogLevel = LogLevel.Normal;

//#################### runFile() ####################

export function runFile(absFilePath: string, entities: Array<MarktestEntity>, idToSnippet: Map<string, Snippet>): void {
  const marktestDir = findMarktestDir(absFilePath, entities);
  console.log('Marktest directory: ' + marktestDir);

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
  const globalLineMods = new Map<string, Array<LineMod>>();
  // A heading is only shown if it directly precedes a snippet that is run
  // (and therefore shows up in the UI output).
  let prevHeading: null | Heading = null;
  for (const entity of entities) {
    handleOneEntity(tmpDir, idToSnippet, globalLineMods, globalVisitationMode, config, prevHeading, entity);
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

function handleOneEntity(tmpDir: string, idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, globalVisitationMode: GlobalVisitationMode, config: Config, prevHeading: null | Heading, entity: MarktestEntity): void {
  if (entity instanceof ConfigMod) {
    config.applyMod(entity.lineNumber, entity.configModJson);
  } else if (entity instanceof LineMod) {
    assertNonNullable(entity.targetLanguage);
    let lineModArr = globalLineMods.get(entity.targetLanguage);
    if (!lineModArr) {
      lineModArr = [];
      globalLineMods.set(entity.targetLanguage, lineModArr);
    }
    lineModArr.push(entity);
  } else if (entity instanceof Snippet) {
    handleSnippet(tmpDir, idToSnippet, globalLineMods, globalVisitationMode, config, prevHeading, entity);
  } else if (entity instanceof Heading) {
    // Ignore
  } else {
    throw new UnsupportedValueError(entity);
  }
}

function handleSnippet(tmpDir: string, idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, globalVisitationMode: GlobalVisitationMode, config: Config, prevHeading: null | Heading, snippet: Snippet): void {
  if (!snippet.isVisited(globalVisitationMode)) {
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

  writeFiles(config, tmpDir, idToSnippet, globalLineMods, snippet, langDef);

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
    runShellCommands(config, idToSnippet, globalLineMods, snippet, langDef, tmpDir, fileName, langDef.commands);
  }
}

function writeFiles(config: Config, tmpDir: string, idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, snippet: Snippet, langDef: LangDef): void {
  const fileName = snippet.getFileName(langDef);
  if (fileName) {
    const lines = assembleLines(config, idToSnippet, globalLineMods, snippet);
    writeOneFile(config, tmpDir, fileName, lines);
  }

  for (const { id, fileName } of snippet.externalSpecs) {
    if (!id) continue;
    const lines = assembleLinesForId(config, idToSnippet, globalLineMods, snippet.lineNumber, id, `attribute ${ATTR_KEY_EXTERNAL}`);
    writeOneFile(config, tmpDir, fileName, lines);
  }
}

function writeOneFile(config: Config, tmpDir: string, fileName: string, lines: string[]) {
  const filePath = path.resolve(tmpDir, fileName);
  if (LOG_LEVEL === LogLevel.Verbose) {
    console.log('Write ' + filePath);
  }
  let content = lines.join(os.EOL);
  content = config.searchAndReplaceFunc(content);
  fs.writeFileSync(filePath, content, 'utf-8');
}

//#################### runShellCommands() ####################

function runShellCommands(config: Config, idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, snippet: Snippet, langDef: LangDefCommand, tmpDir: string, fileName: string, commandsWithVars: Array<Array<string>>): void {
  process.stdout.write(`L${snippet.lineNumber} (${snippet.lang})`);
  const commands: Array<Array<string>> = fillInCommandVariables(commandsWithVars, {
    [CMD_VAR_FILE_NAME]: [fileName],
    [CMD_VAR_ALL_FILE_NAMES]: snippet.getAllFileNames(langDef),
  });
  commandLoop: {
    for (const commandParts of commands) {
      if (LOG_LEVEL === LogLevel.Verbose) {
        console.log(commandParts.join(' '));
      }
      const [command, ...args] = commandParts;
      const result = child_process.spawnSync(command, args, {
        shell: true,
        cwd: tmpDir,
        encoding: 'utf-8',
      });
      const status = checkShellCommandResult(config, idToSnippet, globalLineMods, snippet, result);
      if (status === 'failure') {
        break commandLoop;
      }
    }
    // Success only if all commands succeeded
    console.log(' ✅');
  }
}

function checkShellCommandResult(config: Config, idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, snippet: Snippet, result: child_process.SpawnSyncReturns<string>): 'success' | 'failure' {
  if (result.error) {
    // Spawning didn’t work
    throw result.error;
  }

  const stdoutLines = splitLinesExclEol(result.stdout);
  trimTrailingEmptyLines(stdoutLines);
  const stderrLines = splitLinesExclEol(result.stderr);
  trimTrailingEmptyLines(stderrLines);

  if (result.status !== null && result.status !== 0) {
    console.log(' ❌');
    console.log(`Snippet exited with non-zero code ${result.status}`);
    logStdout(stdoutLines);
    logStderr(stderrLines);
    return 'failure';
  }
  if (result.signal !== null) {
    console.log(' ❌');
    console.log(`Snippet was terminated by signal ${result.signal}`);
    logStdout(stdoutLines);
    logStderr(stderrLines);
    return 'failure';
  }
  if (result.stderr.length > 0) {
    if (snippet.stderrId) {
      // We expected stderr output
      const expectedLines = assembleLinesForId(config, idToSnippet, globalLineMods, snippet.lineNumber, snippet.stderrId, `attribute ${ATTR_KEY_STDERR}`);
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
    const expectedLines = assembleLinesForId(config, idToSnippet, globalLineMods, snippet.lineNumber, snippet.stdoutId, `attribute ${ATTR_KEY_STDOUT}`);
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
    short: 'v',
  },
  'print-config': {
    type: 'boolean',
    short: 'c',
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
    console.log('RUN: ' + JSON.stringify(absFilePath));
    const text = fs.readFileSync(absFilePath, 'utf-8');
    const { entities, idToSnippet } = parseMarkdown(text);
    runFile(absFilePath, entities, idToSnippet);
  }
}

main();
