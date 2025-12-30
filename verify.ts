import { optimize, restore } from './src/index';
import { encode as tokenize } from 'gpt-3-encoder';

const generateLargeData = (count: number) => ({
    users: Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i}@example.com`,
        isActive: i % 2 === 0,
        roles: i % 3 === 0 ? ['admin', 'editor'] : ['viewer'],
        metadata: {
            lastLogin: '2023-01-01',
            ip: '192.168.1.1',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        },
        preferences: {
            theme: 'dark',
            notifications: true,
            newsletter: false
        }
    }))
});

// Generate ~5KB of data (well above 500 byte threshold)
const testData = generateLargeData(20);

console.log('🧪 Verifying LLM Compressor...\n');

// 1. Test Aggressive Optimization (UltraCompact)
console.log('--- Test 1: Aggressive Optimization ---');
const optimizedAggressive = optimize(testData, { aggressive: true });
// console.log('Original JSON:', JSON.stringify(testData));
// console.log('Optimized JSON:', JSON.stringify(optimizedAggressive));

const origTokens = tokenize(JSON.stringify(testData)).length;
const optTokens = tokenize(JSON.stringify(optimizedAggressive)).length;
console.log(`Tokens: ${origTokens} -> ${optTokens} (${((1 - optTokens / origTokens) * 100).toFixed(1)}% savings)`);

// Verify Reversibility
const restoredAggressive = restore(optimizedAggressive);
console.log('Restored matches original (except bools as 1/0)?', JSON.stringify(restoredAggressive).length === JSON.stringify(testData).replaceAll('true', '1').replaceAll('false', '0').length); // Approximate check


// 2. Test Array Optimization (Schema Separation)
console.log('\n--- Test 2: Array Optimization (Auto-detect) ---');
// Should pick SchemaSeparation because structure is repetitive
const optimizedAuto = optimize(testData, { aggressive: false });
// console.log('Optimized JSON:', JSON.stringify(optimizedAuto));

const optTokensAuto = tokenize(JSON.stringify(optimizedAuto)).length;
console.log(`Tokens: ${origTokens} -> ${optTokensAuto} (${((1 - optTokensAuto / origTokens) * 100).toFixed(1)}% savings)`);

const restoredAuto = restore(optimizedAuto);
// Schema separation preserves exact values, so should deep equal
// Helper for semantic equality (ignoring key order)
function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        return a.every((val, i) => deepEqual(val, b[i]));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => keysB.includes(key) && deepEqual(a[key], b[key]));
}

const matches = deepEqual(restoredAuto, testData);

if (!matches) {
    console.error('❌ MISMATCH!');
    console.log('Restored Structure:', JSON.stringify(restoredAuto).substring(0, 200));
    console.log('Original[0]:', JSON.stringify(testData.users[0], null, 2));
    // console.log('Restored[0]:', JSON.stringify(restoredAuto.users[0], null, 2));
} else {
    console.log('✅ Restoration Successful');
}
