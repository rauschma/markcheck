import { outdent } from '@rauschma/helpers/js/outdent-template-tag.js';
import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
import { outputIgnored } from '../src/core/run-snippets.js';
const { FileStatus, LogLevel } = await import('../src/core/entities.js');
const { parseMarkdown } = await import('../src/core/parse-markdown.js');
const { runFile } = await import('../src/core/run-snippets.js');

createSuite(import.meta.url);

test('Assemble lines with line mods', () => {
  const readme = outdent`
    <!--marktest each="js" around:
    // Global line mod BEFORE
    •••
    // Global line mod AFTER
    -->

    <!--marktest include="other" applyInner="inner-line-mod" applyOuter="outer-line-mod" around:
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
    
    <!--marktest id="inner-line-mod" around:
    // Inner line mod BEFORE
    •••
    // Inner line mod AFTER
    -->
    <!--marktest id="outer-line-mod" around:
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
            "": "[neverRun]",
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

  const pmr = parseMarkdown(readme);
  const interceptedShellCommands = new Array<Array<string>>();
  assert.equal(
    runFile(outputIgnored(), LogLevel.Normal, '/tmp/markdown/readme.md', pmr, interceptedShellCommands),
    FileStatus.Success
  );
  // Per file: config lines, global line mods
  // Per snippet: applied line mod, local line mod
  assert.deepEqual(
    dirToJson(mfs, '/tmp/marktest-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
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
    interceptedShellCommands,
    [
      ['js-command1 main.mjs', 'js-command2 main.mjs'],
    ]
  );
});
