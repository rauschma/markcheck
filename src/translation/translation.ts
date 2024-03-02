export type Translator = {
  key: string,
  translate(lineNumber: number, lines: Array<string>): Array<string>,
};

export function createLineRange(first: number, last: number): Set<number> {
  const result = new Set<number>();
  for (let i=first; i<= last; i++) {
    result.add(i);
  }
  return result;
}
