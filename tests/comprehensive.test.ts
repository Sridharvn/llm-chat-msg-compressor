
import { optimize, restore, Optimizer } from '../src/index';
import { SchemaDataSeparationStrategy } from '../src/strategies';

describe('Comprehensive Tests', () => {
    describe('Data Integrity & Types', () => {
        it('should handle BigInt (by throwing when stringified)', () => {
            const data = { val: BigInt(9007199254740991) };
            // Should throw if we validate tokens (which stringifies)
            expect(() => optimize(data, { validateTokenSavings: true, thresholdBytes: 0 })).toThrow();
        });

        it('should handle Date objects (standard JSON behavior)', () => {
            const date = new Date();
            const data = { date };
            // Force compression
            const result = optimize(data, { thresholdBytes: 0 });
            const restored = restore(result);
            // If it was compressed, it went through a process that might have stringified it or just kept it
            // Actually, our strategies don't stringify values, they just traverse.
            // So if it's not JSON.stringified, the Date object remains!
            // This is actually a "feature" of the current implementation: it preserves non-JSON types if not stringified.
            // But restore() is intended to be used after receiving JSON from an API.
            
            // Let's simulate JSON round-trip
            const jsonRoundTrip = JSON.parse(JSON.stringify(result));
            const restoredFromJson = restore(jsonRoundTrip);
            expect(restoredFromJson.date).toBe(date.toISOString());
        });

        it('should handle undefined and functions (standard JSON behavior)', () => {
            const data = {
                val: undefined,
                fn: () => {},
                arr: [undefined, () => {}]
            };
            // Simulate what happens when this is sent over the wire
            const wireData = JSON.parse(JSON.stringify(data));
            const result = optimize(wireData, { thresholdBytes: 0 });
            const restored = restore(result);
            expect(restored).toEqual({ arr: [null, null] });
        });
    });

    describe('Circular References', () => {
        it('should throw on circular references', () => {
            const data: any = { a: 1 };
            data.self = data;
            expect(() => optimize(data)).toThrow();
        });
    });

    describe('Nested Schema Separation', () => {
        it('should correctly restore nested schema-separated data', () => {
            const data = {
                groups: [
                    {
                        id: 1,
                        users: [
                            { name: 'Alice', age: 30 },
                            { name: 'Bob', age: 25 }
                        ]
                    },
                    {
                        id: 2,
                        users: [
                            { name: 'Charlie', age: 35 },
                            { name: 'Dave', age: 40 }
                        ]
                    }
                ]
            };

            const strategy = new SchemaDataSeparationStrategy();
            const compressed = strategy.compress(data);

            // Verify it's actually compressed at multiple levels
            // Top level 'groups' should be schema-separated
            expect(compressed.groups).toHaveProperty('$s');
            expect(compressed.groups).toHaveProperty('$d');
            
            // Nested 'users' should also be schema-separated
            // compressed.groups.$d[0] is [1, { $s: [...], $d: [...] }]
            expect(compressed.groups.$d[0][1]).toHaveProperty('$s');

            const restored = restore(compressed);
            expect(restored).toEqual(data);
        });
    });

    describe('Restore Edge Cases', () => {
        it('should return primitives as is', () => {
            expect(restore("string")).toBe("string");
            expect(restore(123)).toBe(123);
            expect(restore(true)).toBe(true);
            expect(restore(null)).toBe(null);
        });

        it('should return objects without markers as is', () => {
            const data = { a: 1, b: 2 };
            expect(restore(data)).toEqual(data);
        });

        it('should not be fooled by objects that look like markers but are not', () => {
            // Missing 'd'
            const fakeAbbrev = { m: { a: 'b' } };
            expect(restore(fakeAbbrev)).toEqual(fakeAbbrev);

            // Missing 'm'
            const fakeAbbrev2 = { d: { a: 'b' } };
            expect(restore(fakeAbbrev2)).toEqual(fakeAbbrev2);

            // $s and $d but not arrays
            const fakeSchema = { $s: 'not-array', $d: 'not-array' };
            // Current implementation of hasSchemaMarker only checks for presence of keys
            // Let's see if it handles it gracefully
            const restored = restore(fakeSchema);
            // SchemaDataSeparationStrategy.decompress checks if they are arrays
            expect(restored).toEqual(fakeSchema);
        });
    });

    describe('Optimizer Options', () => {
        it('should respect thresholdBytes', () => {
            const data = { a: 1, b: 2 };
            const result = optimize(data, { thresholdBytes: 1000 });
            expect(result).toEqual(data); // Too small to compress
        });

        it('should respect validateTokenSavings', () => {
            // Small data where overhead of map makes it larger in tokens
            const data = { a: 1 };
            const result = optimize(data, { validateTokenSavings: true, thresholdBytes: 0 });
            expect(result).toEqual(data);
        });
    });
});
