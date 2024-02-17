# Todo

* Determining the Marktest directory:
  * Search starting in CWD
  * Config setting
* Attributes: only, skip, neverSkip
* Attributes: `stdout="id"`, `stderr="id"`
  * Consequence of latter: existence of stderr content does not lead to failure
* Built-in support for Babel – how?



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

* Assemble lines with multiple global LineMods
  * ❌ Tricky: `after` is applied in reverse order
  * Should the first `around` be applied first? Then its before lines would come last.
