# Markcheck demo: bash

<!--markcheck config:
{
  "lang": {
    "bash": {
      "defaultFileName": "main.sh",
      "commands": [
        ["bash", "$FILE_NAME"]
      ],
    },
  },
}
-->

### Checking standard output via `stdout`

<!--markcheck stdout="stdout-hello"-->
```bash
echo 'Hello!'
```

<!--markcheck id="stdout-hello"-->
```
Hello!
```

### Expecting a nonzero exit status

<!--markcheck exitStatus="nonzero"-->
```bash
ls does-not-exist.txt
```

### Expecting a nonzero exit status and error output

<!--markcheck exitStatus="nonzero" stderr="stderr-ls"-->
```bash
ls does-not-exist.txt
```

<!--markcheck id="stderr-ls"-->
```
ls: does-not-exist.txt: No such file or directory
```
