import { assertTrue } from '@rauschma/helpers/ts/type.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { SingleSnippet } from './entities.js';
import { parseMarkdown } from './parse-markdown.js';

test('singleSnippet.getAllFileNames', () => {
  const entities = parseMarkdown(
    [
      '<!--marktest writeAndRun="file.js"-->',
      '```js',
      'console.log();',
      '```',
    ].join('\n'),
  );
  const snippet = entities[0];
  assertTrue(snippet instanceof SingleSnippet);
  assert.deepEqual(
    snippet.getAllFileNames({
      kind: 'LangDefCommand',
      defaultFileName: 'main.js',
      commands: [],
    }),
    ['file.js']
  );
});
