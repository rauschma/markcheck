import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';
import { contextLineNumber } from '../util/errors.js';
import { lineLocSetToLineNumberSet, parseLineLocSet } from './line-loc-set.js';

const { raw } = String;

createSuite(import.meta.url);

test('parseLineLocSet', () => {
  assert.deepEqual(
    parseLineLocSet(1, raw`1, -3, 'with \'single\' quotes', 'abc'`),
    [
      {
        kind: 'LineLoc',
        loc: 1
      },
      {
        kind: 'LineLoc',
        loc: -3
      },
      {
        kind: 'LineLoc',
        loc: "with 'single' quotes"
      },
      {
        kind: 'LineLoc',
        loc: 'abc'
      }
    ]
  );
  assert.deepEqual(
    parseLineLocSet(1, raw`1..2, 4, -5..-3, 'x', 'a'..'z'`),
    [
      {
        kind: 'LineRange',
        start: {
          kind: 'LineLoc',
          loc: 1
        },
        end: {
          kind: 'LineLoc',
          loc: 2
        },
      },
      {
        kind: 'LineLoc',
        loc: 4
      },
      {
        kind: 'LineRange',
        start: {
          kind: 'LineLoc',
          loc: -5
        },
        end: {
          kind: 'LineLoc',
          loc: -3
        },
      },
      {
        kind: 'LineLoc',
        loc: 'x'
      },
      {
        kind: 'LineRange',
        start: {
          kind: 'LineLoc',
          loc: 'a'
        },
        end: {
          kind: 'LineLoc',
          loc: 'z'
        },
      }
    ]
  );
});

test('lineLocSetToLineNumberSet', () => {
  const lines = [
    'one',
    'two',
    'three',
    'four',
    'five',
  ];
  {
    const set = parseLineLocSet(1, `1..2,`);
    assert.deepEqual(
      lineLocSetToLineNumberSet(contextLineNumber(1), set, lines),
      new Set([1, 2])
    );
  }
  {
    const set = parseLineLocSet(1, `-2..-1`);
    assert.deepEqual(
      lineLocSetToLineNumberSet(contextLineNumber(1), set, lines),
      new Set([4, 5])
    );
  }
  {
    const set = parseLineLocSet(1, `'one'..'two', 5`);
    assert.deepEqual(
      lineLocSetToLineNumberSet(contextLineNumber(1), set, lines),
      new Set([1, 2, 5])
    );
  }
});
