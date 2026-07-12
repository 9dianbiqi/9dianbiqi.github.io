import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const layout = await readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
const config = await readFile(new URL('../src/music.config.ts', import.meta.url), 'utf8');
const deploy = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const playerSource = await readFile(new URL('../src/components/music-player/music-player.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(layout, /import MusicPlayer from ['"]\.\.\/components\/music-player\/MusicPlayer\.astro['"]/);
assert.match(layout, /<MusicPlayer\s+transition:persist="music-player"\s*\/>/);
assert.match(config, /open\.spotify\.com\/playlist\//);
assert.match(config, /qishuiTracks/);
assert(!existsSync(new URL('../worker', import.meta.url)), 'worker directory must be removed');
assert(!packageJson.scripts['test:worker'], 'worker test script must be removed');
assert(!deploy.includes('PUBLIC_MUSIC_WORKER_URL'), 'workflow must not require a Worker URL');
assert(!playerSource.includes('SpotifyProvider'), 'OAuth provider must be removed');
assert(playerSource.includes('data-spotify-embed'), 'official Spotify embed must be rendered');

console.log('Spotify Embed static architecture checks passed.');
