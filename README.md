# Markcheck

## Why Markcheck?

* It uses normal Markdown syntax – not a custom version of it: Everything custom happens in comments.
* No external files: The Markdown file contains all the information that is needed to run it.
* Works for any programming language.
* You use fenced code blocks (tagged with languages) to specify code and languages.
* Various features (all used from within Markdown files):
  * Check stderr and/or stdout.
  * Concatenate blocks in any order.
  * Use code hidden from readers.
  * Write arbitrary files to disk.
  * Etc.

## Trying out Markcheck without installing it

```txt
cd markcheck/
npx markcheck demo/demo-javascript.md
npx markcheck demo/demo-node-repl.md
```

For `demo-babel.md` and `demo-typescript.md`, you need to install the packages inside `markcheck/demo`:

```txt
cd markcheck/demo
npm install
```

## Using Markcheck for your own files

* The remainder of this readme explains the basics of using Markcheck.
* For more information, check [`doc/manual/`](doc/manual) and [`demo/`](demo).

### Step 1: Creating a Markdown file

We create the following Markdown file that we want to check with Markcheck:

<!--markcheck containedInFile="demo/demo-javascript.md"-->
``````md
```js
assert.equal(
  'abc' + 'abc',
  'abcabc'
);
```
``````

* The Node.js `assert.*` methods are available by default.
* We put the file at `/home/robin/proj/md/readme.md`

### Step 2: directory `markcheck-data/`

Markcheck stores the code in Markdown files in temporary files and feeds them to various shell commands. Therefore, to use it, we must provide a location for these files:

* Per Markdown file, Markcheck searches for a directory `markcheck-data/`: First the file’s parent directory, then in the grand-parent directory, etc.
* The temporary files are stored in `markcheck-data/tmp/`.

Thus, for our example file, there needs to be a directory in one of these locations:

```txt
/home/robin/proj/md/markcheck-data/
/home/robin/proj/markcheck-data/
/home/robin/markcheck-data/
/home/markcheck-data/
/markcheck-data/
```

Since the code is run inside `markcheck-data/tmp/`, `markcheck-data/` itself is a good location for non-temporary data that code blocks should have access to, such as:

* Modules with helper functions
* `node_modules/` with installed npm packages

### Step 3: run Markcheck

Now we can run Markcheck:

```txt
npx run markcheck /home/robin/proj/md/readme.md
```

If we don’t want to use npx (which installs packages on demand and caches them locally), we can also install Markcheck somewhere:

```txt
# Local installation (e.g. inside a repository)
npm install --save-dev markcheck

# Global installation
npm install --global markcheck
```

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

We can install the commands `ts-expect-error` and `tsx` in several ways:

* Automatically, cached locally by `npx`
* Locally, e.g. inside `markcheck-data/node_modules/`
* Globally via `npm install -g`

## Markdown examples

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
