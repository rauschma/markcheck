import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { linesContain } from './string.js';

createSuite(import.meta.url);

test('linesContain()', () => {
  assert.ok(
    linesContain(
      ['a', 'b'],
      ['a', 'b']
    )
  );
  assert.ok(
    linesContain(
      ['a', 'b', 'c'],
      ['a', 'b']
    )
  );
  assert.ok(
    linesContain(
      ['x', 'a', 'b'],
      ['a', 'b']
    )
  );
  assert.ok(
    linesContain(
      ['a', 'b', 'c'],
      ['a']
    )
  );
  assert.ok(
    linesContain(
      ['a', 'b', 'c'],
      ['c']
    )
  );

  // Not contained
  assert.ok(
    !linesContain(
      ['a', 'b', 'c'],
      ['x']
    )
  );
  assert.ok(
    !linesContain(
      ['a', 'b', 'c'],
      ['b', 'c', 'd']
    )
  );
});
