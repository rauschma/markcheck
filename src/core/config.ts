import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { z } from 'zod';
import { nodeReplToJs } from '../translation/repl-to-js-translator.js';
import { TRANSLATOR_MAP } from '../translation/translators.js';
import { UserError } from '../util/errors.js';
import { CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME, LANG_ERROR, LANG_ERROR_IF_RUN, LANG_NEVER_RUN, LANG_SKIP } from './directive.js';

const { stringify } = JSON;

//#################### Types ####################

/**
 * - We delay assembling the actual language definition (via `.extends`) as
 *   long as possible so that all pieces can be changed.
 */
export type LangDef = LangDefCommand | Exclude<LangDefPartial, LangDefCommandPartial>;
export type LangDefCommand = {
  kind: 'LangDefCommand',
  translator?: Translator,
  defaultFileName: string,
  commands: Array<Array<string>>,
};

type LangDefPartial =
  | LangDefCommandPartial
  | LangDefNeverRun
  | LangDefSkip
  | LangDefError
  | LangDefErrorIfRun
  ;
type LangDefCommandPartial = {
  kind: 'LangDefCommandPartial',
  extends?: string,
  translator?: Translator,
  defaultFileName?: string,
  commands?: Array<Array<string>>,
};
const PROP_KEY_EXTENDS = 'extends';
const PROP_KEY_DEFAULT_FILE_NAME = 'defaultFileName';
const PROP_KEY_COMMANDS = 'commands';

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

export type Translator = {
  key: string,
  translate(lineNumber: number, lines: Array<string>): Array<string>,
};

//#################### Config ####################

export class Config {
  #lang = new Map<string, LangDefPartial>();
  constructor() {
    this.#lang.set('', { kind: 'LangDefNeverRun' });
    this.#lang.set(
      "js",
      {
        kind: 'LangDefCommandPartial',
        defaultFileName: 'main.mjs',
        commands: [
          ["node", CMD_VAR_FILE_NAME],
        ],
      }
    );
    this.#lang.set(
      "node-repl",
      {
        kind: 'LangDefCommandPartial',
        translator: nodeReplToJs,
        extends: 'js',
      }
    );
    this.#lang.set(
      "babel",
      {
        kind: 'LangDefCommandPartial',
        defaultFileName: 'main.mjs',
        commands: [
          // https://github.com/giltayar/babel-register-esm
          ["node", "--loader=babel-register-esm", "--disable-warning=ExperimentalWarning", CMD_VAR_FILE_NAME],
        ],
      }
    );
    this.#lang.set(
      "ts",
      {
        kind: 'LangDefCommandPartial',
        defaultFileName: 'main.ts',
        commands: [
          ["npx", "ts-expect-error", CMD_VAR_ALL_FILE_NAMES],
          ["npx", "tsx", CMD_VAR_FILE_NAME],
        ],
      }
    );
  }
  toJson() {
    return {
      "lang": Object.fromEntries(
        Array.from(
          this.#lang,
          ([key, value]) => [
            key, langDefToJson(value)
          ]
        )
      ),
    };
  }
  applyMod(lineNumber: number, mod: ConfigModJson): void {
    if (mod.lang) {
      for (const [key, langDefJson] of Object.entries(mod.lang)) {
        this.#lang.set(key, langDefFromJson(lineNumber, langDefJson));
      }
    }
  }
  getLang(langKey: string): undefined | LangDef {
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
        if (langDef.kind === 'LangDefCommandPartial') {
          return this.#lookUpLangDefJson(langKey, langDef);
        } else {
          return langDef;
        }
    }
  }
  #lookUpLangDefJson(parentKey: string, partialCommand: LangDefCommandPartial, visitedLanguages = new Set<string>): LangDef {
    const origParentKey = parentKey;
    let result = partialCommand;
    while (true) {
      if (partialCommand.extends === undefined) {
        break;
      }
      if (visitedLanguages.has(partialCommand.extends)) {
        const keyPath = [...visitedLanguages, partialCommand.extends];
        throw new UserError(
          `Cycle in property ${stringify(PROP_KEY_EXTENDS)} (object ${stringify(CONFIG_KEY_LANG)}): ${stringify(keyPath)}`
        );
      }
      visitedLanguages.add(partialCommand.extends);
      const nextLangDef = this.#lang.get(partialCommand.extends);
      if (nextLangDef === undefined) {
        throw new UserError(
          `Language definition ${stringify(parentKey)} refers to unknown language ${stringify(partialCommand.extends)}`
        );
      }
      switch (nextLangDef.kind) {
        case 'LangDefNeverRun':
        case 'LangDefSkip':
        case 'LangDefError':
        case 'LangDefErrorIfRun':
          // End of the road
          return nextLangDef;
        case 'LangDefCommandPartial':
          // `result` extends `nextLangDef` – the properties of the former
          // win.
          result = merge(result, nextLangDef);
          parentKey = partialCommand.extends;
          partialCommand = nextLangDef;
          break;
        default:
          throw new UnsupportedValueError(nextLangDef);
      }
    } // while
    if (result.defaultFileName === undefined) {
      throw new UserError(
        `Language ${stringify(origParentKey)} does not have the property ${stringify(PROP_KEY_DEFAULT_FILE_NAME)}`
      );
    }
    if (result.commands === undefined) {
      throw new UserError(
        `Language ${stringify(origParentKey)} does not have the property ${stringify(PROP_KEY_COMMANDS)}`
      );
    }
    return {
      kind: 'LangDefCommand',
      translator: result.translator,
      defaultFileName: result.defaultFileName,
      commands: result.commands,
    };
  }
}

/**
 * We can’t use object spreading because an optional property may exist and
 * have the value `undefined` – in which case it overrides other,
 * potentially non-undefined, values).
 */
function merge(extending: LangDefCommandPartial, extended: LangDefCommandPartial): LangDefCommandPartial {
  // The properties of `extending` override the properties of `extended`
  // (they win).
  return {
    kind: 'LangDefCommandPartial',
    extends: extending.extends ?? extended.extends,
    translator: extending.translator ?? extended.translator,
    defaultFileName: extending.defaultFileName ?? extended.defaultFileName,
    commands: extending.commands ?? extended.commands,
  };
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
  lang?: Record<string, LangDefPartialJson>,
};
const CONFIG_KEY_LANG = 'lang';

export type LangDefPartialJson =
  | LangDefCommandPartialJson
  | typeof LANG_NEVER_RUN
  | typeof LANG_SKIP
  | typeof LANG_ERROR_IF_RUN
  | typeof LANG_ERROR
  ;

export type LangDefCommandPartialJson = {
  extends?: string,
  translator?: string,
  defaultFileName?: string,
  commands?: Array<Array<string>>,
};


function langDefFromJson(lineNumber: number, langDefJson: LangDefPartialJson): LangDefPartial {
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
  let translator: undefined | Translator;
  if (langDefJson.translator) {
    translator = TRANSLATOR_MAP.get(langDefJson.translator);
    if (translator === undefined) {
      throw new UserError(
        `Unknown translator: ${stringify(langDefJson.translator)}`,
        { lineNumber }
      );
    }
  }
  return {
    kind: 'LangDefCommandPartial',
    extends: langDefJson.extends,
    translator,
    defaultFileName: langDefJson.defaultFileName,
    commands: langDefJson.commands,
  };
}

function langDefToJson(langDef: LangDefPartial): LangDefPartialJson {
  switch (langDef.kind) {
    case 'LangDefNeverRun':
      return LANG_NEVER_RUN;
    case 'LangDefSkip':
      return LANG_SKIP;
    case 'LangDefErrorIfRun':
      return LANG_ERROR_IF_RUN;
    case 'LangDefError':
      return LANG_ERROR;
    case 'LangDefCommandPartial': {
      return {
        extends: langDef.extends,
        ...(
          langDef.translator
          ? {translator: langDef.translator.key}
          : {}
        ),
        defaultFileName: langDef.defaultFileName,
        commands: langDef.commands,
      };
    }
    default:
      throw new UnsupportedValueError(langDef);
  }
}

//#################### ConfigModJsonSchema ####################

export const LangDefCommandPartialJsonSchema = z.object({
  extends: z.optional(z.string()),
  translator: z.optional(z.string()),
  defaultFileName: z.optional(z.string()),
  commands: z.optional(z.array(z.array(z.string()))),
});

export const LangDefPartialJsonSchema = z.union([
  LangDefCommandPartialJsonSchema,
  z.literal(LANG_NEVER_RUN),
  z.literal(LANG_SKIP),
  z.literal(LANG_ERROR_IF_RUN),
  z.literal(LANG_ERROR),
]);

export const ConfigModJsonSchema = z.object({
  marktestDirectory: z.optional(z.string()),
  lang: z.optional(
    z.record(
      LangDefPartialJsonSchema
    )
  ),
});
