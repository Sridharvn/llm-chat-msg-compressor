/**
 * Compression Strategy Interface
 */
export interface CompressionStrategy {
    name: string;
    compress(data: any): any;
    decompress(data: any): any;
}

/**
 * Shared utility for generating short keys (a, b, ... z, aa, ab ...)
 */
export const generateShortKey = (index: number): string => {
    let shortKey = '';
    let temp = index;
    do {
        shortKey = String.fromCharCode(97 + (temp % 26)) + shortKey;
        temp = Math.floor(temp / 26) - 1;
    } while (temp >= 0);
    return shortKey;
};

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
        const keyMap = new Map<string, string>();
        let counter = 0;

        const getShortKey = (key: string) => {
            let shortKey = keyMap.get(key);
            if (shortKey === undefined) {
                shortKey = generateShortKey(counter++);
                keyMap.set(key, shortKey);
            }
            return shortKey;
        };

        const traverse = (obj: any): any => {
            if (Array.isArray(obj)) {
                const newArr = new Array(obj.length);
                for (let i = 0; i < obj.length; i++) {
                    newArr[i] = traverse(obj[i]);
                }
                return newArr;
            }
            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const k in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, k)) {
                        newObj[getShortKey(k)] = traverse(obj[k]);
                    }
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
        for (const k in pkg.m) {
            if (Object.prototype.hasOwnProperty.call(pkg.m, k)) {
                reverseMap.set(pkg.m[k], k);
            }
        }

        const traverse = (obj: any): any => {
            if (Array.isArray(obj)) {
                const newArr = new Array(obj.length);
                for (let i = 0; i < obj.length; i++) {
                    newArr[i] = traverse(obj[i]);
                }
                return newArr;
            }
            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const k in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, k)) {
                        const originalKey = reverseMap.get(k) || k;
                        newObj[originalKey] = traverse(obj[k]);
                    }
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
                    const firstItem = obj[0];
                    const keys = Object.keys(firstItem);
                    const keyCount = keys.length;
                    
                    let allMatch = true;
                    for (let i = 1; i < obj.length; i++) {
                        const item = obj[i];
                        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                            allMatch = false;
                            break;
                        }
                        const itemKeys = Object.keys(item);
                        if (itemKeys.length !== keyCount) {
                            allMatch = false;
                            break;
                        }
                        for (const key of keys) {
                            if (!(key in item)) {
                                allMatch = false;
                                break;
                            }
                        }
                        if (!allMatch) break;
                    }

                    if (allMatch) {
                        return {
                            $s: keys, // Schema
                            $d: obj.map(item => keys.map(k => traverse(item[k]))) // Data
                        };
                    }
                }
                
                const newArr = new Array(obj.length);
                for (let i = 0; i < obj.length; i++) {
                    newArr[i] = traverse(obj[i]);
                }
                return newArr;
            }

            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const k in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, k)) {
                        newObj[k] = traverse(obj[k]);
                    }
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
                    const dataArr = obj.$d;
                    const result = new Array(dataArr.length);
                    
                    for (let i = 0; i < dataArr.length; i++) {
                        const values = dataArr[i];
                        const item: any = {};
                        for (let j = 0; j < keys.length; j++) {
                            item[keys[j]] = traverse(values[j]);
                        }
                        result[i] = item;
                    }
                    return result;
                }

                if (Array.isArray(obj)) {
                    const newArr = new Array(obj.length);
                    for (let i = 0; i < obj.length; i++) {
                        newArr[i] = traverse(obj[i]);
                    }
                    return newArr;
                }

                const newObj: any = {};
                for (const k in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, k)) {
                        newObj[k] = traverse(obj[k]);
                    }
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
            let shortKey = keyMap.get(key);
            if (shortKey === undefined) {
                shortKey = generateShortKey(counter++);
                keyMap.set(key, shortKey);
            }
            return shortKey;
        };

        const traverse = (obj: any): any => {
            // Bool optimization: Only if unsafe mode is enabled
            if (this.options.unsafe) {
                if (obj === true) return 1;
                if (obj === false) return 0;
            }

            if (Array.isArray(obj)) {
                const newArr = new Array(obj.length);
                for (let i = 0; i < obj.length; i++) {
                    newArr[i] = traverse(obj[i]);
                }
                return newArr;
            }

            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const k in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, k)) {
                        newObj[getShortKey(k)] = traverse(obj[k]);
                    }
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
        for (const k in pkg.m) {
            if (Object.prototype.hasOwnProperty.call(pkg.m, k)) {
                reverseMap.set(pkg.m[k], k);
            }
        }

        const traverse = (obj: any): any => {
            if (Array.isArray(obj)) {
                const newArr = new Array(obj.length);
                for (let i = 0; i < obj.length; i++) {
                    newArr[i] = traverse(obj[i]);
                }
                return newArr;
            }
            if (obj && typeof obj === 'object') {
                const newObj: any = {};
                for (const k in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, k)) {
                        const originalKey = reverseMap.get(k) || k;
                        newObj[originalKey] = traverse(obj[k]);
                    }
                }
                return newObj;
            }
            return obj;
        };

        return traverse(pkg.d);
    }
}
