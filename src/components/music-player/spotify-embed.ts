const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9]+$/;

export interface SpotifyPlaylistReference {
  playlistId: string;
  canonicalUrl: string;
}

export function parseSpotifyPlaylistUrl(
  value: string,
): SpotifyPlaylistReference {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Spotify playlist URL must be a valid URL');
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const playlistId =
    segments[0] === 'playlist' && segments.length === 2 ? segments[1] : '';

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'open.spotify.com' ||
    !PLAYLIST_ID_PATTERN.test(playlistId)
  ) {
    throw new Error(
      'Spotify playlist URL must use https://open.spotify.com/playlist/{playlistId}',
    );
  }

  return {
    playlistId,
    canonicalUrl: `https://open.spotify.com/playlist/${playlistId}`,
  };
}

export function createSpotifyEmbedUrl(value: string) {
  const { playlistId } = parseSpotifyPlaylistUrl(value);
  return `https://open.spotify.com/embed/playlist/${playlistId}`;
}
