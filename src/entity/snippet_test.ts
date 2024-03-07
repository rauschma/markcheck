import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../core/parse-markdown.js';
import { SingleSnippet } from './snippet.js';

createSuite(import.meta.url);

test('singleSnippet.getAllFileNames', () => {
  const { entities } = parseMarkdown(
    [
      '<!--markcheck writeAndRun="file.js"-->',
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
      runFileName: 'main.js',
      commands: [],
    }),
    ['file.js']
  );
});
