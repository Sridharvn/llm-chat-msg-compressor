"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Optimizer = void 0;
const strategies_1 = require("./strategies");
const analyzer_1 = require("./analyzer");
class Optimizer {
    constructor() {
        this.schemaStrat = new strategies_1.SchemaDataSeparationStrategy();
        this.abbrevStrat = new strategies_1.AbbreviatedKeysStrategy();
        this.ultraStratSafe = new strategies_1.UltraCompactStrategy({ unsafe: false });
        this.ultraStratUnsafe = new strategies_1.UltraCompactStrategy({ unsafe: true });
        this.strategies = [
            this.schemaStrat,
            this.ultraStratSafe,
            this.abbrevStrat
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
            return strategies_1.minify.compress(data);
        }
        // 2. Smart Strategy Selection
        // Compare estimated savings to pick the winner.
        // Prefer SchemaSeparation if it saves MORE than AbbreviatedKeys (with a slight buffer for safety)
        // Schema Separation is "riskier" structure-wise (arrays vs maps), so we want it to be worth it.
        if (metrics.estimatedSchemaSavings > metrics.estimatedAbbrevSavings * 1.1) {
            return this.schemaStrat.compress(data);
        }
        // 3. Fallback to UltraCompact if aggressive is set
        if (aggressive) {
            return unsafe ? this.ultraStratUnsafe.compress(data) : this.ultraStratSafe.compress(data);
        }
        // 4. Default: Abbreviated Keys
        // If Schema Separation isn't significantly better, we default to this.
        // It handles mixed/nested payloads better and is "safer" structure-wise.
        return this.abbrevStrat.compress(data);
    }
    /**
     * Helper to get a specific strategy
     */
    getStrategy(name) {
        if (name === 'minify')
            return strategies_1.minify;
        if (name === 'schema-data-separation')
            return this.schemaStrat;
        if (name === 'abbreviated-keys')
            return this.abbrevStrat;
        if (name === 'ultra-compact')
            return this.ultraStratSafe; // Default to safe
        return undefined;
    }
}
exports.Optimizer = Optimizer;
