import { splitLinesExclEol } from '@rauschma/helpers/string/line.js';
import { createSuite } from '@rauschma/helpers/testing/mocha.js';
import assert from 'node:assert/strict';
import { extractCommentContent } from '../core/parse-markdown.js';
import { contextLineNumber } from '../util/errors.js';
import { Directive, SearchAndReplaceSpec, parseExternalSpecs, type ExternalSpec } from './directive.js';

const { raw } = String;

createSuite(import.meta.url);

test('Directive.parse()', () => {
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
  assert.throws(
    () => parseDirective(raw`<!--markcheck key="unclosed-->`),
    {
      name: 'MarkcheckSyntaxError',
      message: raw`Could not parse attributes: Stopped parsing before "=\"unclosed"`,
    },
    'Unclosed attribute value'
  );
});

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

function parseDirective(md: string): Directive {
  const text = extractCommentContent(md);
  assert.ok(text !== null);
  const directive = Directive.parse(1, splitLinesExclEol(text));
  assert.ok(directive !== null);
  return directive;
}
