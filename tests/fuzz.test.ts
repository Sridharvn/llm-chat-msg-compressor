
import { AbbreviatedKeysStrategy, SchemaDataSeparationStrategy, UltraCompactStrategy } from '../src/index';

const generateRandomJSON = (depth = 0, maxDepth = 4): any => {
    if (depth > maxDepth) return Math.random() > 0.5 ? "leaf" : 123;

    const type = Math.floor(Math.random() * 5);

    if (type === 0) return true; // Boolean
    if (type === 1) return false;
    if (type === 2) return Math.random(); // Number
    if (type === 3) {
        // Array
        const arr = [];
        const len = Math.floor(Math.random() * 5);
        for (let i = 0; i < len; i++) arr.push(generateRandomJSON(depth + 1, maxDepth));
        return arr;
    }
    // Object
    const obj: any = {};
    const keys = Math.floor(Math.random() * 5);
    for (let i = 0; i < keys; i++) {
        obj[`key_${Math.random().toString(36).substring(7)}`] = generateRandomJSON(depth + 1, maxDepth);
    }
    return obj;
};

describe('Fuzz Testing Strategies', () => {
    const strategies = [
        new AbbreviatedKeysStrategy(),
        new SchemaDataSeparationStrategy(),
        new UltraCompactStrategy() // Safe by default now
    ];

    it('should maintain data integrity across 100 random payloads', () => {
        for (let i = 0; i < 100; i++) {
            const data = generateRandomJSON();

            strategies.forEach(strategy => {
                const compressed = strategy.compress(data);
                const restored = strategy.decompress(compressed);

                // Deep equality check
                try {
                    expect(restored).toEqual(data);
                } catch (e) {
                    console.error(`Failed at iteration ${i} with strategy ${strategy.name}`);
                    console.error('Original:', JSON.stringify(data));
                    console.error('Restored:', JSON.stringify(restored));
                    throw e;
                }
            });
        }
    });

    it('UltraCompact (Unsafe) should be consistent with expected transformation', () => {
        const unsafeStrategy = new UltraCompactStrategy({ unsafe: true });
        const data = { val: true, num: 1, nested: { val: false } };

        const compressed = unsafeStrategy.compress(data);
        const restored = unsafeStrategy.decompress(compressed);

        // Explicitly check transformation
        expect(restored.val).toBe(1);
        expect(restored.nested.val).toBe(0);
        expect(restored.num).toBe(1); // Numbers stay numbers
    });
});
