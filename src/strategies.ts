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
 * Helper to check if value is a plain object
 */
const isPlainObject = (obj: any): boolean => {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj) && 
           (Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null);
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

        // Iterative transform to avoid recursion
        const transform = (root: any): any => {
            if (root === null || typeof root !== 'object') return root;

            const rootDst = Array.isArray(root) ? new Array(root.length) : {} as any;
            const stack: Array<{ src: any; dst: any }> = [{ src: root, dst: rootDst }];
            const visited = new WeakSet();

            while (stack.length > 0) {
                const frame = stack.pop()!;
                const src = frame.src;

                // Cycle detection
                if (src && typeof src === 'object') {
                    if (visited.has(src)) throw new Error('Circular reference detected');
                    visited.add(src);
                }

                const dst = frame.dst;

                if (Array.isArray(src)) {
                    for (let i = 0; i < src.length; i++) {
                        const val = src[i];
                        if (val === null || typeof val !== 'object') {
                            dst[i] = val;
                        } else {
                            dst[i] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[i] });
                        }
                    }
                } else {
                    const keys = Object.keys(src);
                    for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        const short = getShortKey(k);
                        const val = src[k];
                        // Treat non-plain objects (Date, RegExp, etc.) as atomic values
                        if (val === null || typeof val !== 'object' || !isPlainObject(val)) {
                            dst[short] = val;
                        } else {
                            dst[short] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[short] });
                        }
                    }
                }
            }

            return rootDst;
        };

        const compressedData = transform(data);
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

        const transform = (root: any): any => {
            if (root === null || typeof root !== 'object') return root;

            const rootDst = Array.isArray(root) ? new Array(root.length) : {} as any;
            const stack: Array<{ src: any; dst: any }> = [{ src: root, dst: rootDst }];

            while (stack.length > 0) {
                const frame = stack.pop()!;
                const src = frame.src;
                const dst = frame.dst;

                if (Array.isArray(src)) {
                    for (let i = 0; i < src.length; i++) {
                        const val = src[i];
                        if (val === null || typeof val !== 'object') {
                            dst[i] = val;
                        } else {
                            dst[i] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[i] });
                        }
                    }
                } else {
                    const keys = Object.keys(src);
                    for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        const orig = reverseMap.get(k) || k;
                        const val = src[k];
                        if (val === null || typeof val !== 'object') {
                            dst[orig] = val;
                        } else {
                            dst[orig] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[orig] });
                        }
                    }
                }
            }

            return rootDst;
        };

        return transform(pkg.d);
    }
}

/**
 * Strategy 3: Schema-Data Separation
 * Optimized for arrays of objects with same structure
 */
export class SchemaDataSeparationStrategy implements CompressionStrategy {
    name = 'schema-data-separation';

    compress(data: any): any {
        // Iterative traversal with schema detection and in-place transformation
        const stack: Array<{ src: any; dstParent?: any; dstKey?: string | number | null }> = [];

        const getTransformed = (root: any) => {
            if (root === null || typeof root !== 'object') return root;

            let rootDst: any = Array.isArray(root) ? new Array(root.length) : {};
            const rootWrapper = { dst: rootDst };
            stack.push({ src: root, dstParent: rootWrapper, dstKey: null });

            while (stack.length > 0) {
                const frame = stack.pop()!;
                const src = frame.src;
                const dstContainer = frame.dstParent!.dst;
                const assignKey = frame.dstKey;

                if (Array.isArray(src)) {
                    // detect uniform array of plain objects
                    if (src.length > 0 && typeof src[0] === 'object' && src[0] !== null && !Array.isArray(src[0])) {
                        const firstItem = src[0];
                        const keys = Object.keys(firstItem);
                        const keyCount = keys.length;

                        let allMatch = true;
                        for (let i = 1; i < src.length; i++) {
                            const item = src[i];
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
                            const dataArr = new Array(src.length);
                            for (let i = 0; i < src.length; i++) dataArr[i] = new Array(keys.length);

                            // assign placeholder compressed schema
                            const comp = { $s: keys, $d: dataArr };
                            if (assignKey === null) {
                                // set root
                                rootWrapper.dst = comp;
                            } else {
                                dstContainer[assignKey as any] = comp;
                            }

                            // push all value transformation jobs
                            for (let i = src.length - 1; i >= 0; i--) {
                                for (let j = keys.length - 1; j >= 0; j--) {
                                    stack.push({ src: src[i][keys[j]], dstParent: { dst: dataArr[i] }, dstKey: j });
                                }
                            }
                            continue;
                        }
                    }

                    // Non-uniform array: transform each item
                    const newArr = new Array(src.length);
                    if (assignKey === null) {
                        // root
                        rootWrapper.dst = newArr;
                        for (let i = src.length - 1; i >= 0; i--) {
                            stack.push({ src: src[i], dstParent: { dst: newArr }, dstKey: i });
                        }
                    } else {
                        dstContainer[assignKey as any] = newArr;
                        for (let i = src.length - 1; i >= 0; i--) {
                            stack.push({ src: src[i], dstParent: { dst: newArr }, dstKey: i });
                        }
                    }
                    continue;
                }

                if (isPlainObject(src)) {
                    const newObj: any = {};
                    if (assignKey === null) {
                        // root
                        rootWrapper.dst = newObj;
                        for (const k of Object.keys(src).reverse()) {
                            stack.push({ src: src[k], dstParent: { dst: newObj }, dstKey: k });
                        }
                    } else {
                        dstContainer[assignKey as any] = newObj;
                        for (const k of Object.keys(src).reverse()) {
                            stack.push({ src: src[k], dstParent: { dst: newObj }, dstKey: k });
                        }
                    }
                    continue;
                }

                // primitive
                dstContainer[assignKey as any] = src;
            }

            return rootWrapper.dst;
        };

        return getTransformed(data);
    }

    decompress(data: any): any {
        // Iterative decompression that handles {$s, $d} schema encoding
        const stack: Array<{ src: any; dstParent?: any; dstKey?: string | number | null }> = [];

        const getDecompressed = (root: any) => {
            if (root === null || typeof root !== 'object') return root;

            // Root dst container
            let rootDst: any = Array.isArray(root) ? new Array(root.length) : {};
            const rootWrapper = { dst: rootDst };
            stack.push({ src: root, dstParent: rootWrapper, dstKey: null });

            while (stack.length > 0) {
                const frame = stack.pop()!;
                const src = frame.src;
                const dstContainer = frame.dstParent!.dst;
                const assignKey = frame.dstKey;

                if (src && typeof src === 'object' && src.$s && src.$d && Array.isArray(src.$s) && Array.isArray(src.$d)) {
                    const keys = src.$s;
                    const dataArr = src.$d;
                    const result = new Array(dataArr.length);
                    if (assignKey === null) {
                        // set root to result placeholder
                        rootWrapper.dst = result;
                        for (let i = 0; i < dataArr.length; i++) {
                            result[i] = {};
                        }
                        // push fill jobs
                        for (let i = dataArr.length - 1; i >= 0; i--) {
                            for (let j = keys.length - 1; j >= 0; j--) {
                                stack.push({ src: dataArr[i][j], dstParent: { dst: result[i] }, dstKey: keys[j] });
                            }
                        }
                        // continue processing other stack items; do not fall-through to plain-object
                        continue;
                    } else {
                        dstContainer[assignKey as any] = result;
                        for (let i = dataArr.length - 1; i >= 0; i--) {
                            result[i] = {};
                            for (let j = keys.length - 1; j >= 0; j--) {
                                stack.push({ src: dataArr[i][j], dstParent: { dst: result[i] }, dstKey: keys[j] });
                            }
                        }
                        continue;
                    }
                }

                if (Array.isArray(src)) {
                    const newArr = new Array(src.length);
                    if (assignKey === null) {
                        rootWrapper.dst = newArr;
                        for (let i = src.length - 1; i >= 0; i--) {
                            stack.push({ src: src[i], dstParent: { dst: newArr }, dstKey: i });
                        }
                    } else {
                        dstContainer[assignKey as any] = newArr;
                        for (let i = src.length - 1; i >= 0; i--) {
                            stack.push({ src: src[i], dstParent: { dst: newArr }, dstKey: i });
                        }
                    }
                    continue;
                }

                if (isPlainObject(src)) {
                    const newObj: any = {};
                    if (assignKey === null) {
                        rootWrapper.dst = newObj;
                        for (const k of Object.keys(src).reverse()) {
                            stack.push({ src: src[k], dstParent: { dst: newObj }, dstKey: k });
                        }
                    } else {
                        dstContainer[assignKey as any] = newObj;
                        for (const k of Object.keys(src).reverse()) {
                            stack.push({ src: src[k], dstParent: { dst: newObj }, dstKey: k });
                        }
                        continue;
                    }
                }

                // primitive
                dstContainer[assignKey as any] = src;
            }

            return rootWrapper.dst;
        };

        return getDecompressed(data);
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

        // Iterative transform with optional boolean shortening
        const transform = (root: any): any => {
            if (root === null || typeof root !== 'object') {
                if (this.options.unsafe) {
                    if (root === true) return 1;
                    if (root === false) return 0;
                }
                return root;
            }

            const rootDst = Array.isArray(root) ? new Array(root.length) : {} as any;
            const stack: Array<{ src: any; dst: any }> = [{ src: root, dst: rootDst }];

            while (stack.length > 0) {
                const frame = stack.pop()!;
                const src = frame.src;
                const dst = frame.dst;

                if (Array.isArray(src)) {
                    for (let i = 0; i < src.length; i++) {
                        const val = src[i];
                        // Treat non-plain objects (Date, RegExp, etc.) as atomic values
                        if (val === null || typeof val !== 'object' || !isPlainObject(val)) {
                            if (this.options.unsafe) {
                                if (val === true) {
                                    // DEBUG: boolean true encountered in unsafe mode
                                    console.error('ULTRA-CONVERT: converting true to 1 at array');
                                    dst[i] = 1;
                                }
                                else if (val === false) {
                                    console.error('ULTRA-CONVERT: converting false to 0 at array');
                                    dst[i] = 0;
                                }
                                else dst[i] = val;
                            } else {
                                dst[i] = val;
                            }
                        } else {
                            dst[i] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[i] });
                        }
                    }
                } else {
                    const keys = Object.keys(src);
                    for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        const short = getShortKey(k);
                        const val = src[k];
                        // Treat non-plain objects (Date, RegExp, etc.) as atomic values
                        if (val === null || typeof val !== 'object' || !isPlainObject(val)) {
                            if (this.options.unsafe) {
                                if (val === true) {
                                    console.error('ULTRA-CONVERT: converting true to 1 at object', k);
                                    dst[short] = 1;
                                }
                                else if (val === false) {
                                    console.error('ULTRA-CONVERT: converting false to 0 at object', k);
                                    dst[short] = 0;
                                }
                                else dst[short] = val;
                            } else {
                                dst[short] = val;
                            }
                        } else {
                            dst[short] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[short] });
                        }
                    }
                }
            }

            return rootDst;
        };

        let compressedData = transform(data);

        // Post-pass: if unsafe mode, make sure any booleans are represented as 1/0
        if (this.options.unsafe) {
            const stack2: any[] = [compressedData];
            while (stack2.length > 0) {
                const node = stack2.pop();
                if (Array.isArray(node)) {
                    for (let i = 0; i < node.length; i++) {
                        const v = node[i];
                        if (v === true) node[i] = 1;
                        else if (v === false) node[i] = 0;
                        else if (v && typeof v === 'object') stack2.push(v);
                    }
                } else if (node && typeof node === 'object') {
                    for (const k in node) {
                        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
                        const v = node[k];
                        if (v === true) node[k] = 1;
                        else if (v === false) node[k] = 0;
                        else if (v && typeof v === 'object') stack2.push(v);
                    }
                }
            }
        }

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

        const transform = (root: any): any => {
            if (root === null || typeof root !== 'object') return root;

            const rootDst = Array.isArray(root) ? new Array(root.length) : {} as any;
            const stack: Array<{ src: any; dst: any }> = [{ src: root, dst: rootDst }];

            while (stack.length > 0) {
                const frame = stack.pop()!;
                const src = frame.src;
                const dst = frame.dst;

                if (Array.isArray(src)) {
                    for (let i = 0; i < src.length; i++) {
                        const val = src[i];
                        if (val === null || typeof val !== 'object') {
                            dst[i] = val;
                        } else {
                            dst[i] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[i] });
                        }
                    }
                } else {
                    const keys = Object.keys(src);
                    for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        const originalKey = reverseMap.get(k) || k;
                        const val = src[k];
                        if (val === null || typeof val !== 'object') {
                            dst[originalKey] = val;
                        } else {
                            dst[originalKey] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[originalKey] });
                        }
                    }
                }
            }

            return rootDst;
        };

        return transform(pkg.d);
    }
}
