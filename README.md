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
- **🗂️ Static Dictionary**: Built-in static dictionary for common LLM keys and a fallback mechanism ensure mapping overhead is minimized for common payloads
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
- **Abbreviated Keys** — Maps frequently used long keys to short single-letter identifiers and includes a small map `m` when beneficial. Uses a built-in **static dictionary** and a heuristic (key length > 4 or frequency > 2) to avoid adding mapping overhead unnecessarily.
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

Short practical example:

```ts
// small payload: fastMode skips expensive dedup/schema passes for lower latency
const small = { messages: [{ role: "user", content: "Hi" }] };
const quick = optimize(small, { fastMode: true, fastSize: 1024 });

// larger payload or when you want maximum compression: disable fastMode
const repeated = { item: { long: "x".repeat(300) } };
const large = { items: [repeated, { other: 1 }, repeated, repeated] };
const thorough = optimize(large, { fastMode: false });

// In practice: `quick` will typically compress faster with fewer heavy passes,
// while `thorough` may apply deduplication/schema passes and yield better byte/token savings.
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
  yamlEnabled: true, // toggle final YAML pass (model/tokenizer dependent)
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
- `{ $y }` (YAML serialization)

`restore()` also consults the **static dictionary** (used by `AbbreviatedKeysStrategy`) as a fallback when a dynamic map `m` isn't present or doesn't contain a key. You can override or extend the static dictionary at runtime if you need domain-specific mappings:

```ts
import { AbbreviatedKeysStrategy } from "llm-chat-msg-compressor";
(AbbreviatedKeysStrategy as any).DICT = { auth: "a", message: "m" };
// Now decompression will map 'a' -> 'auth' and 'm' -> 'message' even if pkg.m is empty
```

So you can safely call `restore()` on payloads you received from an LLM.

---

## Future Work & Notes

Status:

- **YAML serialization pass**: implemented and available as a speculative final pass (toggle with `yamlEnabled`). Model/tokenizer dependent; validate with `validateTokenSavings`.
- **Data refinement**: implemented as an **opt-in** preprocessor (`dataRefinement` option on `optimize`) with configurable `precision` and `pruneEmpty`/`pruneNull` toggles.
- **Custom static dictionaries**: supported via `AbbreviatedKeysStrategy.DICT` (done).

Planned items:

- Performance benchmark scripts comparing JSON vs YAML vs combined approaches across tokenizers (see `scripts/benchmark.ts` and run with `npm run bench` to compare in your environment)
- Allow user-provided domain dictionaries via `optimize()` options (convenience wrapper)
- Additional lossy refinement heuristics (configurable)

---

## Contributing

Contributions welcome — please open issues or PRs. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## License

MIT — see `LICENSE`
