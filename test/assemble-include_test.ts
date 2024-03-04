import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
const { runParsedMarkdownForTests } = await import('../src/util/test-tools.js');

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

  assert.ok(
    runParsedMarkdownForTests('/tmp/markdown/readme.md', readme).hasSucceeded()
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

  assert.ok(
    runParsedMarkdownForTests('/tmp/markdown/readme.md', readme).hasSucceeded()
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

test('Assembling code fragments out of order', () => {
  const readme = outdent`
    <!--marktest include="step1, step2, $THIS"-->
    ▲▲▲js
    steps.push('Step 3');

    assert.deepEqual(
      steps,
      ['Step 1', 'Step 2', 'Step 3']
    );
    ▲▲▲

    <!--marktest id="step1"-->
    ▲▲▲js
    const steps = [];
    steps.push('Step 1');
    ▲▲▲

    <!--marktest id="step2"-->
    ▲▲▲js
    steps.push('Step 2');
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/marktest-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  assert.ok(
    runParsedMarkdownForTests('/tmp/markdown/readme.md', readme).hasSucceeded()
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/marktest-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
        import assert from 'node:assert/strict';
        const steps = [];
        steps.push('Step 1');
        steps.push('Step 2');
        steps.push('Step 3');

        assert.deepEqual(
          steps,
          ['Step 1', 'Step 2', 'Step 3']
        );
      `,
    }
  );
});
