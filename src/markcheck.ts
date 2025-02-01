#!/usr/bin/env node

import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { assertTrue } from '@rauschma/helpers/typescript/type.js';
import { style } from '@rauschma/nodejs-tools/cli/text-style.js';
import json5 from 'json5';
import * as fs from 'node:fs';
import path from 'path';
import { parseArgs, type ParseArgsConfig } from 'util';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Config, ConfigModJsonSchema } from './core/config.js';
import { parseMarkdown } from './core/parse-markdown.js';
import { CONFIG_FILE_REL_PATH, runParsedMarkdown } from './core/run-entities.js';
import { GlobalRunningMode, LogLevel, StatusCounts } from './entity/snippet.js';
import { MarkcheckSyntaxError, Output, SnippetStatusEmoji } from './util/errors.js';
import { relPath } from './util/path-tools.js';

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

  const mdFiles = args.positionals;
  assertTrue(mdFiles.length > 0);
  const totalStatus = new StatusCounts();
  for (const filePath of mdFiles) {
    const absFilePath = path.resolve(filePath);
    const relFilePath = relPath(absFilePath);
    out.writeLine();
    out.writeLine(style.FgBlue.Bold`========== ${relFilePath} ==========`);
    const statusCounts = new StatusCounts(relFilePath);
    const text = fs.readFileSync(absFilePath, 'utf-8');
    let globalRunningMode = GlobalRunningMode.Normal;
    try {
      const parsedMarkdown = parseMarkdown(text);
      globalRunningMode = runParsedMarkdown(out, absFilePath, logLevel, parsedMarkdown, statusCounts);
    } catch (err) {
      // runParsedMarkdown() handles many exceptions (incl. `TestFailure`).
      // Here, we only need to handle exceptions that happen during
      // parseMarkdown().
      if (err instanceof MarkcheckSyntaxError) {
        statusCounts.syntaxErrors++;
        err.logTo(out, `${SnippetStatusEmoji.FailureOrError} `);
      } else {
        throw new Error(`Unexpected error in file ${stringify(relFilePath)}`, { cause: err });
      }
    }
    let headingStyle;
    let statusEmoji;
    if (mdFiles.length === 1) {
      headingStyle = statusCounts.getHeadingStyle();
      statusEmoji = statusCounts.getSummaryStatusEmoji() + ' ';
    } else {
      headingStyle = style.Reset;
      statusEmoji = '';
    }
    out.writeLine(headingStyle`----- Summary of ${stringify(relFilePath)} -----`);
    if (globalRunningMode === GlobalRunningMode.Only) {
      out.writeLine(`(Running mode ${stringify(GlobalRunningMode.Only)} was active)`);
    }
    out.writeLine(statusEmoji + statusCounts.describe());
    totalStatus.addOther(statusCounts);
    if (statusCounts.hasFailed()) {
      failedFiles.push(statusCounts);
    }
  }

  if (mdFiles.length > 1) {
    // Only show a total summary if there is more than one file
    const headingStyle = totalStatus.getHeadingStyle();
    out.writeLine();
    out.writeLine(headingStyle`========== TOTAL SUMMARY ==========`);
    const totalFileCount = args.positionals.length;
    const totalString = totalFileCount + (
      totalFileCount === 1 ? ' file' : ' files'
    );
    if (failedFiles.length === 0) {
      out.writeLine(`${totalStatus.getSummaryStatusEmoji()} All files succeeded: ${totalString}`);
      out.writeLine(totalStatus.describe());
    } else {
      out.writeLine(`${totalStatus.getSummaryStatusEmoji()} Failed files: ${failedFiles.length} of ${totalString}`);
      out.writeLine(totalStatus.describe());
      for (const failedFile of failedFiles) {
        out.writeLine(`• ${failedFile.toString()}`);
      }
    }
  }
}

main();