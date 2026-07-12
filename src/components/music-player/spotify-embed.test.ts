import { describe, expect, it } from 'vitest';
import { createSpotifyEmbedUrl, parseSpotifyPlaylistUrl } from './spotify-embed';

describe('Spotify Embed URL', () => {
  it('accepts an official HTTPS playlist URL', () => {
    expect(
      parseSpotifyPlaylistUrl(
        'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc',
      ),
    ).toEqual({
      playlistId: '37i9dQZF1DXcBWIGoYBM5M',
      canonicalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    });
  });

  it.each([
    'http://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    'https://example.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    'https://open.spotify.com/track/37i9dQZF1DXcBWIGoYBM5M',
    'https://open.spotify.com/playlist/not-valid!',
  ])('rejects unsafe or non-playlist input: %s', (value) => {
    expect(() => parseSpotifyPlaylistUrl(value)).toThrow('Spotify playlist URL');
  });

  it('builds the official embed URL from the validated ID', () => {
    expect(
      createSpotifyEmbedUrl(
        'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
      ),
    ).toBe(
      'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M',
    );
  });
});
