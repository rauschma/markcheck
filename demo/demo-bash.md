# Markcheck demo: bash

<!--markcheck config:
{
  "lang": {
    "bash": {
      "runFileName": "main.sh",
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

Expected stdout:

<!--markcheck id="stdout-hello"-->
```
Hello!
```

### Expecting a nonzero exit status

This command fails:

<!--markcheck exitStatus="nonzero"-->
```bash
ls does-not-exist.txt
```

### Expecting a nonzero exit status and error output

This command fails:

<!--markcheck exitStatus="nonzero" stderr="stderr-ls"-->
```bash
ls does-not-exist.txt
```

Expected stderr:

<!--markcheck id="stderr-ls"-->
```
ls: does-not-exist.txt: No such file or directory
```
