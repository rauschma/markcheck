import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { insertionConditionsToJson, parseInsertionConditions } from './insertion-rules.js';

const {raw} = String;

createSuite(import.meta.url);

test('parseInsertionConditions', () => {
  const parse = (str: string) => insertionConditionsToJson(parseInsertionConditions(str));

  assert.deepEqual(
    parse(''),
    []
  );
  assert.deepEqual(
    parse(raw`before:-1, after:'' , after:'\"yes\"', before:'\'no\''`),
    [
      {
        modifier: 'Before',
        lineNumber: -1,
      },
      {
        modifier: 'After',
        textFragment: '',
      },
      {
        modifier: 'After',
        textFragment: '"yes"',
      },
      {
        modifier: 'Before',
        textFragment: "'no'",
      },
    ]
  );
});
