declare namespace Cloudflare {
  interface Env {
    AUTH: DurableObjectNamespace;
    CATALOG: KVNamespace;
    ALLOWED_ORIGINS: string;
    SITE_URL: string;
    SPOTIFY_REDIRECT_URI: string;
    SPOTIFY_PLAYLIST_ID: string;
    SPOTIFY_CLIENT_ID: string;
    SPOTIFY_CLIENT_SECRET: string;
    SPOTIFY_OWNER_ID: string;
  }
}
