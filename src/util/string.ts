import { isEmptyLine } from '@rauschma/helpers/js/string.js';

export function pruneTrailingEmptyLines(lines: Array<string>): void {
  for (let i=lines.length-1; i>=0; i--) {
    if (!isEmptyLine(lines[i])) {
      lines.length = i + 1;
      return;
    }
  }
  lines.length = 0; // only empty lines
}