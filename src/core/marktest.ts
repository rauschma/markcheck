#!/usr/bin/env node

import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { clearDirectorySync } from '@rauschma/helpers/nodejs/file.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { assertNonNullable } from '@rauschma/helpers/ts/type.js';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isOutputEqual, logDiff } from '../util/diffing.js';
import { UserError } from '../util/errors.js';
import { CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME, Config, fillInCommands, type LangDef } from './config.js';
import { ATTR_KEY_STDERR, ATTR_KEY_STDOUT, ATTR_KEY_WRITE } from './directive.js';
import { ConfigMod, GlobalSkipMode, LineMod, SkipMode, Snippet, assembleLines, assembleLinesForId, type MarktestEntity } from './entities.js';
import { parseMarkdown } from './parse-markdown.js';

const MARKTEST_DIR_NAME = 'marktest';
const { stringify } = JSON;

enum LogLevel {
  Verbose,
  Normal,
}

const LOG_LEVEL: LogLevel = LogLevel.Normal;

//#################### runShellCommands() ####################

export function runFile(absFilePath: string, entities: Array<MarktestEntity>, idToSnippet: Map<string, Snippet>): void {
  const marktestDir = findMarktestDir(absFilePath, entities);
  console.log('Marktest directory: ' + marktestDir);
  clearDirectorySync(marktestDir);

  let globalSkipMode = GlobalSkipMode.Normal;
  if (entities.some((e) => e instanceof Snippet && e.skipMode === SkipMode.Only)) {
    globalSkipMode = GlobalSkipMode.Only;
  }

  const config = new Config();
  const globalLineMods = new Map<string, Array<LineMod>>();
  for (const entity of entities) {
    handleOneEntity(marktestDir, idToSnippet, globalLineMods, globalSkipMode, config, entity);
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

function handleOneEntity(marktestDir: string, idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, globalSkipMode: GlobalSkipMode, config: Config, entity: MarktestEntity) {
  if (entity instanceof ConfigMod) {
    config.applyMod(entity.configModJson);
  } else if (entity instanceof LineMod) {
    assertNonNullable(entity.targetLanguage);
    let lineModArr = globalLineMods.get(entity.targetLanguage);
    if (!lineModArr) {
      lineModArr = [];
      globalLineMods.set(entity.targetLanguage, lineModArr);
    }
    lineModArr.push(entity);
  } else if (entity instanceof Snippet) {
    handleSnippet(marktestDir, idToSnippet, globalLineMods, globalSkipMode, config, entity);
  } else {
    throw new UnsupportedValueError(entity);
  }
}

function handleSnippet(marktestDir: string, idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, globalSkipMode: GlobalSkipMode, config: Config, snippet: Snippet) {
  if (!snippet.isActive(globalSkipMode)) {
    return;
  }

  const langDef = config.lang.get(snippet.lang);
  if (!langDef) {
    throw new UserError(`Unknown language: ${JSON.stringify(snippet.lang)}`);
  }
  if (langDef === 'skip') {
    return;
  }

  writeFiles(langDef);

  if (snippet.isActive(globalSkipMode) && langDef.commands.length > 0) {
    runShellCommands(idToSnippet, globalLineMods, snippet, langDef, marktestDir);
  }

  function writeFiles(langDef: LangDef) {
    const fileName = snippet.getFileName(langDef);
    const filePath = path.resolve(marktestDir, fileName);
    const lines = assembleLines(idToSnippet, globalLineMods, snippet);
    if (LOG_LEVEL === LogLevel.Verbose) {
      console.log('Wrote ' + filePath);
    }
    fs.writeFileSync(filePath, lines.join(os.EOL), 'utf-8');

    for (const { id, fileName } of snippet.writeSpecs) {
      const lines = assembleLinesForId(idToSnippet, globalLineMods, snippet.lineNumber, id, `attribute ${ATTR_KEY_WRITE}`);
      const filePath = path.resolve(marktestDir, fileName);
      fs.writeFileSync(filePath, lines.join(os.EOL), 'utf-8');
      if (LOG_LEVEL === LogLevel.Verbose) {
        console.log('Wrote ' + filePath);
      }
    }
  }
}

//#################### runShellCommands() ####################

function runShellCommands(idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, snippet: Snippet, langDef: LangDef, marktestDir: string) {
  process.stdout.write(`L${snippet.lineNumber} (${snippet.lang})`);
  const commands: Array<Array<string>> = fillInCommands(langDef, {
    [CMD_VAR_FILE_NAME]: [snippet.getFileName(langDef)],
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
        cwd: marktestDir,
        encoding: 'utf-8',
      });
      const status = checkShellCommandResult(idToSnippet, globalLineMods, snippet, result);
      if (status === 'failure') {
        break commandLoop;
      }
    }
    // Success only if all commands succeeded
    console.log(' ✅');
  }
}

function checkShellCommandResult(idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, snippet: Snippet, result: child_process.SpawnSyncReturns<string>): 'success' | 'failure' {
  if (result.error) {
    // Spawning didn’t work
    throw result.error;
  }
  const stderrLines = splitLinesExclEol(result.stderr);
  if (result.status !== null && result.status !== 0) {
    console.log(' ❌');
    console.log(`Snippet exited with non-zero code ${result.status}`);
    logStderr(stderrLines);
    return 'failure';
  }
  if (result.signal !== null) {
    console.log(' ❌');
    console.log(`Snippet was terminated by signal ${result.signal}`);
    logStderr(stderrLines);
    return 'failure';
  }
  if (result.stderr.length > 0) {
    if (snippet.stderrId) {
      // We expected stderr output
      const expectedLines = assembleLinesForId(idToSnippet, globalLineMods, snippet.lineNumber, snippet.stderrId, `attribute ${ATTR_KEY_STDERR}`);
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
    const expectedLines = assembleLinesForId(idToSnippet, globalLineMods, snippet.lineNumber, snippet.stdoutId, `attribute ${ATTR_KEY_STDOUT}`);
    const stdoutLines = splitLinesExclEol(result.stdout);
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
  console.log('----- stdout -----');
  logAll(stdoutLines);
  console.log('------------------');
  if (expectedLines) {
    logDiff(expectedLines, stdoutLines);
    console.log('------------------');
  }
}
function logStderr(stderrLines: Array<string>, expectedLines?: Array<string>) {
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

function main() {
  const args = process.argv.slice(2);
  for (const filePath of args) {
    const absFilePath = path.resolve(filePath);
    console.log('RUN: ' + JSON.stringify(absFilePath));
    const text = fs.readFileSync(absFilePath, 'utf-8');
    const entities = parseMarkdown(text);
    const idToSnippet = createIdToSnippet(entities);
    runFile(absFilePath, entities, idToSnippet);
  }
}

function createIdToSnippet(entities: Array<MarktestEntity>) {
  const idToSnippet = new Map<string, Snippet>();
  for (const entity of entities) {
    if (entity instanceof Snippet && entity.id) {
      const other = idToSnippet.get(entity.id);
      if (other) {
        throw new UserError(
          `Duplicate id ${JSON.stringify(entity)} (other usage is in line ${other.lineNumber})`,
          { lineNumber: entity.lineNumber }
        );
      }
      idToSnippet.set(entity.id, entity);
    }
  }
  return idToSnippet;
}

main();