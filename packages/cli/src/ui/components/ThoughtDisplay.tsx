import React from 'react';
import { Box, Text } from 'ink';
import type { DisplayMode } from '@apexcli/core';

export interface ThoughtDisplayProps {
  thinking: string;
  agent: string;
  displayMode?: DisplayMode;
  compact?: boolean;
}

export function ThoughtDisplay({
  thinking,
  agent,
  displayMode = 'normal',
  compact = false,
}: ThoughtDisplayProps): React.ReactElement {
  // In compact mode or when thinking is disabled via displayMode, don't show
  if (compact || displayMode === 'compact') {
    return <Box />;
  }

  // Handle null/undefined thinking gracefully
  if (!thinking) {
    return <Box />;
  }

  // Limit display length based on display mode
  const maxDisplayLength = displayMode === 'verbose' ? 1000 : 300;
  const shouldTruncate = thinking.length > maxDisplayLength;
  const displayText = shouldTruncate
    ? thinking.substring(0, maxDisplayLength) + '...'
    : thinking;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="gray" dimColor>
          💭 {agent} thinking
        </Text>
        {shouldTruncate && (
          <Text color="gray" dimColor>
            {' '}(truncated from {thinking.length} chars)
          </Text>
        )}
      </Box>
      <Box
        marginLeft={3}
        marginTop={1}
        paddingX={1}
        borderStyle="round"
        borderColor="gray"
        borderDimColor={true}
      >
        <Text color="gray" dimColor wrap="wrap">
          {displayText}
        </Text>
      </Box>
    </Box>
  );
}