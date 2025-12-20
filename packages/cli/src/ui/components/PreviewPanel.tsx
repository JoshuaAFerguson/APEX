import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useStdoutDimensions, type Breakpoint } from '../hooks/useStdoutDimensions.js';

/**
 * Responsive configuration interface for PreviewPanel
 */
interface ResponsivePreviewConfig {
  // Border and layout
  showBorder: boolean;
  borderStyle: 'round' | 'single' | 'none';
  paddingX: number;
  paddingY: number;
  marginBottom: number;

  // Content display
  showTitle: boolean;
  showStatusIndicator: boolean;
  maxInputLength: number;
  truncateInput: boolean;

  // Intent section
  showIntentBorder: boolean;
  showConfidencePercentage: boolean;
  showWorkflowDetails: boolean;
  maxActionDescriptionLength: number;

  // Action buttons
  showButtonLabels: boolean;
  compactButtons: boolean;
}

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
  remainingMs?: number; // Remaining milliseconds for countdown timer
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: () => void;
  width?: number; // Explicit width override for testing
}

/**
 * Responsive configurations by breakpoint
 */
const RESPONSIVE_CONFIGS: Record<Breakpoint, ResponsivePreviewConfig> = {
  narrow: {
    showBorder: false,
    borderStyle: 'none',
    paddingX: 0,
    paddingY: 0,
    marginBottom: 0,
    showTitle: false,
    showStatusIndicator: false,
    maxInputLength: 30,
    truncateInput: true,
    showIntentBorder: false,
    showConfidencePercentage: false,
    showWorkflowDetails: false,
    maxActionDescriptionLength: 20,
    showButtonLabels: false,
    compactButtons: true,
  },

  compact: {
    showBorder: true,
    borderStyle: 'single',
    paddingX: 1,
    paddingY: 0,
    marginBottom: 0,
    showTitle: true,
    showStatusIndicator: false,
    maxInputLength: 60,
    truncateInput: true,
    showIntentBorder: false,
    showConfidencePercentage: true,
    showWorkflowDetails: false,
    maxActionDescriptionLength: 40,
    showButtonLabels: true,
    compactButtons: true,
  },

  normal: {
    showBorder: true,
    borderStyle: 'round',
    paddingX: 2,
    paddingY: 1,
    marginBottom: 1,
    showTitle: true,
    showStatusIndicator: true,
    maxInputLength: 100,
    truncateInput: false,
    showIntentBorder: true,
    showConfidencePercentage: true,
    showWorkflowDetails: true,
    maxActionDescriptionLength: 80,
    showButtonLabels: true,
    compactButtons: false,
  },

  wide: {
    showBorder: true,
    borderStyle: 'round',
    paddingX: 2,
    paddingY: 1,
    marginBottom: 1,
    showTitle: true,
    showStatusIndicator: true,
    maxInputLength: 150,
    truncateInput: false,
    showIntentBorder: true,
    showConfidencePercentage: true,
    showWorkflowDetails: true,
    maxActionDescriptionLength: 120,
    showButtonLabels: true,
    compactButtons: false,
  },
};

export function PreviewPanel({
  input,
  intent,
  workflow,
  remainingMs,
  onConfirm,
  onCancel,
  onEdit,
  width: explicitWidth,
}: PreviewPanelProps): React.ReactElement {
  // Get terminal dimensions and responsive configuration
  const { width: terminalWidth, breakpoint } = useStdoutDimensions({
    fallbackWidth: 80,
  });

  // Use explicit width if provided (for testing), otherwise use terminal width
  const effectiveWidth = explicitWidth ?? terminalWidth;

  // Get responsive configuration based on terminal width
  const config = useMemo(() => {
    // Override breakpoint if explicit width provided
    let effectiveBreakpoint = breakpoint;
    if (explicitWidth) {
      if (explicitWidth < 60) effectiveBreakpoint = 'narrow';
      else if (explicitWidth < 100) effectiveBreakpoint = 'compact';
      else if (explicitWidth < 160) effectiveBreakpoint = 'normal';
      else effectiveBreakpoint = 'wide';
    }

      return RESPONSIVE_CONFIGS[effectiveBreakpoint];
  }, [breakpoint, explicitWidth]);

  // Helper functions for content adaptation
  const formatInput = (text: string): string => {
    if (!config.truncateInput || text.length <= config.maxInputLength) {
      return text;
    }
    return text.slice(0, config.maxInputLength - 3) + '...';
  };

  const formatActionDescription = (description: string): string => {
    if (description.length <= config.maxActionDescriptionLength) {
      return description;
    }
    return description.slice(0, config.maxActionDescriptionLength - 3) + '...';
  };

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

  const getCountdownColor = (remainingSeconds: number): string => {
    if (remainingSeconds > 5) return 'green';
    if (remainingSeconds > 2) return 'yellow';
    return 'red';
  };

  const formatCountdown = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  const confidencePercentage = Math.round(intent.confidence * 100);

  // Main container with responsive border and padding
  const containerProps = config.showBorder
    ? {
        borderStyle: config.borderStyle,
        borderColor: "cyan",
        paddingX: config.paddingX,
        paddingY: config.paddingY,
        marginBottom: config.marginBottom,
        width: effectiveWidth,
      }
    : {
        paddingX: config.paddingX,
        paddingY: config.paddingY,
        marginBottom: config.marginBottom,
        width: effectiveWidth,
      };

  return (
    <Box
      flexDirection="column"
      {...containerProps}
    >
      {/* Header */}
      {config.showTitle && (
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color="cyan">
            📋 Input Preview
          </Text>
          <Box gap={1}>
            {/* Countdown timer */}
            {remainingMs !== undefined && (
              <Box>
                <Text color="gray">Auto-execute in </Text>
                <Text color={getCountdownColor(remainingMs / 1000)} bold>
                  {formatCountdown(remainingMs)}
                </Text>
              </Box>
            )}
            {/* Status indicator */}
            {config.showStatusIndicator && (
              <Box>
                <Text color="cyan">[</Text>
                <Text color="green" bold>on</Text>
                <Text color="cyan">]</Text>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Countdown display for compact mode (when title is not shown) */}
      {!config.showTitle && remainingMs !== undefined && (
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color="cyan">📋 Preview</Text>
          <Box>
            <Text color="gray">Auto-execute in </Text>
            <Text color={getCountdownColor(remainingMs / 1000)} bold>
              {formatCountdown(remainingMs)}
            </Text>
          </Box>
        </Box>
      )}

      {/* Input display */}
      <Box flexDirection="column" marginBottom={config.showTitle ? 1 : 0}>
        <Text color="white">
          <Text color="gray">Input:</Text> <Text color="white">"{formatInput(input)}"</Text>
        </Text>
      </Box>

      {/* Intent detection */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="white" bold>Detected Intent:</Text>
        <Box
          {...(config.showIntentBorder
            ? {
                borderStyle: "single" as const,
                borderColor: "gray",
                paddingX: 1,
                paddingY: 0,
                marginTop: 1,
              }
            : {
                paddingX: 0,
                paddingY: 0,
                marginTop: 1,
              })}
        >
          <Box flexDirection="column" width="100%">
            <Box justifyContent="space-between">
              <Text>
                <Text>{getIntentIcon(intent.type)}</Text>
                <Text color="white"> {intent.type.charAt(0).toUpperCase() + intent.type.slice(1)} Intent</Text>
              </Text>
              {config.showConfidencePercentage && (
                <Text>
                  <Text color="gray">Confidence: </Text>
                  <Text color={getConfidenceColor(intent.confidence)}>{confidencePercentage}%</Text>
                </Text>
              )}
            </Box>
            <Box marginTop={0}>
              <Text color="gray">Action: </Text>
              <Text color="white">{formatActionDescription(getIntentDescription(intent))}</Text>
            </Box>
            {config.showWorkflowDetails && workflow && intent.type === 'task' && (
              <Box marginTop={0}>
                <Text color="gray">Agent Flow: </Text>
                <Text color="white">planner → architect → developer → tester</Text>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Action buttons */}
      <Box gap={config.compactButtons ? 1 : 0}>
        <Text color="green">[Enter]</Text>
        {config.showButtonLabels && <Text color="white"> Confirm</Text>}

        {config.compactButtons ? (
          <Text color="white"> </Text>
        ) : (
          <Text color="white">    </Text>
        )}

        <Text color="red">[Esc]</Text>
        {config.showButtonLabels && <Text color="white"> Cancel</Text>}

        {config.compactButtons ? (
          <Text color="white"> </Text>
        ) : (
          <Text color="white">    </Text>
        )}

        <Text color="yellow">[e]</Text>
        {config.showButtonLabels && <Text color="white"> Edit</Text>}
      </Box>
    </Box>
  );
}