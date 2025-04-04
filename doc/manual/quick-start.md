# Quick start

Requirement for using Markcheck:

* [Node.js](https://nodejs.org/) must be installed. It runs Markcheck’s code.
* Node.js comes bundled with npm which provides the `npx` command for running Markcheck without installing it permanently.

## Trying out Markcheck without installing it permanently

There are demos for several languages in [`markcheck/demo/`](../../demo/README.md)

As an example – [`demo/demo-javascript.md`](../../demo/demo-javascript.md?plain=1) is a file with JavaScript code blocks:

```txt
cd markcheck/
npx markcheck demo/demo-javascript.md
```

The second command produces the following output. The lines with line numbers refer to code blocks and their languages. The bold lines between them are the most recent headings before the code blocks.

<img src="screenshot-markcheck.jpg" width="423.5" height="301.5" alt="Screenshot of Markcheck output with colors, bold letters, etc. An unstyled version of the output is shown below.">

Unstyled version of the previous screenshot:

```txt
========== demo/demo-javascript.md ==========
Markcheck directory: markcheck-data
Assertions
L5 (js) ✔︎
Checking standard output via `stdout`
L14 (js) ✔︎
Hiding code via `before:`
L26 (js) ✔︎
Assembling code fragments sequentially via `sequence`
L42 (js) ✔︎
Assembling code fragments out of order
L68 (js) ✔︎
External files
L91 (js) ✔︎
Comment-only (“invisible”) snippets via `body:`
L112 (js) ✔︎
L122 (js) ✔︎
Asynchronous code and hiding test code via ⎡half-brackets⎤
L133 (js) ✔︎
----- Summary of "demo/demo-javascript.md" -----
✅ Successes: 9, Failures: 0, Syntax Errors: 0, Warnings: 0
```

## What CLI options are available?

Getting help for the command line interface of Markcheck:

```txt
npx markcheck -h
```

## Using Markcheck for your own files

The remainder of this document explains the basics of using Markcheck – including [several common Markcheck patterns](#markdown-examples).

### Step 1: create a Markdown file

We create the following Markdown file that we want to check with Markcheck:

<!--markcheck containedInFile="../../demo/demo-javascript.md"-->
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

### Step 2: create directory `markcheck-data/`

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
* The defaults can be changed inside Markdown files and via `markcheck-data/markcheck-config.json5`. See [the reference](./reference.md#configuration) for more information.

The defaults look like this:

<!--markcheck skip-->
```json5
{
  lang: {
    js: {
      before: [
        "import assert from 'node:assert/strict';",
      ],
      runFileName: "main.mjs",
      commands: [
        [
          "node",
          "$FILE_NAME",
        ],
      ],
    },
    // ···
  },
  // ···
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
* Manually:
  * Locally, e.g. inside `markcheck-data/node_modules/`
  * Globally via `npm install -g`

## Markdown examples

### Checking standard output via `stdout`

<!--markcheck containedInFile="../../demo/demo-javascript.md"-->
``````md
```js
console.log('Hello!');
```

<!--markcheck define="stdout"-->
```
Hello!
```
``````

### Hiding code via `before:`

<!--markcheck containedInFile="../../demo/demo-javascript.md"-->
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

<!--markcheck containedInFile="../../demo/demo-javascript.md"-->
``````md
<!--markcheck sequence="1/3"-->
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

<!--markcheck define="stdout"-->
```
Snippet 1/3
Snippet 2/3
Snippet 3/3
```
``````

### Assembling code fragments out of order via `include`

`$THIS` is optional if it is last among the `include` values.

<!--markcheck containedInFile="../../demo/demo-javascript.md"-->
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

### Setting up external files

<!--markcheck containedInFile="../../demo/demo-javascript.md"-->
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

Sometimes readers should not see how a file is set up or that the output is checked. That can be done via `body:`

Setting up an external file:

<!--markcheck containedInFile="../../demo/demo-javascript.md"-->
``````md
<!--markcheck write="some-file.txt" body:
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

<!--markcheck containedInFile="../../demo/demo-javascript.md"-->
``````md
```js
console.log('How are you?');
```

<!--markcheck define="stdout" body:
How are you?
-->
``````

### Hiding test code via ⎡half-brackets⎤

<!--markcheck containedInFile="../../demo/demo-javascript.md"-->
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

* Markcheck removes individual half-brackets before writing the code to disk.
* Before you publish the Markdown (e.g. to HTML), you need to remove the half-brackets and what’s inside them. See [the reference](reference.md#config-property-searchandreplace) for more information.

### Writing a configuration file to disk

<!--markcheck containedInFile="../../demo/demo-babel.md"-->
``````md
<!--markcheck write="babel.config.json" body:
{
  "plugins": [
    ["@babel/plugin-proposal-decorators", {"version": "2022-03"}]
  ]
}
-->
``````

See [`demo/demo-babel.md`](../../demo/demo-babel.md) for more information.
