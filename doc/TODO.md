# Todo

* Attribute `applyLocal`
  * Switches off local LineMod: Error if it is non-empty?
* Attribute: expect exit code.
  * Use case: There were errors, but we don’t want to check stderr, only stdout.
* Config..searchAndReplace: use same format as attributes?
  * Downside: strings are not raw!
  * Alternatives: pairs, `{search,replace}`
  * Update `reference.md` as needed.


* Go from `LineModKind` to subclasses?
* Diagnostics:
  * Pluralize: “All succeeded: 1 file”
  * `only` mode (per file)
  * Skipped snippets
  * Per file (and/or in summary?): How many snippets were run?
    * “Test failures: 1 of 3”
* Colorless for non-interactive terminals?
* Exceptions:
  * Catch `ZodError`
  * Is `ConfigurationError` needed?
    * Check all references to this class!
    * Some `MarkdownSyntaxError` are already causes by config file data.
* Improve: `Could not parse attributes: Stopped parsing before`
* Built-in check for JSON
* Reset in-memory file system after a unit test.
  * Must work afterwards: `test/parse-demo-javascript_test.ts`
* Test: inserting JS into REPL code
* At most one LineMod per language
* Set up `PATH` to include various `node_modules/.bin/` directories?
  * Or simply use `npx` which can also install on demand?
* JSON schema for config files
* Make _line group separators_ (`around:`, `insert:`) configurable?
* Transforming stdout/stderr (before comparing it with a snippet):
  * Operation: Ignore lines
  * Operation: searchAndReplace
  * Define the transformations in the output snippet?
* Let users predefine LineMods such as those below?

<!--marktest id="asyncTest" around:
function test(_name, callback) {
  return callback();
}
•••
await test();
-->

<!--marktest id="callbackTest" around:
function test(_name, callback) {
  return callback((err) => {
    if (err) {
      throw err;
    }
    process.exit();
  });
}
•••
test();
-->

## Tests

* Run all .md files in the repo?
* Sequence: report errors 
* Test attribute `external` with multiple IDs
* Directive parsing, especially key-only attributes
* Test that directive `lang` overrides code block language

## Potential features

* Use JSON schema to validate JSON files
  * https://github.com/ajv-validator/ajv?tab=readme-ov-file
* Show invisible characters?
  * Show: https://en.wikipedia.org/wiki/C0_and_C1_control_codes#C0_controls
  * As: https://en.wikipedia.org/wiki/Unicode_control_characters#Control_pictures
* TAP as output format?
