import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { type JsonValue } from '@rauschma/helpers/ts/json.js';
import { assertNonNullable } from '@rauschma/helpers/ts/type.js';
import { InternalError, UserError, contextLineNumber, type UserErrorContext } from '../util/errors.js';
import { trimTrailingEmptyLines } from '../util/string.js';
import { ATTR_KEY_AT, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_INSERT, type Directive } from './directive.js';
import { InsertionRules, InsertionCondition, parseInsertionConditions } from './insertion-rules.js';

const {stringify} = JSON;

//#################### Constants ####################

const RE_AROUND_MARKER = /^[ \t]*•••[ \t]*$/;
const STR_AROUND_MARKER = '•••';

export type LineModKind = LineModKindConfig |
  LineModKindGlobal |
  LineModKindApplicable |
  LineModKindLocal;
export type LineModKindConfig = {
  tag: 'LineModKindConfig';
};
export type LineModKindGlobal = {
  tag: 'LineModKindGlobal';
  targetLanguage: string;
};
export type LineModKindApplicable = {
  tag: 'LineModKindApplicable';
  id: string;
};
export type LineModKindLocal = {
  tag: 'LineModKindLocal';
};

//#################### LineMod ####################

export class LineMod {
  static parse(directive: Directive, kind: LineModKind): LineMod {
    const insertionRules = new InsertionRules();
    let beforeLines = new Array<string>();
    let afterLines = new Array<string>();

    const body = trimTrailingEmptyLines(directive.body.slice());

    switch (directive.bodyLabel) {
      case BODY_LABEL_BEFORE: {
        beforeLines = body;
        break;
      }
      case BODY_LABEL_AFTER: {
        afterLines = body;
        break;
      }
      case BODY_LABEL_AROUND: {
        ({ beforeLines, afterLines } = splitAroundLines(body));
        break;
      }
      case BODY_LABEL_INSERT: {
        if (kind.tag !== 'LineModKindLocal') {
          throw new UserError(
            `Body label ${stringify(BODY_LABEL_INSERT)} is only allowed for local line mods`
          );
        }

        const atStr = directive.getString(ATTR_KEY_AT);
        if (atStr === null) {
          throw new UserError(
            `Directive has the body label ${stringify(BODY_LABEL_INSERT)} but not attribute ${stringify(ATTR_KEY_AT)}`,
            { lineNumber: directive.lineNumber }
          );
        }
        const conditions = parseInsertionConditions(atStr);
        const lineGroups = splitInsertedLines(body);
        if (conditions.length !== lineGroups.length) {
          throw new UserError(
            `Attribute ${stringify(ATTR_KEY_AT)} mentions ${conditions.length} condition(s) but the body after ${stringify(BODY_LABEL_INSERT)} has ${lineGroups.length} line group(s) (separated by ${stringify(STR_AROUND_MARKER)})`,
            { lineNumber: directive.lineNumber }
          );
        }
        for (const [index, condition] of conditions.entries()) {
          const lineGroup = lineGroups[index];
          assertNonNullable(lineGroup);
          insertionRules.pushRule({ condition, lineGroup });
        }
        break;
      }
      default:
        throw new InternalError();
    }
    return new LineMod(
      contextLineNumber(directive.lineNumber),
      kind,
      insertionRules,
      beforeLines,
      afterLines
    );

    function splitAroundLines(lines: Array<string>): { beforeLines: Array<string>; afterLines: Array<string>; } {
      const markerIndex = lines.findIndex(line => RE_AROUND_MARKER.test(line));
      if (markerIndex < 0) {
        throw new UserError(`Missing around marker ${STR_AROUND_MARKER} in ${BODY_LABEL_AROUND} body`, { lineNumber: directive.lineNumber });
      }
      return {
        beforeLines: lines.slice(0, markerIndex),
        afterLines: lines.slice(markerIndex + 1),
      };
    }
    function splitInsertedLines(lines: Array<string>): Array<Array<string>> {
      const result: Array<Array<string>> = [[]];
      for (const line of lines) {
        if (RE_AROUND_MARKER.test(line)) {
          result.push([]);
        } else {
          const lastLineGroup = result.at(-1);
          assertNonNullable(lastLineGroup);
          lastLineGroup.push(line);
        }
      }
      return result;
    }
  }
  static fromBeforeLines(context: UserErrorContext, kind: LineModKind, beforeLines: Array<string>) {
    return new LineMod(context, kind, new InsertionRules(), beforeLines, []);
  }

  context: UserErrorContext;
  #kind: LineModKind;
  insertionRules: InsertionRules;
  #beforeLines: Array<string>;
  #afterLines: Array<string>;

  private constructor(context: UserErrorContext, kind: LineModKind, insertedLines: InsertionRules, beforeLines: Array<string>, afterLines: Array<string>) {
    this.context = context;
    this.#kind = kind;
    this.insertionRules = insertedLines;
    this.#beforeLines = beforeLines;
    this.#afterLines = afterLines;
  }
  get id(): undefined | string {
    switch (this.#kind.tag) {
      case 'LineModKindApplicable':
        return this.#kind.id;
      case 'LineModKindGlobal':
        return undefined;
      case 'LineModKindConfig':
      case 'LineModKindLocal':
        throw new InternalError('Unsupported operation');
      default:
        throw new UnsupportedValueError(this.#kind);
    }
  }
  get targetLanguage(): undefined | string {
    switch (this.#kind.tag) {
      case 'LineModKindGlobal':
        return this.#kind.targetLanguage;
      case 'LineModKindApplicable':
        return undefined;
      case 'LineModKindConfig':
      case 'LineModKindLocal':
        throw new InternalError('Unsupported operation');
      default:
        throw new UnsupportedValueError(this.#kind);
    }
  }
  pushBeforeLines(lines: Array<string>): void {
    lines.push(...this.#beforeLines);
  }
  pushAfterLines(lines: Array<string>): void {
    lines.push(...this.#afterLines);
  }
  toJson(): JsonValue {
    let props;
    switch (this.#kind.tag) {
      case 'LineModKindGlobal':
        props = {
          targetLanguage: this.#kind.targetLanguage,
        };
        break;
      case 'LineModKindApplicable':
        props = {
          id: this.#kind.id,
        };
        break;
      case 'LineModKindConfig':
        props = {};
        break;
      case 'LineModKindLocal':
        props = {
          insertionRules: this.insertionRules.toJson(),
        };
        break;
      default:
        throw new UnsupportedValueError(this.#kind);
    }
    return {
      beforeLines: this.#beforeLines,
      afterLines: this.#afterLines,
      ...props,
    };
  }
}
