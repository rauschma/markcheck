# Troubleshooting

## One among many code blocks fails

Use `<!--markcheck only-->`:

* Then only a particular code block runs.
* You can also inspect the files in `markcheck-data/tmp/`: The files produced by that particular code block are still there (because it was run last).

## What files are written? What commands are run?

Find out via option `--verbose`

## Get CLI help

Via option `--help`

## What is the format of config files?

See an example via `--print-config`
