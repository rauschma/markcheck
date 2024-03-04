import { re } from '@rauschma/helpers/template-tag/re-template-tag.js';
import { type JsonValue } from '@rauschma/helpers/ts/json.js';
import { assertNonNullable } from '@rauschma/helpers/ts/type.js';
import { InternalError, MarktestSyntaxError, type EntityContext } from '../util/errors.js';
import { ATTR_KEY_AT } from './directive.js';
import { insertParsingPos, unescapeBackslashes } from './entity-helpers.js';
import { KEY_LINE_NUMBER, KEY_TEXT_FRAGMENT, RE_LINE_LOC, ensurePositiveLineNumber } from './line-loc-set.js';

const { stringify } = JSON;

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

  maybePushLineGroup(entityContext: EntityContext, modifier: LineLocModifier, lastLineNumber: number, curLineNumber: number, line: string, linesOut: Array<string>): void {
    const lineGroup = this.#getLineGroup(entityContext, modifier, lastLineNumber, curLineNumber, line);
    if (lineGroup) {
      linesOut.push(...lineGroup);
    }
  }
  #getLineGroup(entityContext: EntityContext, modifier: LineLocModifier, lastLineNumber: number, curLineNumber: number, line: string): null | Array<string> {
    for (const rule of this.#rules) {
      if (rule.condition.matches(entityContext, modifier, lastLineNumber, curLineNumber, line)) {
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

const RE_PART = re`/(?<modifier>before|after):${RE_LINE_LOC}(?<comma>\s*,\s*)?/uy`;

export function parseInsertionConditions(directiveLineNumber: number, str: string): Array<InsertionCondition> {
  const result = new Array<InsertionCondition>();
  RE_PART.lastIndex = 0;
  // Using `true` as `while` condition would make trailing commas illegal
  while (RE_PART.lastIndex < str.length) {
    const lastIndex = RE_PART.lastIndex;
    const match = RE_PART.exec(str);
    if (!match) {
      throw new MarktestSyntaxError(
        `Could not parse insertion conditions (attribute ${stringify(ATTR_KEY_AT)}): ${insertParsingPos(str, lastIndex)}`,
        {lineNumber: directiveLineNumber}
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
    if (match.groups[KEY_LINE_NUMBER] !== undefined) {
      const lineNumber = Number(match.groups[KEY_LINE_NUMBER]);
      result.push(new InsCondLineNumber(modifier, lineNumber));
    } else if (match.groups[KEY_TEXT_FRAGMENT] !== undefined) {
      const textFragment = unescapeBackslashes(match.groups[KEY_TEXT_FRAGMENT]);
      result.push(new InsCondTextFragment(modifier, textFragment));
    } else {
      throw new InternalError();
    }
    if (match.groups.comma === undefined) {
      // The separating comma can only be omitted at the end
      if (RE_PART.lastIndex >= str.length) {
        break;
      }
      throw new MarktestSyntaxError(
        `Expected a comma after an insertion condition (attribute ${stringify(ATTR_KEY_AT)}): ${insertParsingPos(str, RE_PART.lastIndex)}`,
        {lineNumber: directiveLineNumber}
      );
    }
  }
  return result;
}

export function insertionConditionsToJson(conditions: Array<InsertionCondition>): JsonValue {
  return conditions.map(c => c.toJson());
}

export abstract class InsertionCondition {
  abstract matches(entityContext: EntityContext, modifier: LineLocModifier, lastLineNumber: number, curLineNumber: number, _line: string): boolean;
  abstract toJson(): JsonValue;
}

//========== InsCondTextFragment ==========

class InsCondTextFragment extends InsertionCondition {
  constructor(public modifier: LineLocModifier, public textFragment: string) {
    super();
  }
  override matches(_entityContext: EntityContext, modifier: LineLocModifier, _lastLineNumber: number, _curLineNumber: number, line: string): boolean {
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
  override matches(entityContext: EntityContext, modifier: LineLocModifier, lastLineNumber: number, curLineNumber: number, _line: string): boolean {
    return (
      modifier === this.modifier &&
      curLineNumber === ensurePositiveLineNumber(entityContext, lastLineNumber, this.lineNumber, ATTR_KEY_AT)
    );
  }
  override toJson(): JsonValue {
    return {
      modifier: lineLocationModifierToString(this.modifier),
      lineNumber: this.lineNumber,
    };
  }
}
