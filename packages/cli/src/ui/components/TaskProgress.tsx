import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

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
}: TaskProgressProps): React.ReactElement {
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

  const truncateDescription = (desc: string, max = 60): string => {
    if (desc.length <= max) return desc;
    return desc.slice(0, max - 3) + '...';
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

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} paddingY={0}>
      {/* Header */}
      <Box gap={1}>
        {getStatusIcon(status)}
        <Text color={getStatusColor(status)} bold>
          {status}
        </Text>
        <Text color="gray" dimColor>
          {taskId.slice(0, 12)}
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

      {/* Subtasks */}
      {subtasks && subtasks.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <Text color="gray" dimColor>
            Subtasks ({subtasks.filter((s) => s.status === 'completed').length}/{subtasks.length}):
          </Text>
          {subtasks.slice(0, 5).map((subtask) => (
            <Box key={subtask.id} marginLeft={1} gap={1}>
              {getStatusIcon(subtask.status)}
              <Text color={getStatusColor(subtask.status)}>
                {truncateDescription(subtask.description, 50)}
              </Text>
            </Box>
          ))}
          {subtasks.length > 5 && (
            <Box marginLeft={2}>
              <Text color="gray" dimColor>
                ... and {subtasks.length - 5} more
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
