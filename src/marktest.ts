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

export function runFile(entities: Array<MarktestEntity>): void {
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
  config.lang.set(
    "js", {
    fileName: 'main.mjs',
    command: ["node", "--loader=babel-register-esm", "--disable-warning=ExperimentalWarning", "main.mjs"],
  });
  config.lang.set("json", "ignore");

  const globalLineMods = new Map<string, Array<LineMod>>();

  const dirPath = path.resolve(process.cwd(), 'marktest');
  if (!fs.existsSync(dirPath)) {
    throw new UserError('Marktest directory does not exist: ' + JSON.stringify(dirPath));
  }
  console.log('Marktest directory: ' + JSON.stringify(dirPath))
  clearDirectorySync(dirPath);
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
          const filePath = path.resolve(dirPath, entity.fileNameToWrite);
          fs.writeFileSync(filePath, lines.join(os.EOL), 'utf-8');
        }
        continue;
      }

      const langDef = config.lang.get(entity.lang);
      if (!langDef) {
        throw new UserError(`Cannot run this language: ${JSON.stringify(entity.lang)}`);
      }
      if (langDef === 'ignore') {
        continue;
      }
      const filePath = path.resolve(dirPath, langDef.fileName);
      fs.writeFileSync(filePath, lines.join(os.EOL), 'utf-8');
      if (entity.isActive() && langDef.command.length > 0) {
        const [command, ...args] = langDef.command;
        console.log(langDef.command.join(' '));
        const result = child_process.spawnSync(command, args, {
          shell: true,
          cwd: dirPath,
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
  const filePath = args[0];
  console.log('RUN: ' + JSON.stringify(filePath));
  const text = fs.readFileSync(filePath, 'utf-8');
  const constructs = parseMarkdown(text);
  runFile(constructs);
}

main();