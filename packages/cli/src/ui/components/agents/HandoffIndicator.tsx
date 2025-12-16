/**
 * HandoffIndicator component - displays animated agent transition
 * Shows "previousAgent → currentAgent" with fade-out animation
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { HandoffAnimationState } from '../../hooks/useAgentHandoff.js';
import { formatHandoffElapsed } from '../../hooks/useAgentHandoff.js';

export interface HandoffIndicatorProps {
  /** Animation state from useAgentHandoff hook */
  animationState: HandoffAnimationState;
  /** Color mapping for agents */
  agentColors: Record<string, string>;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Show elapsed time during handoff */
  showElapsedTime?: boolean;
  /** Show progress bar in full mode */
  showProgressBar?: boolean;
}

/**
 * Get animated arrow string based on frame
 * @param frame - Arrow frame index (0, 1, or 2)
 * @returns Arrow string ("→", "→→", or "→→→")
 */
function getAnimatedArrow(frame: number): string {
  const arrows = ['→', '→→', '→→→'];
  return arrows[Math.min(frame, 2)];
}

/**
 * Get pulse styling for Ink Text component
 * @param intensity - Pulse intensity (0-1)
 * @returns Style props object
 */
function getPulseStyle(intensity: number): { bold: boolean; dimColor: boolean } {
  return {
    bold: intensity > 0.5,
    dimColor: intensity < 0.3,
  };
}

/**
 * Generate progress bar string
 * @param progress - Progress value (0-1)
 * @param width - Width in characters
 * @returns Progress bar string
 */
function generateProgressBar(progress: number, width: number = 40): string {
  const filledCount = Math.floor(progress * width);
  const emptyCount = width - filledCount;
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
}

/**
 * Component that displays the agent handoff transition
 * Following project patterns for terminal-compatible animations
 */
export function HandoffIndicator({
  animationState,
  agentColors,
  compact = false,
  showElapsedTime = true,
  showProgressBar = true,
}: HandoffIndicatorProps): React.ReactElement | null {
  const {
    isAnimating,
    previousAgent,
    currentAgent,
    progress,
    isFading,
    pulseIntensity,
    arrowFrame,
    handoffStartTime
  } = animationState;

  // Don't render if not animating or missing agent data
  if (!isAnimating || !previousAgent || !currentAgent) {
    return null;
  }

  // Calculate opacity based on fade phase
  // Progress 0-0.75: full opacity, 0.75-1.0: fade to dimmed
  const fadeThreshold = 0.75;
  const shouldDim = progress > fadeThreshold;

  // Get colors for agents, fallback to white if not defined
  const prevColor = agentColors[previousAgent] || 'white';
  const currColor = agentColors[currentAgent] || 'white';

  // Enhanced animation features
  const animatedArrow = getAnimatedArrow(arrowFrame);
  const pulseStyle = getPulseStyle(pulseIntensity);
  const elapsedTime = showElapsedTime && handoffStartTime
    ? formatHandoffElapsed(handoffStartTime)
    : null;
  const progressBar = showProgressBar && !compact
    ? generateProgressBar(progress)
    : null;

  if (compact) {
    // Compact mode: inline display for status bars
    return (
      <Box marginLeft={1}>
        <Text color={shouldDim ? 'gray' : prevColor} dimColor={shouldDim}>
          {previousAgent}
        </Text>
        <Text color={shouldDim ? 'gray' : 'white'} dimColor={shouldDim}>
          {` ${animatedArrow} `}
        </Text>
        <Text
          color={shouldDim ? 'gray' : currColor}
          dimColor={shouldDim || pulseStyle.dimColor}
          bold={pulseStyle.bold}
        >
          {currentAgent}
        </Text>
        {elapsedTime && (
          <Text color={shouldDim ? 'gray' : 'white'} dimColor={shouldDim}>
            {` [${elapsedTime}]`}
          </Text>
        )}
      </Box>
    );
  }

  // Full mode: standalone box display
  return (
    <Box
      borderStyle="round"
      borderColor={shouldDim ? 'gray' : 'cyan'}
      paddingX={1}
      marginY={1}
      flexDirection="column"
    >
      <Box alignItems="center">
        <Text color="cyan" dimColor={shouldDim}>
          ⚡ Handoff
        </Text>
        {elapsedTime && (
          <Text color={shouldDim ? 'gray' : 'white'} dimColor={shouldDim}>
            {` [${elapsedTime}]`}
          </Text>
        )}
        <Text color={shouldDim ? 'gray' : 'white'} dimColor={shouldDim}>
          :{' '}
        </Text>
        <Text color={shouldDim ? 'gray' : prevColor} dimColor={shouldDim} bold>
          {previousAgent}
        </Text>
        <Text color={shouldDim ? 'gray' : 'white'} dimColor={shouldDim}>
          {` ${animatedArrow} `}
        </Text>
        <Text
          color={shouldDim ? 'gray' : currColor}
          dimColor={shouldDim || pulseStyle.dimColor}
          bold={pulseStyle.bold}
        >
          {currentAgent}
        </Text>
      </Box>
      {progressBar && (
        <Box marginTop={1}>
          <Text color={shouldDim ? 'gray' : 'white'} dimColor={shouldDim}>
            {progressBar} {Math.round(progress * 100)}%
          </Text>
        </Box>
      )}
    </Box>
  );
}