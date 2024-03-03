import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
const { runParsedMarkdownForTests } = await import('../src/util/test-tools.js');

createSuite(import.meta.url);

test('Assemble sequence', () => {
  const readme = outdent`
    <!--marktest sequence="1/3"-->
    ▲▲▲js
    // Part 1
    ▲▲▲
    
    <!--marktest sequence="2/3"-->
    ▲▲▲js
    // Part 2
    ▲▲▲
    
    <!--marktest sequence="3/3"-->
    ▲▲▲js
    // Part 3
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/marktest-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  assert.equal(
    runParsedMarkdownForTests('/tmp/markdown/readme.md', readme).getTotalCount(),
    0
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/marktest-data/tmp', { trimEndsOfFiles: true }),
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
