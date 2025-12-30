/**
 * Analyzer helper to gather metrics about the JSON payload
 */
export interface AnalysisMetrics {
    totalBytes: number;
    arrayDensity: number;
    maxExampleArrayLength: number;
    nestingDepth: number;
    repeatedKeysEstimate: number;
    estimatedAbbrevSavings: number;
    estimatedSchemaSavings: number;
}
export declare class Analyzer {
    static analyze(data: any): AnalysisMetrics;
    /**
     * @deprecated Use analyze() scores instead. Kept for backward compatibility if needed internally.
     */
    static isSchemaSeparationSuitable(data: any): boolean;
}
