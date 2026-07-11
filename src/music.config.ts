import type { MusicPlayerConfig } from './components/music-player/types';

export const musicPlayerConfig = {
  workerBaseUrl: import.meta.env.PUBLIC_MUSIC_WORKER_URL ?? '',
  defaultProvider: 'spotify',
  // Add official Qishui share links here. Example shape:
  // { id: 'song-id', title: '歌曲名', artist: '音乐人', coverUrl: '/images/cover.jpg', externalUrl: 'https://...' }
  qishuiTracks: [],
  controls: {
    previous: true,
    next: true,
    volume: true,
  },
} satisfies MusicPlayerConfig;
