import { outdent } from '@rauschma/helpers/js/outdent-template-tag.js';
import { assertTrue } from '@rauschma/helpers/ts/type.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Config } from './config.js';
import { SequenceSnippet, SingleSnippet, assembleLines, createTestCliState } from './entities.js';
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

test('Assemble includes', () => {
  const { entities, idToSnippet } = parseMarkdown(
    outdent`
      <!--marktest include="helper"-->
      •••node-repl
      > twice("abc")
      "abcabc"
      •••
      
      <!--marktest id="helper"-->
      •••js
      function twice(str) { return str + str }
      •••
    `.replaceAll('•', '`')
  );
  const snippet = entities[0];
  assertTrue(snippet instanceof SingleSnippet);

  const cliState = {
    ...createTestCliState(),
    idToSnippet,
  };
  const config = new Config();
  assert.deepEqual(
    assembleLines(cliState, config, snippet),
    [
      "import assert from 'node:assert/strict';",
      'function twice(str) { return str + str }',
      'assert.deepEqual(',
      'twice("abc")',
      ',',
      '"abcabc"',
      ');',
    ]
  );
});

test('Assemble sequence', () => {
  const { entities, idToSnippet } = parseMarkdown(
    outdent`
      <!--marktest sequence="1/3"-->
      •••js
      // Part 1
      •••
      
      <!--marktest sequence="2/3"-->
      •••js
      // Part 2
      •••
      
      <!--marktest sequence="3/3"-->
      •••js
      // Part 3
      •••
    `.replaceAll('•', '`')
  );
  const snippet = entities[0];
  assertTrue(snippet instanceof SequenceSnippet);
  const cliState = {
    ...createTestCliState(),
    idToSnippet,
  };
  const config = new Config();
  assert.deepEqual(
    assembleLines(cliState, config, snippet),
    [
      '// Part 1',
      '// Part 2',
      '// Part 3',
    ]
  );
});
