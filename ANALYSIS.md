# LLM Chat Message Compressor: Deep Analysis & Architectural Overview

## 1. Executive Summary

**llm-chat-msg-compressor** is a specialized smart compression library designed to minimize the size of JSON payloads sent to Large Language Models (LLMs). Unlike standard compression algorithms (gzip, brotli) which optimize for binary transport storage, `llm-chat-msg-compressor` optimizes for **token usage**. It restructures JSON conceptually to reduce repetitive keys effectively while maintaining a structure that LLMs can still parse or that can be easily restored before processing.

## 2. Core Architecture

The library is built around a **Strategy Pattern** orchestrated by an **Optimizer**.

### Key Components:

- **`Optimizer`**: The central brain. It analyzes the input data and selects the most appropriate compression strategy based on payload metrics (size, structure, repetition).
- **`Analyzer`**: A static helper that traverses the JSON to gather heuristics:
  - Total byte size.
  - Array density (ratio of arrays to objects).
  - Nesting depth.
  - Suitability for schema separation.
- **`Strategies`**: Pluggable implementations that define specific compression/decompression logic.
  1. **Minify** (Baseline)
  2. **Abbreviated Keys** (Structure preserving, key shortening)
  3. **Schema-Data Separation** (List optimization)
  4. **Ultra Compact** (Aggressive, lossy for types)

## 3. How It Works (The Flow)

1. **Input Analysis**: `Optimizer` calls `Analyzer.analyze(data)` to inspect the structure.
2. **Strategy Selection**:
   - **Micro-payloads** (< 500 bytes): Skipped (returns `minify`).
   - **Smart Scoring**: The Optimizer calculates **estimated savings** for both _Schema Data Separation_ and _Abbreviated Keys_.
     - `SchemaSavings` ≈ (Items - 1) \* KeyOverhead
     - `AbbrevSavings` ≈ TotalKeys \* (AvgKeyLen - ShortKeyLen)
   - **Decision**: Schema Separation is chosen only if its savings yield is significantly higher (> 10%) than Abbreviated Keys. This prevents it from being chosen for payloads where a small list is outweighed by a large, complex nested object.
   - **Aggressive Mode**: If enabled, **Ultra Compact** is forced.
   - **Default**: Falls back to **Abbreviated Keys**.
3. **Execution**: The chosen strategy transforms the JSON into a compressed variant.
4. **Restoration**: The `restore()` function automatically detects the format (checking for `$s`/`$d` keys or `m`/`d` keys) and reverses the process.

## 4. Deep Dive: Compression Strategies

### Strategy A: Abbreviated Keys

_Goal: Reduce token cost of repetitive long keys without changing data structure._

**Mechanism**:

- Creates a mapping of `Original Key -> Short Key` (e.g., `"userName"` -> `"a"`).
- Recursively traverses the object replacing all keys.
- **Output Format**: `{ m: { a: "userName" }, d: { ...data... } }`
- **Pros**: Lossless, easy to understand.
- **Cons**: Adds a "map" overhead, so only useful if keys repeat enough to justify the map.

### Strategy B: Schema-Data Separation (The "Columnar" Approach)

_Goal: Remove key repetition entirely for arrays of objects._

**Mechanism**:

- Identifies arrays where objects share the same keys (e.g., a list of users).
- Extracts keys into a single schema list `$s`.
- Converts objects into arrays of values `$d`.
- **Input**: `[{ id: 1, name: "A" }, { id: 2, name: "B" }]`
- **Output**:
  ```json
  {
    "$s": ["id", "name"],
    "$d": [
      [1, "A"],
      [2, "B"]
    ]
  }
  ```
- **Pros**: Massive reduction for long lists ( O(N\*K) -> O(N) tokens for keys).
- **Cons**: Less readable for humans; order of values becomes critical.

### Strategy C: Ultra Compact

_Goal: Maximum reduction at the cost of strict type fidelity._

**Mechanism**:

- **Key Shortening**: Same as Abbreviated Keys.
- **Boolean Optimization (Optional)**: If `{ unsafe: true }` is enabled, converts `true` -> `1`, `false` -> `0`.
- **Output Format**: `{ m: {...}, d: ... }`
- **Critical Note**: By default, this strategy is **safe** and fully reversible. If `unsafe` mode is enabled, `1/0` values will remain as numbers upon decompression, which technically changes the type from boolean to number.
- **Use Case**:
  - **Safe (Default)**: Use for high compression with guaranteed type fidelity.
  - **Unsafe**: Use when every token counts and the downstream LLM/consumer can handle `1`/`0` as booleans.

## 5. Implementation Details Checklist

### `src/analyzer.ts`

- **Heuristics**: Uses simple traversal to count objects/arrays.
- **Separation Check**: Checks if an array has at least 3 items and the first 3 match keys exactly to qualify for Schema Separation.

### `src/optimizer.ts`

- **Threshold**: Defaults to **500 bytes**.
- **Options**: Accepts `aggressive` (uses UltraCompact) and `unsafe` (enables lossy optimizations like boolean compression).
- **Priority**: Schema Separation is preferred over distinct keys approaches for better structure conservation.

### `src/strategies.ts`

- **AbbreviatedKeys**: Uses a base-26 generator (`a`, ... `aa`).
- **UltraCompact**: Reuses base-26 generator. Supports `unsafe: true` to convert booleans to integers. Includes robust handling for falsy primitive root values (e.g. valid `false` or `0` payloads).

## 6. Recommendations & Trade-offs

- **Use Schema Separation** for long lists of uniform objects. This is the "gold standard" for token efficiency in API responses.
- **Use Ultra Compact (Safe)** for complex, nested objects where you want maximum key compression without losing data types.
- **Use Ultra Compact (Unsafe)** ONLY if you need to squeeze out the last few bytes (approx. 3 bytes per boolean) and can tolerate fuzzy types (`1` instead of `true`).
