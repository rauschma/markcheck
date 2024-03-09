import { dirToJson, jsonToCleanDir } from '@rauschma/nodejs-tools/testing/dir-json.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { runMarkdownForTests } = await import('../../src/util/test-tools.js');

createSuite(import.meta.url);

test('searchAndReplace slashes', () => {
  const readme = outdent`
    <!--markcheck searchAndReplace="/ \/\/ \([A-Z]\)//"-->
    ▲▲▲js
    console.log('First'); // (A)
    console.log('Second'); // (B)
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  assert.ok(
    runMarkdownForTests('/tmp/markdown/readme.md', readme).hasSucceeded()
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
        import assert from 'node:assert/strict';
        console.log('First');
        console.log('Second');
      `,
    }
  );
});

test('searchAndReplace double quotes', () => {
  const readme = outdent`
    <!--markcheck searchAndReplace="/\"/X/" runLocalLines-->
    ▲▲▲js
    "abc"
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  assert.ok(
    runMarkdownForTests('/tmp/markdown/readme.md', readme).hasSucceeded()
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
        XabcX
      `,
    }
  );
});

test('searchAndReplace not ignoring case', () => {
  const readme = outdent`
    <!--markcheck writeLocal="text-file.txt" searchAndReplace="/[abc]/x/"-->
    ▲▲▲txt
    AaBbZz
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  assert.ok(
    runMarkdownForTests('/tmp/markdown/readme.md', readme).hasSucceeded()
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'text-file.txt': outdent`
        AxBxZz
      `,
    }
  );
});

test('searchAndReplace ignoring case', () => {
  const readme = outdent`
    <!--markcheck writeLocal="text-file.txt" searchAndReplace="/[abc]/x/i"-->
    ▲▲▲txt
    AaBbZz
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  assert.ok(
    runMarkdownForTests('/tmp/markdown/readme.md', readme).hasSucceeded()
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'text-file.txt': outdent`
        xxxxZz
      `,
    }
  );
});

test('searchAndReplace via applyToBody LineMod', () => {
  const readme = outdent`
    <!--markcheck writeLocal="text-file.txt" applyToBody="applied-LineMod"-->
    ▲▲▲txt
    ABC
    ▲▲▲

    <!--markcheck lineModId="applied-LineMod" searchAndReplace="/B/X/"-->
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  assert.ok(
    runMarkdownForTests('/tmp/markdown/readme.md', readme).hasSucceeded()
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'text-file.txt': outdent`
        AXC
      `,
    }
  );
});
