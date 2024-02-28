import { outdent } from '@rauschma/helpers/js/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { LineMod, snippetJson } from './entities.js';
import { extractCommentContent, parseMarkdown } from './parse-markdown.js';

createSuite(import.meta.url);

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

test.only('Parsing a line mod', () => {
  const {entities} = parseMarkdown(outdent`
    <!--marktest each="js" around:
    Line before
    •••
    Line after
    -->
  `);
  const lineMod = entities[0];
  assert.ok(lineMod instanceof LineMod);
  {
    const beforeLines = new Array<string>();
    lineMod.pushBeforeLines(beforeLines);
    assert.deepEqual(
      beforeLines,
      [
        'Line before'
      ]
    );
  }
  {
    const afterLines = new Array<string>();
    lineMod.pushAfterLines(afterLines);
    assert.deepEqual(
      afterLines,
      [
        'Line after'
      ]
    );
  }
});
