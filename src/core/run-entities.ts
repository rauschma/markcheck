import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { clearDirectorySync, ensureParentDirectory } from '@rauschma/helpers/nodejs/file.js';
import { style } from '@rauschma/helpers/nodejs/text-style.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import json5 from 'json5';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { ConfigMod } from '../entity/config-mod.js';
import { ATTR_KEY_CONTAINED_IN_FILE, ATTR_KEY_EXTERNAL, ATTR_KEY_ID, ATTR_KEY_LINE_MOD_ID, ATTR_KEY_SAME_AS_ID, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME, INCL_ID_THIS } from '../entity/directive.js';
import { Heading } from '../entity/heading.js';
import { LineMod } from '../entity/line-mod.js';
import { GlobalRunningMode, LogLevel, RuningMode, Snippet, StatusCounts, assembleInnerLines, assembleOuterLines, assembleOuterLinesForId, getTargetSnippet, getUserErrorContext, type CliState, type CommandResult, type MarkcheckEntity, type MockShellData } from '../entity/snippet.js';
import { isOutputEqual, logDiff } from '../util/diffing.js';
import { ConfigurationError, MarkcheckSyntaxError, Output, STATUS_EMOJI_FAILURE, STATUS_EMOJI_SUCCESS, TestFailure, contextDescription, contextLineNumber, describeUserErrorContext } from '../util/errors.js';
import { linesAreSame, linesContain } from '../util/line-tools.js';
import { trimTrailingEmptyLines } from '../util/string.js';
import { Config, ConfigModJsonSchema, PROP_KEY_COMMANDS, fillInCommandVariables, type LangDefCommand } from './config.js';
import { parseMarkdown, type ParsedMarkdown } from './parse-markdown.js';

//@ts-expect-error: Module '#package_json' has no default export.
import pkg from '#package_json' with { type: "json" };
import { setDifference } from '@rauschma/helpers/collection/set.js';

const MARKTEST_DIR_NAME = 'markcheck-data';
const MARKTEST_TMP_DIR_NAME = 'tmp';
const CONFIG_FILE_NAME = 'markcheck-config.jsonc';
const { stringify } = JSON;

enum EntityKind {
  Runnable,
  NonRunnable,
}

//#################### runParsedMarkdown() ####################

export function runParsedMarkdown(out: Output, absFilePath: string, logLevel: LogLevel, parsedMarkdown: ParsedMarkdown, statusCounts: StatusCounts, mockShellData: null | MockShellData = null): void {
  const markcheckDir = findMarkcheckDir(absFilePath, parsedMarkdown.entities);
  out.writeLine(style.FgBrightBlack`Markcheck directory: ${relPath(markcheckDir)}`);

  const tmpDir = path.resolve(markcheckDir, MARKTEST_TMP_DIR_NAME);
  // `markcheck/` must exist, `markcheck/tmp/` may not exist
  if (fs.existsSync(tmpDir)) {
    clearDirectorySync(tmpDir);
  } else {
    fs.mkdirSync(tmpDir);
  }

  let globalVisitationMode = GlobalRunningMode.Normal;
  if (parsedMarkdown.entities.some((e) => e instanceof Snippet && e.runningMode === RuningMode.Only)) {
    globalVisitationMode = GlobalRunningMode.Only;
  }

  const config = new Config();
  const configFilePath = path.resolve(markcheckDir, CONFIG_FILE_NAME);
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
    idToSnippet: parsedMarkdown.idToSnippet,
    idToLineMod: parsedMarkdown.idToLineMod,
    globalVisitationMode,
    globalLineMods: new Map(),
    statusCounts,
    mockShellData,
  };

  let prevHeading: null | Heading = null;
  for (const entity of parsedMarkdown.entities) {
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
      if (err instanceof MarkcheckSyntaxError) {
        cliState.statusCounts.syntaxErrors++;
        err.logTo(out, `${STATUS_EMOJI_FAILURE} `);
      } else if (err instanceof TestFailure) {
        cliState.statusCounts.testFailures++;
        err.logTo(out, `${STATUS_EMOJI_FAILURE} `);
      } else {
        const description = describeUserErrorContext(
          getUserErrorContext(entity)
        );
        throw new Error(`Unexpected error in entity (${description})`, { cause: err });
      }
    }
  }
  checkSnippetIds(parsedMarkdown, out, statusCounts);
  checkLineModIds(parsedMarkdown, out, statusCounts);
}

function checkSnippetIds(parsedMarkdown: ParsedMarkdown, out: Output, statusCounts: StatusCounts) {
  {
    const declaredIds = new Set<string>();
    const referencedIds = new Set<string>();
    for (const entity of parsedMarkdown.entities) {
      if (entity instanceof Snippet) {
        if (entity.id) {
          declaredIds.add(entity.id);
        }
        entity.visitSingleSnippet((snippet) => {
          for (const extSpec of snippet.externalSpecs) {
            if (extSpec.id !== null) {
              referencedIds.add(extSpec.id);
            }
          }
          if (snippet.sameAsId !== null) {
            referencedIds.add(snippet.sameAsId);
          }
          for (const inclId of snippet.includeIds) {
            if (inclId !== INCL_ID_THIS) {
              referencedIds.add(inclId);
            }
          }
          if (snippet.stdoutSpec !== null) {
            referencedIds.add(snippet.stdoutSpec.snippetId);
          }
          if (snippet.stderrSpec !== null) {
            referencedIds.add(snippet.stderrSpec.snippetId);
          }
        });
      }
    }
    const unusedIds = setDifference(declaredIds, referencedIds);
    if (unusedIds.size > 0) {
      out.writeLine(`❌ Unused ${stringify(ATTR_KEY_ID)} values: ${Array.from(unusedIds).join(', ')}`);
      statusCounts.warnings++;
    }
  }
}

function checkLineModIds(parsedMarkdown: ParsedMarkdown, out: Output, statusCounts: StatusCounts) {
  const declaredIds = new Set<string>();
  const referencedIds = new Set<string>();
  for (const entity of parsedMarkdown.entities) {
    if (entity instanceof LineMod) {
      const lineModId = entity.getLineModId();
      if (lineModId) {
        declaredIds.add(lineModId);
      }
    }
    if (entity instanceof Snippet) {
      entity.visitSingleSnippet((snippet) => {
        if (snippet.applyInnerId !== null) {
          referencedIds.add(snippet.applyInnerId);
        }
        if (snippet.applyOuterId !== null) {
          referencedIds.add(snippet.applyOuterId);
        }
        if (snippet.stdoutSpec?.lineModId) {
          referencedIds.add(snippet.stdoutSpec?.lineModId);
        }
        if (snippet.stderrSpec?.lineModId) {
          referencedIds.add(snippet.stderrSpec?.lineModId);
        }
      });
    }
  }
  const unusedIds = setDifference(declaredIds, referencedIds);
  if (unusedIds.size > 0) {
    out.writeLine(`❌ Unused ${stringify(ATTR_KEY_LINE_MOD_ID)} values: ${Array.from(unusedIds).join(', ')}`);
    statusCounts.warnings++;
  }
}

function findMarkcheckDir(absFilePath: string, entities: Array<MarkcheckEntity>): string {
  const firstConfigMod = entities.find((entity) => entity instanceof ConfigMod);
  if (firstConfigMod instanceof ConfigMod) {
    const dir = firstConfigMod.configModJson.markcheckDirectory;
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
  throw new ConfigurationError(
    `Could not find a ${stringify(MARKTEST_DIR_NAME)} directory neither configured nor in the following directory or its ancestors: ${stringify(startDir)}`
  );
}

function handleOneEntity(out: Output, cliState: CliState, config: Config, prevHeading: null | Heading, entity: MarkcheckEntity): EntityKind {
  if (entity instanceof ConfigMod) {
    config.applyMod(contextLineNumber(entity.lineNumber), entity.configModJson);
    return EntityKind.NonRunnable;
  } else if (entity instanceof LineMod) {
    const targetLanguage = entity.getTargetLanguage();
    if (targetLanguage !== undefined) {
      let lineModArr = cliState.globalLineMods.get(targetLanguage);
      if (!lineModArr) {
        lineModArr = [];
        cliState.globalLineMods.set(targetLanguage, lineModArr);
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
      throw new MarkcheckSyntaxError(
        `Path of attribute ${stringify(ATTR_KEY_CONTAINED_IN_FILE)} does not exist: ${stringify(pathName)}`,
        { lineNumber: snippet.lineNumber }
      );
    }
    const container = splitLinesExclEol(fs.readFileSync(pathName, 'utf-8'));
    if (!linesContain(container, innerLines)) {
      throw new TestFailure(
        `Content of snippet is not contained in file ${stringify(pathName)}`,
        { lineNumber: snippet.lineNumber }
      );
    }
  }

  if (snippet.sameAsId) {
    const innerLines = assembleInnerLines(cliState, config, snippet);
    const otherSnippet = getTargetSnippet(cliState, snippet.lineNumber, ATTR_KEY_SAME_AS_ID, snippet.sameAsId);
    const otherLines = assembleInnerLines(cliState, config, otherSnippet);
    if (!linesAreSame(innerLines, otherLines)) {
      throw new TestFailure(
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
    throw new MarkcheckSyntaxError(
      `Unknown language: ${JSON.stringify(snippet.lang)}`,
      { lineNumber: snippet.lineNumber }
    );
  }
  if (langDef.kind === 'LangDefSkip') {
    return EntityKind.NonRunnable;
  }
  if (langDef.kind === 'LangDefErrorIfRun') {
    throw new MarkcheckSyntaxError(
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
    throw new MarkcheckSyntaxError(
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

function handleSnippetWithCommands(out: Output, config: Config, cliState: CliState, prevHeading: Heading | null, snippet: Snippet, langDef: LangDefCommand, fileName: string, commands: Array<Array<string>>) {
  if (prevHeading) {
    out.writeLine(style.Bold(prevHeading.content));
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
    if (err instanceof TestFailure) {
      cliState.statusCounts.testFailures++;
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
  for (const [index, commandParts] of commands.entries()) {
    if (cliState.logLevel === LogLevel.Verbose) {
      out.writeLine(commandParts.join(' '));
    }
    let commandResult: null | CommandResult = null;
    if (cliState.mockShellData) {
      cliState.mockShellData.interceptedCommands.push(
        commandParts.join(' ')
      );
      if (cliState.mockShellData.commandResults) {
        commandResult = cliState.mockShellData.commandResults[index];
        assertNonNullable(commandResult);
      }
    } else {
      const [command, ...args] = commandParts;
      const commandResult = child_process.spawnSync(command, args, {
        shell: true,
        cwd: cliState.tmpDir,
        encoding: 'utf-8',
      });
      if (commandResult.error) {
        // Spawning didn’t work
        throw commandResult.error;
      }
    }
    if (commandResult) {
      const isLastCommand = (index === commands.length-1);
      checkShellCommandResult(cliState, config, snippet, commandResult, isLastCommand);
    }
  }
}

function checkShellCommandResult(cliState: CliState, config: Config, snippet: Snippet, commandResult: CommandResult, isLastCommand: boolean): void {
  const stdoutLines = splitLinesExclEol(commandResult.stdout);
  trimTrailingEmptyLines(stdoutLines);
  const stderrLines = splitLinesExclEol(commandResult.stderr);
  trimTrailingEmptyLines(stderrLines);

  if (commandResult.status !== null && commandResult.status !== 0) {
    throw new TestFailure(
      `Snippet exited with non-zero code ${commandResult.status}`,
      {
        stdoutLines,
        stderrLines,
      }
    );
  }
  if (commandResult.signal !== null) {
    throw new TestFailure(
      `Snippet was terminated by signal ${commandResult.signal}`,
      {
        stdoutLines,
        stderrLines,
      }
    );
  }
  // stdout & stderr content are only checked for the last command
  if (!isLastCommand) return;
  if (commandResult.stderr.length > 0) {
    if (snippet.stderrSpec) {
      // We expected stderr output
      let actualStderrLines = stderrLines;
      if (snippet.stderrSpec.lineModId) {
        const lineMod = cliState.idToLineMod.get(snippet.stderrSpec.lineModId);
        if (lineMod === undefined) {
          throw new MarkcheckSyntaxError(
            `Could not find LineMod with id ${stringify(snippet.stderrSpec.lineModId)} (attribute ${stringify(ATTR_KEY_STDERR)})`
          );
        }
        const tmpLines = new Array<string>();
        lineMod.pushModifiedBodyTo(snippet.lineNumber, actualStderrLines, undefined, tmpLines);
        actualStderrLines = tmpLines;
      }

      const expectedStderrLines = assembleOuterLinesForId(cliState, config, snippet.lineNumber, ATTR_KEY_STDERR, snippet.stderrSpec.snippetId);
      trimTrailingEmptyLines(expectedStderrLines);
      if (!isOutputEqual(expectedStderrLines, actualStderrLines)) {
        throw new TestFailure(
          'stderr was not as expected',
          {
            stderrLines: actualStderrLines,
            expectedStderrLines,
          }
        );
      }
    } else {
      throw new TestFailure(
        'There was unexpected stderr output',
        {
          stderrLines,
        }
      );
    }
  }
  if (snippet.stdoutSpec) {
    // Normally stdout is ignored. But in this case, we examine it.
    let actualStdoutLines = stdoutLines;
    if (snippet.stdoutSpec.lineModId) {
      const lineMod = cliState.idToLineMod.get(snippet.stdoutSpec.lineModId);
      if (lineMod === undefined) {
        throw new MarkcheckSyntaxError(
          `Could not find LineMod with id ${stringify(snippet.stdoutSpec.lineModId)} (attribute ${stringify(ATTR_KEY_STDOUT)})`
        );
      }
      const tmpLines = new Array<string>();
      lineMod.pushModifiedBodyTo(snippet.lineNumber, actualStdoutLines, undefined, tmpLines);
      actualStdoutLines = tmpLines;
    }

    const expectedStdoutLines = assembleOuterLinesForId(cliState, config, snippet.lineNumber, ATTR_KEY_STDOUT, snippet.stdoutSpec.snippetId);
    trimTrailingEmptyLines(expectedStdoutLines);
    if (!isOutputEqual(expectedStdoutLines, actualStdoutLines)) {
      throw new TestFailure(
        'stdout was not as expected',
        {
          stdoutLines: actualStdoutLines,
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
    logDiff(out, expectedLines, actualLines);
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
  'verbose': {
    type: 'boolean',
    short: 'v',
  },
} satisfies ParseArgsConfig['options'];

export function cliEntry() {
  const out = Output.fromStdout();
  const args = parseArgs({ allowPositionals: true, options: ARG_OPTIONS });

  if (args.values.version) {
    out.writeLine(pkg.version);
    return;
  }
  if (args.values['print-config']) {
    out.writeLine(JSON.stringify(new Config().toJson(), null, 2));
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
    out.writeLine(style.FgBlue.Bold`===== ${relFilePath} =====`);
    const statusCounts = new StatusCounts(relFilePath);
    const text = fs.readFileSync(absFilePath, 'utf-8');
    try {
      const parsedMarkdown = parseMarkdown(text);
      runParsedMarkdown(out, absFilePath, logLevel, parsedMarkdown, statusCounts);
    } catch (err) {
      if (err instanceof MarkcheckSyntaxError) {
        statusCounts.syntaxErrors++;
        err.logTo(out, `${STATUS_EMOJI_FAILURE} `);
      } else if (err instanceof TestFailure) {
        statusCounts.testFailures++;
        err.logTo(out, `${STATUS_EMOJI_FAILURE} `);
      } else {
        throw new Error(`Unexpected error in file ${stringify(relFilePath)}`, { cause: err });
      }
    }
    const headingStyle = (
      statusCounts.hasFailed() ? style.FgRed.Bold : style.FgGreen.Bold
    );
    out.writeLine(headingStyle`--- Summary ${stringify(relFilePath)} ---`);
    out.writeLine(statusCounts.describe());
    if (statusCounts.hasFailed()) {
      failedFiles.push(statusCounts);
    }
  }

  const headingStyle = (
    failedFiles.length === 0 ? style.FgGreen.Bold : style.FgRed.Bold
  );
  out.writeLine();
  out.writeLine(headingStyle`===== TOTAL SUMMARY =====`);
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
