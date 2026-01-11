import { SchemaDataSeparationStrategy } from '../src/strategies';

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

const strat = new SchemaDataSeparationStrategy();
const compressed = strat.compress(data);
console.log(JSON.stringify(compressed, null, 2));
