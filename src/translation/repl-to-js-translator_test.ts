import assert from 'node:assert/strict';
import { nodeReplToJs } from './repl-to-js-translator.js';

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
    ]
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
    ]
  );
});