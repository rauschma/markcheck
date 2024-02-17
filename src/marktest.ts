#!/usr/bin/env node

import { clearDirectorySync } from '@rauschma/helpers/nodejs/file.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { assertNonNullable } from '@rauschma/helpers/ts/type.js';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Config } from './config.js';
import { ConfigMod, LineMod, Snippet, assembleLines, type MarktestEntity } from './entities.js';
import { UserError } from './errors.js';
import { parseMarkdown } from './parse-markdown.js';


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
          {lineNumber: entity.lineNumber}
        );
      }
      idToSnippet.set(entity.id, entity);
    }
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
      const lines = assembleLines(idToSnippet, globalLineMods.get(entity.lang), entity);

      if (entity.fileNameToWrite) {
        // For `write`, the language doesn’t matter
        if (entity.isActive()) {
          const filePath = path.resolve(marktestDir, entity.fileNameToWrite);
          fs.writeFileSync(filePath, lines.join(os.EOL), 'utf-8');
        }
        continue;
      }

      const langDef = config.lang.get(entity.lang);
      if (!langDef) {
        throw new UserError(`Unknown language: ${JSON.stringify(entity.lang)}`);
      }
      if (langDef === 'skip') {
        continue;
      }
      const filePath = path.resolve(marktestDir, langDef.fileName);
      fs.writeFileSync(filePath, lines.join(os.EOL), 'utf-8');
      if (entity.isActive() && langDef.command.length > 0) {
        const [command, ...args] = langDef.command;
        console.log(langDef.command.join(' '));
        const result = child_process.spawnSync(command, args, {
          shell: true,
          cwd: marktestDir,
          encoding: 'utf-8',
        });
        console.log(result.stdout);
        console.log(result.stderr);
      }
    } else {
      throw new UnsupportedValueError(entity);
    }
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