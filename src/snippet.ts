import { assertTrue } from '@rauschma/helpers/ts/type.js';
import { ATTR_KEY_EACH, ATTR_KEY_ID, ATTR_KEY_LANG, ATTR_KEY_WRITE, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_BODY, BODY_LABEL_CONFIG, type Directive } from './directive.js';
import { InternalError, UserError } from './errors.js';

/*
Assembly:
- Snippet itself: body + local transformation
- Prepend includes
- Append sequence members (only to 1st sequence member!)
- Apply global transformations
*/

export type MtConstruct = Configuration | Snippet | Transformation;

/**
 * @returns A snippet can be open or closed
 */
export function mtConstructFromDirective(directive: Directive): null | Configuration | SingleSnippet | Transformation {
  switch (directive.bodyLabel) {
    case BODY_LABEL_CONFIG:
      return new Configuration(directive);
    case BODY_LABEL_BEFORE:
    case BODY_LABEL_AFTER:
    case BODY_LABEL_AROUND: {
      const transformation = new Transformation(directive);
      const each = directive.getAttribute(ATTR_KEY_EACH);
      if (each) {
        transformation.targetLanguage = each;
        return transformation;
      }
      const snippet = SingleSnippet.createOpen(directive);
      snippet.transformation = transformation;
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
export abstract class Snippet {
  abstract assembleLines(lines: Array<string>): void;
  abstract get lang(): string;
  abstract get writeToFile(): null | string;
  abstract isActive(): boolean;
}
export class SingleSnippet extends Snippet {
  static createOpen(directive: Directive): SingleSnippet {
    // Attributes: id, sequence, include, only, skip, write
    const writeToFile = directive.getAttribute(ATTR_KEY_WRITE) ?? null;
    const snippet = new SingleSnippet(directive.lineNumber, writeToFile);
    snippet.id = directive.getAttribute(ATTR_KEY_ID) ?? null;
    return snippet;
  }
  static createFromCodeBlock(lineNumber: number, lang: string, lines: Array<string>): SingleSnippet {
    return new SingleSnippet(lineNumber, null).closeWithBody(lang, lines);
  }
  id: null | string = null;
  isClosed = false;
  transformation: null | Transformation = null;
  lineNumber: number;
  lang = '';
  writeToFile: null | string;
  body = new Array<string>();

  private constructor(lineNumber: number, writeToFile: null | string) {
    super();
    this.lineNumber = lineNumber;
    this.writeToFile = writeToFile;
  }

  override isActive(): boolean {
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
    if (this.transformation) {
      this.transformation.pushBeforeLines(lines);
    }
    lines.push(...this.body);
    if (this.transformation) {
      this.transformation.pushAfterLines(lines);
    }
  }
}

const RE_AROUND_MARKER = /^[ \t]*•••[ \t]*$/;
const STR_AROUND_MARKER = '•••';

export class Transformation {
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

export class Configuration {
  constructor(directive: Directive) {

  }
}