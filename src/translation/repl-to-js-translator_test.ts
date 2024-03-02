import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { nodeReplToJs } from './repl-to-js-translator.js';

createSuite(import.meta.url);

test('nodeReplToJs.translate', () => {
  assert.deepEqual(
    nodeReplToJs.translate(1,
      [
        `> 2n + 1`,
        `TypeError: Cannot mix BigInt and other types, use explicit conversions`,
      ]
    ),
    [
      `assert.throws(`,
      `() => {`,
      `2n + 1`,
      '},',
      `{"name":"TypeError","message":"Cannot mix BigInt and other types, use explicit conversions"}`,
      `);`,
    ],
    'Expected exception'
  );
  assert.deepEqual(
    nodeReplToJs.translate(1,
      [
        `> 2 ** 8`,
        `256`,
      ]
    ),
    [
      'assert.deepEqual(',
      '2 ** 8',
      ',',
      '256',
      ');',
    ],
    'Input and output'
  );
  assert.deepEqual(
    nodeReplToJs.translate(1,
      [
        `> const map = new Map();`,
        ``,
        `> map.set(NaN, 123);`,
        `> map.get(NaN)`,
        `123`,
      ]
    ),
    [
      "const map = new Map();",
      "",
      "map.set(NaN, 123);",
      "assert.deepEqual(",
      "map.get(NaN)",
      ",",
      "123",
      ");",
    ],
    'Empty line before input'
  );
});