import type { SearchAndReplace } from '@rauschma/helpers/string/escaper.js';
import { re } from '@rauschma/helpers/template-tag/re-template-tag.js';

const { raw } = String;
const { stringify } = JSON;

const RE_INNER = /(?:[^/]|\\[/])*/;
const RE_SEARCH_AND_REPLACE = re`/^[/](${RE_INNER})[/](${RE_INNER})[/]([giy]+)?$/`;

/**
 * - Example: `"/[⎡⎤]//i"`
 * - This code is duplicated in Bookmaker
 */
export class SearchAndReplaceSpec {
  static fromString(str: string): SearchAndReplaceSpec {
    const { search, replace } = parseSearchAndReplaceString( str);
    return new SearchAndReplaceSpec(search, replace);
  }
  #search;
  #replace;
  private constructor(search: RegExp, replace: string) {
    this.#search = search;
    this.#replace = replace;
  }
  toString(): string {
    // Stringification of RegExp automatically escapes slashes
    const searchNoFlags = new RegExp(this.#search, '').toString();
    const escapedReplace = this.#replace.replaceAll('/', String.raw`\/`);
    return searchNoFlags + escapedReplace + '/' + this.#search.flags;
  }
  replaceAll(str: string): string {
    return str.replaceAll(this.#search, this.#replace);
  }
}

/**
 * @throws SyntaxError
 */
export function parseSearchAndReplaceString(str: string): SearchAndReplace {
  const match = RE_SEARCH_AND_REPLACE.exec(str);
  if (!match) {
    throw new SyntaxError(
      `Not a valid searchAndReplace string: ${stringify(str)}`
    );
  }
  const search = match[1];
  const replace = match[2].replaceAll(raw`\/`, '/');
  let flags = match[3] ?? '';
  if (!flags.includes('g')) {
    flags += 'g';
  }
  return {
    search: new RegExp(search, flags),
    replace,
  };
}
