# Multi-provider Music Player Implementation Plan

**Goal:** Add a customizable persistent Astro music player with Spotify inline playback for the owner, public Spotify catalog links, Qishui Music links, and a Cloudflare OAuth service.

## Delivery protocol

1. Work on `codex/music-player`; never commit implementation to `main`.
2. Commit and push this plan before implementation changes.
3. Implement test-first, run the existing verification suite plus new player and Worker tests, then open a draft pull request.
4. Never commit Spotify or Cloudflare credentials. Use mocks when real credentials are unavailable.

## Player

- Build a framework-free Web Component under `src/components/music-player/` and mount it once from `BaseLayout.astro` with `transition:persist="music-player"`.
- Render a compact 340px desktop panel and a mobile bottom sheet. Never autoplay; restore provider, track, progress, volume, and expanded state, then wait for user interaction.
- Define `ProviderId`, `MusicTrack`, and `ProviderCapabilities`; switch providers by pausing the previous provider without cross-platform matching.
- Expose theme CSS variables, `::part()` hooks, fixed icon slots, control visibility, keyboard navigation, ARIA labels, visible focus, reduced-motion behavior, and 44px touch targets.

## Providers

- Spotify uses a fixed owner/collaborative playlist, Web Playback SDK, and scopes `streaming`, `user-read-private`, `user-read-email`, `user-read-playback-state`, and `user-modify-playback-state`, with playlist read scopes when required.
- The owner can authenticate and play inline. Other visitors can browse the cached catalog and open tracks on Spotify.
- Qishui Music reads validated TypeScript configuration containing title, artist, cover, and an absolute HTTPS share URL. It only offers “Open in Qishui Music”; no private or unofficial API is permitted.
- Spotify authorization, Premium, SDK, network, 401, 403, and 429 failures retain the queue and degrade to external links.

## Cloudflare service

Implement under `worker/`:

- `GET /catalog/spotify`
- `GET /auth/spotify/start`
- `GET /auth/spotify/callback`
- `POST /auth/session/exchange`
- `POST /auth/session/refresh`
- `DELETE /auth/session`
- `POST /catalog/spotify/refresh`

Use a SQLite-backed Durable Object for OAuth state, one-time codes, refresh tokens, and revocable seven-day sessions. Use Workers KV only for the public catalog. OAuth state expires after ten minutes and exchange codes after five minutes. Verify `/me` against `SPOTIFY_OWNER_ID`, restrict CORS to configured origins, and never log credentials or session tokens.

## Verification and rollout

- Vitest covers state, queues, capabilities, configuration validation, and degradation.
- Cloudflare Vitest covers state validation, owner rejection, one-time exchange, expiry, revocation, CORS, and Spotify mocks.
- Playwright covers desktop/mobile layout, provider switching, logged-out links, logged-in controls, keyboard access, and Astro navigation persistence.
- Run all existing verification scripts, `npm run build`, player tests, Worker tests, and browser tests.
- Document Spotify redirect URIs, Worker secrets, Durable Object migrations, KV binding, deployment order, catalog refresh, and final smoke tests.
