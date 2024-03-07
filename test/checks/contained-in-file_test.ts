import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
const { runMarkdownForTests } = await import('../../src/util/test-tools.js');

createSuite(import.meta.url);

test('containedInFile: success', () => {
  const readme = outdent`
    <!--markcheck containedInFile="other.js" skip-->
    ▲▲▲js
    // green
    // blue
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
    '/tmp/markdown/other.js': outdent`
      // red
      // green
      // blue
    `,
  });

  assert.ok(
    runMarkdownForTests('/tmp/markdown/readme.md', readme).hasSucceeded()
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
    }
  );
});


test('containedInFile: failure', () => {
  const readme = outdent`
    <!--markcheck containedInFile="other.js" skip-->
    ▲▲▲js
    // black
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
    '/tmp/markdown/other.js': outdent`
      // red
      // green
      // blue
    `,
  });

  assert.deepEqual(
    runMarkdownForTests('/tmp/markdown/readme.md', readme).toJson(),
    {
      relFilePath: '/tmp/markdown/readme.md',
      syntaxErrors: 0,
      testFailures: 1,
      warnings: 0,
    }
  );
});
