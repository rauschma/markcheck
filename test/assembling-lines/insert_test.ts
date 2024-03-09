import { dirToJson, jsonToCleanDir } from '@rauschma/nodejs-tools/testing/dir-json.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { runMarkdownForTests } = await import('../../src/util/test-tools.js');

createSuite(import.meta.url);

test('Insert single line at a line number (body LineMod)', () => {
  const readme = outdent`
    <!--markcheck at="before:2" insert:
    err.stack = beautifyStackTrace(err.stack);
    -->
    ▲▲▲js
    const err = new Error('Hello!');
    assert.equal(err.stack, 'the-stack-trace');
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
        const err = new Error('Hello!');
        err.stack = beautifyStackTrace(err.stack);
        assert.equal(err.stack, 'the-stack-trace');
      `,
    }
  );
});

test('Insert single line at a line number (applyToBody LineMod)', () => {
  const readme = outdent`
    <!--markcheck applyToBody="beautifyStackTrace"-->
    ▲▲▲js
    const err = new Error('Hello!');
    assert.equal(err.stack, 'the-stack-trace');
    ▲▲▲

    <!--markcheck lineModId="beautifyStackTrace" at="before:2" insert:
    err.stack = beautifyStackTrace(err.stack);
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
    dirToJson(mfs, '/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
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
    <!--markcheck at="before:1, after:1, after:-1" insert:
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
    <!--markcheck at="before:'first', after:'first', after:'second'" insert:
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
        // START
        // first
        // MIDDLE
        // second
        // END
      `,
    }
  );
});
