# Todos

* Statistics: Successes, failures, unknown languages, skipped
    * Full progress bar: don’t count skipped snippets and snippets with unknown languages.
    * Don’t `println!()` if a language is unknown.
* Improve tmp directory handling:
    * Specify via CLI option
    * Support local setups
        * A local project with installed crates.
        * Repository-local tooling (e.g. a locally installed Babel)

## Features: next

* Print warning for `only` mode.
* Move CodeSnippet types to `code_snippet.rs`?
* Improve `MarktestOrOtherError`:
    * Group errors by kind of cause (IO, parsing, config, etc.)
* Support ignoring languages via config snippets
* Implement extraction of embedded output
    * See `TODO` in `CodeSnippet::assemble()`
* Prevent `include` cycles.
* Remove trailing empty lines in Markdown comments.
* Turn `NL` in `lib.rs` into a parameter.
* Names to show when running tests: IDs? Separate names via attribute `name`? First line of code block? Line before code block?
* Default settings for: `json`
* Report ignored snippet languages at the end?
    ```
    Ignoring snippet with unknown language "ts" (line 1639)
    ```
* Better error message if a CLI command doesn’t work.

### Warnings

* Unused snippet IDs
* Unknown attribute keys (unless prefixed with an underscore)
    * Varies per snippet type!
        * Example: sequence members shouldn’t have IDs
* Inclusion cycles

### Config snippets

```md
<!--marktest config:
[language.rust]
filename = "main.rs"
command = "cargo-play *.rs"
remove_text = ["⎡", "⎤"]
-->
```

### Template definition snippets

``````md
<!--marktest tmpl="main"-->
```rust
println!("Hello");
```

<!--marktest def_tmpl="main" lang="rust" body:
fn main() {
•••
}
-->
``````

Compare:

```md
<!--marktest write="babel.config.json" body:
{
  "plugins": [
    ["@babel/plugin-proposal-decorators", {"version": "2022-03"}]
  ]
}
-->
```

### Handling stdout and stderr

* stderr content counts as failure and is displayed on screen (esp. debugging info). Unless:
    * Inline `Error(s):`
    * `exitcode="1"`
    * `stderr="[1..-2]example_stderr"`
* stdout can be checked inline or via ID.
* Exit with non-zero code if there are failures

### Including

```md
<!--marktest include="one_snippet, $self, another_snippet"-->
```

## Tests

* Sequences
    * Works?
    * Error if: unfinished, wrong order, etc.
* Includes:
    * Works for several includes?
    * Works combined with before/after/around?
    * Error if: ID is missing
    * Warning if: ID is unused

## Features: later

* Show diffs for stdin/stderr?
* TAP as output format?

### Extracting and transforming

```toml
[language.js]
extract_output = "double_slash_comment"
filename = "main.mjs"
command = "node main.mjs"
remove_text = ["⎡", "⎤"]

[language.repl]
transform = "javascript-repl"
filename = "main.mjs"
command = "node main.mjs"
remove_text = ["⎡", "⎤"]
```

```rust
pub type OutputExtractor = dyn FnMut(&mut dyn CodeSnippet) -> ExtractedOutput;
pub struct ExtractedOutput {
    pub stdout: Option<Vec<Arc<String>>>,
}

pub type CodeSnippetTransformer = dyn FnMut(&mut dyn CodeSnippet) -> TransformedCodeSnippet;
pub struct TransformedCodeSnippet {
    pub lines: Vec<Arc<String>>,
}
```

## Features: maybe

* Check that the text of a snippet appears in another file (ensures that excerpts of file don’t diverge).
* By default, `write` and `id` prevent execution. Let people override. Document.
* Configuring languages via an external file?
* Run commands in parallel?
* Show invisible characters?
    * Show: https://en.wikipedia.org/wiki/C0_and_C1_control_codes#C0_controls
    * As: https://en.wikipedia.org/wiki/Unicode_control_characters#Control_pictures
