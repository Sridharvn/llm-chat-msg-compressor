import { getEncoding, encodingForModel, Tiktoken, TiktokenEncoding } from "js-tiktoken";

export type SupportedEncoding = TiktokenEncoding | 'cl100k_base' | 'o200k_base' | 'p50k_base' | 'r50k_base';

export class TokenCounter {
    private static cache: Map<string, Tiktoken> = new Map();

    /**
     * Gets a tokenizer instance for the specified encoding or model.
     */
    private static getTokenizer(encodingOrModel: string): Tiktoken {
        if (this.cache.has(encodingOrModel)) {
            return this.cache.get(encodingOrModel)!;
        }

        let tokenizer: Tiktoken;
        try {
            // Try as encoding first
            tokenizer = getEncoding(encodingOrModel as TiktokenEncoding);
        } catch {
            try {
                // Try as model name
                tokenizer = encodingForModel(encodingOrModel as any);
            } catch {
                // Fallback to cl100k_base (GPT-4)
                tokenizer = getEncoding("cl100k_base");
            }
        }

        this.cache.set(encodingOrModel, tokenizer);
        return tokenizer;
    }

    /**
     * Counts tokens in a string or object (as JSON).
     */
    static count(data: any, encodingOrModel: string = "cl100k_base"): number {
        const text = typeof data === 'string' ? data : JSON.stringify(data);
        const tokenizer = this.getTokenizer(encodingOrModel);
        return tokenizer.encode(text).length;
    }
}
