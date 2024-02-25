import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { outdent } from '@rauschma/helpers/js/outdent-template-tag.js';
import { isEntryModule } from '@rauschma/helpers/nodejs/import-meta.js';
import { ink, type InkResult } from '@rauschma/helpers/nodejs/text-ink.js';
import * as diff from 'diff';

export function logDiff(expectedLines: Array<string>, actualLines: Array<string>) {
  const changes = diff.diffArrays(expectedLines, actualLines);
  for (const change of changes) {
    let prefix;
    let style: InkResult;
    if (change.added) {
      prefix = '+ ';
      style = ink.FgGreen;
    } else if (change.removed) {
      prefix = '- ';
      style = ink.FgRed;
    } else {
      prefix = '  ';
      style = ink.Normal;
    }
    for (const v of change.value) {
      console.log(style(prefix + v));
    }
  }
}

if (isEntryModule(import.meta)) {
  const oldStr = outdent`
    Hello world!
    More text
  `;
  const newStr = outdent`
    Goodbye world!
    More text
  `;
  logDiff(splitLinesExclEol(oldStr), splitLinesExclEol(newStr));
}

export function isOutputEqual(expectedLines: Array<string>, actualLines: Array<string>): boolean {
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
