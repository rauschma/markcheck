import assert from 'node:assert/strict';
import { contextLineNumber } from '../util/errors.js';
import { Config } from './config.js';

test('config.toJson()', () => {
  const json = new Config().toJson();
  console.log(JSON.stringify(json, null, 2));
  assert.deepEqual(
    json,
    {
      "lang": {
        "": "[neverRun]",
        "js": {
          "defaultFileName": "main.mjs",
          "commands": [
            [
              "node",
              "$FILE_NAME"
            ]
          ]
        },
        "node-repl": {
          "extends": "js",
          "translator": "node-repl-to-js"
        },
        "babel": {
          "defaultFileName": "main.mjs",
          "commands": [
            [
              "node",
              "--loader=babel-register-esm",
              "--disable-warning=ExperimentalWarning",
              "$FILE_NAME"
            ]
          ]
        },
        "ts": {
          "defaultFileName": "main.ts",
          "commands": [
            [
              "npx",
              "@rauschma/expect-error",
              "$ALL_FILE_NAMES"
            ],
            [
              "npx",
              "tsx",
              "$FILE_NAME"
            ]
          ]
        }
      }
    }
  );
});

test('config.getLang()', () => {
  const config = new Config();
  config.applyMod(contextLineNumber(1), {
    "lang": {
      "js": {
        "extends": "babel",
      },
    },
  });
  const langDef = config.getLang('js');
  if (langDef === undefined || langDef.kind !== 'LangDefCommand') {
    throw new Error();
  }
  assert.deepEqual(
    langDef,
    {
      commands: [
        [
          'node',
          '--loader=babel-register-esm',
          '--disable-warning=ExperimentalWarning',
          '$FILE_NAME'
        ]
      ],
      defaultFileName: 'main.mjs',
      kind: 'LangDefCommand',
      translator: undefined
    }
  );
});