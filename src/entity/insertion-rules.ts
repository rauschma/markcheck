import { type JsonValue } from '@rauschma/helpers/ts/json.js';
import { InternalError, UserError } from '../util/errors.js';

const {stringify} = JSON;

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

const RE_INS_COND = /^(before|after):(-?[0-9]+)$/;
export abstract class InsertionCondition {
  static parse(str: string): InsertionCondition {
    const match = RE_INS_COND.exec(str);
    if (!match) {
      throw new UserError(`Illegal insertion condition: ${stringify(str)}`);
    }
    const lineNumber = Number(match[2]);
    if (match[1] === 'before') {
      return new InsCondLineNumber(LineLocModifier.Before, lineNumber);
    } else if (match[1] === 'after') {
      return new InsCondLineNumber(LineLocModifier.After, lineNumber);
    } else {
      throw new InternalError();
    }
  }
  abstract matches(modifier: LineLocModifier, lastLineNumber: number, curLineNumber: number, line: string): boolean;
  abstract toJson(): JsonValue;
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
    return lineLocationModifierToString(this.modifier) + ':' + this.lineNumber;
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
    throw new UserError(
      `Line number must with range [1, ${lastLineNumber}] (-1 means ${lastLineNumber} etc.): ${lineNumber}`
    );
  }
  return posLineNumber;
}
