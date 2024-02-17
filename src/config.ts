import { z } from 'zod';

export type LangDef = {
  fileName: string,
  command: Array<string>,
};
export class Config {
  lang = new Map<string, LangDef | 'skip'>();
  constructor() {
    this.lang.set('', 'skip');
    this.lang.set(
      "js",
      {
        fileName: 'main.mjs',
        command: ["node", "main.mjs"],
      }
    );
    this.lang.set(
      "babel",
      {
        fileName: 'main.mjs',
        command: ["node", "--loader=babel-register-esm", "--disable-warning=ExperimentalWarning", "main.mjs"],
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

//#################### ConfigModJson ####################

export type ConfigModJson = {
  marktestDirectory?: string,
  lang?: Record<string, LangDef | 'skip'>,
};

//#################### ConfigModJsonSchema ####################

export const LangDefSchema = z.object({
  fileName: z.string(),
  command: z.array(z.string()),
});

export const ConfigModJsonSchema = z.object({
  marktestDirectory: z.optional(z.string()),
  lang: z.optional(
    z.record(
      z.union([LangDefSchema, z.literal('skip')])
    )
  ),
});