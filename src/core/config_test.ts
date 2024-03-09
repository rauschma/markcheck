import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';
import { CMD_VAR_FILE_NAME } from '../entity/directive.js';
import { contextDescription, contextLineNumber } from '../util/errors.js';
import { Config } from './config.js';

createSuite(import.meta.url);

test('config.toJson()', () => {
  const config = new Config();
  config.applyMod(
    contextDescription('Test'),
    {
      searchAndReplace: [
        '/[⎡⎤]//',
      ],
      lang: {
        'js': {
          before: [
            "import assert from 'node:assert/strict';"
          ],
          runFileName: 'main.mjs',
          commands: [
            ["node", CMD_VAR_FILE_NAME],
          ],
        },
      },
    }
  );
  const json = config.toJson();
  // console.log(JSON.stringify(json, null, 2));
  assert.deepEqual(
    json,
    {
      "searchAndReplace": [
        "/[⎡⎤]//"
      ],
      "lang": {
        "js": {
          "before": [
            "import assert from 'node:assert/strict';"
          ],
          "runFileName": "main.mjs",
          "commands": [
            [
              "node",
              "$FILE_NAME"
            ]
          ]
        }
      }
    }
  );
});

test('config.getLang()', () => {
  const config = new Config().addDefaults();
  config.applyMod(contextLineNumber(1), {
    "lang": {
      "js": {
        "extends": "babel",
        "runFileName": "main-babel.mjs",
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
      beforeLines: [
        "import assert from 'node:assert/strict';"
      ],
      commands: [
        [
          'node',
          '--loader=babel-register-esm',
          '--disable-warning=ExperimentalWarning',
          '$FILE_NAME'
        ]
      ],
      extends: 'babel',
      kind: 'LangDefCommand',
      runFileName: 'main-babel.mjs',
      translator: undefined
    }
  );
});