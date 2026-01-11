import { CompressionStrategy } from "./strategies";
export interface OptimizerOptions {
    aggressive?: boolean;
    thresholdBytes?: number;
    unsafe?: boolean;
    validateTokenSavings?: boolean;
    tokenizer?: string | ((text: string) => number);
    fastMode?: boolean;
    fastSize?: number;
    dataRefinement?: {
        enabled?: boolean;
        precision?: number;
        pruneEmpty?: boolean;
        pruneNull?: boolean;
    };
    /**
     * Enable or disable the final YAML serialization pass. YAML serialization
     * can be tokenizer/model-dependent and may not always yield token savings;
     * enable it only when you want to experiment with YAML as a final pass.
     */
    yamlEnabled?: boolean;
    /**
     * Provide a temporary custom static dictionary to use for this optimize run.
     * This will be applied for the duration of the call and restored afterwards.
     */
    customDict?: Record<string, string>;
}
export declare class Optimizer {
    private schemaStrat;
    private abbrevStrat;
    private ultraStratSafe;
    private ultraStratUnsafe;
    private dedupStrat;
    private yamlStrat;
    private strategies;
    /**
     * Automatically selects and applies the best compression strategy
     */
    optimize(data: any, options?: OptimizerOptions): any;
    /**
     * Helper to get a specific strategy
     */
    getStrategy(name: string): CompressionStrategy | undefined;
}
