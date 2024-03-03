import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
const { runParsedMarkdownForTests } = await import('../src/util/test-tools.js');

createSuite(import.meta.url);

test('containedInFile: success', () => {
  const readme = outdent`
    <!--marktest containedInFile="other.js" skip-->
    ▲▲▲js
    // green
    // blue
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/marktest-data': {},
    '/tmp/markdown/readme.md': readme,
    '/tmp/markdown/other.js': outdent`
      // red
      // green
      // blue
    `,
  });

  assert.equal(
    runParsedMarkdownForTests('/tmp/markdown/readme.md', readme).getTotalCount(),
    0
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/marktest-data/tmp', { trimEndsOfFiles: true }),
    {
    }
  );
});


test('containedInFile: failure', () => {
  const readme = outdent`
    <!--marktest containedInFile="other.js" skip-->
    ▲▲▲js
    // black
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/marktest-data': {},
    '/tmp/markdown/readme.md': readme,
    '/tmp/markdown/other.js': outdent`
      // red
      // green
      // blue
    `,
  });

  assert.throws(
    () => runParsedMarkdownForTests('/tmp/markdown/readme.md', readme),
    {
      name: 'UserError',
      message: 'Content of snippet is not contained in file "/tmp/markdown/other.js"',
    }
  );
});
