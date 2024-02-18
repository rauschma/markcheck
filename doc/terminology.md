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
