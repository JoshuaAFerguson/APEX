/**
 * Cost tracker component for displaying API usage cost
 * Shows current session cost with smart formatting
 */

import React from 'react';
import { Text } from 'ink';
import { useThemeColors } from '../../context/ThemeContext.js';

export interface CostTrackerProps {
  cost: number;
  sessionCost?: number;
  currency?: string;
  label?: string;
}

export function CostTracker({
  cost,
  sessionCost,
  currency = '$',
  label = 'cost'
}: CostTrackerProps): React.ReactElement {
  const colors = useThemeColors();

  /**
   * Format cost with appropriate precision
   */
  const formatCost = (amount: number): string => {
    if (amount === 0) {
      return `${currency}0.00`;
    }
    if (amount < 0.01) {
      return `${currency}${amount.toFixed(4)}`;
    }
    if (amount < 1) {
      return `${currency}${amount.toFixed(3)}`;
    }
    return `${currency}${amount.toFixed(2)}`;
  };

  // Determine color based on cost level
  const getCostColor = (amount: number): string => {
    if (amount === 0) return colors.muted;
    if (amount < 0.1) return colors.success;
    if (amount < 1) return colors.info;
    if (amount < 5) return colors.warning;
    return colors.error;
  };

  const displayCost = sessionCost !== undefined ? sessionCost : cost;
  const costColor = getCostColor(displayCost);

  return (
    <>
      <Text color={colors.muted}>{label}:</Text>
      <Text color={costColor}>
        {formatCost(displayCost)}
      </Text>
      {sessionCost !== undefined && sessionCost !== cost && (
        <>
          <Text color={colors.muted}>/</Text>
          <Text color={getCostColor(cost)}>{formatCost(cost)}</Text>
        </>
      )}
    </>
  );
}