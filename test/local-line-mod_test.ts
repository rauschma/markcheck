import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
const { runParsedMarkdownForTests } = await import('../src/util/test-tools.js');

createSuite(import.meta.url);

test('Insert single line at line numbers', () => {
  const readme = outdent`
    <!--marktest at="before:2" insert:
    err.stack = beautifyStackTrace(err.stack);
    -->
    ▲▲▲js
    const err = new Error('Hello!');
    assert.equal(err.stack, 'the-stack-trace');
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
        const err = new Error('Hello!');
        err.stack = beautifyStackTrace(err.stack);
        assert.equal(err.stack, 'the-stack-trace');
      `,
    }
  );
});

test('Insert multiple lines at line numbers', () => {
  const readme = outdent`
    <!--marktest at="before:1, after:1, after:-1" insert:
    // START
    •••
    // MIDDLE
    •••
    // END
    -->
    ▲▲▲js
    // first
    // second
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
        // START
        // first
        // MIDDLE
        // second
        // END
      `,
    }
  );
});


test('Insert multiple lines at text fragments', () => {
  const readme = outdent`
    <!--marktest at="before:'first', after:'first', after:'second'" insert:
    // START
    •••
    // MIDDLE
    •••
    // END
    -->
    ▲▲▲js
    // first
    // second
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
        // START
        // first
        // MIDDLE
        // second
        // END
      `,
    }
  );
});

test('around', () => {
  const readme = outdent`
<!--marktest around:
assert.throws(
  () => {
    •••
  }
);
-->
▲▲▲js
throw new Error();
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
        assert.throws(
          () => {
        throw new Error();
          }
        );
      `,
    }
  );
});
