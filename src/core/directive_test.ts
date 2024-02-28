import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { parseExternalSpecs, parseLineNumberSet, type ExternalSpec, SearchAndReplaceSpec } from './directive.js';
import { contextLineNumber } from '../util/errors.js';

const {raw} = String;

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


test('SearchAndReplaceSpec', () => {
  const testObjs = [
    {
      title: 'No flags',
      spec: raw`/[⎡⎤]//`,
      in: '⎡await ⎤asyncFunc()',
      out: 'await asyncFunc()',
    },
    {
      title: 'Case insensitive matching',
      spec: raw`/a/x/i`,
      in: 'aAaA',
      out: 'xxxx',
    },
    {
      title: 'Case sensitive matching',
      spec: raw`/a/x/`,
      in: 'aAaA',
      out: 'xAxA',
    },
    {
      title: 'Escaped slash in search',
      spec: raw`/\//o/`,
      in: '/--/',
      out: 'o--o',
    },
    {
      title: 'Escaped slash in replace',
      spec: raw`/o/\//`,
      in: 'oo',
      out: '//',
    },
  ];
  for (const testObj of testObjs) {
    const sar = SearchAndReplaceSpec.fromString(
      contextLineNumber(1),
      testObj.spec
    );
    assert.equal(
      sar.toString(),
      testObj.spec,
      testObj.title + ': .toString()'
    );
    assert.equal(
      sar.replaceAll(testObj.in),
      testObj.out,
      testObj.title + ': .replaceAll()'
    );
  }
});