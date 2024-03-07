# Marktest demos

Check files like this:

```
npx markcheck demo-javascript.md
```

Files that have dependencies specified in `../markcheck-data/package.json` (and require an `npm install` there):

* `demo-babel.md`
* `demo-typescript.md`

Files that don’t require installations:

* `demo-javascript.md`
* `demo-node-repl.md`

The following file demonstrates how to check languages that have no built-in support in Markcheck:

* `demo-bash.md`
