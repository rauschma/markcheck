import { re } from '@rauschma/helpers/template-tag/re-template-tag.js';
import { type JsonValue } from '@rauschma/helpers/ts/json.js';
import { assertNonNullable } from '@rauschma/helpers/ts/type.js';
import { InternalError, MarktestSyntaxError } from '../util/errors.js';
import { insertParsingPos, unescapeBackslashes } from './entity-helpers.js';

export enum LineLocModifier {
  Before = 'Before',
  After = 'After',
}

function lineLocationModifierToString(modifier: LineLocModifier): string {
  return modifier;
}

//#################### InsertionRules ####################

export class InsertionRules {
  #rules = new Array<InsertionRule>();

  toJson(): JsonValue {
    return this.#rules.map(
      rule => [rule.condition.toJson(), rule.lineGroup]
    );
  }

  pushRule(insertionRule: InsertionRule): void {
    this.#rules.push(insertionRule);
  }

  maybePushLineGroup(modifier: LineLocModifier, lastLineNumber: number, curLineNumber: number, line: string, linesOut: Array<string>): void {
    const lineGroup = this.#getLineGroup(modifier, lastLineNumber, curLineNumber, line);
    if (lineGroup) {
      linesOut.push(...lineGroup);
    }
  }
  #getLineGroup(modifier: LineLocModifier, lastLineNumber: number, curLineNumber: number, line: string): null | Array<string> {
    for (const rule of this.#rules) {
      if (rule.condition.matches(modifier, lastLineNumber, curLineNumber, line)) {
        return rule.lineGroup;
      }
    }
    return null;
  }
}

export type InsertionRule = {
  condition: InsertionCondition;
  lineGroup: Array<string>;
};

//#################### InsertionCondition ####################

const RE_LINE_NUMBER = /(?<lineNumber>-?[0-9]+)/;
const RE_TEXT_FRAGMENT = /'(?<textFragment>(\\.|[^'])*)'/;
const RE_PART = re`/(?<modifier>before|after):(${RE_LINE_NUMBER}|${RE_TEXT_FRAGMENT})(?<comma>\s*,\s*)?/uy`;

export function parseInsertionConditions(str: string): Array<InsertionCondition> {
  const result = new Array<InsertionCondition>();
  RE_PART.lastIndex = 0;
  while (RE_PART.lastIndex < str.length) { // we allow trailing commas
    const lastIndex = RE_PART.lastIndex;
    const match = RE_PART.exec(str);
    if (!match) {
      throw new MarktestSyntaxError(
        `Could not parse insertion condition: ${insertParsingPos(str, lastIndex)}`
      );
    }
    assertNonNullable(match.groups);
    let modifier;
    switch (match.groups.modifier) {
      case 'before':
        modifier = LineLocModifier.Before;
        break;
      case 'after':
        modifier = LineLocModifier.After;
        break;
      default:
        throw new InternalError();
    }
    if (match.groups.lineNumber !== undefined) {
      const lineNumber = Number(match.groups.lineNumber);
      result.push(new InsCondLineNumber(modifier, lineNumber));
    } else if (match.groups.textFragment !== undefined) {
      const textFragment = unescapeBackslashes(match.groups.textFragment);
      result.push(new InsCondTextFragment(modifier, textFragment));
    } else {
      throw new InternalError();
    }
    if (!('comma' in match.groups)) {
      // If there is no separating comma, we must be at the end
      if (RE_PART.lastIndex >= str.length) {
        break;
      }
      throw new MarktestSyntaxError(
        `Expected a comma after an insertion condition: ${insertParsingPos(str, RE_PART.lastIndex)}`
      );
    }
  }
  return result;
}

export function insertionConditionsToJson(conditions: Array<InsertionCondition>): JsonValue {
  return conditions.map(c => c.toJson());
}

export abstract class InsertionCondition {
  abstract matches(modifier: LineLocModifier, lastLineNumber: number, curLineNumber: number, line: string): boolean;
  abstract toJson(): JsonValue;
}

//========== InsCondTextFragment ==========

class InsCondTextFragment extends InsertionCondition {
  constructor(public modifier: LineLocModifier, public textFragment: string) {
    super();
  }
  override matches(modifier: LineLocModifier, _lastLineNumber: number, _curLineNumber: number, line: string): boolean {
    return (
      modifier === this.modifier &&
      line.includes(this.textFragment)
    );
  }
  override toJson(): JsonValue {
    return {
      modifier: lineLocationModifierToString(this.modifier),
      textFragment: this.textFragment,
    };
  }
}

//========== InsCondLineNumber ==========

class InsCondLineNumber extends InsertionCondition {
  constructor(public modifier: LineLocModifier, public lineNumber: number) {
    super();
  }
  override matches(modifier: LineLocModifier, lastLineNumber: number, curLineNumber: number, _line: string): boolean {
    return (
      modifier === this.modifier &&
      curLineNumber === ensurePositiveLineNumber(lastLineNumber, this.lineNumber)
    );
  }
  override toJson(): JsonValue {
    return {
      modifier: lineLocationModifierToString(this.modifier),
      lineNumber: this.lineNumber,
    };
  }
}

function ensurePositiveLineNumber(lastLineNumber: number, lineNumber: number): number {
  let posLineNumber = lineNumber;
  if (posLineNumber < 0) {
    // * -1 is the last line number
    // * -2 is the second-to-last line number
    // * Etc.
    posLineNumber = lastLineNumber + posLineNumber + 1;
  }
  if (!(1 <= posLineNumber && posLineNumber <= lastLineNumber)) {
    throw new MarktestSyntaxError(
      `Line number must with range [1, ${lastLineNumber}] (-1 means ${lastLineNumber} etc.): ${lineNumber}`
    );
  }
  return posLineNumber;
}
