import { style } from '@rauschma/helpers/nodejs/text-style.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { type JsonValue } from '@rauschma/helpers/ts/json.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import { CONFIG_KEY_LANG, CONFIG_PROP_BEFORE_LINES, Config, PROP_KEY_DEFAULT_FILE_NAME, type LangDef, type LangDefCommand } from '../core/config.js';
import type { Translator } from '../translation/translation.js';
import { MarkcheckSyntaxError, contextDescription, contextSnippet, type EntityContext } from '../util/errors.js';
import { getEndTrimmedLength } from '../util/string.js';
import { ATTR_ALWAYS_RUN, ATTR_KEY_APPLY_TO_BODY, ATTR_KEY_APPLY_TO_OUTER, ATTR_KEY_CONTAINED_IN_FILE, ATTR_KEY_EXIT_STATUS, ATTR_KEY_EXTERNAL, ATTR_KEY_ID, ATTR_KEY_IGNORE_LINES, ATTR_KEY_INCLUDE, ATTR_KEY_RUN_FILE_NAME, ATTR_KEY_LANG, ATTR_KEY_ONLY, ATTR_KEY_RUN_LOCAL_LINES, ATTR_KEY_SAME_AS_ID, ATTR_KEY_SEARCH_AND_REPLACE, ATTR_KEY_SEQUENCE, ATTR_KEY_SKIP, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, ATTR_KEY_WRITE_LOCAL, ATTR_KEY_WRITE_ALL, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_INSERT, INCL_ID_THIS, LANG_KEY_EMPTY, parseExternalSpecs, parseSequenceNumber, parseStdStreamContentSpec, type Directive, type ExternalSpec, type SequenceNumber, type StdStreamContentSpec } from './directive.js';
import type { Heading } from './heading.js';
import { LineMod } from './line-mod.js';
import { MarkcheckEntity } from './markcheck-entity.js';

const { stringify } = JSON;

//#################### Assembling lines ####################

export function getTargetSnippet(fileState: FileState, sourceLineNumber: number, attrKey: string, targetId: string): Snippet {
  const targetSnippet = fileState.idToSnippet.get(targetId);
  if (!targetSnippet) {
    throw new MarkcheckSyntaxError(
      `Unknown ID ${JSON.stringify(targetId)} (attribute ${stringify(attrKey)})`,
      { lineNumber: sourceLineNumber }
    );
  }
  return targetSnippet;
}

export function assembleOuterLinesForId(fileState: FileState, config: Config, sourceLineNumber: number, attrKey: string, targetId: string): Array<string> {
  const targetSnippet = getTargetSnippet(fileState, sourceLineNumber, attrKey, targetId);
  return assembleOuterLines(fileState, config, targetSnippet);
}

export function assembleInnerLines(fileState: FileState, config: Config, snippet: Snippet): Array<string> {
  const lines = new Array<string>();
  snippet.assembleInnerLines(config, fileState.idToSnippet, fileState.idToLineMod, lines, new Set());
  return lines;
}

/**
 * Outer lines (once per file):
 * - `applyToOuter` LineMod
 * - Language LineMod
 * - Config before lines
 */
export function assembleOuterLines(fileState: FileState, config: Config, snippet: Snippet) {
  const lines = new Array<string>();

  const outerLineMods = collectOuterLineMods(snippet.runLocalLines);

  for (let i = 0; i < outerLineMods.length; i++) {
    outerLineMods[i].pushBeforeLines(lines);
  }
  // Once per snippet:
  // - SingleSnippet:
  //   - Body LineMod (before, after, inserted lines)
  //   - `applyToBody` LineMod
  //   - Includes
  // - SequenceSnippet:
  //   - Lines of sequence elements, concatenated
  snippet.assembleInnerLines(config, fileState.idToSnippet, fileState.idToLineMod, lines, new Set());
  for (let i = outerLineMods.length - 1; i >= 0; i--) {
    outerLineMods[i].pushAfterLines(lines);
  }
  return lines;

  function collectOuterLineMods(runLocalLines: boolean): Array<LineMod> {
    const outerLineMods = new Array<LineMod>();

    if (!runLocalLines) {
      if (snippet.lang) {
        const lang = config.getLang(snippet.lang);
        if (lang && lang.kind === 'LangDefCommand' && lang.beforeLines) {
          outerLineMods.push(
            LineMod.fromBeforeLines(
              contextDescription(`Config property ${CONFIG_PROP_BEFORE_LINES}`),
              { tag: 'LineModKindConfig' },
              lang.beforeLines,
            )
          );
        }
      }
      const languageLineMods = fileState.languageLineMods.get(snippet.lang);
      if (languageLineMods) {
        outerLineMods.push(...languageLineMods);
      }
    }

    // `applyToOuter` contributes outer lines but is applied locally (by
    // the snippet)
    const applyOuterId = snippet.applyToOuterId;
    if (applyOuterId) {
      const applyLineMod = fileState.idToLineMod.get(applyOuterId);
      if (applyLineMod === undefined) {
        throw new MarkcheckSyntaxError(
          `Attribute ${ATTR_KEY_APPLY_TO_OUTER} contains an ID that either doesn’t exist or does not refer to a line mod`,
          { lineNumber: snippet.lineNumber }
        );
      }
      outerLineMods.push(applyLineMod);
    }
    return outerLineMods;
  }
}

//#################### Snippet ####################

export abstract class Snippet extends MarkcheckEntity {
  override getEntityContext(): EntityContext {
    return contextSnippet(this.lineNumber, this.lang);
  }

  abstract get lineNumber(): number;
  //
  abstract get id(): null | string;
  abstract get runningMode(): RuningMode;
  //
  abstract get lang(): string;
  //
  abstract get runLocalLines(): boolean;
  abstract get applyToOuterId(): null | string;
  //
  abstract get sameAsId(): null | string;
  abstract get containedInFile(): null | string;
  //
  abstract get writeLocal(): null | string;
  abstract get writeAll(): null | string;
  abstract get externalSpecs(): Array<ExternalSpec>;
  //
  abstract get exitStatus(): null | 'nonzero' | number;
  abstract get stdoutSpec(): null | StdStreamContentSpec;
  abstract get stderrSpec(): null | StdStreamContentSpec;

  abstract getInternalFileName(langDef: LangDef): string;
  abstract isRun(globalRunningMode: GlobalRunningMode): boolean;
  abstract assembleInnerLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>): void;
  abstract getAllFileNames(langDef: LangDefCommand): Array<string>;

  abstract toJson(): JsonValue;

  abstract visitSingleSnippet(visitor: (singleSnippet: SingleSnippet) => void): void;
}

//#################### SingleSnippet ####################

export class SingleSnippet extends Snippet {
  static createOpen(directive: Directive): SingleSnippet {
    const snippet = new SingleSnippet(directive.lineNumber);

    snippet.id = directive.getString(ATTR_KEY_ID);

    { // runningMode
      if (directive.hasAttribute(ATTR_KEY_ID)) {
        // Initial default value:
        // - By default, snippets with IDs are not run.
        //   - Rationale: included somewhere and run there.
        // - To still run such a snippet, use `only` or `alwaysRun`.
        snippet.runningMode = RuningMode.Skip;
      }
      let runningAttributes = 0;
      if (directive.hasAttribute(ATTR_KEY_SKIP)) {
        snippet.runningMode = RuningMode.Skip;
        runningAttributes++;
      }
      if (directive.hasAttribute(ATTR_ALWAYS_RUN)) {
        snippet.runningMode = RuningMode.AlwaysRun;
        runningAttributes++;
      }
      if (directive.hasAttribute(ATTR_KEY_ONLY)) {
        snippet.runningMode = RuningMode.Only;
        runningAttributes++;
      }
      if (runningAttributes > 1) {
        const attrs = [ATTR_KEY_SKIP, ATTR_ALWAYS_RUN, ATTR_KEY_ONLY];
        throw new MarkcheckSyntaxError(
          `Snippet has more than one of these attributes: ${attrs.join(', ')}`,
          { lineNumber: directive.lineNumber }
        );
      }
    }

    { // Assembling lines
      const sequence = directive.getString(ATTR_KEY_SEQUENCE);
      if (sequence) {
        snippet.sequenceNumber = parseSequenceNumber(sequence);
      }

      const include = directive.getString(ATTR_KEY_INCLUDE);
      if (include) {
        snippet.includeIds = include.split(/ *, */);
      }

      snippet.applyToBodyId = directive.getString(ATTR_KEY_APPLY_TO_BODY);
      snippet.applyToOuterId = directive.getString(ATTR_KEY_APPLY_TO_OUTER);
      snippet.runLocalLines = directive.getBoolean(ATTR_KEY_RUN_LOCAL_LINES);
    }

    { // Checks
      const sameAsId = directive.getString(ATTR_KEY_SAME_AS_ID);
      if (sameAsId) {
        snippet.sameAsId = sameAsId;
      }
      const containedInFile = directive.getString(ATTR_KEY_CONTAINED_IN_FILE);
      if (containedInFile) {
        snippet.containedInFile = containedInFile;
      }
    }

    const lang = directive.getString(ATTR_KEY_LANG);
    if (lang) {
      snippet.#lang = lang;
    }

    { // File names
      snippet.writeLocal = directive.getString(ATTR_KEY_WRITE_LOCAL);
      snippet.writeAll = directive.getString(ATTR_KEY_WRITE_ALL);
      snippet.#internalFileName = directive.getString(ATTR_KEY_RUN_FILE_NAME);
      const external = directive.getString(ATTR_KEY_EXTERNAL);
      if (external) {
        snippet.externalSpecs = parseExternalSpecs(directive.lineNumber, external);
      }
    }

    const exitStatus = directive.getString(ATTR_KEY_EXIT_STATUS);
    if (exitStatus) {
      if (exitStatus === 'nonzero') {
        snippet.exitStatus = 'nonzero';
      } else {
        const parsedNumber = Number(exitStatus);
        if (Number.isNaN(parsedNumber)) {
          throw new MarkcheckSyntaxError(
            `Illegal value for attribute ${stringify(ATTR_KEY_EXIT_STATUS)}: ${stringify(exitStatus)}`
          );
        }
        snippet.exitStatus = parsedNumber;
      }
    }
    const stdoutSpecStr = directive.getString(ATTR_KEY_STDOUT);
    if (stdoutSpecStr) {
      snippet.stdoutSpec = parseStdStreamContentSpec(directive.lineNumber, ATTR_KEY_STDOUT, stdoutSpecStr);
    }
    const stderrSpecStr = directive.getString(ATTR_KEY_STDERR);
    if (stderrSpecStr) {
      snippet.stderrSpec = parseStdStreamContentSpec(directive.lineNumber, ATTR_KEY_STDERR, stderrSpecStr);
    }

    return snippet;
  }
  static createClosedFromBodyDirective(directive: Directive): SingleSnippet {
    const openSnippet = SingleSnippet.createOpen(directive);
    let lang = openSnippet.#lang;
    if (lang === null) {
      // Body directive has neither attribute `lang` nor attribute `write`.
      // Assign a default. Use case: Checking stdout or stderr.
      lang = LANG_KEY_EMPTY;
    }
    return openSnippet.closeWithBody(lang, directive.body);
  }
  static createClosedFromCodeBlock(lineNumber: number, lang: string, lines: Array<string>): SingleSnippet {
    return new SingleSnippet(lineNumber).closeWithBody(lang, lines);
  }
  override lineNumber: number;
  override id: null | string = null;
  runningMode: RuningMode = RuningMode.Normal;
  //
  sequenceNumber: null | SequenceNumber = null;
  includeIds = new Array<string>();
  bodyLineMod: null | LineMod = null;
  applyToBodyId: null | string = null;
  override applyToOuterId: null | string = null;
  override runLocalLines = false;
  //
  override sameAsId: null | string = null;
  override containedInFile: null | string = null;
  //
  #lang: null | string = null;
  //
  override writeLocal: null | string = null;
  override writeAll: null | string = null;
  override externalSpecs = new Array<ExternalSpec>();
  #internalFileName: null | string = null;
  //
  override exitStatus: null | 'nonzero' | number = null;
  override stdoutSpec: null | StdStreamContentSpec = null;
  override stderrSpec: null | StdStreamContentSpec = null;
  //
  isClosed = false;
  body = new Array<string>();

  private constructor(lineNumber: number) {
    super();
    this.lineNumber = lineNumber;
  }

  override get lang(): string {
    assertNonNullable(this.#lang);
    return this.#lang;
  }

  override getInternalFileName(langDef: LangDef): string {
    if (this.#internalFileName) {
      return this.#internalFileName;
    }
    if (langDef.kind === 'LangDefCommand' && langDef.runFileName !== undefined) {
      return langDef.runFileName;
    }
    throw new MarkcheckSyntaxError(
      `Snippet does not have a filename: neither via config (${stringify(CONFIG_KEY_LANG)} property ${stringify(PROP_KEY_DEFAULT_FILE_NAME)}) nor via attribute ${stringify(ATTR_KEY_RUN_FILE_NAME)}`,
      { lineNumber: this.lineNumber }
    );
  }

  override isRun(globalRunningMode: GlobalRunningMode): boolean {
    // this.visitationMode is set up by factory methods where `id` etc. are
    // considered.
    switch (globalRunningMode) {
      case GlobalRunningMode.Normal:
        switch (this.runningMode) {
          case RuningMode.Normal:
          case RuningMode.Only:
          case RuningMode.AlwaysRun:
            return true;
          case RuningMode.Skip:
            return false;
          default:
            throw new UnsupportedValueError(this.runningMode);
        }
      case GlobalRunningMode.Only:
        switch (this.runningMode) {
          case RuningMode.Only:
          case RuningMode.AlwaysRun:
            return true;
          case RuningMode.Normal:
          case RuningMode.Skip:
            return false;
          default:
            throw new UnsupportedValueError(this.runningMode);
        }
      default:
        throw new UnsupportedValueError(globalRunningMode);
    }
  }

  closeWithBody(lang: string, lines: Array<string>): this {
    assertTrue(!this.isClosed);
    // If .#lang is non-null, then it was set by the directive – which
    // overrides the language of the code block.
    if (this.#lang === null) {
      this.#lang = lang;
    }
    assertTrue(this.#lang !== null);
    const len = getEndTrimmedLength(lines);
    for (let i = 0; i < len; i++) {
      this.body.push(lines[i]);
    }
    this.isClosed = true;
    return this;
  }

  override assembleInnerLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>): void {
    let thisWasIncluded = false;
    for (const includeId of this.includeIds) {
      if (includeId === INCL_ID_THIS) {
        this.#assembleThis(config, idToLineMod, lines);
        thisWasIncluded = true;
        continue;
      }
      this.#assembleOneInclude(config, idToSnippet, idToLineMod, lines, pathOfIncludeIds, includeId);
    } // for
    if (!thisWasIncluded) {
      // Omitting `$THIS` is the same as putting it last
      this.#assembleThis(config, idToLineMod, lines);
    }
  }

  #assembleOneInclude(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>, includeId: string) {
    if (pathOfIncludeIds.has(includeId)) {
      const idPath = [...pathOfIncludeIds, includeId];
      throw new MarkcheckSyntaxError(`Cycle of includedIds ` + JSON.stringify(idPath));
    }
    const snippet = idToSnippet.get(includeId);
    if (snippet === undefined) {
      throw new MarkcheckSyntaxError(
        `Snippet includes the unknown ID ${JSON.stringify(includeId)}`,
        { lineNumber: this.lineNumber }
      );
    }
    pathOfIncludeIds.add(includeId);
    snippet.assembleInnerLines(config, idToSnippet, idToLineMod, lines, pathOfIncludeIds);
    pathOfIncludeIds.delete(includeId);
  }

  #assembleThis(config: Config, idToLineMod: Map<string, LineMod>, linesOut: Array<string>) {
    let applyToBodyLineMod = this.#getApplyToBodyLineMod(idToLineMod);
    if (applyToBodyLineMod) {
      if (this.bodyLineMod && !this.bodyLineMod.isEmpty()) {
        throw new MarkcheckSyntaxError(
          `If there is a ${stringify(ATTR_KEY_APPLY_TO_BODY)} then the body LineMod must be empty: No attributes ${stringify(ATTR_KEY_IGNORE_LINES)}, ${stringify(ATTR_KEY_SEARCH_AND_REPLACE)}. No body labels ${stringify(BODY_LABEL_BEFORE)}, ${stringify(BODY_LABEL_AFTER)}, ${stringify(BODY_LABEL_AROUND)}, ${stringify(BODY_LABEL_INSERT)}`,
          { lineNumber: this.lineNumber }
        );
      }
    } else {
      applyToBodyLineMod = this.bodyLineMod;
    }

    const translator = this.#getTranslator(config);
    if (applyToBodyLineMod) {
      applyToBodyLineMod.pushModifiedBodyTo(this.lineNumber, this.body, translator, linesOut);
    } else {
      let body = this.body;
      if (translator) {
        body = translator.translate(this.lineNumber, body);
      }
      linesOut.push(...body);
    }
  }

  #getApplyToBodyLineMod(idToLineMod: Map<string, LineMod>): null | LineMod {
    const id = this.applyToBodyId;
    if (!id) {
      return null;
    }
    const lineMod = idToLineMod.get(id);
    if (lineMod === undefined) {
      throw new MarkcheckSyntaxError(
        `Attribute ${ATTR_KEY_APPLY_TO_BODY} contains an ID that either doesn’t exist or does not refer to a line mod`,
        { lineNumber: this.lineNumber }
      );
    }
    return lineMod;
  }

  #getTranslator(config: Config): undefined | Translator {
    if (this.#lang) {
      const lang = config.getLang(this.#lang);
      if (lang && lang.kind === 'LangDefCommand') {
        return lang.translator;
      }
    }
    return undefined;
  }

  override getAllFileNames(langDef: LangDefCommand): Array<string> {
    return [
      this.getInternalFileName(langDef),
      ...this.externalSpecs.map(es => es.fileName),
    ];
  }
  toJson(): SingleSnippetJson {
    return {
      lineNumber: this.lineNumber,
      lang: this.lang,
      id: this.id,
      external: this.externalSpecs,
      stdout: this.stdoutSpec,
      stderr: this.stderrSpec,
      body: this.body,
    };
  }

  override visitSingleSnippet(visitor: (singleSnippet: SingleSnippet) => void): void {
    visitor(this);
  }
}

//#################### SequenceSnippet ####################

export class SequenceSnippet extends Snippet {
  elements = new Array<SingleSnippet>();

  constructor(singleSnippet: SingleSnippet) {
    super();
    const num = singleSnippet.sequenceNumber;
    assertNonNullable(num);
    if (num.pos !== 1) {
      throw new MarkcheckSyntaxError(
        'First snippet in a sequence must have position 1 (1/*): ' + num,
        { lineNumber: singleSnippet.lineNumber }
      );
    }
    this.elements.push(singleSnippet);
  }

  get nextSequenceNumber(): string {
    return `${this.elements.length + 1}/${this.total}`;
  }

  pushElement(singleSnippet: SingleSnippet, num: SequenceNumber): void {
    assertNonNullable(num);
    if (num.total !== this.total) {
      throw new MarkcheckSyntaxError(
        `Snippet has different total than current sequence (${this.total}): ${num}`,
        { lineNumber: singleSnippet.lineNumber }
      );
    }
    if (num.pos !== (this.elements.length + 1)) {
      throw new MarkcheckSyntaxError(
        `Expected sequence position ${this.elements.length}, but snippet has: ${num}`,
        { lineNumber: singleSnippet.lineNumber }
      );
    }
    this.elements.push(singleSnippet);
  }

  isComplete(): boolean {
    return this.total === this.elements.length;
  }

  get total(): number {
    const num = this.firstElement.sequenceNumber;
    assertNonNullable(num);
    return num.total;
  }

  override assembleInnerLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>): void {
    for (const element of this.elements) {
      element.assembleInnerLines(config, idToSnippet, idToLineMod, lines, pathOfIncludeIds);
    }
  }
  get firstElement(): SingleSnippet {
    const first = this.elements.at(0);
    assertNonNullable(first);
    return first;
  }
  get lastElement(): SingleSnippet {
    const last = this.elements.at(-1);
    assertNonNullable(last);
    return last;
  }

  override get lineNumber(): number {
    return this.firstElement.lineNumber;
  }
  override get id(): null | string {
    return this.firstElement.id;
  }
  override get runningMode(): RuningMode {
    return this.firstElement.runningMode;
  }
  override isRun(globalRunningMode: GlobalRunningMode): boolean {
    return this.firstElement.isRun(globalRunningMode);
  }
  override get lang(): string {
    return this.firstElement.lang;
  }
  override get applyToOuterId(): null | string {
    return this.firstElement.applyToOuterId;
  }
  override get runLocalLines(): boolean {
    return this.firstElement.runLocalLines;
  }
  override get sameAsId(): null | string {
    return this.firstElement.sameAsId;
  }
  override get containedInFile(): null | string {
    return this.firstElement.containedInFile;
  }
  override getInternalFileName(langDef: LangDef): string {
    return this.firstElement.getInternalFileName(langDef);
  }
  override getAllFileNames(langDef: LangDefCommand): Array<string> {
    return this.firstElement.getAllFileNames(langDef);
  }
  override get writeLocal(): null | string {
    return this.firstElement.writeLocal;
  }
  override get writeAll(): null | string {
    return this.firstElement.writeAll;
  }
  override get externalSpecs(): Array<ExternalSpec> {
    return this.firstElement.externalSpecs;
  }
  override get exitStatus(): number | 'nonzero' | null {
    return this.firstElement.exitStatus;
  }
  override get stdoutSpec(): null | StdStreamContentSpec {
    return this.firstElement.stdoutSpec;
  }
  override get stderrSpec(): null | StdStreamContentSpec {
    return this.firstElement.stderrSpec;
  }
  toJson(): JsonValue {
    return this.elements.map(e => e.toJson());
  }
  override visitSingleSnippet(visitor: (singleSnippet: SingleSnippet) => void): void {
    for (const snippet of this.elements) {
      visitor(snippet);
    }
  }
}

//#################### Snippet helper types ####################

//========== Running modes ==========

export enum RuningMode {
  Normal = 'Normal',
  Only = 'Only',
  Skip = 'Skip',
  AlwaysRun = 'AlwaysRun',
}
export enum GlobalRunningMode {
  Normal = 'Normal',
  Only = 'Only',
}

//========== JSON ==========

export type SingleSnippetJson = {
  lineNumber: number,
  lang: string,
  id: null | string,
  external: Array<ExternalSpec>,
  stdout: null | StdStreamContentSpec,
  stderr: null | StdStreamContentSpec,
  body: Array<string>,
};

/** For testing */
export function snippetJson(partial: Partial<SingleSnippetJson>): SingleSnippetJson {
  return {
    lineNumber: partial.lineNumber ?? 0,
    lang: partial.lang ?? '',
    id: partial.id ?? null,
    external: partial.external ?? [],
    stdout: partial.stdout ?? null,
    stderr: partial.stderr ?? null,
    body: partial.body ?? [],
  };
}

//========== FileState ==========

export type MockShellData = {
  interceptedCommands: Array<string>,
  lastCommandResult: null | CommandResult,
};
export function emptyMockShellData(): MockShellData {
  return {
    interceptedCommands: new Array<string>(),
    lastCommandResult: null,
  };
}

export type CommandResult = {
  stdout: string,
  stderr: string,
  status: number | null,
  signal: NodeJS.Signals | null,
};

export type FileState = {
  absFilePath: string;
  tmpDir: string;
  logLevel: LogLevel;
  idToSnippet: Map<string, Snippet>;
  idToLineMod: Map<string, LineMod>;
  globalRunningMode: GlobalRunningMode;
  languageLineMods: Map<string, Array<LineMod>>;
  statusCounts: StatusCounts;
  mockShellData: null | MockShellData;
  prevHeading: null | Heading;
};

export class StatusCounts {
  relFilePath;
  syntaxErrors = 0;
  testFailures = 0;
  warnings = 0;

  constructor(relFilePath: string) {
    this.relFilePath = relFilePath;
  }

  getTotalCount(): number {
    return this.syntaxErrors + this.testFailures + this.warnings;
  }
  hasFailed(): boolean {
    return this.getTotalCount() > 0;
  }
  hasSucceeded(): boolean {
    return this.getTotalCount() === 0;
  }
  toString(): string {
    return `File ${stringify(this.relFilePath)}. ${this.describe()}`
  }
  toJson() {
    return {
      relFilePath: this.relFilePath,
      syntaxErrors: this.syntaxErrors,
      testFailures: this.testFailures,
      warnings: this.warnings,
    };
  }
  describe(): string {
    const parts = [
      labeled('Syntax Errors', this.syntaxErrors),
      labeled('Test failures', this.testFailures),
      labeled('Warnings', this.warnings),
    ];
    return parts.join(', ');

    function labeled(label: string, count: number): string {
      const str = `${label}: ${count}`;
      if (count > 0) {
        return style.Bold.FgRed(str);
      } else {
        return str;
      }
    }
  }
}

export enum LogLevel {
  Verbose,
  Normal
}
