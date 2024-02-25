import { AssertionError } from "node:assert";

export class InternalError extends Error {
  override name = this.constructor.name;
}

export type LineNumber = number;

export type UserErrorContext = UserErrorContextLineNumber | UserErrorContextDescription;
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
  stderr?: string;
  cause?: any;
}
export class UserError extends Error {
  override name = this.constructor.name;
  context;
  lineNumber;
  stderr;
  constructor(message: string, {context, lineNumber, stderr, cause}: UserErrorOptions = {}) {
    const options = cause ? {cause} : undefined;
    super(message, options);
    this.context = context;
    this.lineNumber = lineNumber;
    this.stderr = stderr;
  }
}

export function assertionErrorToUserError(lineNumber: LineNumber, callback: () => void) {
  try {
    callback();
  } catch (err) {
    if (!(err instanceof AssertionError)) {
      throw err;
    }
    throw new UserError(err.message, {lineNumber, cause: err})
  }
}