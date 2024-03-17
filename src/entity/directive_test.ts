import { splitLinesExclEol } from '@rauschma/helpers/string/line.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';
import { extractCommentContent } from '../core/parse-markdown.js';
import { Directive, LineScope, parseExternalSpecs, type ExternalSpec } from './directive.js';

const { raw } = String;

createSuite(import.meta.url);

test('Directive.parse(): successes', () => {
  assert.deepEqual(
    parseDirective(raw`<!--markcheck noOuterLineMods-->`).toJson(),
    {
      lineNumber: 1,
      attributes: {
        noOuterLineMods: null,
      },
      bodyLabel: null,
      body: [],
    },
    'Valueless attribute'
  );
  assert.deepEqual(
    parseDirective(raw`<!--markcheck key="value \"with\" quotes"-->`).toJson(),
    {
      lineNumber: 1,
      attributes: {
        key: raw`value \"with\" quotes`,
      },
      bodyLabel: null,
      body: [],
    },
    'Attribute value with escaped quotes (raw!)'
  );
  assert.deepEqual(
    parseDirective(raw`<!--markcheck key="a\\b\\c"-->`).toJson(),
    {
      lineNumber: 1,
      attributes: {
        key: raw`a\\b\\c`,
      },
      bodyLabel: null,
      body: [],
    },
    'Attribute value with backslashes (raw!)'
  );
  assert.deepEqual(
    parseDirective(raw`<!--markcheck key=""-->`).toJson(),
    {
      lineNumber: 1,
      attributes: {
        key: raw``,
      },
      bodyLabel: null,
      body: [],
    },
    'Empty attribute value'
  );
});

test('Directive.parse(): failures', () => {
  assert.throws(
    () => parseDirective(raw`<!--markcheck key="unclosed-->`),
    {
      name: 'MarkcheckSyntaxError',
      message: 'Could not parse attributes. Stopped parsing: ` key[HERE]="unclosed`',
    },
    'Unclosed attribute value'
  );
});

test('parseExternalSpecs', () => {
  assert.deepEqual(
    parseExternalSpecs(1, LineScope.all, 'file0.js, id1>file1.js, id2>file2.js'),
    [
      {
        id: null,
        lineScope: LineScope.all,
        fileName: 'file0.js',
      },
      {
        id: 'id1',
        lineScope: LineScope.all,
        fileName: 'file1.js',
      },
      {
        id: 'id2',
        lineScope: LineScope.all,
        fileName: 'file2.js',
      },
    ] satisfies Array<ExternalSpec>
  );
  assert.deepEqual(
    parseExternalSpecs(1, LineScope.local, 'file0.js, id1>file1.js, id2>file2.js'),
    [
      {
        id: null,
        lineScope: LineScope.local,
        fileName: 'file0.js',
      },
      {
        id: 'id1',
        lineScope: LineScope.local,
        fileName: 'file1.js',
      },
      {
        id: 'id2',
        lineScope: LineScope.local,
        fileName: 'file2.js',
      },
    ] satisfies Array<ExternalSpec>
  );
});

function parseDirective(md: string): Directive {
  const text = extractCommentContent(md);
  assert.ok(text !== null);
  const directive = Directive.parse(1, splitLinesExclEol(text));
  assert.ok(directive !== null);
  return directive;
}
