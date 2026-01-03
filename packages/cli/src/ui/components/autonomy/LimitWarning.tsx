import React from 'react';
import { Box, Text } from 'ink';
import type { DisplayMode } from '@apexcli/core';
import { formatDuration } from '@apexcli/core';

export interface LimitWarning {
  type: 'tokens' | 'cost' | 'time' | 'files' | 'lines';
  threshold: number;
  currentValue: number;
  limitValue: number;
  percentage: number;
  message: string;
}

export interface LimitExceeded {
  type: 'tokens' | 'cost' | 'time' | 'files' | 'lines' | 'turns';
  currentValue: number;
  limitValue: number;
  message: string;
}

export interface LimitWarningProps {
  /** Warning information */
  warning: LimitWarning;
  /** Display mode */
  displayMode?: DisplayMode;
  /** Whether to show as an alert */
  isAlert?: boolean;
}

export interface LimitExceededProps {
  /** Exceeded limit information */
  exceeded: LimitExceeded;
  /** Task that exceeded the limit */
  taskDescription?: string;
  /** Display mode */
  displayMode?: DisplayMode;
  /** Callback when user acknowledges */
  onAcknowledge?: () => void;
}

/**
 * Get limit type information
 */
function getLimitInfo(type: string): { icon: string; unit: string; color: string } {
  switch (type) {
    case 'tokens':
      return { icon: '🎫', unit: 'tokens', color: 'cyan' };
    case 'cost':
      return { icon: '💰', unit: '$', color: 'green' };
    case 'time':
      return { icon: '⏱️', unit: 'ms', color: 'yellow' };
    case 'files':
      return { icon: '📁', unit: 'files', color: 'blue' };
    case 'lines':
      return { icon: '📄', unit: 'lines', color: 'magenta' };
    case 'turns':
      return { icon: '🔄', unit: 'turns', color: 'white' };
    default:
      return { icon: '📊', unit: 'units', color: 'gray' };
  }
}

/**
 * Format value based on type
 */
function formatValue(type: string, value: number): string {
  const info = getLimitInfo(type);

  switch (type) {
    case 'cost':
      return `${info.unit}${value.toFixed(2)}`;
    case 'time':
      return formatDuration(value);
    case 'tokens':
    case 'files':
    case 'lines':
    case 'turns':
      return `${Math.round(value)} ${info.unit}`;
    default:
      return `${value} ${info.unit}`;
  }
}

/**
 * Get warning color based on percentage
 */
function getWarningColor(percentage: number): string {
  if (percentage >= 95) return 'red';
  if (percentage >= 85) return 'redBright';
  if (percentage >= 75) return 'yellow';
  if (percentage >= 60) return 'cyan';
  return 'gray';
}

/**
 * LimitWarning component for displaying resource usage warnings
 */
export function LimitWarning({
  warning,
  displayMode = 'normal',
  isAlert = false,
}: LimitWarningProps): React.ReactElement {
  const limitInfo = getLimitInfo(warning.type);
  const warningColor = getWarningColor(warning.percentage);
  const formattedCurrent = formatValue(warning.type, warning.currentValue);
  const formattedLimit = formatValue(warning.type, warning.limitValue);

  // Compact mode: simple indicator
  if (displayMode === 'compact') {
    return (
      <Box gap={1}>
        <Text color={warningColor}>{limitInfo.icon}</Text>
        <Text color={warningColor}>{warning.percentage.toFixed(0)}%</Text>
        <Text color="gray">{warning.type}</Text>
      </Box>
    );
  }

  // Alert mode: prominent warning
  if (isAlert) {
    return (
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={warningColor}
        paddingX={1}
        paddingY={1}
      >
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color={warningColor}>
            {limitInfo.icon} RESOURCE WARNING
          </Text>
        </Box>

        <Box flexDirection="column" alignItems="center">
          <Box marginBottom={1}>
            <Text color="white" bold>
              {warning.message}
            </Text>
          </Box>

          <Box gap={2} marginBottom={1}>
            <Text color="white">Current:</Text>
            <Text color={warningColor} bold>{formattedCurrent}</Text>
            <Text color="gray">/</Text>
            <Text color="white">{formattedLimit}</Text>
            <Text color={warningColor} bold>({warning.percentage.toFixed(1)}%)</Text>
          </Box>

          <Box width={30} height={1} marginBottom={1}>
            <Text color={warningColor}>
              {'█'.repeat(Math.round((warning.percentage / 100) * 30))}
              {'░'.repeat(30 - Math.round((warning.percentage / 100) * 30))}
            </Text>
          </Box>

          <Text color="gray" dimColor>
            Consider reducing usage or increasing limits
          </Text>
        </Box>
      </Box>
    );
  }

  // Normal mode: inline warning
  return (
    <Box gap={2} borderStyle="round" borderColor={warningColor} paddingX={1}>
      <Text color={warningColor}>{limitInfo.icon}</Text>
      <Text color="white" bold>{warning.type} warning:</Text>
      <Text color={warningColor}>{formattedCurrent}</Text>
      <Text color="gray">/</Text>
      <Text color="white">{formattedLimit}</Text>
      <Text color={warningColor} bold>({warning.percentage.toFixed(1)}%)</Text>
    </Box>
  );
}

/**
 * LimitExceeded component for displaying limit violations
 */
export function LimitExceeded({
  exceeded,
  taskDescription,
  displayMode = 'normal',
  onAcknowledge,
}: LimitExceededProps): React.ReactElement {
  const limitInfo = getLimitInfo(exceeded.type);
  const formattedCurrent = formatValue(exceeded.type, exceeded.currentValue);
  const formattedLimit = formatValue(exceeded.type, exceeded.limitValue);

  // Compact mode: simple error indicator
  if (displayMode === 'compact') {
    return (
      <Box gap={1} borderStyle="single" borderColor="red" paddingX={1}>
        <Text color="red">🚫</Text>
        <Text color="red" bold>LIMIT EXCEEDED</Text>
        <Text color="gray">{exceeded.type}</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="red"
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="red">
          🚫 LIMIT EXCEEDED
        </Text>
      </Box>

      {/* Task context */}
      {taskDescription && (
        <Box marginBottom={1}>
          <Text color="white" bold>Task: </Text>
          <Text color="gray">{taskDescription}</Text>
        </Box>
      )}

      {/* Limit details */}
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Box marginBottom={1}>
          <Text color="white" bold>
            {exceeded.message}
          </Text>
        </Box>

        <Box gap={2} marginBottom={1}>
          <Text color={limitInfo.color}>{limitInfo.icon}</Text>
          <Text color="white">Used:</Text>
          <Text color="red" bold>{formattedCurrent}</Text>
          <Text color="gray">Limit:</Text>
          <Text color="white">{formattedLimit}</Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="red" bold>
            Exceeded by {formatValue(exceeded.type, exceeded.currentValue - exceeded.limitValue)}
          </Text>
        </Box>
      </Box>

      {/* Actions */}
      <Box justifyContent="center" borderTop={true} paddingTop={1}>
        <Text color="yellow">
          🛑 Task execution paused
        </Text>
      </Box>

      {onAcknowledge && (
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray" dimColor>
            Press Enter to acknowledge
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Resource usage dashboard for monitoring multiple metrics
 */
export interface ResourceUsageDashboardProps {
  /** Current usage values */
  usage: {
    tokens?: number;
    cost?: number;
    time?: number;
    files?: number;
    lines?: number;
  };
  /** Limit values */
  limits: {
    tokens?: number;
    cost?: number;
    time?: number;
    files?: number;
    lines?: number;
  };
  /** Task description */
  taskDescription?: string;
  /** Display mode */
  displayMode?: DisplayMode;
  /** Whether to show progress bars */
  showProgressBars?: boolean;
}

export function ResourceUsageDashboard({
  usage,
  limits,
  taskDescription,
  displayMode = 'normal',
  showProgressBars = true,
}: ResourceUsageDashboardProps): React.ReactElement {
  const metrics = [
    { type: 'tokens', current: usage.tokens || 0, limit: limits.tokens },
    { type: 'cost', current: usage.cost || 0, limit: limits.cost },
    { type: 'time', current: usage.time || 0, limit: limits.time },
    { type: 'files', current: usage.files || 0, limit: limits.files },
    { type: 'lines', current: usage.lines || 0, limit: limits.lines },
  ].filter(metric => metric.limit !== undefined);

  if (displayMode === 'compact') {
    return (
      <Box gap={2} borderStyle="single" borderColor="blue" paddingX={1}>
        <Text color="blue">📊</Text>
        {metrics.map(metric => {
          const percentage = metric.limit ? (metric.current / metric.limit) * 100 : 0;
          const color = getWarningColor(percentage);
          return (
            <Text key={metric.type} color={color}>
              {getLimitInfo(metric.type).icon} {percentage.toFixed(0)}%
            </Text>
          );
        })}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue">
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1} borderBottom={true}>
        <Text bold color="blue">📊 Resource Usage</Text>
        {taskDescription && (
          <Text color="gray" dimColor>{taskDescription}</Text>
        )}
      </Box>

      {/* Metrics */}
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {metrics.length === 0 ? (
          <Text color="gray" dimColor>No resource limits configured</Text>
        ) : (
          metrics.map(metric => {
            const limitInfo = getLimitInfo(metric.type);
            const percentage = metric.limit ? (metric.current / metric.limit) * 100 : 0;
            const color = getWarningColor(percentage);
            const formattedCurrent = formatValue(metric.type, metric.current);
            const formattedLimit = formatValue(metric.type, metric.limit!);

            return (
              <Box key={metric.type} flexDirection="column" marginBottom={1}>
                <Box justifyContent="space-between">
                  <Box gap={2}>
                    <Text color={limitInfo.color}>{limitInfo.icon}</Text>
                    <Text color="white" bold>{metric.type}:</Text>
                    <Text color={color}>{formattedCurrent}</Text>
                    <Text color="gray">/</Text>
                    <Text color="white">{formattedLimit}</Text>
                  </Box>
                  <Text color={color} bold>
                    {percentage.toFixed(1)}%
                  </Text>
                </Box>

                {showProgressBars && (
                  <Box width={40} marginTop={1} marginLeft={2}>
                    <Text color={color}>
                      {'█'.repeat(Math.round((percentage / 100) * 40))}
                      {'░'.repeat(40 - Math.round((percentage / 100) * 40))}
                    </Text>
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}

export default LimitWarning;