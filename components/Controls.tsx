
import React from 'react';
import type { VoiceOption, PlaybackState, LanguageOption } from '../types';
import { PlayIcon, PauseIcon, StopIcon, SummarizeIcon, LoadingIcon, ChevronDownIcon, ClearIcon, DownloadIcon, LinkIcon } from './Icons';

interface ControlsProps {
  onPlayPause: () => void;
  onStop: () => void;
  onSummarize: () => void;
  onClear: () => void;
  onExportAudio: () => void;
  isExporting: boolean;
  exportProgress: number | null;
  playbackState: PlaybackState;
  isLoadingTTS: boolean;
  text: string;
  summary: string;
  isLoadingSummary: boolean;
  isLoadingFile: boolean;
  isSummaryPlaying: boolean;
  selectedVoice: VoiceOption;
  onVoiceChange: (voice: VoiceOption) => void;
  voices: VoiceOption[];
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  languages: LanguageOption[];
  selectedLanguage: LanguageOption;
  onLanguageChange: (language: LanguageOption) => void;
  isUrlInput: boolean;
  isLoadingUrl: boolean;
  onFetchUrl: () => void;
}

const Button: React.FC<{
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
}> = ({ onClick, disabled, children, className, ariaLabel }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className={`px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 ${className}`}
  >
    {children}
  </button>
);


export const Controls: React.FC<ControlsProps> = ({
  onPlayPause,
  onStop,
  onSummarize,
  onClear,
  onExportAudio,
  isExporting,
  exportProgress,
  playbackState,
  isLoadingTTS,
  text,
  summary,
  isLoadingSummary,
  isLoadingFile,
  isSummaryPlaying,
  selectedVoice,
  onVoiceChange,
  voices,
  playbackSpeed,
  onPlaybackSpeedChange,
  languages,
  selectedLanguage,
  onLanguageChange,
  isUrlInput,
  isLoadingUrl,
  onFetchUrl
}) => {
  const isPlaying = playbackState === 'playing';
  const isPaused = playbackState === 'paused';
  const isStopped = playbackState === 'stopped';
  const isBusyForClear = isLoadingTTS || isLoadingSummary || isLoadingFile || isLoadingUrl || playbackState !== 'stopped' || isSummaryPlaying || isExporting;
  const isBusyForExport = isPlaying || isPaused || isLoadingFile || isLoadingUrl || isSummaryPlaying || isLoadingTTS || isLoadingSummary || !text.trim() || isUrlInput;
  const nothingToClear = !text.trim() && !summary.trim();
  const generalDisabled = isLoadingFile || isLoadingUrl || isSummaryPlaying || isExporting;

  // Crucial fix: Do NOT disable the Stop button if isLoadingTTS is true. 
  // The user must be able to interrupt the loading process.
  const stopDisabled = (isStopped && !isSummaryPlaying && !isLoadingTTS) || generalDisabled;

  return (
    <div className="space-y-6 p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-4">
        {isUrlInput ? (
           <Button
              onClick={onFetchUrl}
              disabled={generalDisabled || isLoadingUrl || !text.trim()}
              className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-md hover:shadow-lg focus:ring-indigo-500 flex-grow sm:flex-grow-0"
              ariaLabel="Fetch Article"
            >
              {isLoadingUrl ? <LoadingIcon /> : <LinkIcon />}
              <span>{isLoadingUrl ? 'Fetching...' : 'Fetch Article'}</span>
            </Button>
        ) : (
          <Button
            onClick={onPlayPause}
            disabled={isLoadingTTS || generalDisabled}
            className="bg-primary hover:bg-primary-dark text-white shadow-md hover:shadow-lg focus:ring-primary flex-grow sm:flex-grow-0"
            ariaLabel={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoadingTTS ? <LoadingIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
            <span>{isLoadingTTS ? 'Processing...' : isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Play'}</span>
          </Button>
        )}
        <Button
          onClick={onStop}
          disabled={stopDisabled}
          className="bg-slate-500 hover:bg-slate-600 text-white shadow-md hover:shadow-lg focus:ring-slate-500 flex-grow sm:flex-grow-0"
          ariaLabel="Stop"
        >
          <StopIcon />
          <span>Stop</span>
        </Button>
        <Button
          onClick={onSummarize}
          disabled={!text.trim() || isLoadingSummary || isPlaying || isPaused || generalDisabled || isUrlInput}
          className="bg-secondary hover:bg-secondary-dark text-white shadow-md hover:shadow-lg focus:ring-secondary flex-grow sm:flex-grow-0"
          ariaLabel="Summarize"
        >
          {isLoadingSummary ? <LoadingIcon /> : <SummarizeIcon />}
          <span>{isLoadingSummary ? 'Working...' : 'Summarize'}</span>
        </Button>
        <Button
          onClick={onExportAudio}
          disabled={isBusyForExport || isExporting}
          className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg focus:ring-emerald-500 flex-grow sm:flex-grow-0 relative overflow-hidden"
          ariaLabel="Export Audio"
        >
          {isExporting && exportProgress !== null && (
            <div
              className="absolute top-0 left-0 h-full bg-emerald-700/50 transition-all duration-300"
              style={{ width: `${exportProgress}%` }}
              aria-hidden="true"
            />
          )}
          <span className="relative z-10 flex items-center justify-center gap-2">
            {isExporting ? <LoadingIcon /> : <DownloadIcon />}
            <span>
              {isExporting && exportProgress !== null
                ? `Exporting... (${Math.round(exportProgress)}%)`
                : 'Export Audio'}
            </span>
          </span>
        </Button>
         <Button
          onClick={onClear}
          disabled={isBusyForClear || nothingToClear}
          className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-sm hover:shadow-md focus:ring-slate-400 flex-grow sm:flex-grow-0"
          ariaLabel="Clear"
        >
          <ClearIcon />
          <span>Clear</span>
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
            <label htmlFor="voice-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Voice</label>
            <select
            id="voice-select"
            value={selectedVoice.id}
            onChange={(e) => onVoiceChange(voices.find(v => v.id === e.target.value) || voices[0])}
            disabled={isPlaying || isPaused || generalDisabled}
            className="w-full appearance-none bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
            >
            {voices.map(voice => (
                <option key={voice.id} value={voice.id}>{voice.name} ({voice.gender})</option>
            ))}
            </select>
            <ChevronDownIcon />
        </div>
        <div className="relative">
            <label htmlFor="language-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Output Language</label>
            <select
            id="language-select"
            value={selectedLanguage.id}
            onChange={(e) => onLanguageChange(languages.find(l => l.id === e.target.value) || languages[0])}
            disabled={isPlaying || isPaused || generalDisabled}
            className="w-full appearance-none bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
            >
            {languages.map(lang => (
                <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
            </select>
            <ChevronDownIcon />
        </div>
        <div>
          <label htmlFor="speed-control" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Speed: {playbackSpeed}x
          </label>
          <input
            id="speed-control"
            type="range"
            min="0.5"
            max="2"
            step="0.25"
            value={playbackSpeed}
            onChange={(e) => onPlaybackSpeedChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>
    </div>
  );
};
