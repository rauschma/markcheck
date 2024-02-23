import assert from 'node:assert/strict';
import test from 'node:test';
import { Config } from './config.js';

test('config.toJson()', () => {
  const json = new Config().toJson();
  // console.log(JSON.stringify(json, null, 2));
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
        }
      }
    }
  );
});