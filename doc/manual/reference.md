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

What kinds of directives are there?

* A directive without a body label is a _code block directive_ and must be followed by a code block.
* Body label `body:`: _body directive_. Such a directive is self-contained.
* Body label `config:`: _config directive_. Such a directive is self-contained.
* Body label `before:`, `after:`, `around:`: A _line mod_ directive. Such a directive is used in three ways:
  * Attribute `each="some-lang"`: The modifications are applied to all code blocks with the specified language.
  * Attribute `id="some-id"`: A code block directive can apply the line mod to its code via `apply="some-id"`.
  * Various attributes other that `each` and `id`: The directive is a code block directive, the changes are applied to its code.

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
  * Can be activated globally (attribute `each`) or applied by snippets (attribute `id`).

## Snippet modes: What can be done with snippets?

* Visitation:
  * The following key-only attributes control whether a snippet is considered or ignored: `skip`, `neverSkip`, `only`. The visitation mode `normal` is active if none of the previous attributes are present.
  * Snippets with the attribute `skip` are never considered.
  * Snippets with the attribute `neverSkip` are always considered.
  * If one snippet in a file has the attribute `only`, only snippets with the attributes `only` and `neverSkip` are considered. Other files are not affected.
* The phases of visitation are:
  * Assembling lines (considering sequences, includes, line mods, etc.)
  * Writing to disk (current snippet and external snippets it references)
  * Running shell commands
* Effects of other attributes:
  * Attribute `id` skips by default. Such snippets are virtually always included by other snippets and do not have to be considered themselves. The default can be overridden via `neverSkip` or `only`.
  * Attribute `lang` overrides the language specified by the code block. It can be set to `"[neverRun]"` – which prevents running.
  * Attribute `write` sets `lang` to `"[neverRun]"`.
    * Override by setting `lang` to something else.
    * Or use attribute `writeAndRun`.

## Attributes






















## Configuration

```md
<!--marktest config:
{
  "lang": {
    "ts": {
      "defaultFileName": "main.ts",
      "commands": [
        ["npx", "ts-expect-error", "--report-errors", "$ALL_FILE_NAMES"],
        ["npx", "tsx", "$FILE_NAME"],
      ],
    },
  },
}
-->
```

## Search and replace

## Translators

* Only the core code is translated.
  * Rationale for Node.js REPL: Let users write wrapping code as plain JavaScript.