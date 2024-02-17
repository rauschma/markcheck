import { z } from 'zod';

export type LangDef = {
  fileName: string,
  command: Array<string>,
};
export class Config {
  lang = new Map<string, LangDef | 'ignore'>();
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
  lang?: Record<string, LangDef | 'ignore'>,
};

//#################### ConfigModJsonSchema ####################

export const LangDefSchema = z.object({
  fileName: z.string(),
  command: z.array(z.string()),
});

export const ConfigModJsonSchema = z.object({
  lang: z.optional(
    z.record(
      z.union([LangDefSchema, z.literal('ignore')])
    )
  ),
});