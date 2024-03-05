# Markcheck reference

## Command line options

```
markcheck «file1.md» «file2.md» ...

Options:
--help -h: get help
--version -v: print version
--print-config: print built-in configuration
--verbose -v: show more information (e.g. which shell commands are run)
```

## File structure

* `markcheck-data/`: must exist, can be empty
  * `tmp/`: created on demand, cleared before a file is run.
  * `markcheck-config.jsonc`: overrides the built-in defaults.
    * Show built-in defaults via: `markcheck --print-config`

## Syntax

Only two Markdown constructs are considered by Markcheck:

* _Directives_, Markdown comments that start with `<!--markcheck`
* Code blocks (delimited by three or more backticks)

A _directive_ is a Markdown comment that starts with `<!--markcheck` – e.g.:

``````md
<!--markcheck sequence="1/3" stdout="sequence-output"-->
```js
```

<!--markcheck before:
function functionThatShouldThrow() {
  throw new Error();
}
-->
```js
```

<!--markcheck writeInner="some-file.txt" body:
Content of some-file.txt
-->
``````

After `markcheck` there are zero or more attributes. The first line ends either with `-->` or with a _body label_ – a name followed by a colon. In the previous example, `before:` and `body:` are body labels.

### Kinds of directives

* A directive without a body label is a _code block directive_ and must be followed by a code block.
* Body label `body:`: _body directive_. Such a directive is self-contained.
* Body label `config:`: _config directive_. Such a directive is self-contained.
* Body label `before:` or `after:`: A _line mod_ directive. Such a directive is used in three ways:
  * Attribute `each="some-lang"` defines a _global line mod_. Its modifications are applied to all code blocks with the specified language.
  * Attribute `lineModId="some-id"` defines an _appliable line mod_: A code block directive can apply it to its code via `applyInner="some-id"` and  `applyOuter="some-id"`.
  * Neither `each` nor `lineModId`: The directive defines two entities:
    * A local line mod
    * A snippet that uses the line mod locally
* Body label `around:` combines `before:` and `after:`. Two groups of lines are separated by the line `•••`.
* Body label `insert:`: Only supported for local line mods.
  * One or more groups of lines. Same separator as for `around:`
  * Required attribute: `at`

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
    * Appliable line mod (attribute `id`): Can be applied by snippets via the attributes `applyInner` and `applyOuter`.

## Snippet modes: What can be done with snippets?

Phases of visitation:

* Checks: `sameAsId`, `containedInFile`
* Writing to disk via `writeInner`, `writeOuter`
  * Skips running. Use `internal` to change the snippet’s default filename and run it.
* Running:
  * Writing to disk (current snippet and external snippets it references)
    * Override main filename via `internal="file-name"`
  * Running shell commands

Running: 

* The following key-only attributes control whether a snippet is run:
  * `skip`: Snippet is never run.
  * `alwaysRun`: Snippet is always run.
  * `only`: Affects the whole file. Only snippets with this attribute are run.
  * Visitation mode `normal` (not an attribute): active if none of the previous attributes are present.
* `id` sets running mode to `skip`.
  * Override via `alwaysRun`
* ❌ `writeInner`, `writeOuter`

### How lines are assembled

* Outer lines – once per file:
  * Configuration `before` lines
  * Global line mod
  * Outer applied line mod
* Inner lines – each snippet (solo, included, part of a sequence, etc.):
  * TODO ❌

## Attributes

### Code snippets

* Running mode:
  * `only`
  * `skip`
  * `alwaysRun`
* Language: `lang`
  * For body directives
  * To override code blocks
* Assembling lines:
  * `id="my-id"`
    * Referenced by attributes: external, sameAsId, include, stdout, stderr
  * `sequence="1/3"`
  * `include="id1, $THIS, id2"`:
    * `$THIS` refers to the current snippet. If you omit it, it is included at the end.
  * `applyInner="id"`: applies an appliable line mod to the core snippet (vs. included snippets or other sequence members)
  * `applyOuter="id"`: applies an appliable line mod once per file. Only the value of the “root” snippet (where line assembly started) is used.
  * `onlyLocalLines`: when a snippet is self-contained and does not need config lines and global LineMod lines.
* Additional checks:
  * `sameAsId="id"`
  * `containedInFile="filePath"`:
    * `filePath` is either relative to the Markdown file or absolute.
    * The outer LineMods are not applied.
* Writing and referring to files:
  * `writeInner="filePath"`
  * `writeOuter="filePath"`
  * `internal="filePath"`
  * `external="id1>lib1.js, lib2.js"`
* Checking output:
  * `stdout="|lineModId=id"`
  * `stderr="id"`

### Local line mods

* Required for body label `insert:`: `at="before:1, after:-1, before:'console.log'"`
  * `-1` is the last line (etc.)
* `ignoreLines="1, 3..-2, 'xyz', 'a'..'b'"`: omits lines.
  * A range includes start and end – i.e.: `1..3` is equivalent to `1,2,3`.
* `searchAndReplace="/[a-z]/-/i"`

### Global line mods

* Required: `each="lang-name"`

### Appliable line mods

* Required: `lineModId="my-id"`
  * Referenced by attributes: applyInner, applyOuter
















## Configuration

Locations:

* Defaults
* The defaults can be changed inside Markdown files and via `markcheck-data/markcheck-config.jsonc`


See all defaults: `markcheck --print-config`

```md
<!--markcheck config:
{
  "lang": {
    "": "[skip]",
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
* Value `"[skip]"`: Don’t run the snippets.
* Value `"[errorIfRun]"`: Snippets must not be run – which can, e.g., be avoided via attribute `skip`.

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