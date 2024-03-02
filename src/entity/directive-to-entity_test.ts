import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { createSuite } from '@rauschma/helpers/nodejs/test.js';
import assert from 'node:assert/strict';
import { extractCommentContent } from '../core/parse-markdown.js';
import { UserError } from '../util/errors.js';
import { directiveToEntity } from './directive-to-entity.js';
import { Directive } from './directive.js';

createSuite(import.meta.url);

test('directiveToEntity(): complain about illegal attributes', () => {
  const text = extractCommentContent('<!--marktest ignore_imports-->');
  assert.ok(text !== null);
  const directive = Directive.parse(1, splitLinesExclEol(text));
  assert.ok(directive !== null);
  assert.throws(
    () => directiveToEntity(directive),
    UserError
  );
});
