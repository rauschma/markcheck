import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { dirToJson, jsonToCleanDir } = await import('@rauschma/nodejs-tools/testing/dir-json.js');
const { runMarkdownForTests } = await import('../test-tools.js');

createSuite(import.meta.url);

test('Indented directive', () => {
  const readme = outdent`
    1. Positional parameters:

       <!--markcheck before:
       const selectEntries = () => {};
       -->
       ▲▲▲js
       selectEntries(3, 20, 2)
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
        const selectEntries = () => {};
        selectEntries(3, 20, 2)
      `,
    }
  );
});
