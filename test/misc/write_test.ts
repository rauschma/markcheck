import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { dirToJson, jsonToCleanDir } = await import('@rauschma/nodejs-tools/testing/dir-json.js');
const { runMarkdownForTests } = await import('../test-tools.js');

createSuite(import.meta.url);

test('writeLocalLines', () => {
  const readme = outdent`
    <!--markcheck writeLocalLines="code.js" lang="js" body:
    // JavaScript code
    -->
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
      'code.js': outdent`
        // JavaScript code
      `,
    }
  );
});

test('write', () => {
  const readme = outdent`
    <!--markcheck write="code.js" lang="js" body:
    // JavaScript code
    -->
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
      'code.js': outdent`
        import assert from 'node:assert/strict';
        // JavaScript code
      `,
    }
  );
});