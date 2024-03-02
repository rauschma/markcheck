import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { snippetJson } from '../src/entity/snippet.js';
import { parseMarkdown } from '../src/core/parse-markdown.js';

createSuite(import.meta.url);

test('Parse demo-javascript.md', () => {
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
