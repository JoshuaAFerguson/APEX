/**
 * HandoffIndicator component - displays animated agent transition
 * Shows "previousAgent → currentAgent" with fade-out animation
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { HandoffAnimationState, ArrowStyle } from '../../hooks/useAgentHandoff.js';
import { formatHandoffElapsed } from '../../hooks/useAgentHandoff.js';
import {
  getAgentIcon,
  getIconAnimationConfig,
  shouldUseAsciiIcons,
  type IconAnimationConfig
} from './agentIcons.js';

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

  // ====== NEW: Enhanced Visual Props ======
  /** Show agent icons during transition */
  showAgentIcons?: boolean;
  /** Custom agent icons mapping */
  agentIcons?: Record<string, string>;
  /** Arrow animation style override */
  arrowStyle?: ArrowStyle;
  /** Enable smooth color transitions */
  enableColorTransition?: boolean;
  /** Force ASCII icons instead of emoji */
  forceAsciiIcons?: boolean;
}

/**
 * Get animated arrow string based on frame (legacy for backward compatibility)
 * @param frame - Arrow frame index (0, 1, or 2)
 * @returns Arrow string ("→", "→→", or "→→→")
 */
function getAnimatedArrow(frame: number): string {
  const arrows = ['→', '→→', '→→→'];
  return arrows[Math.min(frame, 2)];
}

/**
 * Enhanced arrow sequences for smoother animation
 */
const ENHANCED_ARROWS = [
  '·→',      // Frame 0: Subtle start
  '→·',      // Frame 1: Movement indication
  '→→',      // Frame 2: Building momentum
  '→→·',     // Frame 3: Continued flow
  '→→→',     // Frame 4: Peak animation
  '→→→·',    // Frame 5: Extended flow
  '⟶→→',     // Frame 6: Long arrow variant
  '⟹',       // Frame 7: Bold completion arrow
];

const SPARKLE_ARROWS = [
  '✦→',      // Sparkle start
  '→✦',      // Mid transition
  '→→✦',     // Building
  '✦→→→',    // Peak sparkle
  '→→→✦',    // Trailing sparkle
  '✦⟶→→',   // Enhanced flow
  '→⟶✦',    // Continued sparkle
  '⟹✦',      // Bold completion with sparkle
];

/**
 * Get enhanced arrow string based on frame and style
 * @param frame - Arrow frame index (0-7 for enhanced styles, 0-2 for basic)
 * @param style - Arrow animation style
 * @returns Arrow string
 */
function getEnhancedArrow(frame: number, style: ArrowStyle = 'basic'): string {
  switch (style) {
    case 'basic':
      return getAnimatedArrow(frame);
    case 'enhanced':
      return ENHANCED_ARROWS[Math.min(frame, ENHANCED_ARROWS.length - 1)];
    case 'sparkle':
      return SPARKLE_ARROWS[Math.min(frame, SPARKLE_ARROWS.length - 1)];
    default:
      return getAnimatedArrow(frame);
  }
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
 * Color transition intensity types
 */
type ColorIntensity = 'bright' | 'normal' | 'dim' | 'faded';

/**
 * Convert color intensity to Ink styling props
 * @param intensity - Color intensity level
 * @param baseColor - Base color name
 * @returns Ink Text component props
 */
function getColorIntensityProps(
  intensity: ColorIntensity,
  baseColor: string
): { color?: string; bold?: boolean; dimColor?: boolean } {
  switch (intensity) {
    case 'bright':
      return { color: baseColor, bold: true, dimColor: false };
    case 'normal':
      return { color: baseColor, bold: false, dimColor: false };
    case 'dim':
      return { color: baseColor, bold: false, dimColor: true };
    case 'faded':
      return { color: 'gray', bold: false, dimColor: true };
    default:
      return { color: baseColor, bold: false, dimColor: false };
  }
}

/**
 * Calculate color transition state based on progress and phase
 * @param progress - Animation progress (0-1)
 * @param colorPhase - Current color phase from animation state
 * @returns Source and target color intensities
 */
function getColorTransitionState(
  progress: number,
  colorPhase: 'source-bright' | 'transitioning' | 'target-bright'
): { sourceIntensity: ColorIntensity; targetIntensity: ColorIntensity } {
  // Map progress to intensity transitions
  if (progress < 0.3 || colorPhase === 'source-bright') {
    return { sourceIntensity: 'bright', targetIntensity: 'faded' };
  }
  if (progress < 0.5) {
    return { sourceIntensity: 'normal', targetIntensity: 'dim' };
  }
  if (progress < 0.7) {
    return { sourceIntensity: 'dim', targetIntensity: 'normal' };
  }
  return { sourceIntensity: 'faded', targetIntensity: 'bright' };
}

/**
 * Get border color for full mode based on progress
 * @param progress - Animation progress (0-1)
 * @param targetColor - Target agent color
 * @returns Border color string
 */
function getBorderColor(progress: number, targetColor: string): string {
  if (progress < 0.3) return 'gray';
  if (progress < 0.6) return 'white';
  if (progress < 0.85) return targetColor;
  return 'gray'; // Fade back to neutral
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

  // Enhanced visual props with sensible defaults
  showAgentIcons = true,
  agentIcons,
  arrowStyle = 'enhanced',
  enableColorTransition = true,
  forceAsciiIcons,
}: HandoffIndicatorProps): React.ReactElement | null {
  const {
    isAnimating,
    previousAgent,
    currentAgent,
    progress,
    isFading,
    pulseIntensity,
    arrowFrame,
    handoffStartTime,
    // Enhanced visual properties
    arrowAnimationFrame,
    iconFrame,
    colorIntensity,
    colorPhase,
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
  const animatedArrow = getEnhancedArrow(arrowAnimationFrame, arrowStyle);
  const pulseStyle = getPulseStyle(pulseIntensity);
  const elapsedTime = showElapsedTime && handoffStartTime
    ? formatHandoffElapsed(handoffStartTime)
    : null;
  const progressBar = showProgressBar && !compact
    ? generateProgressBar(progress)
    : null;

  // Enhanced visual calculations
  const useAscii = forceAsciiIcons ?? shouldUseAsciiIcons();
  const iconConfig = showAgentIcons ? getIconAnimationConfig(progress) : null;
  const colorTransition = enableColorTransition
    ? getColorTransitionState(progress, colorPhase)
    : null;

  // Get agent icons if enabled
  const sourceIcon = showAgentIcons
    ? getAgentIcon(previousAgent, useAscii, agentIcons)
    : null;
  const targetIcon = showAgentIcons
    ? getAgentIcon(currentAgent, useAscii, agentIcons)
    : null;

  // Calculate styled color props
  const sourceColorProps = enableColorTransition && colorTransition
    ? getColorIntensityProps(colorTransition.sourceIntensity, prevColor)
    : { color: shouldDim ? 'gray' : prevColor, dimColor: shouldDim };

  const targetColorProps = enableColorTransition && colorTransition
    ? getColorIntensityProps(colorTransition.targetIntensity, currColor)
    : {
        color: shouldDim ? 'gray' : currColor,
        dimColor: shouldDim || pulseStyle.dimColor,
        bold: pulseStyle.bold
      };

  // Enhanced border color for full mode
  const borderColor = enableColorTransition
    ? getBorderColor(progress, currColor)
    : (shouldDim ? 'gray' : 'cyan');

  if (compact) {
    // Compact mode: enhanced inline display for status bars
    return (
      <Box marginLeft={1}>
        {sourceIcon && (
          <Text {...sourceColorProps}>
            {sourceIcon}{' '}
          </Text>
        )}
        <Text {...sourceColorProps}>
          {previousAgent}
        </Text>
        <Text color={shouldDim ? 'gray' : 'white'} dimColor={shouldDim}>
          {` ${animatedArrow} `}
        </Text>
        {targetIcon && (
          <Text {...targetColorProps}>
            {targetIcon}{' '}
          </Text>
        )}
        <Text {...targetColorProps}>
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

  // Full mode: enhanced standalone box display
  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
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
        {sourceIcon && (
          <Text {...sourceColorProps}>
            {sourceIcon}{' '}
          </Text>
        )}
        <Text {...sourceColorProps} bold>
          {previousAgent}
        </Text>
        <Text color={shouldDim ? 'gray' : 'white'} dimColor={shouldDim}>
          {` ${animatedArrow} `}
        </Text>
        {targetIcon && (
          <Text {...targetColorProps}>
            {targetIcon}{' '}
          </Text>
        )}
        <Text {...targetColorProps}>
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