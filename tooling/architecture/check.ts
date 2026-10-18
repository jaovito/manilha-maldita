import { resolve } from 'node:path';
import { analyzeSource } from './analyze';

const root = resolve(import.meta.dir, '../..');
let errors = 0;
for (const directory of ['apps', 'packages']) {
  const sources = new Bun.Glob('**/src/**/*.{ts,tsx,js,mjs}');
  for await (const filename of sources.scan({ cwd: resolve(root, directory), onlyFiles: true })) {
    if (filename.includes('/node_modules/') || filename.includes('/dist/')) continue;
    const filePath = resolve(root, directory, filename);
    const code = await Bun.file(filePath).text();
    const issues = analyzeSource(filePath, code);
    if (!/\.(?:test|spec)\.[jt]sx?$/.test(filename)) {
      const lines = code.split('\n').length;
      if (lines >= 500) issues.push('Production source files must stay below 500 lines; refactor.');
      else if (lines > 300) console.warn(`${directory}/${filename}: review size (${lines} lines).`);
    }
    for (const issue of issues) {
      console.error(`${directory}/${filename}: ${issue}`);
      errors++;
    }
  }
}
if (errors) process.exit(1);
console.log('Architecture boundaries verified.');
