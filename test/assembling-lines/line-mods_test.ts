import { dirToJson, jsonToCleanDir } from '@rauschma/helpers/nodejs/dir-json.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/helpers/nodejs/install-mem-node-fs.js';
import { emptyMockShellData } from '../../src/entity/snippet.js';
const { runParsedMarkdownForTests } = await import('../../src/util/test-tools.js');

createSuite(import.meta.url);

test('Assemble snippet with body LineMod', () => {
  const readme = outdent`
    <!--markcheck each="js" around:
    // Language LineMod BEFORE
    •••
    // Language LineMod AFTER
    -->

    <!--markcheck include="included-snippet" applyToOuter="outer-line-mod" internal="my-module.mjs" around:
    // Body LineMod BEFORE
    •••
    // Body LineMod AFTER
    -->
    ▲▲▲js
    // Body
    ▲▲▲

    <!--markcheck id="included-snippet"-->
    ▲▲▲js
    // Included snippet
    ▲▲▲

    <!--markcheck lineModId="outer-line-mod" around:
    // Outer applied LineMod BEFORE
    •••
    // Outer applied LineMod AFTER
    -->
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {
      'markcheck-config.jsonc': outdent`
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
    runParsedMarkdownForTests('/tmp/markdown/readme.md', readme, { mockShellData }).getTotalCount(),
    0
  );
  // Per file: config lines, language LineMods
  // Per snippet: applied line mod, local line mod
  assert.deepEqual(
    dirToJson(mfs, '/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'my-module.mjs': outdent`
        // Config line BEFORE
        // Language LineMod BEFORE
        // Outer applied LineMod BEFORE
        // Included snippet
        // Body LineMod BEFORE
        // Body
        // Body LineMod AFTER
        // Outer applied LineMod AFTER
        // Language LineMod AFTER
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

test('Assemble snippet with applyToBody LineMod', () => {
  const readme = outdent`
    <!--markcheck each="js" around:
    // Language LineMod BEFORE
    •••
    // Language LineMod AFTER
    -->

    <!--markcheck include="other" applyToBody="apply-to-body-line-mod" applyToOuter="outer-line-mod" internal="my-module.mjs"-->
    ▲▲▲js
    // Body
    ▲▲▲

    <!--markcheck id="other"-->
    ▲▲▲js
    // Included snippet
    ▲▲▲
    
    <!--markcheck lineModId="apply-to-body-line-mod" around:
    // applyToBody LineMod BEFORE
    •••
    // applyToBody LineMod AFTER
    -->
    <!--markcheck lineModId="outer-line-mod" around:
    // Outer applied LineMod BEFORE
    •••
    // Outer applied LineMod AFTER
    -->
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {
      'markcheck-config.jsonc': outdent`
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
    runParsedMarkdownForTests('/tmp/markdown/readme.md', readme, { mockShellData }).getTotalCount(),
    0
  );
  // Per file: config lines, language LineMods
  // Per snippet: applied line mod, local line mod
  assert.deepEqual(
    dirToJson(mfs, '/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'my-module.mjs': outdent`
        // Config line BEFORE
        // Language LineMod BEFORE
        // Outer applied LineMod BEFORE
        // Included snippet
        // applyToBody LineMod BEFORE
        // Body
        // applyToBody LineMod AFTER
        // Outer applied LineMod AFTER
        // Language LineMod AFTER
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
