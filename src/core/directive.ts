import { re } from '@rauschma/helpers/js/re-template-tag.js';
import { assertTrue } from '@rauschma/helpers/ts/type.js';
import { InternalError, UserError, type LineNumber } from '../util/errors.js';

//#################### Constants ####################

//========== Various constants ==========

const RE_LABEL = /[A-Za-z0-9\-_]+/u;
const RE_TOKEN = re`/[ \t]+((?<bodyLabel>${RE_LABEL}:)|(?<key>${RE_LABEL})([ \t]*=[ \t]*"(?<value>[^"]*)")?)/uy`;

const MARKTEST_MARKER = 'marktest';

//========== Attribute keys ==========

//----- Assembling lines -----

export const ATTR_KEY_ID = 'id';
export const ATTR_KEY_SEQUENCE = 'sequence';
export const ATTR_KEY_INCLUDE = 'include';

//----- Writing and referring to files -----

export const ATTR_KEY_WRITE = 'write';
export const ATTR_KEY_WRITE_AND_RUN = 'writeAndRun';

/**
 * ```
 * external="id1>lib1.js, id2>lib2.js, id3>lib3.js"
 * external="lib1.ts, lib2.ts, lib3.ts"
 * ```
 */
export const ATTR_KEY_EXTERNAL = 'external';

export type ExternalSpec = {
  id: null | string,
  fileName: string
};
const RE_EXTERNAL_SPEC = re`/^((?<id>${RE_LABEL}) *> *)?(?<fileName>[^>]+)$/u`;
export function parseExternalSpecs(lineNumber: number, str: string): Array<ExternalSpec> {
  const specs = new Array<ExternalSpec>();

  const parts = str.split(/ *, */);
  for (const part of parts) {
    const match = RE_EXTERNAL_SPEC.exec(part);
    if (!match || !match.groups || !match.groups.fileName) {
      throw new UserError(
        `Could not parse value of attribute ${ATTR_KEY_EXTERNAL}: ${JSON.stringify(part)}`,
        { lineNumber }
      );
    }
    const id = match.groups.id ?? null;
    specs.push({ id, fileName: match.groups.fileName });
  }
  return specs;
}

//----- Visitation mode -----

export const ATTR_KEY_ONLY = 'only';
export const ATTR_KEY_SKIP = 'skip';
export const ATTR_KEY_NEVER_SKIP = 'neverSkip';

//----- Checking output -----

export const ATTR_KEY_STDOUT = 'stdout';
export const ATTR_KEY_STDERR = 'stderr';

//----- Global line mods -----

export const ATTR_KEY_EACH = 'each';

//----- Language -----

/**
 * Can prevent running!
 * - For body directives
 * - To override defaults from code blocks and `write`
 */
export const ATTR_KEY_LANG = 'lang';

//========== Language constants ==========
// - Location 1: values of attribute `lang`
// - Location 2: In configurations for language definitions (property
//   values of "lang" object).

/** Only a config property key */
export const LANG_KEY_EMPTY = '';

export const LANG_NEVER_RUN = '[neverRun]';
export const LANG_SKIP = '[skip]';
export const LANG_ERROR_IF_RUN = '[errorIfRun]';
export const LANG_ERROR_IF_VISITED = '[errorIfVisited]';

//========== Body labels ==========

//----- Self-contained directives -----
export const BODY_LABEL_CONFIG = 'config:';
export const BODY_LABEL_BODY = 'body:';

//----- Line mods -----
export const BODY_LABEL_BEFORE = 'before:';
export const BODY_LABEL_AFTER = 'after:';
export const BODY_LABEL_AROUND = 'around:';

//========== Command variables ==========

export const CMD_VAR_FILE_NAME = '$FILE_NAME';
export const CMD_VAR_ALL_FILE_NAMES = '$ALL_FILE_NAMES';

//#################### Code ####################

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
