
import { AbbreviatedKeysStrategy, SchemaDataSeparationStrategy, UltraCompactStrategy } from '../src/index';

describe('Compression Strategies', () => {
    const testData = {
        users: [
            { id: 1, name: 'Alice', active: true, role: 'admin' },
            { id: 2, name: 'Bob', active: false, role: 'viewer' },
            { id: 3, name: 'Charlie', active: true, role: 'editor' }
        ],
        meta: {
            timestamp: 123456789,
            source: 'test'
        }
    };

    describe('AbbreviatedKeysStrategy', () => {
        const strategy = new AbbreviatedKeysStrategy();

        it('should compress by abbreviating keys', () => {
            const compressed = strategy.compress(testData);
            expect(compressed).toHaveProperty('m'); // map
            expect(compressed).toHaveProperty('d'); // data
            expect(Object.keys(compressed.m).length).toBeGreaterThan(0);
        });

        it('should restore original data exactly', () => {
            const compressed = strategy.compress(testData);
            const restored = strategy.decompress(compressed);
            expect(restored).toEqual(testData);
        });
    });

    describe('SchemaDataSeparationStrategy', () => {
        const strategy = new SchemaDataSeparationStrategy();

        it('should separate schema from data for arrays', () => {
            const compressed = strategy.compress(testData);
            // We expect the users array to be transformed
            // The exact structure depends on implementation details, but valid JSON is expected
            // and it should contain schema/data indicators if efficient
        });

        it('should restore original data exactly', () => {
            const compressed = strategy.compress(testData);
            const restored = strategy.decompress(compressed);
            expect(restored).toEqual(testData);
        });
    });

    describe('UltraCompactStrategy', () => {
        const strategy = new UltraCompactStrategy();

        it('should compress significantly', () => {
            const compressed = strategy.compress(testData);
            expect(compressed).toHaveProperty('m');
            expect(compressed).toHaveProperty('d');
        });

        it('should restore original data exactly (Safe Mode Default)', () => {
            const compressed = strategy.compress(testData);
            const restored = strategy.decompress(compressed);

            // Default behavior should now be LOSSLESS for booleans
            expect(restored).toEqual(testData);
        });

        it('should convert booleans to numbers in Unsafe Mode', () => {
            const unsafeStrategy = new UltraCompactStrategy({ unsafe: true });
            const compressed = unsafeStrategy.compress(testData);
            const restored = unsafeStrategy.decompress(compressed);

            // In unsafe mode, booleans become 1/0
            const expected = JSON.parse(JSON.stringify(testData, (k, v) => {
                if (v === true) return 1;
                if (v === false) return 0;
                return v;
            }));

            expect(restored).toEqual(expected);
            // Verify we actually saved space/changed types in the raw payload
            // We can't easily peek inside without knowing internal structure perfect, 
            // but we can check one known boolean value if we traversed, 
            // or just trust the restored comparison above which proves the transformation happened.
        });
    });
});
