// Compose dist-artifact/ into a single self-contained HTML page (CSS and JS inlined).
// Usage: node scripts/make-artifact.mjs <output.html>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'dist-artifact/nourish.html';
const dir = 'dist-artifact/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
if (js.length !== 1 || css.length !== 1) throw new Error(`Expected one JS and one CSS file, found ${js} / ${css}`);

const script = readFileSync(join(dir, js[0]), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = readFileSync(join(dir, css[0]), 'utf8').replace(/<\/style/gi, '<\\/style');

const html = `<title>NOURISH</title>
<meta name="description" content="Personalised seven-day meal plans and grocery lists.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap">
<style>${style}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
