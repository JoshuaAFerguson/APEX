import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export interface StreamingTextProps {
  text: string;
  speed?: number; // Characters per second
  isComplete?: boolean;
  showCursor?: boolean;
  onComplete?: () => void;
  width?: number;
  maxLines?: number;
}

/**
 * Streaming text component that types out text character by character
 */
export function StreamingText({
  text,
  speed = 50, // Default to 50 characters per second
  isComplete = false,
  showCursor = true,
  onComplete,
  width,
  maxLines,
}: StreamingTextProps): React.ReactElement {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBlinkCursor, setShowBlinkCursor] = useState(true);

  // Streaming effect
  useEffect(() => {
    if (isComplete) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
      return undefined;
    }

    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.substring(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 1000 / speed);

      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && onComplete) {
      onComplete();
    }
    return undefined;
  }, [currentIndex, text, speed, isComplete, onComplete]);

  // Cursor blinking effect
  useEffect(() => {
    if (!showCursor) return;

    const interval = setInterval(() => {
      setShowBlinkCursor(prev => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [showCursor]);

  // Format text with line wrapping
  const formatText = (content: string): string[] => {
    if (!width) return content.split('\n');

    const lines: string[] = [];
    const textLines = content.split('\n');

    textLines.forEach(line => {
      if (line.length <= width) {
        lines.push(line);
      } else {
        // Wrap long lines
        for (let i = 0; i < line.length; i += width) {
          lines.push(line.substring(i, i + width));
        }
      }
    });

    return lines;
  };

  const lines = formatText(displayedText);
  const displayLines = maxLines ? lines.slice(-maxLines) : lines;
  const shouldShowCursor = showCursor && showBlinkCursor && (currentIndex >= text.length || !isComplete);

  return (
    <Box flexDirection="column" width={width}>
      {displayLines.map((line, index) => (
        <Text key={index}>
          {line}
          {index === displayLines.length - 1 && shouldShowCursor && (
            <Text color="gray">▊</Text>
          )}
        </Text>
      ))}
    </Box>
  );
}

export interface StreamingResponseProps {
  content: string;
  agent?: string;
  isStreaming?: boolean;
  isComplete?: boolean;
  onComplete?: () => void;
  width?: number;
}

/**
 * Streaming response component for agent responses
 */
export function StreamingResponse({
  content,
  agent,
  isStreaming = false,
  isComplete = false,
  onComplete,
  width = 80,
}: StreamingResponseProps): React.ReactElement {
  const [chunks, setChunks] = useState<string[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);

  useEffect(() => {
    if (isComplete) {
      setChunks([content]);
      setCurrentChunk(0);
      return;
    }

    // Simulate streaming by splitting content into chunks
    if (isStreaming && content !== chunks.join('')) {
      const newChunks = content.match(/.{1,10}/g) || [content];
      setChunks(newChunks);
      setCurrentChunk(0);
    }
  }, [content, isStreaming, isComplete]);

  const displayContent = isComplete ? content : chunks.slice(0, currentChunk + 1).join('');

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Agent header */}
      {agent && (
        <Box marginBottom={1}>
          <Text color="blue" bold>
            {agent}
          </Text>
          {isStreaming && !isComplete && (
            <Text color="gray"> ● streaming...</Text>
          )}
        </Box>
      )}

      {/* Streaming content */}
      <StreamingText
        text={displayContent}
        isComplete={isComplete}
        onComplete={onComplete}
        width={width}
        showCursor={isStreaming && !isComplete}
      />

      {/* Completion indicator */}
      {isComplete && (
        <Box marginTop={1}>
          <Text color="green" dimColor>
            ✓ Complete
          </Text>
        </Box>
      )}
    </Box>
  );
}

export interface TypewriterTextProps {
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
  color?: string;
  bold?: boolean;
}

/**
 * Simple typewriter effect for titles and headers
 */
export function TypewriterText({
  text,
  speed = 100,
  delay = 0,
  onComplete,
  color = 'white',
  bold = false,
}: TypewriterTextProps): React.ReactElement {
  const [displayedText, setDisplayedText] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setStarted(true);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return undefined;

    if (displayedText.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.substring(0, displayedText.length + 1));
      }, 1000 / speed);

      return () => clearTimeout(timer);
    } else if (displayedText.length === text.length && onComplete) {
      onComplete();
    }
    return undefined;
  }, [displayedText, text, speed, started, onComplete]);

  return (
    <Text color={color} bold={bold}>
      {displayedText}
    </Text>
  );
}

export default StreamingText;