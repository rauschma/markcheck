import { jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
import type { MockShellData } from '../src/entity/snippet.js';
const { runParsedMarkdownForTests } = await import('../src/util/test-tools.js');

createSuite(import.meta.url);

test('stdout: success', () => {
  const readme = outdent`
    <!--markcheck stdout="|modify-stdout=expected-stdout" onlyLocalLines-->
    ▲▲▲js
    console.log('red');
    console.log('green');
    console.log('blue');
    ▲▲▲

    <!--markcheck id="expected-stdout"-->
    ▲▲▲
    🟢
    ▲▲▲

    <!--markcheck lineModId="modify-stdout" ignoreLines="'red', 'blue'" searchAndReplace="/green/🟢/"-->
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  // We don’t actually run the code, we only state what its output would be
  // – if it were to run!
  const mockShellData: MockShellData = {
    interceptedCommands: [],
    commandResults: [
      {
        stdout: 'red\ngreen\nblue',
        stderr: '',
        status: 0,
        signal: null,
      }
    ],
  };
  assert.ok(
    runParsedMarkdownForTests('/tmp/markdown/readme.md', readme, mockShellData).hasSucceeded()
  );
});

test('stdout: failure', () => {
  const readme = outdent`
    <!--markcheck stdout="|modify-stdout=expected-stdout" onlyLocalLines-->
    ▲▲▲js
    console.log('red');
    console.log('green');
    console.log('blue');
    ▲▲▲

    <!--markcheck id="expected-stdout"-->
    ▲▲▲
    black
    ▲▲▲

    <!--markcheck lineModId="modify-stdout" ignoreLines="1, -1"-->
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {},
    '/tmp/markdown/readme.md': readme,
  });

  const mockShellData: MockShellData = {
    interceptedCommands: [],
    commandResults: [
      {
        stdout: 'red\ngreen\nblue',
        stderr: '',
        status: 0,
        signal: null,
      }
    ],
  };
  assert.deepEqual(
    runParsedMarkdownForTests('/tmp/markdown/readme.md', readme, mockShellData).toJson(),
    {
      relFilePath: '/tmp/markdown/readme.md',
      syntaxErrors: 0,
      testFailures: 1,
      warnings: 0,
    }
  );
});
