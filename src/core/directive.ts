import { re } from '@rauschma/helpers/js/re-template-tag.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { assertTrue } from '@rauschma/helpers/ts/type.js';
import { InternalError, UserError, type LineNumber } from '../util/errors.js';

const { stringify } = JSON;

//#################### Constants ####################

//========== Various constants ==========

const RE_LABEL = /[A-Za-z0-9\-_]+/u;
const RE_TOKEN = re`/[ \t]+((?<bodyLabel>${RE_LABEL}:)|(?<key>${RE_LABEL})([ \t]*=[ \t]*"(?<value>[^"]*)")?)/uy`;

const MARKTEST_MARKER = 'marktest';

//========== Attribute keys ==========

export const ATTR_KEY_ID = 'id';

//----- Assembling lines -----

export const ATTR_KEY_SEQUENCE = 'sequence';
export const ATTR_KEY_INCLUDE = 'include';
export const ATTR_KEY_APPLY_INNER = 'applyInner';
export const ATTR_KEY_APPLY_OUTER = 'applyOuter';
export const ATTR_KEY_IGNORE_LINES = 'ignoreLines';

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

//----- Line mods -----

// Global line mods
export const ATTR_KEY_EACH = 'each';

// Applicable line mods have the attribute `id`

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

export const LANG_KEY_EMPTY = '';
export const LANG_NEVER_RUN = '[neverRun]';
export const LANG_SKIP = '[skip]';
export const LANG_ERROR_IF_RUN = '[errorIfRun]';
export const LANG_ERROR_IF_VISITED = '[errorIfVisited]';

export const RE_LANG_VALUE = /^((?!\[).*|\[neverRun\]|\[skip\]|\[errorIfRun\]|\[errorIfVisited\])$/;

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

//#################### Expected attribute values ####################

export const Valueless = Symbol('Valueless');

export enum AttrValue {
  Valueless, String
}

export type ExpectedAttributeValues = Map<string, AttrValue | RegExp>;

export const SNIPPET_ATTRIBUTES: ExpectedAttributeValues = new Map<string, AttrValue | RegExp>([
  [ATTR_KEY_ID, AttrValue.String],
  [ATTR_KEY_SEQUENCE, AttrValue.String],
  [ATTR_KEY_INCLUDE, AttrValue.String],
  [ATTR_KEY_APPLY_INNER, AttrValue.String],
  [ATTR_KEY_APPLY_OUTER, AttrValue.String],
  [ATTR_KEY_IGNORE_LINES, AttrValue.String],
  //
  [ATTR_KEY_WRITE, AttrValue.String],
  [ATTR_KEY_WRITE_AND_RUN, AttrValue.String],
  [ATTR_KEY_EXTERNAL, AttrValue.String],
  //
  [ATTR_KEY_ONLY, AttrValue.Valueless],
  [ATTR_KEY_SKIP, AttrValue.Valueless],
  [ATTR_KEY_NEVER_SKIP, AttrValue.Valueless],
  //
  [ATTR_KEY_STDOUT, AttrValue.String],
  [ATTR_KEY_STDERR, AttrValue.String],
  //
  [ATTR_KEY_LANG, RE_LANG_VALUE],
]);

export const GLOBAL_LINE_MOD_ATTRIBUTES: ExpectedAttributeValues = new Map([
  [ATTR_KEY_EACH, AttrValue.String],
]);

export const APPLICABLE_LINE_MOD_ATTRIBUTES: ExpectedAttributeValues = new Map([
  [ATTR_KEY_ID, AttrValue.String],
]);

export const CONFIG_MOD_ATTRIBUTES: ExpectedAttributeValues = new Map([
]);

//#################### Code ####################

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
  #attributes = new Map<string, typeof Valueless | string>();
  bodyLabel: null | string = null;
  private constructor(lineNumber: LineNumber, body: Array<string>) {
    this.lineNumber = lineNumber;
    this.body = body;
  }
  setAttribute(key: string, value: typeof Valueless | string): void {
    this.#attributes.set(key, value);
  }
  getAttribute(key: string): undefined | typeof Valueless | string {
    return this.#attributes.get(key);
  }
  getString(key: string): undefined | string {
    const value = this.getAttribute(key);
    if (value === Valueless) {
      throw new UserError(
        `Attribute ${stringify(key)}: expected no key or a string value, but it was valueless`
      );
    }
    return value;
  }
  hasAttribute(key: string): boolean {
    return this.#attributes.has(key);
  }
  checkAttributes(expectedAttributes: ExpectedAttributeValues): void {
    for (const [k, v] of this.#attributes) {
      const expectedValue = expectedAttributes.get(k);
      if (expectedValue === undefined) {
        throw new UserError(
          `directive has unknown attribute key ${stringify(k)}`,
          { lineNumber: this.lineNumber }
        );
      }
      if (expectedValue === AttrValue.Valueless) {
        if (v !== Valueless) {
          throw new UserError(
            `Attribute ${stringify(k)} of directive must be valueless`,
            { lineNumber: this.lineNumber }
          );
        }
      } else if (expectedValue === AttrValue.String) {
        if (typeof v !== 'string') {
          throw new UserError(
            `Attribute ${stringify(k)} of directive must have a string value`,
            { lineNumber: this.lineNumber }
          );
        }
      } else if (expectedValue instanceof RegExp) {
        if (typeof v !== 'string' || !expectedValue.test(v)) {
          throw new UserError(
            `Attribute ${stringify(k)} has an illegal value (must be string and match ${expectedValue})`,
            { lineNumber: this.lineNumber }
          );
        }
      } else {
        throw new UnsupportedValueError(expectedValue)
      }
    }
  }
}

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

//========== Line numbers ==========

const RE_RANGE = /^([0-9]+)-([0-9]+)$/;
const RE_NUMBER = /^[0-9]+$/;
export function parseLineNumberSet(directiveLineNumber: number, str: string): Set<number> {
  const result = new Set<number>();
  const parts = str.split(',').map(s => s.trim());
  for (const part of parts) {
    const match = RE_RANGE.exec(part);
    if (match) {
      const start = Number(match[1]);
      assertTrue(!Number.isNaN(start));
      const end = Number(match[2]);
      assertTrue(!Number.isNaN(end));
      if (!(start <= end)) {
        throw new UserError(
          `Illegal range: ${stringify(part)}`,
          { lineNumber: directiveLineNumber }
        );
      }
      for (let i = start; i <= end; i++) {
        result.add(i);
      }
    } else if (RE_NUMBER.test(part)) {
      const lineNumber = Number(part);
      assertTrue(!Number.isNaN(lineNumber));
      result.add(lineNumber);
    } else {
      throw new UserError(
        `Illegal format for line numbers: ${stringify(str)}`,
        { lineNumber: directiveLineNumber }
      );
    }
  }
  return result;
}