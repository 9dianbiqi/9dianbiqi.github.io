import { DurableObject } from 'cloudflare:workers';

const STATE_TTL_MS = 10 * 60_000;
const CODE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

interface ExpiringValue {
  expiresAt: number;
}

interface OAuthState extends ExpiringValue {
  returnTo: string;
}

interface Credential extends ExpiringValue {
  refreshToken: string;
}

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export class AuthSession extends DurableObject<Cloudflare.Env> {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    switch (url.pathname) {
      case '/states': {
        const { returnTo } = (await request.json()) as { returnTo: string };
        const state = randomToken();
        await this.ctx.storage.put<OAuthState>(`state:${state}`, {
          returnTo,
          expiresAt: Date.now() + STATE_TTL_MS,
        });
        return json({ state });
      }
      case '/states/consume': {
        const { state } = (await request.json()) as { state: string };
        const key = `state:${state}`;
        const value = await this.ctx.storage.get<OAuthState>(key);
        if (!value || value.expiresAt <= Date.now()) {
          await this.ctx.storage.delete(key);
          return json({ error: 'invalid_state' }, 401);
        }
        await this.ctx.storage.delete(key);
        return json({ returnTo: value.returnTo });
      }
      case '/codes': {
        const { refreshToken } = (await request.json()) as { refreshToken: string };
        const code = randomToken();
        await this.ctx.storage.put<Credential>(`code:${code}`, {
          refreshToken,
          expiresAt: Date.now() + CODE_TTL_MS,
        });
        return json({ code });
      }
      case '/codes/exchange': {
        const { code } = (await request.json()) as { code: string };
        const codeKey = `code:${code}`;
        const credential = await this.ctx.storage.get<Credential>(codeKey);
        if (!credential || credential.expiresAt <= Date.now()) {
          await this.ctx.storage.delete(codeKey);
          return json({ error: 'invalid_exchange_code' }, 401);
        }
        await this.ctx.storage.delete(codeKey);
        const sessionToken = randomToken();
        const expiresAt = Date.now() + SESSION_TTL_MS;
        await this.ctx.storage.put<Credential>(`session:${sessionToken}`, {
          refreshToken: credential.refreshToken,
          expiresAt,
        });
        return json({ sessionToken, expiresAt: new Date(expiresAt).toISOString() });
      }
      case '/sessions/resolve': {
        const { sessionToken } = (await request.json()) as { sessionToken: string };
        const key = `session:${sessionToken}`;
        const credential = await this.ctx.storage.get<Credential>(key);
        if (!credential || credential.expiresAt <= Date.now()) {
          await this.ctx.storage.delete(key);
          return json({ error: 'invalid_session' }, 401);
        }
        return json({ refreshToken: credential.refreshToken, expiresAt: credential.expiresAt });
      }
      case '/sessions/update': {
        const { sessionToken, refreshToken } = (await request.json()) as {
          sessionToken: string;
          refreshToken: string;
        };
        const key = `session:${sessionToken}`;
        const credential = await this.ctx.storage.get<Credential>(key);
        if (!credential || credential.expiresAt <= Date.now()) return json({ error: 'invalid_session' }, 401);
        await this.ctx.storage.put<Credential>(key, { ...credential, refreshToken });
        return json({ ok: true });
      }
      case '/sessions/revoke': {
        const { sessionToken } = (await request.json()) as { sessionToken: string };
        await this.ctx.storage.delete(`session:${sessionToken}`);
        return new Response(null, { status: 204 });
      }
      default:
        return json({ error: 'not_found' }, 404);
    }
  }
}
