# JavaScript

## Check output

<!--marktest stdout="output" external="other>other.mjs"-->
```js
// main.mjs
import { NAME } from './other.mjs';
console.log(`Hello ${NAME}!`);
```

<!--marktest id="other"-->
```js
// other.mjs
export const NAME = 'user';
```

<!--marktest id="output"-->
```
Hello user!
```

## Assertions

```js
assert.equal(
  'abc' + 'abc',
  'abcabc'
);
```

## Asynchronous code

This is a quick demo of how `Promise.allSettled()` works:

```js
await Promise.allSettled([
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

Easy to test, thanks to top-level `await`.
