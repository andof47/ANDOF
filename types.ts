export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
}

export interface LanguageOption {
  id: string; // e.g., 'English', 'Portuguese'
  name: string; // e.g., 'English', 'Português'
}

export type PlaybackState = 'playing' | 'paused' | 'stopped';