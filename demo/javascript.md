# Demo document

<!--marktest write="other.mjs"-->
```js
// other.mjs
export const NAME = 'user';
```

<!--marktest stdout="output"-->
```js
// main.mjs
import { NAME } from './other.mjs';

console.log(`Hello ${NAME}!`);
```

<!--marktest id="output"-->
```
Hello user!
```
