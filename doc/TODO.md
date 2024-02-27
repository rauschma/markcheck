# Todo

* At most one LineMod per language
* Set up `PATH` to include various `node_modules/.bin/` directories?
  * Or simply use `npx` which can also install on demand?
* Catch and report UserErrors?
  * There is no need to stop processing at this point!
  * Per file? Per snippet?
  * They have information such as the line number!
* CLI option: stop after first error (so that files can be examined).
* JSON schema for config files

## Attributes

* Attribute: expect exit code
* Attribute `ignoreLine="1,2"`?
* Check that the text of a snippet appears in another file (ensures that excerpts of file don’t diverge).
* How to check only part of stdout/stderr?

## Warnings

Don’t change exit code? Mention in summary?

* `only` mode (per file)
* Skipped snippets
* Unused IDs (per file)
* Unknown attributes (immediately)
* Unknown languages

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
