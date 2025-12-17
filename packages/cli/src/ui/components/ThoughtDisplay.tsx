import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
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
  const [isExpanded, setIsExpanded] = useState(false);

  // In compact mode or when thinking is disabled via displayMode, don't show
  if (compact || displayMode === 'compact') {
    return <Box />;
  }

  // Show truncated preview if not expanded
  const maxPreviewLength = displayMode === 'verbose' ? 200 : 100;
  const shouldTruncate = thinking.length > maxPreviewLength;
  const displayText = isExpanded || !shouldTruncate
    ? thinking
    : thinking.substring(0, maxPreviewLength) + '...';

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  // Use global key handler for expansion toggle
  useInput((input, key) => {
    // Only handle space key when this component is focused/visible
    if (input === ' ' && !key.ctrl && !key.meta) {
      toggleExpansion();
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="gray" dimColor>
          💭 {agent} thinking
        </Text>
        {shouldTruncate && (
          <Text color="gray" dimColor>
            {' '}(
            {isExpanded ? 'expanded' : 'collapsed'}
            {!isExpanded && ` - ${thinking.length} chars`}
            {shouldTruncate && ' - press space to toggle'}
            )
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
      {shouldTruncate && !isExpanded && (
        <Box marginLeft={3} marginTop={1}>
          <Text color="yellow" dimColor>
            Press space to expand reasoning...
          </Text>
        </Box>
      )}
    </Box>
  );
}