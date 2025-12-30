"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenCounter = void 0;
const js_tiktoken_1 = require("js-tiktoken");
class TokenCounter {
    /**
     * Gets a tokenizer instance for the specified encoding or model.
     */
    static getTokenizer(encodingOrModel) {
        if (this.cache.has(encodingOrModel)) {
            return this.cache.get(encodingOrModel);
        }
        let tokenizer;
        try {
            // Try as encoding first
            tokenizer = (0, js_tiktoken_1.getEncoding)(encodingOrModel);
        }
        catch {
            try {
                // Try as model name
                tokenizer = (0, js_tiktoken_1.encodingForModel)(encodingOrModel);
            }
            catch {
                // Fallback to cl100k_base (GPT-4)
                tokenizer = (0, js_tiktoken_1.getEncoding)("cl100k_base");
            }
        }
        this.cache.set(encodingOrModel, tokenizer);
        return tokenizer;
    }
    /**
     * Counts tokens in a string or object (as JSON).
     */
    static count(data, encodingOrModel = "cl100k_base") {
        const text = typeof data === 'string' ? data : JSON.stringify(data);
        const tokenizer = this.getTokenizer(encodingOrModel);
        return tokenizer.encode(text).length;
    }
}
exports.TokenCounter = TokenCounter;
TokenCounter.cache = new Map();
