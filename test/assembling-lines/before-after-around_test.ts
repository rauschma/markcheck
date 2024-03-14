import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { dirToJson, jsonToCleanDir } = await import('@rauschma/nodejs-tools/testing/dir-json.js');
const { runMarkdownForTests } = await import('../test-tools.js');

createSuite(import.meta.url);

test('before', () => {
  const readme = outdent`
    <!--markcheck runLocalLines before:
    // BEFORE
    -->
    ▲▲▲js
    console.log('body');
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
    dirToJson('/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
        // BEFORE
        console.log('body');
      `,
    }
  );
});

test('after', () => {
  const readme = outdent`
    <!--markcheck runLocalLines after:
    // AFTER
    -->
    ▲▲▲js
    console.log('body');
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
    dirToJson('/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
        console.log('body');
        // AFTER
      `,
    }
  );
});

test('around', () => {
  const readme = outdent`
    <!--markcheck around:
    assert.throws(
      () => {
        •••
      }
    );
    -->
    ▲▲▲js
    throw new Error();
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
    dirToJson('/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
        import assert from 'node:assert/strict';
        assert.throws(
          () => {
        throw new Error();
          }
        );
      `,
    }
  );
});
