import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import * as os from 'node:os';
import { ConfigModJsonSchema } from './config.js';
import { ATTR_KEY_EACH, ATTR_KEY_ID, ATTR_KEY_LANG, ATTR_KEY_SEQUENCE, ATTR_KEY_WRITE, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_BODY, BODY_LABEL_CONFIG, parseSequenceNumber, type Directive, type SequenceNumber } from './directive.js';
import { InternalError, UserError } from './errors.js';

export type MarktestEntity = ConfigMod | Snippet | LineMod;

/**
 * @returns A snippet is open or closed
 */
export function directiveToEntity(directive: Directive): null | ConfigMod | SingleSnippet | LineMod {
  switch (directive.bodyLabel) {
    case BODY_LABEL_CONFIG:
      return new ConfigMod(directive);
    case BODY_LABEL_BEFORE:
    case BODY_LABEL_AFTER:
    case BODY_LABEL_AROUND: {
      const lineMod = new LineMod(directive);
      const each = directive.getAttribute(ATTR_KEY_EACH);
      if (each) {
        lineMod.targetLanguage = each;
        return lineMod;
      }
      const snippet = SingleSnippet.createOpen(directive);
      snippet.lineMod = lineMod;
      return snippet;
    }
    case BODY_LABEL_BODY: {
      const snippet = SingleSnippet.createOpen(directive);
      const lang = directive.getAttribute(ATTR_KEY_LANG) ?? '';
      snippet.closeWithBody(lang, directive.body);
      return snippet;
    }
    default: {
      return null;
    }
  }
}

export function assembleLines(globalLineMods: undefined | Array<LineMod>, snippet: Snippet): Array<string> {
  const lines = new Array<string>();
  if (globalLineMods) {
    for (let i = 0; i < globalLineMods.length; i++) {
      globalLineMods[i].pushBeforeLines(lines);
    }
  }
  snippet.assembleLines(lines);
  if (globalLineMods) {
    for (let i = globalLineMods.length - 1; i >= 0; i--) {
      globalLineMods[i].pushAfterLines(lines);
    }
  }
  return lines;
}

//#################### Snippet ####################

export abstract class Snippet {
  abstract assembleLines(lines: Array<string>): void;
  abstract get lang(): string;
  abstract get fileNameToWrite(): null | string;
  abstract isActive(): boolean;
}
export class SingleSnippet extends Snippet {
  static createOpen(directive: Directive): SingleSnippet {
    // Attributes: id, sequence, include, only, skip, write
    const snippet = new SingleSnippet(directive.lineNumber);

    snippet.id = directive.getAttribute(ATTR_KEY_ID) ?? null;

    const fileNameToWrite = directive.getAttribute(ATTR_KEY_WRITE) ?? null;
    if (fileNameToWrite) {
      snippet.fileNameToWrite = fileNameToWrite;
    }

    const sequenceNumberStr = directive.getAttribute(ATTR_KEY_SEQUENCE) ?? null;
    if (sequenceNumberStr) {
      snippet.sequenceNumber = parseSequenceNumber(sequenceNumberStr);
    }

    return snippet;
  }
  static createFromCodeBlock(lineNumber: number, lang: string, lines: Array<string>): SingleSnippet {
    return new SingleSnippet(lineNumber).closeWithBody(lang, lines);
  }
  id: null | string = null;
  isClosed = false;
  lineMod: null | LineMod = null;
  lineNumber: number;
  lang = '';
  fileNameToWrite: null | string = null;
  sequenceNumber: null | SequenceNumber = null;

  body = new Array<string>();

  private constructor(lineNumber: number) {
    super();
    this.lineNumber = lineNumber;
  }

  override isActive(): boolean {
    // Rules:
    // - An ID means a snippet is inactive.
    //   - Rationale: included somewhere.
    //   - To still run a snippet with an ID, create an empty body snippet
    //     and include the snippet.
    // - Attributes: only, skip, neverSkip
    if (this.id) {
      return false;
    }
    return true;
  }

  closeWithBody(lang: string, lines: Array<string>): this {
    assertTrue(!this.isClosed);
    this.lang = lang;
    this.body.push(...lines);
    this.isClosed = true;
    return this;
  }

  override assembleLines(lines: Array<string>): void {
    if (this.lineMod) {
      this.lineMod.pushBeforeLines(lines);
    }
    lines.push(...this.body);
    if (this.lineMod) {
      this.lineMod.pushAfterLines(lines);
    }
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

  override assembleLines(lines: string[]): void {
    for (const element of this.elements) {
      element.assembleLines(lines);
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
  override get lang(): string {
    return this.firstElement.lang;
  }
  override get fileNameToWrite(): string | null {
    return this.firstElement.fileNameToWrite;
  }
  override isActive(): boolean {
    return this.firstElement.isActive();
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
  configModJson;
  constructor(directive: Directive) {
    const text = directive.body.join(os.EOL);
    this.configModJson = ConfigModJsonSchema.parse(text);
  }
}