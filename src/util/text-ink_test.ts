import assert from 'node:assert/strict';
import { ink } from './text-ink.js';

test('ink as template tag', () => {
  assert.equal(
    ink.Underline.FgGreen`underlined green`,
    '\x1B[4;32m' + 'underlined green' + '\x1B[0m'
  );
  assert.equal(
    ink.FgColorCode(51)`turquoise`,
    '\x1B[38;5;51m' + 'turquoise' + '\x1B[0m'
  );
});

test('ink as function', () => {
  assert.equal(
    ink.Bold('bold'),
    '\x1B[1m' + 'bold' + '\x1B[0m'
  );
  assert.equal(
    ink.FgColorCode(51)('turquoise'),
    '\x1B[38;5;51m' + 'turquoise' + '\x1B[0m'
  );
});
