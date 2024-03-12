# Markcheck

Markcheck runs the code inside Markdown code blocks – to help ensure that they don’t contain errors.

## Why Markcheck?

* It uses normal Markdown syntax – not a custom version of it: Everything custom happens in comments.
* No external files: The Markdown file contains all the information that is needed to run it (except for imported packages).
* Works for any programming language.
* You use fenced code blocks (tagged with languages) to specify code and languages.
* Various features (all used from within Markdown files):
  * Check stderr and/or stdout.
  * Concatenate blocks in any order.
  * Use code hidden from readers.
  * Write arbitrary files to disk.
  * Etc.

## Documentation

* What does the Markcheck syntax look like?
  * See [`demo/demo-javascript.md`](demo/demo-javascript.md?plain=1)
  * [More demo files](demo/)
* [Quick start](doc/manual/quick-start.md)
* [Manual](doc/manual/)

## Caveats

* ⚠️ There is currently no sandboxing of any kind: Only use Markcheck with files you trust.
* Checking TypeScript code:
  * Downside: slow
  * Upside: You can write very expressive code that works well for explaining language mechanisms. See [`demo/demo-typescript.md`](demo/demo-typescript.md?plain=1) for more information.
