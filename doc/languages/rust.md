# Marktesting Rust code

```js
// Command
["cargo-play", "--quiet", "*.rs"]
```

## Running code

* Run Rust source code like a script: https://www.reddit.com/r/rust/comments/monzuc/run_rust_source_code_like_a_script_linux/
    * ✅ cargo-play (292⭐️, 11 months ago on 2023-01-12): Run Rust files without setting up a Cargo project. https://github.com/fanzeyi/cargo-play
    * rust-script (645⭐️, 2 months ago on 2023-01-12): Run Rust files and expressions as scripts without any setup or compilation step. https://github.com/fornwall/rust-script
* 👍 Scriptisto: language-agnostic "shebang interpreter" that enables you to write scripts in compiled languages. https://github.com/igor-petruk/scriptisto

## Testing types

* `static_assertions`: for constants, types, and more. https://docs.rs/static_assertions/latest/static_assertions/
* rust-analyzer (Language Server Protocol): https://rust-analyzer.github.io

Conceivable workaround: produce an error and extract the type information from stderr (after `= note`):

```
error[E0308]: mismatched types
  --> src/main.rs:18:9
   |
18 |     let () = HashMap::<String, &str>::new();
   |         ^^   ------------------------------ this expression has type `HashMap<String, &str>`
   |         |
   |         expected struct `HashMap`, found `()`
   |
   = note: expected struct `HashMap<String, &str>`
           found unit type `()`
```

## Testing errors

* Testing `panic!()`: https://zhauniarovich.com/post/2021/2021-01-testing-errors-in-rust/#example

## Other tools

* Built-in testing tools: https://users.rust-lang.org/t/checking-which-compile-time-errors-happen/
    * Documentation tests: https://doc.rust-lang.org/rustdoc/write-documentation/documentation-tests.html#documentation-tests
    * `compile_fail`: https://doc.rust-lang.org/rustdoc/write-documentation/documentation-tests.html#attributes
        * Maybe: ```` ```compile_fail,E0123 ````
    * 👉 `trybuild` checks stderr of compiler: https://lib.rs/crates/trybuild
* Scraped examples: https://doc.rust-lang.org/rustdoc/scraped-examples.html#scraped-examples
* `eval()` in Rust: https://crates.io/crates/evcxr
    * Evcxr Rust REPL: https://crates.io/crates/evcxr_repl