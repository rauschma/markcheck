export type LangDef = {
  fileName: string,
  command: Array<string>,
};
export class Config {
  lang = new Map<string, LangDef | 'ignore'>();
}