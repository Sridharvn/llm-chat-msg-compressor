/**
 * Analyzer helper to gather metrics about the JSON payload
 */
export interface AnalysisMetrics {
    totalBytes: number;
    arrayDensity: number; // Ratio of arrays to objects
    maxExampleArrayLength: number; // Max items in a single array
    nestingDepth: number;
    repeatedKeysEstimate: number; // Rough estimate of key repetition
    estimatedAbbrevSavings: number; // Bytes saved by AbbreviatedKeys
    estimatedSchemaSavings: number; // Bytes saved by SchemaSeparation
}

export class Analyzer {
    static analyze(data: any): AnalysisMetrics {
        const json = JSON.stringify(data);
        const totalBytes = Buffer.byteLength(json, 'utf8');

        let arrayCount = 0;
        let objectCount = 0;
        let maxArrLen = 0;
        let depth = 0;

        // Savings accumulators
        let totalKeyLength = 0;
        let totalKeysCount = 0;
        let schemaSavings = 0;

        // Helper to check schema suitability for a single array
        const calculateArraySchemaSavings = (arr: any[]): number => {
            if (arr.length < 3 || typeof arr[0] !== 'object' || arr[0] === null) return 0;

            // Check consistency of first few items
            const keys = Object.keys(arr[0]);
            const keyStr = keys.sort().join(',');
            const sample = arr.slice(0, 5); // Check first 5 for speed

            const isConsistent = sample.every(item =>
                item && typeof item === 'object' && !Array.isArray(item) &&
                Object.keys(item).sort().join(',') === keyStr
            );

            if (isConsistent) {
                // Savings = (Items - 1) * (Sum of key lengths + overhead)
                // Roughly: For N items, we write keys once instead of N times.
                // Savings ~= (N - 1) * (total_key_chars + (keys.length * 3 chars for quotes/colon))
                const keysLen = keys.reduce((sum, k) => sum + k.length, 0);
                const perItemOverhead = keysLen + (keys.length * 2); // quotes + colon approx
                return (arr.length - 1) * perItemOverhead;
            }
            return 0;
        };

        const traverse = (obj: any, currentDepth: number) => {
            depth = Math.max(depth, currentDepth);

            if (Array.isArray(obj)) {
                arrayCount++;
                maxArrLen = Math.max(maxArrLen, obj.length);

                // Check if this specific array offers schema savings
                schemaSavings += calculateArraySchemaSavings(obj);

                obj.forEach(i => traverse(i, currentDepth + 1));
            } else if (obj && typeof obj === 'object') {
                objectCount++;
                const keys = Object.keys(obj);
                totalKeysCount += keys.length;
                totalKeyLength += keys.reduce((sum, k) => sum + k.length, 0);

                Object.values(obj).forEach(v => traverse(v, currentDepth + 1));
            }
        };

        traverse(data, 0);

        // Estimate Abbreviation Savings
        // We replace AvgKeyLen with ShortKeyLen (approx 2 chars avg for small-med payloads)
        // Savings = TotalKeys * (AvgKeyLen - 2)
        // Overhead: We need to send the map! Map output is approx TotalUniqueKeys * (AvgKeyLen + 2)
        // Since we don't track unique keys efficiently here, let's assume worst case or strict ratio.
        // A simple heuristic: Savings is roughly half total key length if repetitive.
        // Let's be more precise:
        const avgKeyLen = totalKeysCount > 0 ? totalKeyLength / totalKeysCount : 0;
        const estimatedShortKeyLen = 2.5; // 'a', 'b', ... 'aa'
        // Rough estimate of unique keys: usually much smaller than total keys for compressed data.
        // Let's assume 20% distinct keys for a "compressible" workload.
        const estimatedMapOverhead = (totalKeysCount * 0.2) * (avgKeyLen + 3);

        const rawAbbrevSavings = totalKeysCount * (avgKeyLen - estimatedShortKeyLen);
        const estimatedAbbrevSavings = Math.max(0, rawAbbrevSavings - estimatedMapOverhead);

        return {
            totalBytes,
            arrayDensity: objectCount > 0 ? arrayCount / objectCount : 0,
            maxExampleArrayLength: maxArrLen,
            nestingDepth: depth,
            repeatedKeysEstimate: 0,
            estimatedAbbrevSavings,
            estimatedSchemaSavings: schemaSavings
        };
    }

    /**
     * @deprecated Use analyze() scores instead. Kept for backward compatibility if needed internally.
     */
    static isSchemaSeparationSuitable(data: any): boolean {
        const metrics = Analyzer.analyze(data);
        return metrics.estimatedSchemaSavings > 100; // Arbitrary threshold
    }
}
