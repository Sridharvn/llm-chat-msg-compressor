"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Analyzer = void 0;
class Analyzer {
    static analyze(data) {
        const json = JSON.stringify(data);
        const totalBytes = Buffer.byteLength(json, 'utf8');
        // Simple heuristics
        let arrayCount = 0;
        let objectCount = 0;
        let maxArrLen = 0;
        let depth = 0;
        const traverse = (obj, currentDepth) => {
            depth = Math.max(depth, currentDepth);
            if (Array.isArray(obj)) {
                arrayCount++;
                maxArrLen = Math.max(maxArrLen, obj.length);
                obj.forEach(i => traverse(i, currentDepth + 1));
            }
            else if (obj && typeof obj === 'object') {
                objectCount++;
                Object.values(obj).forEach(v => traverse(v, currentDepth + 1));
            }
        };
        traverse(data, 0);
        // Estimate key repetition (very rough)
        // If we have many objects and few arrays, likely distinct keys or sparse.
        // If we have many arrays of objects, repetition is high.
        // Let's use array density as a proxy for "is_schema_separable"
        return {
            totalBytes,
            arrayDensity: objectCount > 0 ? arrayCount / objectCount : 0, // Not super useful directly
            maxExampleArrayLength: maxArrLen,
            nestingDepth: depth,
            repeatedKeysEstimate: 0 // Placeholder
        };
    }
    /**
     * More specific check for Schema Separation suitability
     */
    static isSchemaSeparationSuitable(data) {
        // Quick check: does it contain an array with > 5 objects?
        let suitable = false;
        const check = (obj) => {
            if (suitable)
                return;
            if (Array.isArray(obj)) {
                if (obj.length >= 3 && typeof obj[0] === 'object') {
                    // Check if first few have same keys
                    const keys = Object.keys(obj[0]).sort().join(',');
                    const match = obj.slice(0, 3).every(item => typeof item === 'object' && Object.keys(item).sort().join(',') === keys);
                    if (match)
                        suitable = true;
                }
                obj.forEach(check);
            }
            else if (obj && typeof obj === 'object') {
                Object.values(obj).forEach(check);
            }
        };
        check(data);
        return suitable;
    }
}
exports.Analyzer = Analyzer;
