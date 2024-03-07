# FAQ

## How to configure location of `markcheck-data/` directory?

* Normally, `markcheck-data/` is searched for relative to the location of a Markdown file.
* But its location can also be specified in the first `config:` directive in a Markdown file.

```md
<!--markcheck config:
{
  "markcheckDirectory": "/tmp/markcheck/",
}
-->
```

## How to set up a custom language?

### JSON format

You can see examples of JSON language definitions via:

```
markcheck --print-config
```

Examples:

```json
{
  "lang": {
    "js": {
      "before": [
        "import assert from 'node:assert/strict';"
      ],
      "runFileName": "main.mjs",
      "commands": [
        ["node", "$FILE_NAME"]
      ]
    },
    "node-repl": {
      "extends": "js",
      "translator": "node-repl-to-js"
    },
  }
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

### Configuring languages via config files

You can also store language definitions in `markcheck-data/markcheck-config.jsonc`
