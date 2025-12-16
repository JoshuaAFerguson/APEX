import { useMemo } from 'react';
import useStdoutDimensionsBase from 'ink-use-stdout-dimensions';

/**
 * Terminal dimensions interface
 */
export interface StdoutDimensions {
  /** Terminal width in columns */
  width: number;
  /** Terminal height in rows */
  height: number;
  /** Responsive breakpoint classification */
  breakpoint: 'narrow' | 'normal' | 'wide';
  /** Whether the terminal size is available (vs using fallbacks) */
  isAvailable: boolean;
}

/**
 * Hook configuration options
 */
export interface UseStdoutDimensionsOptions {
  /** Custom fallback width (default: 80) */
  fallbackWidth?: number;
  /** Custom fallback height (default: 24) */
  fallbackHeight?: number;
  /** Custom narrow threshold (default: 60) */
  narrowThreshold?: number;
  /** Custom wide threshold (default: 120) */
  wideThreshold?: number;
}

/**
 * Type alias for breakpoint classification
 */
export type Breakpoint = 'narrow' | 'normal' | 'wide';

/**
 * Helper function to determine breakpoint from width
 */
function getBreakpoint(
  width: number,
  narrowThreshold: number = 60,
  wideThreshold: number = 120
): Breakpoint {
  if (width < narrowThreshold) return 'narrow';
  if (width >= wideThreshold) return 'wide';
  return 'normal';
}

/**
 * Custom hook for tracking terminal (stdout) dimensions with responsive breakpoints
 *
 * This hook provides terminal width/height detection with resize event handling
 * and responsive breakpoint classification. It wraps ink-use-stdout-dimensions
 * to provide enhanced functionality and consistent interfaces.
 *
 * @param options - Configuration options for fallbacks and thresholds
 * @returns Terminal dimensions with breakpoint classification and availability status
 *
 * @example
 * ```tsx
 * function ResponsivePanel() {
 *   const { width, breakpoint, isAvailable } = useStdoutDimensions();
 *
 *   if (breakpoint === 'narrow') {
 *     return <CompactView width={width} />;
 *   }
 *
 *   return <FullView width={width} showExtras={breakpoint === 'wide'} />;
 * }
 * ```
 *
 * @example With custom options
 * ```tsx
 * function CustomComponent() {
 *   const { width, height, breakpoint } = useStdoutDimensions({
 *     fallbackWidth: 100,
 *     fallbackHeight: 30,
 *     narrowThreshold: 80,
 *     wideThreshold: 140
 *   });
 *
 *   // Component implementation...
 * }
 * ```
 */
export function useStdoutDimensions(
  options: UseStdoutDimensionsOptions = {}
): StdoutDimensions {
  const {
    fallbackWidth = 80,
    fallbackHeight = 24,
    narrowThreshold = 60,
    wideThreshold = 120,
  } = options;

  // Get dimensions from ink-use-stdout-dimensions
  // This hook handles resize events automatically
  const [width, height] = useStdoutDimensionsBase();

  // Determine if actual dimensions are available
  const isAvailable = width !== undefined && height !== undefined;

  // Use fallbacks if dimensions are not available
  const finalWidth = isAvailable ? width : fallbackWidth;
  const finalHeight = isAvailable ? height : fallbackHeight;

  // Calculate breakpoint based on width (memoized to avoid recalculation)
  const breakpoint = useMemo(
    () => getBreakpoint(finalWidth, narrowThreshold, wideThreshold),
    [finalWidth, narrowThreshold, wideThreshold]
  );

  return {
    width: finalWidth,
    height: finalHeight,
    breakpoint,
    isAvailable,
  };
}

// Re-export types for external use
export type { StdoutDimensions, UseStdoutDimensionsOptions };