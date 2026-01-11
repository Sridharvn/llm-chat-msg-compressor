"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UltraCompactStrategy = exports.StructuralDeduplicationStrategy = exports.SchemaDataSeparationStrategy = exports.AbbreviatedKeysStrategy = exports.minify = exports.generateShortKey = void 0;
/**
 * Shared utility for generating short keys (a, b, ... z, aa, ab ...)
 */
const generateShortKey = (index) => {
    let shortKey = "";
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
    return (obj !== null &&
        typeof obj === "object" &&
        !Array.isArray(obj) &&
        (Object.getPrototypeOf(obj) === Object.prototype ||
            Object.getPrototypeOf(obj) === null));
};
/**
 * Strategy 1: Minify (Baseline)
 * Just standard JSON serialization (handled by default JSON.stringify)
 * We include it for completeness in the strategy pattern
 */
exports.minify = {
    name: "minify",
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
        this.name = "abbreviated-keys";
    }
    compress(data) {
        // First pass: collect key frequencies so we can decide what to abbreviate
        const freq = new Map();
        const stackScan = [data];
        const visitedScan = new WeakSet();
        while (stackScan.length > 0) {
            const node = stackScan.pop();
            if (!node || typeof node !== "object")
                continue;
            if (visitedScan.has(node))
                continue;
            visitedScan.add(node);
            if (Array.isArray(node)) {
                for (let i = 0; i < node.length; i++)
                    stackScan.push(node[i]);
            }
            else {
                for (const k of Object.keys(node)) {
                    freq.set(k, (freq.get(k) || 0) + 1);
                    stackScan.push(node[k]);
                }
            }
        }
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
        const dict = AbbreviatedKeysStrategy.DICT || {};
        const shouldAbbreviate = (key) => {
            if (key in dict)
                return true;
            const kLen = key.length;
            const kFreq = freq.get(key) || 0;
            return kLen > 4 || kFreq > 2;
        };
        // Iterative transform to avoid recursion
        const transform = (root) => {
            if (root === null || typeof root !== "object")
                return root;
            const rootDst = Array.isArray(root)
                ? new Array(root.length)
                : {};
            const stack = [
                { src: root, dst: rootDst },
            ];
            const visited = new WeakSet();
            while (stack.length > 0) {
                const frame = stack.pop();
                const src = frame.src;
                // Cycle detection
                if (src && typeof src === "object") {
                    if (visited.has(src))
                        throw new Error("Circular reference detected");
                    visited.add(src);
                }
                const dst = frame.dst;
                if (Array.isArray(src)) {
                    for (let i = 0; i < src.length; i++) {
                        const val = src[i];
                        // Treat non-plain objects (Date, RegExp, etc.) as atomic values
                        if (val === null ||
                            typeof val !== "object" ||
                            !isPlainObject(val)) {
                            dst[i] = val;
                        }
                        else {
                            dst[i] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[i] });
                        }
                    }
                }
                else {
                    const keys = Object.keys(src);
                    for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        const val = src[k];
                        // Choose the target key: static dict -> static token, else maybe dynamic short key, else original
                        let targetKey;
                        if (k in dict) {
                            targetKey = dict[k];
                        }
                        else if (shouldAbbreviate(k)) {
                            targetKey = getShortKey(k);
                        }
                        else {
                            targetKey = k;
                        }
                        // Assign value
                        if (val === null ||
                            typeof val !== "object" ||
                            !isPlainObject(val)) {
                            dst[targetKey] = val;
                        }
                        else {
                            dst[targetKey] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[targetKey] });
                        }
                    }
                }
            }
            return rootDst;
        };
        const compressedData = transform(data);
        return {
            m: Object.fromEntries(keyMap),
            d: compressedData,
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
        // static reverse mapping (safe if no static dict provided)
        const staticReverse = {};
        const dict = AbbreviatedKeysStrategy.DICT || {};
        for (const orig in dict) {
            const short = dict[orig];
            staticReverse[short] = orig;
        }
        const transform = (root) => {
            if (root === null || typeof root !== "object")
                return root;
            const rootDst = Array.isArray(root)
                ? new Array(root.length)
                : {};
            const stack = [
                { src: root, dst: rootDst },
            ];
            while (stack.length > 0) {
                const frame = stack.pop();
                const src = frame.src;
                const dst = frame.dst;
                if (Array.isArray(src)) {
                    for (let i = 0; i < src.length; i++) {
                        const val = src[i];
                        if (val === null || typeof val !== "object") {
                            dst[i] = val;
                        }
                        else {
                            dst[i] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[i] });
                        }
                    }
                }
                else {
                    const keys = Object.keys(src);
                    for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        let orig = reverseMap.get(k) || k;
                        if (orig === k && staticReverse[k])
                            orig = staticReverse[k];
                        const val = src[k];
                        if (val === null || typeof val !== "object") {
                            dst[orig] = val;
                        }
                        else {
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
exports.AbbreviatedKeysStrategy = AbbreviatedKeysStrategy;
// Default static dictionary for common LLM payload keys (single-letter or short tokens)
AbbreviatedKeysStrategy.DICT = {
    role: "a",
    content: "b",
    message: "c",
    messages: "d",
    user: "e",
    assistant: "f",
    system: "g",
    name: "h",
    id: "i",
    timestamp: "j",
    source: "k",
    meta: "l",
    text: "m",
    input: "n",
    output: "o",
    reply: "p",
    context: "q",
    description: "r",
    type: "s",
    error: "t",
    status: "u",
    result: "v",
    value: "w",
    items: "x",
    data: "y",
    payload: "z",
    options: "aa",
    params: "ab",
};
/**
 * Strategy 3: Schema-Data Separation
 * Optimized for arrays of objects with same structure
 */
class SchemaDataSeparationStrategy {
    constructor() {
        this.name = "schema-data-separation";
    }
    compress(data) {
        // Iterative traversal with schema detection and in-place transformation
        const stack = [];
        const getTransformed = (root) => {
            if (root === null || typeof root !== "object")
                return root;
            let rootDst = Array.isArray(root) ? new Array(root.length) : {};
            const rootWrapper = { dst: rootDst };
            stack.push({ src: root, dstParent: rootWrapper, dstKey: null });
            while (stack.length > 0) {
                const frame = stack.pop();
                const src = frame.src;
                const dstContainer = frame.dstParent.dst;
                const assignKey = frame.dstKey;
                if (Array.isArray(src)) {
                    // detect uniform array of plain objects
                    if (src.length > 0 &&
                        typeof src[0] === "object" &&
                        src[0] !== null &&
                        !Array.isArray(src[0])) {
                        const firstItem = src[0];
                        const keys = Object.keys(firstItem);
                        const keyCount = keys.length;
                        let allMatch = true;
                        for (let i = 1; i < src.length; i++) {
                            const item = src[i];
                            if (typeof item !== "object" ||
                                item === null ||
                                Array.isArray(item)) {
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
                            const dataArr = new Array(src.length);
                            for (let i = 0; i < src.length; i++)
                                dataArr[i] = new Array(keys.length);
                            // assign placeholder compressed schema
                            const comp = { $s: keys, $d: dataArr };
                            if (assignKey === null) {
                                // set root
                                rootWrapper.dst = comp;
                            }
                            else {
                                dstContainer[assignKey] = comp;
                            }
                            // push all value transformation jobs
                            for (let i = src.length - 1; i >= 0; i--) {
                                for (let j = keys.length - 1; j >= 0; j--) {
                                    stack.push({
                                        src: src[i][keys[j]],
                                        dstParent: { dst: dataArr[i] },
                                        dstKey: j,
                                    });
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
                            stack.push({
                                src: src[i],
                                dstParent: { dst: newArr },
                                dstKey: i,
                            });
                        }
                    }
                    else {
                        dstContainer[assignKey] = newArr;
                        for (let i = src.length - 1; i >= 0; i--) {
                            stack.push({
                                src: src[i],
                                dstParent: { dst: newArr },
                                dstKey: i,
                            });
                        }
                    }
                    continue;
                }
                if (isPlainObject(src)) {
                    const newObj = {};
                    if (assignKey === null) {
                        // root
                        rootWrapper.dst = newObj;
                        for (const k of Object.keys(src).reverse()) {
                            stack.push({
                                src: src[k],
                                dstParent: { dst: newObj },
                                dstKey: k,
                            });
                        }
                    }
                    else {
                        dstContainer[assignKey] = newObj;
                        for (const k of Object.keys(src).reverse()) {
                            stack.push({
                                src: src[k],
                                dstParent: { dst: newObj },
                                dstKey: k,
                            });
                        }
                    }
                    continue;
                }
                // primitive
                dstContainer[assignKey] = src;
            }
            return rootWrapper.dst;
        };
        return getTransformed(data);
    }
    decompress(data) {
        // Iterative decompression that handles {$s, $d} schema encoding
        const stack = [];
        const getDecompressed = (root) => {
            if (root === null || typeof root !== "object")
                return root;
            // Root dst container
            let rootDst = Array.isArray(root) ? new Array(root.length) : {};
            const rootWrapper = { dst: rootDst };
            stack.push({ src: root, dstParent: rootWrapper, dstKey: null });
            while (stack.length > 0) {
                const frame = stack.pop();
                const src = frame.src;
                const dstContainer = frame.dstParent.dst;
                const assignKey = frame.dstKey;
                if (src &&
                    typeof src === "object" &&
                    src.$s &&
                    src.$d &&
                    Array.isArray(src.$s) &&
                    Array.isArray(src.$d)) {
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
                                stack.push({
                                    src: dataArr[i][j],
                                    dstParent: { dst: result[i] },
                                    dstKey: keys[j],
                                });
                            }
                        }
                        // continue processing other stack items; do not fall-through to plain-object
                        continue;
                    }
                    else {
                        dstContainer[assignKey] = result;
                        for (let i = dataArr.length - 1; i >= 0; i--) {
                            result[i] = {};
                            for (let j = keys.length - 1; j >= 0; j--) {
                                stack.push({
                                    src: dataArr[i][j],
                                    dstParent: { dst: result[i] },
                                    dstKey: keys[j],
                                });
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
                            stack.push({
                                src: src[i],
                                dstParent: { dst: newArr },
                                dstKey: i,
                            });
                        }
                    }
                    else {
                        dstContainer[assignKey] = newArr;
                        for (let i = src.length - 1; i >= 0; i--) {
                            stack.push({
                                src: src[i],
                                dstParent: { dst: newArr },
                                dstKey: i,
                            });
                        }
                    }
                    continue;
                }
                if (isPlainObject(src)) {
                    const newObj = {};
                    if (assignKey === null) {
                        rootWrapper.dst = newObj;
                        for (const k of Object.keys(src).reverse()) {
                            stack.push({
                                src: src[k],
                                dstParent: { dst: newObj },
                                dstKey: k,
                            });
                        }
                    }
                    else {
                        dstContainer[assignKey] = newObj;
                        for (const k of Object.keys(src).reverse()) {
                            stack.push({
                                src: src[k],
                                dstParent: { dst: newObj },
                                dstKey: k,
                            });
                        }
                        continue;
                    }
                }
                // primitive
                dstContainer[assignKey] = src;
            }
            return rootWrapper.dst;
        };
        return getDecompressed(data);
    }
}
exports.SchemaDataSeparationStrategy = SchemaDataSeparationStrategy;
/**
 * Strategy 4: Structural Deduplication
 * Detects repeated sub-objects/arrays and replaces them with references stored in a root-level registry ($r).
 */
class StructuralDeduplicationStrategy {
    constructor(options = {}) {
        this.options = options;
        this.name = "structural-deduplication";
    }
    canonicalStringify(root) {
        const helper = (node, ancestors) => {
            if (node === null)
                return "null";
            if (typeof node !== "object")
                return JSON.stringify(node);
            if (ancestors.has(node))
                throw new Error("Circular reference detected");
            ancestors.add(node);
            if (Array.isArray(node)) {
                const res = "[" + node.map((n) => helper(n, ancestors)).join(",") + "]";
                ancestors.delete(node);
                return res;
            }
            const keys = Object.keys(node).sort();
            const res = "{" +
                keys
                    .map((k) => JSON.stringify(k) + ":" + helper(node[k], ancestors))
                    .join(",") +
                "}";
            ancestors.delete(node);
            return res;
        };
        return helper(root, new WeakSet());
    }
    compress(data) {
        if (data === null || typeof data !== "object")
            return data;
        const minSize = this.options.minSizeBytes ?? 64;
        const counts = new Map();
        const repr = new Map();
        // First pass: collect nodes and compute canonical strings
        const stack = [data];
        while (stack.length > 0) {
            const node = stack.pop();
            if (!node || typeof node !== "object")
                continue;
            let canon;
            try {
                canon = this.canonicalStringify(node);
            }
            catch (e) {
                // Propagate circular reference error
                throw e;
            }
            counts.set(canon, (counts.get(canon) || 0) + 1);
            if (!repr.has(canon))
                repr.set(canon, node);
            if (Array.isArray(node)) {
                for (let i = 0; i < node.length; i++)
                    stack.push(node[i]);
            }
            else {
                for (const k of Object.keys(node))
                    stack.push(node[k]);
            }
        }
        // Determine candidates
        const candidates = new Map(); // canon -> id
        let idCounter = 0;
        for (const [canon, cnt] of counts.entries()) {
            if (cnt > 1 && Buffer.byteLength(canon, "utf8") >= minSize) {
                candidates.set(canon, `r${++idCounter}`);
            }
        }
        if (candidates.size === 0)
            return data;
        // Second pass: replace candidates with $ref:id and build registry
        const registry = {};
        const assignIds = new Map();
        for (const [canon, id] of candidates.entries()) {
            registry[id] = repr.get(canon);
        }
        const transform = (root) => {
            if (root === null || typeof root !== "object")
                return root;
            const rootCopy = Array.isArray(root)
                ? new Array(root.length)
                : {};
            const rootWrapper = { dst: rootCopy };
            const stack2 = [{ src: root, parent: rootWrapper, key: null }];
            while (stack2.length > 0) {
                const frame = stack2.pop();
                const src = frame.src;
                const parent = frame.parent;
                const key = frame.key;
                if (!src || typeof src !== "object") {
                    if (key !== null && parent)
                        parent.dst[key] = src;
                    continue;
                }
                let canon;
                try {
                    canon = this.canonicalStringify(src);
                }
                catch (e) {
                    throw e;
                }
                if (candidates.has(canon)) {
                    const id = candidates.get(canon);
                    // replace entire node with ref
                    if (key === null)
                        return { $ref: id };
                    parent.dst[key] = { $ref: id };
                    continue;
                }
                if (Array.isArray(src)) {
                    const newArr = new Array(src.length);
                    if (key === null)
                        parent.dst = newArr;
                    else
                        parent.dst[key] = newArr;
                    for (let i = 0; i < src.length; i++) {
                        const val = src[i];
                        if (val === null || typeof val !== "object") {
                            newArr[i] = val;
                        }
                        else {
                            newArr[i] = Array.isArray(val) ? new Array(val.length) : {};
                            stack2.push({ src: val, parent: { dst: newArr }, key: i });
                        }
                    }
                }
                else {
                    const newObj = {};
                    if (key === null)
                        parent.dst = newObj;
                    else
                        parent.dst[key] = newObj;
                    for (const k of Object.keys(src)) {
                        const val = src[k];
                        if (val === null || typeof val !== "object") {
                            newObj[k] = val;
                        }
                        else {
                            newObj[k] = Array.isArray(val) ? new Array(val.length) : {};
                            stack2.push({ src: val, parent: { dst: newObj }, key: k });
                        }
                    }
                }
            }
            return rootWrapper.dst;
        };
        const transformed = transform(data);
        return { $r: registry, d: transformed };
    }
    decompress(pkg) {
        if (!pkg || !pkg.$r || pkg.d === undefined)
            return pkg;
        const registry = pkg.$r;
        const reconstruct = (root) => {
            if (root === null || typeof root !== "object")
                return root;
            if (Array.isArray(root)) {
                const arr = new Array(root.length);
                for (let i = 0; i < root.length; i++)
                    arr[i] = reconstruct(root[i]);
                return arr;
            }
            // object
            if (root.$ref && typeof root.$ref === "string") {
                // deep clone from registry
                const rep = registry[root.$ref];
                return JSON.parse(JSON.stringify(rep));
            }
            const obj = {};
            for (const k of Object.keys(root))
                obj[k] = reconstruct(root[k]);
            return obj;
        };
        return reconstruct(pkg.d);
    }
}
exports.StructuralDeduplicationStrategy = StructuralDeduplicationStrategy;
/**
 * Strategy 4: Ultra Compact (Collision Safe)
 * Aggressive compression. Replaces boolean values and maps keys to minimal shortest strings.
 */
class UltraCompactStrategy {
    constructor(options = {}) {
        this.options = options;
        this.name = "ultra-compact";
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
        // Iterative transform with optional boolean shortening
        const transform = (root) => {
            if (root === null || typeof root !== "object") {
                if (this.options.unsafe) {
                    if (root === true)
                        return 1;
                    if (root === false)
                        return 0;
                }
                return root;
            }
            const rootDst = Array.isArray(root)
                ? new Array(root.length)
                : {};
            const stack = [
                { src: root, dst: rootDst },
            ];
            while (stack.length > 0) {
                const frame = stack.pop();
                const src = frame.src;
                const dst = frame.dst;
                if (Array.isArray(src)) {
                    for (let i = 0; i < src.length; i++) {
                        const val = src[i];
                        // Treat non-plain objects (Date, RegExp, etc.) as atomic values
                        if (val === null ||
                            typeof val !== "object" ||
                            !isPlainObject(val)) {
                            if (this.options.unsafe) {
                                if (val === true) {
                                    dst[i] = 1;
                                }
                                else if (val === false) {
                                    dst[i] = 0;
                                }
                                else
                                    dst[i] = val;
                            }
                            else {
                                dst[i] = val;
                            }
                        }
                        else {
                            dst[i] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[i] });
                        }
                    }
                }
                else {
                    const keys = Object.keys(src);
                    for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        const short = getShortKey(k);
                        const val = src[k];
                        // Treat non-plain objects (Date, RegExp, etc.) as atomic values
                        if (val === null ||
                            typeof val !== "object" ||
                            !isPlainObject(val)) {
                            if (this.options.unsafe) {
                                if (val === true) {
                                    dst[short] = 1;
                                }
                                else if (val === false) {
                                    dst[short] = 0;
                                }
                                else
                                    dst[short] = val;
                            }
                            else {
                                dst[short] = val;
                            }
                        }
                        else {
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
            const stack2 = [compressedData];
            while (stack2.length > 0) {
                const node = stack2.pop();
                if (Array.isArray(node)) {
                    for (let i = 0; i < node.length; i++) {
                        const v = node[i];
                        if (v === true)
                            node[i] = 1;
                        else if (v === false)
                            node[i] = 0;
                        else if (v && typeof v === "object")
                            stack2.push(v);
                    }
                }
                else if (node && typeof node === "object") {
                    for (const k in node) {
                        if (!Object.prototype.hasOwnProperty.call(node, k))
                            continue;
                        const v = node[k];
                        if (v === true)
                            node[k] = 1;
                        else if (v === false)
                            node[k] = 0;
                        else if (v && typeof v === "object")
                            stack2.push(v);
                    }
                }
            }
        }
        return {
            m: Object.fromEntries(keyMap),
            d: compressedData,
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
        // static reverse mapping (use AbbreviatedKeysStrategy's DICT if present)
        const staticReverse = {};
        const dict = AbbreviatedKeysStrategy.DICT || {};
        for (const orig in dict) {
            const short = dict[orig];
            staticReverse[short] = orig;
        }
        const transform = (root) => {
            if (root === null || typeof root !== "object")
                return root;
            const rootDst = Array.isArray(root)
                ? new Array(root.length)
                : {};
            const stack = [
                { src: root, dst: rootDst },
            ];
            while (stack.length > 0) {
                const frame = stack.pop();
                const src = frame.src;
                const dst = frame.dst;
                if (Array.isArray(src)) {
                    for (let i = 0; i < src.length; i++) {
                        const val = src[i];
                        if (val === null || typeof val !== "object") {
                            dst[i] = val;
                        }
                        else {
                            dst[i] = Array.isArray(val) ? new Array(val.length) : {};
                            stack.push({ src: val, dst: dst[i] });
                        }
                    }
                }
                else {
                    const keys = Object.keys(src);
                    for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        let originalKey = reverseMap.get(k) || k;
                        if (originalKey === k && staticReverse[k])
                            originalKey = staticReverse[k];
                        const val = src[k];
                        if (val === null || typeof val !== "object") {
                            dst[originalKey] = val;
                        }
                        else {
                            dst[originalKey] = Array.isArray(val)
                                ? new Array(val.length)
                                : {};
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
exports.UltraCompactStrategy = UltraCompactStrategy;
