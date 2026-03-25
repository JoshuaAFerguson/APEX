/**
 * ParallelAgentTerminalView Utilities
 *
 * Utility functions and configurations for managing responsive grid layouts
 * in the ParallelAgentTerminalView component. Extends the existing grid
 * configurations to support 7-12 panels with optimal responsive behavior.
 *
 * @packageDocumentation
 */

import { GRID_CONFIGS, getPanelGridClasses } from '@/lib/utils'
import type {
  AgentTerminalPanelConfig,
  ExtendedGridConfigs,
  GapConfigs,
  PanelConfigValidation,
  GridGap
} from './ParallelAgentTerminalView.types'

// ============================================================================
// Extended Grid Configurations
// ============================================================================

/**
 * Extended grid configurations for 7-12 panels
 * Builds upon the existing GRID_CONFIGS (1-6) with optimized layouts
 */
export const EXTENDED_GRID_CONFIGS: ExtendedGridConfigs = {
  ...GRID_CONFIGS,
  7: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-2',
  8: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-2',
  9: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-2',
  10: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-2',
  11: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-6 gap-2',
  12: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-6 gap-2',
} as const

/**
 * Gap configurations for different spacing options
 */
export const GAP_CONFIGS: GapConfigs = {
  sm: 'gap-2',  // 8px
  md: 'gap-4',  // 16px
  lg: 'gap-6',  // 24px
} as const

// ============================================================================
// Grid Layout Functions
// ============================================================================

/**
 * Get extended grid layout classes based on panel count and maximized state
 * @param panelCount - Number of panels in the grid (1-12)
 * @param isMaximized - Whether any panel is maximized
 * @returns CSS class string for the grid container
 */
export function getExtendedGridLayoutClasses(
  panelCount: number,
  isMaximized: boolean
): string {
  if (isMaximized) {
    // When maximized, use single column layout
    return 'grid grid-cols-1'
  }

  // Clamp panel count to supported range
  const clampedCount = Math.max(1, Math.min(12, Math.floor(panelCount)))

  // Use extended grid configuration based on panel count
  const gridConfig = EXTENDED_GRID_CONFIGS[clampedCount]
  return gridConfig || EXTENDED_GRID_CONFIGS[12] // Default to 12-panel layout for higher counts
}

/**
 * Get grid layout classes with custom gap
 * @param panelCount - Number of panels in the grid
 * @param isMaximized - Whether any panel is maximized
 * @param gap - Gap size configuration
 * @returns CSS class string for the grid container with gap
 */
export function getGridLayoutWithGap(
  panelCount: number,
  isMaximized: boolean,
  gap: GridGap = 'md'
): string {
  const baseClasses = getExtendedGridLayoutClasses(panelCount, isMaximized)
  const gapClass = GAP_CONFIGS[gap]

  // Replace default gap-2 with custom gap
  return baseClasses.replace(/gap-\d+/, gapClass)
}

// ============================================================================
// Panel Configuration Validation
// ============================================================================

/**
 * Validate panel configurations and return sanitized results
 * @param panels - Array of panel configurations to validate
 * @returns Validation result with errors, warnings, and validated panels
 */
export function validatePanelConfigurations(
  panels: AgentTerminalPanelConfig[]
): PanelConfigValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const validatedPanels: AgentTerminalPanelConfig[] = []

  // Check if panels array is provided
  if (!Array.isArray(panels)) {
    errors.push('Panels must be an array')
    return {
      isValid: false,
      errors,
      warnings,
      validatedPanels: []
    }
  }

  // Check panel count limits
  if (panels.length === 0) {
    warnings.push('No panels provided - component will show empty state')
    return {
      isValid: true, // Empty is valid, just handled differently
      errors,
      warnings,
      validatedPanels: []
    }
  } else if (panels.length > 12) {
    warnings.push(`Maximum 12 panels supported. ${panels.length} panels provided, will use first 12.`)
  }

  // Validate individual panel configurations
  const seenPanelIds = new Set<string>()
  const seenAgentIds = new Set<string>()

  panels.slice(0, 12).forEach((panel, index) => {
    // Validate required fields
    if (!panel.panelId) {
      errors.push(`Panel at index ${index} missing required 'panelId' field`)
      return
    }

    if (!panel.agentId) {
      errors.push(`Panel '${panel.panelId}' missing required 'agentId' field`)
      return
    }

    // Check for duplicate panel IDs
    if (seenPanelIds.has(panel.panelId)) {
      errors.push(`Duplicate panelId '${panel.panelId}' found`)
      return
    }
    seenPanelIds.add(panel.panelId)

    // Warn about duplicate agent IDs (allowed but may be confusing)
    if (seenAgentIds.has(panel.agentId)) {
      warnings.push(`Duplicate agentId '${panel.agentId}' found in panels`)
    }
    seenAgentIds.add(panel.agentId)

    // Validate initialState if provided
    if (panel.initialState && !['normal', 'minimized', 'maximized'].includes(panel.initialState)) {
      errors.push(`Panel '${panel.panelId}' has invalid initialState '${panel.initialState}'`)
      return
    }

    // Create validated panel with defaults
    const validatedPanel: AgentTerminalPanelConfig = {
      panelId: panel.panelId,
      agentId: panel.agentId,
      title: panel.title || `Agent ${panel.agentId}`,
      agentStatus: panel.agentStatus,
      initialState: panel.initialState || 'normal',
      autoConnect: panel.autoConnect ?? true,
      panelProps: panel.panelProps || {}
    }

    validatedPanels.push(validatedPanel)
  })

  // Check for multiple maximized panels
  const maximizedPanels = validatedPanels.filter(
    panel => panel.initialState === 'maximized'
  )
  if (maximizedPanels.length > 1) {
    warnings.push(
      `Multiple panels set to maximized state: ${maximizedPanels.map(p => p.panelId).join(', ')}. ` +
      'Only the first will be maximized.'
    )
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validatedPanels
  }
}

// ============================================================================
// Panel State Utilities
// ============================================================================

/**
 * Generate unique panel ID if not provided
 * @param agentId - Agent ID to base the panel ID on
 * @param index - Index in the panel array
 * @returns Generated panel ID
 */
export function generatePanelId(agentId: string, index: number): string {
  return `panel-${agentId}-${index}`
}

/**
 * Check if panel count requires responsive optimization warnings
 * @param panelCount - Number of panels
 * @returns Warning message if optimization needed, null otherwise
 */
export function getResponsiveWarning(panelCount: number): string | null {
  if (panelCount <= 6) return null

  if (panelCount <= 9) {
    return 'Consider using fewer panels for better mobile experience'
  }

  if (panelCount <= 12) {
    return 'High panel count may impact performance and usability on smaller screens'
  }

  return 'Panel count exceeds recommended maximum of 12'
}

/**
 * Get recommended display mode based on panel count
 * @param panelCount - Number of panels
 * @returns Recommended display mode
 */
export function getRecommendedDisplayMode(panelCount: number): 'normal' | 'compact' | 'verbose' {
  if (panelCount <= 4) return 'normal'
  if (panelCount <= 8) return 'compact'
  return 'compact' // Always use compact for 9+ panels
}

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Check if panel count may impact performance
 * @param panelCount - Number of panels
 * @returns Performance warning if applicable
 */
export function getPerformanceWarning(panelCount: number): string | null {
  if (panelCount <= 8) return null
  if (panelCount <= 10) return 'Consider monitoring performance with 9+ panels'
  return 'High panel count may impact browser performance'
}

/**
 * Get CSS classes for container overflow handling
 * @param maxHeight - Maximum height setting
 * @param panelCount - Number of panels
 * @returns CSS classes for overflow handling
 */
export function getOverflowClasses(
  maxHeight: string | 'auto' | 'none',
  panelCount: number
): string {
  const classes: string[] = []

  if (maxHeight !== 'auto' && maxHeight !== 'none') {
    classes.push('overflow-y-auto')

    // Add scrollbar styling for many panels
    if (panelCount > 6) {
      classes.push('scrollbar-thin', 'scrollbar-thumb-gray-300', 'scrollbar-track-gray-100')
    }
  }

  return classes.join(' ')
}