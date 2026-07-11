import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { MockAgent } from 'undici';
import { defineConfig } from 'vitest/config';

const fetchMock = new MockAgent();
fetchMock.disableNetConnect();
fetchMock
  .get('https://accounts.spotify.com')
  .intercept({ path: '/api/token', method: 'POST' })
  .reply(200, JSON.stringify({
    access_token: 'owner-access',
    token_type: 'Bearer',
    scope: 'streaming user-read-private user-read-email user-read-playback-state user-modify-playback-state',
    expires_in: 3600,
    refresh_token: 'owner-refresh',
  }), { headers: { 'content-type': 'application/json' } })
  .persist();
fetchMock
  .get('https://api.spotify.com')
  .intercept({ path: '/v1/me', method: 'GET' })
  .reply(200, JSON.stringify({
    id: 'owner-user',
    display_name: 'Owner',
    external_urls: { spotify: 'https://open.spotify.com/user/owner-user' },
    href: 'https://api.spotify.com/v1/users/owner-user',
    images: [],
    type: 'user',
    uri: 'spotify:user:owner-user',
  }), { headers: { 'content-type': 'application/json' } })
  .persist();
fetchMock
  .get('https://api.spotify.com')
  .intercept({ path: /\/v1\/playlists\/[^/]+\/items\?limit=50/, method: 'GET' })
  .reply(200, JSON.stringify({
    href: 'https://api.spotify.com/v1/playlists/demo/items?limit=50',
    limit: 50,
    next: null,
    offset: 0,
    previous: null,
    total: 1,
    items: [
      {
        added_at: '2026-07-12T00:00:00Z',
        added_by: { id: 'owner-user', type: 'user', uri: 'spotify:user:owner-user' },
        is_local: false,
        item: {
          id: 'track-1',
          uri: 'spotify:track:track-1',
          name: 'Track one',
          type: 'track',
          duration_ms: 180000,
          artists: [{ id: 'artist-1', name: 'Artist one', type: 'artist', uri: 'spotify:artist:artist-1' }],
          album: { id: 'album-1', name: 'Album', images: [{ url: 'https://i.scdn.co/image/demo', width: 640, height: 640 }] },
          external_urls: { spotify: 'https://open.spotify.com/track/track-1' },
        },
      },
    ],
  }), { headers: { 'content-type': 'application/json' } })
  .persist();

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './worker/wrangler.jsonc' },
      miniflare: {
        fetchMock,
        bindings: {
          SPOTIFY_CLIENT_ID: 'test-client',
          SPOTIFY_CLIENT_SECRET: 'test-secret',
          SPOTIFY_OWNER_ID: 'owner-user',
        },
      },
    }),
  ],
  test: {
    include: ['worker/test/**/*.test.ts'],
  },
});
