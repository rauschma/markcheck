import { z } from 'zod';
import { CMD_VAR_FILE_NAME, LANG_DEF_NEVER_RUN } from './directive.js';

export type LangDef = LangDefCommand | LangDefNeverRun;
export type LangDefCommand = {
  kind: 'LangDefCommand',
  defaultFileName: string,
  commands: Array<Array<string>>,
};
export type LangDefNeverRun = {
  kind: 'LangDefNeverRun',
};
export class Config {
  lang = new Map<string, LangDef>();
  constructor() {
    this.lang.set('', { kind: 'LangDefNeverRun' });
    this.lang.set(
      "js",
      {
        kind: 'LangDefCommand',
        defaultFileName: 'main.mjs',
        commands: [
          ["node", CMD_VAR_FILE_NAME],
        ],
      }
    );
    this.lang.set(
      "babel",
      {
        kind: 'LangDefCommand',
        defaultFileName: 'main.mjs',
        commands: [
          ["node", "--loader=babel-register-esm", "--disable-warning=ExperimentalWarning", CMD_VAR_FILE_NAME],
        ],
      }
    );
  }
  applyMod(mod: ConfigModJson): void {
    if (mod.lang) {
      for (const [key, langDefJson] of Object.entries(mod.lang)) {
        this.lang.set(key, langDefFromJson(langDefJson));
      }
    }
  }
}

export function fillInCommands(langDef: LangDefCommand, vars: Record<string, Array<string>>): Array<Array<string>> {
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

export type LangDefCommandJson = {
  defaultFileName: string,
  commands: Array<Array<string>>,
};

export type ConfigModJson = {
  marktestDirectory?: string,
  lang?: Record<string, LangDefJson>,
};

export type LangDefJson = LangDefCommandJson | typeof LANG_DEF_NEVER_RUN;

function langDefFromJson(langDefJson: LangDefJson): LangDef {
  if (langDefJson === LANG_DEF_NEVER_RUN) {
    return {
      kind: 'LangDefNeverRun',
    };
  } else {
    return {
      kind: 'LangDefCommand',
      defaultFileName: langDefJson.defaultFileName,
      commands: langDefJson.commands,
    };
  }
}

//#################### ConfigModJsonSchema ####################

export const LangDefCommandSchema = z.object({
  defaultFileName: z.string(),
  commands: z.array(z.array(z.string())),
});

export const ConfigModJsonSchema = z.object({
  marktestDirectory: z.optional(z.string()),
  lang: z.optional(
    z.record(
      z.union([LangDefCommandSchema, z.literal(LANG_DEF_NEVER_RUN)])
    )
  ),
});