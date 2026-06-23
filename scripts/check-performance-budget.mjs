import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const budget = {
  maxInitialJsKb: 450,
  maxInitialCssKb: 110,
};

const assetsDir = join(process.cwd(), 'dist', 'assets');
const entries = await readdir(assetsDir);
const assets = await Promise.all(entries.map(async (name) => {
  const sizeKb = (await stat(join(assetsDir, name))).size / 1024;
  const type = name.endsWith('.js') ? 'js' : name.endsWith('.css') ? 'css' : 'other';
  return { name, sizeKb, type };
}));

const jsKb = assets.filter((asset) => asset.type === 'js').reduce((total, asset) => total + asset.sizeKb, 0);
const cssKb = assets.filter((asset) => asset.type === 'css').reduce((total, asset) => total + asset.sizeKb, 0);
const violations = [];
if (jsKb > budget.maxInitialJsKb) violations.push(`JS ${Math.round(jsKb)}KB > ${budget.maxInitialJsKb}KB`);
if (cssKb > budget.maxInitialCssKb) violations.push(`CSS ${Math.round(cssKb)}KB > ${budget.maxInitialCssKb}KB`);

if (violations.length > 0) {
  console.error(`Performance budget failed: ${violations.join('; ')}`);
  process.exit(1);
}

console.log(`Performance budget passed: JS ${Math.round(jsKb)}KB / ${budget.maxInitialJsKb}KB, CSS ${Math.round(cssKb)}KB / ${budget.maxInitialCssKb}KB`);
