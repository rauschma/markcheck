import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';
import { insertParsingPos, stringifyWithSingleQuote, unescapeBackslashes } from './entity-helpers.js';

const {raw} = String;

createSuite(import.meta.url);

test('stringifySingleQuoted', () => {
  assert.equal(
    stringifyWithSingleQuote(raw`'a"b\c`),
    raw`'\'a\"b\\c'`
  );
});

test('unescapeBackslashes', () => {
  assert.equal(
    unescapeBackslashes(raw`\'a\"b\\c`),
    raw`'a"b\c`
  );
});

test('insertParsingPos', () => {
  assert.equal(
    insertParsingPos('AB', 0),
    '"◆AB"'
  );
  assert.equal(
    insertParsingPos('AB', 1),
    '"A◆B"'
  );
  assert.equal(
    insertParsingPos('AB', 2),
    '"AB◆"'
  );
});
