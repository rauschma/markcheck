import { type JsonValue } from '@rauschma/helpers/typescript/json.js';
import json5 from 'json5';
import * as os from 'node:os';
import { ZodError } from 'zod';
import { ConfigModJsonSchema, type ConfigModJson } from '../core/config.js';
import { MarkcheckSyntaxError, contextLineNumber, type EntityContext } from '../util/errors.js';
import { type Directive } from './directive.js';
import { MarkcheckEntity } from './markcheck-entity.js';

//#################### ConfigMod ####################

export class ConfigMod extends MarkcheckEntity {
  lineNumber: number;
  configModJson: ConfigModJson;
  constructor(directive: Directive) {
    super();
    this.lineNumber = directive.lineNumber;
    try {
      const text = directive.body.join(os.EOL);
      const json = json5.parse(text);
      this.configModJson = ConfigModJsonSchema.parse(json);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new MarkcheckSyntaxError(
          `Error while parsing JSON5 config data:${os.EOL}${err.message}`,
          { lineNumber: this.lineNumber }
        );
      } else if (err instanceof ZodError) {
        throw new MarkcheckSyntaxError(
          `Config properties are wrong:${os.EOL}${json5.stringify(err.format(), {space: 2})}`,
          { lineNumber: this.lineNumber }
        );
      } else {
        // Unexpected error
        throw err;
      }
    }
  }
  override getEntityContext(): EntityContext {
    return contextLineNumber(this.lineNumber);
  }
  toJson(): JsonValue {
    return {
      configModJson: this.configModJson,
    };
  }
}
