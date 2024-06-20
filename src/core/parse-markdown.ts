import { splitLinesExclEol } from '@rauschma/helpers/string/line.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/typescript/type.js';
import markdownit from 'markdown-it';
import { ConfigMod } from '../entity/config-mod.js';
import { ATTRS_APPLIABLE_LINE_MOD, ATTRS_APPLIABLE_LINE_MOD_BODY_LABEL_INSERT, ATTRS_CONFIG_MOD, ATTRS_LANGUAGE_LINE_MOD, ATTRS_SNIPPET, ATTRS_SNIPPET_BODY_LABEL_INSERT, ATTR_KEY_DEFINE, ATTR_KEY_EACH, ATTR_KEY_ID, ATTR_KEY_LINE_MOD_ID, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_BODY, BODY_LABEL_CONFIG, BODY_LABEL_INSERT, Directive } from '../entity/directive.js';
import { Heading } from '../entity/heading.js';
import { LineModAppliable, LineModInternal, LineModLanguage } from '../entity/line-mod.js';
import { SequenceSnippet, SingleSnippet, Snippet } from '../entity/snippet.js';
import { MarkcheckSyntaxError } from '../util/errors.js';
import { UnsupportedValueError } from '@rauschma/helpers/typescript/error.js';

const { stringify } = JSON;

//#################### parseMarkdown() ####################

export type SoloEntity = SingleSnippet | LineModAppliable | LineModLanguage | ConfigMod | Heading;

export type ParsedEntity = Snippet | LineModAppliable | LineModLanguage | ConfigMod | Heading;

type ParsingState = ParsingStateNormal | ParsingStateOpenSnippet | ParsingStateOpenHeading;

type ParsingStateNormal = {
  kind: 'ParsingStateNormal',
};
type ParsingStateOpenSnippet = {
  kind: 'ParsingStateOpenSnippet',
  openSingleSnippet: SingleSnippet,
};
type ParsingStateOpenHeading = {
  kind: 'ParsingStateOpenHeading',
  lineNumber: number,
};

export function parseMarkdown(text: string): ParsedMarkdown {
  const parsed = parseEntities(text);
  const trimmedHeadings = Array.from(trimHeadings(parsed));
  const withSequences = Array.from(createSequenceSnippets(trimmedHeadings));
  const withEmbeddedSnippets = Array.from(embedDefinitionSnippets(withSequences));
  return {
    entities: withEmbeddedSnippets,
    idToSnippet: createIdToSnippet(withEmbeddedSnippets),
    idToLineMod: createIdToLineMod(withEmbeddedSnippets),
  };
}

function parseEntities(text: string): Array<SoloEntity> {
  const md = markdownit({ html: true });
  const result = new Array<SoloEntity>();
  const tokens = md.parse(text, { html: true });

  let parsingState: ParsingState = { kind: 'ParsingStateNormal' };

  // Look up tokens via “debug” here: https://markdown-it.github.io
  for (const token of tokens) {
    if (token.type === 'html_block') {
      const text = extractCommentContent(token.content);
      if (text === null) continue;

      assertNonNullable(token.map);
      const lineNumber = token.map[0] + 1;
      const directive = Directive.parse(lineNumber, splitLinesExclEol(text));
      if (directive === null) continue;
      const entity = directiveToEntity(directive);
      if (entity === null) {
        // We have not detected a relevant entity: nothing changes
        continue;
      }

      // Illegal state:
      // - A directive is waiting for its code block
      // - A heading is waiting for its inlines
      throwIfStateIsNotNormal(parsingState, 'directive');

      //----- ConfigMod | LineMod -----

      if (entity instanceof ConfigMod || entity instanceof LineModAppliable || entity instanceof LineModLanguage) {
        result.push(entity);
        continue;
      }

      //----- SingleSnippet -----

      if (entity.isClosed) {
        // The parsed directive is self-contained (a body directive)
        result.push(entity);
        assertTrue(parsingState.kind === 'ParsingStateNormal');
      } else {
        parsingState = {
          kind: 'ParsingStateOpenSnippet',
          openSingleSnippet: entity,
        };
      }
    } else if (token.type === 'fence' && token.tag === 'code' && token.markup.startsWith('```')) {
      assertNonNullable(token.map);
      const lineNumber = token.map[0] + 1;

      const text = token.content;
      const lines = splitLinesExclEol(text);
      const lang = token.info;
      switch (parsingState.kind) {
        case 'ParsingStateOpenSnippet':
          // Code block follows a directive
          result.push(
            parsingState.openSingleSnippet.closeWithBody(lang, lines)
          );
          parsingState = { kind: 'ParsingStateNormal' };
          break;
        case 'ParsingStateNormal':
          // Code block without preceding directive
          result.push(
            SingleSnippet.createClosedFromCodeBlock(lineNumber, lang, lines)
          );
          assertTrue(parsingState.kind === 'ParsingStateNormal');
          break;
        case 'ParsingStateOpenHeading':
          throw new MarkcheckSyntaxError(
            `An open heading was followed by a code block`,
            { lineNumber }
          );
        default:
          throw new UnsupportedValueError(parsingState);
      }
    } else if (token.type === 'heading_open') {
      assertNonNullable(token.map);
      const lineNumber = token.map[0] + 1;
      parsingState = {
        kind: 'ParsingStateOpenHeading',
        lineNumber,
      };
    } else if (token.type === 'inline' && parsingState.kind === 'ParsingStateOpenHeading') {
      assertNonNullable(token.map);
      const lineNumber = token.map[0] + 1;
      result.push(
        new Heading(lineNumber, token.content)
      );
      parsingState = {
        kind: 'ParsingStateNormal',
      };
    }
  }
  throwIfStateIsNotNormal(parsingState, 'end of file');
  return result;
}

function throwIfStateIsNotNormal(parsingState: ParsingState, entityDescription: string) {
  let message: string;
  let lineNumber: number;
  switch (parsingState.kind) {
    case 'ParsingStateNormal':
      // Everything is OK
      return;
    case 'ParsingStateOpenHeading':
      message = `Open heading without content before ${entityDescription}`;
      lineNumber = parsingState.lineNumber;
      break;
    case 'ParsingStateOpenSnippet':
      message = `Directive without code block before ${entityDescription}`;
      lineNumber = parsingState.openSingleSnippet.lineNumber;
      break;
    default:
      throw new UnsupportedValueError(parsingState);
  }
  throw new MarkcheckSyntaxError(
    message, { lineNumber }
  );
}

function* trimHeadings(parsedEntities: Array<SoloEntity>): Iterable<SoloEntity> {
  // We trim headings before we group single snippets into sequences
  // because those single snippets may be interspersed with headings –
  // which makes grouping harder.
  let currentHeading: null | Heading = null;
  for (const entity of parsedEntities) {
    if (entity instanceof Heading) {
      currentHeading = entity;
    } else if (entity instanceof SingleSnippet) {
      // A SingleSnippet activates a heading
      if (currentHeading !== null) {
        const num = entity.sequenceNumber;
        if (num === null || (num !== null && num.pos === 1)) {
          yield currentHeading;
          currentHeading = null; // use heading at most once
        }
      }
      yield entity;
    } else {
      // All other entities have no effect on headings
      yield entity;
    }
  }
}

function* createSequenceSnippets(parsedEntities: Array<SoloEntity>): Iterable<ParsedEntity> {
  let openSequence: null | SequenceSnippet = null;
  for (const entity of parsedEntities) {
    if (openSequence !== null) {
      if (!(entity instanceof SingleSnippet)) {
        throw new MarkcheckSyntaxError(
          `Only SingleSnippets can be part of a sequence. Encountered a ${entity.constructor.name}`,
          { entity }
        );
      }
      const num = entity.sequenceNumber;
      if (num === null) {
        throw new MarkcheckSyntaxError(
          `Snippet has no sequence number (expected: ${openSequence.nextSequenceNumber})`,
          { entity }
        );
      }
      openSequence.pushElement(entity, num);
      if (openSequence.isComplete()) {
        yield openSequence;
        openSequence = null;
      }
    } else {
      // openSequence === null
      if (entity instanceof SingleSnippet && entity.sequenceNumber !== null) {
        openSequence = new SequenceSnippet(entity);;
      } else {
        yield entity;
      }
    }
  }
  if (openSequence !== null) {
    const first = openSequence.firstElement;
    const last = openSequence.lastElement;
    throw new MarkcheckSyntaxError(
      `Sequence was not completed – first element: ${first.getEntityContext()}, last element: ${last.getEntityContext()}`
    );
  }
}

const DEFINE_STDOUT = 'stdout';
const DEFINE_STDERR = 'stderr';
const DEFINE_VALUES = [DEFINE_STDOUT, DEFINE_STDERR];

function* embedDefinitionSnippets(parsedEntities: Array<ParsedEntity>): Iterable<ParsedEntity> {
  // We collect definition snippets after we group single snippets into
  // sequences because definition snippets for sequences must come after
  // the complete sequence.
  let currentSnippet: null | Snippet = null;
  for (const entity of parsedEntities) {
    if (entity instanceof Snippet) {
      const definitionKey: null | string = entity.define;
      if (definitionKey !== null) {
        if (currentSnippet === null) {
          throw new MarkcheckSyntaxError(
            `A definition snippet (attribute ${stringify(ATTR_KEY_DEFINE)}) can only come after a snippet`,
            { entity }
          );
        }
        if (!(entity instanceof SingleSnippet)) {
          throw new MarkcheckSyntaxError(
            `Only a ${SingleSnippet.name} can have the attribute ${stringify(ATTR_KEY_DEFINE)}`,
            { entity }
          );
        }
        switch (definitionKey) {
          case DEFINE_STDOUT:
            if (currentSnippet.stdoutSpec !== null) {
              throw new MarkcheckSyntaxError(
                `Can’t define stdout for snippet ${currentSnippet.getEntityContext().describe()} – it already has the attribute ${stringify(ATTR_KEY_STDOUT)}`,
                { entity }
              );
            }
            currentSnippet.stdoutSpec = {
              kind: 'StdStreamContentSpecDefinitionSnippet',
              snippet: entity,
            };
            break;
          case DEFINE_STDERR:
            if (currentSnippet.stderrSpec !== null) {
              throw new MarkcheckSyntaxError(
                `Can’t define stderr for snippet ${currentSnippet.getEntityContext().describe()} – it already has the attribute ${stringify(ATTR_KEY_STDERR)}`,
                { entity }
              );
            }
            currentSnippet.stderrSpec = {
              kind: 'StdStreamContentSpecDefinitionSnippet',
              snippet: entity,
            };
            break;
          default:
            throw new MarkcheckSyntaxError(
              `Unsupported value for attribute ${stringify(ATTR_KEY_DEFINE)}. The only allowed values are: ${stringify(DEFINE_VALUES)}`,
              { entity }
            );
        }
        // currentSnippet is unchanged and available for more `define`
        // snippets
      } else {
        yield entity;
        currentSnippet = entity;
      }
    } else {
      yield entity;
      currentSnippet = null;
    }
  }
}

export type ParsedMarkdown = {
  entities: Array<ParsedEntity>,
  idToSnippet: Map<string, Snippet>,
  idToLineMod: Map<string, LineModAppliable>,
};

//#################### directiveToEntity ####################

/**
 * Returned snippets are open or closed
 */
export function directiveToEntity(directive: Directive): null | ConfigMod | SingleSnippet | LineModAppliable | LineModLanguage {
  switch (directive.bodyLabel) {
    case BODY_LABEL_CONFIG:
      directive.checkAttributes(ATTRS_CONFIG_MOD);
      return new ConfigMod(directive);

    case BODY_LABEL_BODY: {
      directive.checkAttributes(ATTRS_SNIPPET);
      return SingleSnippet.createClosedFromBodyDirective(directive);
    }

    case BODY_LABEL_BEFORE:
    case BODY_LABEL_AFTER:
    case BODY_LABEL_AROUND:
    case BODY_LABEL_INSERT:
    case null: {
      // Either:
      // - Language LineMod
      // - Appliable LineMod
      // - Open snippet with local LineMod

      const each = directive.getString(ATTR_KEY_EACH);
      if (each !== null) {
        // Language LineMod
        directive.checkAttributes(ATTRS_LANGUAGE_LINE_MOD);
        return new LineModLanguage(directive, each);
      }

      const lineModId = directive.getString(ATTR_KEY_LINE_MOD_ID);
      if (lineModId !== null) {
        // Appliable LineMod
        if (directive.bodyLabel === BODY_LABEL_INSERT) {
          directive.checkAttributes(ATTRS_APPLIABLE_LINE_MOD_BODY_LABEL_INSERT);
        } else {
          directive.checkAttributes(ATTRS_APPLIABLE_LINE_MOD);
        }
        return new LineModAppliable(directive, lineModId);
      }

      // Open snippet with local LineMod
      if (directive.bodyLabel === BODY_LABEL_INSERT) {
        directive.checkAttributes(ATTRS_SNIPPET_BODY_LABEL_INSERT);
      } else {
        directive.checkAttributes(ATTRS_SNIPPET);
      }
      const snippet = SingleSnippet.createOpen(directive);
      snippet.internalLineMod = new LineModInternal(directive);
      return snippet;
    }

    default: {
      throw new MarkcheckSyntaxError(
        `Unsupported body label: ${stringify(directive.bodyLabel)}`,
        { lineNumber: directive.lineNumber }
      );
    }
  }
}

//#################### Comments ####################

const RE_COMMENT_START = /^<!--/;
const RE_COMMENT_END = /-->(\r?\n)?$/;

export function extractCommentContent(html: string): null | string {
  const startMatch = RE_COMMENT_START.exec(html);
  const endMatch = RE_COMMENT_END.exec(html);
  if (startMatch === null || endMatch === null) return null;
  return html.slice(startMatch[0].length, endMatch.index);
}

//#################### Indices into entities ####################

function createIdToSnippet(entities: Array<ParsedEntity>): Map<string, Snippet> {
  const idToSnippet = new Map<string, Snippet>();
  for (const entity of entities) {
    if (entity instanceof Snippet && entity.id) {
      const other = idToSnippet.get(entity.id);
      if (other) {
        const description = other.getEntityContext().describe();
        throw new MarkcheckSyntaxError(
          `Duplicate ${JSON.stringify(ATTR_KEY_ID)}: ${JSON.stringify(entity.id)} (other usage is ${description})`,
          { lineNumber: entity.lineNumber }
        );
      }
      idToSnippet.set(entity.id, entity);
    }
  }
  return idToSnippet;
}

function createIdToLineMod(entities: Array<ParsedEntity>): Map<string, LineModAppliable> {
  const idToLineMod = new Map<string, LineModAppliable>();
  for (const entity of entities) {
    if (entity instanceof LineModAppliable) {
      const lineModId = entity.lineModId;
      if (lineModId) {
        const other = idToLineMod.get(lineModId);
        if (other) {
          const description = other.getEntityContext().describe();
          throw new MarkcheckSyntaxError(
            `Duplicate ${JSON.stringify(ATTR_KEY_LINE_MOD_ID)}: ${JSON.stringify(entity.lineModId)} (other usage is ${description})`,
            { entityContext: entity.context }
          );
        }
        idToLineMod.set(lineModId, entity);
      }
    }
  }
  return idToLineMod;
}
