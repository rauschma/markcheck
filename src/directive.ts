import { assertTrue } from "@rauschma/helpers/ts/type.js";
import { InternalError, UserError, type LineNumber } from "./errors.js";

//========== Attribute keys ==========

//----- How is snippet assembled? -----
export const ATTR_KEY_ID = 'id';
export const ATTR_KEY_SEQUENCE = 'sequence';
export const ATTR_KEY_INCLUDE = 'include';

//----- How is snippet used? -----
export const ATTR_KEY_ONLY = 'only';
export const ATTR_KEY_SKIP = 'skip';
export const ATTR_KEY_NEVER_SKIP = 'neverSkip';
export const ATTR_KEY_WRITE = 'write';

//----- For transformations -----
export const ATTR_KEY_EACH = 'each';

//----- `body:` directive -----
export const ATTR_KEY_LANG = 'lang';

//========== Body labels ==========

//----- Self-contained directives -----
export const BODY_LABEL_CONFIG = 'config:';
export const BODY_LABEL_BODY = 'body:';

//----- Transformations -----
export const BODY_LABEL_BEFORE = 'before:';
export const BODY_LABEL_AFTER = 'after:';
export const BODY_LABEL_AROUND = 'around:';

//========== Other constants ==========

const RE_TOKEN = /[ \t]+((?<bodyLabel>[A-Za-z0-9\-_]+:)|(?<key>[A-Za-z0-9\-_]+)([ \t]*=[ \t]*"(?<value>[^"]*)")?)/uy;

const MARKTEST_MARKER = 'marktest';

//========== Sequence numbers ==========

export class SequenceNumber {
  pos: number;
  total: number;
  constructor(pos: number, total: number) {
    this.pos = pos;
    this.total = total;
  }
  toString() {
    return this.pos + '/' + this.total;
  }
}

const RE_SEQUENCE_NUMBER = /^ *([0-9]+) *\/ *([0-9]+) *$/u;
export function parseSequenceNumber(str: string): null | SequenceNumber {
  const match = RE_SEQUENCE_NUMBER.exec(str);
  if (!match) return null;
  const pos = Number(match[1]);
  const total = Number(match[2]);
  if (Number.isNaN(pos) || Number.isNaN(total)) {
    return null;
  }
  return new SequenceNumber(pos, total);
}

//========== Directive ==========

export class Directive {
  static parse(lineNumber: LineNumber, commentLines: Array<string>): null | Directive {
    let [firstLine, ...remainingLines] = commentLines;
    if (!firstLine.startsWith(MARKTEST_MARKER)) {
      return null;
    }
    firstLine = firstLine.slice(MARKTEST_MARKER.length);
    const body = remainingLines;
    const directive = new Directive(lineNumber, body);
    RE_TOKEN.lastIndex = 0;
    while (true) {
      const match = RE_TOKEN.exec(firstLine);
      if (!match) break;
      if (directive.bodyLabel !== null) {
        throw new UserError(`Body label ${JSON.stringify(directive.bodyLabel)} must come after all attributes`, { lineNumber });
      }
      assertTrue(match.groups !== undefined);
      if (match.groups.key) {
        if (match.groups.value) {
          directive.setAttribute(match.groups.key, match.groups.value);
        } else {
          directive.setAttribute(match.groups.key, 'true');
        }
      } else if (match.groups.bodyLabel) {
        directive.bodyLabel = match.groups.bodyLabel;
      } else {
        throw new InternalError();
      }
    }
    return directive;
  }
  lineNumber: LineNumber;
  body: Array<string>;
  #attributes = new Map<string, string>();
  bodyLabel: null | string = null;
  private constructor(lineNumber: LineNumber, body: Array<string>) {
    this.lineNumber = lineNumber;
    this.body = body;
  }
  setAttribute(key: string, value: string): void {
    this.#attributes.set(key, value);
  }
  getAttribute(key: string): undefined | string {
    return this.#attributes.get(key);
  }
  hasAttribute(key: string): boolean {
    return this.#attributes.has(key);
  }
}
