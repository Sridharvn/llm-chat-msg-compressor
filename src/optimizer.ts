import { CompressionStrategy, AbbreviatedKeysStrategy, SchemaDataSeparationStrategy, UltraCompactStrategy, minify } from './strategies';
import { Analyzer } from './analyzer';
import { TokenCounter } from './tokenizer';

export interface OptimizerOptions {
    aggressive?: boolean; // Use UltraCompact (lossy for types/readability, lossless for data)
    thresholdBytes?: number; // Minimum bytes to bother compressing
    unsafe?: boolean; // If true, allows lossy optimizations like bool->int (1/0)
    validateTokenSavings?: boolean; // If true, compares input/output tokens and returns original if output is larger
    tokenizer?: string | ((text: string) => number); // Encoding name, model name, or custom function
}

export class Optimizer {
    private schemaStrat = new SchemaDataSeparationStrategy();
    private abbrevStrat = new AbbreviatedKeysStrategy();
    private ultraStratSafe = new UltraCompactStrategy({ unsafe: false });
    private ultraStratUnsafe = new UltraCompactStrategy({ unsafe: true });

    private strategies: CompressionStrategy[] = [
        this.schemaStrat,
        this.ultraStratSafe,
        this.abbrevStrat
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
            tokenizer = 'cl100k_base'
        } = options;

        const metrics = Analyzer.analyze(data);

        // Helper to count tokens
        const countTokens = (val: any): number => {
            if (typeof tokenizer === 'function') {
                return tokenizer(typeof val === 'string' ? val : JSON.stringify(val));
            }
            return TokenCounter.count(val, tokenizer);
        };

        let result: any;

        // 1. If too small, just minify
        if (metrics.totalBytes < thresholdBytes) {
            result = minify.compress(data);
        } else {
            // 2. Smart Strategy Selection
            // Compare estimated savings to pick the winner.

            // Prefer SchemaSeparation if it saves MORE than AbbreviatedKeys (with a slight buffer for safety)
            // Schema Separation is "riskier" structure-wise (arrays vs maps), so we want it to be worth it.
            if (metrics.estimatedSchemaSavings > metrics.estimatedAbbrevSavings * 1.1) {
                result = this.schemaStrat.compress(data);
            } else if (aggressive) {
                // 3. Fallback to UltraCompact if aggressive is set
                result = unsafe ? this.ultraStratUnsafe.compress(data) : this.ultraStratSafe.compress(data);
            } else {
                // 4. Default: Abbreviated Keys
                // If Schema Separation isn't significantly better, we default to this.
                // It handles mixed/nested payloads better and is "safer" structure-wise.
                result = this.abbrevStrat.compress(data);
            }
        }

        // 5. Token Validation
        if (validateTokenSavings) {
            const inputTokens = countTokens(data);
            const outputTokens = countTokens(result);

            if (outputTokens > inputTokens) {
                return data; // Return original data if compression increased token count
            }
        }

        return result;
    }

    /**
     * Helper to get a specific strategy
     */
    getStrategy(name: string): CompressionStrategy | undefined {
        if (name === 'minify') return minify;
        if (name === 'schema-data-separation') return this.schemaStrat;
        if (name === 'abbreviated-keys') return this.abbrevStrat;
        if (name === 'ultra-compact') return this.ultraStratSafe; // Default to safe
        return undefined;
    }
}
