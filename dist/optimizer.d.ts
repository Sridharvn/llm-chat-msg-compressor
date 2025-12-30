import { CompressionStrategy } from './strategies';
export interface OptimizerOptions {
    aggressive?: boolean;
    thresholdBytes?: number;
    unsafe?: boolean;
}
export declare class Optimizer {
    private schemaStrat;
    private abbrevStrat;
    private ultraStratSafe;
    private ultraStratUnsafe;
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
