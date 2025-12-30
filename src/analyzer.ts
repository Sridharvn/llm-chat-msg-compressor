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

const isPlainObject = (obj: any): boolean => {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj) && 
           (Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null);
};

export class Analyzer {
    static analyze(data: any): AnalysisMetrics {
        // Pre-flight check for primitives or very small objects
        if (data === null || typeof data !== 'object') {
            return {
                totalBytes: data === undefined ? 0 : Buffer.byteLength(JSON.stringify(data), 'utf8'),
                arrayDensity: 0,
                maxExampleArrayLength: 0,
                nestingDepth: 0,
                repeatedKeysEstimate: 0,
                estimatedAbbrevSavings: 0,
                estimatedSchemaSavings: 0
            };
        }

        let totalBytes = 0;
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
            const firstItem = arr[0];
            const keys = Object.keys(firstItem);
            const keyCount = keys.length;
            if (keyCount === 0) return 0;

            const sampleSize = Math.min(arr.length, 5);
            let isConsistent = true;

            for (let i = 1; i < sampleSize; i++) {
                const item = arr[i];
                if (!item || typeof item !== 'object' || Array.isArray(item)) {
                    isConsistent = false;
                    break;
                }
                const itemKeys = Object.keys(item);
                if (itemKeys.length !== keyCount) {
                    isConsistent = false;
                    break;
                }
                // Check if all keys from first item exist in this item
                for (const key of keys) {
                    if (!(key in item)) {
                        isConsistent = false;
                        break;
                    }
                }
                if (!isConsistent) break;
            }

            if (isConsistent) {
                let keysLen = 0;
                for (const key of keys) {
                    keysLen += key.length;
                }
                const perItemOverhead = keysLen + (keyCount * 2); // quotes + colon approx
                const schemaArrayOverhead = keysLen + (keyCount * 3) + 10; // keys + quotes/commas + "$s":[]
                return Math.max(0, ((arr.length - 1) * perItemOverhead) - schemaArrayOverhead);
            }
            return 0;
        };

        const traverse = (obj: any, currentDepth: number) => {
            depth = Math.max(depth, currentDepth);

            if (Array.isArray(obj)) {
                arrayCount++;
                maxArrLen = Math.max(maxArrLen, obj.length);
                totalBytes += 2; // []
                if (obj.length > 1) totalBytes += obj.length - 1; // commas

                // Check if this specific array offers schema savings
                schemaSavings += calculateArraySchemaSavings(obj);

                for (let i = 0; i < obj.length; i++) {
                    traverse(obj[i], currentDepth + 1);
                }
            } else if (isPlainObject(obj)) {
                objectCount++;
                totalBytes += 2; // {}
                
                let first = true;
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        if (!first) totalBytes += 1; // comma
                        first = false;
                        
                        totalKeysCount++;
                        totalKeyLength += key.length;
                        totalBytes += key.length + 3; // "key":
                        traverse(obj[key], currentDepth + 1);
                    }
                }
            } else {
                // Primitive or non-plain object (Date, etc.)
                if (typeof obj === 'string') {
                    totalBytes += Buffer.byteLength(obj, 'utf8') + 2; // quotes
                } else if (typeof obj === 'number' || typeof obj === 'boolean') {
                    totalBytes += String(obj).length;
                } else if (obj instanceof Date) {
                    totalBytes += obj.toISOString().length + 2; // quotes
                } else if (obj === null) {
                    totalBytes += 4;
                } else {
                    // Fallback for other types that might be stringified
                    try {
                        const s = JSON.stringify(obj);
                        if (s) totalBytes += Buffer.byteLength(s, 'utf8');
                    } catch {
                        // Ignore if not stringifiable
                    }
                }
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
        const abbrevMetadataTax = 40; // { m: {}, d: } overhead
        const estimatedAbbrevSavings = Math.max(0, rawAbbrevSavings - estimatedMapOverhead - abbrevMetadataTax);

        const schemaMetadataTax = 30; // { $s: [], $d: [] } overhead
        const finalSchemaSavings = Math.max(0, schemaSavings - schemaMetadataTax);

        return {
            totalBytes,
            arrayDensity: objectCount > 0 ? arrayCount / objectCount : 0,
            maxExampleArrayLength: maxArrLen,
            nestingDepth: depth,
            repeatedKeysEstimate: 0,
            estimatedAbbrevSavings,
            estimatedSchemaSavings: finalSchemaSavings
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
