# TypeScript

* Run TypeScript: https://github.com/privatenumber/tsx

## Testing types

### TS Expect

https://github.com/TypeStrong/ts-expect

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

## TODO

* TypeScript TwoSlash: https://www.npmjs.com/package/@typescript/twoslash
* tsimp – TypeScript IMPort loader for Node.js: https://github.com/tapjs/tsimp
* Compare types, check types of values: https://github.com/garronej/tsafe
