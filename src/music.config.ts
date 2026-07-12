import type { MusicPlayerConfig } from './components/music-player/types';

export const musicPlayerConfig = {
  spotify: {
    playlistUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    title: 'Spotify 精选歌单',
  },
  defaultProvider: 'spotify',
  // Add official Qishui share links here. Example shape:
  // { id: 'song-id', title: '歌曲名', artist: '音乐人', coverUrl: '/images/cover.jpg', externalUrl: 'https://...' }
  qishuiTracks: [],
} satisfies MusicPlayerConfig;
