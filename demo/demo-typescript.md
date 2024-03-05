# TypeScript

By default, Marktest uses the following tools (which must be installed – e.g. in `marktest-data/node_modules/`):

* Running TypeScript: [CLI tool `tsx`](https://github.com/privatenumber/tsx)
  * Does not perform any static checks!
* Checking `@ts-expect-error` and performing static checks (option `--unexpected-errors`): [CLI tool `ts-expect-error`](https://github.com/rauschma/ts-expect-error)
* Comparing types and checking the types of values: [library `ts-expect`](https://github.com/TypeStrong/ts-expect)

When it comes to TypeScript examples in documentation, there are three important kinds of static checks that are useful (in addition to running the code as JavaScript to catch runtime errors).

## Static check: expecting errors

```ts
// @ts-expect-error: A 'const' assertions can only be applied to references
// to enum members, or string, number, boolean, array, or object literals.
let sym = Symbol() as const;
```

## Static check: types of values

```ts
expectType<string>('abc');
expectType<number>(123);
// @ts-expect-error: Argument of type 'string'
// is not assignable to parameter of type 'number'.
expectType<number>('abc');
```

## Static check: equality of types

```ts
type Pair<T> = [T, T];
expectType<TypeEqual<Pair<string>, [string,string]>>(true);
```
