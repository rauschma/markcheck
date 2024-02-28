import { UnsupportedValueError } from "@rauschma/helpers/ts/error.js";
import { AssertionError } from "node:assert";

export class InternalError extends Error {
  override name = this.constructor.name;
}

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

export interface UserErrorOptions {
  context?: UserErrorContext;
  lineNumber?: number;
  stdoutLines?: Array<string>;
  expectedStdoutLines?: Array<string>
  stderrLines?: Array<string>;
  expectedStderrLines?: Array<string>
  cause?: any;
}
export class UserError extends Error {
  override name = this.constructor.name;
  context: undefined | UserErrorContext;
  stdoutLines;
  expectedStdoutLines;
  stderrLines;
  expectedStderrLines;
  constructor(message: string, opts: UserErrorOptions = {}) {
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
}

export function assertionErrorToUserError(lineNumber: LineNumber, callback: () => void) {
  try {
    callback();
  } catch (err) {
    if (!(err instanceof AssertionError)) {
      throw err;
    }
    throw new UserError(err.message, { lineNumber, cause: err })
  }
}
