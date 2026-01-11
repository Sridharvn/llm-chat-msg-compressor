# llm-chat-msg-compressor 🚀

[![NPM Version](https://img.shields.io/npm/v/llm-chat-msg-compressor.svg)](https://www.npmjs.com/package/llm-chat-msg-compressor)
[![License](https://img.shields.io/npm/l/llm-chat-msg-compressor.svg)](https://github.com/Sridharvn/llm-chat-msg-compressor/blob/main/LICENSE)
[![Build Status](https://github.com/Sridharvn/llm-chat-msg-compressor/actions/workflows/test.yml/badge.svg)](https://github.com/Sridharvn/llm-chat-msg-compressor/actions)

Intelligent JSON optimizer for LLM APIs. Automatically reduces token usage by selecting the best compression strategy for your data payload.

[**Live Playground**](https://sridharvn.github.io/llm-compressor-ui/)

## Highlights

- **🧠 Intelligent**: Analyzes payload structure and token impact to pick the best strategy
- **⚡ Fast**: Iterative traversals and selective passes avoid stack overflows and long pauses
- **📉 Effective**: Strategies like Schema Separation and Structural Deduplication can reduce tokens significantly for common LLM payloads
- **✅ Safe-by-default**: Keeps types & semantics intact unless `unsafe` mode is explicitly enabled
- **🔍 Token-aware validation**: Uses `js-tiktoken` to ensure real token savings

---

## Quickstart

```bash
npm install llm-chat-msg-compressor
```

```ts
import { optimize, restore } from "llm-chat-msg-compressor";

const data = { messages: [{ role: "user", content: "Hello" } /* ... */] };

const optimized = optimize(data);
// send optimized to your LLM
// when receiving back a compressed payload, you can restore it
const restored = restore(optimized);
```

---

## Strategies (Auto-selected)

- **Minify** — No-op JSON minification (used for small payloads)
- **Structural Deduplication** — Detects repeated large subtrees and replaces them with a root-level registry (`$r`) referencing shared content. Extremely effective for repeated boilerplate, tool outputs, or large repeated payloads.
- **Schema Separation** — Converts arrays of uniform objects into `{ $s: [...keys], $d: [[values], ...] }` for compactness
- **Abbreviated Keys** — Maps frequently used long keys to short single-letter identifiers and includes a small map `m` when beneficial
- **Ultra Compact** — Aggressive key mapping plus optional boolean-to-int conversion (opt-in `unsafe` mode)

---

## Optimizer Pipeline

`optimize()` now runs a speculative multi-pass pipeline by default:

1. Deduplication (lightweight hash-based detection)
2. Schema Separation
3. Abbreviated Keys
4. Optional UltraCompact (if `aggressive: true`)

Each pass is applied only if it yields a net token or byte improvement (speculative acceptance). This produces compound benefits while ensuring we never increase token usage if `validateTokenSavings` is on.

### Fast Mode

To control latency vs compression trade-offs, use `fastMode` and `fastSize`:

- `fastMode: true` (default) will skip expensive dedup passes for small payloads
- `fastSize` (bytes) controls what "small" means (default 512)

Example:

```ts
optimize(data, { fastMode: true, fastSize: 1024 });
```

---

## Options & Examples

```ts
optimize(data, {
  aggressive: false, // try UltraCompact only when requested
  unsafe: false, // if true, allows bool -> 1/0 (lossy) to reduce tokens
  thresholdBytes: 1024, // only consider multi-pass if payload larger than this
  validateTokenSavings: true, // require token savings to accept transformations
  fastMode: true, // skip expensive passes for small payloads
  fastSize: 512, // threshold for fastMode
});
```

Example (Structural Deduplication):

```ts
const repeated = { long: "x".repeat(200), meta: { a: 1 } };
const payload = { items: [repeated, { other: 1 }, repeated, repeated] };
const optimized = optimize(payload, { thresholdBytes: 0 });
// optimized may look like: { $r: { r1: { long: 'xxx', meta: {...} } }, d: { items: [{ $ref: 'r1'}, { other: 1}, {$ref:'r1'}, {$ref:'r1'}] } }
const restored = restore(optimized);
expect(restored).toEqual(payload);
```

---

## Decompression / `restore()`

`restore()` auto-detects compressed forms and handles:

- `{ m, d }` (Abbreviated / Ultra Compact)
- `{ $s, $d }` (Schema Separation)
- `{ $r, d }` (Structural Deduplication)

So you can safely call `restore()` on payloads you received from an LLM.

---

## Future Work

Planned features include:

- YAML serialization pass for extra token savings in some contexts
- Data refinement (optional lossy rounding/pruning for floats and empty fields)
- Custom static dictionaries for domain-specific payloads

---

## Contributing

Contributions welcome — please open issues or PRs. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## License

MIT — see `LICENSE`
