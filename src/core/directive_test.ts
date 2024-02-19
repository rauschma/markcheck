import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWriteValue, type WriteValue } from './directive.js';

test('parseWriteValue', () => {
  assert.deepEqual(
    parseWriteValue(1, 'file0.js, id1>file1.js, id2>file2.js'),
    {
      selfFileName: 'file0.js',
      writeSpecs: [
        {
          fileName: 'file1.js',
          id: 'id1',
        },
        {
          fileName: 'file2.js',
          id: 'id2',
        },
      ],
    } satisfies WriteValue
  );
});