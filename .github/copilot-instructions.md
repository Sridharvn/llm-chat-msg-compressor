# LLM Chat Message Compressor - AI Coding Instructions

## Project Overview

This library optimizes JSON payloads for LLM APIs by reducing token usage through various compression strategies. It uses a Strategy Pattern orchestrated by an `Optimizer` and `Analyzer`.

## Core Architecture

- **Analyzer (`src/analyzer.ts`)**: Calculates heuristics (size, density, depth) and estimates savings for strategies.
- **Optimizer (`src/optimizer.ts`)**: Selects the best strategy based on `Analyzer` metrics and user options (`aggressive`, `unsafe`, `thresholdBytes`).
- **Strategies (`src/strategies.ts`)**:
  - `AbbreviatedKeysStrategy`: Maps keys to short strings (`{ m: map, d: data }`).
  - `SchemaDataSeparationStrategy`: Converts arrays of uniform objects to schema/data pairs (`{ $s: keys, $d: data }`).
  - `UltraCompactStrategy`: Aggressive key mapping; supports `unsafe` boolean-to-int conversion.
- **Entry Point (`src/index.ts`)**: Provides `optimize()` and `restore()`. `restore()` auto-detects strategy by inspecting structural markers (`m`, `$s`).

## Key Patterns & Conventions

- **Recursive Traversal**: Use the `traverse(obj: any): any` pattern within strategies to process nested structures.
- **Size Measurement**: Always use `Buffer.byteLength(JSON.stringify(data), 'utf8')` for accurate byte size calculations.
- **Strategy Markers**:
  - Abbreviated/UltraCompact: `{ m: { ... }, d: ... }`
  - Schema Separation: `{ $s: [...], $d: [...] }`
- **Safe-by-Default**: Preserve data types (especially booleans) unless `unsafe: true` is explicitly passed.
- **Base-26 Keys**: Key shortening uses a base-26 generator (`a`, `b`...`z`, `aa`...).

## Development Workflows

- **Build**: `npm run build` (runs `tsc`).
- **Test**: `npm test` (runs `jest`).
- **Verify**: `npx ts-node verify.ts` to run a manual verification script with token savings analysis.
- **Adding a Strategy**:
  1. Implement `CompressionStrategy` interface in `src/strategies.ts`.
  2. Update `Optimizer` in `src/optimizer.ts` to include the new strategy in selection logic.
  3. Update `restore()` in `src/index.ts` for auto-detection if the output structure is unique.

## Testing Guidelines

- **Round-trip Validation**: Every test should verify `restore(optimize(data)) === data` (semantic equality).
- **Edge Cases**: Test with empty arrays, null values, deeply nested objects, and heterogeneous arrays.
- **Token Savings**: Use `gpt-3-encoder` (already in `devDependencies`) to verify actual token count reductions. See `verify.ts` for an example.

## Example: Strategy Implementation

```typescript
const traverse = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(traverse);
  if (obj && typeof obj === "object") {
    const newObj: any = {};
    for (const k in obj) {
      newObj[transformKey(k)] = traverse(obj[k]);
    }
    return newObj;
  }
  return obj;
};
```
