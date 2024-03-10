import { type JsonValue } from '@rauschma/helpers/typescript/json.js';
import { EntityContextLineNumber, type EntityContext } from '../util/errors.js';
import { MarkcheckEntity } from './markcheck-entity.js';

//#################### Heading ####################

export class Heading extends MarkcheckEntity {
  constructor(public lineNumber: number, public content: string) {
    super();
  }
  override getEntityContext(): EntityContext {
    return new EntityContextLineNumber(this.lineNumber);
  }

  toJson(): JsonValue {
    return {
      content: this.content,
    };
  }
}
