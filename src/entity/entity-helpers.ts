/**
 * The result is double-quoted so that is can be used directly inside
 * messages etc.
 */
export function insertParsingPos(str: string, pos: number): string {
  return JSON.stringify(str.slice(0, pos) + '◆' + str.slice(pos));
}
export function unescapeBackslashes(rawStr: string): string {
  return rawStr.replaceAll(/\\(.)/g, '$1');
}
export function escapeSingleQuoted(str: string) {
  return str.replaceAll(/(['"\\])/g, String.raw`\$1`);
}