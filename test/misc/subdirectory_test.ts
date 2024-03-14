import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { dirToJson, jsonToCleanDir } = await import('@rauschma/nodejs-tools/testing/dir-json.js');
const { runMarkdownForTests } = await import('../test-tools.js');

createSuite(import.meta.url);

test('Subdirectory: writeLocalLines', () => {
  const readme = outdent`
    <!--markcheck writeLocalLines="dir/code.js" lang="js" body:
    // JavaScript code
    -->
  `;
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
      'dir': {
        'code.js': outdent`
          // JavaScript code
        `,
      },
    }
  );
});

test('Subdirectory: write', () => {
  const readme = outdent`
    <!--markcheck write="dir/code.js" lang="js" body:
    // JavaScript code
    -->
  `;
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
      'dir': {
        'code.js': outdent`
          import assert from 'node:assert/strict';
          // JavaScript code
        `,
      },
    }
  );
});

test('Subdirectory: runFileName, external', () => {
  const readme = outdent`
    <!--markcheck runFileName="dir/my-code.js" external="other>dir/other.js" -->
    ▲▲▲js
    import {func} from './other.js';
    ▲▲▲

    <!--markcheck id="other" -->
    ▲▲▲js
    export func() {}
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
      'dir': {
        'my-code.js': outdent`
          import assert from 'node:assert/strict';
          import {func} from './other.js';
        `,
        'other.js': outdent`
          import assert from 'node:assert/strict';
          export func() {}
        `,
      },
    }
  );
});

test('Subdirectory: runFileName, externalLocalLines', () => {
  const readme = outdent`
    <!--markcheck runLocalLines runFileName="dir/my-code.js" externalLocalLines="other>dir/other.js" -->
    ▲▲▲js
    import {func} from './other.js';
    ▲▲▲

    <!--markcheck id="other" -->
    ▲▲▲js
    export func() {}
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
      'dir': {
        'my-code.js': outdent`
          import {func} from './other.js';
        `,
        'other.js': outdent`
          export func() {}
        `,
      },
    }
  );
});
