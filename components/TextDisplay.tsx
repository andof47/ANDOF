
import React from 'react';

interface TextDisplayProps {
  text: string;
  highlightedWordIndex: number;
}

export const TextDisplay: React.FC<TextDisplayProps> = ({ text, highlightedWordIndex }) => {
  // Use a regex that splits by one or more whitespace characters (\s+) but keeps them in the array using a capturing group.
  // This preserves all original spacing and newlines.
  const segments = text.split(/(\s+)/);
  let wordCounter = 0;

  return (
    <div
      // These classes should perfectly match TextAreaInput to ensure a seamless visual replacement
      className="w-full flex-grow p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-h-[300px] lg:min-h-[400px] text-base overflow-auto whitespace-pre-wrap leading-relaxed"
    >
      {segments.map((segment, index) => {
        // If the segment is not just whitespace, it's a word.
        if (/\S/.test(segment)) {
          const isHighlighted = wordCounter === highlightedWordIndex;
          const currentWordIdx = wordCounter;
          wordCounter++;
          return (
            <span
              key={`${index}-${currentWordIdx}`}
              className={isHighlighted ? 'bg-yellow-300 dark:bg-yellow-500 rounded transition-colors duration-150' : ''}
            >
              {segment}
            </span>
          );
        } else {
          // It's whitespace, render it as is to preserve formatting.
          return <React.Fragment key={`${index}-space`}>{segment}</React.Fragment>;
        }
      })}
    </div>
  );
};
