import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { assertNonNullable } from '@rauschma/helpers/ts/type.js';
import markdownit from 'markdown-it';
import { Directive } from './directive.js';
import { Configuration, SingleSnippet, Transformation, mtConstructFromDirective, type MtConstruct } from './snippet.js';
import { UserError } from './errors.js';

const COMMENT_START = '<!--';
const COMMENT_END = '-->';

export function parseMarkdown(text: string): Array<MtConstruct> {
  const md = markdownit()
  const result = new Array<MtConstruct>();
  const tokens = md.parse(text, { html: true });

  let openSingleSnippet: null | SingleSnippet = null;
  for (const token of tokens) {
    // Content of tokens (“debug”): https://markdown-it.github.io
    if (token.type === 'inline' && token.content.startsWith(COMMENT_START) && token.content.endsWith(COMMENT_END)) {
      const lineNumber = token.map?.[0];
      assertNonNullable(lineNumber);

      const text = token.content.slice(COMMENT_START.length, -COMMENT_END.length);
      const directive = Directive.parse(lineNumber, splitLinesExclEol(text));
      if (directive === null) continue;
      const construct = mtConstructFromDirective(directive);
      if (construct === null) continue;
      // Configuration | Transformation | SingleSnippet
      if (construct instanceof Configuration || construct instanceof Transformation) {
        result.push(construct);
        continue;
      }
      if (openSingleSnippet) {
        throw new UserError(`Code block directive was not followed by a code block but by another directive (line ${construct.lineNumber})`, {lineNumber: openSingleSnippet.lineNumber});
      }
      if (construct.isClosed) {
        result.push(construct);
      } else {
        openSingleSnippet = construct;
      }
    } else if (token.type === 'fence' && token.tag === 'code' && token.markup.startsWith('```')) {
      const lineNumber = token.map?.[0];
      assertNonNullable(lineNumber);
      const text = token.content;
      const lines = splitLinesExclEol(text);
      const lang = token.info;
      if (openSingleSnippet) {
        result.push(openSingleSnippet.closeWithBody(lang, lines));
      } else {
        result.push(SingleSnippet.createFromCodeBlock(lineNumber, lang, lines));
      }
    }
  }
  if (openSingleSnippet) {
    throw new UserError(`Code block directive was not followed by a code block`, {lineNumber: openSingleSnippet.lineNumber});
  }
  return result;
}
