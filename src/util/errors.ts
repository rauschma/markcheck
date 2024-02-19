import { AssertionError } from "node:assert";

export class InternalError extends Error {
  override name = this.constructor.name;
}

export type LineNumber = number;

export interface UserErrorOptions {
  lineNumber?: number;
  stderr?: string;
  cause?: any;
}
export class UserError extends Error {
  override name = this.constructor.name;
  lineNumber;
  stderr;
  constructor(message: string, {lineNumber, stderr, cause}: UserErrorOptions = {}) {
    const options = cause ? {cause} : undefined;
    super(message, options);
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