import { isEmptyLine } from '@rauschma/helpers/js/string.js';

export function trimTrailingEmptyLines(lines: Array<string>): void {
  lines.length = getEndTrimmedLength(lines);
}

export function getEndTrimmedLength(lines: Array<string>): number {
  for (let i=lines.length-1; i>=0; i--) {
    if (!isEmptyLine(lines[i])) {
      return i + 1;
    }
  }
  return 0; // only empty lines
}

export function normalizeWhitespace(str: string) {
  return str.replace(/\s+/ug, ' ');
}
