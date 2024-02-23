# Common patterns

## Assembling a sequence of code fragments

<!--marktest sequence="1/3"-->
```js
```

<!--marktest sequence="2/3"-->
```js
```

<!--marktest sequence="3/3"-->
```js
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

<!--marktest id="step1" before:
import assert from 'node:assert/strict';
-->
```js
const steps = [];
steps.push('Step 1');
```

<!--marktest id="step2"-->
```js
steps.push('Step 2');
```
