import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { dirToJson, jsonToCleanDir } = await import('@rauschma/nodejs-tools/testing/dir-json.js');
const { runMarkdownForTests } = await import('../test-tools.js');

createSuite(import.meta.url);

test('node-repl: normal interaction', () => {
  const readme = outdent`
    ▲▲▲node-repl
    > Error.prototype.name
    'Error'
    > RangeError.prototype.name
    'RangeError'
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

test('node-repl: exceptions', () => {
  const readme = outdent`
    ▲▲▲node-repl
    > structuredClone(() => {})
    DOMException [DataCloneError]: () => {} could not be cloned.
    > null.prop
    TypeError: Cannot read properties of null (reading 'prop')
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
        structuredClone(() => {})
        },
        {"name":"DOMException","message":"() => {} could not be cloned."}
        );
        assert.throws(
        () => {
        null.prop
        },
        {"name":"TypeError","message":"Cannot read properties of null (reading 'prop')"}
        );
      `,
    }
  );
});
