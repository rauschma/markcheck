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
  context?: UserErrorContext;
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
    if (opts.context) {
      this.context = opts.context;
    } else if (opts.lineNumber) {
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
  stdoutLines?: Array<string>;
  expectedStdoutLines?: Array<string>
  stderrLines?: Array<string>;
  expectedStderrLines?: Array<string>
  cause?: any;
}

export class MarktestSyntaxError extends Error {
  override name = this.constructor.name;
  context: undefined | UserErrorContext;
  stdoutLines;
  expectedStdoutLines;
  stderrLines;
  expectedStderrLines;
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

export type Output = {
  write(str: string): void;
  writeLine(str?: string): void;
};

export function outputIgnored(): Output {
  return {
    write(_str: string): void { },
    writeLine(_str = ''): void { },
  };
}
export function outputFromWriteStream(writeStream: tty.WriteStream): Output {
  return {
    write(str: string): void {
      writeStream.write(str);
    },
    writeLine(str = ''): void {
      writeStream.write(str + os.EOL);
    },
  };
}
