import { z } from 'zod';

export const CMD_VAR_FILE_NAME = '$FILE_NAME';
export const CMD_VAR_ALL_FILE_NAMES = '$ALL_FILE_NAMES';

export type LangDef = {
  defaultFileName: string,
  commands: Array<Array<string>>,
};
export class Config {
  lang = new Map<string, LangDef | 'skip'>();
  constructor() {
    this.lang.set('', 'skip');
    this.lang.set(
      "js",
      {
        defaultFileName: 'main.mjs',
        commands: [
          ["node", CMD_VAR_FILE_NAME]
        ],
      }
    );
    this.lang.set(
      "babel",
      {
        defaultFileName: 'main.mjs',
        commands: [
          ["node", "--loader=babel-register-esm", "--disable-warning=ExperimentalWarning", CMD_VAR_FILE_NAME]
        ],
      }
    );
  }
  applyMod(mod: ConfigModJson): void {
    if (mod.lang) {
      for (const [key, def] of Object.entries(mod.lang)) {
        this.lang.set(key, def);
      }
    }
  }
}

export function fillInCommands(langDef: LangDef, vars: Record<string, Array<string>>): Array<Array<string>> {
  return langDef.commands.map(cmdParts => cmdParts.flatMap(
    (part) => {
      if (Object.hasOwn(vars, part)) {
        return vars[part];
      } else {
        return [part];
      }
    }
  ));
}

//#################### ConfigModJson ####################

export type ConfigModJson = {
  marktestDirectory?: string,
  lang?: Record<string, LangDef | 'skip'>,
};

//#################### ConfigModJsonSchema ####################

export const LangDefSchema = z.object({
  defaultFileName: z.string(),
  commands: z.array(z.array(z.string())),
});

export const ConfigModJsonSchema = z.object({
  marktestDirectory: z.optional(z.string()),
  lang: z.optional(
    z.record(
      z.union([LangDefSchema, z.literal('skip')])
    )
  ),
});