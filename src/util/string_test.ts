import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { containedIn } from './string.js';

createSuite(import.meta.url);

test('containedIn()', () => {
  assert.ok(
    containedIn(
      ['a', 'b'],
      ['a', 'b']
    )
  );
  assert.ok(
    containedIn(
      ['a', 'b'],
      ['a', 'b', 'c']
    )
  );
  assert.ok(
    containedIn(
      ['a', 'b'],
      ['x', 'a', 'b']
    )
  );
  assert.ok(
    containedIn(
      ['a'],
      ['a', 'b', 'c']
    )
  );
  assert.ok(
    containedIn(
      ['c'],
      ['a', 'b', 'c']
    )
  );

  // Not contained
  assert.ok(
    !containedIn(
      ['x'],
      ['a', 'b', 'c']
    )
  );
  assert.ok(
    !containedIn(
      ['b', 'c', 'd'],
      ['a', 'b', 'c']
    )
  );
});
