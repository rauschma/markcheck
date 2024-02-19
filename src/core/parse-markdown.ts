import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import markdownit from 'markdown-it';
import { Directive } from './directive.js';
import { ConfigMod, LineMod, SingleSnippet, directiveToEntity, type MarktestEntity, SequenceSnippet } from './entities.js';
import { UserError } from '../util/errors.js';

const COMMENT_START = '<!--';
const COMMENT_END = '-->';

export function parseMarkdown(text: string): Array<MarktestEntity> {
  const md = markdownit()
  const result = new Array<MarktestEntity>();
  const tokens = md.parse(text, { html: true });

  let openSingleSnippet: null | SingleSnippet = null;
  let openSequence: null | SequenceSnippet = null;

  for (const token of tokens) {
    // Content of tokens (“debug”): https://markdown-it.github.io
    if (token.type === 'inline' && token.content.startsWith(COMMENT_START) && token.content.endsWith(COMMENT_END)) {
      const lineNumber = token.map?.[0];
      assertNonNullable(lineNumber);

      const text = token.content.slice(COMMENT_START.length, -COMMENT_END.length);
      const directive = Directive.parse(lineNumber, splitLinesExclEol(text));
      if (directive === null) continue;
      const entity = directiveToEntity(directive);
      if (entity === null) continue;
      // Configuration | Transformation | SingleSnippet
      if (entity instanceof ConfigMod || entity instanceof LineMod) {
        result.push(entity);
        continue;
      }
      // SingleSnippet
      if (openSingleSnippet) {
        // An open snippet was unsuccessfully waiting for its code block
        throw new UserError(`Code block directive was not followed by a code block but by another directive (line ${entity.lineNumber})`, {lineNumber: openSingleSnippet.lineNumber});
      }
      if (entity.isClosed) {
        openSequence = pushSingleSnippet(openSequence, entity);
      } else {
        openSingleSnippet = entity;
      }
    } else if (token.type === 'fence' && token.tag === 'code' && token.markup.startsWith('```')) {
      const lineNumber = token.map?.[0];
      assertNonNullable(lineNumber);
      const text = token.content;
      const lines = splitLinesExclEol(text);
      const lang = token.info;
      if (openSingleSnippet) {
        openSequence = pushSingleSnippet(openSequence, openSingleSnippet.closeWithBody(lang, lines));
        openSingleSnippet = null;
      } else {
        openSequence = pushSingleSnippet(openSequence, SingleSnippet.createFromCodeBlock(lineNumber, lang, lines));
      }
    }
  }
  if (openSingleSnippet) {
    throw new UserError(`Code block directive was not followed by a code block`, {lineNumber: openSingleSnippet.lineNumber});
  }
  if (openSequence) {
    const first = openSequence.firstElement;
    const last = openSequence.lastElement;
    throw new UserError(
      `Sequence was not completed – first element: line ${first.sequenceNumber}, last element: line ${last.sequenceNumber}`
    );
  }
  return result;

  function pushSingleSnippet(openSequence: null | SequenceSnippet, snippet: SingleSnippet): null | SequenceSnippet {
    assertTrue(snippet.isClosed);
    if (openSequence === null) {
      const num = snippet.sequenceNumber;
      if (num === null) {
        result.push(snippet);
        return openSequence;
      }
      openSequence = new SequenceSnippet(snippet);
    } else {
      openSequence.pushElement(snippet);
    }
    if (openSequence.isComplete()) {
      result.push(openSequence);
      return null;
    }
    return openSequence;
  }
}
