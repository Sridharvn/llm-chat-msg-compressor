/**
 * Compression Strategy Interface
 */
export interface CompressionStrategy {
    name: string;
    compress(data: any): any;
    decompress(data: any): any;
}

/**
 * Strategy 1: Minify (Baseline)
 * Just standard JSON serialization (handled by default JSON.stringify)
 * We include it for completeness in the strategy pattern
 */
export const minify: CompressionStrategy = {
    name: 'minify',
    compress: (data: any) => data, // No-op, just returns data to be JSON.stringified
    decompress: (data: any) => data,
};

/**
 * Strategy 2: Abbreviated Keys
 * Shortens keys based on a provided dictionary or auto-generated mapping
 * Note: This simple version uses a static map for demonstration. 
 * A full version would generate the map dynamically and include it in the payload.
 */
export class AbbreviatedKeysStrategy implements CompressionStrategy {
    name = 'abbreviated-keys';

    compress(data: any): any {
        // Implementation that returns { m: map, d: data }
        const keyMap = new Map<string, string>();
        const reverseMap = new Map<string, string>();
        let counter = 0;

        const getShortKey = (key: string) => {
            if (!keyMap.has(key)) {
                let shortKey = '';
                let temp = counter++;
                do {
                    shortKey = String.fromCharCode(97 + (temp % 26)) + shortKey;
                    temp = Math.floor(temp / 26) - 1;
                } while (temp >= 0);
                keyMap.set(key, shortKey);
                reverseMap.set(shortKey, key);
            }
            return keyMap.get(key)!;
        };

        const traverse = (obj: any): any => {
            if (Array.isArray(obj)) return obj.map(traverse);
            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const k in obj) {
                    newObj[getShortKey(k)] = traverse(obj[k]);
                }
                return newObj;
            }
            return obj;
        };

        const compressedData = traverse(data);
        return {
            m: Object.fromEntries(keyMap),
            d: compressedData
        };
    }

    decompress(pkg: any): any {
        if (!pkg || !pkg.m || pkg.d === undefined) return pkg;

        const reverseMap = new Map<string, string>();
        for (const [k, v] of Object.entries(pkg.m)) {
            reverseMap.set(v as string, k);
        }

        const traverse = (obj: any): any => {
            if (Array.isArray(obj)) return obj.map(traverse);
            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const k in obj) {
                    const originalKey = reverseMap.get(k) || k;
                    newObj[originalKey] = traverse(obj[k]);
                }
                return newObj;
            }
            return obj;
        };

        return traverse(pkg.d);
    }
}

/**
 * Strategy 3: Schema-Data Separation
 * Optimized for arrays of objects with same structure
 */
export class SchemaDataSeparationStrategy implements CompressionStrategy {
    name = 'schema-data-separation';

    compress(data: any): any {
        const traverse = (obj: any): any => {
            if (Array.isArray(obj)) {
                // Check if it's an array of objects
                if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null && !Array.isArray(obj[0])) {
                    const keys = Object.keys(obj[0]);
                    const allMatch = obj.every(item =>
                        typeof item === 'object' &&
                        item !== null &&
                        !Array.isArray(item) &&
                        JSON.stringify(Object.keys(item).sort()) === JSON.stringify(keys.sort())
                    );

                    if (allMatch) {
                        return {
                            $s: keys, // Schema
                            $d: obj.map(item => keys.map(k => traverse(item[k]))) // Data
                        };
                    }
                }
                return obj.map(traverse);
            }

            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const k in obj) {
                    newObj[k] = traverse(obj[k]);
                }
                return newObj;
            }
            return obj;
        };

        return traverse(data);
    }

    decompress(data: any): any {
        const traverse = (obj: any): any => {
            if (obj && typeof obj === 'object') {
                if (obj.$s && obj.$d && Array.isArray(obj.$s) && Array.isArray(obj.$d)) {
                    const keys = obj.$s;
                    return obj.$d.map((values: any[]) => {
                        const item: any = {};
                        keys.forEach((k: string, i: number) => {
                            item[k] = traverse(values[i]);
                        });
                        return item;
                    });
                }

                if (Array.isArray(obj)) return obj.map(traverse);

                const newObj: any = {};
                for (const k in obj) {
                    newObj[k] = traverse(obj[k]);
                }
                return newObj;
            }
            return obj;
        };

        return traverse(data);
    }
}

/**
 * Strategy 4: Ultra Compact (Collision Safe)
 * Aggressive compression. Replaces boolean values and maps keys to minimal shortest strings.
 */
export class UltraCompactStrategy implements CompressionStrategy {
    name = 'ultra-compact';

    constructor(private options: { unsafe?: boolean } = {}) { }

    compress(data: any): any {
        const keyMap = new Map<string, string>();
        let counter = 0;

        const getShortKey = (key: string) => {
            if (!keyMap.has(key)) {
                let shortKey = '';
                let temp = counter++;
                do {
                    shortKey = String.fromCharCode(97 + (temp % 26)) + shortKey;
                    temp = Math.floor(temp / 26) - 1;
                } while (temp >= 0);
                keyMap.set(key, shortKey);
            }
            return keyMap.get(key)!;
        };

        const traverse = (obj: any): any => {
            // Bool optimization: Only if unsafe mode is enabled
            if (this.options.unsafe) {
                if (obj === true) return 1;
                if (obj === false) return 0;
            }

            if (Array.isArray(obj)) return obj.map(traverse);

            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const k in obj) {
                    newObj[getShortKey(k)] = traverse(obj[k]);
                }
                return newObj;
            }
            return obj;
        };

        const compressedData = traverse(data);

        return {
            m: Object.fromEntries(keyMap),
            d: compressedData
        };
    }

    decompress(pkg: any): any {
        if (!pkg || !pkg.m || pkg.d === undefined) return pkg;

        const reverseMap = new Map<string, string>();
        for (const [k, v] of Object.entries(pkg.m)) {
            reverseMap.set(v as string, k);
        }

        const traverse = (obj: any): any => {
            // Removed automatic 1->true conversion to avoid corrupting numbers
            // if (obj === 1) return true; 
            // NOTE: Ultra Compact assumes usage where boolean restoration is preferred. 
            // Strictly speaking, we lose type info between 1 and true if we just blindly map.
            // For LLM context, usually 1/0 is fine. But for exact restoration, this is lossy for numbers.
            // Let's make it smarter: logic handled by downstream consumers or accept fuzzy types.
            // For now, let's NOT automatically convert 1->true to keep it safer, 
            // unless we store type info effectively. 
            // Actually, for LLM optimization, sending 1/0 is enough. 
            // If we want exact restoration, we need a schema.
            // Let's stick to key restoration for now, and leave values as is (1/0) or maybe keep booleans as is if size diff is minimal? 
            // "true" is 4 bytes, "1" is 1 byte. 
            // If we want to support full roundtrip without schema, we might skip bool optimization OR live with the type change.
            // Let's keep 1/0 and NOT restore to boolean automatically to avoid corrupting actual numbers. 
            // The user will receive 1/0 instead of true/false.

            if (Array.isArray(obj)) return obj.map(traverse);
            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const k in obj) {
                    const originalKey = reverseMap.get(k) || k;
                    newObj[originalKey] = traverse(obj[k]);
                }
                return newObj;
            }
            return obj;
        };

        return traverse(pkg.d);
    }
}
