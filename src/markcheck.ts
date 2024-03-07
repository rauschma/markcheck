#!/usr/bin/env -S node --enable-source-maps --no-warnings=ExperimentalWarning
// Importing JSON is experimental

import { style } from '@rauschma/helpers/nodejs/text-style.js';
import { assertTrue } from '@rauschma/helpers/ts/type.js';
import * as fs from 'node:fs';
import path from 'path';
import { parseArgs, type ParseArgsConfig } from 'util';
import { Config } from './core/config.js';
import { parseMarkdown } from './core/parse-markdown.js';
import { runParsedMarkdown } from './core/run-entities.js';
import { LogLevel, StatusCounts } from './entity/snippet.js';
import { MarkcheckSyntaxError, Output, STATUS_EMOJI_FAILURE } from './util/errors.js';
import { relPath } from './util/path-tools.js';

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
    short: 'p',
  },
  'verbose': {
    type: 'boolean',
    short: 'v',
  },
} satisfies ParseArgsConfig['options'];

export function main() {
  const out = Output.fromStdout();
  const args = parseArgs({ allowPositionals: true, options: ARG_OPTIONS });

  if (args.values.version) {
    out.writeLine(pkg.version);
    return;
  }
  if (args.values['print-config']) {
    out.writeLine(JSON.stringify(new Config().addDefaults().toJson(), null, 2));
    return;
  }
  if (args.values.help || args.positionals.length === 0) {
    const helpLines = [
      '',
      style.Bold`${BIN_NAME} «file1.md» «file2.md» ...`,
      '',
      'Options:',
      `${style.Bold`--help -h`}          get help`,
      `${style.Bold`--version`}          print version`,
      `${style.Bold`--print-config -p`}  print built-in configuration`,
      `${style.Bold`--verbose -v`}       show more information (e.g. which shell commands are run)`,
      '',
    ];
    for (const line of helpLines) {
      out.writeLine(line);
    }
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