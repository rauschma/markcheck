#!/usr/bin/env node

import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { clearDirectorySync } from '@rauschma/helpers/nodejs/file.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { assertNonNullable } from '@rauschma/helpers/ts/type.js';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME, Config, fillInCommands } from './config.js';
import { isOutputEqual, logDiff } from '../util/diffing.js';
import { ATTR_KEY_STDERR, ATTR_KEY_STDOUT, ATTR_KEY_WRITE } from './directive.js';
import { ConfigMod, GlobalSkipMode, LineMod, SkipMode, Snippet, assembleLines, assembleLinesForId, type MarktestEntity } from './entities.js';
import { UserError } from '../util/errors.js';
import { parseMarkdown } from './parse-markdown.js';

enum LogLevel {
  Verbose,
  Normal,
}

const LOG_LEVEL: LogLevel = LogLevel.Normal;

function findMarktestDir(entities: Array<MarktestEntity>): string {
  const firstConfigMod = entities.find((entity) => entity instanceof ConfigMod);
  if (firstConfigMod instanceof ConfigMod) {
    const dir = firstConfigMod.configModJson.marktestDirectory;
    if (dir) {
      return dir;
    }
  }

  const startDir = process.cwd();
  let parentDir = startDir;
  while (true) {
    const mtd = path.resolve(parentDir, 'marktest');
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
    'Could not find a "marktest" directory neither configured not in the following directory or its ancestors: ' + JSON.stringify(parentDir)
  );
}

export function runFile(entities: Array<MarktestEntity>): void {
  const marktestDir = findMarktestDir(entities);
  console.log('Marktest directory: ' + marktestDir);
  clearDirectorySync(marktestDir);

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

  let globalSkipMode = GlobalSkipMode.Normal;
  if (entities.some((e) => e instanceof Snippet && e.skipMode === SkipMode.Only)) {
    globalSkipMode = GlobalSkipMode.Only;
  }

  const config = new Config();
  const globalLineMods = new Map<string, Array<LineMod>>();
  for (const entity of entities) {
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
      if (!entity.isActive(globalSkipMode)) {
        continue;
      }

      const langDef = config.lang.get(entity.lang);
      if (!langDef) {
        throw new UserError(`Unknown language: ${JSON.stringify(entity.lang)}`);
      }
      if (langDef === 'skip') {
        continue;
      }

      const fileName = entity.getFileName(langDef);
      const filePath = path.resolve(marktestDir, fileName);
      const lines = assembleLines(idToSnippet, globalLineMods, entity);
      if (LOG_LEVEL === LogLevel.Verbose) {
        console.log('Wrote ' + filePath);
      }
      fs.writeFileSync(filePath, lines.join(os.EOL), 'utf-8');

      for (const { id, fileName } of entity.writeSpecs) {
        const lines = assembleLinesForId(idToSnippet, globalLineMods, entity.lineNumber, id, `attribute ${ATTR_KEY_WRITE}`);
        const filePath = path.resolve(marktestDir, fileName);
        fs.writeFileSync(filePath, lines.join(os.EOL), 'utf-8');
        if (LOG_LEVEL === LogLevel.Verbose) {
          console.log('Wrote ' + filePath);
        }
      }

      if (entity.isActive(globalSkipMode) && langDef.commands.length > 0) {
        process.stdout.write(`L${entity.lineNumber} (${entity.lang})`);
        const commands: Array<Array<string>> = fillInCommands(langDef, {
          [CMD_VAR_FILE_NAME]: [entity.getFileName(langDef)],
          [CMD_VAR_ALL_FILE_NAMES]: entity.getAllFileNames(langDef),
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
            const status = checkResult(entity, result);
            if (status === 'failure') {
              break commandLoop;
            }
          }
          // Success only if all commands succeeded
          console.log(' ✅');
        }
      }
    } else {
      throw new UnsupportedValueError(entity);
    }
  }

  function checkResult(snippet: Snippet, result: child_process.SpawnSyncReturns<string>): 'success' | 'failure' {
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
}

function logAll(lines: Array<string>) {
  for (const line of lines) {
    console.log(line);
  }
}

function main() {
  const args = process.argv.slice(2);
  for (const filePath of args) {
    console.log('RUN: ' + JSON.stringify(filePath));
    const text = fs.readFileSync(filePath, 'utf-8');
    const entities = parseMarkdown(text);
    runFile(entities);
  }
}

main();