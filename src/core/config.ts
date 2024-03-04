import { createSequentialEscaper } from '@rauschma/helpers/js/escaper.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { z } from 'zod';
import { CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME, LANG_ERROR_IF_RUN, LANG_SKIP } from '../entity/directive.js';
import { nodeReplToJs } from '../translation/repl-to-js-translator.js';
import type { Translator } from '../translation/translation.js';
import { ConfigurationError, MarktestSyntaxError, type EntityContext } from '../util/errors.js';

const { stringify } = JSON;

//#################### Types ####################

export type LangDef =
  | LangDefCommand
  | LangDefSkip
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
 * - It allows us to use them to write config files.
 * - But they won’t be run.
 */
export type LangDefSkip = {
  kind: 'LangDefSkip',
};
export type LangDefErrorIfRun = {
  kind: 'LangDefErrorIfRun',
};

//#################### Translators ####################

const TRANSLATORS: Array<Translator> = [
  nodeReplToJs
];

export const TRANSLATOR_MAP = new Map<string, Translator>(
  TRANSLATORS.map(t => [t.key, t])
);

//#################### Config ####################

export const CONFIG_PROP_BEFORE_LINES = 'beforeLines';

export class Config {
  searchAndReplaceFunc: (str: string) => string = (str) => str;
  #searchAndReplaceData: Record<string, string> = {};
  #lang = new Map<string, LangDef>();

  constructor() {
    this.#setSearchAndReplace({
      '[⎡⎤]': '',
    });
    // Bare code blocks may be written but are never run.
    this.#lang.set(
      '',
      {
        kind: 'LangDefErrorIfRun'
      }
    );
    // txt code blocks are always skipped
    this.#lang.set(
      'txt',
      {
        kind: 'LangDefSkip'
      }
    );
    // Ignore for now, built-in check later
    this.#lang.set(
      'json',
      {
        kind: 'LangDefSkip'
      }
    );
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
          ["npx", "@rauschma/expect-error", "--report-errors", CMD_VAR_ALL_FILE_NAMES],
          // Snippets can only check stdout & stderr of last command
          ["npx", "tsx", CMD_VAR_FILE_NAME],
        ],
        beforeLines: [
          `import { expectType, type TypeEqual } from 'ts-expect';`,
          `import assert from 'node:assert/strict';`
        ],
      }
    );
    this.#lang.set(
      "html",
      {
        kind: 'LangDefCommand',
        defaultFileName: 'index.html',
        commands: [
          ["npx", "html-validate", CMD_VAR_FILE_NAME],
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
  /**
   * @param context `configModJson` comes from a config file or a ConfigMod
   * (inside a Markdown file).
   */
  applyMod(context: EntityContext, configModJson: ConfigModJson): void {
    if (configModJson.searchAndReplace) {
      this.#setSearchAndReplace(configModJson.searchAndReplace);
    }
    if (configModJson.lang) {
      for (const [key, langDefJson] of Object.entries(configModJson.lang)) {
        this.#lang.set(key, langDefFromJson(context, langDefJson));
      }
    }
  }
  #setSearchAndReplace(data: Record<string, string>) {
    this.searchAndReplaceFunc = createSequentialEscaper(Object.entries(data));
    this.#searchAndReplaceData = data;
  }
  getLang(langKey: string): undefined | LangDef {
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
  #lookUpLangDefJson(parentKey: string, partialCommand: LangDefCommand, visitedLanguages = new Set<string>): LangDef {
    const origParentKey = parentKey;
    let result = partialCommand;
    while (true) {
      if (partialCommand.extends === undefined) {
        break;
      }
      if (visitedLanguages.has(partialCommand.extends)) {
        const keyPath = [...visitedLanguages, partialCommand.extends];
        throw new ConfigurationError(
          `Cycle in property ${stringify(PROP_KEY_EXTENDS)} (object ${stringify(CONFIG_KEY_LANG)}): ${stringify(keyPath)}`
        );
      }
      visitedLanguages.add(partialCommand.extends);
      const nextLangDef = this.#lang.get(partialCommand.extends);
      if (nextLangDef === undefined) {
        throw new ConfigurationError(
          `Language definition ${stringify(parentKey)} refers to unknown language ${stringify(partialCommand.extends)}`
        );
      }
      switch (nextLangDef.kind) {
        case 'LangDefSkip':
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
      throw new ConfigurationError(
        `Language ${stringify(origParentKey)} does not have the property ${stringify(PROP_KEY_DEFAULT_FILE_NAME)}`
      );
    }
    if (result.commands === undefined) {
      throw new ConfigurationError(
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
export const CONFIG_KEY_LANG = 'lang';

export type LangDefPartialJson =
  | LangDefCommandPartialJson
  | typeof LANG_SKIP
  | typeof LANG_ERROR_IF_RUN
  ;

export type LangDefCommandPartialJson = {
  extends?: string,
  before?: Array<string>,
  translator?: string,
  defaultFileName?: string,
  commands?: Array<Array<string>>,
};

/**
 * @param context `configModJson` comes from a config file or a ConfigMod
 * (inside a Markdown file).
 */
function langDefFromJson(context: EntityContext, langDefJson: LangDefPartialJson): LangDef {
  if (typeof langDefJson === 'string') {
    switch (langDefJson) {
      case LANG_SKIP:
        return { kind: 'LangDefSkip' };
      case LANG_ERROR_IF_RUN:
        return { kind: 'LangDefErrorIfRun' };
      default:
        throw new UnsupportedValueError(langDefJson);
    }
  }
  let translator: undefined | Translator;
  if (langDefJson.translator) {
    translator = TRANSLATOR_MAP.get(langDefJson.translator);
    if (translator === undefined) {
      throw new MarktestSyntaxError(
        `Unknown translator: ${stringify(langDefJson.translator)}`,
        { entityContext: context }
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
    case 'LangDefSkip':
      return LANG_SKIP;
    case 'LangDefErrorIfRun':
      return LANG_ERROR_IF_RUN;
    case 'LangDefCommand': {
      return {
        extends: langDef.extends,
        before: langDef.beforeLines,
        ...(
          langDef.translator
            ? { translator: langDef.translator.key }
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
  z.literal(LANG_SKIP),
  z.literal(LANG_ERROR_IF_RUN),
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
