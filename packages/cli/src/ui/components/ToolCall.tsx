import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { DisplayMode } from '@apexcli/core';

export interface ToolCallProps {
  toolName: string;
  input?: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration?: number;
  collapsed?: boolean;
  displayMode?: DisplayMode;
}

export function ToolCall({
  toolName,
  input,
  output,
  status,
  duration,
  collapsed = false,
  displayMode = 'normal',
}: ToolCallProps): React.ReactElement {
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Text color="gray">○</Text>;
      case 'running':
        return (
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
        );
      case 'success':
        return <Text color="green">✓</Text>;
      case 'error':
        return <Text color="red">✗</Text>;
    }
  };

  const getToolColor = () => {
    const toolColors: Record<string, string> = {
      Read: 'cyan',
      Write: 'green',
      Edit: 'yellow',
      Bash: 'magenta',
      Glob: 'blue',
      Grep: 'blue',
      WebFetch: 'cyan',
      WebSearch: 'cyan',
    };
    return toolColors[toolName] || 'white';
  };

  const formatInput = (input: Record<string, unknown>): string => {
    // Show a brief summary of the input
    const keys = Object.keys(input);
    if (keys.length === 0) return '';

    const firstKey = keys[0];
    const firstValue = input[firstKey];

    if (typeof firstValue === 'string') {
      const truncated = firstValue.length > 50 ? firstValue.slice(0, 50) + '...' : firstValue;
      return `${firstKey}: "${truncated}"`;
    }

    return `${keys.length} params`;
  };

  const truncateOutput = (text: string, maxLines = 5): string => {
    const lines = text.split('\n');
    if (lines.length <= maxLines) return text;
    return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
  };

  // Auto-collapse in compact mode unless explicitly set
  const shouldCollapse = collapsed || displayMode === 'compact';

  // Compact mode: single line
  if (displayMode === 'compact') {
    return (
      <Box gap={1}>
        {getStatusIcon()}
        <Text color={getToolColor()} bold>
          {toolName}
        </Text>
        {input && (
          <Text color="gray" dimColor>
            {formatInput(input)}
          </Text>
        )}
        {duration !== undefined && status !== 'running' && (
          <Text color="gray" dimColor>
            {duration}ms
          </Text>
        )}
        {output && status === 'error' && (
          <Text color="red" dimColor>
            (error)
          </Text>
        )}
      </Box>
    );
  }

  // Normal and verbose mode
  return (
    <Box flexDirection="column" marginLeft={2}>
      {/* Tool header */}
      <Box gap={1}>
        {getStatusIcon()}
        <Text color={getToolColor()} bold>
          {toolName}
        </Text>
        {input && (
          <Text color="gray" dimColor>
            {formatInput(input)}
          </Text>
        )}
        {duration !== undefined && status !== 'running' && (
          <Text color="gray" dimColor>
            ({duration}ms)
          </Text>
        )}
        {displayMode === 'verbose' && status && (
          <Text color="gray" dimColor>
            [{status}]
          </Text>
        )}
      </Box>

      {/* Output (if not collapsed and has output) */}
      {!shouldCollapse && output && status !== 'running' && (
        <Box
          flexDirection="column"
          marginLeft={2}
          marginTop={1}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Text color={status === 'error' ? 'red' : 'gray'}>
            {displayMode === 'verbose' ? output : truncateOutput(output)}
          </Text>
        </Box>
      )}
    </Box>
  );
}
