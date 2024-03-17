import { type JsonValue } from '@rauschma/helpers/typescript/json.js';
import { assertNonNullable, type PublicDataProperties } from '@rauschma/helpers/typescript/type.js';
import type { Translator } from '../translation/translation.js';
import { EntityContextLineNumber, InternalError, MarkcheckSyntaxError, type EntityContext } from '../util/errors.js';
import { trimTrailingEmptyLines } from '../util/string.js';
import { ATTR_KEY_AT, ATTR_KEY_IGNORE_LINES, ATTR_KEY_SEARCH_AND_REPLACE, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_INSERT, type Directive } from './directive.js';
import { SearchAndReplaceSpec } from './search-and-replace-spec.js';
import { InsertionRules, LineLocModifier, parseInsertionConditions } from './insertion-rules.js';
import { lineLocSetToLineNumberSet, parseLineLocSet, type LineLocSet } from './line-loc-set.js';
import { MarkcheckEntity } from './markcheck-entity.js';

const { stringify } = JSON;

//#################### Constants ####################

const RE_AROUND_MARKER = /^[ \t]*•••[ \t]*$/;
const STR_AROUND_MARKER = '•••';

// export type LineModKind = LineModKindConfig |
//   LineModKindLanguage |
//   LineModKindAppliable |
//   LineModKindBody;
// export type LineModKindConfig = {
//   tag: 'LineModKindConfig';
// };
// export type LineModKindLanguage = {
//   tag: 'LineModKindLanguage';
//   targetLanguage: string;
// };
// export type LineModKindAppliable = {
//   tag: 'LineModKindAppliable';
//   lineModId: string;
// };
// export type LineModKindBody = {
//   tag: 'LineModKindBody';
// };

//#################### LineMod ####################

type LineModProps = PublicDataProperties<LineMod>;
function lineModPropsEmpty(context: EntityContext): LineModProps {
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

function lineModPropsFromDirective(directive: Directive, allowBodyLabelInsert: boolean): LineModProps {
  const entityContext = new EntityContextLineNumber(directive.lineNumber);
  const props = lineModPropsEmpty(entityContext);

  const ignoreLinesStr = directive.getString(ATTR_KEY_IGNORE_LINES);
  if (ignoreLinesStr) {
    props.ignoreLines = parseLineLocSet(directive.lineNumber, ignoreLinesStr);
  }
  const searchAndReplaceStr = directive.getString(ATTR_KEY_SEARCH_AND_REPLACE);
  if (searchAndReplaceStr) {
    try {
      props.searchAndReplace = SearchAndReplaceSpec.fromString(
        searchAndReplaceStr
      );
    } catch (err) {
      throw new MarkcheckSyntaxError(
        `Could not parse value of attribute ${stringify(ATTR_KEY_SEARCH_AND_REPLACE)}`,
        { entityContext, cause: err }
      );
    }
  }

  const body = trimTrailingEmptyLines(directive.body.slice());
  switch (directive.bodyLabel) {
    case null:
      // No body label – e.g.: <!--markcheck ignoreLines="1-3, 5"-->
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
      if (!allowBodyLabelInsert) {
        throw new MarkcheckSyntaxError(
          `Body label ${stringify(BODY_LABEL_INSERT)} is only allowed for internal LineMods and appliable LineMods`
        );
      }

      const atStr = directive.getString(ATTR_KEY_AT);
      if (atStr === null) {
        throw new MarkcheckSyntaxError(
          `Directive has the body label ${stringify(BODY_LABEL_INSERT)} but not attribute ${stringify(ATTR_KEY_AT)}`,
          { lineNumber: directive.lineNumber }
        );
      }
      const conditions = parseInsertionConditions(directive.lineNumber, atStr);
      const lineGroups = splitInsertedLines(body);
      if (conditions.length !== lineGroups.length) {
        throw new MarkcheckSyntaxError(
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
  return props;
}

//#################### LineMod ####################

abstract class LineMod extends MarkcheckEntity {

  /**
   * LineMods can be created from line in Config. Then they don’t have a
   * line number. Thus, the more general EntityContext is needed.
   */
  context: EntityContext;
  //
  ignoreLines: LineLocSet;
  searchAndReplace: null | SearchAndReplaceSpec;
  //
  insertionRules: InsertionRules;
  beforeLines: Array<string>;
  afterLines: Array<string>;

  protected constructor(props: LineModProps) {
    super();
    this.context = props.context;
    //
    this.ignoreLines = props.ignoreLines;
    this.searchAndReplace = props.searchAndReplace;
    //
    this.insertionRules = props.insertionRules;
    this.beforeLines = props.beforeLines;
    this.afterLines = props.afterLines;
  }
  override getEntityContext(): EntityContext {
    return this.context;
  }
  isEmpty(): boolean {
    return (
      this.ignoreLines.length === 0 &&
      this.searchAndReplace === null &&
      this.insertionRules.isEmpty() &&
      this.beforeLines.length === 0 &&
      this.afterLines.length === 0
    );
  }

  pushModifiedBodyTo(lineNumber: number, body: Array<string>, translator: Translator | undefined, linesOut: Array<string>) {
    // - Line-ignoring clashes with line insertion because both change line
    //   numbers.
    // - However, ignored line numbers would make no sense at all after
    //   inserting lines, which is why we ignore first.
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
    return {
      ...this.getSubclassProps(),
      beforeLines: this.beforeLines,
      afterLines: this.afterLines,
    };
  }
  protected abstract getSubclassProps(): Record<string, JsonValue>;
}

export class LineModInternal extends LineMod {
  constructor(directive: Directive) {
    super(lineModPropsFromDirective(directive, true));
  }
  protected override getSubclassProps(): Record<string, JsonValue> {
    return {
      insertionRules: this.insertionRules.toJson(),
    };
  }
}

export class LineModAppliable extends LineMod {
  lineModId: string;
  constructor(directive: Directive, lineModId: string) {
    super(lineModPropsFromDirective(directive, true));
    this.lineModId = lineModId;
  }
  protected override getSubclassProps(): Record<string, JsonValue> {
    return {
      lineModId: this.lineModId,
    };
  }
}

export class LineModLanguage extends LineMod {
  targetLanguage: string;
  constructor(directive: Directive, targetLanguage: string) {
    super(lineModPropsFromDirective(directive, true));
    this.targetLanguage = targetLanguage;
  }
  protected override getSubclassProps(): Record<string, JsonValue> {
    return {
      targetLanguage: this.targetLanguage,
    };
  }
}

/**
 * Created on the fly for the “before” lines from the Config.
 */
export class LineModConfig extends LineMod {
  constructor(context: EntityContext, beforeLines: Array<string>, afterLines: Array<string>) {
    super({
      ...lineModPropsEmpty(context),
      beforeLines,
      afterLines,
    });
  }
  protected override getSubclassProps(): Record<string, JsonValue> {
    return {};
  }
}

//#################### Helpers ####################

export function splitAroundLines(lineNumber: number, lines: Array<string>): { beforeLines: Array<string>; afterLines: Array<string>; } {
  const markerIndex = lines.findIndex(line => RE_AROUND_MARKER.test(line));
  if (markerIndex < 0) {
    throw new MarkcheckSyntaxError(`Missing around marker ${STR_AROUND_MARKER} in ${BODY_LABEL_AROUND} body`, { lineNumber });
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
