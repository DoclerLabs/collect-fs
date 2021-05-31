Merge multiple directories in one. Precedence is based on arguments.

## Usage

```bash
collect-fs --source=/path/to/one/directory /path/to/another/directory --target=/path/to/target/directory
```

## Available CLI Options

| option           | description                                  |
| ---------------- | -------------------------------------------- |
| `--help`         | Print help                                   |
| `--version`      | Print current version                        |
| `--source`, `-s` | Space-separated list of directories to merge |
| `--target`, `-t` | Target directory                             |

## Node Usage

```js
import collectFs from "collect-fs";

collectFs(
  ["/path/to/one/directory", "/path/to/another/directory"],
  "/path/to/target/directory"
);
```

## Caveats

1. As of now empty directories are not copied over.

## Contributing

Issues and PRs are welcome.
