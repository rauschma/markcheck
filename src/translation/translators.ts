import type { Translator } from '../core/config.js';
import { nodeReplToJs } from './repl-to-js-translator.js';

const TRANSLATORS: Array<Translator> = [
  nodeReplToJs
];

export const TRANSLATOR_MAP = new Map<string, Translator>(
  TRANSLATORS.map(t => [t.key, t])
);