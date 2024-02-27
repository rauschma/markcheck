import assert from 'node:assert/strict';
import { parseExternalSpecs, type ExternalSpec } from './directive.js';

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