import { type JsonValue } from '@rauschma/helpers/ts/json.js';

//#################### Heading ####################

export class Heading {
  constructor(public lineNumber: number, public content: string) { }
  toJson(): JsonValue {
    return {
      content: this.content,
    };
  }
}
