/**
 * Resource usage display component for showing comprehensive usage statistics
 * Shows token usage, cost, and API call count in a single compact line
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useThemeColors } from '../../context/ThemeContext.js';
import { ResourceLimitBar, CompactResourceLimitBar } from './ResourceLimitBar.js';

/**
 * Resource limits configuration for usage indicators
 */
export interface ResourceLimits {
  /** Maximum tokens per task (maps to config.limits.maxTokensPerTask) */
  maxTokens?: number;
  /** Maximum cost per task (maps to config.limits.maxCostPerTask) */
  maxCost?: number;
  /** Maximum API calls per task (optional limit) */
  maxApiCalls?: number;
  /** Daily budget limit (maps to config.limits.dailyBudget) */
  dailyBudget?: number;
}

export interface ResourceUsageDisplayProps {
  // Token metrics
  inputTokens: number;
  outputTokens: number;

  // Cost tracking
  cost: number;
  currency?: string;           // Default: '$'

  // API calls count
  apiCalls: number;

  // Display configuration
  showBreakdown?: boolean;     // Show input→output tokens (default: auto based on total > 1000)
  compact?: boolean;           // Compact mode for narrow terminals (default: false)
  label?: string;              // Custom label prefix (default: 'usage')

  // New props for limit indicators
  limits?: ResourceLimits;     // Resource limits configuration
  showLimitIndicators?: boolean;  // Show limit indicators (default: true when limits provided)
}

/**
 * Token formatting with smart units
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return count.toString();
}

/**
 * Cost formatting with adaptive precision
 */
export function formatCurrency(amount: number, currency: string = '$'): string {
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
}

/**
 * API calls formatting with locale commas
 */
export function formatApiCalls(count: number): string {
  return count.toLocaleString();
}

export function ResourceUsageDisplay({
  inputTokens,
  outputTokens,
  cost,
  currency = '$',
  apiCalls,
  showBreakdown,
  compact = false,
  label = 'usage',
  limits,
  showLimitIndicators
}: ResourceUsageDisplayProps): React.ReactElement {
  const colors = useThemeColors();

  const totalTokens = inputTokens + outputTokens;

  // Determine whether to show token breakdown
  const shouldShowBreakdown = showBreakdown !== undefined
    ? showBreakdown
    : totalTokens > 1000;

  // Format tokens based on breakdown setting
  const formattedTokens = shouldShowBreakdown && !compact
    ? `${formatTokenCount(inputTokens)}→${formatTokenCount(outputTokens)} (${formatTokenCount(totalTokens)} total)`
    : formatTokenCount(totalTokens);

  // Format cost with appropriate color coding
  const formattedCost = formatCurrency(cost, currency);
  const getCostColor = (amount: number): string => {
    if (amount === 0) return colors.muted;
    if (amount < 0.1) return colors.success;
    if (amount < 1) return colors.info;
    if (amount < 5) return colors.warning;
    return colors.error;
  };
  const costColor = getCostColor(cost);

  // Format API calls
  const formattedApiCalls = formatApiCalls(apiCalls);

  // Determine whether to show limit indicators
  const shouldShowLimitIndicators = showLimitIndicators !== undefined
    ? showLimitIndicators
    : Boolean(limits && (limits.maxTokens || limits.maxCost || limits.maxApiCalls || limits.dailyBudget));

  if (compact) {
    // Compact layout: "2k tok | $0.00 | 5" with optional limit bars below
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text color={colors.info}>{formatTokenCount(totalTokens)} tok</Text>
          <Text color={colors.muted}>|</Text>
          <Text color={costColor}>{formattedCost}</Text>
          <Text color={colors.muted}>|</Text>
          <Text color={colors.info}>{formattedApiCalls}</Text>
        </Box>

        {shouldShowLimitIndicators && limits && (
          <Box flexDirection="row" gap={2} marginTop={1}>
            {limits.maxTokens && (
              <CompactResourceLimitBar
                current={totalTokens}
                limit={limits.maxTokens}
                label="tokens"
                formatter={formatTokenCount}
                width={8}
              />
            )}
            {limits.maxCost && (
              <CompactResourceLimitBar
                current={cost}
                limit={limits.maxCost}
                label="cost"
                formatter={(val) => formatCurrency(val, currency)}
                width={8}
              />
            )}
            {limits.maxApiCalls && (
              <CompactResourceLimitBar
                current={apiCalls}
                limit={limits.maxApiCalls}
                label="calls"
                width={6}
              />
            )}
          </Box>
        )}
      </Box>
    );
  }

  // Standard layout: "usage: 1.2k→800 (2k total) | $0.0034 | 5 calls" with optional limit bars below
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={colors.muted}>{label}:</Text>
        <Text color={colors.info}>{formattedTokens}</Text>
        <Text color={colors.muted}>|</Text>
        <Text color={costColor}>{formattedCost}</Text>
        <Text color={colors.muted}>|</Text>
        <Text color={colors.info}>{formattedApiCalls} {apiCalls === 1 ? 'call' : 'calls'}</Text>
      </Box>

      {shouldShowLimitIndicators && limits && (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          {limits.maxTokens && (
            <ResourceLimitBar
              current={totalTokens}
              limit={limits.maxTokens}
              label="tokens"
              formatter={formatTokenCount}
              limitFormatter={formatTokenCount}
              width={20}
            />
          )}
          {limits.maxCost && (
            <ResourceLimitBar
              current={cost}
              limit={limits.maxCost}
              label="cost"
              formatter={(val) => formatCurrency(val, currency)}
              limitFormatter={(val) => formatCurrency(val, currency)}
              width={20}
            />
          )}
          {limits.maxApiCalls && (
            <ResourceLimitBar
              current={apiCalls}
              limit={limits.maxApiCalls}
              label="calls"
              formatter={formatApiCalls}
              limitFormatter={formatApiCalls}
              width={20}
            />
          )}
          {limits.dailyBudget && (
            <ResourceLimitBar
              current={cost}
              limit={limits.dailyBudget}
              label="daily budget"
              formatter={(val) => formatCurrency(val, currency)}
              limitFormatter={(val) => formatCurrency(val, currency)}
              width={20}
            />
          )}
        </Box>
      )}
    </Box>
  );
}