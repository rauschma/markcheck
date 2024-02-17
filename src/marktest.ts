import { clearDirectorySync } from '@rauschma/helpers/nodejs/file.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Config } from './config.js';
import { UserError } from './errors.js';
import { parseMarkdown } from './parse-markdown.js';
import { Configuration, Snippet, Transformation, type MtConstruct } from './snippet.js';

const CONFIG = new Config();
CONFIG.lang.set(
  "js", {
  fileName: 'main.mjs',
  command: ["node", "--loader=babel-register-esm", "--disable-warning=ExperimentalWarning", "main.mjs"],
});
CONFIG.lang.set("json", "ignore");

export function runFile(constructs: Array<MtConstruct>): void {
  const dirPath = path.resolve(process.cwd(), 'marktest');
  if (!fs.existsSync(dirPath)) {
    throw new UserError('Marktest directory does not exist: ' + JSON.stringify(dirPath));
  }
  console.log('Temporary directory: ' + JSON.stringify(dirPath))
  clearDirectorySync(dirPath);
  for (const construct of constructs) {
    if (construct instanceof Configuration) {

    } else if (construct instanceof Snippet) {
      const lines = new Array<string>();
      construct.assembleLines(lines);

      if (construct.writeToFile && construct.isActive()) {
        // For `write`, the language doesn’t matter
        const filePath = path.resolve(dirPath, construct.writeToFile);
        fs.writeFileSync(filePath, lines.join(os.EOL), 'utf-8');
        continue;
      }

      const langDef = CONFIG.lang.get(construct.lang);
      if (!langDef) {
        throw new UserError(`Unsupported language: ${JSON.stringify(construct.lang)}`);
      }
      if (langDef === 'ignore') {
        continue;
      }
      const filePath = path.resolve(dirPath, langDef.fileName);
      fs.writeFileSync(filePath, lines.join(os.EOL), 'utf-8');
      if (construct.isActive() && langDef.command.length > 0) {
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
    } else if (construct instanceof Transformation) {

    } else {
      throw new UnsupportedValueError(construct);
    }
  }
  // fs.rmSync(dirPath, { recursive: true });
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