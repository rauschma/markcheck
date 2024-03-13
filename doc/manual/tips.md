# Tips

## Visual Studio Code

You can set up [Visual Studio Code snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets) for Markcheck. I’m using the following snippets:

```jsonc
"Markcheck": {
  "prefix": "mc",
  "body": [
    "<!--markcheck $1-->$0"
  ],
},
"Markcheck brackets": {
  "prefix": "mcb",
  "body": [
    "⎡⎤"
  ],
},
"Markcheck sequence": {
  "prefix": "mcs",
  "body": [
    "<!--markcheck sequence=\"1/$1\"-->$0"
  ],
},
"Markcheck skip": {
  "prefix": "mck",
  "body": [
    "<!--markcheck skip-->$0"
  ],
},
"Markcheck only": {
  "prefix": "mco",
  "body": [
    "<!--markcheck only-->$0"
  ],
},
```
