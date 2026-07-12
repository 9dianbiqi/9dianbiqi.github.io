import type { MusicTrack, QishuiTrackConfig } from './types';

function requireText(value: unknown, field: string, index: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Qishui track ${index + 1} requires a non-empty ${field}`);
  }
  return value.trim();
}

export function validateQishuiTracks(tracks: QishuiTrackConfig[]): MusicTrack[] {
  if (!Array.isArray(tracks)) throw new Error('Qishui tracks must be an array');

  return tracks.map((track, index) => {
    const externalUrl = requireText(track.externalUrl, 'externalUrl', index);
    let parsed: URL;
    try {
      parsed = new URL(externalUrl);
    } catch {
      throw new Error(`Qishui track ${index + 1} externalUrl must be an absolute HTTPS URL`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`Qishui track ${index + 1} externalUrl must be an absolute HTTPS URL`);
    }

    return {
      id: requireText(track.id, 'id', index),
      provider: 'qishui',
      title: requireText(track.title, 'title', index),
      artist: requireText(track.artist, 'artist', index),
      coverUrl: requireText(track.coverUrl, 'coverUrl', index),
      externalUrl: parsed.toString().replace(/\/$/, ''),
      ...(typeof track.durationMs === 'number' ? { durationMs: track.durationMs } : {}),
    };
  });
}
