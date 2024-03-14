# Markcheck

* Markcheck tests Markdown code blocks – to prevent errors in documentation (readmes etc.).
* Name of npm package: [`markcheck`](https://www.npmjs.com/package/markcheck)

## Why Markcheck?

Highlights:

* **Uses normal Markdown syntax** – not a custom version of it: Everything custom happens inside Markdown comments.

* **No external files:** The Markdown file contains all the information that is needed to run it: Configuration files, demo text files, etc. can all be embedded in Markdown.
  * Exception: Some data remains external – e.g. npm packages.

* **Works for most programming languages:** The only requirement is that there is a shell command that runs text files with the language’s code. See [`demo/demo-bash.md`](demo/demo-bash.md?plain=1) for an example of testing a programming language that Markcheck has no built-in support for.

* **Successfully used in a big project:** I tested most of the code shown in my book [“JavaScript for impatient programmers”](https://exploringjs.com/impatient-js/). Its PDF has 639 pages.

* **Provides versatile tools for checking code:** Human readers of the published Markdown never see the complexity that is occasionally needed to make code blocks testable. These are some of the tools at our disposal – they can all be used from within Markdown files:
  * Check stderr and/or stdout.
  * Concatenate code blocks in any order.
  * Use code hidden from readers.
  * Write arbitrary text files to disk (example files, config files, etc.).
  * Etc.

Checking JavaScript is reasonably fast:

* Checking all the examples in “JavaScript for impatient programmers” takes 50 seconds on a MacBook Pro with an M1 Pro processor. There is a lot of code in this book.
* Checking one of the longer chapters takes 5 seconds.

**Caveats:**

* Only tested on macOS. I used cross-platform mechanisms where I could but I don’t know if Markcheck works on Windows. Please let me know either way.
* ⚠️ There is currently no sandboxing of any kind: Only use Markcheck with files you trust.
* Checking TypeScript code:
  * Downside: slow
  * Upside: You can write very expressive code that works well for explaining language mechanisms. See [`demo/demo-typescript.md`](demo/demo-typescript.md?plain=1) for more information.

## What does Markcheck’s syntax look like?

The following subsections show two common patterns. For more examples, see [the quick start part of Markcheck’s manual](doc/manual/quick-start.md#markdown-examples).

### Checking basic code blocks

``````md
```js
assert.equal(
  'abc' + 'abc',
  'abcabc'
);
```
``````

No additional configuration is needed: The Node.js `assert.*` methods are available by default.

### Checking standard output via `stdout`

<!--markcheck containedInFile="demo/demo-javascript.md"-->
``````md
<!--markcheck stdout="stdout-hello"-->
```js
console.log('Hello!');
```

<!--markcheck id="stdout-hello"-->
```
Hello!
```
``````

### Hiding code via `before:`

<!--markcheck containedInFile="demo/demo-javascript.md"-->
``````md
<!--markcheck before:
function functionThatShouldThrow() {
  throw new Error();
}
-->
```js
try {
  functionThatShouldThrow();
  assert.fail();
} catch (_) {
  // Success
}
```
``````

## More information on Markcheck

* [Demo files](demo/README.md) with code blocks in these languages: JavaScript, TypeScript, Babel, Node.js REPL, Bash
* [Quick start with many examples](doc/manual/quick-start.md)
* [Manual](doc/manual/)

## Donations

I have rewritten Markcheck several times over the years, until I arrived at the current version. If you find this tool or [any of my other free work](https://dr-axel.de) useful, I would appreciate a donation:

* One-time donation:
  * [Paypal](https://paypal.me/rauschma)
  * [Stripe](https://buy.stripe.com/bIY4hd5etaYZ9d6cMM)
* Recurring donation:
  * [GitHub Sponsors](https://github.com/sponsors/rauschma)
  * [Liberapay](https://liberapay.com/rauschma/donate)
