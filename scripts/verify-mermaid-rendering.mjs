import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [layout, runtime, styles, readme, packageSource] = await Promise.all([
  read('../src/layouts/BaseLayout.astro'),
  read('../src/scripts/mermaid-diagrams.ts'),
  read('../src/styles/global.css'),
  read('../README.md'),
  read('../package.json'),
]);
const packageJson = JSON.parse(packageSource);

assert.equal(packageJson.dependencies.mermaid, '^11.16.0');
assert.match(layout, /import ['"]\.\.\/scripts\/mermaid-diagrams['"]/);
assert.match(runtime, /import\(['"]mermaid['"]\)/);
assert.match(runtime, /securityLevel:\s*['"]strict['"]/);
assert.match(runtime, /startOnLoad:\s*false/);
assert.match(runtime, /addEventListener\(['"]astro:page-load['"]/);
assert.match(styles, /\.prose \.mermaid-diagram\s*\{/);
assert.match(styles, /\.prose \.mermaid-diagram__canvas\s*\{/);
assert.match(styles, /overflow-x:\s*auto/);
assert.match(styles, /\.prose \.mermaid-diagram-error\s*\{/);
assert.match(readme, /```mermaid/);
assert.match(readme, /npm run verify:mermaid/);

console.log('Mermaid publishing contract checks passed.');
