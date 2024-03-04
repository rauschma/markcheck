import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
import { emptyMockShellData } from '../src/entity/snippet.js';
const { runParsedMarkdownForTests } = await import('../src/util/test-tools.js');

createSuite(import.meta.url);

test('Assemble lines with line mods', () => {
  const readme = outdent`
    <!--marktest each="js" around:
    // Global line mod BEFORE
    •••
    // Global line mod AFTER
    -->

    <!--marktest include="other" applyInner="inner-line-mod" applyOuter="outer-line-mod" internal="my-module.mjs" around:
    // Local line mod BEFORE
    •••
    // Local line mod AFTER
    -->
    ▲▲▲js
    console.log('Main snippet');
    ▲▲▲

    <!--marktest id="other"-->
    ▲▲▲js
    //
    console.log('Included snippet');
    //
    ▲▲▲
    
    <!--marktest lineModId="inner-line-mod" around:
    // Inner line mod BEFORE
    •••
    // Inner line mod AFTER
    -->
    <!--marktest lineModId="outer-line-mod" around:
    // Outer line mod BEFORE
    •••
    // Outer line mod AFTER
    -->
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/marktest-data': {
      'marktest-config.jsonc': outdent`
        {
          "lang": {
            "": "[skip]",
            "js": {
              "before": [
                "// Config line BEFORE"
              ],
              "defaultFileName": "main.mjs",
              "commands": [
                [ "js-command1", "$FILE_NAME" ],
                [ "js-command2", "$FILE_NAME" ],
              ]
            },
          },
        }
      `,
    },
    '/tmp/markdown/readme.md': readme,
  });

  const mockShellData = emptyMockShellData();
  assert.equal(
    runParsedMarkdownForTests('/tmp/markdown/readme.md', readme, mockShellData).getTotalCount(),
    0
  );
  // Per file: config lines, global line mods
  // Per snippet: applied line mod, local line mod
  assert.deepEqual(
    dirToJson(mfs, '/tmp/marktest-data/tmp', { trimEndsOfFiles: true }),
    {
      'my-module.mjs': outdent`
        // Config line BEFORE
        // Global line mod BEFORE
        // Outer line mod BEFORE
        //
        console.log('Included snippet');
        //
        // Inner line mod BEFORE
        // Local line mod BEFORE
        console.log('Main snippet');
        // Local line mod AFTER
        // Inner line mod AFTER
        // Outer line mod AFTER
        // Global line mod AFTER
      `,
    }
  );
  assert.deepEqual(
    mockShellData.interceptedCommands,
    [
      'js-command1 my-module.mjs',
      'js-command2 my-module.mjs',
    ]
  );
});
