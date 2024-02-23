import { assertTrue } from '@rauschma/helpers/ts/type.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Config } from './config.js';
import { SingleSnippet, assembleLines } from './entities.js';
import { parseMarkdown } from './parse-markdown.js';

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

test('assembleLines', () => {
  const { entities, idToSnippet } = parseMarkdown(
    [
      '<!--marktest include="helper"-->',
      '```node-repl',
      '> twice("abc")',
      '"abcabc"',
      '```',
      '',
      '<!--marktest id="helper"-->',
      '```js',
      'function twice(str) { return str + str }',
      '```',
    ].join('\n'),
  );
  const snippet = entities[0];
  assertTrue(snippet instanceof SingleSnippet);
  const config = new Config();
  assert.deepEqual(
    assembleLines(config, idToSnippet, new Map(), snippet),
    [
      'function twice(str) { return str + str }',
      'assert.deepEqual(',
      'twice("abc")',
      ',',
      '"abcabc"',
      ');',
    ]
  );
});
