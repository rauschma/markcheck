import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
const { runParsedMarkdownForTests } = await import('../src/util/test-tools.js');

createSuite(import.meta.url);

test('searchAndReplace', () => {
  const readme = outdent`
    ▲▲▲node-repl
    > Error.prototype.name
    'Error'
    > RangeError.prototype.name
    'RangeError'
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
        assert.deepEqual(
        Error.prototype.name
        ,
        'Error'
        );
        assert.deepEqual(
        RangeError.prototype.name
        ,
        'RangeError'
        );
      `,
    }
  );
});
