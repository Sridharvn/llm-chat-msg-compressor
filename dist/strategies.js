"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UltraCompactStrategy = exports.SchemaDataSeparationStrategy = exports.AbbreviatedKeysStrategy = exports.minify = exports.generateShortKey = void 0;
/**
 * Shared utility for generating short keys (a, b, ... z, aa, ab ...)
 */
const generateShortKey = (index) => {
    let shortKey = '';
    let temp = index;
    do {
        shortKey = String.fromCharCode(97 + (temp % 26)) + shortKey;
        temp = Math.floor(temp / 26) - 1;
    } while (temp >= 0);
    return shortKey;
};
exports.generateShortKey = generateShortKey;
/**
 * Helper to check if value is a plain object
 */
const isPlainObject = (obj) => {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj) &&
        (Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null);
};
/**
 * Strategy 1: Minify (Baseline)
 * Just standard JSON serialization (handled by default JSON.stringify)
 * We include it for completeness in the strategy pattern
 */
exports.minify = {
    name: 'minify',
    compress: (data) => data, // No-op, just returns data to be JSON.stringified
    decompress: (data) => data,
};
/**
 * Strategy 2: Abbreviated Keys
 * Shortens keys based on a provided dictionary or auto-generated mapping
 * Note: This simple version uses a static map for demonstration.
 * A full version would generate the map dynamically and include it in the payload.
 */
class AbbreviatedKeysStrategy {
    constructor() {
        this.name = 'abbreviated-keys';
    }
    compress(data) {
        const keyMap = new Map();
        let counter = 0;
        const getShortKey = (key) => {
            let shortKey = keyMap.get(key);
            if (shortKey === undefined) {
                shortKey = (0, exports.generateShortKey)(counter++);
                keyMap.set(key, shortKey);
            }
            return shortKey;
        };
        const traverse = (obj) => {
            if (Array.isArray(obj)) {
                const newArr = new Array(obj.length);
                for (let i = 0; i < obj.length; i++) {
                    newArr[i] = traverse(obj[i]);
                }
                return newArr;
            }
            if (isPlainObject(obj)) {
                const newObj = {};
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
    decompress(pkg) {
        if (!pkg || !pkg.m || pkg.d === undefined)
            return pkg;
        const reverseMap = new Map();
        for (const k in pkg.m) {
            if (Object.prototype.hasOwnProperty.call(pkg.m, k)) {
                reverseMap.set(pkg.m[k], k);
            }
        }
        const traverse = (obj) => {
            if (Array.isArray(obj)) {
                const newArr = new Array(obj.length);
                for (let i = 0; i < obj.length; i++) {
                    newArr[i] = traverse(obj[i]);
                }
                return newArr;
            }
            if (isPlainObject(obj)) {
                const newObj = {};
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
exports.AbbreviatedKeysStrategy = AbbreviatedKeysStrategy;
/**
 * Strategy 3: Schema-Data Separation
 * Optimized for arrays of objects with same structure
 */
class SchemaDataSeparationStrategy {
    constructor() {
        this.name = 'schema-data-separation';
    }
    compress(data) {
        const traverse = (obj) => {
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
                        if (!allMatch)
                            break;
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
            if (isPlainObject(obj)) {
                const newObj = {};
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
    decompress(data) {
        const traverse = (obj) => {
            if (obj && typeof obj === 'object') {
                if (obj.$s && obj.$d && Array.isArray(obj.$s) && Array.isArray(obj.$d)) {
                    const keys = obj.$s;
                    const dataArr = obj.$d;
                    const result = new Array(dataArr.length);
                    for (let i = 0; i < dataArr.length; i++) {
                        const values = dataArr[i];
                        const item = {};
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
                if (isPlainObject(obj)) {
                    const newObj = {};
                    for (const k in obj) {
                        if (Object.prototype.hasOwnProperty.call(obj, k)) {
                            newObj[k] = traverse(obj[k]);
                        }
                    }
                    return newObj;
                }
            }
            return obj;
        };
        return traverse(data);
    }
}
exports.SchemaDataSeparationStrategy = SchemaDataSeparationStrategy;
/**
 * Strategy 4: Ultra Compact (Collision Safe)
 * Aggressive compression. Replaces boolean values and maps keys to minimal shortest strings.
 */
class UltraCompactStrategy {
    constructor(options = {}) {
        this.options = options;
        this.name = 'ultra-compact';
    }
    compress(data) {
        const keyMap = new Map();
        let counter = 0;
        const getShortKey = (key) => {
            let shortKey = keyMap.get(key);
            if (shortKey === undefined) {
                shortKey = (0, exports.generateShortKey)(counter++);
                keyMap.set(key, shortKey);
            }
            return shortKey;
        };
        const traverse = (obj) => {
            // Bool optimization: Only if unsafe mode is enabled
            if (this.options.unsafe) {
                if (obj === true)
                    return 1;
                if (obj === false)
                    return 0;
            }
            if (Array.isArray(obj)) {
                const newArr = new Array(obj.length);
                for (let i = 0; i < obj.length; i++) {
                    newArr[i] = traverse(obj[i]);
                }
                return newArr;
            }
            if (isPlainObject(obj)) {
                const newObj = {};
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
    decompress(pkg) {
        if (!pkg || !pkg.m || pkg.d === undefined)
            return pkg;
        const reverseMap = new Map();
        for (const k in pkg.m) {
            if (Object.prototype.hasOwnProperty.call(pkg.m, k)) {
                reverseMap.set(pkg.m[k], k);
            }
        }
        const traverse = (obj) => {
            if (Array.isArray(obj)) {
                const newArr = new Array(obj.length);
                for (let i = 0; i < obj.length; i++) {
                    newArr[i] = traverse(obj[i]);
                }
                return newArr;
            }
            if (isPlainObject(obj)) {
                const newObj = {};
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
exports.UltraCompactStrategy = UltraCompactStrategy;
