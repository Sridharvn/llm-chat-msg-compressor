import { optimize, restore } from '../src/index';

const date = new Date();
const data = { date };
console.log('Original:', data);
const result = optimize(data, { thresholdBytes: 0 });
console.log('Optimized:', JSON.stringify(result, null, 2));
const jsonRoundTrip = JSON.parse(JSON.stringify(result));
console.log('JSON RoundTrip:', JSON.stringify(jsonRoundTrip, null, 2));
const restoredFromJson = restore(jsonRoundTrip);
console.log('Restored From JSON:', JSON.stringify(restoredFromJson, null, 2));
console.log('date type:', typeof restoredFromJson.date, restoredFromJson.date);