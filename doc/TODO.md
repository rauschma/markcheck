# Todo

* When to skip writing to a file?
* Attributes: `stdout="id"`, `stderr="id"`
  * Consequence of latter: existence of stderr content does not lead to failure
* Built-in support for Babel – how?


```rust
pub const ATTR_KEY_ALWAYS: &str = "always";
pub const ATTR_KEY_STDOUT: &str = "stdout";
pub const ATTR_KEY_STDERR: &str = "stderr";
```

```rust
pub static ref CONFIG: Config = Config {
    lang: HashMap::from([
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
    ])
};
```