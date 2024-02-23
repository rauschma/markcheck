# Node.js REPL

<!--marktest each="node-repl" before:
import assert from 'node:assert/strict';
-->

## Values

```node-repl
> Object.entries({a:1, b:2})
[
  [ 'a', 1 ],
  [ 'b', 2 ],
]

> Object.getOwnPropertyDescriptor({a:1}, 'a')
{
  value: 1,
  writable: true,
  enumerable: true,
  configurable: true,
}
```

## Expecting exceptions

```node-repl
> 2n + 1
TypeError: Cannot mix BigInt and other types,
use explicit conversions

> const {prop} = undefined
TypeError: Cannot destructure property 'prop' of 'undefined'
as it is undefined.
```

Note: The last input line does not end with a semicolon. A semicolon means that no result (value or exception) is expected.
