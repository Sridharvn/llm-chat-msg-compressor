# LLM Chat Message Compressor - AI Coding Instructions

## Project Overview

This library optimizes JSON payloads for LLM APIs by reducing token usage through various compression strategies. It uses a Strategy Pattern orchestrated by an `Optimizer` and `Analyzer`.

## Core Architecture

- **Analyzer ([src/analyzer.ts](src/analyzer.ts))**: Calculates heuristics (size, density, depth) and estimates savings for strategies. It uses a single-pass traversal to estimate byte size and potential savings without full stringification.
- **Optimizer ([src/optimizer.ts](src/optimizer.ts))**: Selects the best strategy based on `Analyzer` metrics and user options (`aggressive`, `unsafe`, `thresholdBytes`). It defaults to `validateTokenSavings: true` to ensure compression doesn't increase token count.
  - **Smart Scoring**: Prefers `SchemaDataSeparationStrategy` if estimated savings are significant (>50 bytes or > Abbreviated savings).
  - **Micro-payloads**: Skips compression if payload is below `thresholdBytes` (default: 1024).
- **Strategies ([src/strategies.ts](src/strategies.ts))**:
  - `AbbreviatedKeysStrategy`: Maps keys to short strings (`{ m: map, d: data }`).
  - `SchemaDataSeparationStrategy`: Converts arrays of uniform objects to schema/data pairs (`{ $s: keys, $d: data }`).
  - `UltraCompactStrategy`: Aggressive key mapping; supports `unsafe` boolean-to-int conversion (1/0).
- **Entry Point ([src/index.ts](src/index.ts))**: Provides `optimize()` and `restore()`. `restore()` auto-detects strategy by inspecting structural markers (`m`, `$s`).

## Key Patterns & Conventions

- **Recursive Traversal**: Use the `traverse(obj: any): any` pattern within strategies to process nested structures.
- **Size Measurement**: Use `Buffer.byteLength(JSON.stringify(data), 'utf8')` for accurate byte size calculations.
- **Strategy Markers**:
  - Abbreviated/UltraCompact: `{ m: { ... }, d: ... }`
  - Schema Separation: `{ $s: [...], $d: [...] }`
- **Safe-by-Default**: Preserve data types (especially booleans) unless `unsafe: true` is explicitly passed.
- **Base-26 Keys**: Key shortening uses `generateShortKey` (base-26: `a`, `b`...`z`, `aa`...).
- **Token Counting**: Use `TokenCounter.count(data, encoding)` which wraps `js-tiktoken`.

## Development Workflows

- **Build**: `npm run build` (runs `tsc`).
- **Test**: `npm test` (runs `jest`).
- **Verify**: `npx ts-node verify.ts` to run a manual verification script with token savings analysis.
- **Adding a Strategy**:
  1. Implement `CompressionStrategy` interface in [src/strategies.ts](src/strategies.ts).
  2. Update `Optimizer` in [src/optimizer.ts](src/optimizer.ts) to include the new strategy in selection logic.
  3. Update `restore()` in [src/index.ts](src/index.ts) for auto-detection if the output structure is unique.

## Testing Guidelines

- **Round-trip Validation**: Every test should verify `restore(optimize(data)) === data` (semantic equality).
- **Edge Cases**: Test with empty arrays, null values, deeply nested objects, and heterogeneous arrays.
- **Token Savings**: Use `TokenCounter` to verify actual token count reductions. See [tests/token-validation.test.ts](tests/token-validation.test.ts) for examples.

## Example: Strategy Implementation

```typescript
const traverse = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(traverse);
  if (isPlainObject(obj)) {
    const newObj: any = {};
    for (const k in obj) {
      newObj[transformKey(k)] = traverse(obj[k]);
    }
    return newObj;
  }
  return obj;
};
```
