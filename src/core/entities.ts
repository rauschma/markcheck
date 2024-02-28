import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { type JsonValue } from '@rauschma/helpers/ts/json.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import json5 from 'json5';
import * as os from 'node:os';
import { InternalError, UserError, type LineNumber } from '../util/errors.js';
import { getEndTrimmedLength, trimTrailingEmptyLines } from '../util/string.js';
import { Config, ConfigModJsonSchema, type ConfigModJson, type LangDef, type LangDefCommand, type Translator } from './config.js';
import { APPLICABLE_LINE_MOD_ATTRIBUTES, ATTR_KEY_APPLY_INNER, ATTR_KEY_APPLY_OUTER, ATTR_KEY_CONTAINED_IN, ATTR_KEY_EACH, ATTR_KEY_EXTERNAL, ATTR_KEY_ID, ATTR_KEY_IGNORE_LINES, ATTR_KEY_INCLUDE, ATTR_KEY_LANG, ATTR_KEY_NEVER_SKIP, ATTR_KEY_ONLY, ATTR_KEY_SEQUENCE, ATTR_KEY_SKIP, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, ATTR_KEY_WRITE, ATTR_KEY_WRITE_AND_RUN, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_BODY, BODY_LABEL_CONFIG, CONFIG_MOD_ATTRIBUTES, GLOBAL_LINE_MOD_ATTRIBUTES, LANG_KEY_EMPTY, LANG_NEVER_RUN, SNIPPET_ATTRIBUTES, parseExternalSpecs, parseLineNumberSet, parseSequenceNumber, type Directive, type ExternalSpec, type SequenceNumber } from './directive.js';

const { stringify } = JSON;

export type MarktestEntity = ConfigMod | Snippet | LineMod | Heading;

//#################### directiveToEntity() ####################

/**
 * @returns A snippet is open or closed
 */
export function directiveToEntity(directive: Directive): null | ConfigMod | SingleSnippet | LineMod {
  switch (directive.bodyLabel) {
    case BODY_LABEL_CONFIG:
      directive.checkAttributes(CONFIG_MOD_ATTRIBUTES);
      return new ConfigMod(directive);

    case BODY_LABEL_BODY: {
      return SingleSnippet.createClosedFromBodyDirective(directive);
    }

    case BODY_LABEL_BEFORE:
    case BODY_LABEL_AFTER:
    case BODY_LABEL_AROUND:
    case null: {
      if (directive.bodyLabel !== null) {
        // Either:
        // - LineMod (global or applicable)
        // - Open snippet with local LineMod
        const each = directive.getString(ATTR_KEY_EACH);
        if (each) {
          // Global LineMod
          directive.checkAttributes(GLOBAL_LINE_MOD_ATTRIBUTES);
          return new LineMod(directive, {
            tag: 'LineModKindGlobal',
            targetLanguage: each,
          });
        }
        const id = directive.getString(ATTR_KEY_ID);
        if (id) {
          // Applicable LineMod
          directive.checkAttributes(APPLICABLE_LINE_MOD_ATTRIBUTES);
          return new LineMod(directive, {
            tag: 'LineModKindApplicable',
            id,
          });
        }
        // Open snippet with local LineMod
        directive.checkAttributes(SNIPPET_ATTRIBUTES);
        const snippet = SingleSnippet.createOpen(directive);
        snippet.lineMod = new LineMod(directive, {
          tag: 'LineModKindLocal',
        });
        return snippet;
      } else {
        // Open snippet
        directive.checkAttributes(SNIPPET_ATTRIBUTES);
        return SingleSnippet.createOpen(directive);
      }
    }

    default: {
      throw new UserError(
        `Unsupported body label: ${stringify(directive.bodyLabel)}`,
        { lineNumber: directive.lineNumber }
      );
    }
  }
}

//#################### Assemble lines ####################

export function assembleLinesForId(cliState: CliState, config: Config, sourceLineNumber: number, targetId: string, context: string): Array<string> {
  const targetSnippet = cliState.idToSnippet.get(targetId);
  if (!targetSnippet) {
    throw new UserError(
      `Unknown ID ${JSON.stringify(targetId)} (${context})`,
      { lineNumber: sourceLineNumber }
    );
  }
  return assembleLines(cliState, config, targetSnippet);
}

export function assembleLines(cliState: CliState, config: Config, snippet: Snippet) {
  const lines = new Array<string>();

  // Once per file:
  // - Config before lines
  // - Global line mod
  // - Outer applicable line mod
  if (snippet.lang) {
    const lang = config.getLang(snippet.lang);
    if (lang && lang.kind === 'LangDefCommand' && lang.beforeLines) {
      lines.push(...lang.beforeLines);
    }
  }
  const perFileLineMods = new Array<LineMod>();
  const globalLineMods = cliState.globalLineMods.get(snippet.lang);
  if (globalLineMods) {
    perFileLineMods.push(...globalLineMods);
  }
  const applyOuterId = snippet.applyOuterId;
  if (applyOuterId) {
    const applyLineMod = cliState.idToLineMod.get(applyOuterId);
    if (applyLineMod === undefined) {
      throw new UserError(
        `Attribute ${ATTR_KEY_APPLY_OUTER} contains an ID that either doesn’t exist or does not refer to a line mod`,
        { lineNumber: snippet.lineNumber }
      );
    }
    perFileLineMods.push(applyLineMod);
  }

  for (let i = 0; i < perFileLineMods.length; i++) {
    perFileLineMods[i].pushBeforeLines(lines);
  }
  // Once per snippet (in sequences and includes):
  // - Inner applicable line mod
  // - Local line mod
  snippet.assembleLines(config, cliState.idToSnippet, cliState.idToLineMod, lines, new Set());
  for (let i = perFileLineMods.length - 1; i >= 0; i--) {
    perFileLineMods[i].pushAfterLines(lines);
  }
  return lines;
}

//#################### CliState ####################

export enum LogLevel {
  Verbose,
  Normal,
}

export enum FileStatus {
  Failure,
  Success,
}

export type CliState = {
  absFilePath: string,
  tmpDir: string,
  logLevel: LogLevel,
  idToSnippet: Map<string, Snippet>,
  idToLineMod: Map<string, LineMod>,
  globalVisitationMode: GlobalVisitationMode,
  globalLineMods: Map<string, Array<LineMod>>,
  fileStatus: FileStatus,
  interceptedShellCommands: null | Array<Array<string>>
};

//#################### Snippet ####################

export abstract class Snippet {
  abstract get lineNumber(): number;
  abstract get id(): null | string;
  abstract get visitationMode(): VisitationMode;
  abstract get lang(): string;
  abstract get applyOuterId(): null | string;
  abstract get containedIn(): null | string;
  abstract get externalSpecs(): Array<ExternalSpec>;
  abstract get stdoutId(): null | string;
  abstract get stderrId(): null | string;

  abstract getFileName(langDef: LangDef): null | string;
  abstract isVisited(globalVisitationMode: GlobalVisitationMode): boolean;
  abstract assembleLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>): void;
  abstract getAllFileNames(langDef: LangDefCommand): Array<string>;

  abstract toJson(): JsonValue;
}

//========== SingleSnippet ==========

export class SingleSnippet extends Snippet {
  static createOpen(directive: Directive): SingleSnippet {
    const snippet = new SingleSnippet(directive.lineNumber);

    snippet.id = directive.getString(ATTR_KEY_ID) ?? null;

    { // visitationMode
      if (directive.hasAttribute(ATTR_KEY_ID)) {
        // Initial default value:
        // - By default, snippets with IDs are not visited.
        //   - Rationale: included somewhere and visited there.
        // - To still visit a snippet with an ID, use `only` or `neverSkip`.
        snippet.visitationMode = VisitationMode.Skip;
      }
      let visitationAttributes = 0;
      if (directive.hasAttribute(ATTR_KEY_SKIP)) {
        snippet.visitationMode = VisitationMode.Skip;
        visitationAttributes++;
      }
      if (directive.hasAttribute(ATTR_KEY_NEVER_SKIP)) {
        snippet.visitationMode = VisitationMode.NeverSkip;
        visitationAttributes++;
      }
      if (directive.hasAttribute(ATTR_KEY_ONLY)) {
        snippet.visitationMode = VisitationMode.Only;
        visitationAttributes++;
      }
      if (visitationAttributes > 1) {
        const attrs = [ATTR_KEY_SKIP, ATTR_KEY_NEVER_SKIP, ATTR_KEY_ONLY];
        throw new UserError(
          `Snippet has more than one of these attributes: ${attrs.join(', ')}`,
          { lineNumber: directive.lineNumber }
        );
      }
    }

    { // Assembling lines
      snippet.#applyInnerId = directive.getString(ATTR_KEY_APPLY_INNER) ?? null;
      snippet.applyOuterId = directive.getString(ATTR_KEY_APPLY_OUTER) ?? null;
      const ignoreLinesStr = directive.getString(ATTR_KEY_IGNORE_LINES);
      if (ignoreLinesStr) {
        snippet.#ignoreLines = parseLineNumberSet(directive.lineNumber, ignoreLinesStr);
      }

      const sequence = directive.getString(ATTR_KEY_SEQUENCE);
      if (sequence) {
        snippet.sequenceNumber = parseSequenceNumber(sequence);
      }

      const include = directive.getString(ATTR_KEY_INCLUDE);
      if (include) {
        snippet.includeIds = include.split(/ *, */);
      }
    }

    const containedIn = directive.getString(ATTR_KEY_CONTAINED_IN);
    if (containedIn) {
      snippet.containedIn = containedIn;
    }

    { // lang
      if (directive.hasAttribute(ATTR_KEY_WRITE)) {
        // Default value if attribute `write` exists. Override via
        // attribute `lang`.
        snippet.#lang = LANG_NEVER_RUN;
      }
      const lang = directive.getString(ATTR_KEY_LANG);
      if (lang) {
        snippet.#lang = lang;
      }
    }

    { // fileName
      const write = directive.getString(ATTR_KEY_WRITE);
      if (write) {
        snippet.#fileName = write;
      }
      const writeAndRun = directive.getString(ATTR_KEY_WRITE_AND_RUN);
      if (writeAndRun) {
        snippet.#fileName = writeAndRun;
      }
    }

    const external = directive.getString(ATTR_KEY_EXTERNAL);
    if (external) {
      snippet.externalSpecs = parseExternalSpecs(directive.lineNumber, external);
    }

    snippet.stdoutId = directive.getString(ATTR_KEY_STDOUT) ?? null;
    snippet.stderrId = directive.getString(ATTR_KEY_STDERR) ?? null;

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
  lineNumber: number;
  id: null | string = null;
  lineMod: null | LineMod = null;
  #applyInnerId: null | string = null;
  applyOuterId: null | string = null;
  #ignoreLines = new Set<number>();
  containedIn: null | string = null;
  #lang: null | string = null;
  #fileName: null | string = null;
  sequenceNumber: null | SequenceNumber = null;
  includeIds = new Array<string>();
  externalSpecs = new Array<ExternalSpec>();
  visitationMode: VisitationMode = VisitationMode.Normal;
  stdoutId: null | string = null;
  stderrId: null | string = null;

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

  override getFileName(langDef: LangDef): null | string {
    if (this.#fileName) {
      return this.#fileName;
    }
    if (langDef.kind === 'LangDefCommand') {
      return langDef.defaultFileName ?? null;
    }
    return null;
  }

  override isVisited(globalVisitationMode: GlobalVisitationMode): boolean {
    // this.visitationMode is set up by factory methods where `id` etc. are
    // considered.
    switch (globalVisitationMode) {
      case GlobalVisitationMode.Normal:
        switch (this.visitationMode) {
          case VisitationMode.Normal:
          case VisitationMode.Only:
          case VisitationMode.NeverSkip:
            return true;
          case VisitationMode.Skip:
            return false;
          default:
            throw new UnsupportedValueError(this.visitationMode);
        }
      case GlobalVisitationMode.Only:
        switch (this.visitationMode) {
          case VisitationMode.Only:
          case VisitationMode.NeverSkip:
            return true;
          case VisitationMode.Normal:
          case VisitationMode.Skip:
            return false;
          default:
            throw new UnsupportedValueError(this.visitationMode);
        }
      default:
        throw new UnsupportedValueError(globalVisitationMode);
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

  override assembleLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>): void {
    let thisWasIncluded = false;
    for (const includeId of this.includeIds) {
      if (includeId === '$THIS') {
        this.#pushThis(config, idToLineMod, lines);
        thisWasIncluded = true;
        continue;
      }
      this.#pushOneInclude(config, idToSnippet, idToLineMod, lines, pathOfIncludeIds, includeId);
    } // for
    if (!thisWasIncluded) {
      // Omitting `$THIS` is the same as putting it last
      this.#pushThis(config, idToLineMod, lines);
    }
  }

  #pushOneInclude(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>, includeId: string) {
    if (pathOfIncludeIds.has(includeId)) {
      const idPath = [...pathOfIncludeIds, includeId];
      throw new UserError(`Cycle of includedIds ` + JSON.stringify(idPath));
    }
    const snippet = idToSnippet.get(includeId);
    if (snippet === undefined) {
      throw new UserError(
        `Snippet includes the unknown ID ${JSON.stringify(includeId)}`,
        { lineNumber: this.lineNumber }
      );
    }
    pathOfIncludeIds.add(includeId);
    snippet.assembleLines(config, idToSnippet, idToLineMod, lines, pathOfIncludeIds);
    pathOfIncludeIds.delete(includeId);
  }

  #pushThis(config: Config, idToLineMod: Map<string, LineMod>, lines: Array<string>) {
    let applyLineMod: undefined | LineMod = undefined;
    if (this.#applyInnerId) {
      applyLineMod = idToLineMod.get(this.#applyInnerId);
      if (applyLineMod === undefined) {
        throw new UserError(
          `Attribute ${ATTR_KEY_APPLY_INNER} contains an ID that either doesn’t exist or does not refer to a line mod`,
          { lineNumber: this.lineNumber }
        );
      }
    }
    if (applyLineMod) {
      applyLineMod.pushBeforeLines(lines);
    }
    if (this.lineMod) {
      this.lineMod.pushBeforeLines(lines);
    }
    let body = this.body.filter(
      (_line, index) => !this.#ignoreLines.has(index + 1)
    );
    const translator = this.#getXTranslator(config);
    if (translator) {
      body = translator.translate(this.lineNumber, body);
    }
    lines.push(...body);
    if (this.lineMod) {
      this.lineMod.pushAfterLines(lines);
    }
    if (applyLineMod) {
      applyLineMod.pushAfterLines(lines);
    }
  }

  #getXTranslator(config: Config): undefined | Translator {
    if (this.#lang) {
      const lang = config.getLang(this.#lang);
      if (lang && lang.kind === 'LangDefCommand') {
        return lang.translator;
      }
    }
    return undefined;
  }

  override getAllFileNames(langDef: LangDefCommand): Array<string> {
    const fileName = this.getFileName(langDef);
    return [
      ...(fileName ? [fileName] : []),
      ...this.externalSpecs.map(es => es.fileName),
    ];
  }
  toJson(): SingleSnippetJson {
    return {
      lineNumber: this.lineNumber,
      lang: this.lang,
      id: this.id,
      external: this.externalSpecs,
      stdout: this.stdoutId,
      body: this.body,
    };
  }
}

//========== SequenceSnippet ==========

export class SequenceSnippet extends Snippet {
  elements = new Array<SingleSnippet>();

  constructor(singleSnippet: SingleSnippet) {
    super();
    const num = singleSnippet.sequenceNumber;
    assertNonNullable(num);
    if (num.pos !== 1) {
      throw new UserError(
        'First snippet in a sequence must have position 1 (1/*): ' + num,
        { lineNumber: singleSnippet.lineNumber }
      );
    }
    this.elements.push(singleSnippet);
  }

  pushElement(singleSnippet: SingleSnippet): void {
    const num = singleSnippet.sequenceNumber;
    assertNonNullable(num);
    if (num.total !== this.total) {
      throw new UserError(
        `Snippet has different total than current sequence (${this.total}): ${num}`,
        { lineNumber: singleSnippet.lineNumber }
      );
    }
    if (num.pos !== (this.elements.length + 1)) {
      throw new UserError(
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

  override assembleLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>): void {
    for (const element of this.elements) {
      element.assembleLines(config, idToSnippet, idToLineMod, lines, pathOfIncludeIds);
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
  override get visitationMode(): VisitationMode {
    return this.firstElement.visitationMode;
  }
  override isVisited(globalVisitationMode: GlobalVisitationMode): boolean {
    return this.firstElement.isVisited(globalVisitationMode);
  }
  override get lang(): string {
    return this.firstElement.lang;
  }
  override get applyOuterId(): null | string {
    return this.firstElement.applyOuterId;
  }
  override get containedIn(): null | string {
    return this.firstElement.containedIn;
  }
  override getFileName(langDef: LangDef): null | string {
    return this.firstElement.getFileName(langDef);
  }
  override getAllFileNames(langDef: LangDefCommand): Array<string> {
    return this.firstElement.getAllFileNames(langDef);
  }
  override get externalSpecs(): Array<ExternalSpec> {
    return this.firstElement.externalSpecs;
  }
  override get stdoutId(): null | string {
    return this.firstElement.stdoutId;
  }
  override get stderrId(): null | string {
    return this.firstElement.stderrId;
  }
  toJson(): JsonValue {
    return this.elements.map(e => e.toJson());
  }
}

//========== Snippet helper types ==========

export enum VisitationMode {
  Normal = 'Normal',
  Only = 'Only',
  Skip = 'Skip',
  NeverSkip = 'NeverSkip',
}
export enum GlobalVisitationMode {
  Normal = 'Normal',
  Only = 'Only',
}

export type SingleSnippetJson = {
  lineNumber: number,
  lang: string,
  id: null | string,
  external: Array<ExternalSpec>,
  stdout: null | string,
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
    body: partial.body ?? [],
  };
}

//#################### LineMod ####################

const RE_AROUND_MARKER = /^[ \t]*•••[ \t]*$/;
const STR_AROUND_MARKER = '•••';

export type LineModKind =
  | LineModKindLocal
  | LineModKindGlobal
  | LineModKindApplicable
  ;
export type LineModKindLocal = {
  tag: 'LineModKindLocal',
};
export type LineModKindGlobal = {
  tag: 'LineModKindGlobal',
  targetLanguage: string,
};
export type LineModKindApplicable = {
  tag: 'LineModKindApplicable',
  id: string,
};

export class LineMod {
  lineNumber: LineNumber;
  #beforeLines: Array<string>;
  #afterLines: Array<string>;
  #kind: LineModKind;
  constructor(directive: Directive, kind: LineModKind) {
    this.lineNumber = directive.lineNumber;
    this.#kind = kind;
    const body = trimTrailingEmptyLines(directive.body.slice());
    switch (directive.bodyLabel) {
      case BODY_LABEL_BEFORE: {
        this.#beforeLines = body;
        this.#afterLines = [];
        return;
      }
      case BODY_LABEL_AFTER: {
        this.#beforeLines = [];
        this.#afterLines = body;
        return;
      }
      case BODY_LABEL_AROUND: {
        const markerIndex = body.findIndex(line => RE_AROUND_MARKER.test(line));
        if (markerIndex < 0) {
          throw new UserError(`Missing around marker ${STR_AROUND_MARKER} in ${BODY_LABEL_AROUND} body`, { lineNumber: directive.lineNumber });
        }
        this.#beforeLines = body.slice(0, markerIndex);
        this.#afterLines = body.slice(markerIndex + 1);
        return;
      }
      default:
        throw new InternalError();
    }
  }
  get id(): undefined | string {
    switch (this.#kind.tag) {
      case 'LineModKindApplicable':
        return this.#kind.id
      case 'LineModKindLocal':
      case 'LineModKindGlobal':
        return undefined;
      default:
        throw new UnsupportedValueError(this.#kind);
    }
  }
  get targetLanguage(): undefined | string {
    switch (this.#kind.tag) {
      case 'LineModKindGlobal':
        return this.#kind.targetLanguage;
      case 'LineModKindLocal':
      case 'LineModKindApplicable':
        return undefined;
      default:
        throw new UnsupportedValueError(this.#kind);
    }
  }
  pushBeforeLines(lines: Array<string>): void {
    lines.push(...this.#beforeLines);
  }
  pushAfterLines(lines: Array<string>): void {
    lines.push(...this.#afterLines);
  }
  toJson(): JsonValue {
    let props;
    switch (this.#kind.tag) {
      case 'LineModKindLocal':
        props = {};
        break;
      case 'LineModKindGlobal':
        props = { targetLanguage: this.#kind.targetLanguage };
        break;
      case 'LineModKindApplicable':
        props = { id: this.#kind.id };
        break;
      default:
        throw new UnsupportedValueError(this.#kind);
    }
    return {
      beforeLines: this.#beforeLines,
      afterLines: this.#afterLines,
      ...props,
    };
  }
}

//#################### ConfigMod ####################

export class ConfigMod {
  lineNumber: number;
  configModJson: ConfigModJson;
  constructor(directive: Directive) {
    this.lineNumber = directive.lineNumber;
    const text = directive.body.join(os.EOL);
    const json = json5.parse(text);
    this.configModJson = ConfigModJsonSchema.parse(json);
  }
  toJson(): JsonValue {
    return {
      configModJson: this.configModJson,
    };
  }
}

//#################### Heading ####################

export class Heading {
  constructor(public content: string) { }
  toJson(): JsonValue {
    return {
      content: this.content,
    };
  }
}
