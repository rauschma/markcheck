import { type JsonValue } from '@rauschma/helpers/typescript/json.js';
import json5 from 'json5';
import * as os from 'node:os';
import { ConfigModJsonSchema, type ConfigModJson } from '../core/config.js';
import { contextLineNumber, type EntityContext } from '../util/errors.js';
import { type Directive } from './directive.js';
import { MarkcheckEntity } from './markcheck-entity.js';

//#################### ConfigMod ####################

export class ConfigMod extends MarkcheckEntity {
  lineNumber: number;
  configModJson: ConfigModJson;
  constructor(directive: Directive) {
    super();
    this.lineNumber = directive.lineNumber;
    const text = directive.body.join(os.EOL);
    const json = json5.parse(text);
    this.configModJson = ConfigModJsonSchema.parse(json);
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
