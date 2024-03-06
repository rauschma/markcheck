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

* Code blocks: delimited by three or more backticks, with or without a language tag such as `js`
* _Directives_, Markdown comments that start with `<!--markcheck`

The following Markdown contains both constructs:

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

The syntax within a directive is inspired by HTML and Python:

* `<!--markcheck` is followed by zero or more _attributes_. Those look similar to HTML.
* If the directive is more than one line long, the first line ends with a _body label_: a name followed by a colon. That is inspired by Python.
  * In the previous example, `before:` and `body:` are body labels.
* A single-line directive ends with `-->`.

### Kinds of directives

* Body directive: body label `body:`
* Config directive: body label `config:`
* LineMod directive:
  * No body label or one of the body labels `before:`, `after:`, `around:`, `insert:`
  * Body label `around:`:
    * A combination of `before:` and `after:`.
    * Two groups of lines are separated by the line `•••`.
  * Body label `insert:`: requires attribute `at`
    * One or more groups of lines. Same separator as for `around:`
    * Required attribute: `at`
  * Attributes: `ignoreLines`, `searchAndReplace`

There are several kinds of LineMods:

* Language LineMod: `each="some-lang"`
  * Its modifications are applied to all code blocks with the specified language.
  * It cannot use `insert:`
* Appliable LineMod: `lineModId="lm-id"`
  * Can be applied to snippets via `wrapOuter="lm-id"` or `applyInner="lm-id"`
* Local LineMod: neither `each` nor `lineModId`
  * The LineMod attributes define a _local LineMod_
  * The remaining attributes apply to the following code block and produce a snippet that has the given local LineMod.

## Entities

After directories were paired with code blocks, we get the following entities:

* Snippets:
  * Created by code block directive + code block or by a code block on its own.
  * Can be written to disk and/or executed.
* Config mods:
  * Created by config directives.
  * Change the configuration data (which commands to run for a given language, etc.).
* LineMods:
  * Created by line mod directives that are not also code block directives.
  * Kinds of LineMods:
    * Language LineMod (attribute `each`): Can be activated globally.
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
  * Override via `alwaysRun` or `only`
* `writeInner`, `writeOuter` always prevent running. Alternatives:
  * `internal="file-name"` changes the filename that is used when running a snippet
  * `onlyLocalLines` excludes global lines when writing to disk.

### How lines are assembled

For assembling lines, two dimensions are important:

* Inner vs. outer:
  * Inner are the lines of each snippet. Multiple snippets can exist per file that is written to disk (via sequences and includes).
  * Outer are lines that exist once per file.
* Local vs. global:
  * Local are the lines that are controlled by the snippet itself.
  * Global are the lines that are contributed from elsewhere:
    * By the config file: the “before” lines for a language.
    * Via a language LineMod – e.g.: `<!--markcheck each="js" before:`

All global lines are outer lines. But snippets can also contribute local outer lines. This is an exhaustive list:

* Inner lines from SingleSnippet
  * Body
  * Body LineMod
  * Applied LineMod: `applyToBody`
  * Includes
* Inner lines from SequenceSnippet:
  * Lines of sequence elements, concatenated
* Outer lines from Snippet (either a SequenceSnippet or a SingleSnippet)
  * Applied LineMod: `applyToOuter` (e.g. a function around a multi-part snippet)
* Global lines (always outer):
  * Language LineMod
  * Config lines

❌ TODO: translator (not translated: before, after, around), outer LineMods only wrap, only one of them is used: Body LineMod, applyToBody LineMod












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
  * `onlyLocalLines`: when a snippet is self-contained and does not need config lines and language LineMod lines.
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

### Body LineMods and applyToBody LineMods

* Required for body label `insert:`: `at="before:1, after:-1, before:'console.log'"`
  * `-1` is the last line (etc.)
* `ignoreLines="1, 3..-2, 'xyz', 'a'..'b'"`: omits lines.
  * A range includes start and end – i.e.: `1..3` is equivalent to `1,2,3`.
* `searchAndReplace="/[a-z]/-/i"`

### Language LineMods

* Required: `each="lang-name"`

### Appliable LineMods

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
  "searchAndReplace": [
    { search: "[⎡⎤]", replace: "" },
  ],
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