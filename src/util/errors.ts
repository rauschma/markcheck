import { style } from '@rauschma/helpers/nodejs/text-style.js';
import { UnsupportedValueError } from '@rauschma/helpers/ts/error.js';
import * as os from 'node:os';
import * as tty from 'node:tty';

export const STATUS_EMOJI_SUCCESS = style.FgGreen`✔︎`;
export const STATUS_EMOJI_FAILURE = '❌';

//#################### UserErrorContext ####################

export type LineNumber = number;

export type UserErrorContext = UserErrorContextLineNumber | UserErrorContextDescription;
export function describeUserErrorContext(context: UserErrorContext): string {
  switch (context.kind) {
    case 'UserErrorContextDescription':
      return context.description;
    case 'UserErrorContextLineNumber':
      return `line ${context.lineNumber}`;
    default:
      throw new UnsupportedValueError(context);
  }
}

export type UserErrorContextLineNumber = {
  kind: 'UserErrorContextLineNumber',
  lineNumber: number,
};
export function contextLineNumber(lineNumber: number): UserErrorContextLineNumber {
  return {
    kind: 'UserErrorContextLineNumber',
    lineNumber,
  };
}
export type UserErrorContextDescription = {
  kind: 'UserErrorContextDescription',
  description: string,
};
export function contextDescription(description: string): UserErrorContextDescription {
  return {
    kind: 'UserErrorContextDescription',
    description,
  };
}

//#################### TestFailure ####################

export interface TestFailureOptions {
  lineNumber?: number;
  stdoutLines?: Array<string>;
  expectedStdoutLines?: Array<string>
  stderrLines?: Array<string>;
  expectedStderrLines?: Array<string>
  cause?: any;
}

export class TestFailure extends Error {
  override name = this.constructor.name;
  context: undefined | UserErrorContext;
  stdoutLines;
  expectedStdoutLines;
  stderrLines;
  expectedStderrLines;
  constructor(message: string, opts: TestFailureOptions = {}) {
    super(
      message,
      (opts.cause ? { cause: opts.cause } : undefined)
    );
    if (opts.lineNumber) {
      this.context = {
        kind: 'UserErrorContextLineNumber',
        lineNumber: opts.lineNumber,
      };
    }
    this.stdoutLines = opts.stdoutLines;
    this.expectedStdoutLines = opts.expectedStdoutLines;
    this.stderrLines = opts.stderrLines;
    this.expectedStderrLines = opts.expectedStderrLines;
  }
  logTo(out: Output, prefix = ''): void {
    const description = (
      this.context
        ? describeUserErrorContext(this.context)
        : 'unknown context'
    );
    out.writeLine(`${prefix}[${description}] ${this.message}`);
    if (this.stack) {
      out.writeLine(this.stack);
    }
  }
}
//#################### MarktestSyntaxError ####################

export interface MarktestSyntaxErrorOptions {
  context?: UserErrorContext;
  lineNumber?: number;
  cause?: any;
}

export class MarktestSyntaxError extends Error {
  override name = this.constructor.name;
  context: undefined | UserErrorContext;
  constructor(message: string, opts: MarktestSyntaxErrorOptions = {}) {
    super(
      message,
      (opts.cause ? { cause: opts.cause } : undefined)
    );
    if (opts.context) {
      this.context = opts.context;
    } else if (opts.lineNumber) {
      this.context = {
        kind: 'UserErrorContextLineNumber',
        lineNumber: opts.lineNumber,
      };
    }
  }
  logTo(out: Output, prefix = ''): void {
    const description = (
      this.context
        ? describeUserErrorContext(this.context)
        : 'unknown context'
    );
    out.writeLine(`${prefix}[${description}] ${this.message}`);
    if (this.stack) {
      out.writeLine(this.stack);
    }
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
    return new Output((_str) => {});
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
