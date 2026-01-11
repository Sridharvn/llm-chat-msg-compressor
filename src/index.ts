import { Optimizer, OptimizerOptions } from "./optimizer";
import {
  CompressionStrategy,
  AbbreviatedKeysStrategy,
  SchemaDataSeparationStrategy,
  StructuralDeduplicationStrategy,
  UltraCompactStrategy,
  minify,
} from "./strategies";

// Singleton instance for easy usage
const defaultOptimizer = new Optimizer();

/**
 * Main entry point to optimize data
 */
export function optimize(data: any, options?: OptimizerOptions) {
  return defaultOptimizer.optimize(data, options);
}

/**
 * Helper to decode data if you know the strategy used or if it follows the standard format
 * Note: Since our strategies produce different output structures (e.g. {m, d} or {$s, $d}),
 * we can auto-detect the strategy for decompression.
 */
export function restore(data: any): any {
  // Detect UltraCompact or AbbreviatedKeys format ({m: map, d: data})
  if (data && data.m && data.d) {
    // We don't distinguish between Abbreviated and UltraCompact in the structure easily
    // But the decompression logic is nearly identical: reverse map 'm' and traverse 'd'.
    // UltraCompact handles booleans specifically (input 1/0) but mapping logic is same.
    // We can reuse one decompressor for both if we accept the 1/0 values.

    // Let's use UltraCompact's decompressor as it's generic enough for the map pattern
    const strat = new UltraCompactStrategy();
    return strat.decompress(data);
  }

  // Detect Schema Separation format anywhere in the structure
  if (hasSchemaMarker(data)) {
    const strat = new SchemaDataSeparationStrategy();
    return strat.decompress(data);
  }

  // Detect Structural Deduplication format
  if (data && data.$r && data.d !== undefined) {
    const strat = new StructuralDeduplicationStrategy();
    return strat.decompress(data);
  }

  // Default: return as is
  return data;
}

function hasSchemaMarker(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (hasSchemaMarker(obj[i])) return true;
    }
    return false;
  }
  if ("$s" in obj && "$d" in obj) return true;
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      if (hasSchemaMarker(obj[k])) return true;
    }
  }
  return false;
}

export { Optimizer } from "./optimizer";
export { Analyzer } from "./analyzer";
export {
  AbbreviatedKeysStrategy,
  SchemaDataSeparationStrategy,
  StructuralDeduplicationStrategy,
  UltraCompactStrategy,
};
