import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import markdownit from 'markdown-it';
import { UserError } from '../util/errors.js';
import { Directive } from './directive.js';
import { ConfigMod, Heading, LineMod, SequenceSnippet, SingleSnippet, directiveToEntity, type MarktestEntity } from './entities.js';

export function parseMarkdown(text: string): Array<MarktestEntity> {
  const md = markdownit({ html: true });
  const result = new Array<MarktestEntity>();
  const tokens = md.parse(text, { html: true });

  let openSingleSnippet: null | SingleSnippet = null;
  let openSequence: null | SequenceSnippet = null;
  let prevHeading: null | string = null;
  let prevType: null | string = null

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

        if (openSingleSnippet) {
          // An open snippet was unsuccessfully waiting for its code block
          throw new UserError(
            `Code block directive was not followed by a code block but by another directive (line ${entity.lineNumber})`,
            { lineNumber: openSingleSnippet.lineNumber }
          );
        }
        if (entity.isClosed) {
          // The parsed directive is self-contained (a body directive)
          ({ prevHeading, openSequence } = pushSingleSnippet(
            prevHeading, openSequence, entity
          ));
        } else {
          openSingleSnippet = entity;
        }
      } else if (token.type === 'fence' && token.tag === 'code' && token.markup.startsWith('```')) {
        assertNonNullable(token.map);
        const lineNumber = token.map[0] + 1;

        const text = token.content;
        const lines = splitLinesExclEol(text);
        const lang = token.info;
        if (openSingleSnippet) {
          // Code block follows a directive
          ({ prevHeading, openSequence } = pushSingleSnippet(
            prevHeading, openSequence, openSingleSnippet.closeWithBody(lang, lines)
          ));
          openSingleSnippet = null;
        } else {
          // Code block without preceding directive
          ({ prevHeading, openSequence } = pushSingleSnippet(
            prevHeading, openSequence, SingleSnippet.createClosedFromCodeBlock(lineNumber, lang, lines)
          ));
        }
      } else if (token.type === 'inline' && prevType === 'heading_open') {
        prevHeading = token.content;
      }
    } finally {
      prevType = token.type;
    }
  }
  if (openSingleSnippet) {
    throw new UserError(`Code block directive was not followed by a code block`, { lineNumber: openSingleSnippet.lineNumber });
  }
  if (openSequence) {
    const first = openSequence.firstElement;
    const last = openSequence.lastElement;
    throw new UserError(
      `Sequence was not completed – first element: line ${first.sequenceNumber}, last element: line ${last.sequenceNumber}`
    );
  }
  return result;

  function pushSingleSnippet(
    prevHeading: null | string, openSequence: null | SequenceSnippet, snippet: SingleSnippet
  ): {
    prevHeading: null | string,
    openSequence: null | SequenceSnippet,
  } {
    // In the result, prevHeading is always `null` – so that we show each
    // heading at most once.

    if (prevHeading) {
      result.push(new Heading(prevHeading));
    }

    assertTrue(snippet.isClosed);
    if (openSequence === null) {
      // No active sequence
      const num = snippet.sequenceNumber;
      if (num === null) {
        // Still no active sequence
        result.push(snippet);
        return { prevHeading: null, openSequence: null };
      }
      // Snippet starts a new sequence
      openSequence = new SequenceSnippet(snippet);
    } else {
      // There is an active sequence
      openSequence.pushElement(snippet);
    }
    if (openSequence.isComplete()) {
      result.push(openSequence);
      return { prevHeading: null, openSequence: null };
    }
    return { prevHeading: null, openSequence };
  }
}

const RE_COMMENT_START = /^<!--/;
const RE_COMMENT_END = /-->(\r?\n)?$/;

export function extractCommentContent(html: string): null | string {
  const startMatch = RE_COMMENT_START.exec(html);
  const endMatch = RE_COMMENT_END.exec(html);
  if (startMatch === null || endMatch === null) return null;
  return html.slice(startMatch[0].length, endMatch.index);
}