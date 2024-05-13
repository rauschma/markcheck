import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';

// Only dynamically imported modules use the patched `node:fs`!
import { mfs } from '@rauschma/nodejs-tools/testing/install-mem-node-fs.js';
const { dirToJson, jsonToCleanDir } = await import('@rauschma/nodejs-tools/testing/dir-json.js');
const { MarkcheckMockData } = await import('../../src/entity/snippet.js');
const { runMarkdownForTests } = await import('../test-tools.js');

createSuite(import.meta.url);

test('Assemble snippet with internal LineMod and applyToOuter', () => {
  const readme = outdent`
    <!--markcheck each="js" around:
    // Language LineMod BEFORE
    •••
    // Language LineMod AFTER
    -->

    <!--markcheck include="included-snippet" applyToOuter="outer-line-mod" runFileName="my-module.mjs" around:
    // Internal LineMod BEFORE
    •••
    // Internal LineMod AFTER
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
      'markcheck-config.json5': outdent`
        {
          "lang": {
            "": "[skip]",
            "js": {
              "before": [
                "// Config line BEFORE"
              ],
              "runFileName": "main.mjs",
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

  const mockShellData = new MarkcheckMockData();
  assert.equal(
    runMarkdownForTests('/tmp/markdown/readme.md', readme, { markcheckMockData: mockShellData }).getTotalProblemCount(),
    0
  );
  // Per file: config lines, language LineMods
  // Per snippet: applied line mod, local line mod
  assert.deepEqual(
    dirToJson('/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'my-module.mjs': outdent`
        // Config line BEFORE
        // Language LineMod BEFORE
        // Outer applied LineMod BEFORE
        // Included snippet
        // Internal LineMod BEFORE
        // Body
        // Internal LineMod AFTER
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

test('Assemble snippet with runLocalLines and applyToOuter: must include applyToOuter lines but not config lines', () => {
  const readme = outdent`
    <!--markcheck applyToOuter="outer-line-mod" runLocalLines-->
    ▲▲▲js
    // Body
    ▲▲▲

    <!--markcheck lineModId="outer-line-mod" around:
    // Outer applied LineMod BEFORE
    •••
    // Outer applied LineMod AFTER
    -->
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {
      'markcheck-config.json5': outdent`
        {
          "lang": {
            "": "[skip]",
            "js": {
              "before": [
                "// Config line BEFORE"
              ],
              "runFileName": "main.mjs",
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

  const mockShellData = new MarkcheckMockData();
  assert.equal(
    runMarkdownForTests('/tmp/markdown/readme.md', readme, { markcheckMockData: mockShellData }).getTotalProblemCount(),
    0
  );
  // Per file: config lines, language LineMods
  // Per snippet: applied line mod, local line mod
  assert.deepEqual(
    dirToJson('/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
        // Outer applied LineMod BEFORE
        // Body
        // Outer applied LineMod AFTER
      `,
    }
  );
  assert.deepEqual(
    mockShellData.interceptedCommands,
    [
      'js-command1 main.mjs',
      'js-command2 main.mjs',
    ]
  );
});

test('Assemble snippet with applyToBody LineMod from a snippet', () => {
  const readme = outdent`
    <!--markcheck each="js" around:
    // Language LineMod BEFORE
    •••
    // Language LineMod AFTER
    -->

    <!--markcheck include="other" applyToBody="apply-to-body-line-mod" applyToOuter="outer-line-mod" runFileName="my-module.mjs"-->
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
      'markcheck-config.json5': outdent`
        {
          "lang": {
            "": "[skip]",
            "js": {
              "before": [
                "// Config line BEFORE"
              ],
              "runFileName": "main.mjs",
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

  const mockShellData = new MarkcheckMockData();
  assert.equal(
    runMarkdownForTests('/tmp/markdown/readme.md', readme, { markcheckMockData: mockShellData }).getTotalProblemCount(),
    0
  );
  // Per file: config lines, language LineMods
  // Per snippet: applied line mod, local line mod
  assert.deepEqual(
    dirToJson('/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
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

test('Assemble snippet with applyToBody LineMod from the config', () => {
  const readme = outdent`
    <!--markcheck applyToBody="asyncTest"-->
    ▲▲▲js
    test('Test with await', async () => {
      const value = await Promise.resolve(123);
      assert.equal(value, 123);
    });
    ▲▲▲
  `.replaceAll('▲', '`');
  jsonToCleanDir(mfs, {
    '/tmp/markcheck-data': {
      'markcheck-config.json5': outdent`
        {
          lineMods: {
            asyncTest: {
              before: [
                'function test(_name, callback) {',
                '  return callback();',
                '}',
              ],
              after: [
                'await test();',
              ],
            },
          },
        }
      `,
    },
    '/tmp/markdown/readme.md': readme,
  });

  const mockShellData = new MarkcheckMockData();
  assert.equal(
    runMarkdownForTests('/tmp/markdown/readme.md', readme, { markcheckMockData: mockShellData }).getTotalProblemCount(),
    0
  );
  // Per file: config lines, language LineMods
  // Per snippet: applied line mod, local line mod
  assert.deepEqual(
    dirToJson('/tmp/markcheck-data/tmp', { trimEndsOfFiles: true }),
    {
      'main.mjs': outdent`
        import assert from 'node:assert/strict';
        function test(_name, callback) {
          return callback();
        }
        test('Test with await', async () => {
          const value = await Promise.resolve(123);
          assert.equal(value, 123);
        });
        await test();
      `,
    }
  );
  assert.deepEqual(
    mockShellData.interceptedCommands,
    [
      'node main.mjs',
    ]
  );
});

test('"each" plus "include"', () => {
  const readme = outdent`
    <!--markcheck each="js" include="promiseWithResolvers" before:
    Promise.withResolvers = promiseWithResolvers;
    -->

    <!--markcheck id="promiseWithResolvers"-->
    ▲▲▲js
    function promiseWithResolvers() {}
    ▲▲▲

    ▲▲▲js
    const { promise, resolve, reject } = Promise.withResolvers();
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
      'main.mjs': outdent`
        import assert from 'node:assert/strict';
        function promiseWithResolvers() {}
        Promise.withResolvers = promiseWithResolvers;
        const { promise, resolve, reject } = Promise.withResolvers();
      `,
    }
  );
});
