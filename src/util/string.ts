import { isEmptyLine } from '@rauschma/helpers/js/string.js';

export function trimTrailingEmptyLines(lines: Array<string>): Array<string> {
  lines.length = getEndTrimmedLength(lines);
  return lines;
}

export function getEndTrimmedLength(lines: Array<string>): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!isEmptyLine(lines[i])) {
      return i + 1;
    }
  }
  return 0; // only empty lines
}

export function normalizeWhitespace(str: string) {
  return str.replace(/\s+/ug, ' ');
}

export function linesContain(lines: Array<string>, part: Array<string>): boolean {
  const lastIndex = lines.length - part.length;
  containerLoop:
  for (let containerIndex = 0; containerIndex <= lastIndex; containerIndex++) {
    for (let lineIndex = 0; lineIndex < part.length; lineIndex++) {
      const containerLine = lines[containerIndex + lineIndex];
      const line = part[lineIndex];
      if (containerLine.trim() !== line.trim()) {
        continue containerLoop;
      }
    }
    // All lines matched
    return true;
  }
  return false;
}

export function linesAreSame(here: Array<string>, there: Array<string>): boolean {
  if (here.length !== there.length) {
    return false;
  }
  for (let i = 0; i < here.length; i++) {
    if (here[i].trim() !== there[i].trim()) {
      return false;
    }
  }
  return true;
}
