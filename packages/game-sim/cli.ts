import { compare } from './src/simulation';

const samples = Number(process.argv[2] ?? 30);
const seed = Number(process.argv[3] ?? 31207);
console.log(JSON.stringify(compare(samples, seed), null, 2));
