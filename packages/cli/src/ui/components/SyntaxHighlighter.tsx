import React from 'react';
import { Box, Text } from 'ink';

export interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  theme?: 'dark' | 'light';
  showLineNumbers?: boolean;
  width?: number;
  maxLines?: number;
}

/**
 * Syntax highlighter using simple regex-based highlighting
 * Full Shiki support can be added later with proper bundling
 */
export function SyntaxHighlighter({
  code,
  language = 'typescript',
  showLineNumbers = true,
  width = 80,
  maxLines,
}: SyntaxHighlighterProps): React.ReactElement {
  // Use simple highlighting for now - Shiki requires more complex setup
  const highlightedCode = code;

  const lines = highlightedCode.split('\n');
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines;
  const truncated = maxLines && lines.length > maxLines;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={width}
    >
      {/* Header */}
      <Box justifyContent="space-between">
        <Text color="gray">{language}</Text>
        <Text color="gray">{lines.length} lines</Text>
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
          ... {lines.length - maxLines!} more lines
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
  width = 80,
  maxLines,
}: SyntaxHighlighterProps): React.ReactElement {
  const lines = code.split('\n');
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines;
  const truncated = maxLines && lines.length > maxLines;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={width}
    >
      {/* Header */}
      <Box justifyContent="space-between">
        <Text color="gray">{language}</Text>
        <Text color="gray">{lines.length} lines</Text>
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
          ... {lines.length - maxLines!} more lines
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