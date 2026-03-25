'use client'

import React, { forwardRef, useImperativeHandle, useMemo, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { AgentTerminalPanel } from './AgentTerminalPanel'
import { useAgentTerminalPanelState } from '@/hooks/useAgentTerminalPanelState'
import type {
  ParallelAgentTerminalViewProps,
  ParallelAgentTerminalViewRef,
  AgentTerminalPanelConfig,
  GridGap
} from './ParallelAgentTerminalView.types'
import {
  getExtendedGridLayoutClasses,
  validatePanelConfigurations,
  GAP_CONFIGS,
  getOverflowClasses,
  getResponsiveWarning,
  getPerformanceWarning,
} from './ParallelAgentTerminalView.utils'
import { getPanelGridClasses } from '@/lib/utils'

/**
 * ParallelAgentTerminalView - Responsive grid layout for multiple agent terminals
 *
 * Provides a responsive CSS grid layout for displaying 1-12 AgentTerminalPanel
 * components simultaneously. Features responsive breakpoints, gap spacing,
 * overflow handling, and coordinated panel state management.
 *
 * Key Features:
 * - Responsive grid layout (1-6 columns based on screen size and panel count)
 * - Panel state management with mutual exclusivity for maximized panels
 * - Configurable gap spacing between panels
 * - Overflow handling with scrolling support
 * - Panel validation and sanitization
 * - Performance warnings for high panel counts
 * - Accessibility support with ARIA labels
 * - Imperative API via ref for external control
 *
 * @example
 * ```tsx
 * const panels = [
 *   { panelId: 'agent-1', agentId: 'agent-1', title: 'Agent 1' },
 *   { panelId: 'agent-2', agentId: 'agent-2', title: 'Agent 2' },
 * ]
 *
 * <ParallelAgentTerminalView
 *   panels={panels}
 *   gap="md"
 *   maxHeight="600px"
 *   onPanelStateChange={(id, state) => console.log(`Panel ${id}: ${state}`)}
 * />
 * ```
 */
export const ParallelAgentTerminalView = forwardRef<
  ParallelAgentTerminalViewRef,
  ParallelAgentTerminalViewProps
>(({
  panels,
  gap = 'md',
  maxHeight = 'auto',
  panelStates: controlledStates,
  onPanelStateChange,
  onPanelClose,
  className,
  testId = 'parallel-agent-terminal-view',
  displayMode = 'normal',
  showLoadingSkeleton = false,
}, ref) => {

  // ============================================================================
  // Panel Validation and Sanitization
  // ============================================================================

  const validation = useMemo(() => {
    return validatePanelConfigurations(panels)
  }, [panels])

  // Log validation warnings in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      validation.warnings.forEach(warning => {
        console.warn(`[ParallelAgentTerminalView]: ${warning}`)
      })

      const responsiveWarning = getResponsiveWarning(validation.validatedPanels.length)
      if (responsiveWarning) {
        console.warn(`[ParallelAgentTerminalView]: ${responsiveWarning}`)
      }

      const performanceWarning = getPerformanceWarning(validation.validatedPanels.length)
      if (performanceWarning) {
        console.warn(`[ParallelAgentTerminalView]: ${performanceWarning}`)
      }
    }
  }, [validation])

  // Throw error if validation fails
  if (!validation.isValid) {
    throw new Error(
      `ParallelAgentTerminalView validation failed: ${validation.errors.join(', ')}`
    )
  }

  const validatedPanels = validation.validatedPanels

  // ============================================================================
  // Panel State Management
  // ============================================================================

  const {
    minimize,
    maximize,
    restore,
    restoreAll,
    getPanelState,
    getAllStates,
    hasMaximizedPanel,
    maximizedPanelId,
    registerPanel,
    unregisterPanel,
  } = useAgentTerminalPanelState({
    controlledStates,
    onStateChange: onPanelStateChange,
  })

  // Register panels with their initial states
  useEffect(() => {
    validatedPanels.forEach(panel => {
      registerPanel(panel.panelId, panel.initialState)
    })

    // Cleanup: unregister panels that are no longer in the array
    return () => {
      validatedPanels.forEach(panel => {
        unregisterPanel(panel.panelId)
      })
    }
  }, [validatedPanels, registerPanel, unregisterPanel])

  // ============================================================================
  // Grid Layout Configuration
  // ============================================================================

  const gridClasses = useMemo(() => {
    const baseClasses = getExtendedGridLayoutClasses(
      validatedPanels.length,
      hasMaximizedPanel
    )

    // Replace default gap with custom gap
    const gapClass = GAP_CONFIGS[gap]
    return baseClasses.replace(/gap-\d+/, gapClass)
  }, [validatedPanels.length, hasMaximizedPanel, gap])

  // ============================================================================
  // Container Styling
  // ============================================================================

  const containerStyle = useMemo(() => ({
    maxHeight: maxHeight === 'auto' ? undefined : maxHeight,
  }), [maxHeight])

  const overflowClasses = useMemo(() => {
    return getOverflowClasses(maxHeight, validatedPanels.length)
  }, [maxHeight, validatedPanels.length])

  // ============================================================================
  // Imperative Handle (Ref API)
  // ============================================================================

  const focusPanel = useCallback((panelId: string) => {
    // Find the panel element and focus it
    const panelElement = document.querySelector(
      `[data-testid="${testId}"] [data-panel-id="${panelId}"]`
    ) as HTMLElement

    if (panelElement) {
      panelElement.focus()
      // Scroll into view if needed
      panelElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })
    }
  }, [testId])

  useImperativeHandle(ref, () => ({
    minimizeAll: () => {
      validatedPanels.forEach(panel => minimize(panel.panelId))
    },
    restoreAll,
    getAllStates,
    maximizePanel: (panelId: string) => maximize(panelId),
    focusPanel,
  }), [validatedPanels, minimize, restoreAll, getAllStates, maximize, focusPanel])

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handlePanelClose = useCallback((panelId: string) => {
    // Clean up panel state
    unregisterPanel(panelId)
    // Notify parent
    onPanelClose?.(panelId)
  }, [unregisterPanel, onPanelClose])

  // ============================================================================
  // Rendering
  // ============================================================================

  if (validatedPanels.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center p-8 text-gray-500', className)}
        data-testid={`${testId}-empty`}
        role="region"
        aria-label="No agent terminals"
      >
        No agent terminals to display
      </div>
    )
  }

  return (
    <div
      className={cn(
        'w-full',
        gridClasses,
        overflowClasses,
        className
      )}
      style={containerStyle}
      data-testid={testId}
      role="region"
      aria-label={`Parallel agent terminals (${validatedPanels.length} panels)`}
      aria-describedby={`${testId}-description`}
    >
      {/* Hidden description for screen readers */}
      <div
        id={`${testId}-description`}
        className="sr-only"
      >
        Grid of {validatedPanels.length} agent terminal panels.
        {hasMaximizedPanel && maximizedPanelId &&
          `Panel ${maximizedPanelId} is currently maximized.`
        }
      </div>

      {validatedPanels.map((config) => {
        const panelState = getPanelState(config.panelId)
        const isThisPanelMaximized = maximizedPanelId === config.panelId
        const panelGridClasses = getPanelGridClasses(
          hasMaximizedPanel,
          isThisPanelMaximized
        )

        return (
          <div
            key={config.panelId}
            className={cn(
              'relative',
              panelGridClasses,
              // Add focus styling for keyboard navigation
              'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50',
              // Ensure proper stacking for maximized panels
              isThisPanelMaximized ? 'z-10' : 'z-0'
            )}
            data-panel-id={config.panelId}
            data-panel-state={panelState}
          >
            <AgentTerminalPanel
              panelId={config.panelId}
              agentId={config.agentId}
              title={config.title}
              agentStatus={config.agentStatus}
              panelState={panelState}
              autoConnect={config.autoConnect}
              onMinimize={() => minimize(config.panelId)}
              onMaximize={() => maximize(config.panelId)}
              onRestore={() => restore(config.panelId)}
              onClose={() => handlePanelClose(config.panelId)}
              {...config.panelProps}
            />
          </div>
        )
      })}
    </div>
  )
})

ParallelAgentTerminalView.displayName = 'ParallelAgentTerminalView'