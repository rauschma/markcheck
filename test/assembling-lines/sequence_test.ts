import { dirToJson, jsonToCleanDir } from '@rauschma/nodejs-tools/testing/dir-json.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { runMarkdownForTests } = await import('../../src/util/test-tools.js');

createSuite(import.meta.url);

test('Assemble sequence', () => {
  const readme = outdent`
    <!--markcheck sequence="1/3"-->
    ▲▲▲js
    // Part 1
    ▲▲▲
    
    <!--markcheck sequence="2/3"-->
    ▲▲▲js
    // Part 2
    ▲▲▲
    
    <!--markcheck sequence="3/3"-->
    ▲▲▲js
    // Part 3
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
        // Part 1
        // Part 2
        // Part 3
      `,
    }
  );
});
