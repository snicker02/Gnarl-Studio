// Builds dist/gnarl-studio-standalone.html: one file that works from file:// (ES modules are blocked there).
// Usage: npm i esbuild && node tools/bundle.mjs
import { build } from 'esbuild'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = await build({ entryPoints: [path.join(root, 'main.js')], bundle: true, format: 'iife', minify: false, write: false, target: 'es2019' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
           .replace('<script type="module" src="main.js"></script>', '<script>\n' + js + '\n</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/gnarl-studio-standalone.html'), html);
console.log('wrote dist/gnarl-studio-standalone.html', (html.length / 1024).toFixed(0) + 'KB');
