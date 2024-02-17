# Demo document

<!--marktest stdout="output"-->
```js
// main.mjs
import { NAME } from './other.mjs';

console.log(`Hello ${NAME}!`);
```

<!--marktest write="other.mjs"-->
```js
// other.mjs
export const NAME = 'user';
```

<!--marktest id="output"-->
```text
Hello user!
```
