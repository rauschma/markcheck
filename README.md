# Marktest

## Why Marktest?

* Doesn’t change Markdown syntax: Everything custom happens in comments.
* No external files: The Markdown file contains all the information that is needed to run it.
* Works for any programming language
* Use fenced code blocks and tags to specify code and language (some tools use indented code blocks).
* Various features: check stderr and/or stdout, concatenate blocks in any order, use code not shown to readers, set up files on disk, etc.

## Trying out Marktest

```
cd marktest/demo
npx @rauschma/marktest demo-javascript.md
```

* In this case, the `marktest-data` directory (for temporary files, see below) is `marktest/demo/marktest-data/`.
* To try Marktest with one of your files, you only need to create a directory `marktest-data/` (which can be empty) in an ancestor directory of the file (i.e. in its parent directory – sitting next to it, etc.).
* If you create a `marktest-data` directory in the directory (or an ancestor directory) of one of your Markdown files, you can try out Marktest, too.

You can permanently install Marktest via:

```
npm install -g @rauschma/marktest
```

## The basics of using Marktest

* The following sections explain the basics of using Marktest.
* For more information, check [`doc/manual/`](doc/manual) and [`demo/`](demo).

## The `marktest-data` directory

* Search for it starts in the directory of the Markdown file, then progresses to the parent directory, etc.
  * Its location can also be specified in the first `config:` directive in a Markdown file.
* To test Markdown code blocks, files are written to `marktest-data/tmp/`.
* Therefore, `marktest-data/` is a good location of non-temporary data that code blocks should have access to, such as modules with helper functions or `node_modules` with installed npm packages.

## How does Marktest know what to do with code blocks?

Marktest writes each code block to disk and applies shell commands to it. The commands are determined by the language of the code block:

* You can check out the defaults via `marktest --print-config`.
* The defaults can be changed inside Markdown files and via `marktest-data/marktest-config.jsonc`

The defaults look like this:

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

## Markdown examples

### Assertions

The Node.js `assert.*` methods are available by default:

``````md
```js
assert.equal(
  'abc' + 'abc',
  'abcabc'
);
```
``````

### Checking standard output via `stdout`

``````md
<!--marktest stdout="output"-->
```js
console.log('Hello!');
```

<!--marktest id="output"-->
```
Hello!
```
``````

### Hiding code via `before:`

``````md
<!--marktest before:
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

``````md
<!--marktest sequence="1/3" stdout="sequence-output"-->
```js
console.log("Snippet 1/3");
```

<!--marktest sequence="2/3"-->
```js
console.log("Snippet 2/3");
```

<!--marktest sequence="3/3"-->
```js
console.log("Snippet 3/3");
```

Expected output:

<!--marktest id="sequence-output"-->
```
Snippet 1/3
Snippet 2/3
Snippet 3/3
```
``````

### Assembling code fragments out of order

``````md
<!--marktest include="step1, step2, $THIS"-->
```js
steps.push('Step 3');

assert.deepEqual(
  steps,
  ['Step 1', 'Step 2', 'Step 3']
);
```

<!--marktest id="step1"-->
```js
const steps = [];
steps.push('Step 1');
```

<!--marktest id="step2"-->
```js
steps.push('Step 2');
```
``````

### External files

``````md
<!--marktest external="other>other.mjs"-->
```js
// main.mjs
import { GRINNING_FACE } from './other.mjs';
assert.equal(GRINNING_FACE, '😀');
```

<!--marktest id="other"-->
```js
// other.mjs
export const GRINNING_FACE = '😀';
```
``````

### Comment-only (“invisible”) snippets via `body:`

``````md
<!--marktest write="some-file.txt" body:
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

### Asynchronous code and hiding test code via ⎡half-brackets⎤

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

* The program that publishes the Markdown must remove the half-brackets and what’s inside them.
* Marktest only removes individual half-brackets.
