# Markcheck reference

## Command line options

```
markcheck «file1.md» «file2.md» ...

Options:
--help -h          get help
--version          print version
--print-config -c  print configuration defaults
--print-schema -s  print JSON schema for config data (in config: directives
                   and markcheck-data/markcheck-config.json5)
--verbose -v       show more information (e.g. which shell commands are run)
```

## File structure

* `markcheck-data/`: must exist, can be empty
  * `tmp/`: created on demand, cleared before a file is run.
  * `markcheck-config.json5`: overrides the built-in defaults.
    * Print built-in defaults via: `markcheck --print-config`

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

The result of parsing is _entities_ – which are interpreted by Markcheck. The most common entity is the _snippet_ – a block of text, which can be defined in three ways:

* Via a code block on its own (without a directive). Its language tag tells Markcheck how to run the snippet.
* Via a directive on its own, with the body label `body:`. Such a snippet is invisible to readers of the published Markdown content.
  * We can specify a language via the attribute `lang`.
* Via a directive followed by a code block. The attributes, body label and body of the directive enable us to configure how Markcheck runs the snippet.

### Attribute values

In JSON, we have to use two backslashes to produce a single backslash in the actual string:

```json
"/\\([A-Z]\\)//"
```

In contrast, Markcheck attribute values are “raw” and we don’t have to escape backslashes:

```md
<!--markcheck searchAndReplace="/\([A-Z]\)//"-->
<!--markcheck at="before:'With \'single\' quotes'" insert:
```

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
    * Internal LineMod (neither attribute `each` nor attribute `lineModId`): Defined by the directive before a code block and applied to the content of the code block. In other words: The directive plays double duty and defines both a LineMod and attributes for the snippet.

### Example: internal LineMod

The following example shows how `around:` works.

``````md
<!--markcheck id="rgb" around:
console.log('red');
•••
console.log('blue');
-->
```js
console.log('green');
```
``````

* The directive in the first line defines a LineMod (body label `around:`). That LineMod is an internal LineMod and applied to the snippet.
* The directive also specifies an ID for the snippet.

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
  * Running mode `normal` (not an attribute): active if none of the previous attributes are present.
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
  * Internal LineMod
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

* `ignoreLines`, `searchAndReplace`, `insert:` are only supported for internal LineMods and `applyToBody`.
  * We cannot use both a internal LineMod and `applyToBody`. If the latter is there, the former cannot be present.
  * In other words: outer LineMods only wrap lines around content via `before:`, `after:`, `around:`.
* The lines added via `before:`, `after:`, `around:` are not translated.
  * Rationale: You can add plain JavaScript to `node-repl` snippets and don’t have to use the limiting `node-repl` syntax.

## Attributes

### Snippets

Running mode:

* `only`
* `skip`
* `alwaysRun`

Miscellaneous attributes:

* `lang` has two use cases:
  * Specifying a language for `body:` directives
  * Overriding the language defined by a code block

Assembling lines:

* `id="my-id"`
  * Referenced by attributes: `external`, `externalLocalLines`, `sameAsId`, `include`, `stdout`, `stderr`
* `sequence="1/3"`
* `include="id1, $THIS, id2"`:
  * `$THIS` refers to the current snippet. If the keyword is omitted, the snippet is included at the end.
* `applyToBody="line-mod-id"`: applies an appliable line mod to the core snippet (vs. included snippets or other sequence members)
* `applyToOuter="line-mod-id"`: applies an appliable line mod once per file.
  * This attribute is only considered if a “root” snippet (where line assembly started) has it and ignored elsewhere.
* `runLocalLines`: Used when a snippet is self-contained and does not need or want config lines and language LineMod lines.

Performing checks:

* `sameAsId="id"`: Compares the content of the current snippet with the content of another snippet.
* `containedInFile="filePath"`:
  * `filePath` is either relative to the Markdown file or absolute.
  * Only local lines are considered.
  
Writing and referring to files:

* `write="filePath"`: Write a complete snippet to disk. Don’t run it.
* `writeLocalLines="filePath"`: Write the local lines of a snippet to disk. Don’t run it.
* `runFileName="filePath"`: When writing a snippet to disk to run it, use the file name `filePath` (and not the default file name that is configured per language).
* `external="id1>lib1.js, lib2.js"`: Which external files are needed by the current snippet?
  * An element with `>` writes a file to disk.
  * An element without `>` only tells Markcheck that the file exists. That is useful for some language – e.g., TypeScript where the shell command `ts-expect-error` must know all files that make up a program.
* `externalLocalLines="id1>lib1.js, lib2.js"`: Same as `external` but only local lines are written to disk.

Checking output:

* Only local lines are considered.
* `stdout="snippet-id"`: Standard output must be the same as the snippet with the ID `snippet-id`.
* `stderr="snippet-id"`
* We have two options for configuring which part of the actual output human readers see. Consider, as an example, `stderr="snippet-id"`:
  * Changing the expected output: We can use LineMod operations such as `before:` to change the snippet with the ID `snippet-id`.
  * Changing the actual output: There is special syntax that lets us apply a LineMod to the actual output before it is compared with the expected output.
    * Example: `stdout="|line-mod-id=snippet-id"`

### Internal LineMods and appliable LineMods used via `applyToBody`

Note that a internal LineMod is defined by a directive immediately before a code block. (This directive can also contain attributes for the code block itself such as `include` or `id`.)

Ways of specifying lines:

* _Line locations_:
  * Line numbers: `1, 5, -1`.  `-1` is the last line (etc.)
  * Text fragments: `'a', 'debug'`. They refer to the lines that contain them (only the first occurrence counts).
* _Line location modifiers_ tell `insert:` whether to insert text before or after a given line: `before:1, after:-1, before:'console.log'`
* _Line ranges_: `3..-2, 'a'..'b'`
  * A range includes start and end – i.e.: `1..3` is equivalent to `1,2,3`.

Attributes:

* `at="before:1, after:-1, before:'console.log'"`
  * This attribute specifies where to insert the line groups defined via body label `insert:`.
* `ignoreLines="1, 3..-2, 'xyz', 'a'..'b'"`: omits lines.
* `searchAndReplace="/[a-z]/-/i"`

Example:

``````md
<!--markcheck at="before:1, after:'first', after:-1" insert:
// START
•••
// MIDDLE
•••
// END
-->
```js
// first
// second
```
``````

### Language LineMods

* Required attribute: `each="lang-name"`

### Appliable LineMods

* Required attribute: `lineModId="some-id"`
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
    "": "[skip]",
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

* JSON schema: `markcheck --print-schema`
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

### Config property `commands`

Two variables are available:

* `$FILE_NAME`
* `$ALL_FILE_NAMES`

### Config property `lang`

* Empty key `""`: for “bare” code blocks without languages
* Value `"[skip]"`: Don’t run the snippets.
  * Use case: content that should not be run. Checks (such as `containedInFile`) and writing to disk (e.g. via `write`) still work.
* Value `"[errorIfRun]"`: Running the snippets is an error.
  * Use case: You want to avoid a certain language and would like Markcheck to warn you if you accidentally use it. You can suppress an error via `id`, `write`, `writeLocalLines`, and `skip`.

### Config property `searchAndReplace`

```json5
{
  searchAndReplace: [
    "/[⎡⎤]//"
  ],
}
```

Use case – hide test code from readers:

``````md
```js
⎡await ⎤Promise.allSettled([
  Promise.resolve('a'),
  Promise.reject('b'),
])
.then(
  (arr) => assert.deepEqual(
    arr,
    [
      { status: 'fulfilled', value:  'a' },
      { status: 'rejected',  reason: 'b' },
    ]
  )
);
```
``````

* Markcheck removes individual half-brackets before writing the code to disk.
* Before you publish the Markdown (e.g. to HTML), you need to remove the half-brackets and what’s inside them – e.g.:
  ```
  cat book.md | sed -e 's/⎡[^⎡⎤]*⎤//g' | pandoc book.html
  ```

### Config property `translator`

Currently only `"node-repl-to-js"` is supported.

```json5
"node-repl": {
  extends: "js",
  translator: "node-repl-to-js",
},
```

### Config property `lineMods`

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
