# JavaScript

## Assertions

```js
assert.equal(
  'abc' + 'abc',
  'abcabc'
);
```

### Checking standard output via `stdout`

<!--marktest stdout="output"-->
```js
console.log('Hello!');
```

<!--marktest id="output"-->
```
Hello!
```

## Hiding code via `before:`

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

### Assembling code fragments sequentially via `sequence`

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

## Assembling code fragments out of order

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

## External files

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

### Comment-only (“invisible”) snippets via `body:`

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

### Asynchronous code and hiding test code via ⎡half-brackets⎤

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
