import { re } from '@rauschma/helpers/js/re-template-tag.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { assertTrue } from '@rauschma/helpers/ts/type.js';
import { InternalError, UserError, type LineNumber, type UserErrorContext } from '../util/errors.js';

const { stringify } = JSON;
const { raw } = String;

//#################### Constants ####################

const RE_LABEL = /[A-Za-z0-9\-_]+/;

//========== Attribute keys ==========

// Used by attributes: stdout, stderr, include, applyInner, applyOuter
export const ATTR_KEY_ID = 'id';

//----- Explicit visitation and running mode -----

export const ATTR_KEY_ONLY = 'only';
export const ATTR_KEY_SKIP = 'skip';
export const ATTR_ALWAYS_RUN = 'alwaysRun';

//----- Language -----

/**
 * Can prevent running!
 * - For body directives
 * - To override defaults from code blocks and `write`
 */
export const ATTR_KEY_LANG = 'lang';

//----- Assembling lines -----

export const ATTR_KEY_SEQUENCE = 'sequence';
export const ATTR_KEY_INCLUDE = 'include';
export const ATTR_KEY_APPLY_INNER = 'applyInner';
export const ATTR_KEY_APPLY_OUTER = 'applyOuter';
/** Exclude config lines and global LineMods */
export const ATTR_KEY_ONLY_LOCAL_LINES = 'onlyLocalLines';
export const ATTR_KEY_IGNORE_LINES = 'ignoreLines';
export const ATTR_KEY_SEARCH_AND_REPLACE = 'searchAndReplace';

//----- Additional checks -----

export const ATTR_KEY_SAME_AS_ID = 'sameAsId';
export const ATTR_KEY_CONTAINED_IN_FILE = 'containedInFile';

//----- Writing and referring to files -----

export const ATTR_KEY_WRITE_INNER = 'writeInner';
export const ATTR_KEY_WRITE_OUTER = 'writeOuter';

export const ATTR_KEY_INTERNAL = 'internal';

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

//----- Checking output -----

export const ATTR_KEY_STDOUT = 'stdout';
export const ATTR_KEY_STDERR = 'stderr';

//----- Line mods -----

// Local LineMods only!
export const ATTR_KEY_AT = 'at';

// Global line mods
export const ATTR_KEY_EACH = 'each';
// Applicable line mods have the attribute `id`

//========== Language constants ==========

// In configurations for language definitions (property values of "lang"
// object).
export const LANG_KEY_EMPTY = '';
export const LANG_SKIP = '[skip]';
export const LANG_ERROR_IF_RUN = '[errorIfRun]';

// Values of property `lang`
export const RE_LANG_VALUE = /^(?!\[).*$/;

//========== Body labels ==========

//----- Self-contained directives -----
export const BODY_LABEL_CONFIG = 'config:';
export const BODY_LABEL_BODY = 'body:';

//----- Line mods -----
export const BODY_LABEL_BEFORE = 'before:';
export const BODY_LABEL_AFTER = 'after:';
export const BODY_LABEL_AROUND = 'around:';
export const BODY_LABEL_INSERT = 'insert:'; // only local LineMods

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
  //
  // Local LineMods only!
  [ATTR_KEY_AT, AttrValue.String],
  //
  [ATTR_KEY_ONLY, AttrValue.Valueless],
  [ATTR_KEY_SKIP, AttrValue.Valueless],
  [ATTR_ALWAYS_RUN, AttrValue.Valueless],
  //
  [ATTR_KEY_LANG, RE_LANG_VALUE],
  //
  [ATTR_KEY_SEQUENCE, AttrValue.String],
  [ATTR_KEY_INCLUDE, AttrValue.String],
  [ATTR_KEY_APPLY_INNER, AttrValue.String],
  [ATTR_KEY_APPLY_OUTER, AttrValue.String],
  [ATTR_KEY_ONLY_LOCAL_LINES, AttrValue.Valueless],
  [ATTR_KEY_IGNORE_LINES, AttrValue.String],
  [ATTR_KEY_SEARCH_AND_REPLACE, AttrValue.String],
  //
  [ATTR_KEY_SAME_AS_ID, AttrValue.String],
  [ATTR_KEY_CONTAINED_IN_FILE, AttrValue.String],
  //
  [ATTR_KEY_WRITE_INNER, AttrValue.String],
  [ATTR_KEY_WRITE_OUTER, AttrValue.String],
  [ATTR_KEY_INTERNAL, AttrValue.String],
  [ATTR_KEY_EXTERNAL, AttrValue.String],
  //
  [ATTR_KEY_STDOUT, AttrValue.String],
  [ATTR_KEY_STDERR, AttrValue.String],
]);

export const GLOBAL_LINE_MOD_ATTRIBUTES: ExpectedAttributeValues = new Map([
  [ATTR_KEY_EACH, AttrValue.String],
]);

export const APPLICABLE_LINE_MOD_ATTRIBUTES: ExpectedAttributeValues = new Map([
  [ATTR_KEY_ID, AttrValue.String],
]);

export const CONFIG_MOD_ATTRIBUTES: ExpectedAttributeValues = new Map([
]);


//#################### Directive ####################

// Attribute values are stored raw – then we can decide in each case how to
// handle backslashes.
// - Use case – body label `insert:`: `at="before:'Don\'t do it!'"`
// - Use case: `searchAndReplace="/ \/\/ \([A-Z]\)//"`

const MARKTEST_MARKER = 'marktest';
const RE_BODY_LABEL = re`/(?<bodyLabel>${RE_LABEL}:)/`;
const RE_QUOTED_VALUE = re`/"(?<value>(\\.|[^"])*)"/`;
const RE_KEY_VALUE = re`/(?<key>${RE_LABEL})([ \t]*=[ \t]*${RE_QUOTED_VALUE})?/`;
const RE_TOKEN = re`/[ \t]+(${RE_BODY_LABEL}|${RE_KEY_VALUE})/uy`;

export class Directive {
  static parse(lineNumber: LineNumber, commentLines: Array<string>): null | Directive {
    let [firstLine, ...remainingLines] = commentLines;
    if (!firstLine.startsWith(MARKTEST_MARKER)) {
      return null;
    }
    // Due to RE_TOKEN:
    // - We need a leading space: That’s why it isn‘t part of
    //   MARKTEST_MARKER.
    // - We don’t want trailing whitespace: Matching should stop at the
    //   very end of the input but RE_TOKEN doesn’t account for trailing
    //   whitespace. That’s why we .trimEnd().
    firstLine = firstLine.slice(MARKTEST_MARKER.length).trimEnd();
    const body = remainingLines;
    const directive = new Directive(lineNumber, body);
    RE_TOKEN.lastIndex = 0;
    while (true) {
      // .lastIndex is reset if there is no match: Save it for later.
      const lastIndex = RE_TOKEN.lastIndex;
      const match = RE_TOKEN.exec(firstLine);
      if (!match) {
        if (lastIndex !== firstLine.length) {
          throw new UserError(
            `Could not parse attributes: Stopped parsing before ${stringify(firstLine.slice(lastIndex))}`,
            { lineNumber }
          );
        }
        break;
      }
      if (directive.bodyLabel !== null) {
        throw new UserError(`Body label ${JSON.stringify(directive.bodyLabel)} must come after all attributes`, { lineNumber });
      }
      assertTrue(match.groups !== undefined);
      if (match.groups.key) {
        if (match.groups.value !== undefined) {
          directive.setAttribute(
            match.groups.key,
            match.groups.value
          );
        } else {
          directive.setAttribute(match.groups.key, Valueless);
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
  toJson() {
    return {
      lineNumber: this.lineNumber,
      attributes: Object.fromEntries(
        Array.from(
          this.#attributes,
          ([k, v]) => [k, (v === Valueless ? null : v)]
        )
      ),
      bodyLabel: this.bodyLabel,
      body: this.body,
    };
  }
  toString(): string {
    let result = '<!--marktest';
    for (const [k, v] of this.#attributes) {
      if (v === Valueless) {
        result += ' ' + k;
      } else {
        result += ` ${k}=${stringify(v)}`;
      }
    }
    if (this.bodyLabel) {
      result += this.bodyLabel;
      result += '\n';
      for (const line of this.body) {
        result += line;
        result += '\n';
      }
    }
    result += '-->';
    return result;
  }
  setAttribute(key: string, value: typeof Valueless | string): void {
    this.#attributes.set(key, value);
  }
  getAttribute(key: string): undefined | typeof Valueless | string {
    return this.#attributes.get(key);
  }
  getString(key: string): null | string {
    const value = this.getAttribute(key) ?? null;
    if (value === Valueless) {
      throw new UserError(
        `Attribute ${stringify(key)} should be missing or a string but was valueless`
      );
    }
    return value;
  }
  getBoolean(key: string): boolean {
    const value = this.getAttribute(key);
    if (value === undefined) return false;
    if (value === Valueless) return true;
    throw new UserError(
      `Attribute ${stringify(key)} should be missing or valueless but was ${stringify(value)}`
    );
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

//#################### Helpers ####################

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

//========== SearchAndReplaceSpec ==========

const RE_INNER = /(?:[^/]|\\[/])*/;
const RE_SEARCH_AND_REPLACE = re`/^[/](${RE_INNER})[/](${RE_INNER})[/]([i])?$/`;

/**
 * Example: `"/[⎡⎤]//i"`
 */
export class SearchAndReplaceSpec {
  static fromString(context: UserErrorContext, str: string): SearchAndReplaceSpec {
    const match = RE_SEARCH_AND_REPLACE.exec(str);
    if (!match) {
      throw new UserError(
        `Not a valid searchAndReplace string: ${stringify(str)}`,
        { context }
      );
    }
    const search = match[1];
    const replace = match[2].replaceAll(raw`\/`, '/');
    const flags = 'g' + (match[3] ?? '');
    return new SearchAndReplaceSpec(new RegExp(search, flags), replace);
  }
  #search;
  #replace;
  private constructor(search: RegExp, replace: string) {
    this.#search = search;
    this.#replace = replace;
  }
  toString(): string {
    // Stringification of RegExp automatically escapes slashes
    const searchNoFlags = new RegExp(this.#search, '').toString();
    const escapedReplace = this.#replace.replaceAll('/', String.raw`\/`);
    const flags = this.#search.flags.slice(1); // remove 'g'
    return searchNoFlags + escapedReplace + '/' + flags;
  }
  replaceAll(str: string): string {
    return str.replaceAll(this.#search, this.#replace);
  }
}