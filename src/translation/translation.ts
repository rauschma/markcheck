export type Translator = {
  key: string,
  translate(lineNumber: number, lines: Array<string>): Array<string>,
};
