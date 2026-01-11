"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refineData = void 0;
const refineData = (root, options = {}) => {
    const { precision = 3, pruneEmpty = true, pruneNull = true } = options;
    const isEmptyObject = (o) => o &&
        typeof o === "object" &&
        !Array.isArray(o) &&
        Object.keys(o).length === 0;
    const roundNumber = (n) => {
        const factor = Math.pow(10, precision);
        return Math.round(n * factor) / factor;
    };
    const stack = [];
    const rootWrapper = {
        dst: Array.isArray(root) ? new Array(root.length) : {},
    };
    stack.push({ src: root, dstParent: rootWrapper, key: null });
    while (stack.length > 0) {
        const frame = stack.pop();
        const src = frame.src;
        const parent = frame.dstParent;
        const key = frame.key;
        if (src === null || src === undefined) {
            if (!pruneNull) {
                if (key === null)
                    parent.dst = src;
                else
                    parent.dst[key] = src;
            }
            continue;
        }
        if (typeof src === "number") {
            const val = Number.isFinite(src) ? roundNumber(src) : src;
            if (key === null)
                parent.dst = val;
            else
                parent.dst[key] = val;
            continue;
        }
        if (Array.isArray(src)) {
            const arr = new Array(src.length);
            if (key === null)
                parent.dst = arr;
            else
                parent.dst[key] = arr;
            for (let i = src.length - 1; i >= 0; i--) {
                const val = src[i];
                // If pruneEmpty and val is empty-ish, skip adding
                if (pruneEmpty) {
                    if (val === null || val === undefined)
                        continue;
                    if (val === "")
                        continue;
                    if (Array.isArray(val) && val.length === 0)
                        continue;
                    if (isEmptyObject(val))
                        continue;
                }
                arr[i] = Array.isArray(val)
                    ? new Array(val.length)
                    : isEmptyObject(val)
                        ? {}
                        : undefined;
                stack.push({ src: val, dstParent: { dst: arr }, key: i });
            }
            // After building, remove trailing undefineds if pruning removed items
            if (pruneEmpty) {
                const compact = arr.filter((v) => v !== undefined);
                if (key === null)
                    parent.dst = compact;
                else
                    parent.dst[key] = compact;
            }
            continue;
        }
        if (typeof src === "object") {
            // Treat non-plain objects (Date, RegExp, etc.) as atomic
            const proto = Object.getPrototypeOf(src);
            const isPlain = proto === Object.prototype || proto === null;
            if (!isPlain) {
                if (key === null)
                    parent.dst = src;
                else
                    parent.dst[key] = src;
                continue;
            }
            const obj = {};
            if (key === null)
                parent.dst = obj;
            else
                parent.dst[key] = obj;
            for (const k of Object.keys(src).reverse()) {
                const val = src[k];
                if (pruneNull && (val === null || val === undefined))
                    continue;
                if (pruneEmpty && val === "")
                    continue;
                if (pruneEmpty && Array.isArray(val) && val.length === 0)
                    continue;
                if (pruneEmpty && isEmptyObject(val))
                    continue;
                obj[k] = undefined; // placeholder
                stack.push({ src: val, dstParent: { dst: obj }, key: k });
            }
            // final cleanup will be implicit as we won't include placeholders if pruned
            continue;
        }
        // primitive string or boolean
        if (key === null)
            parent.dst = src;
        else
            parent.dst[key] = src;
    }
    // Final pass: remove undefined placeholders in objects
    const cleanse = (node) => {
        if (node === null || typeof node !== "object")
            return node;
        if (Array.isArray(node))
            return node.map(cleanse);
        const res = {};
        for (const k of Object.keys(node)) {
            const v = node[k];
            if (v === undefined)
                continue;
            const cv = cleanse(v);
            // prune empty objects after child cleanup
            if (pruneEmpty && isEmptyObject(cv))
                continue;
            if (pruneEmpty && Array.isArray(cv) && cv.length === 0)
                continue;
            res[k] = cv;
        }
        return res;
    };
    return cleanse(rootWrapper.dst);
};
exports.refineData = refineData;
