import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { dirToJson, jsonToCleanDir } = await import('@rauschma/nodejs-tools/testing/dir-json.js');
const { MarkcheckMockData } = await import('../../src/entity/snippet.js');
const { runMarkdownForTests } = await import('../../src/util/test-tools.js');

createSuite(import.meta.url);

test('ConfigMod: success', () => {
  const readme = outdent`
    <!--markcheck config:
    {
      "lang": {
        "js": {
          "extends": "babel",
        },
      },
    }
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
    }
  );
});

test('ConfigMod: unknown properties', () => {
  const readme = outdent`
    <!--markcheck config:
    {
      "propDoesNotExist": true,
    }
    -->
  `;
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  const markcheckMockData = new MarkcheckMockData({
    passOnUserExceptions: false,
  });
  assert.throws(
    () => runMarkdownForTests('/tmp/markdown/readme.md', readme, {markcheckMockData}),
    {
      name: 'MarkcheckSyntaxError',
      message: /^Config properties are wrong:/,
    }
  );
});

test('ConfigMod: malformed JSON5', () => {
  const readme = outdent`
    <!--markcheck config:
    This is not JSON5
    -->
  `;
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  const markcheckMockData = new MarkcheckMockData({
    passOnUserExceptions: false,
  });
  assert.throws(
    () => runMarkdownForTests('/tmp/markdown/readme.md', readme, {markcheckMockData}),
    {
      name: 'MarkcheckSyntaxError',
      message: /^Error while parsing JSON5 config data:/,
    }
  );
});
