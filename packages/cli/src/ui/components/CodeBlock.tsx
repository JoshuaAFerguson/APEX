import React from 'react';
import { Box, Text } from 'ink';
import SyntaxHighlight from 'ink-syntax-highlight';

export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language = 'typescript',
  filename,
  showLineNumbers = true,
}: CodeBlockProps): React.ReactElement {
  // Map common language aliases
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

  const normalizedLanguage = languageMap[language.toLowerCase()] || language.toLowerCase();

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      {/* Header with filename and language */}
      {(filename || language) && (
        <Box marginBottom={1}>
          {filename && (
            <Text color="cyan" bold>
              {filename}
            </Text>
          )}
          {filename && language && <Text color="gray"> </Text>}
          <Text color="gray" dimColor>
            {normalizedLanguage}
          </Text>
        </Box>
      )}

      {/* Code with syntax highlighting */}
      <Box flexDirection="column">
        {showLineNumbers ? (
          code.split('\n').map((line, index) => (
            <Box key={index}>
              <Text color="gray" dimColor>
                {String(index + 1).padStart(3, ' ')}
              </Text>
              <Text color="gray" dimColor>
                {' │ '}
              </Text>
              <SyntaxHighlight language={normalizedLanguage} code={line} />
            </Box>
          ))
        ) : (
          <SyntaxHighlight language={normalizedLanguage} code={code} />
        )}
      </Box>
    </Box>
  );
}
