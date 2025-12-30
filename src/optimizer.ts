import { CompressionStrategy, AbbreviatedKeysStrategy, SchemaDataSeparationStrategy, UltraCompactStrategy, minify } from './strategies';
import { Analyzer } from './analyzer';

export interface OptimizerOptions {
    aggressive?: boolean; // Use UltraCompact (lossy for types/readability, lossless for data)
    thresholdBytes?: number; // Minimum bytes to bother compressing
    unsafe?: boolean; // If true, allows lossy optimizations like bool->int (1/0)
}

export class Optimizer {
    private strategies: CompressionStrategy[] = [
        new SchemaDataSeparationStrategy(),
        new UltraCompactStrategy(),
        new AbbreviatedKeysStrategy()
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
            console.log(`[Optimizer] Selected: minify (Size ${metrics.totalBytes} < ${thresholdBytes})`);
            return minify.compress(data);
        }

        // 2. Smart Strategy Selection
        // Compare estimated savings to pick the winner.

        console.log(`[Optimizer] Analysis: SchemaSavings=${Math.round(metrics.estimatedSchemaSavings)} bytes, AbbrevSavings=${Math.round(metrics.estimatedAbbrevSavings)} bytes`);

        // Prefer SchemaSeparation if it saves MORE than AbbreviatedKeys (with a slight buffer for safety)
        // Schema Separation is "riskier" structure-wise (arrays vs maps), so we want it to be worth it.
        if (metrics.estimatedSchemaSavings > metrics.estimatedAbbrevSavings * 1.1) {
            console.log('[Optimizer] Selected: schema-data-separation (Higher savings)');
            const schemaStrat = new SchemaDataSeparationStrategy();
            return schemaStrat.compress(data);
        }

        // 3. Fallback to UltraCompact if aggressive is set
        if (aggressive) {
            console.log('[Optimizer] Selected: ultra-compact');
            const ultra = new UltraCompactStrategy({ unsafe });
            return ultra.compress(data);
        }

        // 4. Default: Abbreviated Keys
        // If Schema Separation isn't significantly better, we default to this.
        // It handles mixed/nested payloads better and is "safer" structure-wise.
        console.log('[Optimizer] Selected: abbreviated-keys');
        const abbr = new AbbreviatedKeysStrategy();
        return abbr.compress(data);
    }

    /**
     * Helper to get a specific strategy
     */
    getStrategy(name: string): CompressionStrategy | undefined {
        if (name === 'minify') return minify;
        return this.strategies.find(s => s.name === name);
    }
}
