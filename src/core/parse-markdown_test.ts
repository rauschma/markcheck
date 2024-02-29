import { outdent } from '@rauschma/helpers/js/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { LineMod, snippetJson } from './entities.js';
import { extractCommentContent, parseMarkdown } from './parse-markdown.js';

createSuite(import.meta.url);

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
