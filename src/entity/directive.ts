import type { SearchAndReplace } from '@rauschma/helpers/string/escaper.js';
import { re } from '@rauschma/helpers/template-tag/re-template-tag.js';
import { UnsupportedValueError } from '@rauschma/helpers/typescript/error.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/typescript/type.js';
import { InternalError, MarkcheckSyntaxError, type EntityContext, type LineNumber } from '../util/errors.js';

const { stringify } = JSON;
const { raw } = String;

//#################### Constants ####################

const RE_LABEL = /[A-Za-z0-9\-_]+/;

//========== Attribute keys ==========

// Referenced by attributes: external, sameAsId, include, stdout, stderr
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
export const ATTR_KEY_APPLY_TO_BODY = 'applyToBody';
export const ATTR_KEY_APPLY_TO_OUTER = 'applyToOuter';
/** Exclude config lines and language LineMods */
export const ATTR_KEY_RUN_LOCAL_LINES = 'runLocalLines';
export const ATTR_KEY_IGNORE_LINES = 'ignoreLines';
export const ATTR_KEY_SEARCH_AND_REPLACE = 'searchAndReplace';

export const INCL_ID_THIS = '$THIS';

//----- Additional checks -----

export const ATTR_KEY_SAME_AS_ID = 'sameAsId';
export const ATTR_KEY_CONTAINED_IN_FILE = 'containedInFile';

//----- Writing and referring to files -----

export const ATTR_KEY_WRITE_LOCAL = 'writeLocal';
export const ATTR_KEY_WRITE_ALL = 'writeAll';

export const ATTR_KEY_RUN_FILE_NAME = 'runFileName';

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
      throw new MarkcheckSyntaxError(
        `Could not parse value of attribute ${ATTR_KEY_EXTERNAL}: ${JSON.stringify(part)}`,
        { lineNumber }
      );
    }
    const id = match.groups.id ?? null;
    specs.push({ id, fileName: match.groups.fileName });
  }
  return specs;
}

//----- Checking command results -----

export const ATTR_KEY_EXIT_STATUS = 'exitStatus';
export const ATTR_KEY_STDOUT = 'stdout';
export const ATTR_KEY_STDERR = 'stderr';

export type StdStreamContentSpec = {
  lineModId: null | string;
  snippetId: string;
};
const RE_SPEC = re`/^(\|(?<lineModId>${RE_LABEL})=)?(?<snippetId>${RE_LABEL})$/`;
export function parseStdStreamContentSpec(directiveLineNumber: number, attrKey: string, str: string): StdStreamContentSpec {
  const match = RE_SPEC.exec(str);
  if (!match) {
    throw new MarkcheckSyntaxError(
      `Could not parse value of attribute ${stringify(attrKey)}: ${stringify(str)}`,
      {lineNumber: directiveLineNumber}
    );
  }
  assertNonNullable(match.groups);
  assertNonNullable(match.groups.snippetId);
  return {
    lineModId: match.groups.lineModId ?? null,
    snippetId: match.groups.snippetId, // never null
  };
}

//----- Line mods -----

// Language LineMods
export const ATTR_KEY_EACH = 'each';

// Appliable line mods
// - Referenced by attributes: applyInner, applyOuter
export const ATTR_KEY_LINE_MOD_ID = 'lineModId';

// Body label `insert:` (local LineMods only)
export const ATTR_KEY_AT = 'at';

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
export const BODY_LABEL_INSERT = 'insert:'; // local LineMods only

//========== Command variables ==========

export const CMD_VAR_FILE_NAME = '$FILE_NAME';
export const CMD_VAR_ALL_FILE_NAMES = '$ALL_FILE_NAMES';

//#################### Expected attribute values ####################

export const Valueless = Symbol('Valueless');
export enum AttrValue {
  Valueless, String
}
export type ExpectedAttributeValues = Map<string, AttrValue | RegExp>;

export const ATTRS_LOCAL_LM_APPLIABLE_LM: ExpectedAttributeValues = new Map<string, AttrValue | RegExp>([
  [ATTR_KEY_IGNORE_LINES, AttrValue.String],
  [ATTR_KEY_SEARCH_AND_REPLACE, AttrValue.String],
]);

export const ATTRS_SNIPPET: ExpectedAttributeValues = new Map<string, AttrValue | RegExp>([
  // Snippet attributes are fed to local LineMod!
  ...ATTRS_LOCAL_LM_APPLIABLE_LM,
  //
  [ATTR_KEY_ID, AttrValue.String],
  //
  [ATTR_KEY_ONLY, AttrValue.Valueless],
  [ATTR_KEY_SKIP, AttrValue.Valueless],
  [ATTR_ALWAYS_RUN, AttrValue.Valueless],
  //
  [ATTR_KEY_LANG, RE_LANG_VALUE],
  //
  [ATTR_KEY_SEQUENCE, AttrValue.String],
  [ATTR_KEY_INCLUDE, AttrValue.String],
  [ATTR_KEY_APPLY_TO_BODY, AttrValue.String],
  [ATTR_KEY_APPLY_TO_OUTER, AttrValue.String],
  [ATTR_KEY_RUN_LOCAL_LINES, AttrValue.Valueless],
  //
  [ATTR_KEY_SAME_AS_ID, AttrValue.String],
  [ATTR_KEY_CONTAINED_IN_FILE, AttrValue.String],
  //
  [ATTR_KEY_WRITE_LOCAL, AttrValue.String],
  [ATTR_KEY_WRITE_ALL, AttrValue.String],
  [ATTR_KEY_RUN_FILE_NAME, AttrValue.String],
  [ATTR_KEY_EXTERNAL, AttrValue.String],
  //
  [ATTR_KEY_EXIT_STATUS, AttrValue.String],
  [ATTR_KEY_STDOUT, AttrValue.String],
  [ATTR_KEY_STDERR, AttrValue.String],
]);

export const ATTRS_SNIPPET_BODY_LABEL_INSERT: ExpectedAttributeValues = new Map<string, AttrValue | RegExp>([
  ...ATTRS_SNIPPET,
  // Body label `insert:` (only local LineMods and appliable LineMods)
  [ATTR_KEY_AT, AttrValue.String],
]);

export const ATTRS_APPLIABLE_LINE_MOD: ExpectedAttributeValues = new Map([
  ...ATTRS_LOCAL_LM_APPLIABLE_LM,
  [ATTR_KEY_LINE_MOD_ID, AttrValue.String],
]);

export const ATTRS_APPLIABLE_LINE_MOD_BODY_LABEL_INSERT: ExpectedAttributeValues = new Map<string, AttrValue | RegExp>([
  ...ATTRS_APPLIABLE_LINE_MOD,
  // Body label `insert:` (only local LineMods and appliable LineMods)
  [ATTR_KEY_AT, AttrValue.String],
]);

export const ATTRS_LANGUAGE_LINE_MOD: ExpectedAttributeValues = new Map([
  [ATTR_KEY_EACH, AttrValue.String],
]);

export const ATTRS_CONFIG_MOD: ExpectedAttributeValues = new Map([
]);

//#################### Directive ####################

// Attribute values are stored raw – then we can decide in each case how to
// handle backslashes.
// - Use case – body label `insert:`: `at="before:'With \'single\' quotes'"`
// - Use case: `searchAndReplace="/ \/\/ \([A-Z]\)//"`

const MARKTEST_MARKER = 'markcheck';
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
          throw new MarkcheckSyntaxError(
            `Could not parse attributes: Stopped parsing before ${stringify(firstLine.slice(lastIndex))}`,
            { lineNumber }
          );
        }
        break;
      }
      if (directive.bodyLabel !== null) {
        throw new MarkcheckSyntaxError(`Body label ${JSON.stringify(directive.bodyLabel)} must come after all attributes`, { lineNumber });
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
    let result = '<!--markcheck';
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
      throw new MarkcheckSyntaxError(
        `Attribute ${stringify(key)} should be missing or a string but was valueless`
      );
    }
    return value;
  }
  getBoolean(key: string): boolean {
    const value = this.getAttribute(key);
    if (value === undefined) return false;
    if (value === Valueless) return true;
    throw new MarkcheckSyntaxError(
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
        throw new MarkcheckSyntaxError(
          `Unknown directive attribute key ${stringify(k)} (allowed are: ${Array.from(expectedAttributes.keys()).join(', ')})`,
          { lineNumber: this.lineNumber }
        );
      }
      if (expectedValue === AttrValue.Valueless) {
        if (v !== Valueless) {
          throw new MarkcheckSyntaxError(
            `Directive attribute ${stringify(k)} must be valueless`,
            { lineNumber: this.lineNumber }
          );
        }
      } else if (expectedValue === AttrValue.String) {
        if (typeof v !== 'string') {
          throw new MarkcheckSyntaxError(
            `Directive attribute ${stringify(k)} must have a string value`,
            { lineNumber: this.lineNumber }
          );
        }
      } else if (expectedValue instanceof RegExp) {
        if (typeof v !== 'string' || !expectedValue.test(v)) {
          throw new MarkcheckSyntaxError(
            `Directive attribute ${stringify(k)} has an illegal value (must be string and match ${expectedValue})`,
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

//========== SearchAndReplaceSpec ==========

const RE_INNER = /(?:[^/]|\\[/])*/;
const RE_SEARCH_AND_REPLACE = re`/^[/](${RE_INNER})[/](${RE_INNER})[/]([i])?$/`;

/**
 * Example: `"/[⎡⎤]//i"`
 */
export class SearchAndReplaceSpec {
  static fromString(entityContext: EntityContext, str: string): SearchAndReplaceSpec {
    const {search, replace} = parseSearchAndReplaceString(entityContext, str);
    return new SearchAndReplaceSpec(search, replace);
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

export function parseSearchAndReplaceString(entityContext: EntityContext, str: string): SearchAndReplace {
  const match = RE_SEARCH_AND_REPLACE.exec(str);
  if (!match) {
    throw new MarkcheckSyntaxError(
      `Not a valid searchAndReplace string: ${stringify(str)}`,
      { entityContext }
    );
  }
  const search = match[1];
  const replace = match[2].replaceAll(raw`\/`, '/');
  const flags = 'g' + (match[3] ?? '');
  return {
    search: new RegExp(search, flags),
    replace,
  };
}