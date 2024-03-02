import { outdent } from '@rauschma/helpers/js/outdent-template-tag.js';
import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { FileStatus, LogLevel } from '../src/entity/snippet.js';
import { outputIgnored } from '../src/core/run-snippets.js';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
const { parseMarkdown } = await import('../src/core/parse-markdown.js');
const { runFile } = await import('../src/core/run-snippets.js');

createSuite(import.meta.url);

test('Included snippet', () => {
  const readme = outdent`
    <!--marktest include="helper"-->
    ▲▲▲node-repl
    > twice('abc')
    'abcabc'
    ▲▲▲
    
    <!--marktest id="helper"-->
    ▲▲▲js
    function twice(str) { return str + str }
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/marktest-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  const pmr = parseMarkdown(readme);
  assert.equal(
    runFile(outputIgnored(), LogLevel.Normal, '/tmp/markdown/readme.md', pmr, []),
    FileStatus.Success
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/marktest-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
        import assert from 'node:assert/strict';
        function twice(str) { return str + str }
        assert.deepEqual(
        twice('abc')
        ,
        'abcabc'
        );
      `,
    }
  );
});

test('Included snippet with `before:`', () => {
  const readme = outdent`
    <!--marktest id="httpGet" before:
    import {XMLHttpRequest} from 'some-lib';
    -->
    ▲▲▲js
    function httpGet(url) {
      const xhr = new XMLHttpRequest();
    }
    ▲▲▲

    <!--marktest include="httpGet" before:
    import nock from 'nock';
    -->
    ▲▲▲js
    await httpGet('http://example.com/textfile.txt');
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/marktest-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  const pmr = parseMarkdown(readme);
  assert.equal(
    runFile(outputIgnored(), LogLevel.Normal, '/tmp/markdown/readme.md', pmr, []),
    FileStatus.Success
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/marktest-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
        import assert from 'node:assert/strict';
        import {XMLHttpRequest} from 'some-lib';
        function httpGet(url) {
          const xhr = new XMLHttpRequest();
        }
        import nock from 'nock';
        await httpGet('http://example.com/textfile.txt');
      `,
    }
  );
});
