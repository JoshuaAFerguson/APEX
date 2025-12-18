import React from 'react';
import { Box, Text } from 'ink';
import { useStdoutDimensions } from '../hooks/index.js';

export interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  theme?: 'dark' | 'light';
  showLineNumbers?: boolean;
  width?: number;
  maxLines?: number;
  responsive?: boolean;
  wrapLines?: boolean;
}

/**
 * Helper function to wrap long code lines intelligently
 */
function wrapCodeLine(line: string, maxWidth: number): string[] {
  if (line.length <= maxWidth) return [line];

  const wrappedLines: string[] = [];
  let remaining = line;

  while (remaining.length > maxWidth) {
    // Try to break at a sensible point (space, operator, comma)
    let breakPoint = maxWidth;
    const breakChars = [' ', ',', '.', '(', ')', '{', '}', '[', ']', ';', '+', '-', '*', '/', '=', '|', '&'];

    // Look backwards from the max width to find a good break point
    for (let i = maxWidth; i > maxWidth - 20 && i > 0; i--) {
      if (breakChars.includes(remaining[i])) {
        breakPoint = i + 1;
        break;
      }
    }

    wrappedLines.push(remaining.substring(0, breakPoint));
    remaining = '  ' + remaining.substring(breakPoint); // Indent continuation
  }

  if (remaining.length > 0) {
    wrappedLines.push(remaining);
  }

  return wrappedLines;
}

/**
 * Syntax highlighter using simple regex-based highlighting
 * Full Shiki support can be added later with proper bundling
 */
export function SyntaxHighlighter({
  code,
  language = 'typescript',
  showLineNumbers = true,
  width: explicitWidth,
  maxLines,
  responsive = true,
  wrapLines,
}: SyntaxHighlighterProps): React.ReactElement {
  const { width: terminalWidth } = useStdoutDimensions();

  // Calculate effective width
  const effectiveWidth = explicitWidth ?? (responsive
    ? Math.max(40, terminalWidth - 2)
    : 80);

  // Determine if line wrapping is enabled
  const shouldWrap = wrapLines ?? responsive;

  // Calculate available width for code content
  const lineNumberWidth = showLineNumbers ? 6 : 0; // "123 │ "
  const borderPadding = 4; // paddingX={1} + box borders
  const codeWidth = effectiveWidth - lineNumberWidth - borderPadding;

  // Use simple highlighting for now - Shiki requires more complex setup
  const highlightedCode = code;

  const lines = highlightedCode.split('\n');

  // Process lines with optional wrapping
  const processedLines = shouldWrap
    ? lines.flatMap(line => wrapCodeLine(line, codeWidth))
    : lines;

  const displayLines = maxLines ? processedLines.slice(0, maxLines) : processedLines;
  const truncated = maxLines && processedLines.length > maxLines;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={effectiveWidth}
    >
      {/* Header */}
      <Box justifyContent="space-between">
        <Text color="gray">{language}</Text>
        <Text color="gray">
          {lines.length} lines{shouldWrap && processedLines.length !== lines.length ? ` (${processedLines.length} wrapped)` : ''}
        </Text>
      </Box>

      {/* Code lines */}
      {displayLines.map((line, index) => (
        <Box key={index}>
          {showLineNumbers && (
            <Text color="gray" dimColor>
              {String(index + 1).padStart(3, ' ')} │
            </Text>
          )}
          <Text>{line || ' '}</Text>
        </Box>
      ))}

      {/* Truncation indicator */}
      {truncated && (
        <Text color="gray" italic>
          ... {processedLines.length - maxLines!} more lines
        </Text>
      )}
    </Box>
  );
}

/**
 * Simple syntax highlighter for basic highlighting without Shiki
 */
export function SimpleSyntaxHighlighter({
  code,
  language = 'typescript',
  showLineNumbers = true,
  width: explicitWidth,
  maxLines,
  responsive = true,
  wrapLines,
}: SyntaxHighlighterProps): React.ReactElement {
  const { width: terminalWidth } = useStdoutDimensions();

  // Calculate effective width
  const effectiveWidth = explicitWidth ?? (responsive
    ? Math.max(40, terminalWidth - 2)
    : 80);

  // Determine if line wrapping is enabled
  const shouldWrap = wrapLines ?? responsive;

  // Calculate available width for code content
  const lineNumberWidth = showLineNumbers ? 6 : 0; // "123 │ "
  const borderPadding = 4; // paddingX={1} + box borders
  const codeWidth = effectiveWidth - lineNumberWidth - borderPadding;

  const lines = code.split('\n');

  // Process lines with optional wrapping
  const processedLines = shouldWrap
    ? lines.flatMap(line => wrapCodeLine(line, codeWidth))
    : lines;

  const displayLines = maxLines ? processedLines.slice(0, maxLines) : processedLines;
  const truncated = maxLines && processedLines.length > maxLines;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={effectiveWidth}
    >
      {/* Header */}
      <Box justifyContent="space-between">
        <Text color="gray">{language}</Text>
        <Text color="gray">
          {lines.length} lines{shouldWrap && processedLines.length !== lines.length ? ` (${processedLines.length} wrapped)` : ''}
        </Text>
      </Box>

      {/* Code lines */}
      {displayLines.map((line, index) => (
        <Box key={index}>
          {showLineNumbers && (
            <Text color="gray" dimColor>
              {String(index + 1).padStart(3, ' ')} │
            </Text>
          )}
          <Text color="white" backgroundColor="black">
            {highlightLine(line, language)}
          </Text>
        </Box>
      ))}

      {/* Truncation indicator */}
      {truncated && (
        <Text color="gray" italic>
          ... {processedLines.length - maxLines!} more lines
        </Text>
      )}
    </Box>
  );
}

/**
 * Simple line highlighting for common languages
 */
function highlightLine(line: string, language: string): React.ReactElement {
  // Keywords for different languages
  const keywords: Record<string, string[]> = {
    typescript: ['const', 'let', 'var', 'function', 'class', 'interface', 'type', 'import', 'export', 'async', 'await'],
    javascript: ['const', 'let', 'var', 'function', 'class', 'import', 'export', 'async', 'await'],
    python: ['def', 'class', 'import', 'from', 'async', 'await', 'if', 'elif', 'else', 'for', 'while', 'try', 'except'],
    rust: ['fn', 'struct', 'enum', 'impl', 'trait', 'let', 'mut', 'pub', 'use', 'mod'],
    go: ['func', 'type', 'struct', 'interface', 'var', 'const', 'package', 'import'],
  };

  const langKeywords = keywords[language] || [];

  // Simple regex-based highlighting
  let highlighted = line;

  // Highlight keywords
  langKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    highlighted = highlighted.replace(regex, `\x1b[94m${keyword}\x1b[0m`);
  });

  // Highlight strings
  highlighted = highlighted.replace(/(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g, '\x1b[93m$1$2$3\x1b[0m');

  // Highlight comments
  if (language === 'python') {
    highlighted = highlighted.replace(/(#.*)$/, '\x1b[90m$1\x1b[0m');
  } else {
    highlighted = highlighted.replace(/(\/\/.*)$/, '\x1b[90m$1\x1b[0m');
    highlighted = highlighted.replace(/(\/\*.*?\*\/)/g, '\x1b[90m$1\x1b[0m');
  }

  return <Text>{highlighted}</Text>;
}

export default SyntaxHighlighter;