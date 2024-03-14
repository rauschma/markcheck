# FAQ

## How do I configure the location of the `markcheck-data/` directory?

* Normally, `markcheck-data/` is searched for relatively to the location of a Markdown file.
* But its location can also be specified in the first `config:` directive in a Markdown file (which doesn’t have to be the first directive overall).

```md
<!--markcheck config:
{
  "markcheckDirectory": "/tmp/markcheck/",
}
-->
```

## Markcheck complains about an “unknown language”: How do I set up a new language?

There are two ways in which you can do so:

* Put JSON5 data inside the file `markcheck-data/markcheck-config.json5`
* Put JSON5 data inside a `config:` directive.

Next, we’ll explore what the JSON5 data looks like, then what a `config:` directive looks like.

Note that you can also simply skip code blocks with unknown languages – by putting a directive before the block:

```md
<!--markcheck skip-->
```

### JSON5 data format

You can see examples of JSON language definitions via:

```
markcheck --print-config
```

Examples:

```json5
{
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
  },
}
```

### Configuring languages inside Markdown files

Example: [`demo-bash.md`](https://github.com/rauschma/markcheck/blob/main/demo/demo-bash.md)

```md
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
```

## One among many code blocks fails. What do I do?

Use `<!--markcheck only-->`:

* Then only one specific code block runs.
* That allows you to inspect the files in `markcheck-data/tmp/`: The files produced by that code block are still there (because it ran last).

## What files are written? What commands are run?

Find out via option `--verbose`

## How do I get CLI help?

Via option `--help`

## What is the format of config files?

[The reference](./reference.md#configuration) has all the relevant information.
