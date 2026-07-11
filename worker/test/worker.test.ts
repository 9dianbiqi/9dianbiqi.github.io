import { env } from 'cloudflare:workers';
import { reset, runInDurableObject, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { isConfiguredOwner } from '../src/index';

const origin = 'https://9dianbiqi.github.io';

async function createOwnerSession() {
  const start = await SELF.fetch(
    `https://worker.example/auth/spotify/start?returnTo=${encodeURIComponent(origin + '/blog/')}`,
    { redirect: 'manual' },
  );
  const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
  const callback = await SELF.fetch(
    `https://worker.example/auth/spotify/callback?code=owner-code&state=${encodeURIComponent(state)}`,
    { redirect: 'manual' },
  );
  const code = new URL(callback.headers.get('location')!).searchParams.get('music_code')!;
  const exchange = await SELF.fetch('https://worker.example/auth/session/exchange', {
    method: 'POST',
    headers: { Origin: origin, 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return {
    code,
    exchange,
    session: (await exchange.clone().json()) as { sessionToken: string; expiresAt: string },
  };
}

beforeEach(async () => {
  await reset();
});

describe('music auth worker', () => {
  it('serves an empty public catalog with exact-origin CORS', async () => {
    const response = await SELF.fetch('https://worker.example/catalog/spotify', {
      headers: { Origin: origin },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(await response.json()).toEqual({ generatedAt: null, playlistUrl: '', tracks: [] });
  });

  it('rejects preflight requests from unconfigured origins', async () => {
    const response = await SELF.fetch('https://worker.example/auth/session/exchange', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });

    expect(response.status).toBe(403);
  });

  it('creates an owner session and consumes the exchange code once', async () => {
    const { code, exchange, session } = await createOwnerSession();
    expect(exchange.status).toBe(200);
    expect(session.sessionToken).toHaveLength(43);

    const replay = await SELF.fetch('https://worker.example/auth/session/exchange', {
      method: 'POST',
      headers: { Origin: origin, 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    expect(replay.status).toBe(401);
  });

  it('rejects an authenticated Spotify profile that is not the configured owner', () => {
    expect(isConfiguredOwner('other-user', 'owner-user')).toBe(false);
    expect(isConfiguredOwner('owner-user', 'owner-user')).toBe(true);
  });

  it('refreshes a short-lived access token without returning the refresh token', async () => {
    const { session } = await createOwnerSession();
    const response = await SELF.fetch('https://worker.example/auth/session/refresh', {
      method: 'POST',
      headers: { Origin: origin, Authorization: `Bearer ${session.sessionToken}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.accessToken).toBe('owner-access');
    expect(body.refreshToken).toBeUndefined();
  });

  it('revokes the session immediately', async () => {
    const { session } = await createOwnerSession();
    const logout = await SELF.fetch('https://worker.example/auth/session', {
      method: 'DELETE',
      headers: { Origin: origin, Authorization: `Bearer ${session.sessionToken}` },
    });
    const refresh = await SELF.fetch('https://worker.example/auth/session/refresh', {
      method: 'POST',
      headers: { Origin: origin, Authorization: `Bearer ${session.sessionToken}` },
    });

    expect(logout.status).toBe(204);
    expect(refresh.status).toBe(401);
  });

  it('rejects an expired session from strongly consistent storage', async () => {
    const { session } = await createOwnerSession();
    const stub = env.AUTH.getByName('spotify-owner');
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.put(`session:${session.sessionToken}`, {
        refreshToken: 'owner-refresh',
        expiresAt: Date.now() - 1,
      });
    });
    const refresh = await SELF.fetch('https://worker.example/auth/session/refresh', {
      method: 'POST',
      headers: { Origin: origin, Authorization: `Bearer ${session.sessionToken}` },
    });

    expect(refresh.status).toBe(401);
  });

  it('refreshes and serves a sanitized public playlist catalog', async () => {
    const { session } = await createOwnerSession();
    const refreshed = await SELF.fetch('https://worker.example/catalog/spotify/refresh', {
      method: 'POST',
      headers: { Origin: origin, Authorization: `Bearer ${session.sessionToken}` },
    });
    expect(refreshed.status, await refreshed.clone().text()).toBe(200);

    const catalog = await SELF.fetch('https://worker.example/catalog/spotify', {
      headers: { Origin: origin },
    });
    const body = (await catalog.json()) as { tracks: Array<Record<string, unknown>> };
    expect(body.tracks).toEqual([
      expect.objectContaining({
        id: 'track-1', provider: 'spotify', title: 'Track one', artist: 'Artist one',
        spotifyUri: 'spotify:track:track-1',
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain('owner-refresh');
  });
});

void env;
