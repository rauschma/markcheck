import { type EntityContext } from '../util/errors.js';

export abstract class MarkcheckEntity {
  abstract getEntityContext(): EntityContext;
}
