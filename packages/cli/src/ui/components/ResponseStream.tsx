import React from 'react';
import { Box, Text } from 'ink';
import SyntaxHighlight from 'ink-syntax-highlight';

export interface ResponseStreamProps {
  content: string;
  isStreaming?: boolean;
  agent?: string;
  type?: 'text' | 'tool' | 'error' | 'system';
}

interface CodeBlock {
  language: string;
  code: string;
}

export function ResponseStream({
  content,
  isStreaming = false,
  agent,
  type = 'text',
}: ResponseStreamProps): React.ReactElement {
  const getTypeColor = () => {
    switch (type) {
      case 'error':
        return 'red';
      case 'tool':
        return 'yellow';
      case 'system':
        return 'gray';
      default:
        return 'white';
    }
  };

  const getTypePrefix = () => {
    switch (type) {
      case 'error':
        return '✗ ';
      case 'tool':
        return '⚙ ';
      case 'system':
        return '◆ ';
      default:
        return '';
    }
  };

  // Language alias mapping
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    py: 'python',
    rb: 'ruby',
    sh: 'bash',
    shell: 'bash',
    yml: 'yaml',
    md: 'markdown',
  };

  // Parse content to extract code blocks
  const parseContent = (text: string): (string | CodeBlock)[] => {
    const parts: (string | CodeBlock)[] = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add code block
      const lang = match[1] || 'text';
      const code = match[2].trimEnd();
      parts.push({
        language: languageMap[lang.toLowerCase()] || lang.toLowerCase() || 'text',
        code,
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  // Render a single line with markdown formatting
  const renderLine = (line: string, index: number) => {
    // Headers
    if (line.startsWith('### ')) {
      return (
        <Text key={index} bold color="cyan">
          {line.slice(4)}
        </Text>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <Text key={index} bold color="blue">
          {line.slice(3)}
        </Text>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <Text key={index} bold color="magenta">
          {line.slice(2)}
        </Text>
      );
    }

    // List items
    if (line.match(/^[\s]*[-*]\s/)) {
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const content = line.replace(/^[\s]*[-*]\s/, '');
      return (
        <Text key={index}>
          {'  '.repeat(Math.floor(indent / 2))}
          <Text color="cyan">• </Text>
          {content}
        </Text>
      );
    }

    // Numbered list
    if (line.match(/^[\s]*\d+\.\s/)) {
      const match = line.match(/^(\s*)(\d+)\.\s(.*)$/);
      if (match) {
        const [, spaces, num, text] = match;
        return (
          <Text key={index}>
            {spaces}
            <Text color="yellow">{num}.</Text> {text}
          </Text>
        );
      }
    }

    // Inline code (backticks)
    if (line.includes('`')) {
      const parts = line.split(/(`[^`]+`)/g);
      return (
        <Text key={index}>
          {parts.map((part, i) => {
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <Text key={i} color="yellow" backgroundColor="gray">
                  {part.slice(1, -1)}
                </Text>
              );
            }
            return <Text key={i}>{part}</Text>;
          })}
        </Text>
      );
    }

    // Bold text
    if (line.includes('**')) {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <Text key={index}>
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <Text key={i} bold>
                  {part.slice(2, -2)}
                </Text>
              );
            }
            return <Text key={i}>{part}</Text>;
          })}
        </Text>
      );
    }

    // Regular text
    return <Text key={index}>{line}</Text>;
  };

  // Render text content (non-code block)
  const renderText = (text: string, startIndex: number) => {
    return text.split('\n').map((line, idx) => renderLine(line, startIndex + idx));
  };

  // Render code block with syntax highlighting
  const renderCodeBlock = (block: CodeBlock, index: number) => {
    return (
      <Box key={`code-${index}`} flexDirection="column" marginY={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            {block.language}
          </Text>
        </Box>
        {block.code.split('\n').map((line, lineIdx) => (
          <Box key={lineIdx}>
            <Text color="gray" dimColor>
              {String(lineIdx + 1).padStart(3, ' ')}
            </Text>
            <Text color="gray" dimColor>
              {' │ '}
            </Text>
            <SyntaxHighlight language={block.language} code={line} />
          </Box>
        ))}
      </Box>
    );
  };

  // Main render function
  const renderContent = () => {
    const parts = parseContent(content);
    let textIndex = 0;

    return parts.map((part, idx) => {
      if (typeof part === 'string') {
        const rendered = renderText(part, textIndex);
        textIndex += part.split('\n').length;
        return <React.Fragment key={idx}>{rendered}</React.Fragment>;
      } else {
        return renderCodeBlock(part, idx);
      }
    });
  };

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Agent header */}
      {agent && (
        <Box marginBottom={1}>
          <Text color="magenta" bold>
            [{agent}]
          </Text>
        </Box>
      )}

      {/* Content */}
      <Box flexDirection="column">
        {type !== 'text' && (
          <Text color={getTypeColor()}>
            {getTypePrefix()}
          </Text>
        )}
        {renderContent()}

        {/* Streaming cursor */}
        {isStreaming && (
          <Text color="cyan" dimColor>
            █
          </Text>
        )}
      </Box>
    </Box>
  );
}
