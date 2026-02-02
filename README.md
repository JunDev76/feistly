# Feistly

Feistly is a small Feistel-based library for hiding auto-increment IDs while keeping the output short and URL-friendly.

## Install

```bash
pnpm add feistly
```

## Usage

```ts
import { Feistly } from "feistly";

const feistly = new Feistly({
  masterKey: process.env.FEISTLY_MASTER_KEY ?? "dev-secret",
});

const token = feistly.encrypt("user", "12345");
const id = feistly.decrypt("user", token);

console.log({ token, id });
```

## Options

```ts
const feistly = new Feistly({
  masterKey: "your-master-key",
  rounds: 10,
  tagLength: 2,
  alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  minLength: 0,
});
```

- `rounds`: Feistel rounds (default 10)
- `tagLength`: prefix length used for key validation (default 2)
- `alphabet`: base alphabet used to encode tokens (default base62)
- `minLength`: minimum length for the encoded body (default 0)

## Notes

- Input IDs must be non-negative and within unsigned 64-bit range.
- Output tokens are `tag + body`, both encoded in the chosen alphabet.
- Use a stable `domain` per entity (ex: `user`, `order`, `asset`).

## Development

```bash
pnpm install
pnpm build
pnpm dev:example
```
