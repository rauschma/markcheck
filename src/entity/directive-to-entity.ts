import { MarkcheckSyntaxError } from '../util/errors.js';
import { ConfigMod } from './config-mod.js';
import { ATTRS_APPLIABLE_LINE_MOD, ATTR_KEY_EACH, ATTR_KEY_LINE_MOD_ID, BODY_LABEL_AFTER, BODY_LABEL_AROUND, BODY_LABEL_BEFORE, BODY_LABEL_BODY, BODY_LABEL_CONFIG, BODY_LABEL_INSERT, ATTRS_CONFIG_MOD, ATTRS_GLOBAL_LINE_MOD, ATTRS_SNIPPET, ATTRS_SNIPPET_BODY_LABEL_INSERT, type Directive, ATTRS_APPLIABLE_LINE_MOD_BODY_LABEL_INSERT } from './directive.js';
import { LineMod } from './line-mod.js';
import { SingleSnippet } from './snippet.js';

const { stringify } = JSON;

/**
 * @returns A snippet is open or closed
 */

export function directiveToEntity(directive: Directive): null | ConfigMod | SingleSnippet | LineMod {
  switch (directive.bodyLabel) {
    case BODY_LABEL_CONFIG:
      directive.checkAttributes(ATTRS_CONFIG_MOD);
      return new ConfigMod(directive);

    case BODY_LABEL_BODY: {
      directive.checkAttributes(ATTRS_SNIPPET);
      return SingleSnippet.createClosedFromBodyDirective(directive);
    }

    case BODY_LABEL_BEFORE:
    case BODY_LABEL_AFTER:
    case BODY_LABEL_AROUND:
    case BODY_LABEL_INSERT:
    case null: {
      // Either:
      // - Global LineMod
      // - Appliable LineMod
      // - Open snippet with local LineMod

      const each = directive.getString(ATTR_KEY_EACH);
      if (each !== null) {
        // Global LineMod
        directive.checkAttributes(ATTRS_GLOBAL_LINE_MOD);
        return LineMod.parse(directive, {
          tag: 'LineModKindGlobal',
          targetLanguage: each,
        });
      }

      const lineModId = directive.getString(ATTR_KEY_LINE_MOD_ID);
      if (lineModId !== null) {
        // Appliable LineMod
        if (directive.bodyLabel === BODY_LABEL_INSERT) {
          directive.checkAttributes(ATTRS_APPLIABLE_LINE_MOD_BODY_LABEL_INSERT);
        } else {
          directive.checkAttributes(ATTRS_APPLIABLE_LINE_MOD);
        }
        return LineMod.parse(directive, {
          tag: 'LineModKindAppliable',
          lineModId,
        });
      }

      // Open snippet with local LineMod
      if (directive.bodyLabel === BODY_LABEL_INSERT) {
        directive.checkAttributes(ATTRS_SNIPPET_BODY_LABEL_INSERT);
      } else {
        directive.checkAttributes(ATTRS_SNIPPET);
      }
      const snippet = SingleSnippet.createOpen(directive);
      snippet.localLineMod = LineMod.parse(directive, {
        tag: 'LineModKindLocal',
      });
      return snippet;
    }

    default: {
      throw new MarkcheckSyntaxError(
        `Unsupported body label: ${stringify(directive.bodyLabel)}`,
        { lineNumber: directive.lineNumber }
      );
    }
  }
}
