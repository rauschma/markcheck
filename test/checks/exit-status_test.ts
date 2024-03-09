import { jsonToCleanDir } from '@rauschma/nodejs-tools/testing/dir-json.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
import type { MockShellData } from '../../src/entity/snippet.js';
const { runMarkdownForTests } = await import('../../src/util/test-tools.js');

createSuite(import.meta.url);

test('exitStatus: expecting 0 fails if actual is 1', () => {
  const readme = outdent`
    <!--markcheck exitStatus="0" runLocalLines-->
    ▲▲▲js
    process.exit(1);
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  // We don’t actually run the code, we only state what its output would be
  // – if it were to run!
  const mockShellData: MockShellData = {
    interceptedCommands: [],
    lastCommandResult: {
      stdout: '',
      stderr: '',
      status: 1,
      signal: null,
    },
  };
  assert.equal(
    runMarkdownForTests('/tmp/markdown/readme.md', readme, { mockShellData }).testFailures,
    1
  );
});

test('exitStatus: expecting "nonzero" succeeds if actual is 1', () => {
  const readme = outdent`
    <!--markcheck exitStatus="nonzero" runLocalLines-->
    ▲▲▲js
    process.exit(1);
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  // We don’t actually run the code, we only state what its output would be
  // – if it were to run!
  const mockShellData: MockShellData = {
    interceptedCommands: [],
    lastCommandResult: {
      stdout: '',
      stderr: '',
      status: 1,
      signal: null,
    },
  };
  assert.equal(
    runMarkdownForTests('/tmp/markdown/readme.md', readme, { mockShellData }).testFailures,
    0
  );
});
