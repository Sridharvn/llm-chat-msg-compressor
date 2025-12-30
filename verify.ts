import { optimize, restore } from './src/index';

const getByteLength = (obj: any) => Buffer.byteLength(JSON.stringify(obj), 'utf8');

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
const optimizedAggressive = optimize(testData, { aggressive: true, unsafe: true });
// console.log('Original JSON:', JSON.stringify(testData));
// console.log('Optimized JSON:', JSON.stringify(optimizedAggressive));

const origBytes = getByteLength(testData);
const optBytes = getByteLength(optimizedAggressive);
console.log(`Bytes: ${origBytes} -> ${optBytes} (${((1 - optBytes / origBytes) * 100).toFixed(1)}% savings)`);

// Verify Reversibility
const restoredAggressive = restore(optimizedAggressive);
// Helper for semantic equality (ignoring key order, allowing bool->int)
function deepEqual(a: any, b: any, allowBoolInt = false): boolean {
    if (a === b) return true;
    if (allowBoolInt) {
        if (a === 1 && b === true) return true;
        if (a === 0 && b === false) return true;
    }
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        return a.every((val, i) => deepEqual(val, b[i], allowBoolInt));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => keysB.includes(key) && deepEqual(a[key], b[key], allowBoolInt));
}

const matchesAggressive = deepEqual(restoredAggressive, testData, true);
console.log('Restored matches original (allowing bools as 1/0)?', matchesAggressive);


// 2. Test Array Optimization (Schema Separation)
console.log('\n--- Test 2: Array Optimization (Auto-detect) ---');
// Should pick SchemaSeparation because structure is repetitive
const optimizedAuto = optimize(testData, { aggressive: false });
// console.log('Optimized JSON:', JSON.stringify(optimizedAuto));

const optBytesAuto = getByteLength(optimizedAuto);
console.log(`Bytes: ${origBytes} -> ${optBytesAuto} (${((1 - optBytesAuto / origBytes) * 100).toFixed(1)}% savings)`);

const restoredAuto = restore(optimizedAuto);
const matchesAuto = deepEqual(restoredAuto, testData);

if (!matchesAuto) {
    console.error('❌ MISMATCH!');
    console.log('Restored Structure:', JSON.stringify(restoredAuto).substring(0, 200));
    console.log('Original[0]:', JSON.stringify(testData.users[0], null, 2));
} else {
    console.log('✅ Restoration Successful');
}

// 3. Test Token Validation
console.log('\n--- Test 3: Token Validation ---');
const smallData = { id: 1, name: "Short" };
const optimizedSmall = optimize(smallData, { 
    thresholdBytes: 0, 
    validateTokenSavings: true 
});

if (JSON.stringify(optimizedSmall) === JSON.stringify(smallData)) {
    console.log('✅ Correctly returned original data (compression would have increased tokens)');
} else {
    console.log('❌ Failed: Should have returned original data for small payload');
}

const largeData = generateLargeData(5);
const optimizedLarge = optimize(largeData, { 
    validateTokenSavings: true,
    tokenizer: 'o200k_base' // Test with GPT-4o tokenizer
});

if (JSON.stringify(optimizedLarge) !== JSON.stringify(largeData)) {
    console.log('✅ Correctly compressed large data with token validation');
} else {
    console.log('❌ Failed: Should have compressed large data');
}
