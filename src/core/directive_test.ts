import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { parseExternalSpecs, parseLineNumberSet, type ExternalSpec } from './directive.js';

createSuite(import.meta.url);

test('parseExternalSpecs', () => {
  assert.deepEqual(
    parseExternalSpecs(1, 'file0.js, id1>file1.js, id2>file2.js'),
    [
      {
        id: null,
        fileName: 'file0.js',
      },
      {
        id: 'id1',
        fileName: 'file1.js',
      },
      {
        id: 'id2',
        fileName: 'file2.js',
      },
    ] satisfies Array<ExternalSpec>
  );
});

test('parseLineNumberSet', () => {
  assert.deepEqual(
    parseLineNumberSet(1, '1, 2, 3'),
    new Set([1, 2, 3])
  );
  assert.deepEqual(
    parseLineNumberSet(1, '1-2, 4, 6-7'),
    new Set([1, 2, 4, 6, 7])
  );
});