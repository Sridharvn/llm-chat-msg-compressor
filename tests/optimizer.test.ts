
import { optimize, restore } from '../src/index';

describe('Optimizer (Integration)', () => {
    const smallData = { id: 1, val: 'small' };
    const largeData = {
        users: Array.from({ length: 100 }, (_, i) => ({
            id: i,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            active: i % 2 === 0
        }))
    };

    it('should optimize small data (likely returns as-is or minimal compression)', () => {
        const result = optimize(smallData);
        // Depending on threshold, it might return original
        // But result should be valid and restorable
        const restored = restore(result);
        expect(restored).toEqual(smallData);
    });

    it('should optimize large data effectively', () => {
        const result = optimize(largeData);
        expect(JSON.stringify(result).length).toBeLessThan(JSON.stringify(largeData).length);
        const restored = restore(result);
        expect(restored).toEqual(largeData);
    });

    it('should respect "aggressive" option (or pick better strategy)', () => {
        // Even with aggressive, if Schema Separation is suitable, it might be picked (which returns exact match)
        // So we expect exact match for this largeData array
        const result = optimize(largeData, { aggressive: true });
        const restored = restore(result);
        expect(restored).toEqual(largeData);
    });

    it('should use UltraCompact when aggressive is true and Schema Separation is not suitable', () => {
        // Data not suitable for schema separation (heterogeneous or simple object)
        const mixedData = {
            a: true,
            b: false,
            c: [1, 2, 3],
            d: { nested: true }
        };
        const result = optimize(mixedData, { aggressive: true, thresholdBytes: 0 });
        const restored = restore(result);

        // UltraCompact in aggressive mode should still preserve boolean types (true/false)
        // It should not convert them to 1/0.
        expect(restored).toEqual(mixedData);
    });
});
