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
        const { aggressive = false, thresholdBytes = 500, // Increased default: small payloads often grow with key-map overhead
        unsafe = false } = options;
        const metrics = analyzer_1.Analyzer.analyze(data);
        // 1. If too small, just minify
        if (metrics.totalBytes < thresholdBytes) {
            console.log(`[Optimizer] Selected: minify (Size ${metrics.totalBytes} < ${thresholdBytes})`);
            return strategies_1.minify.compress(data);
        }
        // 2. Smart Strategy Selection
        // Compare estimated savings to pick the winner.
        console.log(`[Optimizer] Analysis: SchemaSavings=${Math.round(metrics.estimatedSchemaSavings)} bytes, AbbrevSavings=${Math.round(metrics.estimatedAbbrevSavings)} bytes`);
        // Prefer SchemaSeparation if it saves MORE than AbbreviatedKeys (with a slight buffer for safety)
        // Schema Separation is "riskier" structure-wise (arrays vs maps), so we want it to be worth it.
        if (metrics.estimatedSchemaSavings > metrics.estimatedAbbrevSavings * 1.1) {
            console.log('[Optimizer] Selected: schema-data-separation (Higher savings)');
            const schemaStrat = new strategies_1.SchemaDataSeparationStrategy();
            return schemaStrat.compress(data);
        }
        // 3. Fallback to UltraCompact if aggressive is set
        if (aggressive) {
            console.log('[Optimizer] Selected: ultra-compact');
            const ultra = new strategies_1.UltraCompactStrategy({ unsafe });
            return ultra.compress(data);
        }
        // 4. Default: Abbreviated Keys
        // If Schema Separation isn't significantly better, we default to this.
        // It handles mixed/nested payloads better and is "safer" structure-wise.
        console.log('[Optimizer] Selected: abbreviated-keys');
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
