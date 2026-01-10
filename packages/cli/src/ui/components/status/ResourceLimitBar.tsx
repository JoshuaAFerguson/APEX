/**
 * Individual resource limit progress bar component
 * Shows current usage vs limit with color-coded progress indicator
 */

import React from 'react';
import { Text, Box } from 'ink';
import { ProgressBar } from '../ProgressIndicators.js';
import { useLimitColors } from './useLimitColors.js';
import { useThemeColors } from '../../context/ThemeContext.js';

export interface ResourceLimitBarProps {
  /** Current usage value */
  current: number;
  /** Maximum allowed value (limit) */
  limit: number;
  /** Label for this resource type */
  label: string;
  /** Custom formatter for current value display */
  formatter?: (value: number) => string;
  /** Custom formatter for limit value display */
  limitFormatter?: (value: number) => string;
  /** Width of the progress bar (default: 20) */
  width?: number;
  /** Show the raw percentage number (default: false) */
  showPercentage?: boolean;
}

/**
 * Default formatter for numeric values
 */
function defaultFormatter(value: number): string {
  return value.toLocaleString();
}

/**
 * Resource limit bar component with color-coded usage indication
 */
export function ResourceLimitBar({
  current,
  limit,
  label,
  formatter = defaultFormatter,
  limitFormatter = defaultFormatter,
  width = 20,
  showPercentage = false
}: ResourceLimitBarProps): React.ReactElement {
  const colors = useThemeColors();
  const { level, percentage, color, isExceeded } = useLimitColors(current, limit);

  // Format display values
  const currentDisplay = formatter(current);
  const limitDisplay = limitFormatter(limit);

  // Label color based on usage level
  const labelColor = isExceeded ? color : colors.muted;

  return (
    <Box flexDirection="row" gap={1}>
      {/* Label */}
      <Text color={labelColor}>{label}:</Text>

      {/* Progress Bar */}
      <ProgressBar
        progress={percentage}
        width={width}
        showPercentage={showPercentage}
        color={color}
        backgroundColor="gray"
        responsive={false}
        animated={false}
      />

      {/* Current/Limit Display */}
      <Text color={color}>
        {currentDisplay}/{limitDisplay}
        {isExceeded && ' ⚠️'}
      </Text>

      {/* Percentage for debugging/verbose mode */}
      {showPercentage && (
        <Text color={colors.muted}>
          ({Math.round(percentage)}%)
        </Text>
      )}
    </Box>
  );
}

export interface CompactResourceLimitBarProps {
  /** Current usage value */
  current: number;
  /** Maximum allowed value (limit) */
  limit: number;
  /** Short label for this resource type */
  label: string;
  /** Custom formatter for current value display */
  formatter?: (value: number) => string;
  /** Width of the progress bar (default: 10) */
  width?: number;
}

/**
 * Compact version of ResourceLimitBar for narrow terminals
 */
export function CompactResourceLimitBar({
  current,
  limit,
  label,
  formatter = defaultFormatter,
  width = 10
}: CompactResourceLimitBarProps): React.ReactElement {
  const colors = useThemeColors();
  const { percentage, color, isExceeded } = useLimitColors(current, limit);

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={colors.muted}>{label}:</Text>
      <ProgressBar
        progress={percentage}
        width={width}
        showPercentage={false}
        color={color}
        backgroundColor="gray"
        responsive={false}
        animated={false}
      />
      <Text color={color}>
        {Math.round(percentage)}%{isExceeded && ' ⚠️'}
      </Text>
    </Box>
  );
}