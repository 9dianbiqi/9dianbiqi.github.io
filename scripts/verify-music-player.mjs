import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const layout = await readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
const config = await readFile(new URL('../src/music.config.ts', import.meta.url), 'utf8');
const deploy = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');

assert.match(layout, /import MusicPlayer from ['"]\.\.\/components\/music-player\/MusicPlayer\.astro['"]/);
assert.match(layout, /<MusicPlayer\s+transition:persist="music-player"\s*\/>/);
assert.match(config, /PUBLIC_MUSIC_WORKER_URL/);
assert.match(config, /qishuiTracks/);
assert.match(deploy, /PUBLIC_MUSIC_WORKER_URL:\s*\$\{\{ vars\.PUBLIC_MUSIC_WORKER_URL \}\}/);

console.log('Music player integration checks passed.');
