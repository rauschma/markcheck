import { outdent } from '@rauschma/helpers/js/outdent-template-tag.js';
import { assertTrue } from '@rauschma/helpers/ts/type.js';
import assert from 'node:assert/strict';
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
  const lines = assembleLinesForFirstSnippet(
    outdent`
      <!--marktest include="helper"-->
      ◆◆◆node-repl
      > twice("abc")
      "abcabc"
      ◆◆◆
      
      <!--marktest id="helper"-->
      ◆◆◆js
      function twice(str) { return str + str }
      ◆◆◆
    `.replaceAll('◆', '`')
  );
  assert.deepEqual(
    lines,
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
  const lines = assembleLinesForFirstSnippet(
    outdent`
      <!--marktest sequence="1/3"-->
      ◆◆◆js
      // Part 1
      ◆◆◆
      
      <!--marktest sequence="2/3"-->
      ◆◆◆js
      // Part 2
      ◆◆◆
      
      <!--marktest sequence="3/3"-->
      ◆◆◆js
      // Part 3
      ◆◆◆
    `.replaceAll('◆', '`')
  );
  assert.deepEqual(
    lines,
    [
      "import assert from 'node:assert/strict';",
      '// Part 1',
      '// Part 2',
      '// Part 3',
    ]
  );
});

function assembleLinesForFirstSnippet(md: string): Array<string> {
  const { entities, idToSnippet, idToLineMod } = parseMarkdown(md);
  const snippet = entities[0];
  assertTrue(snippet instanceof SequenceSnippet);
  const cliState = {
    ...createTestCliState(),
    idToSnippet,
    idToLineMod,
  };
  const config = new Config();
  return assembleLines(cliState, config, snippet);
}