# TypeScript

* Tools:
  * https://github.com/privatenumber/tsx
    * No static checks!
  * https://github.com/rauschma/ts-expect-error
* Library:
  * https://github.com/TypeStrong/ts-expect

<!--marktest config:
{
  "lang": {
    "ts": {
      "defaultFileName": "main.ts",
      "commands": [
        ["npx", "ts-expect-error", "$ALL_FILE_NAMES"],
        ["npx", "tsx", "$FILE_NAME"],
      ],
    },
  },
}
-->

<!--marktest each="ts" before:
import { expectType, TypeEqual } from 'ts-expect';
-->

When it comes to TypeScript examples in documentation, there are three important kinds of static checks that are useful (in addition to running the code as JavaScript to catch runtime errors).

## Static check: expecting errors

```ts
// @ts-expect-error: A 'const' assertions can only be applied to references
// to enum members, or string, number, boolean, array, or object literals.
let sym = Symbol() as const;
```

## Static check: types of values

```ts
expectType<string>('test');
expectType<number>(123);
```

## Static check: equality of types

```ts
type Pair<T> = [T, T];
expectType<TypeEqual<Pair<string>, [string,string]>>(true);
```
