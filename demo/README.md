# Demos

## Installing dependencies of demos

The following two files have dependencies (all other files can be tested without installing anything beyond `node`):

* `demo-babel.md`:
  * npm packages via [`marktest-data/package.json`](marktest-data/package.json)
* `demo-typescript.md`:
  * One npm package via [`marktest-data/package.json`](marktest-data/package.json)
  * Two npm packages that are installed automatically via `npx`:
    * [`ts-expect-error`](https://github.com/rauschma/ts-expect-error)
    * [`tsx`](https://github.com/privatenumber/tsx)

To install the npm packages:

```
cd marktest-data
npm install
```

## Run all demos

```
npx @rauschma/marktest demo-*.md
```
