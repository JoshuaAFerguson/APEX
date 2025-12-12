/**
 * Token counter component for displaying token usage
 * Shows input/output tokens with smart formatting
 */

import React from 'react';
import { Text } from 'ink';
import { useThemeColors } from '../../context/ThemeContext.js';

export interface TokenCounterProps {
  inputTokens: number;
  outputTokens: number;
  label?: string;
}

export function TokenCounter({
  inputTokens,
  outputTokens,
  label = 'tokens'
}: TokenCounterProps): React.ReactElement {
  const colors = useThemeColors();

  const total = inputTokens + outputTokens;

  /**
   * Format token count with smart units
   */
  const formatTokens = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const formattedTotal = formatTokens(total);
  const formattedInput = formatTokens(inputTokens);
  const formattedOutput = formatTokens(outputTokens);

  // Show breakdown on hover-like interaction (for detailed view)
  const showBreakdown = total > 1000;

  return (
    <>
      <Text color={colors.muted}>{label}:</Text>
      <Text color={colors.info}>
        {showBreakdown ? `${formattedInput}→${formattedOutput}` : formattedTotal}
      </Text>
    </>
  );
}