import { UserError } from '../util/errors.js';
import { APPLICABLE_LINE_MOD_ATTRIBUTES, ATTR_KEY_EACH, ATTR_KEY_ID, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_BODY, BODY_LABEL_CONFIG, BODY_LABEL_INSERT, CONFIG_MOD_ATTRIBUTES, GLOBAL_LINE_MOD_ATTRIBUTES, SNIPPET_ATTRIBUTES, type Directive, ATTR_KEY_LINE_MOD_ID } from './directive.js';
import { LineMod } from './line-mod.js';
import { SingleSnippet } from './snippet.js';
import { ConfigMod } from './config-mod.js';

const { stringify } = JSON;

/**
 * @returns A snippet is open or closed
 */

export function directiveToEntity(directive: Directive): null | ConfigMod | SingleSnippet | LineMod {
  switch (directive.bodyLabel) {
    case BODY_LABEL_CONFIG:
      directive.checkAttributes(CONFIG_MOD_ATTRIBUTES);
      return new ConfigMod(directive);

    case BODY_LABEL_BODY: {
      return SingleSnippet.createClosedFromBodyDirective(directive);
    }

    case BODY_LABEL_BEFORE:
    case BODY_LABEL_AFTER:
    case BODY_LABEL_AROUND:
    case BODY_LABEL_INSERT:
    case null: {
      if (directive.bodyLabel !== null) {
        // Either:
        // - Global LineMod
        // - Applicable LineMod
        // - Open snippet with local LineMod

        const each = directive.getString(ATTR_KEY_EACH);
        if (each !== null) {
          // Global LineMod
          directive.checkAttributes(GLOBAL_LINE_MOD_ATTRIBUTES);
          return LineMod.parse(directive, {
            tag: 'LineModKindGlobal',
            targetLanguage: each,
          });
        }

        const id = directive.getString(ATTR_KEY_LINE_MOD_ID);
        if (id !== null) {
          // Applicable LineMod
          directive.checkAttributes(APPLICABLE_LINE_MOD_ATTRIBUTES);
          return LineMod.parse(directive, {
            tag: 'LineModKindApplicable',
            id,
          });
        }

        // Open snippet with local LineMod
        directive.checkAttributes(SNIPPET_ATTRIBUTES);
        const snippet = SingleSnippet.createOpen(directive);
        snippet.localLineMod = LineMod.parse(directive, {
          tag: 'LineModKindLocal',
        });
        return snippet;
      } else {
        // Open snippet without a local LineMod
        directive.checkAttributes(SNIPPET_ATTRIBUTES);
        return SingleSnippet.createOpen(directive);
      }
    }

    default: {
      throw new UserError(
        `Unsupported body label: ${stringify(directive.bodyLabel)}`,
        { lineNumber: directive.lineNumber }
      );
    }
  }
}
