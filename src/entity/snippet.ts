import { UnsupportedValueError } from '@rauschma/helpers/typescript/error.js';
import { type JsonValue } from '@rauschma/helpers/typescript/json.js';
import { assertNonNullable, assertTrue, type PublicDataProperties } from '@rauschma/helpers/typescript/type.js';
import { style, type TextStyleResult } from '@rauschma/nodejs-tools/cli/text-style.js';
import { Config, CONFIG_ENTITY_CONTEXT, CONFIG_KEY_LANG, PROP_KEY_DEFAULT_FILE_NAME, type LangDef, type LangDefCommand } from '../core/config.js';
import type { Translator } from '../translation/translation.js';
import { EntityContextSnippet, MarkcheckSyntaxError, SummaryStatusEmoji, type EntityContext } from '../util/errors.js';
import { getEndTrimmedLength } from '../util/string.js';
import { ATTR_ALWAYS_RUN, ATTR_KEY_APPLY_TO_BODY, ATTR_KEY_APPLY_TO_OUTER, ATTR_KEY_CONTAINED_IN_FILE, ATTR_KEY_EXIT_STATUS, ATTR_KEY_EXTERNAL, ATTR_KEY_EXTERNAL_LOCAL_LINES, ATTR_KEY_ID, ATTR_KEY_IGNORE_LINES, ATTR_KEY_INCLUDE, ATTR_KEY_LANG, ATTR_KEY_ONLY, ATTR_KEY_RUN_FILE_NAME, ATTR_KEY_RUN_LOCAL_LINES, ATTR_KEY_SAME_AS_ID, ATTR_KEY_SEARCH_AND_REPLACE, ATTR_KEY_SEQUENCE, ATTR_KEY_SKIP, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, ATTR_KEY_WRITE, ATTR_KEY_WRITE_LOCAL_LINES, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_INSERT, INCL_ID_THIS, LANG_KEY_EMPTY, LineScope, parseExternalSpecs, parseSequenceNumber, parseStdStreamContentSpec, type Directive, type ExternalSpec, type SequenceNumber, type StdStreamContentSpec } from './directive.js';
import type { Heading } from './heading.js';
import { LineModAppliable, LineModInternal, LineModConfig, LineModLanguage, EmitLines } from './line-mod.js';
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

export function assembleAllLinesForId(fileState: FileState, config: Config, sourceLineNumber: number, attrKey: string, targetId: string): Array<string> {
  const targetSnippet = getTargetSnippet(fileState, sourceLineNumber, attrKey, targetId);
  return assembleAllLines(fileState, config, targetSnippet);
}

export function assembleLocalLinesForId(fileState: FileState, config: Config, sourceLineNumber: number, attrKey: string, targetId: string): Array<string> {
  const targetSnippet = getTargetSnippet(fileState, sourceLineNumber, attrKey, targetId);
  return assembleAllLines(fileState, config, targetSnippet, true);
}

export function assembleInnerLines(fileState: FileState, config: Config, snippet: Snippet): Array<string> {
  const lines = new Array<string>();
  snippet.assembleInnerLines(config, fileState.idToSnippet, fileState.idToLineMod, lines, new Set());
  return lines;
}

export function assembleLocalLines(fileState: FileState, config: Config, snippet: Snippet): Array<string> {
  return assembleAllLines(fileState, config, snippet, true);
}

/**
 * Outer lines (once per file):
 * - `applyToOuter` LineMod
 * - Language LineMod
 * - Config before lines
 */
export function assembleAllLines(fileState: FileState, config: Config, snippet: Snippet, onlyLocalLines = snippet.runLocalLines): Array<string> {
  const lines = new Array<string>();

  const outerLineMods = collectOuterLineMods(onlyLocalLines);

  for (let i = 0; i < outerLineMods.length; i++) {
    outerLineMods[i].emitLines(EmitLines.Before, config, fileState.idToSnippet, fileState.idToLineMod, lines);
  }
  // Once per snippet:
  // - SingleSnippet:
  //   - Internal LineMod (before, after, inserted lines)
  //   - `applyToBody` LineMod
  // - SequenceSnippet:
  //   - Lines of sequence elements, concatenated
  snippet.assembleInnerLines(config, fileState.idToSnippet, fileState.idToLineMod, lines, new Set());
  for (let i = outerLineMods.length - 1; i >= 0; i--) {
    outerLineMods[i].emitLines(EmitLines.After, config, fileState.idToSnippet, fileState.idToLineMod, lines);
  }
  return lines;

  function collectOuterLineMods(onlyLocalLines: boolean): Array<OuterLineMod> {
    const outerLineMods = new Array<OuterLineMod>();

    if (!onlyLocalLines) {
      if (snippet.lang) {
        const lang = config.getLang(snippet.lang);
        if (lang && lang.kind === 'LangDefCommand' && (lang.beforeLines !== undefined || lang.afterLines !== undefined)) {
          outerLineMods.push(
            new LineModConfig(
              CONFIG_ENTITY_CONTEXT,
              lang.beforeLines ?? [],
              lang.afterLines ?? [],
            )
          );
        }
      }
      const languageLineMod = fileState.languageLineMods.get(snippet.lang);
      if (languageLineMod !== undefined) {
        outerLineMods.push(languageLineMod);
      }
    }

    // `applyToOuter` contributes outer lines but is applied locally (by
    // the snippet). That’s why it is not affected by `onlyLocalLines`.
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

type OuterLineMod = LineModConfig | LineModAppliable | LineModLanguage;

//#################### Snippet ####################

export abstract class Snippet extends MarkcheckEntity {
  override getEntityContext(): EntityContext {
    return new EntityContextSnippet(this.lineNumber, this.lang);
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
  abstract get writeLocalLines(): null | string;
  abstract get write(): null | string;
  abstract get externalSpecs(): Array<ExternalSpec>;
  //
  abstract get exitStatus(): null | 'nonzero' | number;
  abstract get stdoutSpec(): null | StdStreamContentSpec;
  abstract get stderrSpec(): null | StdStreamContentSpec;

  abstract getInternalFileName(langDef: LangDef): string;
  abstract isRun(globalRunningMode: GlobalRunningMode): boolean;
  abstract assembleInnerLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineModAppliable>, lines: Array<string>, pathOfIncludeIds: Set<string>): void;
  abstract getAllFileNames(langDef: LangDefCommand): Array<string>;

  abstract toJson(): JsonValue;

  /**
   * - SingleSnippet: visit that snippet
   * - SequenceSnippet: visit each element of the sequence
   */
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
      snippet.writeLocalLines = directive.getString(ATTR_KEY_WRITE_LOCAL_LINES);
      snippet.write = directive.getString(ATTR_KEY_WRITE);
      snippet.#internalFileName = directive.getString(ATTR_KEY_RUN_FILE_NAME);
      const external = directive.getString(ATTR_KEY_EXTERNAL);
      if (external) {
        snippet.externalSpecs.push(...parseExternalSpecs(directive.lineNumber, LineScope.all, external));
      }
      const externalLocalLines = directive.getString(ATTR_KEY_EXTERNAL_LOCAL_LINES);
      if (externalLocalLines) {
        snippet.externalSpecs.push(...parseExternalSpecs(directive.lineNumber, LineScope.local, externalLocalLines));
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
  internalLineMod: null | LineModInternal = null;
  applyToBodyId: null | string = null;
  override applyToOuterId: null | string = null;
  override runLocalLines = false;
  //
  override sameAsId: null | string = null;
  override containedInFile: null | string = null;
  //
  #lang: null | string = null;
  //
  override writeLocalLines: null | string = null;
  override write: null | string = null;
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

  override assembleInnerLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineModAppliable>, linesOut: Array<string>, pathOfIncludeIds: Set<string>): void {
    let lineModForBody: LineModAppliable | LineModInternal | LineModConfig | null = this.#getApplyToBodyLineMod(config, idToLineMod);
    if (lineModForBody) {
      this.internalLineMod?.throwIfThisChangesBody();
    } else {
      lineModForBody = this.internalLineMod;
    }

    let body;
    const translator = this.#getTranslator(config);
    if (lineModForBody) {
      body = lineModForBody.transformBody(this.body, translator, this.lineNumber);
    } else {
      body = this.body;
      if (translator) {
        body = translator.translate(this.lineNumber, body);
      }
    }

    const applyToBodyLineMod = this.#getApplyToBodyLineMod(config, idToLineMod);
    if (this.internalLineMod) {
      this.internalLineMod.emitLines(EmitLines.Before, config, idToSnippet, idToLineMod, linesOut, pathOfIncludeIds);
    }
    if (applyToBodyLineMod) {
      applyToBodyLineMod.emitLines(EmitLines.Before, config, idToSnippet, idToLineMod, linesOut, pathOfIncludeIds);
    }
    linesOut.push(...body);
    if (applyToBodyLineMod) {
      applyToBodyLineMod.emitLines(EmitLines.After, config, idToSnippet, idToLineMod, linesOut, pathOfIncludeIds);
    }
    if (this.internalLineMod) {
      this.internalLineMod.emitLines(EmitLines.After, config, idToSnippet, idToLineMod, linesOut, pathOfIncludeIds);
    }
  }

  #getApplyToBodyLineMod(config: Config, idToLineMod: Map<string, LineModAppliable>): null | LineModConfig | LineModAppliable {
    const lineModId = this.applyToBodyId;
    if (!lineModId) {
      return null;
    }
    let lineMod: undefined | LineModConfig | LineModAppliable = idToLineMod.get(lineModId);
    if (lineMod === undefined) {
      const lineModJson = config.idToLineMod.get(lineModId);
      if (lineModJson) {
        lineMod = new LineModConfig(
          CONFIG_ENTITY_CONTEXT,
          lineModJson.before ?? [],
          lineModJson.after ?? [],
        );
      }
    }
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

  override assembleInnerLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineModAppliable>, lines: Array<string>, pathOfIncludeIds: Set<string>): void {
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
  override get writeLocalLines(): null | string {
    return this.firstElement.writeLocalLines;
  }
  override get write(): null | string {
    return this.firstElement.write;
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

export type MarkcheckMockDataProps = Partial<PublicDataProperties<MarkcheckMockData>>;
export class MarkcheckMockData {
  interceptedCommands: Array<string>;
  lastCommandResult: null | CommandResult;
  passOnUserExceptions: boolean;
  constructor(props: MarkcheckMockDataProps = {}) {
    this.interceptedCommands = props.interceptedCommands ?? [];
    this.lastCommandResult = props.lastCommandResult ?? null;
    this.passOnUserExceptions = props.passOnUserExceptions ?? true;
  }
  withPassOnUserExceptions(passOnUserExceptions: boolean): this {
    this.passOnUserExceptions = passOnUserExceptions;
    return this;
  }
};

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
  idToLineMod: Map<string, LineModAppliable>;
  globalRunningMode: GlobalRunningMode;
  languageLineMods: Map<string, LineModLanguage>;
  statusCounts: StatusCounts;
  markcheckMockData: null | MarkcheckMockData;
  prevHeading: null | Heading;
};

export class StatusCounts {
  relFilePath: null | string;
  testSuccesses = 0;
  testFailures = 0;
  syntaxErrors = 0;
  warnings = 0;

  constructor(relFilePath: null | string = null) {
    this.relFilePath = relFilePath;
  }

  addOther(other: StatusCounts): void {
    this.testSuccesses += other.testSuccesses;
    this.testFailures += other.testFailures;
    this.syntaxErrors += other.syntaxErrors;
    this.warnings += other.warnings;
  }

  getTotalProblemCount(): number {
    return this.syntaxErrors + this.testFailures + this.warnings;
  }
  hasFailed(): boolean {
    return this.getTotalProblemCount() > 0;
  }
  hasSucceeded(): boolean {
    return this.getTotalProblemCount() === 0;
  }
  toString(): string {
    return `File ${stringify(this.relFilePath)}. ${this.describe()}`
  }
  toJson() {
    return {
      relFilePath: this.relFilePath,
      syntaxErrors: this.syntaxErrors,
      testFailures: this.testFailures,
      testSuccesses: this.testSuccesses,
      warnings: this.warnings,
    };
  }

  getHeadingStyle(): TextStyleResult {
    if (this.hasSucceeded()) {
      return style.FgGreen.Bold;
    }
    if (this.testFailures > 0 || this.syntaxErrors > 0) {
      return style.FgRed.Bold;
    }
    return style.FgYellow.Bold;
  }

  getSummaryStatusEmoji(): string {
    if (this.getTotalProblemCount() === 0) {
      return SummaryStatusEmoji.Success;
    }
    if (this.testFailures > 0 || this.syntaxErrors > 0) {
      return SummaryStatusEmoji.FailureOrError;
    }
    return SummaryStatusEmoji.Warning;
  }

  describe(): string {
    const parts = [
      labeled('Successes', this.testSuccesses,
        this.hasSucceeded(), style.Bold.FgGreen
      ),
      labeled('Failures', this.testFailures,
        this.testFailures > 0, style.Bold.FgRed
      ),
      labeled('Syntax Errors', this.syntaxErrors,
        this.syntaxErrors > 0, style.Bold.FgRed
      ),
      labeled('Warnings', this.warnings,
        this.warnings > 0, style.Bold.FgYellow
      ),
    ];
    return parts.join(', ');

    function labeled(label: string, count: number, condition: boolean, textStyle: TextStyleResult): string {
      const str = `${label}: ${count}`;
      if (condition) {
        return textStyle(str);
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
