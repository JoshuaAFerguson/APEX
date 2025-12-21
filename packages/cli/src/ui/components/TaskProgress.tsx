import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { DisplayMode } from '@apex/core';
import { useStdoutDimensions, type Breakpoint } from '../hooks/index.js';

interface TruncationConfig {
  descriptionMaxLength: number;
  taskIdLength: number;
}

/**
 * Calculate truncation configuration based on available width and displayed elements
 */
const calculateTruncationConfig = (
  width: number,
  breakpoint: Breakpoint,
  effectiveDisplayMode: DisplayMode,
  hasTokens: boolean,
  hasCost: boolean,
  hasAgent: boolean
): TruncationConfig => {
  // Compact mode: single line with status, taskId, description, optional metrics
  if (effectiveDisplayMode === 'compact') {
    let reserved = 4;  // status icon + space
    reserved += 10;    // status text (max ~12 chars like "in-progress")
    reserved += 10;    // task ID (8 chars + space)
    if (hasAgent) reserved += 15;    // agent with icon "⚡developer"
    if (hasTokens) reserved += 10;   // "2.3ktk"
    if (hasCost) reserved += 10;     // "$0.0000"
    reserved += 6;     // gaps between elements

    return {
      descriptionMaxLength: Math.max(15, width - reserved),
      taskIdLength: 8,
    };
  }

  // Normal/Verbose mode: multi-line layout
  // Description is on its own line with left margin
  const descriptionLineWidth = width - 6; // borders + padding + margin

  return {
    descriptionMaxLength: breakpoint === 'wide'
      ? Math.min(120, descriptionLineWidth)  // Cap at 120 for readability
      : breakpoint === 'narrow'
        ? Math.max(30, descriptionLineWidth)
        : Math.max(50, descriptionLineWidth),
    taskIdLength: breakpoint === 'narrow' ? 8 : 12,
  };
};

/**
 * Get the maximum number of subtasks to display based on terminal height and display mode
 */
const getSubtaskLimit = (
  height: number,
  displayMode: DisplayMode,
  breakpoint: Breakpoint
): number => {
  if (displayMode === 'verbose') {
    // Verbose: show more, but cap based on height
    return Math.max(3, Math.min(15, Math.floor(height / 3)));
  }

  if (displayMode === 'compact' || breakpoint === 'narrow') {
    return 0; // No subtasks in compact/narrow mode
  }

  // Normal mode
  return Math.max(2, Math.min(5, Math.floor(height / 4)));
};

export interface SubtaskInfo {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

export interface TaskProgressProps {
  taskId: string;
  description: string;
  status: string;
  workflow?: string;
  currentStage?: string;
  agent?: string;
  subtasks?: SubtaskInfo[];
  tokens?: { input: number; output: number };
  cost?: number;
  displayMode?: DisplayMode;
  /** Optional explicit width (for testing or fixed-width containers) */
  width?: number;
}

export function TaskProgress({
  taskId,
  description,
  status,
  workflow,
  currentStage,
  agent,
  subtasks,
  tokens,
  cost,
  displayMode = 'normal',
  width: explicitWidth,
}: TaskProgressProps): React.ReactElement {
  // Get terminal dimensions
  const {
    width: terminalWidth,
    height: terminalHeight,
    breakpoint
  } = useStdoutDimensions();

  // Use explicit width if provided, otherwise use terminal width
  const width = explicitWidth ?? terminalWidth;

  // Calculate effective display mode (auto-compact for narrow)
  const effectiveDisplayMode = useMemo(() => {
    if (breakpoint === 'narrow' && displayMode !== 'verbose') {
      return 'compact' as const;
    }
    return displayMode;
  }, [breakpoint, displayMode]);

  // Calculate truncation config
  const truncationConfig = useMemo(() =>
    calculateTruncationConfig(
      width,
      breakpoint,
      effectiveDisplayMode,
      !!tokens,
      cost !== undefined,
      !!agent
    ),
    [width, breakpoint, effectiveDisplayMode, tokens, cost, agent]
  );

  // Calculate subtask limit
  const subtaskLimit = useMemo(() =>
    getSubtaskLimit(terminalHeight, effectiveDisplayMode, breakpoint),
    [terminalHeight, effectiveDisplayMode, breakpoint]
  );

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'pending':
        return <Text color="gray">○</Text>;
      case 'queued':
        return <Text color="blue">◐</Text>;
      case 'planning':
        return (
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
        );
      case 'in-progress':
        return (
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
        );
      case 'waiting-approval':
        return <Text color="yellow">⏸</Text>;
      case 'completed':
        return <Text color="green">✓</Text>;
      case 'failed':
        return <Text color="red">✗</Text>;
      case 'cancelled':
        return <Text color="gray">⊘</Text>;
      default:
        return <Text color="gray">?</Text>;
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      case 'in-progress':
      case 'planning':
        return 'cyan';
      case 'waiting-approval':
        return 'yellow';
      case 'cancelled':
        return 'gray';
      default:
        return 'white';
    }
  };

  const truncateDescription = (desc: string, max?: number): string => {
    const maxLength = max ?? truncationConfig.descriptionMaxLength;
    if (desc.length <= maxLength) return desc;
    return desc.slice(0, maxLength - 3) + '...';
  };

  const formatCost = (amount: number): string => {
    if (amount < 0.01) return `$${amount.toFixed(4)}`;
    return `$${amount.toFixed(2)}`;
  };

  const formatTokens = (input: number, output: number): string => {
    const total = input + output;
    if (total >= 1000) return `${(total / 1000).toFixed(1)}k`;
    return `${total}`;
  };

  // Compact mode: single line with essential info
  if (effectiveDisplayMode === 'compact') {
    return (
      <Box gap={1}>
        {getStatusIcon(status)}
        <Text color={getStatusColor(status)} bold>
          {status}
        </Text>
        <Text color="gray" dimColor>
          {taskId.slice(0, truncationConfig.taskIdLength)}
        </Text>
        <Text>{truncateDescription(description)}</Text>
        {agent && (
          <Text color="magenta">⚡{agent}</Text>
        )}
        {tokens && (
          <Text color="cyan">{formatTokens(tokens.input, tokens.output)}tk</Text>
        )}
        {cost !== undefined && (
          <Text color="green">{formatCost(cost)}</Text>
        )}
      </Box>
    );
  }

  // Normal and verbose mode: full display
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
      width={Math.min(width, 120)} // Cap at 120 for readability
    >
      {/* Header */}
      <Box gap={1}>
        {getStatusIcon(status)}
        <Text color={getStatusColor(status)} bold>
          {status}
        </Text>
        <Text color="gray" dimColor>
          {taskId.slice(0, truncationConfig.taskIdLength)}
        </Text>
        {workflow && (
          <>
            <Text color="gray">•</Text>
            <Text color="blue">{workflow}</Text>
          </>
        )}
        {currentStage && (
          <>
            <Text color="gray">→</Text>
            <Text color="cyan">{currentStage}</Text>
          </>
        )}
      </Box>

      {/* Description */}
      <Box marginLeft={2}>
        <Text>{truncateDescription(description)}</Text>
      </Box>

      {/* Agent and metrics */}
      <Box marginLeft={2} marginTop={1} gap={2}>
        {agent && (
          <Text>
            <Text color="magenta">⚡</Text>
            <Text color="gray">{agent}</Text>
          </Text>
        )}
        {tokens && (
          <Text>
            <Text color="gray">tokens:</Text>
            <Text color="cyan">{formatTokens(tokens.input, tokens.output)}</Text>
          </Text>
        )}
        {cost !== undefined && (
          <Text>
            <Text color="gray">cost:</Text>
            <Text color="green">{formatCost(cost)}</Text>
          </Text>
        )}
      </Box>

      {/* Subtasks - responsive display based on terminal size */}
      {subtasks && subtasks.length > 0 && subtaskLimit > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <Text color="gray" dimColor>
            Subtasks ({subtasks.filter((s) => s.status === 'completed').length}/{subtasks.length}):
          </Text>
          {subtasks.slice(0, subtaskLimit).map((subtask) => (
            <Box key={subtask.id} marginLeft={1} gap={1}>
              {getStatusIcon(subtask.status)}
              <Text color={getStatusColor(subtask.status)}>
                {truncateDescription(subtask.description)}
              </Text>
            </Box>
          ))}
          {subtasks.length > subtaskLimit && (
            <Box marginLeft={2}>
              <Text color="gray" dimColor>
                ... and {subtasks.length - subtaskLimit} more
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
