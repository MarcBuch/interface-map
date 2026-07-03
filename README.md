# @marcbuch/opencode-interface-map

OpenCode plugin that extracts a compact interface map from TypeScript source files.

The plugin adds a `get_interface_map` tool that summarizes declarations, signatures, and object shapes while stripping implementation details.

## Install

```bash
bun add @marcbuch/opencode-interface-map
```

## OpenCode config

Add the package to your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@marcbuch/opencode-interface-map"]
}
```

## Tool

`get_interface_map`

Arguments:

```json
{
  "filePath": "src/example.ts"
}
```

The tool returns a numbered plain-text outline of the file's public structure, including interfaces, classes, type aliases, functions, variables, and selected object-literal summaries.

## Development

Install dependencies:

```bash
bun install
```

Run tests:

```bash
bun test
```

Typecheck:

```bash
bun run typecheck
```

Build:

```bash
bun run build
```

Inspect the package contents before publishing:

```bash
npm pack --dry-run
```

## License

`MIT`
