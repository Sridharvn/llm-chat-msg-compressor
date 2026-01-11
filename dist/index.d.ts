import { OptimizerOptions } from "./optimizer";
import { AbbreviatedKeysStrategy, SchemaDataSeparationStrategy, StructuralDeduplicationStrategy, UltraCompactStrategy } from "./strategies";
/**
 * Main entry point to optimize data
 */
export declare function optimize(data: any, options?: OptimizerOptions): any;
/**
 * Helper to decode data if you know the strategy used or if it follows the standard format
 * Note: Since our strategies produce different output structures (e.g. {m, d} or {$s, $d}),
 * we can auto-detect the strategy for decompression.
 */
export declare function restore(data: any): any;
export { Optimizer } from "./optimizer";
export { Analyzer } from "./analyzer";
export { AbbreviatedKeysStrategy, SchemaDataSeparationStrategy, StructuralDeduplicationStrategy, UltraCompactStrategy, };
