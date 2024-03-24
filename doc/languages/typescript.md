# TypeScript

## Running TypeScript code via Node.js

* https://github.com/privatenumber/tsx

## Testing types

* https://github.com/TypeStrong/ts-expect

```ts
import { expectType } from 'ts-expect';

expectType<string>('test');
expectType<number>(123);
```

```ts
import { expectType, type TypeEqual } from 'ts-expect';
type Pair<T> = [T, T];
expectType<TypeEqual<Pair<string>, [string,string]>>(true);
```

### Other type utility libraries

* tsafe: https://github.com/garronej/tsafe
* type-plus: https://github.com/unional/type-plus/blob/main/packages/type-plus/readme.md
* type-fest: https://github.com/sindresorhus/type-fest

## Related tools and libraries

* TypeScript TwoSlash: https://www.npmjs.com/package/@typescript/twoslash

### eslint-plugin-expect-type

* https://github.com/JoshuaKGoldberg/eslint-plugin-expect-type
  * Background: https://effectivetypescript.com/2022/05/28/eslint-plugin-expect-type/

```ts
9001;
// ^? number

// $ExpectError
const value: string = 9001;

// $ExpectType number
9001;
```
