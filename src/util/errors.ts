import { style } from '@rauschma/nodejs-tools/cli/text-style.js';
import * as os from 'node:os';
import * as tty from 'node:tty';

export const STATUS_EMOJI_SUCCESS = style.FgGreen`✔︎`;
export const STATUS_EMOJI_FAILURE = '❌';

//#################### EntityContext ####################

export type LineNumber = number;

export abstract class EntityContext {
  abstract describe(): string;
}

export class EntityContextSnippet extends EntityContext {
  constructor(public lineNumber: number, public lang: string) {
    super();
  }
  override describe(): string {
    return `L${this.lineNumber} (${this.lang})`;
  }
}
export class EntityContextLineNumber extends EntityContext {
  constructor(public lineNumber: number) {
    super();
  }
  override describe(): string {
    return `L${this.lineNumber}`;
  }
}
export class EntityContextDescription extends EntityContext {
  constructor(public description: string) {
    super();
  }
  override describe(): string {
    return this.description;
  }
}

//#################### TestFailure ####################

export const PROP_STDOUT = 'stdout';
export const PROP_STDERR = 'stderr';

export type TestFailureOptions = {
  lineNumber?: number,
  [PROP_STDOUT]?: {
    actualLines: Array<string>,
    expectedLines?: Array<string>,
  },
  [PROP_STDERR]?: {
    actualLines: Array<string>,
    expectedLines?: Array<string>,
  },
  cause?: any,
}

/**
 * Thrown when running code did work as expected.
 */
export class TestFailure extends Error {
  override name = this.constructor.name;
  context: undefined | EntityContext;
  actualStdoutLines: undefined | Array<string>;
  expectedStdoutLines: undefined | Array<string>;
  actualStderrLines: undefined | Array<string>;
  expectedStderrLines: undefined | Array<string>;
  constructor(message: string, opts: TestFailureOptions = {}) {
    super(
      message,
      (opts.cause ? { cause: opts.cause } : undefined)
    );
    if (opts.lineNumber) {
      this.context = new EntityContextLineNumber(opts.lineNumber);
    }
    this.actualStdoutLines = opts[PROP_STDOUT]?.actualLines;
    this.expectedStdoutLines = opts[PROP_STDOUT]?.expectedLines;
    this.actualStderrLines = opts[PROP_STDERR]?.actualLines;
    this.expectedStderrLines = opts[PROP_STDERR]?.expectedLines;
  }
}

//#################### MarkcheckSyntaxError ####################

export interface MarkcheckSyntaxErrorOptions {
  entity?: { getEntityContext(): EntityContext };
  entityContext?: EntityContext;
  lineNumber?: number;
  cause?: any;
}

/**
 * Thrown when any aspect of Markcheck’s syntax is wrong: unknown
 * attributes, wrong format for `searchAndReplace`, etc.
 */
export class MarkcheckSyntaxError extends Error {
  override name = this.constructor.name;
  context: undefined | EntityContext;
  constructor(message: string, opts: MarkcheckSyntaxErrorOptions = {}) {
    super(
      message,
      (opts.cause ? { cause: opts.cause } : undefined)
    );
    if (opts.entity) {
      this.context = opts.entity.getEntityContext();
    } else if (opts.entityContext) {
      this.context = opts.entityContext;
    } else if (opts.lineNumber) {
      this.context = new EntityContextLineNumber(opts.lineNumber);
    }
  }
  logTo(out: Output, prefix = ''): void {
    const description = (
      this.context
        ? this.context.describe()
        : 'unknown context'
    );
    out.writeLine(`${prefix}[${description}] ${this.message}`);
  }
}

//#################### StartupError ####################

export class StartupError extends Error {
  constructor(message: string) {
    super(message);
  }
}

//#################### InternalError ####################

export class InternalError extends Error {
  override name = this.constructor.name;
}

//#################### Output ####################

/** @see https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters */
const RE_ANSI_SGR_ESCAPE = /\x1B\[[0-9;]*m/g;

export class Output {
  static toStdout(): Output {
    return Output.toWriteStream(process.stdout);
  }
  static toStdoutWithoutAnsiEscapes(): Output {
    return new Output((str) => process.stdout.write(str.replaceAll(RE_ANSI_SGR_ESCAPE, '')));
  }
  static toWriteStream(writeStream: tty.WriteStream): Output {
    return new Output((str) => writeStream.write(str));
  }
  static ignore(): Output {
    return new Output((_str) => { });
  }
  #write;
  constructor(write: (str: string) => void) {
    this.#write = write;
  }
  write(str: string): void {
    this.#write(str);
  }
  writeLine(str = ''): void {
    this.#write(str + os.EOL);
  }
}
