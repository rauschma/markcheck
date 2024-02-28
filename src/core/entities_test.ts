import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { UserError } from '../util/errors.js';
import { Directive } from './directive.js';
import { SingleSnippet, directiveToEntity } from './entities.js';
import { extractCommentContent, parseMarkdown } from './parse-markdown.js';

createSuite(import.meta.url);

test('singleSnippet.getAllFileNames', () => {
  const { entities } = parseMarkdown(
    [
      '<!--marktest writeAndRun="file.js"-->',
      '```js',
      'console.log();',
      '```',
    ].join('\n'),
  );
  const snippet = entities[0];
  assert.ok(snippet instanceof SingleSnippet);
  assert.deepEqual(
    snippet.getAllFileNames({
      kind: 'LangDefCommand',
      defaultFileName: 'main.js',
      commands: [],
    }),
    ['file.js']
  );
});

test('Complain about illegal attributes', () => {
  const text = extractCommentContent('<!--marktest ignore_imports-->');
  assert.ok(text !== null);
  const directive = Directive.parse(1, splitLinesExclEol(text));
  assert.ok(directive !== null);
  assert.throws(
    () => directiveToEntity(directive),
    UserError
  );
});
