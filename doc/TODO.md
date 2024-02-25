# Todo

* Attribute `ignoreLine="1,2"`?
* At most one LineMod per language
* Set up `PATH` to include various `node_modules/.bin/` directories?
  * Or simply use `npx` which can also install on demand?
* Catch and report UserErrors per file? They have information such as the line number!
* Check that the text of a snippet appears in another file (ensures that excerpts of file don’t diverge).
* CLI option: stop after first error (so that files can be examined).
* Optional: expected stdout/stderr must only be included in actual stdout/stderr.

## UI output

* Summarize results at the end? Useful if there are multiple files!
  * Statistics: Successes, failures, unknown languages, skipped
  * List files that had issues
* Warnings (don’t change exit code):
  * `only` mode (per file)
  * Unused IDs (per file)
  * Unknown attributes (immediately)

## Wrappers

``````md
<!--marktest apply="main"-->
```rust
println!("Hello");
```

<!--marktest id="main" around:
fn main() {
•••
}
-->
``````

## Tests

* Test all .md files in the repo
  * Where to put a common `marktest` directory for all .md files? Move demo/ files to doc/?
  * Rename the directory so that it can’t be confused with the repo directory?
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
