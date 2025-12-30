"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Optimizer = void 0;
const strategies_1 = require("./strategies");
const analyzer_1 = require("./analyzer");
class Optimizer {
    constructor() {
        this.strategies = [
            new strategies_1.SchemaDataSeparationStrategy(),
            new strategies_1.UltraCompactStrategy(),
            new strategies_1.AbbreviatedKeysStrategy()
        ];
    }
    /**
     * Automatically selects and applies the best compression strategy
     */
    optimize(data, options = {}) {
        const { aggressive = false, thresholdBytes = 500 // Increased default: small payloads often grow with key-map overhead
         } = options;
        const metrics = analyzer_1.Analyzer.analyze(data);
        // 1. If too small, just minify
        if (metrics.totalBytes < thresholdBytes) {
            console.log(`[Optimizer] Selected: minify (Size ${metrics.totalBytes} < ${thresholdBytes})`);
            return strategies_1.minify.compress(data);
        }
        // 2. Check for Schema Separation suitability (best for arrays)
        // It provides good savings with high readability compared to key replacement
        if (analyzer_1.Analyzer.isSchemaSeparationSuitable(data)) {
            console.log('[Optimizer] Selected: schema-data-separation');
            // If it's suitable, Schema Separation is usually the winner for structured data
            // But UltraCompact might still be smaller if deeply nested.
            // Let's implement a "Race" mode or heuristics.
            // For now, if suitable, use it as it's very effective for arrays
            const schemaStrat = new strategies_1.SchemaDataSeparationStrategy();
            return schemaStrat.compress(data);
        }
        // 3. Fallback to UltraCompact if aggressive is set
        if (aggressive) {
            const ultra = new strategies_1.UltraCompactStrategy();
            return ultra.compress(data);
        }
        // 4. Default safe optimization: Abbreviated Keys
        // Allows reversibility without risk of boolean confusion or aggressive map shortening
        const abbr = new strategies_1.AbbreviatedKeysStrategy();
        return abbr.compress(data);
    }
    /**
     * Helper to get a specific strategy
     */
    getStrategy(name) {
        if (name === 'minify')
            return strategies_1.minify;
        return this.strategies.find(s => s.name === name);
    }
}
exports.Optimizer = Optimizer;
