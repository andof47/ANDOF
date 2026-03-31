
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { TextAreaInput } from './components/TextAreaInput';
import { Controls } from './components/Controls';
import { SummaryDisplay } from './components/SummaryDisplay';
import { generateSpeech, generateSummary, translateText, extractTextFromImage, fetchArticleContent } from './services/geminiService';
import { decodeBase64, createAudioBufferFromPCM, createMp3File } from './utils/audio';
import { parseFile } from './utils/fileParser';
import type { VoiceOption, PlaybackState, LanguageOption } from './types';
import { VOICES, LANGUAGES } from './constants';
import { FileInput } from './components/FileInput';
import { LoadingIcon } from './components/Icons';
import { TextDisplay } from './components/TextDisplay';

const WORDS_PER_PAGE = 250; // Industry standard estimate

/**
 * Intelligently chunks text into smaller segments suitable for a TTS API.
 * This version enforces a hard character limit and tries to split at sentence endings
 * for more natural-sounding audio and to prevent API payload errors.
 * @param text The full text to process.
 * @param chunkSize The desired maximum size of a chunk in characters.
 * @returns An array of text chunks.
 */
const createSmartChunks = (text: string, chunkSize: number = 4000): string[] => {
    if (!text || text.trim().length === 0) return [];

    const chunks: string[] = [];
    let remainingText = text;

    while (remainingText.length > 0) {
        if (remainingText.length <= chunkSize) {
            chunks.push(remainingText);
            break;
        }

        // Find a suitable split point within the chunk size
        let splitPos = -1;
        let tempChunk = remainingText.substring(0, chunkSize);

        // Try to find the last sentence-ending punctuation
        const sentenceEndings = ['.', '?', '!', '\n'];
        for (const punctuation of sentenceEndings) {
            const lastIndex = tempChunk.lastIndexOf(punctuation);
            if (lastIndex > splitPos) {
                splitPos = lastIndex;
            }
        }

        // If no sentence end found, try to find the last space
        if (splitPos === -1) {
            splitPos = tempChunk.lastIndexOf(' ');
        }
        
        // If no space is found either, force a split at the chunk size
        if (splitPos === -1) {
            splitPos = chunkSize -1;
        }

        // Push the chunk and update the remaining text
        chunks.push(remainingText.substring(0, splitPos + 1));
        remainingText = remainingText.substring(splitPos + 1);
    }
    
    // Filter out any empty chunks that might have been created
    return chunks.filter(chunk => chunk.trim().length > 0);
};


const App: React.FC = () => {
  // Main text state
  const [text, setText] = useState<string>('Welcome to VoxMind AI. Paste any text here and I will read it for you. You can also ask me to summarize it.');
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [isLoadingTTS, setIsLoadingTTS] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  
  // Chunking and word highlighting state
  const [textChunks, setTextChunks] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [isProcessingChunks, setIsProcessingChunks] = useState<boolean>(false);
  const isProcessingChunksRef = useRef<boolean>(false); // Ref to prevent stale state in closures
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number>(-1);
  const wordOffsetRef = useRef<number>(0);
  const textToPlayRef = useRef<string>(''); // Holds the full text being played (after translation)
  
  // Summary state
  const [summary, setSummary] = useState<string>('');
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [summaryPlaybackState, setSummaryPlaybackState] = useState<PlaybackState>('stopped');
  const [isSummaryLoadingTTS, setIsSummaryLoadingTTS] = useState<boolean>(false);

  // Shared state
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICES[0]);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  // Language, file, and metrics state
  const [outputLanguage, setOutputLanguage] = useState<LanguageOption>(LANGUAGES[0]); // LANGUAGES[0] is now 'Original'
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);
  const [isUrlInput, setIsUrlInput] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState<number>(0);
  const [pageCount, setPageCount] = useState<number>(0);
  const [isPageCountExact, setIsPageCountExact] = useState<boolean>(false);
  
  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mainAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const summaryAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const highlightTimeoutIdsRef = useRef<number[]>([]);

  useEffect(() => {
    const initAudioContext = () => {
        if (!audioContextRef.current) {
            try {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) {
                setError("AudioContext is not supported by your browser.");
            }
        }
        document.removeEventListener('click', initAudioContext);
    };
    document.addEventListener('click', initAudioContext);
    
    return () => {
        document.removeEventListener('click', initAudioContext);
        audioContextRef.current?.close();
    };
  }, []);
  
  // Effect to calculate metrics for pasted/typed text
  useEffect(() => {
    // Metrics for file uploads are handled in `handleFileSelect`
    if (fileName) return;

    if (!text.trim()) {
      setWordCount(0);
      setPageCount(0);
      return;
    }
    const words = text.match(/\S+/g)?.length || 0;
    setWordCount(words);
    setPageCount(Math.ceil(words / WORDS_PER_PAGE) || (words > 0 ? 1 : 0));
    setIsPageCountExact(false);
  }, [text, fileName]);

  const stopMainPlayback = useCallback(() => {
    if (highlightTimeoutIdsRef.current.length > 0) {
        highlightTimeoutIdsRef.current.forEach(clearTimeout);
        highlightTimeoutIdsRef.current = [];
    }
    if (mainAudioSourceRef.current) {
      mainAudioSourceRef.current.onended = null;
      mainAudioSourceRef.current.stop();
      mainAudioSourceRef.current = null;
    }
    setPlaybackState('stopped');
    setHighlightedWordIndex(-1);
    wordOffsetRef.current = 0;
    setIsProcessingChunks(false);
    isProcessingChunksRef.current = false; // Use ref for immediate effect
    setCurrentChunkIndex(0);
    setTextChunks([]);
    // Crucial: Reset loading state immediately to unblock UI
    setIsLoadingTTS(false); 
  }, []);

  const stopSummaryPlayback = useCallback(() => {
    if (summaryAudioSourceRef.current) {
      summaryAudioSourceRef.current.onended = null;
      summaryAudioSourceRef.current.stop();
      summaryAudioSourceRef.current = null;
    }
    setSummaryPlaybackState('stopped');
    setIsSummaryLoadingTTS(false);
  }, []);
  
  const stopAllPlayback = useCallback(() => {
    stopMainPlayback();
    stopSummaryPlayback();
    if (audioContextRef.current?.state === 'running') {
      audioContextRef.current.suspend();
    }
  }, [stopMainPlayback, stopSummaryPlayback]);
  
  // The core function for chunk processing, now with translation and highlighting logic inside.
  const processAndPlayNextChunk = useCallback(async (chunks: string[], index: number) => {
    if (index >= chunks.length || !isProcessingChunksRef.current) {
        // If we are done OR if user cancelled, stop everything.
        stopMainPlayback();
        return;
    }
    
    setCurrentChunkIndex(index);
    setIsLoadingTTS(true);
    
    try {
        const originalChunk = chunks[index];
        if (!originalChunk.trim()) {
            processAndPlayNextChunk(chunks, index + 1);
            return;
        }

        if (!audioContextRef.current) throw new Error("Audio context not initialized.");
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        
        // Cancellation check before expensive translation
        if (!isProcessingChunksRef.current) {
            stopMainPlayback();
            return;
        }

        let chunkToProcess: string;
        try {
            // Always translate the chunk to the target output language.
            // This ensures linguistic consistency, as the translation model will handle
            // text that's already in the target language by returning it unchanged.
            chunkToProcess = await translateText(originalChunk, outputLanguage.id);
        } catch (translationError) {
             console.error(translationError);
            setError(`Failed to translate a text segment. Error: ${(translationError as Error).message}`);
            stopMainPlayback();
            return;
        }
        
        // Cancellation check after translation/before TTS
        if (!isProcessingChunksRef.current) {
            stopMainPlayback();
            return;
        }

        if(index === 0) {
            textToPlayRef.current = chunkToProcess;
        } else {
            textToPlayRef.current += ` ${chunkToProcess}`;
        }
        
        const base64Audio = await generateSpeech(chunkToProcess, selectedVoice.id, outputLanguage.id);

        // Cancellation check after TTS/before Audio creation
        if (!isProcessingChunksRef.current) {
            stopMainPlayback();
            return;
        }

        const audioData = decodeBase64(base64Audio);
        const audioBuffer = createAudioBufferFromPCM(audioData, audioContextRef.current);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackSpeed;
        source.connect(audioContextRef.current.destination);
        source.start(0);
        
        mainAudioSourceRef.current = source;
        setIsLoadingTTS(false);
        setPlaybackState('playing');

        // --- New Highlighting Logic ---
        // Clear any timeouts from a previous (paused) chunk
        if (highlightTimeoutIdsRef.current.length > 0) {
            highlightTimeoutIdsRef.current.forEach(clearTimeout);
            highlightTimeoutIdsRef.current = [];
        }

        // Fix: Explicitly type wordsInThisChunk as string[] to prevent TypeScript from incorrectly inferring it as never[].
        const wordsInThisChunk: string[] = chunkToProcess.match(/\S+/g) || [];

        if (wordsInThisChunk.length > 0 && audioBuffer.duration > 0) {
            // This heuristic provides more accurate timing by weighting words based on length and punctuation.
            const punctuationWeight = 2.5; // Heuristic: a comma/period adds a pause equivalent to ~2.5 characters.
            const charWeight = 1;

            // 1. Calculate total weight of the chunk
            const totalWeight = wordsInThisChunk.reduce((acc, word) => {
                let weight = word.length * charWeight;
                if (/[.,?!;:]$/.test(word)) {
                    weight += punctuationWeight;
                }
                return acc + weight;
            }, 0);

            // 2. Calculate how long each "unit" of weight should last in ms
            const durationPerWeight = (audioBuffer.duration * 1000) / totalWeight;

            // 3. Schedule each word's highlight with a dynamically calculated delay
            let cumulativeDelay = 0;
            wordsInThisChunk.forEach((word, localWordIndex) => {
                // Schedule the highlight to appear after the cumulative delay of previous words.
                const timeoutId = window.setTimeout(() => {
                    if (isProcessingChunksRef.current) { // Check if playback is still active
                        setHighlightedWordIndex(wordOffsetRef.current + localWordIndex);
                    }
                }, cumulativeDelay / playbackSpeed); // Adjust for playback speed

                highlightTimeoutIdsRef.current.push(timeoutId);

                // Calculate the duration of the current word to add to the next cumulative delay
                let wordWeight = word.length * charWeight;
                if (/[.,?!;:]$/.test(word)) {
                    wordWeight += punctuationWeight;
                }
                cumulativeDelay += wordWeight * durationPerWeight;
            });
        }

        source.onended = () => {
            // Clear any lingering timeouts before moving to the next chunk
            if (highlightTimeoutIdsRef.current.length > 0) {
                highlightTimeoutIdsRef.current.forEach(clearTimeout);
                highlightTimeoutIdsRef.current = [];
            }
            wordOffsetRef.current += wordsInThisChunk.length;
            if (isProcessingChunksRef.current) {
              processAndPlayNextChunk(chunks, index + 1);
            }
        };

    } catch (err) {
        // If the user stopped playback manually, suppress errors (likely due to cancellation/interruption)
        if (!isProcessingChunksRef.current) return;

        console.error(err);
        const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred.';
        setError(`Failed to generate audio for a text segment. ${errorMessage}`);
        stopMainPlayback();
    }
  }, [selectedVoice, outputLanguage, playbackSpeed, stopMainPlayback]);
  
  
  const handlePlayPause = async () => {
    setError(null);
    stopSummaryPlayback();
  
    if (playbackState === 'playing') {
      audioContextRef.current?.suspend();
      if (highlightTimeoutIdsRef.current.length > 0) {
          highlightTimeoutIdsRef.current.forEach(clearTimeout);
          highlightTimeoutIdsRef.current = [];
      }
      setPlaybackState('paused');
    } else if (playbackState === 'paused') {
      await audioContextRef.current?.resume();
      setPlaybackState('playing');
      // Note: Highlighting does not resume mid-chunk. It will restart on the next chunk.
      // This is a limitation of the timing method without word-level timestamps from the API.
    } else { // 'stopped' state
      if (!text.trim()) {
        setError('Please enter some text to read.');
        return;
      }
      stopAllPlayback(); // Resets all state including word offsets
      setIsLoadingTTS(true);
      
      try {
        const chunks = createSmartChunks(text);
        if(chunks.length === 0) {
            setError('No text to play.');
            setIsLoadingTTS(false);
            return;
        }
        
        setTextChunks(chunks);
        setIsProcessingChunks(true);
        isProcessingChunksRef.current = true;
        setCurrentChunkIndex(0);
        textToPlayRef.current = ''; 
        wordOffsetRef.current = 0;
        setHighlightedWordIndex(-1);

        processAndPlayNextChunk(chunks, 0);
  
      } catch (err) {
        console.error(err);
        const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred.';
        setError(`Failed to prepare audio. ${errorMessage}`);
        stopMainPlayback();
        setIsLoadingTTS(false);
      }
    }
  };

  const playSummaryAudio = async () => {
    setIsSummaryLoadingTTS(true);
    try {
      if (!audioContextRef.current) throw new Error("Audio context not initialized.");
      if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
      }

      const base64Audio = await generateSpeech(summary, selectedVoice.id, outputLanguage.id);
      const audioData = decodeBase64(base64Audio);
      const audioBuffer = createAudioBufferFromPCM(audioData, audioContextRef.current);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackSpeed;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      
      source.onended = () => {
        setSummaryPlaybackState('stopped');
        summaryAudioSourceRef.current = null;
      };
      summaryAudioSourceRef.current = source;
      setSummaryPlaybackState('playing');
    } catch (err) {
      console.error(err);
      const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate summary audio. ${errorMessage}`);
      setSummaryPlaybackState('stopped');
    } finally {
      setIsSummaryLoadingTTS(false);
    }
  };

  const handlePlayPauseSummary = async () => {
    if (!summary.trim()) {
      setError('No summary available to play.');
      return;
    }
    setError(null);
    stopMainPlayback();

    if (summaryPlaybackState === 'playing') {
        audioContextRef.current?.suspend();
        setSummaryPlaybackState('paused');
    } else if (summaryPlaybackState === 'paused') {
        audioContextRef.current?.resume();
        setSummaryPlaybackState('playing');
    } else {
        await playSummaryAudio();
    }
  };
  
  const handleSummarize = useCallback(async () => {
    if (!text.trim()) {
      setError('Please enter some text to summarize.');
      return;
    }
    setError(null);
    stopAllPlayback();
    setIsLoadingSummary(true);
    setSummary('');

    try {
      const result = await generateSummary(text, outputLanguage.id);
      setSummary(result);
    } catch (err) {
      console.error(err);
      setError('Failed to generate summary. Please check your API key and try again.');
    } finally {
      setIsLoadingSummary(false);
    }
  }, [text, outputLanguage, stopAllPlayback]);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoadingFile(true);
    setError(null);
    setSummary('');
    stopAllPlayback();

    const imageTypes = ['image/jpeg', 'image/png'];
    const isImage = imageTypes.includes(file.type) || /\.(jpe?g|png)$/i.test(file.name);

    let fileContent = '';
    let pageInfo: number | undefined;

    try {
        if (isImage) {
            setLoadingMessage('Extracting text from image...');
            fileContent = await extractTextFromImage(file);
            if (!fileContent.trim()) {
                throw new Error("No text could be found in the image.");
            }
        } else {
            setLoadingMessage('Parsing file...');
            const { content, pages } = await parseFile(file, setLoadingMessage);
            fileContent = content;
            pageInfo = pages;
        }

        setText(fileContent);
        setFileName(file.name);
        setIsUrlInput(false); // Reset URL state when a file is loaded

        const words = fileContent.match(/\S+/g)?.length || 0;
        setWordCount(words);

        if (pageInfo) {
            setPageCount(pageInfo);
            setIsPageCountExact(true);
        } else {
            setPageCount(Math.ceil(words / WORDS_PER_PAGE) || (words > 0 ? 1 : 0));
            setIsPageCountExact(false);
        }

    } catch (err) {
        const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred while processing the file.';
        setError(errorMessage);
        setFileName(null);
        setText('');
        setWordCount(0);
        setPageCount(0);
    } finally {
        setIsLoadingFile(false);
        setLoadingMessage('');
    }
}, [stopAllPlayback]);

  const handleFetchUrl = useCallback(async () => {
    if (!text.trim() || !isUrlInput) {
      setError('Please paste a valid URL to fetch.');
      return;
    }
    
    setIsLoadingUrl(true);
    setError(null);
    setSummary('');
    stopAllPlayback();
    setLoadingMessage('Fetching article from web...');

    try {
      const articleText = await fetchArticleContent(text); // 'text' state holds the URL
      if (!articleText.trim()){
          throw new Error("Extracted content was empty. The article might be behind a paywall or in a format the AI cannot read.");
      }
      const sourceUrl = text;
      setText(articleText);
      setFileName(sourceUrl);
      setIsUrlInput(false); // It's no longer a URL, it's the article text
    } catch (err) {
      const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred while fetching the URL.';
      setError(errorMessage);
      setFileName(null);
      setText('');
      setWordCount(0);
      setPageCount(0);
    } finally {
      setIsLoadingUrl(false);
    }
  }, [text, isUrlInput, stopAllPlayback]);

  const handleClear = useCallback(() => {
    stopAllPlayback();
    setText('');
    setSummary('');
    setFileName(null);
    setError(null);
    setWordCount(0);
    setPageCount(0);
    setIsUrlInput(false);
  }, [stopAllPlayback]);

  const handleExportAudio = useCallback(async () => {
    if (!text.trim()) {
      setError('There is no text to export.');
      return;
    }
    setError(null);
    stopAllPlayback();
    setIsExporting(true);
    setExportProgress(0);

    try {
      const translatedText = await translateText(text, outputLanguage.id);
      const chunks = createSmartChunks(translatedText);
      
      if (chunks.length === 0) {
        throw new Error("No content to export after processing.");
      }

      const pcmChunks: Uint8Array[] = [];
      let completedChunks = 0;

      // Process chunks sequentially to avoid hitting rate limits or causing timeouts
      for (let i = 0; i < chunks.length; i++) {
        const base64Audio = await generateSpeech(chunks[i], selectedVoice.id, outputLanguage.id);
        pcmChunks.push(decodeBase64(base64Audio));
        completedChunks++;
        setExportProgress((completedChunks / chunks.length) * 100);
      }
      
      const concatenatedPcm = new Uint8Array(pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of pcmChunks) {
        concatenatedPcm.set(chunk, offset);
        offset += chunk.length;
      }
      
      const mp3Blob = createMp3File(concatenatedPcm, 24000);

      const url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = url;
      const safeFileName = (fileName || 'voxmind-audio').replace(/\.[^/.]+$/, "");
      a.download = `${safeFileName}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred during export.';
      setError(`Failed to export audio. ${errorMessage}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [text, outputLanguage, selectedVoice, stopAllPlayback, fileName]);


  useEffect(() => {
    if (mainAudioSourceRef.current) {
        mainAudioSourceRef.current.playbackRate.value = playbackSpeed;
    }
    if (summaryAudioSourceRef.current) {
      summaryAudioSourceRef.current.playbackRate.value = playbackSpeed;
    }
  }, [playbackSpeed]);


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors duration-300">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="text-2xl font-bold text-primary dark:text-primary-light">Your Text</h2>
              <FileInput onFileSelect={handleFileSelect} onError={setError} disabled={playbackState !== 'stopped' || isLoadingFile || isLoadingUrl || summaryPlaybackState !== 'stopped'} />
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 min-h-[40px] flex flex-col justify-center">
              {isLoadingFile || isLoadingUrl ? (
                <span className="inline-flex items-center gap-1"><LoadingIcon /> {loadingMessage}</span>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {fileName && <span className="truncate max-w-full">Source: <strong>{fileName}</strong></span>}
                  </div>
                   <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {wordCount > 0 && (
                            <span>{new Intl.NumberFormat().format(wordCount)} Words</span>
                        )}
                        {wordCount > 0 && pageCount > 0 && (
                             <span className="text-slate-300 dark:text-slate-600">|</span>
                        )}
                        {pageCount > 0 && (
                           <span>
                                {pageCount}{" "}
                                {isPageCountExact
                                    ? (pageCount > 1 ? "Pages" : "Page")
                                    : `Page${pageCount !== 1 ? "s" : ""} (Est.)`}
                           </span>
                        )}
                    </div>
                  {isProcessingChunks && textChunks.length > 0 && (
                     <div className="font-semibold text-primary dark:text-primary-light mt-2">
                        Progress: Segment {currentChunkIndex + 1} / {textChunks.length}
                    </div>
                  )}
                </>
              )}
            </div>

            {playbackState === 'stopped' ? (
              <TextAreaInput value={text} onChange={(e) => { 
                  const newText = e.target.value;
                  setText(newText); 
                  setFileName(null);
                  stopAllPlayback(); 
                  try {
                    // Check if the input is a valid URL without spaces
                    if (newText.startsWith('http') && !/\s/.test(newText)) {
                        new URL(newText);
                        setIsUrlInput(true);
                    } else {
                        setIsUrlInput(false);
                    }
                  } catch (_) {
                    setIsUrlInput(false);
                  }
              }} />
            ) : (
              <TextDisplay text={textToPlayRef.current} highlightedWordIndex={highlightedWordIndex} />
            )}

            {error && <div className="text-red-500 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">{error}</div>}
            <Controls
              onPlayPause={handlePlayPause}
              onStop={stopAllPlayback}
              onSummarize={handleSummarize}
              onClear={handleClear}
              onExportAudio={handleExportAudio}
              isExporting={isExporting}
              exportProgress={exportProgress}
              playbackState={playbackState}
              isLoadingTTS={isLoadingTTS}
              text={text}
              summary={summary}
              isLoadingSummary={isLoadingSummary}
              isLoadingFile={isLoadingFile}
              isSummaryPlaying={summaryPlaybackState !== 'stopped'}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              voices={VOICES}
              playbackSpeed={playbackSpeed}
              onPlaybackSpeedChange={setPlaybackSpeed}
              languages={LANGUAGES}
              selectedLanguage={outputLanguage}
              onLanguageChange={setOutputLanguage}
              isUrlInput={isUrlInput}
              onFetchUrl={handleFetchUrl}
              isLoadingUrl={isLoadingUrl}
            />
          </div>
          <div className="flex flex-col gap-2">
            <SummaryDisplay 
              summary={summary} 
              isLoading={isLoadingSummary}
              onPlayPause={handlePlayPauseSummary}
              onStop={stopSummaryPlayback}
              playbackState={summaryPlaybackState}
              isLoadingTTS={isSummaryLoadingTTS}
              isMainPlaying={playbackState !== 'stopped'}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
