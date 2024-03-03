import { isEmptyLine } from '@rauschma/helpers/js/string.js';
import { MarktestSyntaxError } from '../util/errors.js';
import { normalizeWhitespace } from '../util/string.js';
import { type Translator } from './translation.js';

const RE_INPUT = /^> ?(.*)$/;
const RE_EXCEPTION = /^([A-Z][A-Za-z0-9_$]+):/;

export const nodeReplToJs: Translator = {
  key: 'node-repl-to-js',

  translate(lineNumber: number, lines: Array<string>): Array<string> {
    const result = new Array<string>();
    let index = 0;
    while (index < lines.length) {
      const inputLine = lines[index];
      const inputLineNumber = index + 1;

      if (isEmptyLine(inputLine)) {
        result.push(inputLine);
        index++;
        continue;
      }

      const match = RE_INPUT.exec(inputLine);
      if (!match) {
        throw new MarktestSyntaxError(
          `REPL line ${inputLineNumber} does not contain input (${RE_INPUT}): ${JSON.stringify(inputLine)}`,
          { lineNumber }
        )
      }
      const input = match[1];
      index += 1;
      if (input.endsWith(';')) {
        // A statement, not an expression: There is no output (= expected
        // result).
        result.push(input);
        continue;
      }
      const nextInputLineIndex = findNextInputLine(lines, index);
      const outputLen = nextInputLineIndex - index;
      if (outputLen === 0) {
        throw new MarktestSyntaxError(
          `No output after REPL line ${inputLineNumber}: ${JSON.stringify(inputLine)}`,
          { lineNumber }
        )
      }
      const exceptionMatch = RE_EXCEPTION.exec(lines[index]);
      if (exceptionMatch) {
        // Example:
        // "TypeError: Cannot mix BigInt and other types,"
        // "use explicit conversions"
        const name = exceptionMatch[1];

        // First line: remove prefixed exception name
        let message = lines[index].slice(exceptionMatch[0].length);

        // Remaining lines: join into a single line
        for (let i = index + 1; i < nextInputLineIndex; i++) {
          message += ' ';
          message += lines[i];
        }
        message = normalizeWhitespace(message).trim();

        result.push(
          `assert.throws(`,
          `() => {`,
          input,
          `},`,
          JSON.stringify({ name, message }),
          `);`,
        );
      } else {
        result.push(
          `assert.deepEqual(`,
          input,
          `,`,
          ...lines.slice(index, nextInputLineIndex),
          `);`,
        );
      }
      index = nextInputLineIndex;
    } // while
    return result;
  },
};

function findNextInputLine(lines: Array<string>, start: number): number {
  for (let i = start; i < lines.length; i++) {
    if (RE_INPUT.test(lines[i])) {
      return i;
    }
  }
  return lines.length;
}