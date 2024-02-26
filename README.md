# Marktest

## Why Marktest?

* Doesn’t change Markdown syntax: Everything custom happens in comments.
* No external files: The Markdown file contains all the information that is needed to run it.
* Works for any programming language
* Use fenced code blocks and tags to specify code and language (some tools use indented code blocks).
* Various features: check stderr and/or stdout, concatenate blocks in any order, use code not shown to readers, set up files on disk, etc.

## Related tools

### Universal

* Universal: https://github.com/anko/txm
  * Uses indented code blocks
* Universal: https://specdown.io
  * Changes Markdown syntax

### JavaScript and TypeScript

* https://github.com/eslint/eslint-plugin-markdown
* TypeScript TwoSlash: https://www.npmjs.com/package/@typescript/twoslash
  * Example: https://www.typescriptlang.org/dev/twoslash/
  * Upsides:
    * Powerful
    * Great for web content (tooltips, colors, etc.)
  * Downsides:
    * Less suited for PDFs and print
    * Can’t split up examples into multiple fragments and connect them.
    * Doesn’t tie errors to specific lines in the code
    * Only checks error codes, not error messages.
    * Can’t check inferred types.

### Python

* Pytest plugin: https://github.com/modal-labs/pytest-markdown-docs
* Pytest plugin: https://github.com/nschloe/pytest-codeblocks

### Rust

* https://crates.io/crates/skeptic
* https://docs.rs/doc-comment/latest/doc_comment/
