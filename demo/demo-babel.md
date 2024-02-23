# Babel

## Installing Babel and plugins

<!--marktest skip-->
```json
// package.json
{
  "dependencies": {
    "@babel/plugin-proposal-decorators": "^7.21.0",
    "babel-register-esm": "^1.2.4"
  }
}
```

## Setting up Marktest

<!--marktest config:
{
  "lang": {
    "js": {
      "use": "babel",
    },
  },
}
-->

## Configuring Babel

We need to configure Babel. We use the “project-wide” configuration file `babel.config.json` because it works with both files and stdin (which Marktest may use in the future).

More information on Babel configuration files: https://babeljs.io/docs/en/config-files

<!--marktest write="babel.config.json" neverSkip body:
{
  "plugins": [
    ["@babel/plugin-proposal-decorators", {"version": "2022-03"}]
  ]
}
-->

## Code used by all `js` code blocks

<!--marktest each="js" before:
import assert from 'node:assert/strict';
-->

## JavaScript code

This code will be transpiled via Babel before it runs:

```js
@annotation
class MyClass {}

function annotation(target) {
  target.annotated = 'yes';
}

assert.equal(MyClass.annotated, 'yes');
```
