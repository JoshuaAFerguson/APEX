import { useMemo } from 'react';
import useStdoutDimensionsBase from 'ink-use-stdout-dimensions';

/**
 * Breakpoint helpers interface with boolean flags
 */
export interface BreakpointHelpers {
  /** Terminal width < 60 columns */
  isNarrow: boolean;
  /** Terminal width >= 60 and < 100 columns */
  isCompact: boolean;
  /** Terminal width >= 100 and < 160 columns */
  isNormal: boolean;
  /** Terminal width >= 160 columns */
  isWide: boolean;
}

/**
 * Terminal dimensions interface
 */
export interface StdoutDimensions extends BreakpointHelpers {
  /** Terminal width in columns */
  width: number;
  /** Terminal height in rows */
  height: number;
  /** Responsive breakpoint classification */
  breakpoint: 'narrow' | 'compact' | 'normal' | 'wide';
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
  /** Custom breakpoint thresholds */
  breakpoints?: {
    /** Threshold for narrow/compact boundary (default: 60) */
    narrow?: number;
    /** Threshold for compact/normal boundary (default: 100) */
    compact?: number;
    /** Threshold for normal/wide boundary (default: 160) */
    normal?: number;
  };
  /** @deprecated Use breakpoints.narrow instead */
  narrowThreshold?: number;
  /** @deprecated Use breakpoints.normal instead */
  wideThreshold?: number;
}

/**
 * Type alias for breakpoint classification
 */
export type Breakpoint = 'narrow' | 'compact' | 'normal' | 'wide';

/**
 * Default breakpoint thresholds
 */
const DEFAULT_BREAKPOINTS = {
  narrow: 60,    // < 60 = narrow
  compact: 100,  // >= 60 and < 100 = compact
  normal: 160,   // >= 100 and < 160 = normal
  // >= 160 = wide
} as const;

/**
 * Helper function to determine breakpoint from width
 */
function getBreakpoint(
  width: number,
  breakpoints: { narrow: number; compact: number; normal: number }
): Breakpoint {
  if (width < breakpoints.narrow) return 'narrow';
  if (width < breakpoints.compact) return 'compact';
  if (width < breakpoints.normal) return 'normal';
  return 'wide';
}

/**
 * Helper function to generate breakpoint boolean helpers
 */
function getBreakpointHelpers(
  width: number,
  breakpoints: { narrow: number; compact: number; normal: number }
): BreakpointHelpers {
  return {
    isNarrow: width < breakpoints.narrow,
    isCompact: width >= breakpoints.narrow && width < breakpoints.compact,
    isNormal: width >= breakpoints.compact && width < breakpoints.normal,
    isWide: width >= breakpoints.normal,
  };
}

/**
 * Custom hook for tracking terminal (stdout) dimensions with responsive breakpoints
 *
 * This hook provides terminal width/height detection with resize event handling
 * and responsive breakpoint classification. It wraps ink-use-stdout-dimensions
 * to provide enhanced functionality with a 4-tier breakpoint system and boolean helpers.
 *
 * @param options - Configuration options for fallbacks and breakpoint thresholds
 * @returns Terminal dimensions with breakpoint classification, boolean helpers, and availability status
 *
 * @example Basic usage with boolean helpers
 * ```tsx
 * function ResponsivePanel() {
 *   const { width, isNarrow, isCompact, isNormal, isWide } = useStdoutDimensions();
 *
 *   if (isNarrow) {
 *     return <MinimalView />;
 *   }
 *   if (isCompact) {
 *     return <CompactView width={width} />;
 *   }
 *   if (isNormal) {
 *     return <StandardView width={width} />;
 *   }
 *   return <FullView width={width} showExtras />;
 * }
 * ```
 *
 * @example Using breakpoint enum
 * ```tsx
 * function AdaptiveComponent() {
 *   const { breakpoint, width } = useStdoutDimensions();
 *
 *   switch (breakpoint) {
 *     case 'narrow': return <Narrow />;
 *     case 'compact': return <Compact />;
 *     case 'normal': return <Normal />;
 *     case 'wide': return <Wide />;
 *   }
 * }
 * ```
 *
 * @example With custom breakpoint thresholds
 * ```tsx
 * function CustomComponent() {
 *   const dims = useStdoutDimensions({
 *     breakpoints: {
 *       narrow: 50,
 *       compact: 80,
 *       normal: 140,
 *     }
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
    breakpoints: customBreakpoints,
    // Handle deprecated options for backward compatibility
    narrowThreshold,
    wideThreshold,
  } = options;

  // Resolve breakpoint thresholds (new system takes precedence)
  const breakpoints = useMemo(() => {
    if (customBreakpoints) {
      return {
        narrow: customBreakpoints.narrow ?? DEFAULT_BREAKPOINTS.narrow,
        compact: customBreakpoints.compact ?? DEFAULT_BREAKPOINTS.compact,
        normal: customBreakpoints.normal ?? DEFAULT_BREAKPOINTS.normal,
      };
    }

    // Backward compatibility: map old options to new system
    if (narrowThreshold !== undefined || wideThreshold !== undefined) {
      const narrow = narrowThreshold ?? DEFAULT_BREAKPOINTS.narrow;
      const wide = wideThreshold ?? 120; // Old default was 120
      // Map old 3-tier system to new 4-tier system
      const compact = narrow + Math.floor((wide - narrow) / 2);
      return {
        narrow,
        compact,
        normal: wide,
      };
    }

    return DEFAULT_BREAKPOINTS;
  }, [customBreakpoints, narrowThreshold, wideThreshold]);

  const [baseWidth, baseHeight] = useStdoutDimensionsBase();
  const dimensions: [number | undefined, number | undefined] = [baseWidth, baseHeight];

  const [width, height] = dimensions;

  // Determine if actual dimensions are available
  const isAvailable = width !== undefined && height !== undefined;

  // Use fallbacks if dimensions are not available
  const finalWidth = isAvailable ? width : fallbackWidth;
  const finalHeight = isAvailable ? height : fallbackHeight;

  // Calculate breakpoint and helpers (memoized to avoid recalculation)
  const breakpoint = useMemo(
    () => getBreakpoint(finalWidth, breakpoints),
    [finalWidth, breakpoints]
  );

  const breakpointHelpers = useMemo(
    () => getBreakpointHelpers(finalWidth, breakpoints),
    [finalWidth, breakpoints]
  );

  return {
    width: finalWidth,
    height: finalHeight,
    breakpoint,
    isAvailable,
    ...breakpointHelpers,
  };
}

// Types are already exported above with their definitions
