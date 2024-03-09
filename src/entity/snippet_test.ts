import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../core/parse-markdown.js';
import { SingleSnippet } from './snippet.js';

createSuite(import.meta.url);

test('singleSnippet.getAllFileNames', () => {
  {
    const { entities } = parseMarkdown(
      [
        '<!--markcheck runFileName="file.js"-->',
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
  }
  {
    const { entities } = parseMarkdown(
      [
        '<!--markcheck external="lib1.js, lib2.js"-->',
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
      ['main.js', 'lib1.js', 'lib2.js']
    );
  }
});
