# Todo

* Remove ⎡half-brackets⎤
  * Per language? Globally?
  * Override or extend?
* Languages – built-in support for:
  * Node.js REPL

* CLI option for log level (to show shell commands)
  * Make sure that logging doesn’t interfere with status emoji (which are appended to an unterminated line).
* At most one LineMod per language
* Set up `PATH` to include various `node_modules/.bin/` directories?
  * Or simply use `npx` which can also install on demand?
* Catch and report UserErrors?
* `marktest/marktest_config.jsonc`
  * Overrides defaults.
* Check that the text of a snippet appears in another file (ensures that excerpts of file don’t diverge).

## UI output

* Print separator with shorter file path.
* Summarize results at the end? Useful if there are multiple files!
  * Statistics: Successes, failures, unknown languages, skipped
* Warnings (don’t change exit code):
  * Warn about `only` mode
  * Unused IDs
  * Unknown attributes ✅

## Wrappers

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

## Including after the current snippet

```md
<!--marktest include="one_snippet, $SELF, another_snippet"-->
```

## Tests

* Sequence:
  * Assemble
  * Report errors
* Assemble lines with a global LineMod
* Assemble multiple includes (out of sequence)
* Test attribute `write` with multiple IDs
* Directive parsing, especially key-only attributes
* Test that directive `lang` overrides code block language

## Potential features

* Use JSON schema to validate JSON files
  * https://github.com/ajv-validator/ajv?tab=readme-ov-file
* Show invisible characters?
  * Show: https://en.wikipedia.org/wiki/C0_and_C1_control_codes#C0_controls
  * As: https://en.wikipedia.org/wiki/Unicode_control_characters#Control_pictures
* TAP as output format?
