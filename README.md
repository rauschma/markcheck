# Marktest

## Goals and rationales

* Don’t change Markdown syntax (as Specdown does)
* No external files
* Works for any programming language
* Use fenced code blocks and tags to specify code and language (vs. txm which uses indented code blocks)
* Most work should be done via assertions.
    * That’s why stdout checking is not *that* convenient.
* Various features: sequences of snippets, hidden content, writing files to disk and more

## Related tools

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
* For Rust: https://crates.io/crates/skeptic
    * Simpler alternative: ❌ https://docs.rs/doc-comment/latest/doc_comment/
* Universal: https://github.com/anko/txm
* Universal: https://specdown.io
