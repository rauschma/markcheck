#!/usr/bin/env -S node --no-warnings=ExperimentalWarning
// Importing JSON is experimental

import { assertTrue } from '@rauschma/helpers/typescript/type.js';
import { style } from '@rauschma/nodejs-tools/cli/text-style.js';
import json5 from 'json5';
import * as fs from 'node:fs';
import path from 'path';
import { parseArgs, type ParseArgsConfig } from 'util';
import { Config, ConfigModJsonSchema } from './core/config.js';
import { parseMarkdown } from './core/parse-markdown.js';
import { CONFIG_FILE_REL_PATH, runParsedMarkdown } from './core/run-entities.js';
import { LogLevel, StatusCounts } from './entity/snippet.js';
import { MarkcheckSyntaxError, Output, STATUS_EMOJI_FAILURE } from './util/errors.js';
import { relPath } from './util/path-tools.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

//@ts-expect-error: Module '#package_json' has no default export.
import pkg from '#package_json' with { type: 'json' };

const {stringify} = JSON;

const BIN_NAME = 'markcheck';
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
  'print-schema': {
    type: 'boolean',
    short: 's',
  },
  'verbose': {
    type: 'boolean',
    short: 'v',
  },
} satisfies ParseArgsConfig['options'];

export function main() {
  const out = (
    process.stdout.isTTY
    ? Output.toStdout()
    : Output.toStdoutWithoutAnsiEscapes()
  );
  const args = parseArgs({ allowPositionals: true, options: ARG_OPTIONS });

  if (args.values.version) {
    out.writeLine(pkg.version);
    return;
  }
  if (args.values['print-config']) {
    out.writeLine(json5.stringify(new Config().addDefaults().toJson(), {space: 2, quote: `"`}));
    return;
  }
  if (args.values['print-schema']) {
    const json = zodToJsonSchema(ConfigModJsonSchema, "MarkcheckConfig");
    console.log(JSON.stringify(json, null, 2));
    // Alternative:
    // npx ts-json-schema-generator --tsconfig tsconfig.json --type 'ConfigJson'
    return;
  }
  if (args.values.help || args.positionals.length === 0) {
    const helpText = outdent`
      ${style.Bold`${BIN_NAME} «file1.md» «file2.md» ...`}
      
      Options:
      ${style.Bold`--help -h`}          get help
      ${style.Bold`--version`}          print version
      ${style.Bold`--print-config -c`}  print configuration defaults
      ${style.Bold`--print-schema -s`}  print JSON schema for config data (in config: directives
      ${          `                 `}  and ${CONFIG_FILE_REL_PATH})
      ${style.Bold`--verbose -v`}       show more information (e.g. which shell commands are run)
    `;
    out.writeLine(helpText);
    return;
  }
  const logLevel = (args.values.verbose ? LogLevel.Verbose : LogLevel.Normal);
  const failedFiles = new Array<StatusCounts>();

  assertTrue(args.positionals.length > 0);
  for (const filePath of args.positionals) {
    const absFilePath = path.resolve(filePath);
    const relFilePath = relPath(absFilePath);
    out.writeLine();
    out.writeLine(style.FgBlue.Bold`========== ${relFilePath} ==========`);
    const statusCounts = new StatusCounts(relFilePath);
    const text = fs.readFileSync(absFilePath, 'utf-8');
    try {
      const parsedMarkdown = parseMarkdown(text);
      runParsedMarkdown(out, absFilePath, logLevel, parsedMarkdown, statusCounts);
    } catch (err) {
      // runParsedMarkdown() handles many exceptions (incl. `TestFailure`).
      // Here, we only need to handle exceptions that happen during
      // parseMarkdown().
      if (err instanceof MarkcheckSyntaxError) {
        statusCounts.syntaxErrors++;
        err.logTo(out, `${STATUS_EMOJI_FAILURE} `);
      } else {
        throw new Error(`Unexpected error in file ${stringify(relFilePath)}`, { cause: err });
      }
    }
    const headingStyle = (
      statusCounts.hasFailed() ? style.FgRed.Bold : style.FgGreen.Bold
    );
    out.writeLine(headingStyle`----- Summary of ${stringify(relFilePath)} -----`);
    out.writeLine(statusCounts.describe());
    if (statusCounts.hasFailed()) {
      failedFiles.push(statusCounts);
    }
  }

  const headingStyle = (
    failedFiles.length === 0 ? style.FgGreen.Bold : style.FgRed.Bold
  );
  out.writeLine();
  out.writeLine(headingStyle`========== TOTAL SUMMARY ==========`);
  const totalFileCount = args.positionals.length;
  const totalString = totalFileCount + (
    totalFileCount === 1 ? ' file' : ' files'
  );
  if (failedFiles.length === 0) {
    out.writeLine(`✅ All succeeded: ${totalString}`);
  } else {
    out.writeLine(`❌ Failures: ${failedFiles.length} of ${totalString}`);
    for (const failedFile of failedFiles) {
      out.writeLine(`• ${failedFile}`);
    }
  }
}

main();