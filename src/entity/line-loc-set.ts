import { re } from '@rauschma/helpers/template-tag/re-template-tag.js';
import { UnsupportedValueError } from '@rauschma/helpers/typescript/error.js';
import { assertNonNullable } from '@rauschma/helpers/typescript/type.js';
import { InternalError, MarkcheckSyntaxError, type EntityContext } from '../util/errors.js';
import { ATTR_KEY_IGNORE_LINES } from './directive.js';
import { insertParsingPos, stringifyWithSingleQuote, unescapeBackslashes } from './entity-helpers.js';

const { stringify } = JSON;

export type LineLocSet = Array<LineLocSetElement>;
export type LineLocSetElement = LineLoc | LineRange;
export type LineLoc = {
  kind: 'LineLoc',
  loc: number | string,
};
export type LineRange = {
  kind: 'LineRange',
  start: LineLoc,
  end: LineLoc,
};
function lineRangeToString(lineRange: LineRange): string {
  const start = lineLocToString(lineRange.start);
  const end = lineLocToString(lineRange.end);
  return `${start}${STR_RANGE_SEPARATOR}${end}`;
}
function lineLocToString(lineLoc: LineLoc) {
  if (typeof lineLoc.loc === 'number') {
    return String(lineLoc.loc);
  } else if (typeof lineLoc.loc === 'string') {
    return stringifyWithSingleQuote(lineLoc.loc);
  } else {
    throw new UnsupportedValueError(lineLoc.loc);
  }
}

export const KEY_LINE_NUMBER = 'lineNumber';
const RE_LINE_NUMBER = re`/(?<${KEY_LINE_NUMBER}>-?[0-9]+)/`;
export const KEY_TEXT_FRAGMENT = 'textFragment';
const RE_TEXT_FRAGMENT = re`/'(?<${KEY_TEXT_FRAGMENT}>(\\.|[^'])*)'/`;
export const RE_LINE_LOC = re`(${RE_LINE_NUMBER}|${RE_TEXT_FRAGMENT})`;

export const KEY_LINE_NUMBER2 = 'lineNumber2';
const RE_LINE_NUMBER2 = re`/(?<${KEY_LINE_NUMBER2}>-?[0-9]+)/`;
export const KEY_TEXT_FRAGMENT2 = 'textFragment2';
const RE_TEXT_FRAGMENT2 = re`/'(?<${KEY_TEXT_FRAGMENT2}>(\\.|[^'])*)'/`;
export const RE_LINE_LOC2 = re`(${RE_LINE_NUMBER2}|${RE_TEXT_FRAGMENT2})`;

const STR_RANGE_SEPARATOR = '..';
const RE_ELEMENT = re`/${RE_LINE_LOC}(\s*\.\.\s*${RE_LINE_LOC2})?(?<comma>\s*,\s*)?/uy`;

export function parseLineLocSet(directiveLineNumber: number, str: string): LineLocSet {
  const result = new Array<LineLocSetElement>();
  RE_ELEMENT.lastIndex = 0;
  // Using `true` as `while` condition would make trailing commas illegal
  while (RE_ELEMENT.lastIndex < str.length) {
    const lastIndex = RE_ELEMENT.lastIndex;
    const match = RE_ELEMENT.exec(str);
    if (!match) {
      throw new MarkcheckSyntaxError(
        `Could not parse line location set (attribute ${stringify(ATTR_KEY_IGNORE_LINES)}): ${insertParsingPos(str, lastIndex)}`,
        { lineNumber: directiveLineNumber }
      );
    }
    assertNonNullable(match.groups);

    const loc = extractLineLoc(match, KEY_LINE_NUMBER, KEY_TEXT_FRAGMENT);
    // The properties always exist but their values may be `undefined`
    if (match.groups[KEY_LINE_NUMBER2] !== undefined || match.groups[KEY_TEXT_FRAGMENT2] !== undefined) {
      const loc2 = extractLineLoc(match, KEY_LINE_NUMBER2, KEY_TEXT_FRAGMENT2);
      result.push({
        kind: 'LineRange',
        start: loc,
        end: loc2,
      });
    } else {
      result.push(loc);
    }

    if (match.groups.comma === undefined) {
      // The separating comma can only be omitted at the end
      if (RE_ELEMENT.lastIndex >= str.length) {
        break;
      }
      throw new MarkcheckSyntaxError(
        `Expected a comma after an insertion condition (attribute ${stringify(ATTR_KEY_IGNORE_LINES)}): ${insertParsingPos(str, RE_ELEMENT.lastIndex)}`,
        { lineNumber: directiveLineNumber }
      );
    }
  }
  return result;

  function extractLineLoc(match: RegExpExecArray, keyLineNumber: string, keyTextFragment: string): LineLoc {
    assertNonNullable(match.groups);
    if (match.groups[keyLineNumber] !== undefined) {
      return {
        kind: 'LineLoc',
        loc: Number(match.groups[keyLineNumber]),
      };
    } else if (match.groups[keyTextFragment] !== undefined) {
      return {
        kind: 'LineLoc',
        loc: unescapeBackslashes(match.groups[keyTextFragment]),
      };
    } else {
      throw new InternalError();
    }
  }
}

export function lineLocSetToLineNumberSet(entityContext: EntityContext, lineLocSet: LineLocSet, lines: Array<string>): Set<number> {
  const result = new Set<number>();
  for (const elem of lineLocSet) {
    if (elem.kind === 'LineLoc') {
      result.add(lineLocToPositiveLineNumber(entityContext, lines, elem));
    } else if (elem.kind === 'LineRange') {
      const start = lineLocToPositiveLineNumber(entityContext, lines, elem.start);
      const end = lineLocToPositiveLineNumber(entityContext, lines, elem.end);
      if (!(start <= end || start < 1 || end > lines.length)) {
        throw new MarkcheckSyntaxError(
          `Illegal range (attribute ${stringify(ATTR_KEY_IGNORE_LINES)}): ${lineRangeToString(elem)}`,
          { entityContext }
        );
      }
      for (let i = start; i <= end; i++) {
        result.add(i);
      }
    } else {
      throw new UnsupportedValueError(elem);
    }
  }
  return result;
}

function lineLocToPositiveLineNumber(entityContext: EntityContext, lines: Array<string>, lineLoc: LineLoc): number {
  if (typeof lineLoc.loc === 'number') {
    return ensurePositiveLineNumber(entityContext, lines.length, lineLoc.loc, ATTR_KEY_IGNORE_LINES);
  } else if (typeof lineLoc.loc === 'string') {
    const loc = lineLoc.loc;
    const index = lines.findIndex(line => line.includes(loc));
    if (index < 0) {
      throw new MarkcheckSyntaxError(
        `Could not find text fragment in lines (attribute ${stringify(ATTR_KEY_IGNORE_LINES)}): ${stringify(lineLoc.loc)}`,
        { entityContext }
      );
    }
    return index + 1;
  } else {
    throw new UnsupportedValueError(lineLoc.loc);
  }
}

//#################### Helpers ####################

export function ensurePositiveLineNumber(entityContext: EntityContext, lastLineNumber: number, origLineNumber: number, attrKey: string): number {
  let posLineNumber = origLineNumber;
  if (posLineNumber < 0) {
    // * -1 is the last line number
    // * -2 is the second-to-last line number
    // * Etc.
    posLineNumber = lastLineNumber + posLineNumber + 1;
  }
  if (!(1 <= posLineNumber && posLineNumber <= lastLineNumber)) {
    // FIXME: mention attribute key and line number
    throw new MarkcheckSyntaxError(
      `Line number must be within the range [1, ${lastLineNumber}]. -1 means ${lastLineNumber} etc. (attribute ${stringify(attrKey)}): ${origLineNumber}`,
      { entityContext }
    );
  }
  return posLineNumber;
}
