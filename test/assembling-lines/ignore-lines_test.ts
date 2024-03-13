import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { dirToJson, jsonToCleanDir } = await import('@rauschma/nodejs-tools/testing/dir-json.js');
const { runMarkdownForTests } = await import('../../src/util/test-tools.js');

createSuite(import.meta.url);

test('ignoreLines: line numbers (internal LineMod)', () => {
  const readme = outdent`
    <!--markcheck runLocalLines ignoreLines="1..2, -1"-->
    ▲▲▲js
    // one
    // two
    // three
    // four
    // five
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
        // three
        // four
      `,
    }
  );
});

test('ignoreLines: line numbers (applyToBody LineMod)', () => {
  const readme = outdent`
    <!--markcheck runLocalLines applyToBody="applied-LineMod"-->
    ▲▲▲js
    // one
    // two
    // three
    // four
    // five
    ▲▲▲

    <!--markcheck lineModId="applied-LineMod" ignoreLines="1..2, -1"-->
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
        // three
        // four
      `,
    }
  );
});

test('ignoreLines: text fragments', () => {
  const readme = outdent`
    <!--markcheck runLocalLines ignoreLines="'two', 'four'..'five'"-->
    ▲▲▲js
    // one
    // two
    // three
    // four
    // five
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
        // one
        // three
      `,
    }
  );
});
