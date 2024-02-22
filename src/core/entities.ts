import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import json5 from 'json5';
import * as os from 'node:os';
import { InternalError, UserError } from '../util/errors.js';
import { ConfigModJsonSchema, type ConfigModJson, type LangDef, type LangDefCommand } from './config.js';
import { ATTR_KEY_EACH, ATTR_KEY_EXTERNAL, ATTR_KEY_ID, ATTR_KEY_INCLUDE, ATTR_KEY_LANG, ATTR_KEY_NEVER_SKIP, ATTR_KEY_ONLY, ATTR_KEY_SEQUENCE, ATTR_KEY_SKIP, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, ATTR_KEY_WRITE, ATTR_KEY_WRITE_AND_RUN, ATTR_VALUE_LANG_EMPTY, ATTR_VALUE_LANG_NEVER_RUN, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_BODY, BODY_LABEL_CONFIG, parseExternalSpecs, parseSequenceNumber, type Directive, type ExternalSpec, type SequenceNumber } from './directive.js';

export type MarktestEntity = ConfigMod | Snippet | LineMod;

/**
 * @returns A snippet is open or closed
 */
export function directiveToEntity(directive: Directive): null | ConfigMod | SingleSnippet | LineMod {
  switch (directive.bodyLabel) {
    case BODY_LABEL_CONFIG:
      return new ConfigMod(directive);

    case BODY_LABEL_BODY: {
      return SingleSnippet.createClosedFromBodyDirective(directive);
    }

    case BODY_LABEL_BEFORE:
    case BODY_LABEL_AFTER:
    case BODY_LABEL_AROUND:
    case null: {
      // Either an open snippet or a LineMod
      const snippet = SingleSnippet.createOpen(directive);
      if (directive.bodyLabel !== null) {
        const lineMod = new LineMod(directive);
        const each = directive.getAttribute(ATTR_KEY_EACH);
        if (each) {
          lineMod.targetLanguage = each;
          return lineMod;
        }
        snippet.lineMod = lineMod;
      }
      return snippet;
    }

    default: {
      throw new InternalError();
    }
  }
}

export function assembleLinesForId(idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, sourceLineNumber: number, targetId: string, context: string): Array<string> {
  const targetSnippet = idToSnippet.get(targetId);
  if (!targetSnippet) {
    throw new UserError(
      `Unknown ID ${JSON.stringify(targetId)} (${context})`,
      { lineNumber: sourceLineNumber }
    );
  }
  return assembleLines(idToSnippet, globalLineMods, targetSnippet);
}

export function assembleLines(idToSnippet: Map<string, Snippet>, globalLineMods: Map<string, Array<LineMod>>, snippet: Snippet) {
  const lines = new Array<string>();
  const glm = globalLineMods.get(snippet.lang);
  if (glm) {
    for (let i = 0; i < glm.length; i++) {
      glm[i].pushBeforeLines(lines);
    }
  }
  snippet.assembleLines(idToSnippet, lines, new Set());
  if (glm) {
    for (let i = glm.length - 1; i >= 0; i--) {
      glm[i].pushAfterLines(lines);
    }
  }
  return lines;
}

//#################### Snippet ####################

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

export abstract class Snippet {
  abstract get lineNumber(): number;
  abstract get id(): null | string;
  abstract get lang(): string;
  abstract get externalSpecs(): Array<ExternalSpec>;
  abstract get visitationMode(): VisitationMode;
  abstract get stdoutId(): null | string;
  abstract get stderrId(): null | string;

  abstract getFileName(langDef: LangDef): string;
  abstract isVisited(globalVisitationMode: GlobalVisitationMode): boolean;
  abstract assembleLines(idToSnippet: Map<string, Snippet>, lines: Array<string>, pathOfIncludeIds: Set<string>): void;
  abstract getAllFileNames(langDef: LangDefCommand): Array<string>;
}
export class SingleSnippet extends Snippet {
  static createOpen(directive: Directive): SingleSnippet {
    const snippet = new SingleSnippet(directive.lineNumber);

    snippet.id = directive.getAttribute(ATTR_KEY_ID) ?? null;

    { // fileName
      const write = directive.getAttribute(ATTR_KEY_WRITE);
      if (write) {
        snippet.#fileName = write;
      }
      const writeAndRun = directive.getAttribute(ATTR_KEY_WRITE_AND_RUN);
      if (writeAndRun) {
        snippet.#fileName = writeAndRun;
      }
    }

    { // lang
      if (directive.hasAttribute(ATTR_KEY_WRITE)) {
        // Default value if attribute `write` exists
        snippet.#lang = ATTR_VALUE_LANG_NEVER_RUN;
      }
      const lang = directive.getAttribute(ATTR_KEY_LANG);
      if (lang) {
        snippet.#lang = lang;
      }
    }

    const sequence = directive.getAttribute(ATTR_KEY_SEQUENCE);
    if (sequence) {
      snippet.sequenceNumber = parseSequenceNumber(sequence);
    }

    const include = directive.getAttribute(ATTR_KEY_INCLUDE);
    if (include) {
      snippet.includeIds = include.split(/ *, */);
    }

    const external = directive.getAttribute(ATTR_KEY_EXTERNAL);
    if (external) {
      snippet.externalSpecs = parseExternalSpecs(directive.lineNumber, external);
    }

    { // visitationMode
      if (directive.hasAttribute(ATTR_KEY_ID)) {
        // Initial default value:
        // - By default, snippets with IDs are not visited.
        //   - Rationale: included somewhere and visited there.
        // - To still visit a snippet with an ID, use `only` or `neverSkip`.
        snippet.visitationMode = VisitationMode.Skip;
      }
      if (directive.hasAttribute(ATTR_KEY_ONLY)) {
        snippet.visitationMode = VisitationMode.Only;
      }
      if (directive.hasAttribute(ATTR_KEY_SKIP)) {
        snippet.visitationMode = VisitationMode.Skip;
      }
      if (directive.hasAttribute(ATTR_KEY_NEVER_SKIP)) {
        snippet.visitationMode = VisitationMode.NeverSkip;
      }
    }

    snippet.stdoutId = directive.getAttribute(ATTR_KEY_STDOUT) ?? null;
    snippet.stderrId = directive.getAttribute(ATTR_KEY_STDERR) ?? null;

    return snippet;
  }
  static createClosedFromBodyDirective(directive: Directive): SingleSnippet {
    const openSnippet = SingleSnippet.createOpen(directive);
    const lang = openSnippet.#lang;
    if (lang === null) {
      throw new UserError(
        `Body directive must have either attribute ${ATTR_KEY_LANG} or attribute ${ATTR_KEY_WRITE}`,
        { lineNumber: directive.lineNumber }
      );
    }
    return openSnippet.closeWithBody(lang, directive.body);
  }
  static createClosedFromCodeBlock(lineNumber: number, lang: string, lines: Array<string>): SingleSnippet {
    return new SingleSnippet(lineNumber).closeWithBody(lang, lines);
  }
  lineNumber: number;
  #lang: null | string = null;
  id: null | string = null;
  lineMod: null | LineMod = null;
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

  override getFileName(langDef: LangDef): string {
    if (this.#fileName) return this.#fileName;
    if (langDef.kind === 'LangDefCommand') {
      return langDef.defaultFileName;
    }
    return ATTR_VALUE_LANG_EMPTY;
  }

  override isVisited(globalVisitationMode: GlobalVisitationMode): boolean {
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
    this.body.push(...lines);
    this.isClosed = true;
    return this;
  }

  override assembleLines(idToSnippet: Map<string, Snippet>, lines: Array<string>, pathOfIncludeIds: Set<string>): void {
    for (const includeId of this.includeIds) {
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
      snippet.assembleLines(idToSnippet, lines, pathOfIncludeIds);
      pathOfIncludeIds.delete(includeId);
    }
    if (this.lineMod) {
      this.lineMod.pushBeforeLines(lines);
    }
    lines.push(...this.body);
    if (this.lineMod) {
      this.lineMod.pushAfterLines(lines);
    }
  }
  override getAllFileNames(langDef: LangDefCommand): Array<string> {
    return [
      this.getFileName(langDef),
      ...this.externalSpecs.map(es => es.fileName),
    ];
  }
}

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
    if (num.pos !== this.elements.length) {
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

  override assembleLines(idToSnippet: Map<string, Snippet>, lines: Array<string>, pathOfIncludeIds: Set<string>): void {
    for (const element of this.elements) {
      element.assembleLines(idToSnippet, lines, pathOfIncludeIds);
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
  override get lang(): string {
    return this.firstElement.lang;
  }
  override get externalSpecs(): Array<ExternalSpec> {
    return this.firstElement.externalSpecs;
  }
  override get visitationMode(): VisitationMode {
    return this.firstElement.visitationMode;
  }
  override get stdoutId(): null | string {
    return this.firstElement.stdoutId;
  }
  override get stderrId(): null | string {
    return this.firstElement.stderrId;
  }

  override getFileName(langDef: LangDef): string {
    return this.firstElement.getFileName(langDef);
  }

  override isVisited(globalVisitationMode: GlobalVisitationMode): boolean {
    return this.firstElement.isVisited(globalVisitationMode);
  }
  override getAllFileNames(langDef: LangDefCommand): Array<string> {
    return this.firstElement.getAllFileNames(langDef);
  }
}

//#################### LineMod ####################

const RE_AROUND_MARKER = /^[ \t]*•••[ \t]*$/;
const STR_AROUND_MARKER = '•••';

export class LineMod {
  #beforeLines: Array<string>;
  #afterLines: Array<string>;
  targetLanguage: null | string = null;
  constructor(directive: Directive) {
    switch (directive.bodyLabel) {
      case BODY_LABEL_BEFORE: {
        this.#beforeLines = directive.body;
        this.#afterLines = [];
        return;
      }
      case BODY_LABEL_AFTER: {
        this.#beforeLines = [];
        this.#afterLines = directive.body;
        return;
      }
      case BODY_LABEL_AROUND: {
        const markerIndex = directive.body.findIndex(line => RE_AROUND_MARKER.test(line));
        if (markerIndex < 0) {
          throw new UserError(`Missing around marker ${STR_AROUND_MARKER} in ${BODY_LABEL_AROUND} body`, { lineNumber: directive.lineNumber });
        }
        this.#beforeLines = directive.body.slice(0, markerIndex);
        this.#afterLines = directive.body.slice(markerIndex + 1);
        return;
      }
      default:
        throw new InternalError();
    }
  }
  pushBeforeLines(lines: string[]): void {
    lines.push(...this.#beforeLines);
  }
  pushAfterLines(lines: string[]): void {
    lines.push(...this.#afterLines);
  }
}

//#################### ConfigMod ####################

export class ConfigMod {
  configModJson: ConfigModJson;
  constructor(directive: Directive) {
    const text = directive.body.join(os.EOL);
    const json = json5.parse(text);
    this.configModJson = ConfigModJsonSchema.parse(json);
  }
}
