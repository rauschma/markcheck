import { type JsonValue } from '@rauschma/helpers/ts/json.js';
import json5 from 'json5';
import * as os from 'node:os';
import { ConfigModJsonSchema, type ConfigModJson } from '../core/config.js';
import { type Directive } from './directive.js';

//#################### ConfigMod ####################

export class ConfigMod {
  lineNumber: number;
  configModJson: ConfigModJson;
  constructor(directive: Directive) {
    this.lineNumber = directive.lineNumber;
    const text = directive.body.join(os.EOL);
    const json = json5.parse(text);
    this.configModJson = ConfigModJsonSchema.parse(json);
  }
  toJson(): JsonValue {
    return {
      configModJson: this.configModJson,
    };
  }
}
