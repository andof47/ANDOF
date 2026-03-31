import type { VoiceOption, LanguageOption } from './types';

export const VOICES: VoiceOption[] = [
  { id: 'Zephyr', name: 'Zephyr', gender: 'Female' },
  { id: 'Kore', name: 'Kore', gender: 'Female' },
  { id: 'Puck', name: 'Puck', gender: 'Male' },
  { id: 'Charon', name: 'Charon', gender: 'Male' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male' },
];

export const LANGUAGES: LanguageOption[] = [
  { id: 'Original', name: 'Original (No Translation)' },
  { id: 'English', name: 'English' },
  { id: 'Portuguese', name: 'Português' },
  { id: 'Spanish', name: 'Español' },
  { id: 'French', name: 'Français' },
  { id: 'German', name: 'Deutsch' },
  { id: 'Italian', name: 'Italiano' },
];