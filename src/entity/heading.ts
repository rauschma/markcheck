import { type JsonValue } from '@rauschma/helpers/typescript/json.js';
import { MarkcheckEntity } from './markcheck-entity.js';
import { type EntityContext, contextLineNumber } from '../util/errors.js';

//#################### Heading ####################

export class Heading extends MarkcheckEntity {
  constructor(public lineNumber: number, public content: string) {
    super();
  }
  override getEntityContext(): EntityContext {
    return contextLineNumber(this.lineNumber);
  }

  toJson(): JsonValue {
    return {
      content: this.content,
    };
  }
}
