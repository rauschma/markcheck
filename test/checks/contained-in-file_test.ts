import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { dirToJson, jsonToCleanDir } = await import('@rauschma/nodejs-tools/testing/dir-json.js');
const { MarkcheckMockData } = await import('../../src/entity/snippet.js');
const { runMarkdownForTests } = await import('../test-tools.js');

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
    dirToJson('/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {}
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

  const markcheckMockData = new MarkcheckMockData().withPassOnUserExceptions(false);
  assert.deepEqual(
    runMarkdownForTests('/tmp/markdown/readme.md', readme, {markcheckMockData}).toJson(),
    {
      relFilePath: '/tmp/markdown/readme.md',
      testSuccesses: 0,
      testFailures: 1,
      syntaxErrors: 0,
      warnings: 0,
    }
  );
});
