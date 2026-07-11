import { describe, expect, it, vi } from 'vitest';
import { SpotifyProvider, type SpotifyPlayerLike } from './spotify-provider';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('SpotifyProvider', () => {
  it('loads and normalizes the public catalog', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        generatedAt: '2026-07-12T00:00:00.000Z',
        playlistUrl: 'https://open.spotify.com/playlist/demo',
        tracks: [
          {
            id: 'track-1',
            title: 'Track one',
            artist: 'Artist',
            coverUrl: 'https://i.scdn.co/image/demo',
            externalUrl: 'https://open.spotify.com/track/track-1',
            spotifyUri: 'spotify:track:track-1',
          },
        ],
      }),
    );
    const provider = new SpotifyProvider({ workerBaseUrl: 'https://worker.example', fetchImpl });

    const catalog = await provider.loadCatalog();

    expect(catalog.tracks[0]).toMatchObject({ provider: 'spotify', id: 'track-1' });
    expect(fetchImpl).toHaveBeenCalledWith('https://worker.example/catalog/spotify', expect.any(Object));
  });

  it('exchanges a one-time code and stores only the opaque session token', async () => {
    const storage = new Map<string, string>();
    const fetchImpl = vi.fn().mockResolvedValue(
      response({ sessionToken: 'opaque-session', expiresAt: '2026-07-19T00:00:00.000Z' }),
    );
    const provider = new SpotifyProvider({
      workerBaseUrl: 'https://worker.example',
      fetchImpl,
      sessionStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
    });

    await provider.exchangeSessionCode('single-use-code');

    expect(provider.authenticated).toBe(true);
    expect([...storage.values()]).toEqual(['opaque-session']);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example/auth/session/exchange',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'single-use-code' }) }),
    );
  });

  it('connects the SDK and starts the selected Spotify URI on its device', async () => {
    const listeners = new Map<string, (payload: any) => void>();
    const player: SpotifyPlayerLike = {
      addListener: vi.fn((name, listener) => void listeners.set(name, listener)),
      connect: vi.fn(async () => {
        listeners.get('ready')?.({ device_id: 'device-1' });
        return true;
      }),
      disconnect: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      previousTrack: vi.fn(),
      nextTrack: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({ accessToken: 'short-token', expiresAt: '2026-07-12T01:00:00Z' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const provider = new SpotifyProvider({
      workerBaseUrl: 'https://worker.example',
      fetchImpl,
      sessionStorage: {
        getItem: () => 'opaque-session',
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      playerFactory: async () => player,
    });

    await provider.play({
      id: 'track-1',
      provider: 'spotify',
      title: 'Track one',
      artist: 'Artist',
      coverUrl: 'https://i.scdn.co/image/demo',
      externalUrl: 'https://open.spotify.com/track/track-1',
      spotifyUri: 'spotify:track:track-1',
    });

    expect(fetchImpl).toHaveBeenLastCalledWith(
      'https://api.spotify.com/v1/me/player/play?device_id=device-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ uris: ['spotify:track:track-1'] }),
      }),
    );
  });

  it('refreshes the public catalog with the opaque owner session', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        generatedAt: '2026-07-12T00:00:00Z',
        playlistUrl: 'https://open.spotify.com/playlist/demo',
        tracks: [],
      }),
    );
    const provider = new SpotifyProvider({
      workerBaseUrl: 'https://worker.example',
      fetchImpl,
      sessionStorage: {
        getItem: () => 'opaque-session',
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    await provider.refreshCatalog();

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example/catalog/spotify/refresh',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer opaque-session' }),
      }),
    );
  });

  it.each([401, 403, 429])('marks Spotify unavailable after HTTP %s', async (status) => {
    const provider = new SpotifyProvider({
      workerBaseUrl: 'https://worker.example',
      fetchImpl: vi.fn().mockResolvedValue(response({ error: 'failed' }, status)),
    });

    await expect(provider.loadCatalog()).rejects.toThrow(`Spotify request failed (${status})`);
    expect(provider.unavailable).toBe(true);
  });
});
