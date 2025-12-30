import { CompressionStrategy, AbbreviatedKeysStrategy, SchemaDataSeparationStrategy, UltraCompactStrategy, minify } from './strategies';
import { Analyzer } from './analyzer';

export interface OptimizerOptions {
    aggressive?: boolean; // Use UltraCompact (lossy for types/readability, lossless for data)
    thresholdBytes?: number; // Minimum bytes to bother compressing
    unsafe?: boolean; // If true, allows lossy optimizations like bool->int (1/0)
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
            thresholdBytes = 500, // Increased default: small payloads often grow with key-map overhead
            unsafe = false
        } = options;

        const metrics = Analyzer.analyze(data);

        // 1. If too small, just minify
        if (metrics.totalBytes < thresholdBytes) {
            return minify.compress(data);
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
    getStrategy(name: string): CompressionStrategy | undefined {
        if (name === 'minify') return minify;
        if (name === 'schema-data-separation') return this.schemaStrat;
        if (name === 'abbreviated-keys') return this.abbrevStrat;
        if (name === 'ultra-compact') return this.ultraStratSafe; // Default to safe
        return undefined;
    }
}
