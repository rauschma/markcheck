# Markcheck

## Why Markcheck?

* It uses normal Markdown syntax – not a custom version of it: Everything custom happens in comments.
* No external files: The Markdown file contains all the information that is needed to run it.
* Works for any programming language
* You use fenced code blocks (tagged with languages) to specify code and languages.
* Various features (all used from within Markdown files):
  * Check stderr and/or stdout.
  * Concatenate blocks in any order.
  * Use code hidden from readers.
  * Write arbitrary files to disk.
  * Etc.

## Trying out Markcheck without installing it

<!--markcheck skip-->
```
cd markcheck/demo
npx @rauschma/markcheck demo-javascript.md
```

* In this case, the `markcheck-data` directory (for temporary files, see below) is `markcheck/demo/markcheck-data/`.
* To try Markcheck with one of your files, you only need to create a directory `markcheck-data/` (which can be empty) in an ancestor directory of the file (i.e. in its parent directory – sitting next to it, etc.).
* If you create a `markcheck-data` directory in the directory (or an ancestor directory) of one of your Markdown files, you can try out Markcheck, too.

You can permanently install Markcheck via:

<!--markcheck skip-->
```
npm install -g @rauschma/markcheck
```

## The basics of using Markcheck

* The following sections explain the basics of using Markcheck.
* For more information, check [`doc/manual/`](doc/manual) and [`demo/`](demo).

## The `markcheck-data` directory

* The search for `markcheck-data/` starts in the directory of the Markdown file, then progresses to the parent directory, etc.
  * Its location can also be specified in the first `config:` directive in a Markdown file.
* To test Markdown code blocks, files are written to `markcheck-data/tmp/`.
* Therefore, `markcheck-data/` is a good location for non-temporary data that code blocks should have access to, such as:
  * Modules with helper functions
  * `node_modules` with installed npm packages

## How does Markcheck know what to do with code blocks?

Markcheck writes each code block to disk and applies shell commands to it. The commands are determined by the language of the code block:

* You can check out the defaults via `markcheck --print-config`.
* The defaults can be changed inside Markdown files and via `markcheck-data/markcheck-config.jsonc`

The defaults look like this:

<!--markcheck skip-->
```jsonc
{
  "lang": {
    "js": {
      "before": [
        "import assert from 'node:assert/strict';"
      ],
      "defaultFileName": "main.mjs",
      "commands": [
        [ "node", "$FILE_NAME" ]
      ]
    }
  },
  // ...
}
```

`before` contains lines that are inserted at the beginning of each file that is written to disk.

### How to install shell commands that are invoked via `npx`?

These commands are the default for TypeScript:

```json
[
  ["npx", "ts-expect-error", "--unexpected-errors", "$ALL_FILE_NAMES"],
  ["npx", "tsx", "$FILE_NAME"],
]
```

You can install the commands `ts-expect-error` and `tsx` in several ways:

* Globally via `npm install -g`
* Locally, e.g. inside `markcheck-data/node_modules/`
* Automatically, on demand, cached locally by `npx`

## Markdown examples

### Assertions

The Node.js `assert.*` methods are available by default:

<!--markcheck containedInFile="demo/demo-javascript.md"-->
``````md
```js
assert.equal(
  'abc' + 'abc',
  'abcabc'
);
```
``````

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

### Assembling code fragments sequentially via `sequence`

<!--markcheck containedInFile="demo/demo-javascript.md"-->
``````md
<!--markcheck sequence="1/3" stdout="sequence-output"-->
```js
console.log("Snippet 1/3");
```

<!--markcheck sequence="2/3"-->
```js
console.log("Snippet 2/3");
```

<!--markcheck sequence="3/3"-->
```js
console.log("Snippet 3/3");
```

Expected output:

<!--markcheck id="sequence-output"-->
```
Snippet 1/3
Snippet 2/3
Snippet 3/3
```
``````

### Assembling code fragments out of order

<!--markcheck containedInFile="demo/demo-javascript.md"-->
``````md
<!--markcheck include="step1, step2, $THIS"-->
```js
steps.push('Step 3');

assert.deepEqual(
  steps,
  ['Step 1', 'Step 2', 'Step 3']
);
```

<!--markcheck id="step1"-->
```js
const steps = [];
steps.push('Step 1');
```

<!--markcheck id="step2"-->
```js
steps.push('Step 2');
```
``````

### External files

<!--markcheck containedInFile="demo/demo-javascript.md"-->
``````md
<!--markcheck external="other>other.mjs"-->
```js
// main.mjs
import { GRINNING_FACE } from './other.mjs';
assert.equal(GRINNING_FACE, '😀');
```

<!--markcheck id="other"-->
```js
// other.mjs
export const GRINNING_FACE = '😀';
```
``````

### Comment-only (“invisible”) snippets via `body:`

Sometimes readers should not see how a file is set up or that the output is checked.

Setting up an external file:

<!--markcheck containedInFile="demo/demo-javascript.md"-->
``````md
<!--markcheck writeInner="some-file.txt" body:
Content of some-file.txt
-->

```js
import * as fs from 'node:fs';
assert.equal(
  fs.readFileSync('some-file.txt', 'utf-8'),
  'Content of some-file.txt'
);
```
``````

Checking output:

<!--markcheck containedInFile="demo/demo-javascript.md"-->
``````md
<!--markcheck stdout="stdout-how-are-you"-->
```js
console.log('How are you?');
```

<!--markcheck id="stdout-how-are-you" body:
How are you?
-->
``````

### Asynchronous code and hiding test code via ⎡half-brackets⎤

<!--markcheck containedInFile="demo/demo-javascript.md"-->
``````md
```js
⎡await ⎤Promise.allSettled([
  Promise.resolve('a'),
  Promise.reject('b'),
])
.then(
  (arr) => assert.deepEqual(
    arr,
    [
      { status: 'fulfilled', value:  'a' },
      { status: 'rejected',  reason: 'b' },
    ]
  )
);
```
``````

The ⎡half-brackets⎤ are used for hiding test code from readers:

* The program that processes the Markdown (e.g., converts it to HTML) must remove the half-brackets and what’s inside them.
* Markcheck only removes individual half-brackets.
