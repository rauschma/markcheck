import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import test from 'node:test';
import { snippetJson } from './entities.js';
import { extractCommentContent, parseMarkdown } from './parse-markdown.js';

test('parseMarkdown', () => {
  const url = new URL(import.meta.resolve('#demo/demo-javascript.md'));
  const md = fs.readFileSync(url, 'utf-8');
  const entitiesJson = parseMarkdown(md).entities.map(e => e.toJson());
  // console.dir(entities, { depth: Infinity });
  assert.deepEqual(
    entitiesJson,
    [
      { content: 'Check output' },
      snippetJson({
        lineNumber: 5,
        lang: 'js',
        external: [{ id: 'other', fileName: 'other.mjs' }],
        stdout: 'output',
        body: [
          '// main.mjs',
          "import { NAME } from './other.mjs';",
          'console.log(`Hello ${NAME}!`);'
        ]
      }),
      snippetJson({
        lineNumber: 12,
        lang: 'js',
        id: 'other',
        body: [
          '// other.mjs',
          "export const NAME = 'user';",
        ]
      }),
      snippetJson({
        lineNumber: 18,
        lang: '',
        id: 'output',
        body: ['Hello user!']
      }),
      { content: 'Assertions' },
      snippetJson({
        lineNumber: 25,
        lang: 'js',
        body: [
          "import assert from 'node:assert/strict';",
          'assert.equal(',
          "  'abc' + 'abc',",
          "  'abcabc'",
          ');'
        ]
      }),
    ]
  );
});

test('extractCommentContent', () => {
  assert.equal(
    extractCommentContent('<!--ABC-->'),
    'ABC'
  );
  assert.equal(
    extractCommentContent('<!--First line\nSecond line\n-->\n'),
    'First line\nSecond line\n'
  );
});
