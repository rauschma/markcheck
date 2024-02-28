import { outdent } from '@rauschma/helpers/js/outdent-template-tag.js';
import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { FileStatus, LogLevel } from '../src/core/entities.js';
import { outputIgnored } from '../src/core/run-snippets.js';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
const { parseMarkdown } = await import('../src/core/parse-markdown.js');
const { runFile } = await import('../src/core/run-snippets.js');

createSuite(import.meta.url);

test('ignoreLines: success', () => {
  const readme = outdent`
    <!--marktest containedIn="other.js"-->
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

  const pmr = parseMarkdown(readme);
  assert.equal(
    runFile(outputIgnored(), LogLevel.Normal, '/tmp/markdown/readme.md', pmr, []),
    FileStatus.Success
  );
  assert.deepEqual(
    dirToJson(mfs, '/tmp/marktest-data/tmp', { trimEndsOfFiles: true }),
    {
    }
  );
});


test('ignoreLines: failure', () => {
  const readme = outdent`
    <!--marktest containedIn="other.js"-->
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

  const pmr = parseMarkdown(readme);
  assert.throws(
    () => runFile(outputIgnored(), LogLevel.Normal, '/tmp/markdown/readme.md', pmr, []),
    {
      name: 'UserError',
      message: 'Content of snippet is not contained in "/tmp/markdown/other.js"',
    }
  );
});
