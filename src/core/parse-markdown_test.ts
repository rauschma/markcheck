import { splitLinesExclEol } from '@rauschma/helpers/string/line.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';
import { Directive } from '../entity/directive.js';
import { LineModLanguage } from '../entity/line-mod.js';
import { MarkcheckSyntaxError } from '../util/errors.js';
import { directiveToEntity, extractCommentContent, parseMarkdown } from './parse-markdown.js';

createSuite(import.meta.url);

test('extractCommentContent()', () => {
  assert.equal(
    extractCommentContent('<!--ABC-->'),
    'ABC'
  );
  assert.equal(
    extractCommentContent('<!--First line\nSecond line\n-->\n'),
    'First line\nSecond line\n'
  );
});

test('parseMarkdown(): LineMod', () => {
  const { entities } = parseMarkdown(outdent`
    <!--markcheck each="js" around:
    Line before
    •••
    Line after
    -->
  `);
  const lineMod = entities[0];
  assert.ok(lineMod instanceof LineModLanguage);
  assert.deepEqual(
    lineMod.toJson(),
    {
      targetLanguage: 'js',
      beforeLines: [
        'Line before'
      ],
      afterLines: [
        'Line after'
      ],
    }
  );
});

test('parseMarkdown(): heading followed by code block', () => {
  const { entities } = parseMarkdown(
    outdent`
      ## Creating Arrays
      ▲▲▲js
      const arr = [];
      ▲▲▲
      -->
    `.replaceAll('▲', '`')
  );
  assert.deepEqual(
    entities.map(e => e.toJson()),
    [
      {
        heading: 'Creating Arrays',
      },
      {
        body: [
          'const arr = [];'
        ],
        define: null,
        external: [],
        id: null,
        lang: 'js',
        lineNumber: 2,
        stderr: null,
        stdout: null,
      }
    ]
  );
});

test('directiveToEntity(): complain about illegal attributes', () => {
  const text = extractCommentContent('<!--markcheck ignore_imports-->');
  assert.ok(text !== null);
  const directive = Directive.parse(1, splitLinesExclEol(text));
  assert.ok(directive !== null);
  assert.throws(
    () => directiveToEntity(directive),
    MarkcheckSyntaxError
  );
});
