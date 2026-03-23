/**
 * AgentTerminalPanel Animation Constants
 *
 * Centralized constants for CSS transitions and animations in the
 * AgentTerminalPanel component family. These constants ensure consistent
 * timing and behavior across all panel animations.
 *
 * @see ADR-0043 for animation timing specifications and rationale
 */

/**
 * Panel height CSS classes for different display states
 * @see ADR-0043 for height specifications
 */
export const PANEL_HEIGHTS = {
  /** Minimized state: 48px - header only */
  minimized: 'h-12',
  /** Normal state: 320px - default viewing height */
  normal: 'h-80',
  /** Maximized state: Full container height */
  maximized: 'h-full',
} as const

/**
 * Panel width CSS classes for different display states
 */
export const PANEL_WIDTHS = {
  /** Minimized state: Normal grid column */
  minimized: '',
  /** Normal state: Normal grid column */
  normal: '',
  /** Maximized state: Full width spanning all columns */
  maximized: 'col-span-full',
} as const

/**
 * CSS transition classes for smooth panel animations
 * @see ADR-0043 for timing rationale
 */
export const PANEL_TRANSITIONS = {
  /** Height transition: 300ms ease-out for panel expand/collapse */
  height: 'transition-[height] duration-300 ease-out',
  /** Opacity transition: 200ms ease-in-out for content fade */
  opacity: 'transition-opacity duration-200 ease-in-out',
  /** Transform transition: 200ms ease-out for chevrons/icons */
  transform: 'transition-transform duration-200 ease-out',
  /** Combined transition for elements needing multiple properties */
  all: 'transition-all duration-300 ease-out',
} as const

/**
 * Performance optimization classes for elements during transitions
 */
export const PANEL_PERFORMANCE = {
  /** Hints to browser for optimized height/opacity animations */
  willChange: 'will-change-[height,opacity]',
  /** CSS containment for better performance during animations */
  contain: 'contain-layout contain-style',
  /** Prevents interaction during active transitions */
  noInteraction: 'pointer-events-none',
} as const

/**
 * Type definitions for type safety
 */
export type PanelHeightState = keyof typeof PANEL_HEIGHTS
export type PanelWidthState = keyof typeof PANEL_WIDTHS
export type PanelTransitionType = keyof typeof PANEL_TRANSITIONS
export type PanelPerformanceHint = keyof typeof PANEL_PERFORMANCE

/**
 * Animation timing constants (in milliseconds) for JavaScript-based animations
 */
export const ANIMATION_DURATIONS = {
  /** Height animation duration */
  height: 300,
  /** Opacity animation duration */
  opacity: 200,
  /** Transform animation duration */
  transform: 200,
  /** Debounce delay for rapid state changes */
  debounce: 50,
} as const

/**
 * CSS class names for panel content animations
 */
export const PANEL_CONTENT_CLASSES = {
  /** Base class for animatable content areas */
  animate: 'panel-content-animate',
  /** Class for inner content with overflow control */
  inner: 'panel-content-inner',
  /** Data attribute for expanded state */
  expandedAttr: 'data-expanded',
} as const