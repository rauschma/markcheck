import { createSequentialRegExpEscaper } from '@rauschma/helpers/string/escaper.js';
import { UnsupportedValueError } from '@rauschma/helpers/typescript/error.js';
import { z } from 'zod';
import { CMD_VAR_ALL_FILE_NAMES, CMD_VAR_FILE_NAME, LANG_ERROR_IF_RUN, LANG_SKIP } from '../entity/directive.js';
import { parseSearchAndReplaceString } from '../util/search-and-replace-spec.js';
import { nodeReplToJs } from '../translation/repl-to-js-translator.js';
import type { Translator } from '../translation/translation.js';
import { EntityContextDescription, MarkcheckSyntaxError, type EntityContext } from '../util/errors.js';

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
  afterLines?: Array<string>,
  translator?: Translator,
  runFileName?: string,
  commands?: Array<Array<string>>,
};
const PROP_KEY_EXTENDS = 'extends';
export const PROP_KEY_DEFAULT_FILE_NAME = 'runFileName';
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

/**
 * Issues such as cycles in "extends" and unknown language names are
 * currently checked on demand: After (e.g.) the ConfigMod was parsed that
 * caused them. Thus, we can’t provide a better context for errors in this
 * class.
 */
export const CONFIG_ENTITY_CONTEXT = new EntityContextDescription('Configuration');

export const CONFIG_PROP_BEFORE_LINES = 'beforeLines';
export const CONFIG_PROP_AFTER_LINES = 'afterLines';

export class Config {
  searchAndReplaceFunc: (str: string) => string = (str) => str;
  #searchAndReplaceData: Array<string> = [];
  #lang = new Map<string, LangDef>();
  idToLineMod = new Map<string, LineModJson>();
  toJson(): ConfigModJson {
    return {
      searchAndReplace: this.#searchAndReplaceData,
      lang: Object.fromEntries(
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
   * @param entityContext `configModJson` comes from a config file or a
   * ConfigMod (inside a Markdown file).
   */
  applyMod(entityContext: EntityContext, configModJson: ConfigModJson): void {
    if (configModJson.searchAndReplace) {
      this.#setSearchAndReplace(entityContext, configModJson.searchAndReplace);
    }
    if (configModJson.lang) {
      for (const [key, langDefJson] of Object.entries(configModJson.lang)) {
        this.#lang.set(key, langDefFromJson(entityContext, langDefJson));
      }
    }
    if (configModJson.lineMods) {
      for (const [key, lineModJson] of Object.entries(configModJson.lineMods)) {
        this.idToLineMod.set(key, lineModJson);
      }
    }
  }
  #setSearchAndReplace(entityContext: EntityContext, data: Array<string>) {
    try {
      this.searchAndReplaceFunc = createSequentialRegExpEscaper(
        data.map(
          (str) => parseSearchAndReplaceString(str)
        )
      );
      this.#searchAndReplaceData = data;
    } catch (err) {
      throw new MarkcheckSyntaxError(
        `Could not parse value of property ${stringify(CONFIG_KEY_SEARCH_AND_REPLACE)}`,
        { entityContext, cause: err }
      );
    }
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
        throw new MarkcheckSyntaxError(
          `Cycle in property ${stringify(PROP_KEY_EXTENDS)} (object ${stringify(CONFIG_KEY_LANG)}): ${stringify(keyPath)}`,
          { entityContext: CONFIG_ENTITY_CONTEXT }
        );
      }
      visitedLanguages.add(partialCommand.extends);
      const nextLangDef = this.#lang.get(partialCommand.extends);
      if (nextLangDef === undefined) {
        throw new MarkcheckSyntaxError(
          `Language definition ${stringify(parentKey)} refers to unknown language ${stringify(partialCommand.extends)}`,
          { entityContext: CONFIG_ENTITY_CONTEXT }
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
    if (result.runFileName === undefined) {
      throw new MarkcheckSyntaxError(
        `Language ${stringify(origParentKey)} does not have property ${stringify(PROP_KEY_DEFAULT_FILE_NAME)} (with ${stringify(PROP_KEY_EXTENDS)} taken into consideration)`,
        { entityContext: CONFIG_ENTITY_CONTEXT }
      );
    }
    if (result.commands === undefined) {
      throw new MarkcheckSyntaxError(
        `Language ${stringify(origParentKey)} does not have property ${stringify(PROP_KEY_COMMANDS)} (with ${stringify(PROP_KEY_EXTENDS)} taken into consideration)`,
        { entityContext: CONFIG_ENTITY_CONTEXT }
      );
    }
    return result;
  }
  addDefaults(): this {
    this.#setSearchAndReplace(
      CONFIG_ENTITY_CONTEXT,
      [
        '/[⎡⎤]//',
      ]
    );
    // Bare code blocks may be written but are never run.
    this.#lang.set(
      '',
      {
        kind: 'LangDefSkip'
      }
    );
    this.#lang.set(
      'md',
      {
        kind: 'LangDefSkip'
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
        runFileName: 'main.mjs',
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
        runFileName: 'main.mjs',
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
        runFileName: 'main.ts',
        commands: [
          ["npx", "ts-expect-error", "--unexpected-errors", CMD_VAR_ALL_FILE_NAMES],
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
        runFileName: 'index.html',
        commands: [
          ["npx", "html-validate", CMD_VAR_FILE_NAME],
        ],
      }
    );
    return this;
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
    afterLines: extending.afterLines ?? extended.afterLines,
    translator: extending.translator ?? extended.translator,
    runFileName: extending.runFileName ?? extended.runFileName,
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
   * Markcheck directory. By including it here, we don’t need an extra
   * type+schema for parsing in that case.
   */
  markcheckDirectory?: string,
  searchAndReplace?: Array<string>,
  lang?: Record<string, LangDefJson>,
  lineMods?: Record<string, LineModJson>,
};
export const CONFIG_KEY_LANG = 'lang';
export const CONFIG_KEY_SEARCH_AND_REPLACE = 'searchAndReplace';

export type LineModJson = {
  before?: Array<string>,
  after?: Array<string>,
};

export type LangDefJson =
  | LangDefCommandJson
  | typeof LANG_SKIP
  | typeof LANG_ERROR_IF_RUN
  ;

export type LangDefCommandJson = {
  extends?: string,
  before?: Array<string>,
  after?: Array<string>,
  translator?: string,
  runFileName?: string,
  commands?: Array<Array<string>>,
};

/**
 * @param context `configModJson` comes from a config file or a ConfigMod
 * (inside a Markdown file).
 */
function langDefFromJson(context: EntityContext, langDefJson: LangDefJson): LangDef {
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
      throw new MarkcheckSyntaxError(
        `Unknown translator: ${stringify(langDefJson.translator)}`,
        { entityContext: context }
      );
    }
  }
  return {
    kind: 'LangDefCommand',
    extends: langDefJson.extends,
    beforeLines: langDefJson.before,
    afterLines: langDefJson.after,
    translator,
    runFileName: langDefJson.runFileName,
    commands: langDefJson.commands,
  };
}

function langDefToJson(langDef: LangDef): LangDefJson {
  switch (langDef.kind) {
    case 'LangDefSkip':
      return LANG_SKIP;
    case 'LangDefErrorIfRun':
      return LANG_ERROR_IF_RUN;
    case 'LangDefCommand': {
      const result: LangDefJson = {
      };
      if (langDef.extends) {
        result.extends = langDef.extends;
      }
      if (langDef.beforeLines) {
        result.before = langDef.beforeLines;
      }
      if (langDef.afterLines) {
        result.before = langDef.afterLines;
      }
      if (langDef.translator) {
        result.translator = langDef.translator.key;
      }
      if (langDef.runFileName) {
        result.runFileName = langDef.runFileName;
      }
      if (langDef.commands) {
        result.commands = langDef.commands;
      }
      return result;
    }
    default:
      throw new UnsupportedValueError(langDef);
  }
}

//#################### ConfigModJsonSchema ####################

export const LangDefCommandJsonSchema = z.object({
  extends: z.optional(z.string()),
  before: z.optional(z.array(z.string())),
  after: z.optional(z.array(z.string())),
  translator: z.optional(z.string()),
  runFileName: z.optional(z.string()),
  commands: z.optional(z.array(z.array(z.string()))),
}).strict();

export const LangDefJsonSchema = z.union([
  z.literal(LANG_SKIP),
  z.literal(LANG_ERROR_IF_RUN),
  LangDefCommandJsonSchema,
]);

export const LineModJsonSchema = z.object({
  before: z.optional(z.array(z.string())),
  after: z.optional(z.array(z.string())),
}).strict();

export const ConfigModJsonSchema = z.object({
  markcheckDirectory: z.optional(z.string()),
  searchAndReplace: z.optional(z.array(z.string())),
  lang: z.optional(
    z.record(LangDefJsonSchema)
  ),
  lineMods: z.optional(
    z.record(LineModJsonSchema)
  ),
}).strict();
