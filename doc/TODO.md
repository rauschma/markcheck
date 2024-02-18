# Todo

* At most one LineMod per language
  * Clear via – e.g.:
    ```
    <!--each="js"-->
    <!--each="js" clear-->
    ```
* Attributes: `stdout="id"`, `stderr="id"`
  * Consequence of latter: existence of stderr content does not lead to failure
* Built-in support for:
  * Babel: support redefining `js`
  * JSON
* Verbose mode:
  * Log commands
  * Log files that are written?


```rust
[
  (
    "rust".to_string(),
    LangDef {
      filename: "main.rs".to_string(),
      command: string_vec(["cargo-play", "--quiet", "*.rs"]),
    }
  ),
  (
    "js".to_string(),
    LangDef {
      filename: "main.mjs".to_string(),
      command: string_vec(["node", "main.mjs"]),
    }
  ),
  (
    "ts".to_string(),
    LangDef {
      filename: "main.ts".to_string(),
      // - It’s important that the code is type-checked
      //   before running it. ts-node-esm (installed via
      //   package `ts-node`) does a good job here.
      // - `npx` enables local installation.
      command: string_vec(["npx", "ts-node-esm", "main.ts"]),
    }
  ),
]
```

## Tests

* Assemble lines with a global LineMod
* Assemble a sequence
* Assemble multiple includes (out of sequence)
* Test attribute `write` with multiple IDs
* Directive parsing, especially key-only attributes
