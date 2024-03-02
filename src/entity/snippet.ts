import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import { type JsonValue } from '@rauschma/helpers/ts/json.js';
import { assertNonNullable, assertTrue } from '@rauschma/helpers/ts/type.js';
import { CONFIG_KEY_LANG, CONFIG_PROP_BEFORE_LINES, Config, PROP_KEY_DEFAULT_FILE_NAME, type LangDef, type LangDefCommand } from '../core/config.js';
import type { Translator } from '../translation/translation.js';
import { UserError, contextDescription, contextLineNumber, type UserErrorContext } from '../util/errors.js';
import { getEndTrimmedLength } from '../util/string.js';
import { ConfigMod } from './config-mod.js';
import { ATTR_ALWAYS_RUN, ATTR_KEY_APPLY_INNER, ATTR_KEY_APPLY_OUTER, ATTR_KEY_CONTAINED_IN_FILE, ATTR_KEY_EXTERNAL, ATTR_KEY_ID, ATTR_KEY_IGNORE_LINES, ATTR_KEY_INCLUDE, ATTR_KEY_INTERNAL, ATTR_KEY_LANG, ATTR_KEY_ONLY, ATTR_KEY_ONLY_LOCAL_LINES, ATTR_KEY_SAME_AS_ID, ATTR_KEY_SEARCH_AND_REPLACE, ATTR_KEY_SEQUENCE, ATTR_KEY_SKIP, ATTR_KEY_STDERR, ATTR_KEY_STDOUT, ATTR_KEY_WRITE_INNER, ATTR_KEY_WRITE_OUTER, LANG_KEY_EMPTY, SearchAndReplaceSpec, parseExternalSpecs, parseLineNumberSet, parseSequenceNumber, type Directive, type ExternalSpec, type SequenceNumber } from './directive.js';
import { Heading } from './heading.js';
import { LineLocModifier } from './insertion-rules.js';
import { LineMod } from './line-mod.js';

const { stringify } = JSON;

export type MarktestEntity = ConfigMod | Snippet | LineMod | Heading;
export function getUserErrorContext(entity: MarktestEntity): UserErrorContext {
  if (entity instanceof ConfigMod || entity instanceof Snippet || entity instanceof Heading) {
    return contextLineNumber(entity.lineNumber);
  } else if (entity instanceof LineMod) {
    return entity.context;
  } else {
    throw new UnsupportedValueError(entity);
  }
}

//#################### Assembling lines ####################

export function getTargetSnippet(cliState: CliState, sourceLineNumber: number, attrKey: string, targetId: string): Snippet {
  const targetSnippet = cliState.idToSnippet.get(targetId);
  if (!targetSnippet) {
    throw new UserError(
      `Unknown ID ${JSON.stringify(targetId)} (attribute ${stringify(attrKey)})`,
      { lineNumber: sourceLineNumber }
    );
  }
  return targetSnippet;
}

export function assembleOuterLinesForId(cliState: CliState, config: Config, sourceLineNumber: number, attrKey: string, targetId: string): Array<string> {
  const targetSnippet = getTargetSnippet(cliState, sourceLineNumber, attrKey, targetId);
  return assembleOuterLines(cliState, config, targetSnippet);
}

export function assembleInnerLines(cliState: CliState, config: Config, snippet: Snippet): Array<string> {
  const lines = new Array<string>();
  snippet.assembleLines(config, cliState.idToSnippet, cliState.idToLineMod, lines, new Set());
  return lines;
}

export function assembleOuterLines(cliState: CliState, config: Config, snippet: Snippet) {
  const lines = new Array<string>();

  const outerLineMods = collectOuterLineMods(snippet.onlyLocalLines);

  for (let i = 0; i < outerLineMods.length; i++) {
    outerLineMods[i].pushBeforeLines(lines);
  }
  // Once per snippet (in sequences, includes, etc.):
  // - Inner applicable line mod
  // - Local line mod (before, after, inserted lines)
  snippet.assembleLines(config, cliState.idToSnippet, cliState.idToLineMod, lines, new Set());
  for (let i = outerLineMods.length - 1; i >= 0; i--) {
    outerLineMods[i].pushAfterLines(lines);
  }
  return lines;

  function collectOuterLineMods(onlyLocalLines: boolean): Array<LineMod> {
    // Once per file:
    // - Config before lines
    // - Global line mod
    // - Outer applicable line mod
    const outerLineMods = new Array<LineMod>();

    if (!onlyLocalLines) {
      if (snippet.lang) {
        const lang = config.getLang(snippet.lang);
        if (lang && lang.kind === 'LangDefCommand' && lang.beforeLines) {
          outerLineMods.push(
            LineMod.fromBeforeLines(
              contextDescription(`Config property ${CONFIG_PROP_BEFORE_LINES}`),
              { tag: 'LineModKindConfig' },
              lang.beforeLines,
            )
          );
        }
      }
      const globalLineMods = cliState.globalLineMods.get(snippet.lang);
      if (globalLineMods) {
        outerLineMods.push(...globalLineMods);
      }
    }

    // `applyOuter` contributes outer lines but is applied locally
    const applyOuterId = snippet.applyOuterId;
    if (applyOuterId) {
      const applyLineMod = cliState.idToLineMod.get(applyOuterId);
      if (applyLineMod === undefined) {
        throw new UserError(
          `Attribute ${ATTR_KEY_APPLY_OUTER} contains an ID that either doesn’t exist or does not refer to a line mod`,
          { lineNumber: snippet.lineNumber }
        );
      }
      outerLineMods.push(applyLineMod);
    }
    return outerLineMods;
  }
}

//#################### Snippet ####################

export abstract class Snippet {
  abstract get lineNumber(): number;
  //
  abstract get id(): null | string;
  abstract get runningMode(): RuningMode;
  //
  abstract get lang(): string;
  //
  abstract get onlyLocalLines(): boolean;
  abstract get applyOuterId(): null | string;
  //
  abstract get sameAsId(): null | string;
  abstract get containedInFile(): null | string;
  //
  abstract get writeInner(): null | string;
  abstract get writeOuter(): null | string;
  abstract get externalSpecs(): Array<ExternalSpec>;
  //
  abstract get stdoutId(): null | string;
  abstract get stderrId(): null | string;

  abstract getInternalFileName(langDef: LangDef): string;
  abstract isRun(globalVisitationMode: GlobalRunningMode): boolean;
  abstract assembleLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>): void;
  abstract getAllFileNames(langDef: LangDefCommand): Array<string>;

  abstract toJson(): JsonValue;
}

//#################### SingleSnippet ####################

export class SingleSnippet extends Snippet {
  static createOpen(directive: Directive): SingleSnippet {
    const snippet = new SingleSnippet(directive.lineNumber);

    snippet.id = directive.getString(ATTR_KEY_ID);

    { // runningMode
      if (directive.hasAttribute(ATTR_KEY_ID)) {
        // Initial default value:
        // - By default, snippets with IDs are not run.
        //   - Rationale: included somewhere and run there.
        // - To still run a snippet with an ID, use `only` or `alwaysRun`.
        snippet.runningMode = RuningMode.Skip;
      }
      let runningAttributes = 0;
      if (directive.hasAttribute(ATTR_KEY_SKIP)) {
        snippet.runningMode = RuningMode.Skip;
        runningAttributes++;
      }
      if (directive.hasAttribute(ATTR_ALWAYS_RUN)) {
        snippet.runningMode = RuningMode.AlwaysRun;
        runningAttributes++;
      }
      if (directive.hasAttribute(ATTR_KEY_ONLY)) {
        snippet.runningMode = RuningMode.Only;
        runningAttributes++;
      }
      if (runningAttributes > 1) {
        const attrs = [ATTR_KEY_SKIP, ATTR_ALWAYS_RUN, ATTR_KEY_ONLY];
        throw new UserError(
          `Snippet has more than one of these attributes: ${attrs.join(', ')}`,
          { lineNumber: directive.lineNumber }
        );
      }
    }

    { // Assembling lines
      const sequence = directive.getString(ATTR_KEY_SEQUENCE);
      if (sequence) {
        snippet.sequenceNumber = parseSequenceNumber(sequence);
      }

      const include = directive.getString(ATTR_KEY_INCLUDE);
      if (include) {
        snippet.includeIds = include.split(/ *, */);
      }

      snippet.#applyInnerId = directive.getString(ATTR_KEY_APPLY_INNER);
      snippet.applyOuterId = directive.getString(ATTR_KEY_APPLY_OUTER);
      snippet.onlyLocalLines = directive.getBoolean(ATTR_KEY_ONLY_LOCAL_LINES);
      const ignoreLinesStr = directive.getString(ATTR_KEY_IGNORE_LINES);
      if (ignoreLinesStr) {
        snippet.#ignoreLines = parseLineNumberSet(directive.lineNumber, ignoreLinesStr);
      }
      const searchAndReplaceStr = directive.getString(ATTR_KEY_SEARCH_AND_REPLACE);
      if (searchAndReplaceStr) {
        snippet.#searchAndReplace = SearchAndReplaceSpec.fromString(
          contextLineNumber(directive.lineNumber), searchAndReplaceStr
        );
      }
    }

    { // Checks
      const sameAsId = directive.getString(ATTR_KEY_SAME_AS_ID);
      if (sameAsId) {
        snippet.sameAsId = sameAsId;
      }
      const containedInFile = directive.getString(ATTR_KEY_CONTAINED_IN_FILE);
      if (containedInFile) {
        snippet.containedInFile = containedInFile;
      }
    }

    const lang = directive.getString(ATTR_KEY_LANG);
    if (lang) {
      snippet.#lang = lang;
    }

    { // File names
      snippet.writeInner = directive.getString(ATTR_KEY_WRITE_INNER);
      snippet.writeOuter = directive.getString(ATTR_KEY_WRITE_OUTER);
      snippet.#internalFileName = directive.getString(ATTR_KEY_INTERNAL);
      const external = directive.getString(ATTR_KEY_EXTERNAL);
      if (external) {
        snippet.externalSpecs = parseExternalSpecs(directive.lineNumber, external);
      }
    }

    snippet.stdoutId = directive.getString(ATTR_KEY_STDOUT);
    snippet.stderrId = directive.getString(ATTR_KEY_STDERR);

    return snippet;
  }
  static createClosedFromBodyDirective(directive: Directive): SingleSnippet {
    const openSnippet = SingleSnippet.createOpen(directive);
    let lang = openSnippet.#lang;
    if (lang === null) {
      // Body directive has neither attribute `lang` nor attribute `write`.
      // Assign a default. Use case: Checking stdout or stderr.
      lang = LANG_KEY_EMPTY;
    }
    return openSnippet.closeWithBody(lang, directive.body);
  }
  static createClosedFromCodeBlock(lineNumber: number, lang: string, lines: Array<string>): SingleSnippet {
    return new SingleSnippet(lineNumber).closeWithBody(lang, lines);
  }
  lineNumber: number;
  id: null | string = null;
  runningMode: RuningMode = RuningMode.Normal;
  //
  sequenceNumber: null | SequenceNumber = null;
  includeIds = new Array<string>();
  localLineMod: null | LineMod = null;
  #applyInnerId: null | string = null;
  applyOuterId: null | string = null;
  onlyLocalLines = false;
  #ignoreLines = new Set<number>();
  #searchAndReplace: null | SearchAndReplaceSpec = null;
  //
  sameAsId: null | string = null;
  containedInFile: null | string = null;
  //
  #lang: null | string = null;
  //
  writeInner: null | string = null;
  writeOuter: null | string = null;
  #internalFileName: null | string = null;
  externalSpecs = new Array<ExternalSpec>();
  //
  stdoutId: null | string = null;
  stderrId: null | string = null;
  //
  isClosed = false;
  body = new Array<string>();

  private constructor(lineNumber: number) {
    super();
    this.lineNumber = lineNumber;
  }

  override get lang(): string {
    assertNonNullable(this.#lang);
    return this.#lang;
  }

  override getInternalFileName(langDef: LangDef): string {
    if (this.#internalFileName) {
      return this.#internalFileName;
    }
    if (langDef.kind === 'LangDefCommand' && langDef.defaultFileName !== undefined) {
      return langDef.defaultFileName;
    }
    throw new UserError(
      `Snippet does not have a filename: neither via config (${stringify(CONFIG_KEY_LANG)} property ${stringify(PROP_KEY_DEFAULT_FILE_NAME)}) nor via attribute ${stringify(ATTR_KEY_INTERNAL)}`,
      { lineNumber: this.lineNumber }
    );
  }

  override isRun(globalVisitationMode: GlobalRunningMode): boolean {
    // this.visitationMode is set up by factory methods where `id` etc. are
    // considered.
    switch (globalVisitationMode) {
      case GlobalRunningMode.Normal:
        switch (this.runningMode) {
          case RuningMode.Normal:
          case RuningMode.Only:
          case RuningMode.AlwaysRun:
            return true;
          case RuningMode.Skip:
            return false;
          default:
            throw new UnsupportedValueError(this.runningMode);
        }
      case GlobalRunningMode.Only:
        switch (this.runningMode) {
          case RuningMode.Only:
          case RuningMode.AlwaysRun:
            return true;
          case RuningMode.Normal:
          case RuningMode.Skip:
            return false;
          default:
            throw new UnsupportedValueError(this.runningMode);
        }
      default:
        throw new UnsupportedValueError(globalVisitationMode);
    }
  }

  closeWithBody(lang: string, lines: Array<string>): this {
    assertTrue(!this.isClosed);
    // If .#lang is non-null, then it was set by the directive – which
    // overrides the language of the code block.
    if (this.#lang === null) {
      this.#lang = lang;
    }
    assertTrue(this.#lang !== null);
    const len = getEndTrimmedLength(lines);
    for (let i = 0; i < len; i++) {
      this.body.push(lines[i]);
    }
    this.isClosed = true;
    return this;
  }

  override assembleLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>): void {
    let thisWasIncluded = false;
    for (const includeId of this.includeIds) {
      if (includeId === '$THIS') {
        this.#assembleThis(config, idToLineMod, lines);
        thisWasIncluded = true;
        continue;
      }
      this.#assembleOneInclude(config, idToSnippet, idToLineMod, lines, pathOfIncludeIds, includeId);
    } // for
    if (!thisWasIncluded) {
      // Omitting `$THIS` is the same as putting it last
      this.#assembleThis(config, idToLineMod, lines);
    }
  }

  #assembleOneInclude(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>, includeId: string) {
    if (pathOfIncludeIds.has(includeId)) {
      const idPath = [...pathOfIncludeIds, includeId];
      throw new UserError(`Cycle of includedIds ` + JSON.stringify(idPath));
    }
    const snippet = idToSnippet.get(includeId);
    if (snippet === undefined) {
      throw new UserError(
        `Snippet includes the unknown ID ${JSON.stringify(includeId)}`,
        { lineNumber: this.lineNumber }
      );
    }
    pathOfIncludeIds.add(includeId);
    snippet.assembleLines(config, idToSnippet, idToLineMod, lines, pathOfIncludeIds);
    pathOfIncludeIds.delete(includeId);
  }

  #assembleThis(config: Config, idToLineMod: Map<string, LineMod>, linesOut: Array<string>) {
    const innerAppliedLineMod = this.#getInnerAppliedLineMod(idToLineMod);
    if (innerAppliedLineMod) {
      innerAppliedLineMod.pushBeforeLines(linesOut);
    }
    if (this.localLineMod) {
      this.localLineMod.pushBeforeLines(linesOut);
    }

    // - Line-ignoring clashes with line insertion via
    //   `this.localLineMod` because both change line indices.
    // - However, ignored line numbers would make no sense at all after
    //   inserting lines, which is why ignore first.
    let body = this.body.filter(
      (_line, index) => !this.#ignoreLines.has(index + 1)
    );

    // We only search-and-replace in visible (non-inserted) lines because
    // we can do whatever we want in invisible lines.
    const sar = this.#searchAndReplace;
    if (sar) {
      body = body.map(
        line => sar.replaceAll(line)
      );
    }

    {
      const nextBody = new Array<string>();
      for (const [index, line] of body.entries()) {
        this.localLineMod?.insertionRules.maybePushLineGroup(LineLocModifier.Before, body.length, index + 1, line, nextBody);
        nextBody.push(line);
        this.localLineMod?.insertionRules.maybePushLineGroup(LineLocModifier.After, body.length, index + 1, line, nextBody);
      }
      body = nextBody;
    }

    const translator = this.#getTranslator(config);
    if (translator) {
      const chunks = translator.translate(this.lineNumber, body);
      for (const chunk of chunks) {
        linesOut.push(...chunk.outputLines);
      }
    } else {
      linesOut.push(...body);
    }

    if (this.localLineMod) {
      this.localLineMod.pushAfterLines(linesOut);
    }
    if (innerAppliedLineMod) {
      innerAppliedLineMod.pushAfterLines(linesOut);
    }
  }

  #getInnerAppliedLineMod(idToLineMod: Map<string, LineMod>): undefined | LineMod {
    if (this.#applyInnerId) {
      const lineMod = idToLineMod.get(this.#applyInnerId);
      if (lineMod === undefined) {
        throw new UserError(
          `Attribute ${ATTR_KEY_APPLY_INNER} contains an ID that either doesn’t exist or does not refer to a line mod`,
          { lineNumber: this.lineNumber }
        );
      }
      return lineMod;
    }
    return undefined;
  }

  #getTranslator(config: Config): undefined | Translator {
    if (this.#lang) {
      const lang = config.getLang(this.#lang);
      if (lang && lang.kind === 'LangDefCommand') {
        return lang.translator;
      }
    }
    return undefined;
  }

  override getAllFileNames(langDef: LangDefCommand): Array<string> {
    return [
      this.getInternalFileName(langDef),
      ...this.externalSpecs.map(es => es.fileName),
    ];
  }
  toJson(): SingleSnippetJson {
    return {
      lineNumber: this.lineNumber,
      lang: this.lang,
      id: this.id,
      external: this.externalSpecs,
      stdout: this.stdoutId,
      body: this.body,
    };
  }
}

//#################### SequenceSnippet ####################

export class SequenceSnippet extends Snippet {
  elements = new Array<SingleSnippet>();

  constructor(singleSnippet: SingleSnippet) {
    super();
    const num = singleSnippet.sequenceNumber;
    assertNonNullable(num);
    if (num.pos !== 1) {
      throw new UserError(
        'First snippet in a sequence must have position 1 (1/*): ' + num,
        { lineNumber: singleSnippet.lineNumber }
      );
    }
    this.elements.push(singleSnippet);
  }

  get nextSequenceNumber(): string {
    return `${this.elements.length + 1}/${this.total}`;
  }

  pushElement(singleSnippet: SingleSnippet, num: SequenceNumber): void {
    assertNonNullable(num);
    if (num.total !== this.total) {
      throw new UserError(
        `Snippet has different total than current sequence (${this.total}): ${num}`,
        { lineNumber: singleSnippet.lineNumber }
      );
    }
    if (num.pos !== (this.elements.length + 1)) {
      throw new UserError(
        `Expected sequence position ${this.elements.length}, but snippet has: ${num}`,
        { lineNumber: singleSnippet.lineNumber }
      );
    }
    this.elements.push(singleSnippet);
  }

  isComplete(): boolean {
    return this.total === this.elements.length;
  }

  get total(): number {
    const num = this.firstElement.sequenceNumber;
    assertNonNullable(num);
    return num.total;
  }

  override assembleLines(config: Config, idToSnippet: Map<string, Snippet>, idToLineMod: Map<string, LineMod>, lines: Array<string>, pathOfIncludeIds: Set<string>): void {
    for (const element of this.elements) {
      element.assembleLines(config, idToSnippet, idToLineMod, lines, pathOfIncludeIds);
    }
  }
  get firstElement(): SingleSnippet {
    const first = this.elements.at(0);
    assertNonNullable(first);
    return first;
  }
  get lastElement(): SingleSnippet {
    const last = this.elements.at(-1);
    assertNonNullable(last);
    return last;
  }

  override get lineNumber(): number {
    return this.firstElement.lineNumber;
  }
  override get id(): null | string {
    return this.firstElement.id;
  }
  override get runningMode(): RuningMode {
    return this.firstElement.runningMode;
  }
  override isRun(globalVisitationMode: GlobalRunningMode): boolean {
    return this.firstElement.isRun(globalVisitationMode);
  }
  override get lang(): string {
    return this.firstElement.lang;
  }
  override get applyOuterId(): null | string {
    return this.firstElement.applyOuterId;
  }
  override get onlyLocalLines(): boolean {
    return this.firstElement.onlyLocalLines;
  }
  override get sameAsId(): null | string {
    return this.firstElement.sameAsId;
  }
  override get containedInFile(): null | string {
    return this.firstElement.containedInFile;
  }
  override getInternalFileName(langDef: LangDef): string {
    return this.firstElement.getInternalFileName(langDef);
  }
  override getAllFileNames(langDef: LangDefCommand): Array<string> {
    return this.firstElement.getAllFileNames(langDef);
  }
  override get writeInner(): null | string {
    return this.firstElement.writeInner;
  }
  override get writeOuter(): null | string {
    return this.firstElement.writeOuter;
  }
  override get externalSpecs(): Array<ExternalSpec> {
    return this.firstElement.externalSpecs;
  }
  override get stdoutId(): null | string {
    return this.firstElement.stdoutId;
  }
  override get stderrId(): null | string {
    return this.firstElement.stderrId;
  }
  toJson(): JsonValue {
    return this.elements.map(e => e.toJson());
  }
}

//#################### Snippet helper types ####################

//========== Running modes ==========

export enum RuningMode {
  Normal = 'Normal',
  Only = 'Only',
  Skip = 'Skip',
  AlwaysRun = 'AlwaysRun',
}
export enum GlobalRunningMode {
  Normal = 'Normal',
  Only = 'Only',
}

//========== JSON ==========

export type SingleSnippetJson = {
  lineNumber: number,
  lang: string,
  id: null | string,
  external: Array<ExternalSpec>,
  stdout: null | string,
  body: Array<string>,
};

/** For testing */
export function snippetJson(partial: Partial<SingleSnippetJson>): SingleSnippetJson {
  return {
    lineNumber: partial.lineNumber ?? 0,
    lang: partial.lang ?? '',
    id: partial.id ?? null,
    external: partial.external ?? [],
    stdout: partial.stdout ?? null,
    body: partial.body ?? [],
  };
}

//========== CliState ==========

export enum LogLevel {
  Verbose,
  Normal
}

export enum FileStatus {
  Failure,
  Success
}

export type CliState = {
  absFilePath: string;
  tmpDir: string;
  logLevel: LogLevel;
  idToSnippet: Map<string, Snippet>;
  idToLineMod: Map<string, LineMod>;
  globalVisitationMode: GlobalRunningMode;
  globalLineMods: Map<string, Array<LineMod>>;
  fileStatus: FileStatus;
  interceptedShellCommands: null | Array<Array<string>>;
};
