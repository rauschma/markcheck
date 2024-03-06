import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { isEntryModule } from '@rauschma/helpers/nodejs/import-meta.js';
import { style, type TextStyleResult } from '@rauschma/helpers/nodejs/text-style.js';
import { outdent } from '@rauschma/helpers/template-tag/outdent-template-tag.js';
import * as diff from 'diff';
import { Output } from './errors.js';

export function logDiff(out: Output, expectedLines: Array<string>, actualLines: Array<string>) {
  const changes = diff.diffArrays(expectedLines, actualLines);
  for (const change of changes) {
    let prefix;
    let lineStyle: TextStyleResult;
    if (change.added) {
      prefix = '+ ';
      lineStyle = style.FgGreen;
    } else if (change.removed) {
      prefix = '- ';
      lineStyle = style.FgRed;
    } else {
      prefix = '  ';
      lineStyle = style.Normal;
    }
    for (const v of change.value) {
      out.writeLine(lineStyle(prefix + v));
    }
  }
}

export function areLinesEqual(expectedLines: Array<string>, actualLines: Array<string>): boolean {
  const expectedLen = expectedLines.length;
  const actualLen = actualLines.length;
  if (expectedLen !== actualLen) {
    return false;
  }
  for (let i=0; i<expectedLen; i++) {
    if (expectedLines[i] !== actualLines[i]) {
      return false;
    }
  }
  return true;
}

if (isEntryModule(import.meta)) {
  // Show what the output looks like
  
  const oldStr = outdent`
    Hello world!
    More text
  `;
  const newStr = outdent`
    Goodbye world!
    More text
  `;
  logDiff(Output.fromStdout(), splitLinesExclEol(oldStr), splitLinesExclEol(newStr));
}
