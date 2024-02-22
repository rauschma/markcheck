# Todo

* Languages – built-in support for:
  * Babel
  * TypeScript
  * JSON
  * Node.js REPL
* Config:
  ```json
  "js": "babel",
  ```
* `--print-config`: show defaults
* Equivalent?
  ```md
  <!--marktest write="babel.config.json" lang="[neverRun]" neverSkip body:
  <!--marktest writeConfig="babel.config.json" body:
  ```



* Remove ⎡half-brackets⎤
* At most one LineMod per language
* Print separator with shorter file path.
* Names to show when running tests:
  * IDs? Separate names via attribute `name`?
  * First line of code block? Line before code block?
* Summarize results at the end? Useful if there are multiple files!
  * Statistics: Successes, failures, unknown languages, skipped
  * Print warning for `only` mode?
  * Warnings? Unused IDs? Unknown attributes?
* Set up `PATH` to include various `node_modules/.bin/` directories?
  * Or simply use `npx` which can also install on demand?
* Catch and report UserErrors?

```rust
[
  (
    "rust".to_string(),
    LangDef {
      filename: "main.rs".to_string(),
      command: string_vec(["cargo-play", "--quiet", "*.rs"]),
    }
  ),
]
```

## Potential features

* `marktest/marktest_config.jsonc`
  * Overrides defaults.
* Use JSON schema to validate JSON files
* TAP as output format?
* Check that the text of a snippet appears in another file (ensures that excerpts of file don’t diverge).
* Show invisible characters?
  * Show: https://en.wikipedia.org/wiki/C0_and_C1_control_codes#C0_controls
  * As: https://en.wikipedia.org/wiki/Unicode_control_characters#Control_pictures

### Wrappers

``````md
<!--marktest apply="main"-->
```rust
println!("Hello");
```

<!--marktest id="main" lang="rust" around:
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

### Including

```md
<!--marktest include="one_snippet, $self, another_snippet"-->
```

## Tests

* Sequence:
  * Assemble
  * Report errors
* Test line numbers of parsed entities
* Assemble lines with a global LineMod
* Assemble multiple includes (out of sequence)
* Test attribute `write` with multiple IDs
* Directive parsing, especially key-only attributes
* Test that directive `lang` overrides code block language
