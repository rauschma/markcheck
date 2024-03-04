import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { type JsonValue } from '@rauschma/helpers/ts/json.js';
import { assertNonNullable, type PublicDataProperties } from '@rauschma/helpers/ts/type.js';
import type { Translator } from '../translation/translation.js';
import { contextLineNumber, InternalError, MarktestSyntaxError, type EntityContext } from '../util/errors.js';
import { trimTrailingEmptyLines } from '../util/string.js';
import { ATTR_KEY_AT, ATTR_KEY_IGNORE_LINES, ATTR_KEY_SEARCH_AND_REPLACE, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_INSERT, SearchAndReplaceSpec, type Directive } from './directive.js';
import { parseLineLocSet, type LineLocSet, lineLocSetToLineNumberSet } from './line-loc-set.js';
import { InsertionRules, LineLocModifier, parseInsertionConditions } from './insertion-rules.js';

const { stringify } = JSON;

//#################### Constants ####################

const RE_AROUND_MARKER = /^[ \t]*•••[ \t]*$/;
const STR_AROUND_MARKER = '•••';

export type LineModKind = LineModKindConfig |
  LineModKindGlobal |
  LineModKindAppliable |
  LineModKindLocal;
export type LineModKindConfig = {
  tag: 'LineModKindConfig';
};
export type LineModKindGlobal = {
  tag: 'LineModKindGlobal';
  targetLanguage: string;
};
export type LineModKindAppliable = {
  tag: 'LineModKindAppliable';
  lineModId: string;
};
export type LineModKindLocal = {
  tag: 'LineModKindLocal';
};

//#################### LineMod ####################

type LineModProps = PublicDataProperties<LineMod>;
function emptyLineModProps(context: EntityContext): LineModProps {
  return {
    context,
    //
    ignoreLines: [],
    searchAndReplace: null,
    //
    insertionRules: new InsertionRules,
    beforeLines: [],
    afterLines: []
  };
}

export class LineMod {
  static parse(directive: Directive, kind: LineModKind): LineMod {
    const context = contextLineNumber(directive.lineNumber);
    const props = emptyLineModProps(context);

    const ignoreLinesStr = directive.getString(ATTR_KEY_IGNORE_LINES);
    if (ignoreLinesStr) {
      props.ignoreLines = parseLineLocSet(directive.lineNumber, ignoreLinesStr);
    }
    const searchAndReplaceStr = directive.getString(ATTR_KEY_SEARCH_AND_REPLACE);
    if (searchAndReplaceStr) {
      props.searchAndReplace = SearchAndReplaceSpec.fromString(
        context, searchAndReplaceStr
      );
    }

    const body = trimTrailingEmptyLines(directive.body.slice());
    switch (directive.bodyLabel) {
      case null:
        // No body label – e.g.: <!--marktest ignoreLines="1-3, 5"-->
        break;
      case BODY_LABEL_BEFORE: {
        props.beforeLines = body;
        break;
      }
      case BODY_LABEL_AFTER: {
        props.afterLines = body;
        break;
      }
      case BODY_LABEL_AROUND: {
        const l = splitAroundLines(directive.lineNumber, body);
        props.beforeLines = l.beforeLines;
        props.afterLines = l.afterLines;
        break;
      }
      case BODY_LABEL_INSERT: {
        if (kind.tag !== 'LineModKindLocal') {
          throw new MarktestSyntaxError(
            `Body label ${stringify(BODY_LABEL_INSERT)} is only allowed for local line mods`
          );
        }

        const atStr = directive.getString(ATTR_KEY_AT);
        if (atStr === null) {
          throw new MarktestSyntaxError(
            `Directive has the body label ${stringify(BODY_LABEL_INSERT)} but not attribute ${stringify(ATTR_KEY_AT)}`,
            { lineNumber: directive.lineNumber }
          );
        }
        const conditions = parseInsertionConditions(directive.lineNumber, atStr);
        const lineGroups = splitInsertedLines(body);
        if (conditions.length !== lineGroups.length) {
          throw new MarktestSyntaxError(
            `Attribute ${stringify(ATTR_KEY_AT)} mentions ${conditions.length} condition(s) but the body after ${stringify(BODY_LABEL_INSERT)} has ${lineGroups.length} line group(s) (separated by ${stringify(STR_AROUND_MARKER)})`,
            { lineNumber: directive.lineNumber }
          );
        }
        for (const [index, condition] of conditions.entries()) {
          const lineGroup = lineGroups[index];
          assertNonNullable(lineGroup);
          props.insertionRules.pushRule({ condition, lineGroup });
        }
        break;
      }
      default:
        throw new InternalError();
    }
    return new LineMod(kind, props);
  }
  static fromBeforeLines(context: EntityContext, kind: LineModKind, beforeLines: Array<string>) {
    return new LineMod(kind, {
      ...emptyLineModProps(context),
      beforeLines,
    });
  }

  #kind: LineModKind;

  /**
   * LineMods can be created from line in Config. Then they don’t have a
   * line number. Thus, the more general UserErrorContext is needed.
   */
  context: EntityContext;
  //
  ignoreLines: LineLocSet;
  searchAndReplace: null | SearchAndReplaceSpec;
  //
  insertionRules: InsertionRules;
  beforeLines: Array<string>;
  afterLines: Array<string>;

  private constructor(kind: LineModKind, props: LineModProps) {
    this.#kind = kind;
    this.context = props.context;
    //
    this.ignoreLines = props.ignoreLines;
    this.searchAndReplace = props.searchAndReplace;
    //
    this.insertionRules = props.insertionRules;
    this.beforeLines = props.beforeLines;
    this.afterLines = props.afterLines;
  }
  getLineModId(): undefined | string {
    switch (this.#kind.tag) {
      case 'LineModKindAppliable':
        return this.#kind.lineModId;
      case 'LineModKindGlobal':
        return undefined;
      // Not among entities
      case 'LineModKindConfig': // created on-demand from Config
      case 'LineModKindLocal': // inside a SingleSnippet
        throw new InternalError('Unsupported operation');
      default:
        throw new UnsupportedValueError(this.#kind);
    }
  }
  getTargetLanguage(): undefined | string {
    switch (this.#kind.tag) {
      case 'LineModKindGlobal':
        return this.#kind.targetLanguage;
      case 'LineModKindAppliable':
        return undefined;
      // Not among entities
      case 'LineModKindConfig': // created on-demand from Config
      case 'LineModKindLocal': // inside a SingleSnippet
        throw new InternalError('Unsupported operation');
      default:
        throw new UnsupportedValueError(this.#kind);
    }
  }

  pushModifiedBodyTo(lineNumber: number, body: Array<string>, translator: Translator | undefined, linesOut: Array<string>) {
    // - Line-ignoring clashes with line insertion because both change line
    //   indices.
    // - However, ignored line numbers would make no sense at all after
    //   inserting lines, which is why ignore first.
    const lineNumberSet = lineLocSetToLineNumberSet(this.context, this.ignoreLines, body);
    body = body.filter(
      (_line, index) => !lineNumberSet.has(index + 1)
    );

    // We only search-and-replace in visible (non-inserted) lines because
    // we can do whatever we want in invisible lines.
    const sar = this.searchAndReplace;
    if (sar) {
      body = body.map(
        line => sar.replaceAll(line)
      );
    }

    {
      const nextBody = new Array<string>();
      for (const [index, line] of body.entries()) {
        this.insertionRules.maybePushLineGroup(this.context, LineLocModifier.Before, body.length, index + 1, line, nextBody);
        nextBody.push(line);
        this.insertionRules.maybePushLineGroup(this.context, LineLocModifier.After, body.length, index + 1, line, nextBody);
      }
      body = nextBody;
    }

    if (translator) {
      body = translator.translate(lineNumber, body);
    }

    linesOut.push(...this.beforeLines);
    linesOut.push(...body);
    linesOut.push(...this.afterLines);
  }

  pushBeforeLines(lines: Array<string>): void {
    lines.push(...this.beforeLines);
  }
  pushAfterLines(lines: Array<string>): void {
    lines.push(...this.afterLines);
  }

  toJson(): JsonValue {
    let props;
    switch (this.#kind.tag) {
      case 'LineModKindGlobal':
        props = {
          targetLanguage: this.#kind.targetLanguage,
        };
        break;
      case 'LineModKindAppliable':
        props = {
          lineModId: this.#kind.lineModId,
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
      beforeLines: this.beforeLines,
      afterLines: this.afterLines,
      ...props,
    };
  }
}

//#################### Helpers ####################

export function splitAroundLines(lineNumber: number, lines: Array<string>): { beforeLines: Array<string>; afterLines: Array<string>; } {
  const markerIndex = lines.findIndex(line => RE_AROUND_MARKER.test(line));
  if (markerIndex < 0) {
    throw new MarktestSyntaxError(`Missing around marker ${STR_AROUND_MARKER} in ${BODY_LABEL_AROUND} body`, { lineNumber });
  }
  return {
    beforeLines: lines.slice(0, markerIndex),
    afterLines: lines.slice(markerIndex + 1),
  };
}
export function splitInsertedLines(lines: Array<string>): Array<Array<string>> {
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
