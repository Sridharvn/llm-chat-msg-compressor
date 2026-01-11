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
  return (
    obj !== null &&
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    (Object.getPrototypeOf(obj) === Object.prototype ||
      Object.getPrototypeOf(obj) === null)
  );
};

export class Analyzer {
  static analyze(data: any): AnalysisMetrics {
    // Pre-flight check for primitives or very small objects
    if (data === null || typeof data !== "object") {
      return {
        totalBytes:
          data === undefined
            ? 0
            : Buffer.byteLength(JSON.stringify(data), "utf8"),
        arrayDensity: 0,
        maxExampleArrayLength: 0,
        nestingDepth: 0,
        repeatedKeysEstimate: 0,
        estimatedAbbrevSavings: 0,
        estimatedSchemaSavings: 0,
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
      if (arr.length < 2 || typeof arr[0] !== "object" || arr[0] === null)
        return 0;

      // Check consistency of first few items
      const firstItem = arr[0];
      const keys = Object.keys(firstItem);
      const keyCount = keys.length;
      if (keyCount === 0) return 0;

      const sampleSize = Math.min(arr.length, 5);
      let isConsistent = true;

      for (let i = 1; i < sampleSize; i++) {
        const item = arr[i];
        if (!item || typeof item !== "object" || Array.isArray(item)) {
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
        const perItemOverhead = keysLen + keyCount * 2; // quotes + colon approx
        // For tokens, schema separation is very efficient.
        // The overhead of the schema array is small compared to repeating keys.
        const schemaArrayOverhead = keysLen + keyCount * 2 + 5;
        return Math.max(
          0,
          (arr.length - 1) * perItemOverhead - schemaArrayOverhead
        );
      }
      return 0;
    };

    // Iterative stack-based traversal to avoid call stack overflows
    // Depth-first traversal with ancestor tracking to detect true cycles only
    const stack: Array<{ node: any; depth: number; entering: boolean }> = [
      { node: data, depth: 0, entering: true },
    ];
    const ancestors = new WeakSet();

    while (stack.length > 0) {
      const frame = stack.pop()!;
      const obj = frame.node;
      const currentDepth = frame.depth;

      if (obj && typeof obj === "object") {
        if (frame.entering) {
          // Entering node
          if (ancestors.has(obj))
            throw new Error("Circular reference detected");
          ancestors.add(obj);
        } else {
          // Leaving node
          ancestors.delete(obj);
          continue;
        }
      }

      depth = Math.max(depth, currentDepth);

      if (Array.isArray(obj)) {
        arrayCount++;
        maxArrLen = Math.max(maxArrLen, obj.length);
        totalBytes += 2; // []
        if (obj.length > 1) totalBytes += obj.length - 1; // commas

        // Check if this specific array offers schema savings
        schemaSavings += calculateArraySchemaSavings(obj);

        // Push a leaving frame then children as entering frames
        stack.push({ node: obj, depth: currentDepth, entering: false });
        for (let i = obj.length - 1; i >= 0; i--) {
          stack.push({ node: obj[i], depth: currentDepth + 1, entering: true });
        }
      } else if (isPlainObject(obj)) {
        objectCount++;
        totalBytes += 2; // {}

        let first = true;
        const keys = Object.keys(obj);
        // Push leaving frame
        stack.push({ node: obj, depth: currentDepth, entering: false });
        // Iterate keys in reverse to emulate recursive order with stack
        for (let i = keys.length - 1; i >= 0; i--) {
          const key = keys[i];
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (!first) totalBytes += 1; // comma
            first = false;

            totalKeysCount++;
            totalKeyLength += key.length;
            totalBytes += key.length + 3; // "key":
            stack.push({
              node: obj[key],
              depth: currentDepth + 1,
              entering: true,
            });
          }
        }
      } else {
        // Primitive or non-plain object (Date, etc.)
        if (typeof obj === "string") {
          totalBytes += Buffer.byteLength(obj, "utf8") + 2; // quotes
        } else if (typeof obj === "number" || typeof obj === "boolean") {
          totalBytes += String(obj).length;
        } else if (obj instanceof Date) {
          totalBytes += obj.toISOString().length + 2; // quotes
        } else if (obj === null) {
          totalBytes += 4;
        } else {
          // Fallback for other types that might be stringified
          try {
            const s = JSON.stringify(obj);
            if (s) totalBytes += Buffer.byteLength(s, "utf8");
          } catch {
            // Ignore if not stringifiable
          }
        }
      }
    }

    // Estimate Abbreviation Savings
    // For LLM tokens, shortening keys is often a net LOSS because:
    // 1. Common keys (metadata, id, role) are already 1 token.
    // 2. Short keys (a, b, c) are also 1 token.
    // 3. The mapping table 'm' adds significant token overhead.
    // We use a much more conservative byte-per-key saving (e.g. 1.5 bytes instead of avgKeyLen - 2)
    const tokenAwareSavingsPerKey = 1.5;

    // Rough estimate of unique keys: usually much smaller than total keys for compressed data.
    // Let's assume 20% distinct keys for a "compressible" workload.
    const avgKeyLen = totalKeysCount > 0 ? totalKeyLength / totalKeysCount : 0;
    const estimatedMapOverhead = totalKeysCount * 0.2 * (avgKeyLen + 5);

    const rawAbbrevSavings = totalKeysCount * tokenAwareSavingsPerKey;
    const abbrevMetadataTax = 60; // Increased tax for { m: {}, d: } wrapper tokens
    const estimatedAbbrevSavings = Math.max(
      0,
      rawAbbrevSavings - estimatedMapOverhead - abbrevMetadataTax
    );

    const schemaMetadataTax = 20; // Reduced tax for { $s: [], $d: [] } as it's more token-friendly
    const finalSchemaSavings = Math.max(0, schemaSavings - schemaMetadataTax);

    return {
      totalBytes,
      arrayDensity: objectCount > 0 ? arrayCount / objectCount : 0,
      maxExampleArrayLength: maxArrLen,
      nestingDepth: depth,
      repeatedKeysEstimate: 0,
      estimatedAbbrevSavings,
      estimatedSchemaSavings: finalSchemaSavings,
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
