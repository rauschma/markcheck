import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import markdownit from 'markdown-it';
import { ConfigMod } from '../entity/config-mod.js';
import { ATTRS_APPLIABLE_LINE_MOD, ATTRS_APPLIABLE_LINE_MOD_BODY_LABEL_INSERT, ATTRS_CONFIG_MOD, ATTRS_LANGUAGE_LINE_MOD, ATTRS_SNIPPET, ATTRS_SNIPPET_BODY_LABEL_INSERT, ATTR_KEY_EACH, ATTR_KEY_LINE_MOD_ID, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_BODY, BODY_LABEL_CONFIG, BODY_LABEL_INSERT, Directive } from '../entity/directive.js';
import { Heading } from '../entity/heading.js';
import { LineMod } from '../entity/line-mod.js';
import { SequenceSnippet, SingleSnippet, Snippet } from '../entity/snippet.js';
import { type MarkcheckEntity } from '../entity/markcheck-entity.js';
import { MarkcheckSyntaxError, describeEntityContext } from '../util/errors.js';

const { stringify } = JSON;

//#################### parseMarkdown() ####################

export type ParsedMarkdown = {
  entities: Array<MarkcheckEntity>,
  idToSnippet: Map<string, Snippet>,
  idToLineMod: Map<string, LineMod>,
};

class ParsingState {
  openSingleSnippet: null | SingleSnippet = null;
  openSequence: null | SequenceSnippet = null;
  prevHeading: null | Heading = null;
  prevType: null | string = null;
}

export function parseMarkdown(text: string): ParsedMarkdown {
  const md = markdownit({ html: true });
  const result = new Array<MarkcheckEntity>();
  const tokens = md.parse(text, { html: true });

  let state = new ParsingState();

  // Look up tokens via “debug”: https://markdown-it.github.io
  for (const token of tokens) {
    try {
      if (token.type === 'html_block') {
        const text = extractCommentContent(token.content);
        if (text === null) continue;

        assertNonNullable(token.map);
        const lineNumber = token.map[0] + 1;
        const directive = Directive.parse(lineNumber, splitLinesExclEol(text));
        if (directive === null) continue;
        const entity = directiveToEntity(directive);
        if (entity === null) continue;

        //----- ConfigMod | LineMod -----

        if (entity instanceof ConfigMod || entity instanceof LineMod) {
          result.push(entity);
          continue;
        }
        //----- SingleSnippet -----

        if (state.openSingleSnippet) {
          // An open snippet was unsuccessfully waiting for its code block
          throw new MarkcheckSyntaxError(
            `Code block directive was not followed by a code block but by another directive`,
            { lineNumber: state.openSingleSnippet.lineNumber }
          );
        }
        if (entity.isClosed) {
          // The parsed directive is self-contained (a body directive)
          pushSingleSnippet(result, state, entity);
        } else {
          state.openSingleSnippet = entity;
        }
      } else if (token.type === 'fence' && token.tag === 'code' && token.markup.startsWith('```')) {
        assertNonNullable(token.map);
        const lineNumber = token.map[0] + 1;

        const text = token.content;
        const lines = splitLinesExclEol(text);
        const lang = token.info;
        if (state.openSingleSnippet) {
          // Code block follows a directive
          pushSingleSnippet(
            result,
            state,
            state.openSingleSnippet.closeWithBody(lang, lines)
          );
          state.openSingleSnippet = null;
        } else {
          // Code block without preceding directive
          pushSingleSnippet(
            result,
            state,
            SingleSnippet.createClosedFromCodeBlock(lineNumber, lang, lines)
          );
        }
      } else if (token.type === 'inline' && state.prevType === 'heading_open') {
        assertNonNullable(token.map);
        const lineNumber = token.map[0] + 1;
        state.prevHeading = new Heading(lineNumber, token.content);
      }
    } finally {
      state.prevType = token.type;
    }
  }
  if (state.openSingleSnippet) {
    throw new MarkcheckSyntaxError(`Code block directive was not followed by a code block`, { lineNumber: state.openSingleSnippet.lineNumber });
  }
  if (state.openSequence) {
    const first = state.openSequence.firstElement;
    const last = state.openSequence.lastElement;
    throw new MarkcheckSyntaxError(
      `Sequence was not completed – first element: line ${first.sequenceNumber}, last element: line ${last.sequenceNumber}`
    );
  }
  return {
    entities: result,
    idToSnippet: createIdToSnippet(result),
    idToLineMod: createIdToLineMod(result),
  };

}

function pushSingleSnippet(result: Array<MarkcheckEntity>, state: ParsingState, snippet: SingleSnippet): void {
  // This function always sets state.prevHeading to `null` – so that we
  // show each heading at most once.

  if (state.prevHeading) {
    result.push(state.prevHeading);
  }

  assertTrue(snippet.isClosed);
  if (state.openSequence === null) {
    // No active sequence
    const num = snippet.sequenceNumber;
    if (num === null) {
      // Still no active sequence
      result.push(snippet);
      state.prevHeading = null;
      state.openSequence = null;
      return;
    }
    // Snippet starts a new sequence
    state.openSequence = new SequenceSnippet(snippet);
  } else {
    // There is an active sequence
    const num = snippet.sequenceNumber;
    if (num === null) {
      throw new MarkcheckSyntaxError(
        `Snippet has no sequence number (expected: ${state.openSequence.nextSequenceNumber})`,
        { lineNumber: snippet.lineNumber }
      );
    }
    state.openSequence.pushElement(snippet, num);
  }
  if (state.openSequence.isComplete()) {
    result.push(state.openSequence);
    state.prevHeading = null;
    state.openSequence = null;
    return;
  }
  state.prevHeading = null;
  return;
}

//#################### directiveToEntity ####################

/**
 * Returned snippets are open or closed
 */
export function directiveToEntity(directive: Directive): null | ConfigMod | SingleSnippet | LineMod {
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
        return LineMod.parse(directive, {
          tag: 'LineModKindLanguage',
          targetLanguage: each,
        });
      }

      const lineModId = directive.getString(ATTR_KEY_LINE_MOD_ID);
      if (lineModId !== null) {
        // Appliable LineMod
        if (directive.bodyLabel === BODY_LABEL_INSERT) {
          directive.checkAttributes(ATTRS_APPLIABLE_LINE_MOD_BODY_LABEL_INSERT);
        } else {
          directive.checkAttributes(ATTRS_APPLIABLE_LINE_MOD);
        }
        return LineMod.parse(directive, {
          tag: 'LineModKindAppliable',
          lineModId,
        });
      }

      // Open snippet with local LineMod
      if (directive.bodyLabel === BODY_LABEL_INSERT) {
        directive.checkAttributes(ATTRS_SNIPPET_BODY_LABEL_INSERT);
      } else {
        directive.checkAttributes(ATTRS_SNIPPET);
      }
      const snippet = SingleSnippet.createOpen(directive);
      snippet.bodyLineMod = LineMod.parse(directive, {
        tag: 'LineModKindBody',
      });
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

function createIdToSnippet(entities: Array<MarkcheckEntity>): Map<string, Snippet> {
  const idToSnippet = new Map<string, Snippet>();
  for (const entity of entities) {
    if (entity instanceof Snippet && entity.id) {
      const other = idToSnippet.get(entity.id);
      if (other) {
        throw new MarkcheckSyntaxError(
          `Duplicate id ${JSON.stringify(entity)} (other usage is in line ${other.lineNumber})`,
          { lineNumber: entity.lineNumber }
        );
      }
      idToSnippet.set(entity.id, entity);
    }
  }
  return idToSnippet;
}

function createIdToLineMod(entities: Array<MarkcheckEntity>): Map<string, LineMod> {
  const idToLineMod = new Map<string, LineMod>();
  for (const entity of entities) {
    if (entity instanceof LineMod) {
      const lineModId = entity.getLineModId();
      if (lineModId) {
        const other = idToLineMod.get(lineModId);
        if (other) {
          const description = describeEntityContext(other.context);
          throw new MarkcheckSyntaxError(
            `Duplicate id ${JSON.stringify(entity)} (other usage is ${description})`,
            { entityContext: entity.context }
          );
        }
        idToLineMod.set(lineModId, entity);
      }
    }
  }
  return idToLineMod;
}
