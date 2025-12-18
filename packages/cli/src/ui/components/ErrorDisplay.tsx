import React from 'react';
import { Box, Text } from 'ink';
import { useStdoutDimensions } from '../hooks/index.js';

// Helper functions for responsive behavior (following ActivityLog patterns)
const formatTimestamp = (date: Date, abbreviated: boolean = false): string => {
  if (abbreviated) {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const truncateMessage = (message: string, maxLength: number): string => {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + '...';
};

export interface ErrorSuggestion {
  title: string;
  description: string;
  action?: string;
  command?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ErrorDisplayProps {
  error: Error | string;
  title?: string;
  suggestions?: ErrorSuggestion[];
  showStack?: boolean;
  showSuggestions?: boolean;
  context?: Record<string, unknown>;
  width?: number;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * Enhanced error display with actionable suggestions and context
 */
export function ErrorDisplay({
  error,
  title = 'Error',
  suggestions = [],
  showStack = false,
  showSuggestions = true,
  context,
  width: explicitWidth,
  onRetry,
  onDismiss,
}: ErrorDisplayProps): React.ReactElement {
  // Use responsive dimensions when explicit values aren't provided
  const { width: terminalWidth, breakpoint, isNarrow } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;

  // Calculate responsive configuration
  const messageMaxLength = Math.max(30, width - 10); // Reserve for borders/padding
  const suggestionDescMaxLength = Math.max(25, width - 16); // Indent + icon
  const contextValueMaxLength = Math.max(20, width - 20);
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? undefined : error.stack;

  // Auto-generate suggestions based on common error patterns
  const generateSuggestions = (message: string): ErrorSuggestion[] => {
    const autoSuggestions: ErrorSuggestion[] = [];

    if (message.toLowerCase().includes('permission denied')) {
      autoSuggestions.push({
        title: 'Permission Issue',
        description: 'Check file/directory permissions',
        command: 'ls -la',
        priority: 'high',
      });
    }

    if (message.toLowerCase().includes('command not found')) {
      autoSuggestions.push({
        title: 'Missing Command',
        description: 'Install the required tool or check PATH',
        priority: 'high',
      });
    }

    if (message.toLowerCase().includes('network') || message.toLowerCase().includes('connection')) {
      autoSuggestions.push({
        title: 'Network Issue',
        description: 'Check your internet connection and try again',
        action: 'retry',
        priority: 'medium',
      });
    }

    if (message.toLowerCase().includes('timeout')) {
      autoSuggestions.push({
        title: 'Timeout',
        description: 'The operation took too long. Try increasing timeout or check resource usage',
        action: 'retry',
        priority: 'medium',
      });
    }

    if (message.toLowerCase().includes('api') && message.toLowerCase().includes('key')) {
      autoSuggestions.push({
        title: 'API Key Issue',
        description: 'Check your API key configuration',
        command: 'apex config get api.key',
        priority: 'high',
      });
    }

    if (message.toLowerCase().includes('not found') && !message.toLowerCase().includes('command')) {
      autoSuggestions.push({
        title: 'Resource Not Found',
        description: 'The requested resource does not exist or has been moved',
        priority: 'medium',
      });
    }

    if (message.toLowerCase().includes('syntax error')) {
      autoSuggestions.push({
        title: 'Syntax Error',
        description: 'Check the syntax of your input or configuration',
        priority: 'high',
      });
    }

    return autoSuggestions;
  };

  const allSuggestions = [...suggestions, ...generateSuggestions(errorMessage)];
  const uniqueSuggestions = allSuggestions.filter(
    (suggestion, index, arr) => arr.findIndex(s => s.title === suggestion.title) === index
  );

  const getPriorityIcon = (priority: string): string => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '💡';
    }
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="red" paddingX={2} paddingY={1} width={width}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="red" bold>
          ❌ {title}
        </Text>
      </Box>

      {/* Error message */}
      <Box marginBottom={1}>
        <Text color="red" wrap="wrap">
          {errorMessage}
        </Text>
      </Box>

      {/* Context information */}
      {context && Object.keys(context).length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" bold>Context:</Text>
          {Object.entries(context).map(([key, value]) => {
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            const displayValue = truncateMessage(valueStr, contextValueMaxLength);
            return (
              <Box key={key} marginLeft={2}>
                <Text color="gray">
                  {key}: {displayValue}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Stack trace */}
      {showStack && errorStack && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" bold>Stack Trace:</Text>
          <Box marginLeft={2} flexDirection="column">
            {errorStack.split('\n').slice(0, 10).map((line, index) => (
              <Text key={index} color="gray" dimColor>
                {line}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {/* Suggestions */}
      {showSuggestions && uniqueSuggestions.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="yellow" bold>💡 Suggestions:</Text>
          {uniqueSuggestions
            .sort((a, b) => {
              const priorityOrder = { high: 3, medium: 2, low: 1 };
              return priorityOrder[b.priority] - priorityOrder[a.priority];
            })
            .map((suggestion, index) => (
              <Box key={index} marginLeft={2} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text color="yellow">{getPriorityIcon(suggestion.priority)} </Text>
                  <Text color="yellow" bold>{suggestion.title}</Text>
                </Box>
                <Box marginLeft={4}>
                  <Text color="white">{truncateMessage(suggestion.description, suggestionDescMaxLength)}</Text>
                </Box>
                {suggestion.command && (
                  <Box marginLeft={4}>
                    <Text color="gray">Try: </Text>
                    <Text color="cyan" backgroundColor="gray">{suggestion.command}</Text>
                  </Box>
                )}
                {suggestion.action && (
                  <Box marginLeft={4}>
                    <Text color="gray">Action: </Text>
                    <Text color="green">{suggestion.action}</Text>
                  </Box>
                )}
              </Box>
            ))}
        </Box>
      )}

      {/* Actions */}
      <Box justifyContent="flex-end" marginTop={1}>
        {onDismiss && (
          <Box marginRight={2}>
            <Text color="gray" backgroundColor="darkgray">
              [D] Dismiss
            </Text>
          </Box>
        )}
        {onRetry && (
          <Box>
            <Text color="green" backgroundColor="darkgray">
              [R] Retry
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export interface ErrorSummaryProps {
  errors: Array<{
    id: string;
    message: string;
    timestamp: Date;
    severity: 'error' | 'warning' | 'info';
    resolved?: boolean;
  }>;
  title?: string;
  maxErrors?: number;
  showTimestamps?: boolean;
  width?: number;
}

/**
 * Compact error summary for showing multiple errors
 */
export function ErrorSummary({
  errors,
  title = 'Recent Issues',
  maxErrors = 5,
  showTimestamps = true,
  width: explicitWidth,
}: ErrorSummaryProps): React.ReactElement {
  // Use responsive dimensions when explicit values aren't provided
  const { width: terminalWidth, breakpoint, isNarrow } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;

  // Responsive configuration
  const abbreviateTimestamp = isNarrow;
  const messageMaxLength = Math.max(20, width - (showTimestamps ? 20 : 8));
  const recentErrors = errors.slice(-maxErrors);
  const unresolvedCount = errors.filter(e => !e.resolved).length;

  const getSeverityIcon = (severity: string): { icon: string; color: string } => {
    switch (severity) {
      case 'error':
        return { icon: '❌', color: 'red' };
      case 'warning':
        return { icon: '⚠️', color: 'yellow' };
      default:
        return { icon: 'ℹ️', color: 'blue' };
    }
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={unresolvedCount > 0 ? 'red' : 'gray'} paddingX={1}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold color={unresolvedCount > 0 ? 'red' : 'gray'}>
          {title}
        </Text>
        <Text color="gray">
          {unresolvedCount > 0 && (
            <>
              <Text color="red">{unresolvedCount} unresolved</Text>
              <Text color="gray"> | </Text>
            </>
          )}
          {recentErrors.length} total
        </Text>
      </Box>

      {/* Error list */}
      {recentErrors.length === 0 ? (
        <Text color="gray" dimColor>No recent issues</Text>
      ) : (
        <Box flexDirection="column">
          {recentErrors.map((error, index) => {
            const { icon, color } = getSeverityIcon(error.severity);
            return (
              <Box key={error.id}>
                <Text color={color}>{icon} </Text>
                {showTimestamps && (
                  <Text color="gray" dimColor>
                    [{formatTimestamp(error.timestamp, abbreviateTimestamp)}]
                  </Text>
                )}
                <Text color={error.resolved ? 'gray' : color} strikethrough={error.resolved}>
                  {truncateMessage(error.message, messageMaxLength)}
                </Text>
                {error.resolved && (
                  <Text color="green"> ✓</Text>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export interface ValidationErrorProps {
  field: string;
  value: unknown;
  errors: string[];
  suggestions?: string[];
  width?: number;
  onFix?: (field: string, value: unknown) => void;
}

/**
 * Validation error display for form fields and input validation
 */
export function ValidationError({
  field,
  value,
  errors,
  suggestions = [],
  width: explicitWidth,
  onFix,
}: ValidationErrorProps): React.ReactElement {
  // Use responsive dimensions when explicit values aren't provided
  const { width: terminalWidth, isNarrow } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;

  // Responsive truncation
  const valueMaxLength = isNarrow ? 20 : 40;
  const errorMaxLength = Math.max(30, width - 8);
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="red" paddingX={1}>
      {/* Field info */}
      <Box>
        <Text color="red" bold>Invalid {field}: </Text>
        <Text color="gray">"{truncateMessage(String(value), valueMaxLength)}"</Text>
      </Box>

      {/* Errors */}
      <Box flexDirection="column" marginLeft={2}>
        {errors.map((error, index) => (
          <Box key={index}>
            <Text color="red">• {truncateMessage(error, errorMaxLength)}</Text>
          </Box>
        ))}
      </Box>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">Suggestions:</Text>
          {suggestions.map((suggestion, index) => (
            <Box key={index} marginLeft={2}>
              <Text color="yellow">• {truncateMessage(suggestion, errorMaxLength)}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Fix option */}
      {onFix && (
        <Box marginTop={1}>
          <Text color="green" backgroundColor="darkgray">
            [F] Auto-fix
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default ErrorDisplay;