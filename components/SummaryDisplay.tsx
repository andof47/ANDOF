
import React from 'react';
import { LoadingIcon, PlayIcon, PauseIcon, StopIcon, SpeakerWaveIcon, SummarizeIcon } from './Icons';
import type { PlaybackState } from '../types';

interface SummaryDisplayProps {
  summary: string;
  isLoading: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  playbackState: PlaybackState;
  isLoadingTTS: boolean;
  isMainPlaying: boolean;
}

const SummaryButton: React.FC<{
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  ariaLabel: string;
}> = ({ onClick, disabled, children, ariaLabel }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-white dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
  >
    {children}
  </button>
);


export const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ 
  summary, 
  isLoading,
  onPlayPause,
  onStop,
  playbackState,
  isLoadingTTS,
  isMainPlaying,
}) => {

  const isPlaying = playbackState === 'playing';
  const isPaused = playbackState === 'paused';
  const isStopped = playbackState === 'stopped';

  return (
    <div className="p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[300px] lg:min-h-[464px] flex flex-col shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-secondary dark:text-secondary-light">VoxMind Insight</h2>
            {isLoading && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary animate-pulse uppercase tracking-wider font-bold">Deep Thinking</span>}
        </div>
        <div className="flex items-center gap-2">
            <SummaryButton
                onClick={onPlayPause}
                disabled={!summary || isLoading || isLoadingTTS || isMainPlaying}
                ariaLabel={isPlaying ? 'Pause Summary' : 'Play Summary'}
            >
                {isLoadingTTS ? <LoadingIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
            </SummaryButton>
            <SummaryButton
                onClick={onStop}
                disabled={(isStopped && !isLoadingTTS) || isLoading}
                ariaLabel="Stop Summary"
            >
                <StopIcon />
            </SummaryButton>
        </div>
      </div>
      <div className="flex-grow flex flex-col">
        {isLoading ? (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4 text-slate-500 dark:text-slate-400 text-center max-w-[250px]">
                    <div className="relative">
                        <LoadingIcon />
                        <div className="absolute inset-0 animate-ping opacity-20 bg-secondary rounded-full"></div>
                    </div>
                    <div>
                        <p className="font-bold text-slate-700 dark:text-slate-200">AI está raciocinando...</p>
                        <p className="text-xs mt-1">Utilizando Gemini 3 Pro para uma análise profunda do seu conteúdo.</p>
                    </div>
                </div>
            </div>
        ) : summary ? (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                <article className="prose prose-slate dark:prose-invert max-w-none flex-grow text-sm leading-relaxed">
                {summary.split('\n').map((paragraph, index) => (
                    paragraph.trim() && <p key={index} className="mb-3">{paragraph}</p>
                ))}
                </article>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                    <button
                        onClick={onPlayPause}
                        disabled={isLoadingTTS || isMainPlaying}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-secondary hover:bg-secondary-dark text-white shadow-lg hover:shadow-secondary/20 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 w-full sm:w-auto active:scale-95"
                        aria-label={isPlaying ? 'Pause Reading' : 'Read Summary Aloud'}
                    >
                        {isLoadingTTS ? <LoadingIcon /> : isPlaying ? <PauseIcon /> : <SpeakerWaveIcon />}
                        <span className="font-bold">
                            {isLoadingTTS ? 'Sintonizando Voz...' : isPlaying ? 'Pausar' : isPaused ? 'Retomar' : 'Ouvir Insight'}
                        </span>
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex items-center justify-center h-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="text-center p-6">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                        {/* Fix: Added missing SummarizeIcon component reference */}
                        <SummarizeIcon className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                        Clique em "Summarize" para gerar um resumo inteligente com IA.
                    </p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
