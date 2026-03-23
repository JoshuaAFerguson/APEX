/**
 * Types and constants for AgentStatusIndicator component
 * Provides status indicators for agent execution states with visual feedback
 */

import type { Theme } from '../../../types/theme.js';

// ============================================================================
// Core Status Types
// ============================================================================

/**
 * Agent status states that can be visually indicated
 */
export type AgentStatus = 'idle' | 'active' | 'error';

/**
 * Size variants for the status indicator
 */
export type AgentStatusIndicatorSize = 'small' | 'medium' | 'large';

/**
 * Animation states for the indicator
 */
export type AnimationState = 'none' | 'pulse' | 'spin' | 'fade';

// ============================================================================
// Component Props Interface
// ============================================================================

/**
 * Props for the AgentStatusIndicator component
 */
export interface AgentStatusIndicatorProps {
  /** Current status of the agent */
  status: AgentStatus;

  /** Size variant of the indicator */
  size?: AgentStatusIndicatorSize;

  /** Optional label text to display next to the indicator */
  label?: string;

  /** Whether to show animation for the current status */
  animated?: boolean;

  /** Custom color override (uses theme colors by default) */
  color?: string;

  /** Additional CSS class names */
  className?: string;

  /** Accessibility label for screen readers */
  ariaLabel?: string;

  /** Whether to show a tooltip on hover */
  showTooltip?: boolean;

  /** Custom tooltip text (defaults to status-based text) */
  tooltipText?: string;
}

// ============================================================================
// Style Configuration Objects
// ============================================================================

/**
 * Visual style configuration for each status
 */
export interface StatusStyle {
  color: (colors: Theme['colors']) => string;
  animation: AnimationState;
  icon?: string;
  accessibility: {
    label: string;
    description: string;
  };
}

/**
 * Size configuration for different indicator sizes
 */
export interface SizeConfig {
  width: number;
  height: number;
  fontSize: number;
  borderRadius: number;
}

/**
 * Animation timing configuration
 */
export interface AnimationConfig {
  duration: number;
  easing: string;
  iterationCount: number | 'infinite';
}

// ============================================================================
// Status-to-Style Mappings
// ============================================================================

/**
 * Maps agent status to visual style configuration
 */
export const STATUS_STYLES: Record<AgentStatus, StatusStyle> = {
  idle: {
    color: (colors) => colors.muted,
    animation: 'none',
    icon: '○',
    accessibility: {
      label: 'Agent is idle',
      description: 'The agent is currently not executing any tasks'
    }
  },
  active: {
    color: (colors) => colors.info,
    animation: 'pulse',
    icon: '●',
    accessibility: {
      label: 'Agent is active',
      description: 'The agent is currently executing tasks'
    }
  },
  error: {
    color: (colors) => colors.error,
    animation: 'fade',
    icon: '⚠',
    accessibility: {
      label: 'Agent has encountered an error',
      description: 'The agent has encountered an error during execution'
    }
  }
} as const;

/**
 * Size configurations for different indicator variants
 */
export const SIZE_CONFIGS: Record<AgentStatusIndicatorSize, SizeConfig> = {
  small: {
    width: 8,
    height: 8,
    fontSize: 8,
    borderRadius: 4
  },
  medium: {
    width: 12,
    height: 12,
    fontSize: 10,
    borderRadius: 6
  },
  large: {
    width: 16,
    height: 16,
    fontSize: 12,
    borderRadius: 8
  }
} as const;

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * Animation timing configurations
 */
export const ANIMATION_CONFIGS: Record<AnimationState, AnimationConfig> = {
  none: {
    duration: 0,
    easing: 'linear',
    iterationCount: 1
  },
  pulse: {
    duration: 1500,
    easing: 'ease-in-out',
    iterationCount: 'infinite'
  },
  spin: {
    duration: 2000,
    easing: 'linear',
    iterationCount: 'infinite'
  },
  fade: {
    duration: 1000,
    easing: 'ease-in-out',
    iterationCount: 'infinite'
  }
} as const;

/**
 * CSS animation keyframe names
 */
export const ANIMATION_KEYFRAMES = {
  pulse: 'agent-status-pulse',
  spin: 'agent-status-spin',
  fade: 'agent-status-fade'
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the style configuration for a given status
 * @param status The agent status
 * @returns Style configuration object
 */
export function getStatusStyle(status: AgentStatus): StatusStyle {
  return STATUS_STYLES[status];
}

/**
 * Get the size configuration for a given size variant
 * @param size The size variant
 * @returns Size configuration object
 */
export function getSizeConfig(size: AgentStatusIndicatorSize): SizeConfig {
  return SIZE_CONFIGS[size];
}

/**
 * Get the animation configuration for a given animation state
 * @param animation The animation state
 * @returns Animation configuration object
 */
export function getAnimationConfig(animation: AnimationState): AnimationConfig {
  return ANIMATION_CONFIGS[animation];
}

/**
 * Check if a status should be animated by default
 * @param status The agent status
 * @returns Whether the status should be animated
 */
export function shouldAnimate(status: AgentStatus): boolean {
  return STATUS_STYLES[status].animation !== 'none';
}

/**
 * Get the default tooltip text for a status
 * @param status The agent status
 * @returns Default tooltip text
 */
export function getDefaultTooltipText(status: AgentStatus): string {
  return STATUS_STYLES[status].accessibility.description;
}

/**
 * Get the accessibility label for a status
 * @param status The agent status
 * @param customLabel Optional custom label
 * @returns Accessibility label text
 */
export function getAccessibilityLabel(
  status: AgentStatus,
  customLabel?: string
): string {
  return customLabel || STATUS_STYLES[status].accessibility.label;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid AgentStatus
 * @param value The value to check
 * @returns Type predicate for AgentStatus
 */
export function isValidAgentStatus(value: unknown): value is AgentStatus {
  return typeof value === 'string' && value in STATUS_STYLES;
}

/**
 * Check if a value is a valid AgentStatusIndicatorSize
 * @param value The value to check
 * @returns Type predicate for AgentStatusIndicatorSize
 */
export function isValidIndicatorSize(value: unknown): value is AgentStatusIndicatorSize {
  return typeof value === 'string' && value in SIZE_CONFIGS;
}

/**
 * Check if a value is a valid AnimationState
 * @param value The value to check
 * @returns Type predicate for AnimationState
 */
export function isValidAnimationState(value: unknown): value is AnimationState {
  return typeof value === 'string' && value in ANIMATION_CONFIGS;
}

// ============================================================================
// Default Props
// ============================================================================

/**
 * Default props for AgentStatusIndicator component
 */
export const DEFAULT_PROPS: Required<Pick<AgentStatusIndicatorProps, 'size' | 'animated' | 'showTooltip'>> = {
  size: 'medium',
  animated: true,
  showTooltip: true
} as const;