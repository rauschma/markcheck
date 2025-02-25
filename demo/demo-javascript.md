# Markcheck demo: JavaScript

## Assertions

```js
assert.equal(
  'abc' + 'abc',
  'abcabc'
);
```

### Checking standard output via `stdout`

```js
console.log('Hello!');
```

<!--markcheck define="stdout"-->
```
Hello!
```

**Alternative syntax:**

<!--markcheck stdout="stdout-hello"-->
```js
console.log('Hello!');
```

<!--markcheck id="stdout-hello"-->
```
Hello!
```

## Hiding code via `before:`

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

### Assembling code fragments sequentially via `sequence`

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

## Assembling code fragments out of order

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

## External files

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

### Comment-only (“invisible”) snippets via `body:`

Setting up an external file:

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

Checking output:

```js
console.log('How are you?');
```

<!--markcheck define="stdout" body:
How are you?
-->

### Hiding test code via ⎡half-brackets⎤

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
