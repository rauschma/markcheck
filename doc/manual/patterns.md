# Common patterns

## Assembling a sequence of code fragments

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
