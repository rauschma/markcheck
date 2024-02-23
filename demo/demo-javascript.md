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
import assert from 'node:assert/strict';
assert.equal(
  'abc' + 'abc',
  'abcabc'
);
```