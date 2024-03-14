# Markcheck

* Markcheck runs the code within Markdown code blocks – to help ensure they don’t contain errors.
* Name of npm package: [`markcheck`](https://www.npmjs.com/package/markcheck)

## Why Markcheck?

Highlights:

* It uses normal Markdown syntax – not a custom version of it: Everything custom happens inside Markdown comments.
* No external files: The Markdown file contains all the information that is needed to run it (except for imported packages).
* Works for any programming language.
* You use fenced code blocks (tagged with languages) to specify code and languages.

Human readers of the published Markdown never see the complexity that is occasionally needed to make simple examples testable. These are some of the tools at our disposal – they can all be used from within Markdown files:

* Check stderr and/or stdout.
* Concatenate blocks in any order.
* Use code hidden from readers.
* Write arbitrary files to disk.
* Etc.

Checking JavaScript is reasonably fast:

* Checking all the code examples in my book “JavaScript for impatient programmers” takes 49.9 seconds on a MacBook Pro with an M1 Pro processor. And there is a lot of code in the book’s 639 pages.
* Checking one of the longer chapters takes 4.7 seconds.

**Caveats:**

* Tested with Unix. I used cross-platform mechanisms where I could but I don’t know if Markcheck works on Windows. Please let me know either way.
* ⚠️ There is currently no sandboxing of any kind: Only use Markcheck with files you trust.
* Checking TypeScript code:
  * Downside: slow
  * Upside: You can write very expressive code that works well for explaining language mechanisms. See [`demo/demo-typescript.md`](demo/demo-typescript.md?plain=1) for more information.

## What does Markcheck’s syntax look like?

The following subsections show two common patterns. For more examples, see [the quick start part of Markcheck’s manual](doc/manual/quick-start.md#markdown-examples).

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
