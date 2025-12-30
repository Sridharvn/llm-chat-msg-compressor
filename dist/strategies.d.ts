/**
 * Compression Strategy Interface
 */
export interface CompressionStrategy {
    name: string;
    compress(data: any): any;
    decompress(data: any): any;
}
/**
 * Shared utility for generating short keys (a, b, ... z, aa, ab ...)
 */
export declare const generateShortKey: (index: number) => string;
/**
 * Strategy 1: Minify (Baseline)
 * Just standard JSON serialization (handled by default JSON.stringify)
 * We include it for completeness in the strategy pattern
 */
export declare const minify: CompressionStrategy;
/**
 * Strategy 2: Abbreviated Keys
 * Shortens keys based on a provided dictionary or auto-generated mapping
 * Note: This simple version uses a static map for demonstration.
 * A full version would generate the map dynamically and include it in the payload.
 */
export declare class AbbreviatedKeysStrategy implements CompressionStrategy {
    name: string;
    compress(data: any): any;
    decompress(pkg: any): any;
}
/**
 * Strategy 3: Schema-Data Separation
 * Optimized for arrays of objects with same structure
 */
export declare class SchemaDataSeparationStrategy implements CompressionStrategy {
    name: string;
    compress(data: any): any;
    decompress(data: any): any;
}
/**
 * Strategy 4: Ultra Compact (Collision Safe)
 * Aggressive compression. Replaces boolean values and maps keys to minimal shortest strings.
 */
export declare class UltraCompactStrategy implements CompressionStrategy {
    private options;
    name: string;
    constructor(options?: {
        unsafe?: boolean;
    });
    compress(data: any): any;
    decompress(pkg: any): any;
}
