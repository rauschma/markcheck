import { setDifference } from '@rauschma/helpers/collection/set.js';
import { splitLinesExclEol } from '@rauschma/helpers/string/line.js';
import { assertTrue } from '@rauschma/helpers/typescript/type.js';
import { style } from '@rauschma/nodejs-tools/cli/text-style.js';
import { MissingDirectoryMode, clearDirectorySync, ensureParentDirectory } from '@rauschma/nodejs-tools/misc/file.js';
import json5 from 'json5';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ZodError } from 'zod';
import { ConfigMod } from '../entity/config-mod.js';
import { ATTR_KEY_CONTAINED_IN_FILE, ATTR_KEY_EXTERNAL, ATTR_KEY_ID, ATTR_KEY_LINE_MOD_ID, ATTR_KEY_SAME_AS_ID, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME, INCL_ID_THIS, type StdStreamContentSpec } from '../entity/directive.js';
import { Heading } from '../entity/heading.js';
import { LineMod } from '../entity/line-mod.js';
import { type MarkcheckEntity } from '../entity/markcheck-entity.js';
import { GlobalRunningMode, LogLevel, RuningMode, Snippet, StatusCounts, assembleAllLines, assembleAllLinesForId, assembleInnerLines, assembleLocalLinesForId, getTargetSnippet, type CommandResult, type FileState, type MarkcheckMockData } from '../entity/snippet.js';
import { areLinesEqual, logDiff } from '../util/diffing.js';
import { ConfigurationError, InternalError, MarkcheckSyntaxError, Output, PROP_STDERR, PROP_STDOUT, STATUS_EMOJI_FAILURE, STATUS_EMOJI_SUCCESS, TestFailure, contextDescription, contextLineNumber, describeEntityContext } from '../util/errors.js';
import { linesAreSame, linesContain } from '../util/line-tools.js';
import { relPath } from '../util/path-tools.js';
import { trimTrailingEmptyLines } from '../util/string.js';
import { Config, ConfigModJsonSchema, PROP_KEY_COMMANDS, fillInCommandVariables, type LangDefCommand } from './config.js';
import { type ParsedMarkdown } from './parse-markdown.js';

const MARKCHECK_DIR_NAME = 'markcheck-data';
const MARKCHECK_TMP_DIR_NAME = 'tmp';
const CONFIG_FILE_NAME = 'markcheck-config.json5';
const { stringify } = JSON;

//#################### runParsedMarkdown() ####################

export function runParsedMarkdown(out: Output, absFilePath: string, logLevel: LogLevel, parsedMarkdown: ParsedMarkdown, statusCounts: StatusCounts, mockShellData: null | MarkcheckMockData = null): void {
  const markcheckDir = findMarkcheckDir(absFilePath, parsedMarkdown.entities);
  out.writeLine(style.FgBrightBlack`Markcheck directory: ${relPath(markcheckDir)}`);

  const tmpDir = path.resolve(markcheckDir, MARKCHECK_TMP_DIR_NAME);
  // `markcheck/` must exist, `markcheck/tmp/` may not exist
  clearDirectorySync(tmpDir, MissingDirectoryMode.Create);

  let globalRunningMode = GlobalRunningMode.Normal;
  if (parsedMarkdown.entities.some((e) => e instanceof Snippet && e.runningMode === RuningMode.Only)) {
    globalRunningMode = GlobalRunningMode.Only;
  }

  const config = new Config().addDefaults();
  const configFilePath = path.resolve(markcheckDir, CONFIG_FILE_NAME);
  if (fs.existsSync(configFilePath)) {
    try {
      const json = json5.parse(fs.readFileSync(configFilePath, 'utf-8'));
      const configModJson = ConfigModJsonSchema.parse(json);
      config.applyMod(
        contextDescription('Config file ' + stringify(configFilePath)),
        configModJson
      );
    } catch (err) {
      const entityContext = contextDescription(`File ${stringify(configFilePath)}`);
      if (err instanceof SyntaxError) {
        throw new MarkcheckSyntaxError(
          `Error while parsing JSON5 config data:${os.EOL}${err.message}`,
          { entityContext }
        );
      } else if (err instanceof ZodError) {
        throw new MarkcheckSyntaxError(
          `Config properties are wrong:${os.EOL}${json5.stringify(err.format(), {space: 2})}`,
          { entityContext }
        );
      } else {
        // Unexpected error
        throw err;
      }
    }
  }

  const fileState: FileState = {
    absFilePath,
    tmpDir,
    logLevel,
    idToSnippet: parsedMarkdown.idToSnippet,
    idToLineMod: parsedMarkdown.idToLineMod,
    globalRunningMode,
    languageLineMods: new Map(),
    statusCounts,
    markcheckMockData: mockShellData,
    prevHeading: null,
  };

  for (const entity of parsedMarkdown.entities) {
    handleOneEntity(out, fileState, config, entity);
  }
  checkSnippetIds(parsedMarkdown, out, statusCounts);
  checkLineModIds(parsedMarkdown, out, statusCounts);
}

function checkSnippetIds(parsedMarkdown: ParsedMarkdown, out: Output, statusCounts: StatusCounts): void {
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
        if (snippet.applyToBodyId !== null) {
          referencedIds.add(snippet.applyToBodyId);
        }
        if (snippet.applyToOuterId !== null) {
          referencedIds.add(snippet.applyToOuterId);
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
    const mtd = path.resolve(parentDir, MARKCHECK_DIR_NAME);
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
    `Could not find a ${stringify(MARKCHECK_DIR_NAME)} directory neither configured nor in the following directory or its ancestors: ${stringify(startDir)}`
  );
}

//#################### handleOneEntity() ####################

function handleOneEntity(out: Output, fileState: FileState, config: Config, entity: MarkcheckEntity) {
  try {
    const snippetState: SnippetState = {
      checksWerePerformed: false,
      verboseLines: []
    };

    if (entity instanceof ConfigMod) {
      config.applyMod(contextLineNumber(entity.lineNumber), entity.configModJson);
    } else if (entity instanceof LineMod) {
      const targetLanguage = entity.getTargetLanguage();
      if (targetLanguage !== undefined) {
        let lineModArr = fileState.languageLineMods.get(targetLanguage);
        if (!lineModArr) {
          lineModArr = [];
          fileState.languageLineMods.set(targetLanguage, lineModArr);
        }
        lineModArr.push(entity);
      }
    } else if (entity instanceof Snippet) {
      handleSnippet(fileState, config, snippetState, entity);

    } else if (entity instanceof Heading) {
      fileState.prevHeading = entity; // update
    } else {
      throw new InternalError();
    }

    if (snippetState.checksWerePerformed) {
      if (fileState.prevHeading) {
        out.writeLine(style.Bold(fileState.prevHeading.content));
        fileState.prevHeading = null; // used, not write again
      }
      const description = describeEntityContext(entity.getEntityContext());
      out.writeLine(`${description} ${STATUS_EMOJI_SUCCESS}`);
    }
    if (snippetState.verboseLines.length > 0) {
      for (const line of snippetState.verboseLines) {
        out.write('• ');
        out.writeLine(line);
      }
    }
  } catch (err) {
    if (fileState.markcheckMockData?.passOnUserExceptions) {
      throw err;
    }

    if (fileState.prevHeading) {
      out.writeLine(style.Bold(fileState.prevHeading.content));
      fileState.prevHeading = null; // used, not write again
    }
    const description = describeEntityContext(entity.getEntityContext());
    out.writeLine(`${description} ${STATUS_EMOJI_FAILURE}`);

    if (err instanceof MarkcheckSyntaxError) {
      fileState.statusCounts.syntaxErrors++;
      out.writeLine(err.message);
    } else if (err instanceof TestFailure) {
      fileState.statusCounts.testFailures++;
      out.writeLine(err.message);
      if (err.actualStdoutLines) {
        writeStdStream(out, 'stdout', err.actualStdoutLines, err.expectedStdoutLines);
      }
      if (err.actualStderrLines) {
        writeStdStream(out, 'stderr', err.actualStderrLines, err.expectedStderrLines);
      }
    } else {
      const description = describeEntityContext(entity.getEntityContext());
      throw new Error(`Unexpected error in an entity (${description})`, { cause: err });
    }
  }
}

//#################### handleSnippet() ####################

function handleSnippet(fileState: FileState, config: Config, snippetState: SnippetState, snippet: Snippet): void {

  //----- Checks -----

  if (snippet.containedInFile) {
    snippetState.checksWerePerformed = true;
    const innerLines = assembleInnerLines(fileState, config, snippet);
    const pathName = path.resolve(fileState.absFilePath, '..', snippet.containedInFile);
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
    snippetState.checksWerePerformed = true;
    const innerLines = assembleInnerLines(fileState, config, snippet);
    const otherSnippet = getTargetSnippet(fileState, snippet.lineNumber, ATTR_KEY_SAME_AS_ID, snippet.sameAsId);
    const otherLines = assembleInnerLines(fileState, config, otherSnippet);
    if (!linesAreSame(innerLines, otherLines)) {
      throw new TestFailure(
        `Content of snippet is not same as content of snippet ${stringify(snippet.sameAsId)} (line ${otherSnippet.lineNumber})`,
        { lineNumber: snippet.lineNumber }
      );
    }
  }

  //----- Writing -----

  const writeAll: null | string = snippet.writeAll;
  if (writeAll) {
    const lines = assembleAllLines(fileState, config, snippet);
    writeOneFile(fileState, config, snippetState, writeAll, lines);
    return;
  }
  const writeLocal: null | string = snippet.writeLocal;
  if (writeLocal) {
    const lines = assembleAllLines(fileState, config, snippet);
    writeOneFile(fileState, config, snippetState, writeLocal, lines);
    return;
  }

  //----- Skipping -----

  // Explicitly skipped
  if (!snippet.isRun(fileState.globalRunningMode)) {
    return;
  }
  const langDef = config.getLang(snippet.lang);
  if (langDef === undefined) {
    throw new MarkcheckSyntaxError(
      `Unknown language: ${JSON.stringify(snippet.lang)}`,
      { lineNumber: snippet.lineNumber }
    );
  }
  if (langDef.kind === 'LangDefSkip') {
    return;
  }
  if (langDef.kind === 'LangDefErrorIfRun') {
    throw new MarkcheckSyntaxError(
      `Language can’t be run: ${JSON.stringify(snippet.lang)}`,
      { lineNumber: snippet.lineNumber }
    );
  }

  //----- Running -----

  const fileName = snippet.getInternalFileName(langDef);
  const lines = assembleAllLines(fileState, config, snippet);
  writeFilesForRunning(fileState, config, snippetState, snippet, fileName, lines);

  assertTrue(langDef.kind === 'LangDefCommand');
  if (!langDef.commands) {
    throw new MarkcheckSyntaxError(
      `Snippet is runnable but its language does not have ${stringify(PROP_KEY_COMMANDS)}`,
      { lineNumber: snippet.lineNumber }
    );
  }
  if (langDef.commands.length > 0) {
    // Running a file is at least one check.
    snippetState.checksWerePerformed = true;
    runShellCommands(fileState, config, snippetState, snippet, langDef, fileName, langDef.commands);
  }
}

//========== Write files ==========

function writeFilesForRunning(fileState: FileState, config: Config, snippetState: SnippetState, snippet: Snippet, fileName: string, lines: Array<string>): void {
  writeOneFile(fileState, config, snippetState, fileName, lines);

  for (const { id, fileName } of snippet.externalSpecs) {
    if (!id) continue;
    const lines = assembleAllLinesForId(fileState, config, snippet.lineNumber, ATTR_KEY_EXTERNAL, id);
    writeOneFile(fileState, config, snippetState, fileName, lines);
  }
}

function writeOneFile(fileState: FileState, config: Config, snippetState: SnippetState, fileName: string, lines: Array<string>) {
  const filePath = path.resolve(fileState.tmpDir, fileName);
  if (fileState.logLevel === LogLevel.Verbose) {
    snippetState.verboseLines.push('Write: ' + relPath(filePath));
  }
  let content = lines.join(os.EOL);
  content = config.searchAndReplaceFunc(content);
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, content, 'utf-8');
}

//========== runShellCommands() ==========

function runShellCommands(fileState: FileState, config: Config, snippetState: SnippetState, snippet: Snippet, langDef: LangDefCommand, fileName: string, commandsWithVars: Array<Array<string>>): void {
  const commands: Array<Array<string>> = fillInCommandVariables(commandsWithVars, {
    [CMD_VAR_FILE_NAME]: [fileName],
    [CMD_VAR_ALL_FILE_NAMES]: snippet.getAllFileNames(langDef),
  });
  for (const [index, commandParts] of commands.entries()) {
    const isLastCommand = (index === commands.length - 1);
    if (fileState.logLevel === LogLevel.Verbose) {
      snippetState.verboseLines.push('Run: ' + commandParts.join(' '));
    }

    if (fileState.markcheckMockData) {
      fileState.markcheckMockData.interceptedCommands.push(
        commandParts.join(' ')
      );
      const lastCommandResult = fileState.markcheckMockData.lastCommandResult;
      if (isLastCommand && lastCommandResult) {
        checkShellCommandResult(fileState, config, snippet, lastCommandResult, isLastCommand);
      }
    } else {
      const [command, ...args] = commandParts;
      const spawnResult = child_process.spawnSync(command, args, {
        shell: true,
        cwd: fileState.tmpDir,
        encoding: 'utf-8',
      });
      if (spawnResult.error) {
        // Spawning didn’t work
        throw spawnResult.error;
      }
      checkShellCommandResult(fileState, config, snippet, spawnResult, isLastCommand);
    }
  }
}

function checkShellCommandResult(fileState: FileState, config: Config, snippet: Snippet, commandResult: CommandResult, isLastCommand: boolean): void {
  const stdoutLines = splitLinesExclEol(commandResult.stdout);
  trimTrailingEmptyLines(stdoutLines);
  const stderrLines = splitLinesExclEol(commandResult.stderr);
  trimTrailingEmptyLines(stderrLines);
  const testFailureProps = {
    stdout: { actualLines: stdoutLines },
    stderr: { actualLines: stderrLines, },
  };

  if (commandResult.signal !== null) {
    throw new TestFailure(
      `Snippet was terminated by signal ${commandResult.signal}`,
      testFailureProps
    );
  }
  assertTrue(commandResult.status !== null);
  if (!isLastCommand && commandResult.status !== 0) {
    throw new TestFailure(
      `Snippet exited with non-zero code ${commandResult.status}`,
      testFailureProps
    );
  }
  // stdout & stderr content are only checked for the last command
  if (!isLastCommand) return;

  const expectedExitStatus = snippet.exitStatus ?? 0;
  if (expectedExitStatus === 'nonzero' && commandResult.status === 0) {
    throw new TestFailure(
      'Expected nonzero exit status but it was zero',
      testFailureProps
    );
  }
  if (typeof expectedExitStatus === 'number' && expectedExitStatus !== commandResult.status) {
    throw new TestFailure(
      `Expected exit status ${expectedExitStatus} but it was ${commandResult.status}`,
      testFailureProps
    );
  }

  if (snippet.stdoutSpec) {
    compareStdStreamLines('Stdout', config, fileState, snippet, snippet.stdoutSpec, stdoutLines, ATTR_KEY_STDOUT, PROP_STDOUT);
  }
  if (snippet.stderrSpec) {
    compareStdStreamLines('Stderr', config, fileState, snippet, snippet.stderrSpec, stderrLines, ATTR_KEY_STDERR, PROP_STDERR);
  }
}

function compareStdStreamLines(stdStreamName: string, config: Config, fileState: FileState, snippet: Snippet, expectedContentSpec: StdStreamContentSpec, actualLines: Array<string>, attrKey: typeof ATTR_KEY_STDOUT | typeof ATTR_KEY_STDERR, failurePropKey: typeof PROP_STDERR | typeof PROP_STDOUT): void {
  if (expectedContentSpec.lineModId) {
    const lineMod = fileState.idToLineMod.get(expectedContentSpec.lineModId);
    if (lineMod === undefined) {
      throw new MarkcheckSyntaxError(
        `Could not find LineMod with id ${stringify(expectedContentSpec.lineModId)} (attribute ${stringify(attrKey)})`
      );
    }
    const tmpLines = new Array<string>();
    lineMod.pushModifiedBodyTo(snippet.lineNumber, actualLines, undefined, tmpLines);
    actualLines = tmpLines;
  }

  const expectedLines = assembleLocalLinesForId(fileState, config, snippet.lineNumber, attrKey, expectedContentSpec.snippetId);
  trimTrailingEmptyLines(expectedLines);
  if (!areLinesEqual(expectedLines, actualLines)) {
    throw new TestFailure(
      `${stdStreamName} was not as expected`,
      {
        [failurePropKey]: {
          expectedLines,
          actualLines,
        }
      }
    );
  }
}

//#################### Helpers ####################

type SnippetState = {
  checksWerePerformed: boolean,
  verboseLines: Array<string>,
};

//========== Logging helpers ==========

function writeStdStream(out: Output, name: string, actualLines: Array<string>, expectedLines?: Array<string>): void {
  if (expectedLines === undefined && actualLines.length === 0) {
    return;
  }
  const title = `----- ${name} -----`;
  out.writeLine(title);
  writeAllLines(out, actualLines);
  out.writeLine('-'.repeat(title.length));
  if (expectedLines) {
    logDiff(out, expectedLines, actualLines);
    out.writeLine('-'.repeat(title.length));
  }
}

function writeAllLines(out: Output, lines: Array<string>) {
  for (const line of lines) {
    out.writeLine(line);
  }
}
