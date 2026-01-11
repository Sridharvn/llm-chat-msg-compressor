# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-01-11

### Added

- Structural Deduplication strategy (`StructuralDeduplicationStrategy`) that detects repeated large subtrees and replaces them with a root-level registry (`$r`) and references (`$ref`).
- Opt-in **Data Refinement** preprocessor (configurable via `dataRefinement` in `optimize`) to round floats and prune empty/null fields for optional lossy savings.
- YAML final-pass serialization (`YamlStrategy`) available as a speculative pass (toggle with `yamlEnabled`).
- Temporary per-call `customDict` option on `optimize` for domain-specific static-DICT mappings.
- Multi-pass optimizer pipeline (Deduplication → Schema Separation → Abbreviated Keys → optional Ultra Compact → optional YAML) with speculative, token-aware acceptance per pass.
- `fastMode` / `fastSize` options to trade off latency versus compression when optimizing small payloads.
- Robust iterative (stack-based) traversals across strategies and the analyzer to avoid call stack overflows on deeply nested payloads.
- Static built-in dictionary for common LLM keys to reduce mapping overhead for frequent keys.
- Cycle detection (throws `Circular reference detected`) to prevent infinite loops on circular inputs.
- Scripts: `scripts/benchmark.ts` and `npm run bench` to run quick token/byte comparison benchmarks.

### Changed

- `optimize()` now uses token-aware validation that accepts transformations only when tokens or bytes decrease.
- `restore()` enhanced to auto-detect and handle `$r` (dedup) outputs and `$y` (YAML) in addition to existing `{m,d}` and `{$s,$d}` formats.
- README updated with usage examples, pipeline documentation, new options, and best-practices for YAML and Data Refinement.

### Fixed

- Preserve non-plain JS objects (like `Date`) as atomic values during transforms so JSON round-trips behave predictably.
- Ensure `UltraCompactStrategy` unsafe boolean normalization is applied consistently (post-pass normalization).

### Tests

- Added comprehensive tests covering strategies, fuzzing, deep nesting, pipeline behaviors and YAML/data refinement. All tests passing at time of entry.

## [1.0.0] - 2025-12-30

### Added

- Initial release of `llm-chat-msg-compressor`.
- Intelligent JSON compression strategies: Minify, Schema Separation, Abbreviated Keys, and Ultra Compact.
- Automatic strategy selection based on payload analysis.
- Safe-by-default restoration of original data.
- Support for aggressive and unsafe optimization modes.
- Comprehensive test suite including edge cases and fuzz testing.
