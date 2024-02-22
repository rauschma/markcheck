# Marktest terminology

* Syntax:
  * Directive: a comment that starts with `marktest`
    * Solo directive
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

External file (written, not run)
<!--marktest write="lib.js"-->

Config file
<!--marktest write="config.json" neverSkip-->

Write external files
<!--marktest external="id1>file1.js, id2>file2.js, id3>file3.js"-->

List external files (needed for some tools)
<!--marktest external="file1.ts, file2.ts, file3.ts"-->
```

## Marktest modes

* Visitation: skip, neverSkip, only, normal
    * id => don’t visit
* Running
    * write => don’t run
