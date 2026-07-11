export { AuthSession } from './auth-session';

export const isConfiguredOwner = (profileId: string | undefined, ownerId: string) =>
  Boolean(profileId) && profileId === ownerId;

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

interface CatalogTrack {
  id: string;
  provider: 'spotify';
  title: string;
  artist: string;
  coverUrl: string;
  externalUrl: string;
  durationMs?: number;
  spotifyUri: string;
}

const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
  });

const allowedOrigins = (env: Cloudflare.Env) =>
  new Set(env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean));

const corsHeaders = (request: Request, env: Cloudflare.Env): Record<string, string> => {
  const origin = request.headers.get('origin');
  return origin && allowedOrigins(env).has(origin)
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
        'access-control-allow-headers': 'authorization,content-type',
        vary: 'Origin',
      }
    : {};
};

const requireOrigin = (request: Request, env: Cloudflare.Env) => {
  const origin = request.headers.get('origin');
  return origin !== null && allowedOrigins(env).has(origin);
};

const bearer = (request: Request) => {
  const value = request.headers.get('authorization') ?? '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
};

const authStub = (env: Cloudflare.Env) => env.AUTH.getByName('spotify-owner');

async function authRequest(env: Cloudflare.Env, path: string, body: unknown) {
  return authStub(env).fetch(`https://auth.internal${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function spotifyToken(env: Cloudflare.Env, body: URLSearchParams) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!response.ok) throw new Error(`spotify_token_${response.status}`);
  return response.json<SpotifyTokenResponse>();
}

async function refreshAccess(env: Cloudflare.Env, sessionToken: string) {
  const resolved = await authRequest(env, '/sessions/resolve', { sessionToken });
  if (!resolved.ok) return { errorStatus: 401 } as const;
  const { refreshToken } = (await resolved.json()) as { refreshToken: string };
  const token = await spotifyToken(
    env,
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  );
  if (token.refresh_token) {
    await authRequest(env, '/sessions/update', {
      sessionToken,
      refreshToken: token.refresh_token,
    });
  }
  return { token } as const;
}

function validateReturnTo(value: string | null, env: Cloudflare.Env) {
  const fallback = new URL(env.SITE_URL);
  if (!value) return fallback.toString();
  try {
    const parsed = new URL(value);
    return allowedOrigins(env).has(parsed.origin) ? parsed.toString() : fallback.toString();
  } catch {
    return fallback.toString();
  }
}

async function handleCatalog(request: Request, env: Cloudflare.Env) {
  const cached = await env.CATALOG.get('spotify:catalog', 'json');
  return json(
    cached ?? { generatedAt: null, playlistUrl: '', tracks: [] },
    200,
    { ...corsHeaders(request, env), 'cache-control': 'public, max-age=300' },
  );
}

async function handleStart(url: URL, env: Cloudflare.Env) {
  const returnTo = validateReturnTo(url.searchParams.get('returnTo'), env);
  const stateResponse = await authRequest(env, '/states', { returnTo });
  const { state } = (await stateResponse.json()) as { state: string };
  const authorize = new URL('https://accounts.spotify.com/authorize');
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: env.SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    state,
  }).toString();
  return Response.redirect(authorize.toString(), 302);
}

async function handleCallback(url: URL, env: Cloudflare.Env) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return json({ error: 'missing_oauth_parameters' }, 400);
  const stateResponse = await authRequest(env, '/states/consume', { state });
  if (!stateResponse.ok) return json({ error: 'invalid_oauth_state' }, 401);
  const { returnTo } = (await stateResponse.json()) as { returnTo: string };

  let token: SpotifyTokenResponse;
  try {
    token = await spotifyToken(
      env,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.SPOTIFY_REDIRECT_URI,
      }),
    );
  } catch (error) {
    console.error('spotify_token_exchange_failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'spotify_token_exchange_failed' }, 502);
  }
  if (!token.refresh_token) return json({ error: 'spotify_refresh_token_missing' }, 502);
  const profileResponse = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) return json({ error: 'spotify_profile_failed' }, 502);
  const profile = (await profileResponse.json()) as { id?: string };
  if (!isConfiguredOwner(profile.id, env.SPOTIFY_OWNER_ID)) {
    return json({ error: 'spotify_owner_required' }, 403);
  }

  const codeResponse = await authRequest(env, '/codes', { refreshToken: token.refresh_token });
  const { code: exchangeCode } = (await codeResponse.json()) as { code: string };
  const redirect = new URL(returnTo);
  redirect.searchParams.set('music_code', exchangeCode);
  return Response.redirect(redirect.toString(), 302);
}

async function handleExchange(request: Request, env: Cloudflare.Env) {
  if (!requireOrigin(request, env)) return json({ error: 'origin_not_allowed' }, 403);
  const { code } = (await request.json()) as { code?: string };
  if (!code) return json({ error: 'exchange_code_required' }, 400, corsHeaders(request, env));
  const response = await authRequest(env, '/codes/exchange', { code });
  return new Response(response.body, {
    status: response.status,
    headers: { 'content-type': 'application/json', ...corsHeaders(request, env) },
  });
}

async function handleRefresh(request: Request, env: Cloudflare.Env) {
  if (!requireOrigin(request, env)) return json({ error: 'origin_not_allowed' }, 403);
  const sessionToken = bearer(request);
  if (!sessionToken) return json({ error: 'session_required' }, 401, corsHeaders(request, env));
  try {
    const result = await refreshAccess(env, sessionToken);
    if ('errorStatus' in result) {
      return json({ error: 'invalid_session' }, result.errorStatus, corsHeaders(request, env));
    }
    const expiresAt = new Date(Date.now() + result.token.expires_in * 1000).toISOString();
    return json(
      { accessToken: result.token.access_token, expiresAt },
      200,
      corsHeaders(request, env),
    );
  } catch {
    return json({ error: 'spotify_refresh_failed' }, 502, corsHeaders(request, env));
  }
}

async function handleLogout(request: Request, env: Cloudflare.Env) {
  if (!requireOrigin(request, env)) return json({ error: 'origin_not_allowed' }, 403);
  const sessionToken = bearer(request);
  if (sessionToken) await authRequest(env, '/sessions/revoke', { sessionToken });
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

async function fetchPlaylistTracks(env: Cloudflare.Env, accessToken: string) {
  let next: string | null = `https://api.spotify.com/v1/playlists/${encodeURIComponent(env.SPOTIFY_PLAYLIST_ID)}/items?limit=50`;
  const tracks: CatalogTrack[] = [];
  while (next && tracks.length < 200) {
    const response = await fetch(next, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`spotify_playlist_${response.status}`);
    const page = (await response.json()) as { items?: Array<{ item?: any }>; next?: string | null };
    for (const entry of page.items ?? []) {
      const item = entry.item;
      if (!item?.id || !item?.uri) continue;
      tracks.push({
        id: item.id,
        provider: 'spotify',
        title: item.name ?? 'Untitled',
        artist: item.artists?.map((artist: { name: string }) => artist.name).join(', ') ?? '',
        coverUrl: item.album?.images?.[0]?.url ?? '',
        externalUrl: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`,
        durationMs: item.duration_ms,
        spotifyUri: item.uri,
      });
    }
    next = page.next ?? null;
  }
  return tracks;
}

async function handleCatalogRefresh(request: Request, env: Cloudflare.Env) {
  if (!requireOrigin(request, env)) return json({ error: 'origin_not_allowed' }, 403);
  const sessionToken = bearer(request);
  if (!sessionToken) return json({ error: 'session_required' }, 401, corsHeaders(request, env));
  try {
    const result = await refreshAccess(env, sessionToken);
    if ('errorStatus' in result) {
      return json({ error: 'invalid_session' }, result.errorStatus, corsHeaders(request, env));
    }
    const catalog = {
      generatedAt: new Date().toISOString(),
      playlistUrl: `https://open.spotify.com/playlist/${env.SPOTIFY_PLAYLIST_ID}`,
      tracks: await fetchPlaylistTracks(env, result.token.access_token),
    };
    await env.CATALOG.put('spotify:catalog', JSON.stringify(catalog));
    return json(catalog, 200, corsHeaders(request, env));
  } catch {
    return json({ error: 'spotify_catalog_refresh_failed' }, 502, corsHeaders(request, env));
  }
}

export default {
  async fetch(request: Request, env: Cloudflare.Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return requireOrigin(request, env)
        ? new Response(null, { status: 204, headers: corsHeaders(request, env) })
        : json({ error: 'origin_not_allowed' }, 403);
    }
    if (request.method === 'GET' && url.pathname === '/catalog/spotify') return handleCatalog(request, env);
    if (request.method === 'GET' && url.pathname === '/auth/spotify/start') return handleStart(url, env);
    if (request.method === 'GET' && url.pathname === '/auth/spotify/callback') return handleCallback(url, env);
    if (request.method === 'POST' && url.pathname === '/auth/session/exchange') return handleExchange(request, env);
    if (request.method === 'POST' && url.pathname === '/auth/session/refresh') return handleRefresh(request, env);
    if (request.method === 'DELETE' && url.pathname === '/auth/session') return handleLogout(request, env);
    if (request.method === 'POST' && url.pathname === '/catalog/spotify/refresh') return handleCatalogRefresh(request, env);
    return json({ error: 'not_found' }, 404, corsHeaders(request, env));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
