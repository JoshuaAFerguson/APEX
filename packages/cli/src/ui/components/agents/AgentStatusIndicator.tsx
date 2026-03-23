/**
 * AgentStatusIndicator component - Visual status indicator for agent execution states
 * Provides status dots with color-coded states and optional pulsing animations
 * Terminal-compatible using Ink for consistent rendering across environments
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useThemeColors } from '../../context/ThemeContext.js';
import {
  type AgentStatusIndicatorProps,
  type AgentStatus,
  type AnimationState,
  getStatusStyle,
  getSizeConfig,
  getAnimationConfig,
  getAccessibilityLabel,
  getDefaultTooltipText,
  shouldAnimate,
  DEFAULT_PROPS,
  ANIMATION_KEYFRAMES
} from './AgentStatusIndicator.types.js';

/**
 * Hook to manage animation state for terminal-compatible animations
 * Uses simple state cycling rather than CSS keyframes
 */
function useTerminalAnimation(
  animationState: AnimationState,
  enabled: boolean
): { animationFrame: number; isAnimating: boolean } {
  const [animationFrame, setAnimationFrame] = React.useState(0);
  const isAnimating = enabled && animationState !== 'none';

  React.useEffect(() => {
    if (!isAnimating) {
      setAnimationFrame(0);
      return;
    }

    const config = getAnimationConfig(animationState);
    const interval = setInterval(() => {
      setAnimationFrame(prev => {
        switch (animationState) {
          case 'pulse':
            // 4-frame pulse cycle: normal -> bright -> normal -> dim
            return (prev + 1) % 4;
          case 'fade':
            // 6-frame fade cycle: normal -> dim -> dimmer -> dim -> normal -> bright
            return (prev + 1) % 6;
          case 'spin':
            // 8-frame spin cycle: different character rotations
            return (prev + 1) % 8;
          default:
            return 0;
        }
      });
    }, config.duration / (animationState === 'pulse' ? 4 : animationState === 'fade' ? 6 : 8));

    return () => clearInterval(interval);
  }, [isAnimating, animationState]);

  return { animationFrame, isAnimating };
}

/**
 * Get animated status character based on animation state and frame
 */
function getAnimatedStatusChar(
  status: AgentStatus,
  animationState: AnimationState,
  frame: number
): string {
  const baseStyle = getStatusStyle(status);
  const baseIcon = baseStyle.icon || '●';

  if (animationState === 'none') {
    return baseIcon;
  }

  switch (animationState) {
    case 'pulse':
      // Pulse animation: alternate between filled and empty dots
      return frame % 2 === 0 ? baseIcon : (status === 'idle' ? '○' : '◉');

    case 'fade':
      // Fade animation: cycle through different opacity representations
      const fadeChars = ['●', '◐', '◑', '◒', '◓', '○'];
      return fadeChars[frame] || baseIcon;

    case 'spin':
      // Spin animation: rotating character sequence
      const spinChars = ['●', '◐', '◑', '◒', '◓', '○', '◔', '◕'];
      return spinChars[frame] || baseIcon;

    default:
      return baseIcon;
  }
}

/**
 * Get animation styling props for Ink Text component
 */
function getAnimationStyle(
  animationState: AnimationState,
  frame: number,
  baseColor: string
): {
  color: string;
  bold: boolean;
  dimColor: boolean;
} {
  if (animationState === 'none') {
    return {
      color: baseColor,
      bold: false,
      dimColor: false
    };
  }

  switch (animationState) {
    case 'pulse':
      return {
        color: baseColor,
        bold: frame % 2 === 1,
        dimColor: false
      };

    case 'fade':
      const isDim = frame >= 2 && frame <= 4;
      return {
        color: baseColor,
        bold: frame === 5,
        dimColor: isDim
      };

    case 'spin':
      return {
        color: baseColor,
        bold: frame % 3 === 1,
        dimColor: frame % 4 === 3
      };

    default:
      return {
        color: baseColor,
        bold: false,
        dimColor: false
      };
  }
}

/**
 * Main AgentStatusIndicator component
 * Renders a status dot with appropriate colors and animations for terminal display
 */
export function AgentStatusIndicator({
  status,
  size = DEFAULT_PROPS.size,
  label,
  animated = DEFAULT_PROPS.animated,
  color,
  className, // Note: className not used in Ink but kept for API compatibility
  ariaLabel,
  showTooltip = DEFAULT_PROPS.showTooltip,
  tooltipText,
}: AgentStatusIndicatorProps): React.ReactElement {
  const colors = useThemeColors();
  const statusStyle = getStatusStyle(status);
  const sizeConfig = getSizeConfig(size);

  // Determine if animation should be enabled
  const shouldUseAnimation = animated && shouldAnimate(status);
  const animationState = shouldUseAnimation ? statusStyle.animation : 'none';

  // Use terminal animation hook
  const { animationFrame, isAnimating } = useTerminalAnimation(animationState, shouldUseAnimation);

  // Determine colors
  const statusColor = color || statusStyle.color(colors);
  const animationStyle = getAnimationStyle(animationState, animationFrame, statusColor);

  // Get animated status character
  const statusChar = getAnimatedStatusChar(status, animationState, animationFrame);

  // Get accessibility information
  const accessibilityLabel = getAccessibilityLabel(status, ariaLabel);
  const tooltip = tooltipText || getDefaultTooltipText(status);

  // Determine sizing approach for terminal
  // Since we can't use exact pixel sizing in terminal, we use character-based approximations
  const characterWidth = size === 'small' ? 1 : size === 'large' ? 2 : 1;
  const spacing = size === 'large' ? 1 : 0;

  // Create indicator content
  const indicatorContent = (
    <Text {...animationStyle}>
      {statusChar.repeat(characterWidth)}
    </Text>
  );

  // If we have a label, render with the label
  if (label) {
    return (
      <Box alignItems="center" gap={1}>
        {indicatorContent}
        <Text color={colors.text}>
          {label}
        </Text>
        {showTooltip && (
          <Text color={colors.textMuted} dimColor>
            ({tooltip})
          </Text>
        )}
      </Box>
    );
  }

  // If we want to show tooltip without label
  if (showTooltip && !label) {
    return (
      <Box alignItems="center" gap={1}>
        {indicatorContent}
        <Text color={colors.textMuted} dimColor>
          {tooltip}
        </Text>
      </Box>
    );
  }

  // Just the indicator
  return (
    <Box marginLeft={spacing} marginRight={spacing}>
      {indicatorContent}
    </Box>
  );
}

/**
 * Export default props for external use
 */
export const defaultProps = DEFAULT_PROPS;

/**
 * Re-export types for convenience
 */
export type { AgentStatusIndicatorProps, AgentStatus } from './AgentStatusIndicator.types.js';