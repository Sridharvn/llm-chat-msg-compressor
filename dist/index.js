"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UltraCompactStrategy = exports.StructuralDeduplicationStrategy = exports.SchemaDataSeparationStrategy = exports.AbbreviatedKeysStrategy = exports.Analyzer = exports.Optimizer = void 0;
exports.optimize = optimize;
exports.restore = restore;
const optimizer_1 = require("./optimizer");
const strategies_1 = require("./strategies");
Object.defineProperty(exports, "AbbreviatedKeysStrategy", { enumerable: true, get: function () { return strategies_1.AbbreviatedKeysStrategy; } });
Object.defineProperty(exports, "SchemaDataSeparationStrategy", { enumerable: true, get: function () { return strategies_1.SchemaDataSeparationStrategy; } });
Object.defineProperty(exports, "StructuralDeduplicationStrategy", { enumerable: true, get: function () { return strategies_1.StructuralDeduplicationStrategy; } });
Object.defineProperty(exports, "UltraCompactStrategy", { enumerable: true, get: function () { return strategies_1.UltraCompactStrategy; } });
// Singleton instance for easy usage
const defaultOptimizer = new optimizer_1.Optimizer();
/**
 * Main entry point to optimize data
 */
function optimize(data, options) {
    return defaultOptimizer.optimize(data, options);
}
/**
 * Helper to decode data if you know the strategy used or if it follows the standard format
 * Note: Since our strategies produce different output structures (e.g. {m, d} or {$s, $d}),
 * we can auto-detect the strategy for decompression.
 */
function restore(data) {
    // Detect UltraCompact or AbbreviatedKeys format ({m: map, d: data})
    if (data && data.m && data.d) {
        // We don't distinguish between Abbreviated and UltraCompact in the structure easily
        // But the decompression logic is nearly identical: reverse map 'm' and traverse 'd'.
        // UltraCompact handles booleans specifically (input 1/0) but mapping logic is same.
        // We can reuse one decompressor for both if we accept the 1/0 values.
        // Let's use UltraCompact's decompressor as it's generic enough for the map pattern
        const strat = new strategies_1.UltraCompactStrategy();
        return strat.decompress(data);
    }
    // Detect Schema Separation format anywhere in the structure
    if (hasSchemaMarker(data)) {
        const strat = new strategies_1.SchemaDataSeparationStrategy();
        return strat.decompress(data);
    }
    // Detect Structural Deduplication format
    if (data && data.$r && data.d !== undefined) {
        const strat = new strategies_1.StructuralDeduplicationStrategy();
        return strat.decompress(data);
    }
    // Detect YAML serialized form
    if (data && data.$y && typeof data.$y === "string") {
        const { YamlStrategy } = require("./yamlStrategy");
        return new YamlStrategy().decompress(data);
    }
    // Default: return as is
    return data;
}
function hasSchemaMarker(obj) {
    if (!obj || typeof obj !== "object")
        return false;
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (hasSchemaMarker(obj[i]))
                return true;
        }
        return false;
    }
    if ("$s" in obj && "$d" in obj)
        return true;
    for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
            if (hasSchemaMarker(obj[k]))
                return true;
        }
    }
    return false;
}
var optimizer_2 = require("./optimizer");
Object.defineProperty(exports, "Optimizer", { enumerable: true, get: function () { return optimizer_2.Optimizer; } });
var analyzer_1 = require("./analyzer");
Object.defineProperty(exports, "Analyzer", { enumerable: true, get: function () { return analyzer_1.Analyzer; } });
