/**
 * Analyzer helper to gather metrics about the JSON payload
 */
export interface AnalysisMetrics {
    totalBytes: number;
    arrayDensity: number;
    maxExampleArrayLength: number;
    nestingDepth: number;
    repeatedKeysEstimate: number;
}
export declare class Analyzer {
    static analyze(data: any): AnalysisMetrics;
    /**
     * More specific check for Schema Separation suitability
     */
    static isSchemaSeparationSuitable(data: any): boolean;
}
