import { type JsonValue } from '@rauschma/helpers/ts/json.js';
import { InternalError, UserError } from '../util/errors.js';

const {stringify} = JSON;

export type InsertionRule = {
  condition: InsertionCondition;
  lineGroup: Array<string>;
};

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
  pushBeforeLine(lastLineNumber: number, curLineNumber: number, linesOut: Array<string>): void {
    const lineGroup = this.#getLineGroupBefore(lastLineNumber, curLineNumber);
    if (lineGroup) {
      linesOut.push(...lineGroup);
    }
  }
  pushAfterLine(lastLineNumber: number, curLineNumber: number, linesOut: Array<string>): void {
    const lineGroup = this.#getLineGroupAfter(lastLineNumber, curLineNumber);
    if (lineGroup) {
      linesOut.push(...lineGroup);
    }
  }
  pushBeforeLines(lastLineNumber: number, curLineNumbers: Set<number>, linesOut: Array<string>): void {
    for (const curLineNumber of curLineNumbers) {
      const lineGroup = this.#getLineGroupBefore(lastLineNumber, curLineNumber);
      if (lineGroup) {
        linesOut.push(...lineGroup);
        return;
      }
    }
  }
  pushAfterLines(lastLineNumber: number, curLineNumbers: Set<number>, linesOut: Array<string>): void {
    for (const curLineNumber of curLineNumbers) {
      const lineGroup = this.#getLineGroupAfter(lastLineNumber, curLineNumber);
      if (lineGroup) {
        linesOut.push(...lineGroup);
        return;
      }
    }
  }
  #getLineGroupBefore(lastLineNumber: number, curLineNumber: number): null | Array<string> {
    for (const rule of this.#rules) {
      if (rule.condition.matchesBefore(lastLineNumber, curLineNumber)) {
        return rule.lineGroup;
      }
    }
    return null;
  }
  #getLineGroupAfter(lastLineNumber: number, curLineNumber: number): null | Array<string> {
    for (const rule of this.#rules) {
      if (rule.condition.matchesAfter(lastLineNumber, curLineNumber)) {
        return rule.lineGroup;
      }
    }
    return null;
  }
}
const RE_INS_COND = /^(before|after):(-?[0-9]+)$/;
export abstract class InsertionCondition {
  static parse(str: string): InsertionCondition {
    const match = RE_INS_COND.exec(str);
    if (!match) {
      throw new UserError(`Illegal insertion condition: ${stringify(str)}`);
    }
    const lineNumber = Number(match[2]);
    if (match[1] === 'before') {
      return new InsCondBefore(lineNumber);
    } else if (match[1] === 'after') {
      return new InsCondAfter(lineNumber);
    } else {
      throw new InternalError();
    }
  }
  matchesBefore(_lastLineNumber: number, _curLineNumber: number): boolean {
    return false;
  }
  matchesAfter(_lastLineNumber: number, _curLineNumber: number): boolean {
    return false;
  }
  abstract toJson(): JsonValue;
}
class InsCondBefore extends InsertionCondition {
  constructor(public lineNumber: number) {
    super();
  }
  override matchesBefore(lastLineNumber: number, curLineNumber: number): boolean {
    return curLineNumber === ensurePositiveLineNumber(lastLineNumber, this.lineNumber);
  }
  override toJson(): JsonValue {
    return 'before:' + this.lineNumber;
  }
}
class InsCondAfter extends InsertionCondition {
  constructor(public lineNumber: number) {
    super();
  }
  override matchesAfter(lastLineNumber: number, curLineNumber: number): boolean {
    return curLineNumber === ensurePositiveLineNumber(lastLineNumber, this.lineNumber);
  }
  override toJson(): JsonValue {
    return 'after:' + this.lineNumber;
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
