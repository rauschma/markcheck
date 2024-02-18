import { splitLinesExclEol } from '@rauschma/helpers/js/line.js';
import { outdent } from '@rauschma/helpers/js/outdent-template-tag.js';
import { isEmptyLine } from '@rauschma/helpers/js/string.js';
import { isEntryModule } from '@rauschma/helpers/nodejs/import-meta.js';
import { Style, wrapStyles, type StyleValue } from '@rauschma/helpers/nodejs/simple-color.js';
import * as diff from 'diff';

export function logDiff(expectedLines: Array<string>, actualLines: Array<string>) {
  const changes = diff.diffArrays(expectedLines, actualLines);
  for (const change of changes) {
    const styles = new Array<StyleValue>;
    let prefix;
    if (change.added) {
      prefix = '+ ';
      styles.push(Style.FgGreen);
    } else if (change.removed) {
      prefix = '- ';
      styles.push(Style.FgRed);
    } else {
      prefix = '  ';
    }
    console.log(wrapStyles(styles, prefix + change.value));
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
  const expectedLen = lengthIgnoringEmptyLines(expectedLines);
  const actualLen = lengthIgnoringEmptyLines(actualLines);
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

function lengthIgnoringEmptyLines(lines: Array<string>) {
  for (let i=lines.length-1; i>=0; i--) {
    if (!isEmptyLine(lines[i])) {
      return i + 1;
    }
  }
  return 0; // only empty lines
}