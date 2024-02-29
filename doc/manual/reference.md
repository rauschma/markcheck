# Marktest reference

## Command line options

```
marktest «file1.md» «file2.md» ...

Options:
--help -h: get help
--version -v: print version
--print-config: print built-in configuration
--verbose -v: show more information (e.g. which shell commands are run)
```

## File structure

* `marktest-data/`: must exist, can be empty
  * `tmp/`: created on demand, cleared before a file is run.
  * `marktest-config.jsonc`: overrides the built-in defaults.
    * Show built-in defaults via: `marktest --print-config`

## Syntax

Only two Markdown constructs are considered by Marktest:

* _Directives_, Markdown comments that start with `<!--marktest`
* Code blocks (delimited by three or more backticks)

A _directive_ is a Markdown comment that starts with `<!--marktest` – e.g.:

``````md
<!--marktest sequence="1/3" stdout="sequence-output"-->
```js
```

<!--marktest before:
function functionThatShouldThrow() {
  throw new Error();
}
-->
```js
```

<!--marktest write="some-file.txt" body:
Content of some-file.txt
-->
``````

After `marktest` there are zero or more attributes. The first line ends either with `-->` or with a _body label_ – a name followed by a colon. In the previous example, `before:` and `body:` are body labels.

### Kinds of directives

* A directive without a body label is a _code block directive_ and must be followed by a code block.
* Body label `body:`: _body directive_. Such a directive is self-contained.
* Body label `config:`: _config directive_. Such a directive is self-contained.
* Body label `before:`, `after:`, `around:`: A _line mod_ directive. Such a directive is used in three ways:
  * Attribute `each="some-lang"`: The modifications are applied to all code blocks with the specified language.
  * Attribute `id="some-id"`: A code block directive can apply the line mod to its code via `applyInner="some-id"` and  `applyOuter="some-id"`.
  * Neither `each` nor `id`: The directive defines two entities:
    * A local line mod
    * A code block directive that uses the line mod locally.
* Body label `insert:`: Only supported for local line mods.

## Entities

After directories were paired with code blocks, we get the following entities:

* Snippets:
  * Created by code block directive + code block or by a code block on its own.
  * Can be executed and/or written to disk.
* Config mods:
  * Created by config directives.
  * Change the configuration data (which commands to run for a given language, etc.).
* Line mods:
  * Created by line mod directives that are not also code block directives.
  * Kinds of line mods:
    * Global line mod (attribute `each`): Can be activated globally.
    * Applicable line mod (attribute `id`): Can be applied by snippets via the attributes `applyInner` and `applyOuter`.

## Snippet modes: What can be done with snippets?

Visitation:

* The following key-only attributes control whether a snippet is considered or ignored: `skip`, `neverSkip`, `only`. The visitation mode `normal` is active if none of the previous attributes are present.
* Snippets with the attribute `skip` are never considered.
* Snippets with the attribute `neverSkip` are always considered.
* If one snippet in a file has the attribute `only`, only snippets with the attributes `only` and `neverSkip` are considered. Other files are not affected.

The phases of visitation are:

* Assembling lines (considering sequences, includes, line mods, etc.)
* Writing to disk (current snippet and external snippets it references)
* Running shell commands

These attributes also affect visitation:

* `id` skips by default. Such snippets are virtually always included by other snippets and do not have to be considered themselves. The default can be overridden via `neverSkip` or `only`.
* `lang` overrides the language specified by the code block. It can be set to `"[neverRun]"` – which prevents running.
* `write` sets `lang` to `"[neverRun]"`.
  * Override by setting `lang` to something else.
  * Or use attribute `writeAndRun`.

### How lines are assembled

* Once per file (“before” in this order, “after” in reverse):
  * Configuration `before` lines
  * Global line mod
  * Outer applicable line mod
* Once per snippet (in sequences and includes):
  * ❌ FIXME: describe status quo (see especially `.#pushThis()`)

## Attributes

### Code snippets

* Visitation and running mode:
  * `only`
  * `skip`
  * `neverSkip`
  * `neverRun`: same as `lang="[neverRun]"`
* Language: `lang`
  * For body directives
  * To override defaults from code blocks and `write`
  * Values other than names of actual languages (`"js" etc.`) – see section “Configuration”:
    * `"[neverRun]"`
    * `"[skip]"`
    * `"[errorIfRun]"`
    * `"[errorIfVisited]"`
* Assembling lines:
  * `id="my-id"`
  * `noOuterLineMods`
  * `sequence="1/3"`
  * `include="id1, $THIS, id2"`:
    * `$THIS` refers to the current snippet. If you omit it, it is included at the end.
  * `applyInner="id"`: applies an applicable line mod to the core snippet (vs. included snippets or other sequence members)
  * `applyOuter="id"`: applies an applicable line mod once per file. Only the value of the “root” snippet (where line assembly started) is used.
  * `ignoreLines="1, 3-5, 7"`: omits lines. A range includes start and end – i.e.: `1-3` is equivalent to `1,2,3`.
  * `searchAndReplace="/[a-z]/-/i"`
* Additional checks:
  * `containedInFile="filePath"`:
    * `filePath` is either absolute or relative to the Markdown file.
    * The outer LineMods are not applied.
* Writing and referring to files:
  * `write`
  * `writeAndRun`
  * `external="id1>lib1.js, lib2.js"`
* Checking output:
  * `stdout="id"`
  * `stderr="id"`

### Local line mods

* `beforeLine`
* `afterLine`

### Global line mods

* `each="lang-name"`

### Applicable line mods

* `id="my-id"`

















## Configuration

See all defaults: `marktest --print-config`

```md
<!--marktest config:
{
  "lang": {
    "": "[neverRun]",
    "js": {
      "before": [
        "import assert from 'node:assert/strict';"
      ],
      "defaultFileName": "main.mjs",
      "commands": [
        [ "node", "$FILE_NAME" ]
      ]
    },
  },
}
-->
```

Variables for `commands`:

* `$FILE_NAME`
* `$ALL_FILE_NAMES`

Property `"lang"`:

* Empty key `""`: for “bare” code blocks without languages
* Value `"[neverRun]"`: Don’t run the snippets. The contents can still be written somewhere. That’s why this value is used for bare code blocks: They are often used for language-specific configuration files (e.g. as needed for Babel).
* Value `"[skip]"`: Never visit the snippets.
* Value `"[errorIfRun]"`: Snippets must not be run – which can, e.g., be avoided via attribute `write`.
* Value `"[errorIfVisited]"`: Snippets must be skipped – e.g. via attribute `id` or attribute `skip`.

## Search and replace

```json
{
  "searchAndReplace": {
    "[⎡⎤]": ""
  },
}
```

## Translators

```json
{
  "lang": {
    "node-repl": {
      "extends": "js",
      "translator": "node-repl-to-js"
    },
  }
}
```

* Only the core code is translated.
  * Rationale for Node.js REPL: Let users write wrapping code as plain JavaScript.