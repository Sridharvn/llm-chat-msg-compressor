
import { Optimizer } from '../src/optimizer';
import { SchemaDataSeparationStrategy, AbbreviatedKeysStrategy } from '../src/strategies';

describe('Optimizer Selection Logic', () => {
    const optimizer = new Optimizer();

    it('should select Schema Separation for list-heavy payloads', () => {
        // Create a large list of uniform objects
        const listData = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            name: `User ${i}`,
            role: 'viewer',
            active: true
        }));

        // Analyze and optimize
        // The console logs will help debug ensuring the right choice is made
        // We can inspect the returned object structure to know the strategy
        const result = optimizer.optimize(listData, { thresholdBytes: 0, validateTokenSavings: false });

        // Schema Separation produces $s and $d keys
        expect(result).toHaveProperty('$s');
        expect(result).toHaveProperty('$d');
        expect(result).not.toHaveProperty('m'); // Should NOT be AbbreviatedKeys
    });

    it('should select Abbreviated Keys for mixed payloads (small list, huge nested object)', () => {
        // Flaw Reproduction Case:
        // A small list (technically schema separable) but embedded in a much larger non-list structure.
        // Old logic would see the list and pick Schema Separation, ignoring the rest.
        // New logic should see Abbreviated Keys saves more overall.

        const mixedData = {
            // Small separable list
            users: [
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
                { id: 3, name: 'C' }
            ],
            // Huge nested structure with repetitive keys
            config: {
                nested: {
                    deeply: {
                        field_repetition: 'value1',
                        another_field: 'value2'
                    },
                    sibling: {
                        field_repetition: 'value3',
                        another_field: 'value4'
                    }
                },
                more_nesting: {
                    field_repetition: 'value5',
                    another_field: 'value6'
                },
                even_more: {
                    field_repetition: 'value7',
                    another_field: 'value8'
                },
                // Add more to weight the scale towards AbbrevKeys
                extra_1: { field_repetition: 1, another_field: 2 },
                extra_2: { field_repetition: 1, another_field: 2 },
                extra_3: { field_repetition: 1, another_field: 2 },
                extra_4: { field_repetition: 1, another_field: 2 },
                extra_5: { field_repetition: 1, another_field: 2 },
            }
        };

        const result = optimizer.optimize(mixedData, { thresholdBytes: 0, validateTokenSavings: false });

        // Should prefer Abbreviated Keys because the list savings are tiny compared to the nested object key savings
        expect(result).toHaveProperty('m'); // Map indicates Abbreviated Keys or UltraCompact
        expect(result).not.toHaveProperty('$s'); // Should NOT be Schema Separation
    });
});
