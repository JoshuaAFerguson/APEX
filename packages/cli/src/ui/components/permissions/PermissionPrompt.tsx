import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { DisplayMode } from '@apexcli/core';

export type PermissionLevel = 'allow-always' | 'allow-once' | 'deny';

export interface PermissionRequest {
  /** Unique identifier for this permission request */
  id: string;
  /** Tool requesting permission */
  tool: string;
  /** Scope of the permission (e.g., file path, command, etc.) */
  scope?: string;
  /** Operation being performed */
  operation: string;
  /** Whether this operation is considered dangerous */
  isDangerous: boolean;
  /** Danger level if dangerous */
  dangerLevel?: 'low' | 'medium' | 'high' | 'critical';
  /** Additional context about the operation */
  context?: string;
  /** Input parameters for the operation */
  parameters?: Record<string, unknown>;
  /** Timestamp when permission was requested */
  timestamp: Date;
}

export interface PermissionPromptProps {
  /** The permission request to display */
  request: PermissionRequest;
  /** Callback when user makes a decision */
  onDecision: (requestId: string, level: PermissionLevel, comment?: string) => void;
  /** Display mode */
  displayMode?: DisplayMode;
  /** Whether to auto-focus the prompt */
  autoFocus?: boolean;
  /** Whether to show detailed information */
  showDetails?: boolean;
}

/**
 * Get color based on danger level
 */
function getDangerColor(isDangerous: boolean, level?: string): string {
  if (!isDangerous) return 'white';

  switch (level) {
    case 'critical':
      return 'red';
    case 'high':
      return 'redBright';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'cyan';
    default:
      return 'yellow';
  }
}

/**
 * Get danger icon and description
 */
function getDangerInfo(isDangerous: boolean, level?: string): { icon: string; description: string } {
  if (!isDangerous) {
    return { icon: '🔧', description: 'Safe operation' };
  }

  switch (level) {
    case 'critical':
      return { icon: '🚨', description: 'CRITICAL - May cause irreversible damage' };
    case 'high':
      return { icon: '⚠️', description: 'HIGH RISK - Destructive operation' };
    case 'medium':
      return { icon: '⚡', description: 'MEDIUM RISK - May modify important files' };
    case 'low':
      return { icon: '⚠️', description: 'LOW RISK - Minor security concern' };
    default:
      return { icon: '⚠️', description: 'Potentially dangerous operation' };
  }
}

/**
 * Format parameters for display
 */
function formatParameters(params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return 'None';

  return entries
    .slice(0, 3) // Show first 3 parameters
    .map(([key, value]) => {
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      const truncated = strValue.length > 50 ? strValue.slice(0, 47) + '...' : strValue;
      return `${key}: ${truncated}`;
    })
    .join(', ') + (entries.length > 3 ? ', ...' : '');
}

/**
 * PermissionPrompt component for requesting user authorization
 */
export function PermissionPrompt({
  request,
  onDecision,
  displayMode = 'normal',
  autoFocus = true,
  showDetails = true,
}: PermissionPromptProps): React.ReactElement {
  const [selectedOption, setSelectedOption] = useState<number>(1); // Default to "Allow Once"
  const [isActive, setIsActive] = useState(autoFocus);

  const options = [
    { key: 'A', label: 'Allow Always', value: 'allow-always' as PermissionLevel, color: 'green' },
    { key: 'O', label: 'Allow Once', value: 'allow-once' as PermissionLevel, color: 'yellow' },
    { key: 'D', label: 'Deny', value: 'deny' as PermissionLevel, color: 'red' },
  ];

  useEffect(() => {
    // Auto-focus after a brief delay if autoFocus is enabled
    if (autoFocus) {
      const timer = setTimeout(() => setIsActive(true), 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoFocus]);

  useInput((input, key) => {
    if (!isActive) return;

    if (key.leftArrow || key.upArrow) {
      setSelectedOption(Math.max(0, selectedOption - 1));
    } else if (key.rightArrow || key.downArrow) {
      setSelectedOption(Math.min(options.length - 1, selectedOption + 1));
    } else if (key.return) {
      const selectedValue = options[selectedOption].value;
      onDecision(request.id, selectedValue);
      setIsActive(false);
    } else if (key.escape) {
      onDecision(request.id, 'deny');
      setIsActive(false);
    } else {
      // Handle direct key selection
      const optionIndex = options.findIndex(opt => opt.key.toLowerCase() === input.toLowerCase());
      if (optionIndex >= 0) {
        onDecision(request.id, options[optionIndex].value);
        setIsActive(false);
      }
    }
  });

  const dangerInfo = getDangerInfo(request.isDangerous, request.dangerLevel);
  const dangerColor = getDangerColor(request.isDangerous, request.dangerLevel);

  // Compact mode: single line prompt
  if (displayMode === 'compact') {
    return (
      <Box gap={1} borderStyle="single" borderColor={dangerColor} paddingX={1}>
        <Text color={dangerColor}>{dangerInfo.icon}</Text>
        <Text color="white" bold>{request.tool}</Text>
        <Text color="gray">{request.operation}</Text>
        <Text color="gray">
          [{options.map(opt => `${opt.key}=${opt.label}`).join('|')}]
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={dangerColor}
      paddingX={1}
      paddingY={1}
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={dangerColor}>
          {dangerInfo.icon} Permission Request
        </Text>
        <Text color="gray">
          {request.timestamp.toLocaleTimeString()}
        </Text>
      </Box>

      {/* Tool and operation info */}
      <Box flexDirection="column" marginBottom={1}>
        <Box gap={2}>
          <Text color="white" bold>Tool:</Text>
          <Text color="cyan">{request.tool}</Text>
        </Box>
        <Box gap={2}>
          <Text color="white" bold>Operation:</Text>
          <Text color="white">{request.operation}</Text>
        </Box>
        {request.scope && (
          <Box gap={2}>
            <Text color="white" bold>Scope:</Text>
            <Text color="gray">{request.scope}</Text>
          </Box>
        )}
      </Box>

      {/* Danger information */}
      <Box flexDirection="column" marginBottom={1}>
        <Box gap={2}>
          <Text color="white" bold>Risk Level:</Text>
          <Text color={dangerColor}>{dangerInfo.description}</Text>
        </Box>
        {request.context && (
          <Box gap={2}>
            <Text color="white" bold>Context:</Text>
            <Text color="gray">{request.context}</Text>
          </Box>
        )}
      </Box>

      {/* Parameters (in detailed mode) */}
      {showDetails && request.parameters && Object.keys(request.parameters).length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="white" bold>Parameters:</Text>
          <Text color="gray" wrap="wrap">
            {formatParameters(request.parameters)}
          </Text>
        </Box>
      )}

      {/* Options */}
      <Box flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}><Text color="white" bold>Choose an option:</Text></Box>
        {options.map((option, index) => (
          <Box key={option.value} gap={1} marginLeft={1}>
            <Text color={selectedOption === index ? 'white' : 'gray'}>
              {selectedOption === index ? '▶' : ' '}
            </Text>
            <Text
              color={selectedOption === index ? option.color : 'gray'}
              bold={selectedOption === index}
            >
              [{option.key}] {option.label}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Help text */}
      <Box borderTop={true} paddingTop={1}>
        <Text color="gray" dimColor>
          ↑↓/←→: Navigate • Enter: Confirm • Esc: Deny • A/O/D: Direct selection
        </Text>
      </Box>

      {/* Warning for dangerous operations */}
      {request.isDangerous && request.dangerLevel && ['high', 'critical'].includes(request.dangerLevel) && (
        <Box borderTop={true} paddingTop={1}>
          <Text color="red" bold>
            ⚠️  WARNING: This operation may cause irreversible changes!
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Permission history entry for displaying past decisions
 */
export interface PermissionHistoryEntry {
  request: PermissionRequest;
  decision: PermissionLevel;
  decidedAt: Date;
  comment?: string;
}

export interface PermissionHistoryProps {
  /** Permission history entries */
  entries: PermissionHistoryEntry[];
  /** Maximum entries to display */
  maxEntries?: number;
  /** Display mode */
  displayMode?: DisplayMode;
}

/**
 * Permission history display for reviewing past decisions
 */
export function PermissionHistory({
  entries,
  maxEntries = 10,
  displayMode = 'normal',
}: PermissionHistoryProps): React.ReactElement {
  const displayEntries = entries.slice(-maxEntries);

  if (displayMode === 'compact') {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="gray">
        <Text bold color="gray">Permission History ({entries.length})</Text>
        {displayEntries.map((entry, index) => (
          <Box key={index} gap={2}>
            <Text color="gray">{entry.request.tool}</Text>
            <Text color={entry.decision === 'allow-always' ? 'green' :
                          entry.decision === 'allow-once' ? 'yellow' : 'red'}>
              {entry.decision}
            </Text>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue">
      <Box justifyContent="space-between" paddingX={1} borderBottom={true}>
        <Text bold color="blue">Permission History</Text>
        <Text color="gray">{entries.length} entries</Text>
      </Box>

      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {displayEntries.length === 0 ? (
          <Text color="gray" dimColor>No permission history</Text>
        ) : (
          displayEntries.map((entry, index) => (
            <Box key={index} flexDirection="column" marginBottom={1}>
              <Box justifyContent="space-between">
                <Box gap={2}>
                  <Text color="white">{entry.request.tool}</Text>
                  <Text color="gray">{entry.request.operation}</Text>
                </Box>
                <Text color="gray" dimColor>
                  {entry.decidedAt.toLocaleTimeString()}
                </Text>
              </Box>
              <Box gap={2}>
                <Text color={entry.decision === 'allow-always' ? 'green' :
                            entry.decision === 'allow-once' ? 'yellow' : 'red'}>
                  {entry.decision}
                </Text>
                {entry.request.scope && (
                  <Text color="gray" dimColor>{entry.request.scope}</Text>
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

export default PermissionPrompt;