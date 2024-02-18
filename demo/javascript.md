# Demo document

<!--marktest stdout="output" write="other>other.mjs"-->
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
