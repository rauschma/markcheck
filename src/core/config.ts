import { createSequentialEscaper } from '@rauschma/helpers/js/escaper.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { z } from 'zod';
import { nodeReplToJs } from '../translation/repl-to-js-translator.js';
import { TRANSLATOR_MAP } from '../translation/translators.js';
import { UserError } from '../util/errors.js';
import { CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME, LANG_ERROR, LANG_ERROR_IF_RUN, LANG_NEVER_RUN, LANG_SKIP } from './directive.js';

const { stringify } = JSON;

//#################### Types ####################

export type LangDef =
  | LangDefCommand
  | LangDefNeverRun
  | LangDefSkip
  | LangDefError
  | LangDefErrorIfRun
  ;

  /**
 * - We delay assembling the actual language definition (via `.extends`) as
 *   long as possible so that all pieces can be changed.
 */
export type LangDefCommand = {
  kind: 'LangDefCommand',
  extends?: string,
  beforeLines?: Array<string>,
  translator?: Translator,
  defaultFileName?: string,
  commands?: Array<Array<string>>,
};
const PROP_KEY_EXTENDS = 'extends';
export const PROP_KEY_DEFAULT_FILE_NAME = 'defaultFileName';
export const PROP_KEY_COMMANDS = 'commands';

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
  searchAndReplaceFunc: (str: string) => string = (str) => str;
  #searchAndReplaceData: Record<string, string> = {};
  #lang = new Map<string, LangDef>();

  constructor() {
    this.#setSearchAndReplace({
      '[⎡⎤]': '',
    });
    this.#lang.set('', { kind: 'LangDefNeverRun' });
    this.#lang.set(
      "js",
      {
        kind: 'LangDefCommand',
        defaultFileName: 'main.mjs',
        commands: [
          ["node", CMD_VAR_FILE_NAME],
        ],
        beforeLines: [
          `import assert from 'node:assert/strict';`
        ],
      }
    );
    this.#lang.set(
      "node-repl",
      {
        kind: 'LangDefCommand',
        translator: nodeReplToJs,
        extends: 'js',
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
        beforeLines: [
          `import assert from 'node:assert/strict';`
        ],
      }
    );
    this.#lang.set(
      "ts",
      {
        kind: 'LangDefCommand',
        defaultFileName: 'main.ts',
        commands: [
          ["npx", "ts-expect-error", "--report-errors", CMD_VAR_ALL_FILE_NAMES],
          ["npx", "tsx", CMD_VAR_FILE_NAME],
        ],
        beforeLines: [
          `import { expectType, type TypeEqual } from 'ts-expect';`,
          `import assert from 'node:assert/strict';`
        ],
      }
    );
  }
  toJson(): ConfigModJson {
    return {
      "searchAndReplace": this.#searchAndReplaceData,
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
    if (mod.searchAndReplace) {
      this.#setSearchAndReplace(mod.searchAndReplace);
    }
    if (mod.lang) {
      for (const [key, langDefJson] of Object.entries(mod.lang)) {
        this.#lang.set(key, langDefFromJson(lineNumber, langDefJson));
      }
    }
  }
  #setSearchAndReplace(data: Record<string, string>) {
    this.searchAndReplaceFunc = createSequentialEscaper(Object.entries(data));
    this.#searchAndReplaceData = data;
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
        if (langDef.kind === 'LangDefCommand') {
          return this.#lookUpLangDefJson(langKey, langDef);
        } else {
          return langDef;
        }
    }
  }
  #lookUpLangDefJson(parentKey: string, partialCommand: LangDefCommand, visitedLanguages = new Set<string>): LangDef {
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
        case 'LangDefCommand':
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
    return result;
  }
}

/**
 * We can’t use object spreading because an optional property may exist and
 * have the value `undefined` – in which case it overrides other,
 * potentially non-undefined, values.
 */
function merge(extending: LangDefCommand, extended: LangDefCommand): LangDefCommand {
  // The properties of `extending` override the properties of `extended`
  // (they win).
  return {
    kind: 'LangDefCommand',
    extends: extending.extends ?? extended.extends,
    beforeLines: extending.beforeLines ?? extended.beforeLines,
    translator: extending.translator ?? extended.translator,
    defaultFileName: extending.defaultFileName ?? extended.defaultFileName,
    commands: extending.commands ?? extended.commands,
  };
}

export function fillInCommandVariables(commands: Array<Array<string>>, vars: Record<string, Array<string>>): Array<Array<string>> {
  return commands.map(cmdParts => cmdParts.flatMap(
    (part): Array<string> => {
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
  /**
   * Ignored by class `Config`. The first ConfigMod in a file can set the
   * Marktest directory. By including it here, we don’t need an extra
   * type+schema for parsing in that case.
   */
  marktestDirectory?: string,
  searchAndReplace?: Record<string, string>,
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
  before?: Array<string>,
  translator?: string,
  defaultFileName?: string,
  commands?: Array<Array<string>>,
};

function langDefFromJson(lineNumber: number, langDefJson: LangDefPartialJson): LangDef {
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
    kind: 'LangDefCommand',
    extends: langDefJson.extends,
    beforeLines: langDefJson.before,
    translator,
    defaultFileName: langDefJson.defaultFileName,
    commands: langDefJson.commands,
  };
}

function langDefToJson(langDef: LangDef): LangDefPartialJson {
  switch (langDef.kind) {
    case 'LangDefNeverRun':
      return LANG_NEVER_RUN;
    case 'LangDefSkip':
      return LANG_SKIP;
    case 'LangDefErrorIfRun':
      return LANG_ERROR_IF_RUN;
    case 'LangDefError':
      return LANG_ERROR;
    case 'LangDefCommand': {
      return {
        extends: langDef.extends,
        before: langDef.beforeLines,
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
  before: z.optional(z.array(z.string())),
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
  searchAndReplace: z.optional(z.record(z.string())),
  lang: z.optional(
    z.record(
      LangDefPartialJsonSchema
    )
  ),
});
