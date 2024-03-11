# Markcheck demo: Babel

## Installing Babel and plugins

<!--markcheck skip-->
```json
// package.json
{
  "dependencies": {
    "@babel/plugin-proposal-decorators": "^7.21.0",
    "babel-register-esm": "^1.2.4"
  }
}
```

## Setting up Markcheck

<!--markcheck config:
{
  "lang": {
    "js": {
      "extends": "babel",
    },
  },
}
-->

## Configuring Babel

We need to configure Babel. We use the “project-wide” configuration file `babel.config.json` because it works with both files and stdin (which Markcheck may use in the future).

More information on Babel configuration files: https://babeljs.io/docs/en/config-files

<!--markcheck write="babel.config.json" body:
{
  "plugins": [
    ["@babel/plugin-proposal-decorators", {"version": "2022-03"}]
  ]
}
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
