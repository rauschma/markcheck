import { jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
const { runMarkdownForTests } = await import('../../src/util/test-tools.js');

createSuite(import.meta.url);

test('Duplicate `id`', () => {
  const readme = outdent`
    <!--markcheck id="used-twice"-->
    ▲▲▲js
    ▲▲▲

    <!--markcheck id="used-twice"-->
    ▲▲▲js
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  assert.throws(
    () => runMarkdownForTests('/tmp/markdown/readme.md', readme),
    {
      name: 'MarkcheckSyntaxError',
      message: `Duplicate "id": "used-twice" (other usage is L1 (js))`,
      context: {
        kind: 'EntityContextLineNumber',
        lineNumber: 5,
      },
    }
  );
});

test('Duplicate `lineModId`', () => {
  const readme = outdent`
    <!--markcheck lineModId="used-twice"-->
    <!--markcheck lineModId="used-twice"-->
  `;
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  assert.throws(
    () => runMarkdownForTests('/tmp/markdown/readme.md', readme),
    {
      name: 'MarkcheckSyntaxError',
      message: 'Duplicate "lineModId": "used-twice" (other usage is L1)',
      context: {
        kind: 'EntityContextLineNumber',
        lineNumber: 2,
      },
    }
  );
});
