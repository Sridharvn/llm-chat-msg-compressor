import { optimize } from '../src/index';
import { TokenCounter } from '../src/tokenizer';

describe('Token Validation', () => {
    it('should return original data if compressed tokens are more than input tokens', () => {
        // Small object where mapping overhead might increase token count
        const smallData = { a: 1 };
        
        // Force compression by setting thresholdBytes to 0
        const result = optimize(smallData, { 
            thresholdBytes: 0, 
            validateTokenSavings: true 
        });

        // It should return the original data because {m:{a:'a'}, d:{a:1}} is definitely more tokens than {"a":1}
        expect(result).toEqual(smallData);
    });

    it('should return compressed data if it actually saves tokens', () => {
        const largeData = {
            users: Array.from({ length: 10 }, (_, i) => ({
                id: i,
                name: 'User ' + i,
                email: 'user' + i + '@example.com',
                role: 'admin'
            }))
        };

        const result = optimize(largeData, { 
            thresholdBytes: 0, 
            validateTokenSavings: true 
        });

        // Should be compressed (contains 'm' and 'd' or '$s' and '$d')
        expect(result).not.toEqual(largeData);
        // In this case, it's nested: { users: { $s, $d } }
        expect(result.users.$s).toBeDefined();
    });

    it('should support custom tokenizer functions', () => {
        const data = { test: "data" };
        const customTokenizer = jest.fn().mockReturnValue(10);

        optimize(data, { 
            thresholdBytes: 0, 
            validateTokenSavings: true,
            tokenizer: customTokenizer
        });

        expect(customTokenizer).toHaveBeenCalled();
    });

    it('should support different encodings', () => {
        const data = { text: "hello world" };
        
        // This shouldn't throw
        const result = optimize(data, { 
            validateTokenSavings: true,
            tokenizer: 'o200k_base' // GPT-4o
        });

        expect(result).toBeDefined();
    });

    it('should skip compression for small JSONs by default (regression test)', () => {
        const smallData = {
            id: 1,
            name: "Short",
            active: true
        };

        // With default thresholdBytes=1024 and validateTokenSavings=true, 
        // this should return the original data.
        const result = optimize(smallData);

        expect(result).toEqual(smallData);
    });
});
