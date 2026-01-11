import {
  CompressionStrategy,
  AbbreviatedKeysStrategy,
  SchemaDataSeparationStrategy,
  StructuralDeduplicationStrategy,
  UltraCompactStrategy,
  minify,
} from "./strategies";
import { Analyzer } from "./analyzer";
import { TokenCounter } from "./tokenizer";

export interface OptimizerOptions {
  aggressive?: boolean; // Use UltraCompact (lossy for types/readability, lossless for data)
  thresholdBytes?: number; // Minimum bytes to bother compressing
  unsafe?: boolean; // If true, allows lossy optimizations like bool->int (1/0)
  validateTokenSavings?: boolean; // If true, compares input/output tokens and returns original if output is larger
  tokenizer?: string | ((text: string) => number); // Encoding name, model name, or custom function
  fastMode?: boolean; // If true, skip expensive passes for small payloads
  fastSize?: number; // Threshold in bytes for fast mode
}

export class Optimizer {
  private schemaStrat = new SchemaDataSeparationStrategy();
  private abbrevStrat = new AbbreviatedKeysStrategy();
  private ultraStratSafe = new UltraCompactStrategy({ unsafe: false });
  private ultraStratUnsafe = new UltraCompactStrategy({ unsafe: true });

  // Default pipeline (speculative): Deduplication -> Schema Separation -> Abbreviation
  private dedupStrat = new StructuralDeduplicationStrategy();

  private strategies: CompressionStrategy[] = [
    this.dedupStrat,
    this.schemaStrat,
    this.abbrevStrat,
  ];

  /**
   * Automatically selects and applies the best compression strategy
   */
  optimize(data: any, options: OptimizerOptions = {}) {
    const {
      aggressive = false,
      thresholdBytes = 1024, // Increased default: small payloads often grow with key-map overhead
      unsafe = false,
      validateTokenSavings = true,
      tokenizer = "cl100k_base",
    } = options;

    const metrics = Analyzer.analyze(data);

    // Helper to count tokens
    const countTokens = (val: any): number => {
      if (typeof tokenizer === "function") {
        return tokenizer(typeof val === "string" ? val : JSON.stringify(val));
      }
      return TokenCounter.count(val, tokenizer);
    };

    let current: any = data;

    // 1. If too small, just minify
    if (metrics.totalBytes < thresholdBytes) {
      return minify.compress(data);
    }

    // Fast mode: skip expensive passes for modest payloads
    const fastModeEnabled =
      options.fastMode !== undefined ? options.fastMode : true;
    // Default fastSize lowered to 512 bytes so that moderate payloads still get expensive passes
    const fastSize = options.fastSize !== undefined ? options.fastSize : 512;

    // Helper to apply one pass speculatively and accept only if token (or byte) savings
    const applySpeculative = (strategy: CompressionStrategy): boolean => {
      let candidate: any;
      try {
        candidate = strategy.compress(current);
      } catch {
        return false; // if strategy cannot handle the input, skip
      }

      const beforeBytes = Buffer.byteLength(JSON.stringify(current), "utf8");
      const afterBytes = Buffer.byteLength(JSON.stringify(candidate), "utf8");

      if (validateTokenSavings) {
        const before = countTokens(current);
        const after = countTokens(candidate);
        // Accept if token count decreased OR byte size decreased
        if (after < before || afterBytes < beforeBytes) {
          current = candidate;
          return true;
        }
        return false;
      } else {
        if (afterBytes < beforeBytes) {
          current = candidate;
          return true;
        }
        return false;
      }
    };

    // Pipeline: Dedup -> Schema -> Abbrev.
    // Skip dedup for small payloads in fast mode, but still allow Schema if Analyzer recommends it.
    if (!fastModeEnabled || metrics.totalBytes >= fastSize) {
      // Deduplication
      applySpeculative(this.dedupStrat);

      // Schema separation
      applySpeculative(this.schemaStrat);
    } else {
      // Fast mode and small payloads: still attempt Schema if Analyzer predicts significant savings
      if (
        metrics.estimatedSchemaSavings > 50 ||
        metrics.estimatedSchemaSavings > metrics.estimatedAbbrevSavings
      ) {
        applySpeculative(this.schemaStrat);
      }
    }

    // Abbreviated Keys pass (lightweight) always attempted
    applySpeculative(this.abbrevStrat);
    // If aggressive was requested and no previous pass converted to Ultra, apply UltraCompact (unsafe uses provided flag)
    if (aggressive) {
      const strat = unsafe ? this.ultraStratUnsafe : this.ultraStratSafe;
      applySpeculative(strat);
    }

    // Final validation: ensure we didn't increase tokens
    if (validateTokenSavings) {
      const inputTokens = countTokens(data);
      const outputTokens = countTokens(current);
      if (outputTokens > inputTokens) return data;
    }

    return current;
  }

  /**
   * Helper to get a specific strategy
   */
  getStrategy(name: string): CompressionStrategy | undefined {
    if (name === "minify") return minify;
    if (name === "schema-data-separation") return this.schemaStrat;
    if (name === "abbreviated-keys") return this.abbrevStrat;
    if (name === "ultra-compact") return this.ultraStratSafe; // Default to safe
    return undefined;
  }
}
