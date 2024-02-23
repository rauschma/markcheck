import { isObject } from '@rauschma/helpers/js/object.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { z } from 'zod';
import { UserError } from '../util/errors.js';
import { CMD_VAR_FILE_NAME, LANG_ERROR, LANG_ERROR_IF_RUN, LANG_NEVER_RUN, LANG_SKIP } from './directive.js';

const { stringify } = JSON;

export type LangDef =
  | LangDefCommand
  | LangDefUse
  | LangDefNeverRun
  | LangDefSkip
  | LangDefError
  | LangDefErrorIfRun
  ;
export type LangDefCommand = {
  kind: 'LangDefCommand',
  defaultFileName: string,
  commands: Array<Array<string>>,
};
/** Main use case: redirecting "js" to "babel" */
export type LangDefUse = {
  kind: 'LangDefUse',
  use: string,
};
/**
 * Main use case – the empty language `""` (of “bare” code blocks without
 * language tags):
 * - This type allows us to use bare code blocks for writing because they
 *   won’t be skipped.
 * - But they won’t be run because it’s not clear how.
 */
export type LangDefNeverRun = {
  kind: 'LangDefNeverRun',
};
export type LangDefSkip = {
  kind: 'LangDefSkip',
};
export type LangDefError = {
  kind: 'LangDefError',
};
export type LangDefErrorIfRun = {
  kind: 'LangDefErrorIfRun',
};


export class Config {
  #lang = new Map<string, LangDef>();
  constructor() {
    this.#lang.set('', { kind: 'LangDefNeverRun' });
    this.#lang.set(
      "js",
      {
        kind: 'LangDefCommand',
        defaultFileName: 'main.mjs',
        commands: [
          ["node", CMD_VAR_FILE_NAME],
        ],
      }
    );
    this.#lang.set(
      "babel",
      {
        kind: 'LangDefCommand',
        defaultFileName: 'main.mjs',
        commands: [
          // https://github.com/giltayar/babel-register-esm
          ["node", "--loader=babel-register-esm", "--disable-warning=ExperimentalWarning", CMD_VAR_FILE_NAME],
        ],
      }
    );
  }
  applyMod(mod: ConfigModJson, _lineNumber: number): void {
    if (mod.lang) {
      for (const [key, langDefJson] of Object.entries(mod.lang)) {
        this.#lang.set(key, langDefFromJson(langDefJson));
      }
    }
  }
  getLang(langKey: string): undefined | Exclude<LangDef, LangDefUse> {
    switch (langKey) {
      case LANG_NEVER_RUN:
        return { kind: 'LangDefNeverRun' };
      case LANG_SKIP:
        return { kind: 'LangDefSkip' };
      case LANG_ERROR_IF_RUN:
        return { kind: 'LangDefErrorIfRun' };
      case LANG_ERROR:
        return { kind: 'LangDefError' };
      default:
        const langDef = this.#lang.get(langKey);
        if (langDef === undefined) {
          return langDef;
        }
        if ('use' in langDef) {
          return this.#loopUpLangDefJson(langKey, langDef);
        }
        return langDef;
    }
  }
  #loopUpLangDefJson(parentKey: string, langDef: LangDefUse, visitedLanguages = new Set<string>): Exclude<LangDef, LangDefUse> {
    while (true) {
      if (visitedLanguages.has(langDef.use)) {
        const keyPath = [...visitedLanguages, langDef.use];
        throw new UserError(
          `Cycle in property ${stringify(PROP_KEY_USE)} (${stringify(PROP_KEY_LANG)} object): ${stringify(keyPath)}`
        );
      }
      visitedLanguages.add(langDef.use);
      const nextLangDef = this.#lang.get(langDef.use);
      if (nextLangDef === undefined) {
        throw new UserError(
          `Language definition ${stringify(parentKey)} refers to unknown language ${stringify(langDef.use)}`
        );
      }
      if (!(isObject(nextLangDef) && 'use' in nextLangDef)) {
        return nextLangDef;
      }
      parentKey = langDef.use; // key of langDef
      langDef = nextLangDef;
    }
  }
}

export function fillInCommandVariables(langDef: LangDefCommand, vars: Record<string, Array<string>>): Array<Array<string>> {
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
  lang?: Record<string, LangDefJson>,
};
const PROP_KEY_LANG = 'lang';

export type LangDefJson =
  | LangDefCommandJson
  | LangDefUseJson
  | typeof LANG_NEVER_RUN
  | typeof LANG_SKIP
  | typeof LANG_ERROR_IF_RUN
  | typeof LANG_ERROR
  ;

export type LangDefCommandJson = {
  defaultFileName: string,
  commands: Array<Array<string>>,
};

export type LangDefUseJson = {
  use: string,
};
const PROP_KEY_USE = 'use';

function langDefFromJson(langDefJson: LangDefJson): LangDef {
  if (typeof langDefJson === 'string') {
    switch (langDefJson) {
      case LANG_NEVER_RUN:
        return { kind: 'LangDefNeverRun' };
      case LANG_SKIP:
        return { kind: 'LangDefSkip' };
      case LANG_ERROR_IF_RUN:
        return { kind: 'LangDefErrorIfRun' };
      case LANG_ERROR:
        return { kind: 'LangDefError' };
      default:
        throw new UnsupportedValueError(langDefJson);
    }
  }
  if ('use' in langDefJson) {
    return {
      kind: 'LangDefUse',
      use: langDefJson.use,
    };
  }
  return {
    kind: 'LangDefCommand',
    defaultFileName: langDefJson.defaultFileName,
    commands: langDefJson.commands,
  };
}

//#################### ConfigModJsonSchema ####################

export const LangDefCommandJsonSchema = z.object({
  defaultFileName: z.string(),
  commands: z.array(z.array(z.string())),
});

export const LangDefUseJsonSchema = z.object({
  use: z.string(),
});

export const LangDefJsonSchema = z.union([
  LangDefCommandJsonSchema,
  LangDefUseJsonSchema,
  z.literal(LANG_NEVER_RUN),
  z.literal(LANG_SKIP),
  z.literal(LANG_ERROR_IF_RUN),
  z.literal(LANG_ERROR),
]);

export const ConfigModJsonSchema = z.object({
  marktestDirectory: z.optional(z.string()),
  lang: z.optional(
    z.record(
      LangDefJsonSchema
    )
  ),
});