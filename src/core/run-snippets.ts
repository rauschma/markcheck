import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { clearDirectorySync, ensureParentDirectory } from '@rauschma/helpers/nodejs/file.js';
import { ink } from '@rauschma/helpers/nodejs/text-ink.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { assertTrue } from '@rauschma/helpers/ts/type.js';
import json5 from 'json5';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as tty from 'node:tty';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { isOutputEqual, logDiff } from '../util/diffing.js';
import { UserError, contextDescription, contextLineNumber, describeUserErrorContext } from '../util/errors.js';
import { linesAreSame, linesContain, trimTrailingEmptyLines } from '../util/string.js';
import { Config, ConfigModJsonSchema, PROP_KEY_COMMANDS, PROP_KEY_DEFAULT_FILE_NAME, fillInCommandVariables, type LangDefCommand } from './config.js';
import { ATTR_KEY_CONTAINED_IN_FILE, ATTR_KEY_EXTERNAL, ATTR_KEY_SAME_AS_ID, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME } from './directive.js';
import { ConfigMod, FileStatus, GlobalRunningMode, Heading, LineMod, LogLevel, Snippet, RuningMode, assembleInnerLines, assembleOuterLines, assembleOuterLinesForId, getTargetSnippet, getUserErrorContext, type CliState, type MarktestEntity } from './entities.js';
import { parseMarkdown, type ParseMarkdownResult } from './parse-markdown.js';

//@ts-expect-error: Module '#package_json' has no default export.
import pkg from '#package_json' with { type: "json" };

const MARKTEST_DIR_NAME = 'marktest-data';
const MARKTEST_TMP_DIR_NAME = 'tmp';
const CONFIG_FILE_NAME = 'marktest-config.jsonc';
const { stringify } = JSON;

enum EntityKind {
  Runnable,
  NonRunnable,
}

export type Output = {
  write(str: string): void;
  writeLine(str?: string): void;
};

export function outputIgnored(): Output {
  return {
    write(_str: string): void { },
    writeLine(_str = ''): void { },
  };
}
export function outputFromWriteStream(writeStream: tty.WriteStream): Output {
  return {
    write(str: string): void {
      writeStream.write(str);
    },
    writeLine(str = ''): void {
      writeStream.write(str + os.EOL);
    },
  };
}

//#################### runFile() ####################

export function runFile(out: Output, logLevel: LogLevel, absFilePath: string, pmr: ParseMarkdownResult, interceptedShellCommands: null | Array<Array<string>> = null): FileStatus {
  const marktestDir = findMarktestDir(absFilePath, pmr.entities);
  out.writeLine(ink.FgBrightBlack`Marktest directory: ${relPath(marktestDir)}`);

  const tmpDir = path.resolve(marktestDir, MARKTEST_TMP_DIR_NAME);
  // `marktest/` must exist, `marktest/tmp/` may not exist
  if (fs.existsSync(tmpDir)) {
    clearDirectorySync(tmpDir);
  } else {
    fs.mkdirSync(tmpDir);
  }

  let globalVisitationMode = GlobalRunningMode.Normal;
  if (pmr.entities.some((e) => e instanceof Snippet && e.runningMode === RuningMode.Only)) {
    globalVisitationMode = GlobalRunningMode.Only;
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
    absFilePath,
    tmpDir,
    logLevel,
    idToSnippet: pmr.idToSnippet,
    idToLineMod: pmr.idToLineMod,
    globalVisitationMode,
    globalLineMods: new Map(),
    fileStatus: FileStatus.Success,
    interceptedShellCommands,
  };

  let prevHeading: null | Heading = null;
  for (const entity of pmr.entities) {
    try {
      const entityKind = handleOneEntity(out, cliState, config, prevHeading, entity);
      if (entity instanceof Heading) {
        prevHeading = entity; // update
      } else if (entityKind === EntityKind.Runnable) {
        // If an entity was run, it printed the most recent heading,
        // therefore “using it up”.
        prevHeading = null; // clear
      }
    } catch (err) {
      if (err instanceof UserError) {
        const description = (
          err.context
          ? describeUserErrorContext( err.context )
          : 'unknown context'
        );
        console.log(`${STATUS_EMOJI_FAILURE} ${err.message} (${description})`);
        if (err.stack) {
          console.log(err.stack);
        }
        continue;
      }
      const description = describeUserErrorContext(
        getUserErrorContext(entity)
      );
      throw new Error(`Unexpected error in entity (${description})`, { cause: err });
    }
  }

  return cliState.fileStatus;
}

function findMarktestDir(absFilePath: string, entities: Array<MarktestEntity>): string {
  const firstConfigMod = entities.find((entity) => entity instanceof ConfigMod);
  if (firstConfigMod instanceof ConfigMod) {
    const dir = firstConfigMod.configModJson.marktestDirectory;
    if (dir) {
      return dir;
    }
  }

  const startDir = path.dirname(absFilePath);
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
    `Could not find a ${stringify(MARKTEST_DIR_NAME)} directory neither configured nor in the following directory or its ancestors: ${stringify(startDir)}`
  );
}

function handleOneEntity(out: Output, cliState: CliState, config: Config, prevHeading: null | Heading, entity: MarktestEntity): EntityKind {
  if (entity instanceof ConfigMod) {
    config.applyMod(contextLineNumber(entity.lineNumber), entity.configModJson);
    return EntityKind.NonRunnable;
  } else if (entity instanceof LineMod) {
    if (entity.targetLanguage !== undefined) {
      let lineModArr = cliState.globalLineMods.get(entity.targetLanguage);
      if (!lineModArr) {
        lineModArr = [];
        cliState.globalLineMods.set(entity.targetLanguage, lineModArr);
      }
      lineModArr.push(entity);
    }
    return EntityKind.NonRunnable;
  } else if (entity instanceof Snippet) {
    return handleSnippet(out, cliState, config, prevHeading, entity);
  } else if (entity instanceof Heading) {
    // Ignore
    return EntityKind.NonRunnable;
  } else {
    throw new UnsupportedValueError(entity);
  }
}

function handleSnippet(out: Output, cliState: CliState, config: Config, prevHeading: null | Heading, snippet: Snippet): EntityKind {

  //----- Checks -----

  if (snippet.containedInFile) {
    const innerLines = assembleInnerLines(cliState, config, snippet);
    const pathName = path.resolve(cliState.absFilePath, '..', snippet.containedInFile);
    if (!fs.existsSync(pathName)) {
      throw new UserError(
        `Path of attribute ${stringify(ATTR_KEY_CONTAINED_IN_FILE)} does not exist: ${stringify(pathName)}`,
        { lineNumber: snippet.lineNumber }
      );
    }
    const container = splitLinesExclEol(fs.readFileSync(pathName, 'utf-8'));
    if (!linesContain(container, innerLines)) {
      throw new UserError(
        `Content of snippet is not contained in ${stringify(pathName)}`,
        { lineNumber: snippet.lineNumber }
      );
    }
  }

  if (snippet.sameAsId) {
    const innerLines = assembleInnerLines(cliState, config, snippet);
    const otherSnippet = getTargetSnippet(cliState, snippet.lineNumber, ATTR_KEY_SAME_AS_ID, snippet.sameAsId);
    const otherLines = assembleInnerLines(cliState, config, otherSnippet);
    if (!linesAreSame(innerLines, otherLines)) {
      throw new UserError(
        `Content of snippet is not same as content of snippet ${stringify(snippet.sameAsId)} (line ${otherSnippet.lineNumber})`,
        { lineNumber: snippet.lineNumber }
      );
    }
  }

  //----- Writing -----

  const writeOuter: null | string = snippet.writeOuter;
  if (writeOuter) {
    const lines = assembleOuterLines(cliState, config, snippet);
    writeOneFile(out, cliState, config, writeOuter, lines);
  }
  const writeInner: null | string = snippet.writeInner;
  if (writeInner) {
    const lines = assembleOuterLines(cliState, config, snippet);
    writeOneFile(out, cliState, config, writeInner, lines);
  }

  //----- Skipping -----

  // Explicitly skipped
  if (!snippet.isRun(cliState.globalVisitationMode)) {
    return EntityKind.NonRunnable;
  }
  const langDef = config.getLang(snippet.lang);
  if (langDef === undefined) {
    throw new UserError(
      `Unknown language: ${JSON.stringify(snippet.lang)}`,
      { lineNumber: snippet.lineNumber }
    );
  }
  if (langDef.kind === 'LangDefSkip') {
    return EntityKind.NonRunnable;
  }
  if (langDef.kind === 'LangDefErrorIfRun') {
    throw new UserError(
      `Language can’t be run: ${JSON.stringify(snippet.lang)}`,
      { lineNumber: snippet.lineNumber }
    );
  }

  //----- Running -----

  const fileName = snippet.getInternalFileName(langDef);
  const lines = assembleOuterLines(cliState, config, snippet);
  writeFiles(out, cliState, config, snippet, fileName, lines);

  assertTrue(langDef.kind === 'LangDefCommand');
  if (!langDef.commands) {
    throw new UserError(
      `Snippet is runnable but its language does not have ${stringify(PROP_KEY_COMMANDS)}`,
      { lineNumber: snippet.lineNumber }
    );
  }
  if (langDef.commands.length > 0) {
    handleSnippetWithCommands(out, config, cliState, prevHeading, snippet, langDef, fileName, langDef.commands);
    return EntityKind.Runnable;
  }
  return EntityKind.NonRunnable;
}

//#################### writeFiles() ####################

function writeFiles(out: Output, cliState: CliState, config: Config, snippet: Snippet, fileName: string, lines: Array<string>): void {
  writeOneFile(out, cliState, config, fileName, lines);

  for (const { id, fileName } of snippet.externalSpecs) {
    if (!id) continue;
    const lines = assembleOuterLinesForId(cliState, config, snippet.lineNumber, ATTR_KEY_EXTERNAL, id);
    writeOneFile(out, cliState, config, fileName, lines);
  }
}

function writeOneFile(out: Output, cliState: CliState, config: Config, fileName: string, lines: Array<string>) {
  const filePath = path.resolve(cliState.tmpDir, fileName);
  if (cliState.logLevel === LogLevel.Verbose) {
    out.writeLine('Write ' + filePath);
  }
  let content = lines.join(os.EOL);
  content = config.searchAndReplaceFunc(content);
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, content, 'utf-8');
}

//#################### handleSnippetWithCommands() ####################

const STATUS_EMOJI_SUCCESS = ink.FgGreen`✔︎`;
const STATUS_EMOJI_FAILURE = '❌';

function handleSnippetWithCommands(out: Output, config: Config, cliState: CliState, prevHeading: Heading | null, snippet: Snippet, langDef: LangDefCommand, fileName: string, commands: Array<Array<string>>) {
  if (prevHeading) {
    out.writeLine(ink.Bold(prevHeading.content));
  }
  // With verbose output, there will be printed text before we could
  // print the status emoji. That is, it wouldn’t appear in the same line.
  // That’s why we don’t print it at all in this case.
  const printStatusEmoji = (cliState.logLevel === LogLevel.Normal);
  out.write(`L${snippet.lineNumber} (${snippet.lang})`);
  if (!printStatusEmoji) {
    out.writeLine();
  }
  try {
    runShellCommands(out, cliState, config, snippet, langDef, fileName, commands);
    if (printStatusEmoji) {
      out.writeLine(' ' + STATUS_EMOJI_SUCCESS);
    }
  } catch (err) {
    if (err instanceof UserError) {
      cliState.fileStatus = FileStatus.Failure;
      if (printStatusEmoji) {
        out.writeLine(' ' + STATUS_EMOJI_FAILURE);
      }
      if (err.stdoutLines) {
        logStdout(out, err.stdoutLines, err.expectedStdoutLines);
      }
      if (err.stderrLines) {
        logStderr(out, err.stderrLines, err.expectedStderrLines);
      }
    } else {
      throw err;
    }
  }
}

function runShellCommands(out: Output, cliState: CliState, config: Config, snippet: Snippet, langDef: LangDefCommand, fileName: string, commandsWithVars: Array<Array<string>>): void {
  const commands: Array<Array<string>> = fillInCommandVariables(commandsWithVars, {
    [CMD_VAR_FILE_NAME]: [fileName],
    [CMD_VAR_ALL_FILE_NAMES]: snippet.getAllFileNames(langDef),
  });
  if (cliState.interceptedShellCommands) {
    cliState.interceptedShellCommands.push(
      commands.map(commandParts => commandParts.join(' '))
    );
    return;
  }
  for (const commandParts of commands) {
    if (cliState.logLevel === LogLevel.Verbose) {
      out.writeLine(commandParts.join(' '));
    }
    const [command, ...args] = commandParts;
    const result = child_process.spawnSync(command, args, {
      shell: true,
      cwd: cliState.tmpDir,
      encoding: 'utf-8',
    });
    checkShellCommandResult(cliState, config, snippet, result);
  }
}

function checkShellCommandResult(cliState: CliState, config: Config, snippet: Snippet, commandResult: child_process.SpawnSyncReturns<string>): void {
  if (commandResult.error) {
    // Spawning didn’t work
    throw commandResult.error;
  }

  const stdoutLines = splitLinesExclEol(commandResult.stdout);
  trimTrailingEmptyLines(stdoutLines);
  const stderrLines = splitLinesExclEol(commandResult.stderr);
  trimTrailingEmptyLines(stderrLines);

  if (commandResult.status !== null && commandResult.status !== 0) {
    throw new UserError(
      `Snippet exited with non-zero code ${commandResult.status}`,
      {
        stdoutLines,
        stderrLines,
      }
    );
  }
  if (commandResult.signal !== null) {
    throw new UserError(
      `Snippet was terminated by signal ${commandResult.signal}`,
      {
        stdoutLines,
        stderrLines,
      }
    );
  }
  if (commandResult.stderr.length > 0) {
    if (snippet.stderrId) {
      // We expected stderr output
      const expectedStderrLines = assembleOuterLinesForId(cliState, config, snippet.lineNumber, ATTR_KEY_STDERR, snippet.stderrId);
      trimTrailingEmptyLines(expectedStderrLines);
      if (!isOutputEqual(expectedStderrLines, stderrLines)) {
        throw new UserError(
          'stderr was not as expected',
          {
            stderrLines,
            expectedStderrLines,
          }
        );
      }
    } else {
      throw new UserError(
        'There was unexpected stderr output',
        {
          stderrLines,
        }
      );
    }
  }
  if (snippet.stdoutId) {
    // Normally stdout is ignored. But in this case, we examine it.
    const expectedStdoutLines = assembleOuterLinesForId(cliState, config, snippet.lineNumber, ATTR_KEY_STDOUT, snippet.stdoutId);
    trimTrailingEmptyLines(expectedStdoutLines);
    if (!isOutputEqual(stdoutLines, expectedStdoutLines)) {
      throw new UserError(
        'stdout was not as expected',
        {
          stdoutLines,
          expectedStdoutLines,
        }
      );
    }
  }
}

//#################### Logging helpers ####################

function logStdout(out: Output, stdoutLines: Array<string>, expectedLines?: Array<string>): void {
  logStd(out, 'stdout', stdoutLines, expectedLines);
}
function logStderr(out: Output, stderrLines: Array<string>, expectedLines?: Array<string>): void {
  logStd(out, 'stderr', stderrLines, expectedLines);
}
function logStd(out: Output, name: string, actualLines: Array<string>, expectedLines?: Array<string>): void {
  if (expectedLines === undefined && actualLines.length === 0) {
    return;
  }
  const title = `----- ${name} -----`;
  out.writeLine(title);
  logAll(out, actualLines);
  out.writeLine('-'.repeat(title.length));
  if (expectedLines) {
    logDiff(expectedLines, actualLines);
    out.writeLine('-'.repeat(title.length));
  }
}

function logAll(out: Output, lines: Array<string>) {
  for (const line of lines) {
    out.writeLine(line);
  }
}

function relPath(absPath: string) {
  return path.relative(process.cwd(), absPath);
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

export function cliEntry() {
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
      'Options:',
      '--help -h: get help',
      '--version -v: print version',
      '--print-config: print built-in configuration',
      '--verbose -v: show more information (e.g. which shell commands are run)',
    ];
    for (const line of helpLines) {
      console.log(line);
    }
    return;
  }
  assertTrue(args.positionals.length > 0);
  const failedFiles = new Array<string>();
  for (const filePath of args.positionals) {
    const absFilePath = path.resolve(filePath);
    console.log();
    console.log(ink.FgBlue.Bold`===== ${relPath(absFilePath)} =====`);
    const text = fs.readFileSync(absFilePath, 'utf-8');
    const pmr = parseMarkdown(text);
    const logLevel = (args.values.verbose ? LogLevel.Verbose : LogLevel.Normal);
    const out = outputFromWriteStream(process.stdout);
    const fileStatus = runFile(out, logLevel, absFilePath, pmr);
    if (fileStatus === FileStatus.Failure) {
      failedFiles.push(relPath(absFilePath));
    }
  }

  const style = (
    failedFiles.length === 0 ? ink.FgGreen.Bold : ink.FgRed.Bold
  );
  console.log();
  console.log(style`===== SUMMARY =====`);
  const totalFileCount = args.positionals.length;
  const totalString = totalFileCount + (
    totalFileCount === 1 ? ' file' : ' files'
  );
  if (failedFiles.length === 0) {
    console.log(`All succeeded: ${totalString} ✅`);
  } else {
    console.log(`Failures: ${failedFiles.length} of ${totalString} ❌`);
    for (const failedFile of failedFiles) {
      console.log(`• ${failedFile}`);
    }
  }
}
