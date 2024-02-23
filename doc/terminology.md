# Marktest terminology

* Syntax:
  * Directive: a comment that starts with `marktest`
    * Solo directive (self-contained)
      * Config directive: body label `config:`
      * Body directive: body label `body:`
    * Code block directive: must be followed by a code block
  * Code block
* Marktest entities (result of parsing):
  * Line mods: local line mods, global line mods
  * Config mods
  * Snippets: SingleSnippet, SequenceSnippet

## Scenarios

```md
Override default fileName
<!--marktest writeAndRun="main.js"-->

External file (written, not run, override via `lang` or use `writeAndRun`)
<!--marktest write="lib.js"-->

Config file
<!--marktest write="config.json" neverSkip-->

Write external files
<!--marktest external="id1>lib1.js, id2>lib2.js, id3>lib3.js"-->

List external files (needed for some tools)
<!--marktest external="lib1.ts, lib2.ts, lib3.ts"-->
```

## Marktest modes

* Visitation vs. running
* Visitation: `skip`, `neverSkip`, `only`, `normal`
  * If there is an `id`, the default is to `skip`. That default can be overridden.
* Special `lang` values (language definition and `lang` attribute)
  * `[neverRun]`: preventing running
    * Attribute `write` prevents running by default. That default can be overridden.
