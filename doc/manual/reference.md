# Markcheck reference

## Command line options

```
markcheck «file1.md» «file2.md» ...

Options:
--help -h          get help
--version          print version
--print-config -p  print configuration defaults
--verbose -v       show more information (e.g. which shell commands are run)
```

## File structure

* `markcheck-data/`: must exist, can be empty
  * `tmp/`: created on demand, cleared before a file is run.
  * `markcheck-config.json5`: overrides the built-in defaults.
    * Print built-in defaults via: `markcheck -p`

## How Markcheck works

Quick overview:

* A Markdown file is parsed.
* One by one, code blocks are written to `markcheck-data/tmp/` and run via shell commands such as `node` (for JavaScript).

## Syntax

Only two Markdown constructs are considered by Markcheck:

* Code blocks: delimited by three or more backticks, with or without a language tag such as `js`
* _Directives_, Markdown comments that start with `<!--markcheck`

The following Markdown contains both constructs:

``````md
<!--markcheck only stdout="stdout-hello"-->
```js
console.log('Hello!');
```

<!--markcheck id="stdout-hello" body:
Hello!
-->

<!--markcheck before:
function functionThatShouldThrow() {
  throw new Error();
}
-->
```js
try {
  functionThatShouldThrow();
  assert.fail();
} catch (_) {
  // Success
}
```
``````

The syntax within a directive is inspired by HTML and Python:

* `<!--markcheck` is followed by zero or more _attributes_. Those look similar to HTML.
* If the directive is more than one line long, the first line ends with a _body label_: a name followed by a colon. That is inspired by Python.
  * In the previous example, `before:` and `body:` are body labels.

The result of parsing is _entities_ – which are interpreted by Markcheck. The most common entity is the _snippet_ – a block of text:

* A solo code block (without a directive) defines a snippet. Its language tag tells Markcheck how to run it.
* We can also define a snippet via a directive with the body label `body:`. Such a directive is not followed by a code block. It is invisible to readers of the published Markdown content.
  * We can assign a language to a `body:` directive via the attribute `lang`.
* All other directives define attributes for code blocks.
  * For example: If one snippet defines an id via `id="my-id"` then another snippet can “import” its text via `include="my-id"`. IDs are inspired by HTML.

### Attribute values

Attribute values are passed on raw. Therefore, there is no first pass where we have to write two backslashes so that an attribute receives a single backslash (which is required in JSON):

* Example: `<!--markcheck searchAndReplace="/\([A-Z]\)//"-->`
  * JSON: `"/\\([A-Z]\\)//"`
* Example: `<!--markcheck at="before:'With \'single\' quotes'" insert:`

## Entities

After directives were paired with code blocks, we get the following entities:

* Snippets:
  * Created by:
    * Solo code block (without directive)
    * `body:` directive (without code block)
    * Directive + code block
  * Can be run, imported by other snippets, written to disk without running (which is useful for configuration files), etc.
* ConfigMods:
  * Created by `config:` directives.
  * Change the configuration data (which commands to run for a given language, etc.).
  * The configuration syntax is explained in [section “Configuration”](#configuration).
* LineMods contain instructions for changing snippets.
  * A LineMod has:
    * At most one of these body labels that add text to snippets: `before:`, `after:`, `around:`, `insert:`
    * Zero or more of these attributes: `ignoreLines`, `searchAndReplace`
  * Kinds of LineMods:
    * Language LineMod (attribute `each`): Applied to all snippets with the specified language.
    * Appliable LineMod (attribute `lineModId`): Can be applied by snippets to themselves via the attributes `applyToBody` and `applyToOuter`.
    * Body LineMod (neither attribute `each` nor attribute `lineModId`): Defined by the directive before a code block and applied to the content of the code block.

### Example: body LineMod

The following example shows how `around:` works.

``````md
<!--markcheck stdout="stdout-rgb" around:
console.log('red');
•••
console.log('blue');
-->
```js
console.log('green');
```

<!--markcheck id="stdout-rgb"-->
```
red
green
blue
```
``````

* The first directive defines a body LineMod.
* The second directive defines attributes for the following code block but not a LineMod.

## How does Markcheck interpret snippets?

Phases of interpreting a snippet:

* Checks: `sameAsId`, `containedInFile`
* Writing to disk via `writeLocalLines`, `write`
  * Skips running. Use `runFileName` to change the snippet’s default filename and run it.
* Running:
  * Translating: Translates the snippet text to a target language.
    * Currently, there is only one translator, `node-repl-to-js`, which translates Node.js REPL interactions to `assert.deepEqual()` statements in plain JavaScript. See `demo-node-repl.md` for an example.
  * Writing to disk:
    * External snippets whose IDs are mentioned by `external`, `externalLocalLines`.
    * Current snippet
      * Override its default filename via `runFileName="file-name"`
  * Executing shell commands

Running: 

* The following key-only attributes control whether a snippet is run:
  * `skip`: Snippet is never run.
  * `alwaysRun`: Snippet is always run.
  * `only`: Affects the whole file. Only snippets with this attribute are run.
  * Visitation mode `normal` (not an attribute): active if none of the previous attributes are present.
* `id` sets running mode to `skip`.
  * Override via `alwaysRun` or `only`
* `write`, `writeLocalLines`always prevent running. Alternatives to using these attributes:
  * `runFileName="file-name"` changes the filename that is used when running a snippet. It overrides the default set by the config.
  * `runLocalLines` excludes global lines when writing a file to disk for running.

### How lines are assembled

For assembling lines, two dimensions are important:

* Local vs. global: Who adds the lines?
  * Local are the lines that are controlled by the snippet itself.
  * Global are the lines that are contributed from elsewhere:
    * By the config file: the “before” lines for a language.
    * Via a language LineMod – e.g.: `<!--markcheck each="js" before:`
* Inner vs. outer: Where are the lines added?
  * Inner are the lines of each snippet. Multiple snippets can exist per file that is written to disk (via sequences and includes).
  * Outer are lines that exist once per file.

All global lines are outer lines. But snippets can also contribute local outer lines. This is an exhaustive list of all sources of lines:

* Inner lines from SingleSnippet
  * Body
  * Body LineMod
  * Applied LineMod: `applyToBody`
    * Example: Wrap a function around a body that includes other functions that it calls.
  * Inner lines of included other snippets
* Inner lines from SequenceSnippet:
  * Inner lines of sequence elements, concatenated
* Outer lines from Snippet (either a SequenceSnippet or a SingleSnippet)
  * Applied LineMod: `applyToOuter`.
    * Example: Wrap a function around a multi-part snippet.
* Global lines (always outer):
  * Language LineMod
  * Config lines

Various other details:

* `ignoreLines`, `searchAndReplace`, `insert:` are only supported for body LineMods and `applyToBody`.
  * We cannot use both a body LineMod and `applyToBody`. If the latter is there, the former cannot be present.
  * In other words: outer LineMods only wrap lines around content via `before:`, `after:`, `around:`.
* The lines added via `before:`, `after:`, `around:` are not translated.
  * Rationale: You can add plain JavaScript to `node-repl` snippets and don’t have to use the limiting `node-repl` syntax.

## Attributes

### Snippets

* Running mode:
  * `only`
  * `skip`
  * `alwaysRun`
* Language: `lang`
  * For body directives
  * To override the language defined by a code block
* Assembling lines:
  * `id="my-id"`
    * Referenced by attributes: `external`, `externalLocalLines`, `sameAsId`, `include`, `stdout`, `stderr`
  * `sequence="1/3"`
  * `include="id1, $THIS, id2"`:
    * `$THIS` refers to the current snippet. If it is omitted, it is included at the end.
  * `applyToBody="line-mod-id"`: applies an appliable line mod to the core snippet (vs. included snippets or other sequence members)
  * `applyToOuter="line-mod-id"`: applies an appliable line mod once per file.
    * This attribute is only considered if a “root” snippet (where line assembly started) has it and ignored elsewhere.
  * `runLocalLines`: Used when a snippet is self-contained and does not need or want config lines and language LineMod lines.
* Additional checks:
  * `sameAsId="id"`: Compares the content of the current snippet with the content of another snippet.
  * `containedInFile="filePath"`:
    * `filePath` is either relative to the Markdown file or absolute.
    * Only local lines are considered.
* Writing and referring to files:
  * `write="filePath"`: Write a complete snippet to disk. Don’t run it.
  * `writeLocalLines="filePath"`: Write the local lines of a snippet to disk. Don’t run it.
  * `runFileName="filePath"`: When writing a snippet to disk to run it, use the file name `filePath` (and not the default file name that is configured per language).
  * `external="id1>lib1.js, lib2.js"`: Which external files are needed by the current snippet?
    * An element with `>` writes a file to disk.
    * An element without `>` only tells Markcheck that the file exists. That is useful for some language – e.g., TypeScript where the shell command `ts-expect-error` must know all files that make up a program.
  * `externalLocalLines="id1>lib1.js, lib2.js"`: Same as `external` but only local lines are written to disk.
* Checking output:
  * `stdout="|lineModId=stdout-id"`
  * `stderr="stderr-id"`
  * We have two options for configuring which part of the actual output human readers see:
    * We can use LineMod operations to change the expected content of the snippets `stdout-id` and `stderr-id`.
    * We can use the LineMod `lineModId` to change (e.g.) `stdout` before it is compared to the expected content.
  * Only local lines are considered.

### Body LineMods and appliable LineMods used via `applyToBody`

Ways of specifying lines:

* _Line locations_:
  * Line numbers: `1, 5, -1`.  `-1` is the last line (etc.)
  * Text fragments: `'a', 'debug'`. They refer to the lines that contain them (only the first occurrence counts).
* _Line location modifiers_ tell `insert:` whether to insert text before or after a given line: `before:1, after:-1, before:'console.log'`
* _Line ranges_: `3..-2, 'a'..'b'`
  * A range includes start and end – i.e.: `1..3` is equivalent to `1,2,3`.

* Required attribute for body label `insert:`:
  * `at="before:1, after:-1, before:'console.log'"`
* `ignoreLines="1, 3..-2, 'xyz', 'a'..'b'"`: omits lines.
* `searchAndReplace="/[a-z]/-/i"`

### Language LineMods

* Required attribute: `each="lang-name"`

### Appliable LineMods

* Required attribute: `lineModId="my-id"`
  * Referenced by attributes: `applyToBody`, `applyToOuter`

## Configuration

You can check Markcheck’s default configuration via:

```
markcheck --print-config
```

The output looks like this (excerpt):

```json5
{
  searchAndReplace: [
    "/[⎡⎤]//",
  ],
  lang: {
    "": "[errorIfRun]",
    txt: "[skip]",
    js: {
      before: [
        "import assert from 'node:assert/strict';",
      ],
      runFileName: "main.mjs",
      commands: [
        [
          "node",
          "$FILE_NAME",
        ],
      ],
    },
    "node-repl": {
      extends: "js",
      translator: "node-repl-to-js",
    },
    // ···
  },
  // ···
}
```

### Schemas for config data

* TypeScript types: see `ConfigModJson` in [`config.ts`](https://github.com/rauschma/markcheck/blob/main/src/core/config.ts)

### Changing the defaults

How can we change the default config data?

* Via the file `markcheck-data/markcheck-config.json5`
  * This file has the same structure as the output of `--print-config`
* Via ConfigMods inside Markdown. See examples below.

This is the ConfigMod used in `demo-babel.md` (it tells Markcheck that `js` snippets should be run as defined for the “language” `babel`):

``````md
<!--markcheck config:
{
  "lang": {
    "js": {
      "extends": "babel",
    },
  },
}
-->
``````

This is the ConfigMod used in `demo-bash.md` (it defines the new language `bash`):

``````md
<!--markcheck config:
{
  "lang": {
    "bash": {
      "runFileName": "main.sh",
      "commands": [
        ["bash", "$FILE_NAME"]
      ],
    },
  },
}
-->
``````

### Property `commands`

Two variables are available:

* `$FILE_NAME`
* `$ALL_FILE_NAMES`

### Property `lang`

* Empty key `""`: for “bare” code blocks without languages
* Value `"[skip]"`: Don’t run the snippets.
  * Use case: content that should be ignored. (It can still be written to disk though.)
* Value `"[errorIfRun]"`: Running the snippets is an error.
  * Use case: content where Markcheck should warn you if you run it. You can switch of the error by writing the content to disk via `write` and `writeLocalLines` or by using `skip`.

Why were the following choices made for the defaults?

```json5
"": "[errorIfRun]",
txt: "[skip]",
```

These settings nudge users away from bare code blocks: If you want to display plain text to users, use the language `txt` and your code blocks will simply be ignored by Markcheck.

### Property `searchAndReplace`

```json5
{
  searchAndReplace: [
    "/[⎡⎤]//"
  ],
}
```

### Property `translator`

Currently only `"node-repl-to-js"` is supported.

```json5
"node-repl": {
  extends: "js",
  translator: "node-repl-to-js",
},
```

### Property `lineMods`

We can define a LineMod with the id `asyncTest` in two ways.

First, via an in-file LineMod:

``````md
<!--markcheck id="asyncTest" around:
function test(_name, callback) {
  return callback();
}
•••
await test();
-->
``````

Second via a config file:

```json5
// markcheck-data/markcheck-config.json5
{
  lineMods: {
    asyncTest: {
      before: [
        'function test(_name, callback) {',
        '  return callback();',
        '}',
      ],
      after: [
        'await test();',
      ],
    },
  },
}
```

The LineMod is applied the same either way:

``````md
<!--markcheck applyToBody="asyncTest"-->
```js
test('Test with await', async () => {
  const value = await Promise.resolve(123);
  assert.equal(value, 123);
});
```
``````
