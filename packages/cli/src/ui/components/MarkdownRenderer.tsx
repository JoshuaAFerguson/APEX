import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { marked } from 'marked';

export interface MarkdownRendererProps {
  content: string;
  width?: number;
}

/**
 * Enhanced markdown renderer with rich terminal formatting
 * Uses simple rendering - full marked-terminal can be added later
 */
export function MarkdownRenderer({
  content,
  width = 80
}: MarkdownRendererProps): React.ReactElement {
  const [processed, setProcessed] = useState<string>(content);

  useEffect(() => {
    const processMarkdown = async () => {
      try {
        // marked.parse can be async in newer versions
        const result = await marked.parse(content, { async: true });
        // Strip HTML tags for terminal output
        const stripped = result
          .replace(/<[^>]*>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"');
        setProcessed(stripped);
      } catch {
        // Fallback to plain text if markdown parsing fails
        setProcessed(content);
      }
    };
    processMarkdown();
  }, [content]);

  return (
    <Box flexDirection="column" width={width}>
      <Text>{processed}</Text>
    </Box>
  );
}

/**
 * Simple markdown renderer for basic formatting without external dependencies
 */
export function SimpleMarkdownRenderer({
  content,
  width = 80
}: MarkdownRendererProps): React.ReactElement {
  const lines = content.split('\n');

  return (
    <Box flexDirection="column" width={width}>
      {lines.map((line, index) => {
        // Headers
        if (line.startsWith('# ')) {
          return (
            <Text key={index} bold color="cyan">
              {line.substring(2)}
            </Text>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Text key={index} bold color="blue">
              {line.substring(3)}
            </Text>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <Text key={index} bold color="magenta">
              {line.substring(4)}
            </Text>
          );
        }

        // Lists
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <Text key={index}>
              <Text color="yellow">• </Text>
              {formatInlineText(line.substring(2))}
            </Text>
          );
        }

        // Numbered lists
        const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          return (
            <Text key={index}>
              <Text color="yellow">{numberedMatch[1]}. </Text>
              {formatInlineText(numberedMatch[2])}
            </Text>
          );
        }

        // Code blocks (simple detection)
        if (line.startsWith('```')) {
          return (
            <Text key={index} color="gray" backgroundColor="black">
              {line}
            </Text>
          );
        }

        // Blockquotes
        if (line.startsWith('> ')) {
          return (
            <Text key={index}>
              <Text color="gray">│ </Text>
              <Text color="gray" italic>
                {formatInlineText(line.substring(2))}
              </Text>
            </Text>
          );
        }

        // Regular paragraphs
        return (
          <Text key={index}>
            {formatInlineText(line)}
          </Text>
        );
      })}
    </Box>
  );
}

/**
 * Format inline text with bold, italic, and code formatting
 */
function formatInlineText(text: string): React.ReactElement {
  // This is a simplified inline formatter
  // In a real implementation, you'd want a proper parser

  // Handle inline code first
  const codeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  const parts: React.ReactElement[] = [];
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = codeRegex.exec(text)) !== null) {
    // Add text before the code
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index);
      parts.push(
        <Text key={key++}>
          {formatBoldItalic(beforeText)}
        </Text>
      );
    }

    // Add the code
    parts.push(
      <Text key={key++} backgroundColor="gray" color="white">
        {match[1]}
      </Text>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    parts.push(
      <Text key={key++}>
        {formatBoldItalic(remainingText)}
      </Text>
    );
  }

  return parts.length > 0 ? <>{parts}</> : <Text>{text}</Text>;
}

/**
 * Simple bold/italic formatter
 */
function formatBoldItalic(text: string): React.ReactElement {
  // Handle **bold** and *italic*
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const italicRegex = /\*([^*]+)\*/g;

  // This is a simplified approach - in practice you'd want a proper parser
  let result = text;
  const elements: { type: 'bold' | 'italic'; content: string; start: number; end: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(text)) !== null) {
    elements.push({
      type: 'bold',
      content: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  let italicMatch: RegExpExecArray | null;
  while ((italicMatch = italicRegex.exec(text)) !== null) {
    // Skip if this is part of a bold section
    const isBoldPart = elements.some(el =>
      el.type === 'bold' &&
      italicMatch!.index >= el.start &&
      italicMatch!.index + italicMatch![0].length <= el.end
    );

    if (!isBoldPart) {
      elements.push({
        type: 'italic',
        content: italicMatch[1],
        start: italicMatch.index,
        end: italicMatch.index + italicMatch[0].length,
      });
    }
  }

  // For simplicity, just return the text as-is for now
  // A full implementation would properly parse and render these elements
  return <Text>{text}</Text>;
}

export default MarkdownRenderer;