import { style } from '@rauschma/nodejs-tools/cli/text-style.js';
import { UnsupportedValueError } from '@rauschma/helpers/typescript/error.js';
import * as os from 'node:os';
import * as tty from 'node:tty';

export const STATUS_EMOJI_SUCCESS = style.FgGreen`✔︎`;
export const STATUS_EMOJI_FAILURE = '❌';

//#################### EntityContext ####################

export type LineNumber = number;

export type EntityContext = EntityContextSnippet | EntityContextLineNumber | EntityContextDescription;
export type EntityContextSnippet = {
  kind: 'EntityContextSnippet',
  lineNumber: number,
  lang: string,
};
export type EntityContextLineNumber = {
  kind: 'EntityContextLineNumber',
  lineNumber: number,
};
export type EntityContextDescription = {
  kind: 'EntityContextDescription',
  description: string,
};

export function contextSnippet(lineNumber: number, lang: string): EntityContextSnippet {
  return {
    kind: 'EntityContextSnippet',
    lineNumber,
    lang,
  };
}
export function contextLineNumber(lineNumber: number): EntityContextLineNumber {
  return {
    kind: 'EntityContextLineNumber',
    lineNumber,
  };
}
export function contextDescription(description: string): EntityContextDescription {
  return {
    kind: 'EntityContextDescription',
    description,
  };
}
export function describeEntityContext(context: EntityContext): string {
  switch (context.kind) {
    case 'EntityContextDescription':
      return context.description;
    case 'EntityContextLineNumber':
      return `L${context.lineNumber}`;
    case 'EntityContextSnippet':
      return `L${context.lineNumber} (${context.lang})`;
    default:
      throw new UnsupportedValueError(context);
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
      this.context = {
        kind: 'EntityContextLineNumber',
        lineNumber: opts.lineNumber,
      };
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
      this.context = {
        kind: 'EntityContextLineNumber',
        lineNumber: opts.lineNumber,
      };
    }
  }
  logTo(out: Output, prefix = ''): void {
    const description = (
      this.context
        ? describeEntityContext(this.context)
        : 'unknown context'
    );
    out.writeLine(`${prefix}[${description}] ${this.message}`);
  }
}

//#################### ConfigurationError ####################

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

//#################### InternalError ####################

export class InternalError extends Error {
  override name = this.constructor.name;
}

//#################### Output ####################

export class Output {
  static fromStdout(): Output {
    return Output.fromWriteStream(process.stdout);
  }
  static fromWriteStream(writeStream: tty.WriteStream): Output {
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
