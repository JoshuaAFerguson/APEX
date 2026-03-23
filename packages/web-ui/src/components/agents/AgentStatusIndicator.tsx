'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { AgentIndicatorStatus, AgentStatusIndicatorProps } from '@/types/agent-status-indicator'
import {
  AGENT_STATUS_STYLES,
  AGENT_STATUS_LABELS,
  AGENT_STATUS_ICONS,
  AGENT_STATUS_ANIMATION_CLASSES,
  AGENT_STATUS_SIZE_CONFIG,
  AGENT_STATUS_ARIA_LABELS,
  AGENT_STATUS_TEST_IDS,
  getAgentStatusStyles,
  getAgentStatusAnimation,
  getAgentStatusDotAnimation,
  getAgentStatusAriaLabel,
  getAgentStatusSizeConfig,
} from '@/types/agent-status-indicator'

/**
 * Icon components based on Lucide icon names
 */
const CircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
  </svg>
)

const ActivityIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
)

const AlertCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

/**
 * Get the icon component for a status
 */
function getStatusIconComponent(status: AgentIndicatorStatus) {
  switch (status) {
    case 'idle':
      return CircleIcon
    case 'active':
      return ActivityIcon
    case 'error':
    default:
      return AlertCircleIcon
  }
}

/**
 * AgentStatusIndicator - Visual indicator for agent operational status
 *
 * Displays a status badge with icon, dot indicator, and optional label
 * showing the current operational state of an agent (idle, active, error).
 * Supports animations, different sizes, and accessibility features.
 *
 * @example
 * ```tsx
 * <AgentStatusIndicator status="active" />
 * <AgentStatusIndicator
 *   status="active"
 *   size="lg"
 *   showLabel
 *   agentName="Agent-1"
 *   animated
 * />
 * ```
 */
export const AgentStatusIndicator: React.FC<AgentStatusIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = true,
  animated = true,
  agentName,
  className,
  ...props
}) => {
  const styles = getAgentStatusStyles(status)
  const sizeConfig = getAgentStatusSizeConfig(size)
  const ariaLabel = getAgentStatusAriaLabel(status)
  const statusLabel = AGENT_STATUS_LABELS[status]
  const IconComponent = getStatusIconComponent(status)

  // Animation classes
  const containerAnimation = getAgentStatusAnimation(status, animated)
  const dotAnimation = getAgentStatusDotAnimation(status, animated)

  // Display text
  const displayText = useMemo(() => {
    if (!showLabel) return null
    if (agentName) return `${agentName} (${statusLabel})`
    return statusLabel
  }, [showLabel, agentName, statusLabel])

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-all duration-300',
        sizeConfig.container,
        styles.bg,
        styles.text,
        styles.border,
        containerAnimation,
        className
      )}
      data-testid={AGENT_STATUS_TEST_IDS.container}
      {...props}
    >
      {/* Status dot */}
      <span
        className={cn(
          'rounded-full transition-all duration-300',
          sizeConfig.dot,
          styles.dot,
          dotAnimation
        )}
        aria-hidden="true"
        data-testid={AGENT_STATUS_TEST_IDS.dot}
      />

      {/* Status icon */}
      <IconComponent
        className={cn(
          sizeConfig.icon,
          styles.icon,
          'transition-all duration-300'
        )}
        aria-hidden="true"
        data-testid={AGENT_STATUS_TEST_IDS.icon}
      />

      {/* Status label */}
      {displayText && (
        <span
          className={cn(sizeConfig.text, 'font-semibold whitespace-nowrap')}
          data-testid={agentName ? AGENT_STATUS_TEST_IDS.agentName : AGENT_STATUS_TEST_IDS.label}
        >
          {displayText}
        </span>
      )}
    </div>
  )
}

AgentStatusIndicator.displayName = 'AgentStatusIndicator'

export default AgentStatusIndicator