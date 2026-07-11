import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fromRoot = (...segments) => path.join(root, ...segments);

const videoPath = fromRoot('public/media/home/hero-video.mp4');
const posterPath = fromRoot('public/media/home/hero-poster.jpg');
const configPath = fromRoot('src/site.config.ts');
const layoutPath = fromRoot('src/layouts/BaseLayout.astro');
const heroPath = fromRoot('src/components/HomeHero.astro');
const articlePath = fromRoot('src/content/blog/astro-home-video-background.md');

assert.ok(existsSync(videoPath), 'Missing homepage video: public/media/home/hero-video.mp4');
assert.ok(statSync(videoPath).size > 1_000_000, 'Homepage video should be a real media file');
assert.ok(existsSync(posterPath), 'Missing homepage poster: public/media/home/hero-poster.jpg');
assert.ok(statSync(posterPath).size > 10_000, 'Homepage poster should be a real image file');

const config = readFileSync(configPath, 'utf8');
assert.ok(config.includes("src: '/media/home/hero-video.mp4'"), 'site.config.ts must reference the homepage video');
assert.ok(config.includes("poster: '/media/home/hero-poster.jpg'"), 'site.config.ts must reference the homepage poster');

const hero = readFileSync(heroPath, 'utf8');
assert.ok(hero.includes('<video'), 'HomeHero.astro should render a video element');
assert.ok(hero.includes('autoplay'), 'Homepage video should autoplay');
assert.ok(hero.includes('muted'), 'Homepage video should be muted for browser autoplay');
assert.ok(hero.includes('playsinline'), 'Homepage video should use playsinline for mobile browsers');

const layout = readFileSync(layoutPath, 'utf8');
assert.ok(layout.includes("global.css?url"), 'BaseLayout.astro should import the global stylesheet as an emitted URL');
assert.ok(layout.includes('rel="stylesheet"'), 'BaseLayout.astro should render a stylesheet link');

assert.ok(existsSync(articlePath), 'Missing implementation article: src/content/blog/astro-home-video-background.md');
const article = readFileSync(articlePath, 'utf8');
for (const snippet of [
  'title:',
  'pubDate:',
  'hero-video.mp4',
  'HomeHero.astro',
  'site.config.ts',
  'autoplay',
  'muted',
]) {
  assert.ok(article.includes(snippet), `Implementation article should mention ${snippet}`);
}

console.log('Homepage video checks passed.');
