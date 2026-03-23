/**
 * Agent Status Indicator Types
 *
 * Type definitions, styling constants, and configuration for the
 * AgentStatusIndicator component. Provides visual feedback for
 * agent operational states (idle, active, error).
 *
 * @packageDocumentation
 */

import type React from 'react'

// ============================================================================
// Core Types
// ============================================================================

/**
 * Agent operational status states
 *
 * - idle: Agent is ready but not currently processing
 * - active: Agent is actively processing a task
 * - error: Agent has encountered an error
 */
export type AgentIndicatorStatus = 'idle' | 'active' | 'error'

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for the AgentStatusIndicator component
 */
export interface AgentStatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Current status of the agent
   */
  status: AgentIndicatorStatus

  /**
   * Size variant for the indicator
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Whether to show the status label text
   * @default true
   */
  showLabel?: boolean

  /**
   * Whether to enable animations (pulse for active, etc.)
   * @default true
   */
  animated?: boolean

  /**
   * Optional agent name to display
   */
  agentName?: string

  /**
   * Custom className for styling overrides
   */
  className?: string
}

// ============================================================================
// Status Styling
// ============================================================================

/**
 * Style configuration for a status state
 */
export interface AgentStatusStyle {
  /** Background color class */
  bg: string
  /** Text color class */
  text: string
  /** Border color class */
  border: string
  /** Icon color class */
  icon: string
  /** Dot/indicator color class */
  dot: string
  /** Glow/shadow effect class */
  glow: string
}

/**
 * Status-specific styling for agent states
 */
export const AGENT_STATUS_STYLES: Record<AgentIndicatorStatus, AgentStatusStyle> = {
  idle: {
    bg: 'bg-gray-950/50',
    text: 'text-gray-400',
    border: 'border-gray-900',
    icon: 'text-gray-500',
    dot: 'bg-gray-500',
    glow: 'shadow-gray-500/20',
  },
  active: {
    bg: 'bg-green-950/50',
    text: 'text-green-400',
    border: 'border-green-900',
    icon: 'text-green-500',
    dot: 'bg-green-500',
    glow: 'shadow-green-500/20',
  },
  error: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    dot: 'bg-red-500',
    glow: 'shadow-red-500/20',
  },
} as const

/**
 * Human-readable labels for agent statuses
 */
export const AGENT_STATUS_LABELS: Record<AgentIndicatorStatus, string> = {
  idle: 'Idle',
  active: 'Active',
  error: 'Error',
}

/**
 * Icons for agent statuses (using Lucide icon names)
 */
export const AGENT_STATUS_ICONS: Record<AgentIndicatorStatus, string> = {
  idle: 'Circle',
  active: 'Activity',
  error: 'AlertCircle',
}

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * Animation timing configuration
 */
export const AGENT_STATUS_ANIMATION_CONFIG = {
  /** Duration for pulse animation on active status (ms) */
  pulseDuration: 2000,

  /** Duration for fade transitions (ms) */
  fadeDuration: 150,

  /** Duration for scale transitions (ms) */
  scaleDuration: 200,

  /** CSS easing function for smooth animations */
  easing: 'ease-in-out',

  /** Ping animation interval for active status (ms) */
  pingInterval: 1500,
} as const

/**
 * CSS animation classes for status states
 */
export const AGENT_STATUS_ANIMATION_CLASSES = {
  /** Pulse animation for active state */
  pulse: 'animate-pulse',

  /** Ping animation for active dot indicator */
  ping: 'animate-ping',

  /** Spin animation for loading states */
  spin: 'animate-spin',

  /** Bounce animation for error attention */
  bounce: 'animate-bounce',

  /** No animation */
  none: '',
} as const

/**
 * Status-to-animation mapping
 */
export const AGENT_STATUS_ANIMATIONS: Record<AgentIndicatorStatus, string> = {
  idle: AGENT_STATUS_ANIMATION_CLASSES.none,
  active: AGENT_STATUS_ANIMATION_CLASSES.pulse,
  error: AGENT_STATUS_ANIMATION_CLASSES.none,
}

/**
 * Dot animation for each status (separate from container animation)
 */
export const AGENT_STATUS_DOT_ANIMATIONS: Record<AgentIndicatorStatus, string> = {
  idle: AGENT_STATUS_ANIMATION_CLASSES.none,
  active: AGENT_STATUS_ANIMATION_CLASSES.ping,
  error: AGENT_STATUS_ANIMATION_CLASSES.none,
}

// ============================================================================
// Size Configuration
// ============================================================================

/**
 * Size variant configuration
 */
export interface AgentStatusSizeConfig {
  /** Container/wrapper classes */
  container: string
  /** Icon size classes */
  icon: string
  /** Status dot size classes */
  dot: string
  /** Text size class */
  text: string
}

/**
 * Size configurations for different indicator sizes
 */
export const AGENT_STATUS_SIZE_CONFIG: Record<'sm' | 'md' | 'lg', AgentStatusSizeConfig> = {
  sm: {
    container: 'px-2 py-1 gap-1',
    icon: 'w-3 h-3',
    dot: 'w-2 h-2',
    text: 'text-xs',
  },
  md: {
    container: 'px-3 py-1.5 gap-1.5',
    icon: 'w-4 h-4',
    dot: 'w-2.5 h-2.5',
    text: 'text-sm',
  },
  lg: {
    container: 'px-4 py-2 gap-2',
    icon: 'w-5 h-5',
    dot: 'w-3 h-3',
    text: 'text-base',
  },
} as const

// ============================================================================
// Accessibility
// ============================================================================

/**
 * ARIA labels for accessibility
 */
export const AGENT_STATUS_ARIA_LABELS: Record<AgentIndicatorStatus, string> = {
  idle: 'Agent is idle and ready',
  active: 'Agent is actively processing',
  error: 'Agent has encountered an error',
}

// ============================================================================
// Test IDs
// ============================================================================

/**
 * Test IDs for component testing
 */
export const AGENT_STATUS_TEST_IDS = {
  container: 'agent-status-indicator',
  dot: 'agent-status-dot',
  icon: 'agent-status-icon',
  label: 'agent-status-label',
  agentName: 'agent-status-name',
} as const

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default prop values for AgentStatusIndicator
 */
export const AGENT_STATUS_INDICATOR_DEFAULTS = {
  size: 'md' as const,
  showLabel: true,
  animated: true,
  status: 'idle' as AgentIndicatorStatus,
} as const

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the complete style configuration for a status
 */
export function getAgentStatusStyles(status: AgentIndicatorStatus): AgentStatusStyle {
  return AGENT_STATUS_STYLES[status]
}

/**
 * Get the animation class for a status
 */
export function getAgentStatusAnimation(
  status: AgentIndicatorStatus,
  animated: boolean = true
): string {
  if (!animated) return AGENT_STATUS_ANIMATION_CLASSES.none
  return AGENT_STATUS_ANIMATIONS[status]
}

/**
 * Get the dot animation class for a status
 */
export function getAgentStatusDotAnimation(
  status: AgentIndicatorStatus,
  animated: boolean = true
): string {
  if (!animated) return AGENT_STATUS_ANIMATION_CLASSES.none
  return AGENT_STATUS_DOT_ANIMATIONS[status]
}

/**
 * Get the ARIA label for a status
 */
export function getAgentStatusAriaLabel(status: AgentIndicatorStatus): string {
  return AGENT_STATUS_ARIA_LABELS[status]
}

/**
 * Get size configuration for a size variant
 */
export function getAgentStatusSizeConfig(size: 'sm' | 'md' | 'lg'): AgentStatusSizeConfig {
  return AGENT_STATUS_SIZE_CONFIG[size]
}

/**
 * Check if a status should show animation
 */
export function shouldAnimateStatus(status: AgentIndicatorStatus): boolean {
  return status === 'active'
}
