import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';
import { SearchAndReplaceSpec } from './search-and-replace-spec.js';

const { raw } = String;

createSuite(import.meta.url);

test('SearchAndReplaceSpec', () => {
  const testObjs = [
    {
      title: 'Flag /g (without /y)',
      spec: raw`/X/A/g`,
      toString: raw`/X/A/g`,
      in: 'XXXaX',
      out: 'AAAaA',
    },
    {
      title: 'Flag /g (with /y)',
      spec: raw`/X/A/gy`,
      toString: raw`/X/A/gy`,
      in: 'XXXaX',
      out: 'AAAaX',
    },

    {
      title: 'No flags',
      spec: raw`/[⎡⎤]//`,
      toString: raw`/[⎡⎤]//g`,
      in: '⎡await ⎤asyncFunc()',
      out: 'await asyncFunc()',
    },
    {
      title: 'Case insensitive matching',
      spec: raw`/a/x/i`,
      toString: raw`/a/x/gi`,
      in: 'aAaA',
      out: 'xxxx',
    },
    {
      title: 'Case sensitive matching',
      spec: raw`/a/x/`,
      toString: raw`/a/x/g`,
      in: 'aAaA',
      out: 'xAxA',
    },
    {
      title: 'Escaped slash in search',
      spec: raw`/\//o/`,
      toString: raw`/\//o/g`,
      in: '/--/',
      out: 'o--o',
    },
    {
      title: 'Escaped slash in replace',
      spec: raw`/o/\//`,
      toString: raw`/o/\//g`,
      in: 'oo',
      out: '//',
    },
  ];
  for (const testObj of testObjs) {
    const sar = SearchAndReplaceSpec.fromString(
      testObj.spec
    );
    assert.equal(
      sar.toString(),
      testObj.toString,
      testObj.title + ': .toString()'
    );
    assert.equal(
      sar.replaceAll(testObj.in),
      testObj.out,
      testObj.title + ': .replaceAll()'
    );
  }
});
