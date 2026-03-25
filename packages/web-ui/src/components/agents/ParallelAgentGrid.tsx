'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { getGridLayoutClasses, getPanelGridClasses } from '@/lib/utils'
import { useAgentTerminalPanelState } from '@/hooks/useAgentTerminalPanelState'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'

/**
 * Props for individual panel configuration
 */
export interface ParallelAgentGridPanelConfig {
  panelId: string
  agentId: string
  title?: string
  initialState?: PanelDisplayState
}

/**
 * Props for the ParallelAgentGrid component
 */
export interface ParallelAgentGridProps {
  /**
   * Child components - should be AgentTerminalPanel components
   */
  children: React.ReactNode

  /**
   * Additional CSS classes to apply to the grid container
   */
  className?: string

  /**
   * Optional panel configurations for enhanced state management
   * If provided, will be used with useAgentTerminalPanelState
   */
  panels?: ParallelAgentGridPanelConfig[]

  /**
   * Controlled panel states (overrides internal state management)
   */
  controlledStates?: Record<string, PanelDisplayState>

  /**
   * Callback when panel state changes (for controlled mode)
   */
  onStateChange?: (panelId: string, newState: PanelDisplayState, allStates: Record<string, PanelDisplayState>) => void

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * ParallelAgentGrid - Grid container for multiple AgentTerminalPanel components
 *
 * This component provides a responsive CSS grid layout that adapts based on:
 * - Number of panels (1-12 supported)
 * - Panel states (normal, minimized, maximized)
 * - Responsive breakpoints
 *
 * Features:
 * - Responsive grid layout using getGridLayoutClasses utility
 * - Individual panel positioning using getPanelGridClasses utility
 * - Integration with useAgentTerminalPanelState hook for state management
 * - Maximized panel mutual exclusivity (only one panel can be maximized)
 * - Hidden panels when one is maximized
 * - Smooth transitions and animations
 *
 * @example
 * ```tsx
 * // Basic usage with children
 * <ParallelAgentGrid>
 *   <AgentTerminalPanel panelId="agent-1" agentId="agent-1" title="Agent 1" />
 *   <AgentTerminalPanel panelId="agent-2" agentId="agent-2" title="Agent 2" />
 * </ParallelAgentGrid>
 *
 * // With controlled state management
 * <ParallelAgentGrid
 *   panels={[
 *     { panelId: 'agent-1', agentId: 'agent-1', title: 'Agent 1' },
 *     { panelId: 'agent-2', agentId: 'agent-2', title: 'Agent 2' }
 *   ]}
 *   controlledStates={panelStates}
 *   onStateChange={(panelId, newState, allStates) => setPanelStates(allStates)}
 * />
 * ```
 */
export const ParallelAgentGrid: React.FC<ParallelAgentGridProps> = ({
  children,
  className,
  panels = [],
  controlledStates,
  onStateChange,
  debug = false,
}) => {
  // Initialize panel state management if panels are provided
  const {
    getAllStates,
    maximizedPanelId,
    hasMaximizedPanel,
    panelCount: registeredPanelCount,
  } = useAgentTerminalPanelState({
    initialStates: panels.reduce((acc, panel) => {
      acc[panel.panelId] = panel.initialState || 'normal'
      return acc
    }, {} as Record<string, PanelDisplayState>),
    controlledStates,
    onStateChange,
    debug,
  })

  // Count children to determine grid layout
  const childrenArray = React.Children.toArray(children)
  const childCount = childrenArray.length

  // Use registered panel count if available, otherwise fall back to child count
  const effectivePanelCount = registeredPanelCount > 0 ? registeredPanelCount : childCount

  // Get all current states
  const allStates = getAllStates()

  // Determine if any panel is maximized (checking both internal state and controlled state)
  const isAnyPanelMaximized = hasMaximizedPanel ||
    Object.values(controlledStates || {}).includes('maximized')

  // Get grid layout classes based on panel count and maximize state
  const gridLayoutClasses = getGridLayoutClasses(effectivePanelCount, isAnyPanelMaximized)

  if (debug) {
    console.log('[ParallelAgentGrid] Render state:', {
      effectivePanelCount,
      childCount,
      registeredPanelCount,
      isAnyPanelMaximized,
      maximizedPanelId,
      gridLayoutClasses,
      allStates,
    })
  }

  // Map children to apply grid classes
  const enhancedChildren = React.Children.map(children, (child, index) => {
    if (!React.isValidElement(child)) {
      return child
    }

    // Try to extract panel ID from child props
    const childPanelId = (child.props as any)?.panelId
    const childPanelState = childPanelId ? (controlledStates?.[childPanelId] || allStates[childPanelId]) : 'normal'
    const isThisPanelMaximized = childPanelState === 'maximized'

    // Get panel-specific grid classes
    const panelGridClasses = getPanelGridClasses(isAnyPanelMaximized, isThisPanelMaximized)

    if (debug && childPanelId) {
      console.log(`[ParallelAgentGrid] Panel ${childPanelId}:`, {
        state: childPanelState,
        isMaximized: isThisPanelMaximized,
        classes: panelGridClasses,
      })
    }

    // Wrap the child in a div with the appropriate grid classes
    return (
      <div
        key={childPanelId || `panel-${index}`}
        className={cn(panelGridClasses)}
        data-testid={childPanelId ? `panel-wrapper-${childPanelId}` : `panel-wrapper-${index}`}
      >
        {child}
      </div>
    )
  })

  return (
    <div
      className={cn(gridLayoutClasses, className)}
      data-testid="grid-container"
      role="grid"
      aria-label={`Agent terminal grid with ${effectivePanelCount} panel${effectivePanelCount !== 1 ? 's' : ''}`}
    >
      {enhancedChildren}
    </div>
  )
}

ParallelAgentGrid.displayName = 'ParallelAgentGrid'

export default ParallelAgentGrid