import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import { jsonToCleanDir } from '@rauschma/nodejs-tools/testing/dir-json.js';
import assert from 'node:assert/strict';
import * as util from 'node:util';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { EntityContextLineNumber, MarkcheckSyntaxError } = await import('../../src/util/errors.js');
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
      context: new EntityContextLineNumber(5),
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
      context: new EntityContextLineNumber(2),
    }
  );
});
