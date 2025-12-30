import { TiktokenEncoding } from "js-tiktoken";
export type SupportedEncoding = TiktokenEncoding | 'cl100k_base' | 'o200k_base' | 'p50k_base' | 'r50k_base';
export declare class TokenCounter {
    private static cache;
    /**
     * Gets a tokenizer instance for the specified encoding or model.
     */
    private static getTokenizer;
    /**
     * Counts tokens in a string or object (as JSON).
     */
    static count(data: any, encodingOrModel?: string): number;
}
