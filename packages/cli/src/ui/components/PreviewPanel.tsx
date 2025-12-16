import React from 'react';
import { Box, Text } from 'ink';

export interface PreviewPanelProps {
  input: string;
  intent: {
    type: 'command' | 'task' | 'question' | 'clarification';
    confidence: number;
    command?: string;
    args?: string[];
    metadata?: Record<string, unknown>;
  };
  workflow?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: () => void;
}

export function PreviewPanel({
  input,
  intent,
  workflow,
  onConfirm,
  onCancel,
  onEdit,
}: PreviewPanelProps): React.ReactElement {
  const getIntentIcon = (type: string): string => {
    switch (type) {
      case 'command': return '⚡';
      case 'task': return '📝';
      case 'question': return '❓';
      case 'clarification': return '💬';
      default: return '🔍';
    }
  };

  const getIntentDescription = (intent: PreviewPanelProps['intent']): string => {
    switch (intent.type) {
      case 'command':
        return `Execute command: /${intent.command}${intent.args?.length ? ' ' + intent.args.join(' ') : ''}`;
      case 'task':
        return `Create task${workflow ? ` (${workflow} workflow)` : ''}`;
      case 'question':
        return 'Answer question';
      case 'clarification':
        return 'Provide clarification';
      default:
        return 'Process input';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    return 'red';
  };

  const confidencePercentage = Math.round(intent.confidence * 100);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      marginBottom={1}
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          📋 Input Preview
        </Text>
        <Box>
          <Text color="cyan">[</Text>
          <Text color="green" bold>on</Text>
          <Text color="cyan">]</Text>
        </Box>
      </Box>

      {/* Input display */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="white">
          <Text color="gray">Input:</Text> <Text color="white">"{input}"</Text>
        </Text>
      </Box>

      {/* Intent detection */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="white" bold>Detected Intent:</Text>
        <Box
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
          paddingY={0}
          marginTop={1}
        >
          <Box flexDirection="column" width="100%">
            <Box justifyContent="space-between">
              <Text>
                <Text>{getIntentIcon(intent.type)}</Text>
                <Text color="white"> {intent.type.charAt(0).toUpperCase() + intent.type.slice(1)} Intent</Text>
              </Text>
              <Text>
                <Text color="gray">Confidence: </Text>
                <Text color={getConfidenceColor(intent.confidence)}>{confidencePercentage}%</Text>
              </Text>
            </Box>
            <Box marginTop={0}>
              <Text color="gray">Action: </Text>
              <Text color="white">{getIntentDescription(intent)}</Text>
            </Box>
            {workflow && intent.type === 'task' && (
              <Box marginTop={0}>
                <Text color="gray">Agent Flow: </Text>
                <Text color="white">planner → architect → developer → tester</Text>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Action buttons */}
      <Box>
        <Text color="green">[Enter]</Text>
        <Text color="white"> Confirm    </Text>
        <Text color="red">[Esc]</Text>
        <Text color="white"> Cancel    </Text>
        <Text color="yellow">[e]</Text>
        <Text color="white"> Edit</Text>
      </Box>
    </Box>
  );
}