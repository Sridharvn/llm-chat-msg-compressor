"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Optimizer = void 0;
const strategies_1 = require("./strategies");
const analyzer_1 = require("./analyzer");
const tokenizer_1 = require("./tokenizer");
class Optimizer {
    constructor() {
        this.schemaStrat = new strategies_1.SchemaDataSeparationStrategy();
        this.abbrevStrat = new strategies_1.AbbreviatedKeysStrategy();
        this.ultraStratSafe = new strategies_1.UltraCompactStrategy({ unsafe: false });
        this.ultraStratUnsafe = new strategies_1.UltraCompactStrategy({ unsafe: true });
        // Default pipeline (speculative): Deduplication -> Schema Separation -> Abbreviation -> YAML
        this.dedupStrat = new strategies_1.StructuralDeduplicationStrategy();
        this.yamlStrat = new (require("./yamlStrategy").YamlStrategy)();
        this.strategies = [
            this.dedupStrat,
            this.schemaStrat,
            this.abbrevStrat,
            this.yamlStrat,
        ];
    }
    /**
     * Automatically selects and applies the best compression strategy
     */
    optimize(data, options = {}) {
        const { aggressive = false, thresholdBytes = 1024, // Increased default: small payloads often grow with key-map overhead
        unsafe = false, validateTokenSavings = true, tokenizer = "cl100k_base", } = options;
        const metrics = analyzer_1.Analyzer.analyze(data);
        let current = data;
        const { yamlEnabled = true, customDict } = options;
        // If a custom dict was supplied for this run, temporarily override the static DICT
        const oldDict = strategies_1.AbbreviatedKeysStrategy.DICT;
        if (customDict) {
            strategies_1.AbbreviatedKeysStrategy.DICT = customDict;
        }
        // Ensure we restore DICT even if we return early or throw
        try {
            // Optional data refinement pre-processing (opt-in; lossy)
            if (options.dataRefinement && options.dataRefinement.enabled) {
                const { refineData } = require("./dataRefinement");
                current = refineData(current, {
                    precision: options.dataRefinement.precision,
                    pruneEmpty: options.dataRefinement.pruneEmpty,
                    pruneNull: options.dataRefinement.pruneNull,
                });
            }
            // Helper to count tokens
            const countTokens = (val) => {
                if (typeof tokenizer === "function") {
                    return tokenizer(typeof val === "string" ? val : JSON.stringify(val));
                }
                return tokenizer_1.TokenCounter.count(val, tokenizer);
            };
            // 1. If too small, just minify
            if (metrics.totalBytes < thresholdBytes) {
                return strategies_1.minify.compress(data);
            }
            // Fast mode: skip expensive passes for modest payloads
            const fastModeEnabled = options.fastMode !== undefined ? options.fastMode : true;
            // Default fastSize lowered to 512 bytes so that moderate payloads still get expensive passes
            const fastSize = options.fastSize !== undefined ? options.fastSize : 512;
            // Helper to apply one pass speculatively and accept only if token (or byte) savings
            const applySpeculative = (strategy) => {
                let candidate;
                try {
                    candidate = strategy.compress(current);
                }
                catch {
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
                }
                else {
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
            }
            else {
                // Fast mode and small payloads: still attempt Schema if Analyzer predicts significant savings
                if (metrics.estimatedSchemaSavings > 50 ||
                    metrics.estimatedSchemaSavings > metrics.estimatedAbbrevSavings) {
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
            // YAML serialization as a final speculative pass (may be model/tokenizer dependent)
            // This will produce an object like { $y: '<yaml-string>' } when accepted.
            if (yamlEnabled) {
                try {
                    applySpeculative(this.yamlStrat);
                }
                catch (e) {
                    // ignore YAML pass failures
                }
            }
            // Final validation: ensure we didn't increase tokens
            if (validateTokenSavings) {
                const inputTokens = countTokens(data);
                const outputTokens = countTokens(current);
                if (outputTokens > inputTokens)
                    return data;
            }
            return current;
        }
        finally {
            if (customDict) {
                // restore original DICT
                strategies_1.AbbreviatedKeysStrategy.DICT = oldDict;
            }
        }
    }
    /**
     * Helper to get a specific strategy
     */
    getStrategy(name) {
        if (name === "minify")
            return strategies_1.minify;
        if (name === "schema-data-separation")
            return this.schemaStrat;
        if (name === "abbreviated-keys")
            return this.abbrevStrat;
        if (name === "ultra-compact")
            return this.ultraStratSafe; // Default to safe
        return undefined;
    }
}
exports.Optimizer = Optimizer;
