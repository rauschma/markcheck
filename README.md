# Markcheck

Markcheck runs the code within Markdown code blocks – to help ensure they don’t contain errors.

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

## Documentation

* What does Markcheck’s syntax look like?
  * See [`demo/demo-javascript.md`](demo/demo-javascript.md?plain=1)
  * [More demo files](demo/)
* [Quick start with many examples](doc/manual/quick-start.md)
* [Manual](doc/manual/)

## Caveats

* ⚠️ There is currently no sandboxing of any kind: Only use Markcheck with files you trust.
* Checking TypeScript code:
  * Downside: slow
  * Upside: You can write very expressive code that works well for explaining language mechanisms. See [`demo/demo-typescript.md`](demo/demo-typescript.md?plain=1) for more information.

## Donations

I have rewritten Markcheck several times over the years, until I arrived at the current version. If you find this tool or [any of my other free work](https://dr-axel.de) useful, I would appreciate a donation:

* One-time donation: [Paypal](https://paypal.me/rauschma)
* Recurring donation: [Liberapay](https://liberapay.com/rauschma/donate)
