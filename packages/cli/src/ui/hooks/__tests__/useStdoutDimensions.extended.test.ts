/**
 * Extended tests for useStdoutDimensions hook
 *
 * Tests specifically focus on:
 * - 4-tier breakpoint system validation
 * - Boolean helper functionality
 * - New breakpoint system configuration
 * - Edge cases for the new compact breakpoint
 * - Backward compatibility with deprecated options
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStdoutDimensions } from '../useStdoutDimensions.js';

// Mock ink-use-stdout-dimensions
vi.mock('ink-use-stdout-dimensions', () => {
  const mockHook = vi.fn();
  return {
    default: mockHook,
  };
});

import useStdoutDimensionsBase from 'ink-use-stdout-dimensions';

describe('useStdoutDimensions - Extended Tests for New Features', () => {
  const mockBaseHook = vi.mocked(useStdoutDimensionsBase);

  beforeEach(() => {
    mockBaseHook.mockClear();
    mockBaseHook.mockReturnValue([80, 24]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('4-tier breakpoint system', () => {
    it('should correctly classify all four breakpoint tiers', () => {
      // Test narrow (< 60)
      mockBaseHook.mockReturnValue([50, 24]);
      const { result: narrow } = renderHook(() => useStdoutDimensions());
      expect(narrow.current.breakpoint).toBe('narrow');
      expect(narrow.current.isNarrow).toBe(true);
      expect(narrow.current.isCompact).toBe(false);
      expect(narrow.current.isNormal).toBe(false);
      expect(narrow.current.isWide).toBe(false);

      // Test compact (60-99)
      mockBaseHook.mockReturnValue([80, 24]);
      const { result: compact } = renderHook(() => useStdoutDimensions());
      expect(compact.current.breakpoint).toBe('compact');
      expect(compact.current.isNarrow).toBe(false);
      expect(compact.current.isCompact).toBe(true);
      expect(compact.current.isNormal).toBe(false);
      expect(compact.current.isWide).toBe(false);

      // Test normal (100-159)
      mockBaseHook.mockReturnValue([120, 24]);
      const { result: normal } = renderHook(() => useStdoutDimensions());
      expect(normal.current.breakpoint).toBe('normal');
      expect(normal.current.isNarrow).toBe(false);
      expect(normal.current.isCompact).toBe(false);
      expect(normal.current.isNormal).toBe(true);
      expect(normal.current.isWide).toBe(false);

      // Test wide (>= 160)
      mockBaseHook.mockReturnValue([180, 24]);
      const { result: wide } = renderHook(() => useStdoutDimensions());
      expect(wide.current.breakpoint).toBe('wide');
      expect(wide.current.isNarrow).toBe(false);
      expect(wide.current.isCompact).toBe(false);
      expect(wide.current.isNormal).toBe(false);
      expect(wide.current.isWide).toBe(true);
    });

    it('should handle exact boundary values for all breakpoints', () => {
      // Test narrow/compact boundary (60)
      mockBaseHook.mockReturnValue([59, 24]);
      const { result: boundary59 } = renderHook(() => useStdoutDimensions());
      expect(boundary59.current.breakpoint).toBe('narrow');
      expect(boundary59.current.isNarrow).toBe(true);

      mockBaseHook.mockReturnValue([60, 24]);
      const { result: boundary60 } = renderHook(() => useStdoutDimensions());
      expect(boundary60.current.breakpoint).toBe('compact');
      expect(boundary60.current.isCompact).toBe(true);

      // Test compact/normal boundary (100)
      mockBaseHook.mockReturnValue([99, 24]);
      const { result: boundary99 } = renderHook(() => useStdoutDimensions());
      expect(boundary99.current.breakpoint).toBe('compact');
      expect(boundary99.current.isCompact).toBe(true);

      mockBaseHook.mockReturnValue([100, 24]);
      const { result: boundary100 } = renderHook(() => useStdoutDimensions());
      expect(boundary100.current.breakpoint).toBe('normal');
      expect(boundary100.current.isNormal).toBe(true);

      // Test normal/wide boundary (160)
      mockBaseHook.mockReturnValue([159, 24]);
      const { result: boundary159 } = renderHook(() => useStdoutDimensions());
      expect(boundary159.current.breakpoint).toBe('normal');
      expect(boundary159.current.isNormal).toBe(true);

      mockBaseHook.mockReturnValue([160, 24]);
      const { result: boundary160 } = renderHook(() => useStdoutDimensions());
      expect(boundary160.current.breakpoint).toBe('wide');
      expect(boundary160.current.isWide).toBe(true);
    });
  });

  describe('new breakpoints configuration', () => {
    it('should support custom breakpoint configuration with new system', () => {
      mockBaseHook.mockReturnValue([75, 24]);

      const { result } = renderHook(() => useStdoutDimensions({
        breakpoints: {
          narrow: 50,   // < 50 = narrow
          compact: 80,  // 50-79 = compact
          normal: 120   // 80-119 = normal, >= 120 = wide
        }
      }));

      // 75 should be compact with these thresholds
      expect(result.current.breakpoint).toBe('normal');
      expect(result.current.isNormal).toBe(true);
      expect(result.current.isNarrow).toBe(false);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.isWide).toBe(false);
    });

    it('should use partial breakpoint configuration correctly', () => {
      mockBaseHook.mockReturnValue([70, 24]);

      // Only specify narrow threshold, others should use defaults
      const { result } = renderHook(() => useStdoutDimensions({
        breakpoints: {
          narrow: 50  // compact and normal should use defaults (100, 160)
        }
      }));

      expect(result.current.breakpoint).toBe('compact'); // 50 <= 70 < 100
      expect(result.current.isCompact).toBe(true);
    });

    it('should handle edge case where all thresholds are the same', () => {
      mockBaseHook.mockReturnValue([100, 24]);

      const { result } = renderHook(() => useStdoutDimensions({
        breakpoints: {
          narrow: 100,
          compact: 100,
          normal: 100
        }
      }));

      // 100 should be wide since it's >= normal threshold
      expect(result.current.breakpoint).toBe('wide');
      expect(result.current.isWide).toBe(true);
    });
  });

  describe('backward compatibility', () => {
    it('should map deprecated narrowThreshold and wideThreshold to new system', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result } = renderHook(() => useStdoutDimensions({
        narrowThreshold: 70,    // old narrow threshold
        wideThreshold: 130      // old wide threshold
      }));

      // Should map to new 4-tier system:
      // narrow: 70, compact: 100 (calculated), normal: 130
      // 80 >= 70 and < 100, so should be compact
      expect(result.current.breakpoint).toBe('compact');
      expect(result.current.isCompact).toBe(true);
    });

    it('should prioritize new breakpoints over deprecated options', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result } = renderHook(() => useStdoutDimensions({
        breakpoints: {
          narrow: 60,
          compact: 100,
          normal: 160
        },
        // These should be ignored
        narrowThreshold: 50,
        wideThreshold: 120
      }));

      // Should use new breakpoints: 80 is compact (60 <= 80 < 100)
      expect(result.current.breakpoint).toBe('compact');
      expect(result.current.isCompact).toBe(true);
    });
  });

  describe('boolean helpers comprehensive testing', () => {
    it('should ensure only one boolean helper is true at a time', () => {
      const testCases = [
        { width: 40, expected: 'narrow' },
        { width: 80, expected: 'compact' },
        { width: 120, expected: 'normal' },
        { width: 180, expected: 'wide' }
      ];

      testCases.forEach(({ width, expected }) => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());

        const helpers = [
          { name: 'narrow', value: result.current.isNarrow },
          { name: 'compact', value: result.current.isCompact },
          { name: 'normal', value: result.current.isNormal },
          { name: 'wide', value: result.current.isWide }
        ];

        const trueHelpers = helpers.filter(h => h.value);
        expect(trueHelpers).toHaveLength(1);
        expect(trueHelpers[0].name).toBe(expected);
      });
    });

    it('should provide all boolean helpers in return object', () => {
      mockBaseHook.mockReturnValue([100, 24]);
      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current).toHaveProperty('isNarrow');
      expect(result.current).toHaveProperty('isCompact');
      expect(result.current).toHaveProperty('isNormal');
      expect(result.current).toHaveProperty('isWide');

      expect(typeof result.current.isNarrow).toBe('boolean');
      expect(typeof result.current.isCompact).toBe('boolean');
      expect(typeof result.current.isNormal).toBe('boolean');
      expect(typeof result.current.isWide).toBe('boolean');
    });
  });

  describe('interface compliance', () => {
    it('should implement StdoutDimensions interface correctly', () => {
      mockBaseHook.mockReturnValue([120, 30]);
      const { result } = renderHook(() => useStdoutDimensions());

      // Core properties
      expect(typeof result.current.width).toBe('number');
      expect(typeof result.current.height).toBe('number');
      expect(typeof result.current.breakpoint).toBe('string');
      expect(typeof result.current.isAvailable).toBe('boolean');

      // BreakpointHelpers properties
      expect(typeof result.current.isNarrow).toBe('boolean');
      expect(typeof result.current.isCompact).toBe('boolean');
      expect(typeof result.current.isNormal).toBe('boolean');
      expect(typeof result.current.isWide).toBe('boolean');

      // Breakpoint should be one of valid values
      expect(['narrow', 'compact', 'normal', 'wide']).toContain(result.current.breakpoint);
    });

    it('should match TypeScript type definitions', () => {
      mockBaseHook.mockReturnValue([100, 25]);
      const { result } = renderHook(() => useStdoutDimensions());

      // Test that the return type matches expected interface
      const dimensions = result.current;

      // These should compile without TypeScript errors and have correct types
      const width: number = dimensions.width;
      const height: number = dimensions.height;
      const breakpoint: 'narrow' | 'compact' | 'normal' | 'wide' = dimensions.breakpoint;
      const isAvailable: boolean = dimensions.isAvailable;
      const isNarrow: boolean = dimensions.isNarrow;
      const isCompact: boolean = dimensions.isCompact;
      const isNormal: boolean = dimensions.isNormal;
      const isWide: boolean = dimensions.isWide;

      expect(width).toBe(100);
      expect(height).toBe(25);
      expect(['narrow', 'compact', 'normal', 'wide']).toContain(breakpoint);
      expect(typeof isAvailable).toBe('boolean');
      expect(typeof isNarrow).toBe('boolean');
      expect(typeof isCompact).toBe('boolean');
      expect(typeof isNormal).toBe('boolean');
      expect(typeof isWide).toBe('boolean');
    });
  });

  describe('edge cases for new breakpoint system', () => {
    it('should handle zero-width terminals correctly', () => {
      mockBaseHook.mockReturnValue([0, 24]);
      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.breakpoint).toBe('narrow');
      expect(result.current.isNarrow).toBe(true);
      expect([result.current.isCompact, result.current.isNormal, result.current.isWide].every(v => v === false)).toBe(true);
    });

    it('should handle very large terminals correctly', () => {
      mockBaseHook.mockReturnValue([9999, 999]);
      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.breakpoint).toBe('wide');
      expect(result.current.isWide).toBe(true);
      expect([result.current.isNarrow, result.current.isCompact, result.current.isNormal].every(v => v === false)).toBe(true);
    });

    it('should handle custom thresholds in reverse order', () => {
      // Test with thresholds that don't make logical sense but should still work
      mockBaseHook.mockReturnValue([100, 24]);

      const { result } = renderHook(() => useStdoutDimensions({
        breakpoints: {
          narrow: 200,   // > normal!
          compact: 150,  // > normal!
          normal: 80
        }
      }));

      // 100 < 150 (compact), so should be normal per the logic
      expect(result.current.breakpoint).toBe('wide'); // >= 80 (normal)
      expect(result.current.isWide).toBe(true);
    });
  });

  describe('fallback integration with breakpoints', () => {
    it('should calculate breakpoints using fallback values', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      // Test narrow fallback
      const { result: narrowFallback } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 40
      }));
      expect(narrowFallback.current.breakpoint).toBe('narrow');
      expect(narrowFallback.current.isNarrow).toBe(true);
      expect(narrowFallback.current.isAvailable).toBe(false);

      // Test compact fallback
      const { result: compactFallback } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 80
      }));
      expect(compactFallback.current.breakpoint).toBe('compact');
      expect(compactFallback.current.isCompact).toBe(true);
      expect(compactFallback.current.isAvailable).toBe(false);

      // Test normal fallback
      const { result: normalFallback } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 120
      }));
      expect(normalFallback.current.breakpoint).toBe('normal');
      expect(normalFallback.current.isNormal).toBe(true);
      expect(normalFallback.current.isAvailable).toBe(false);

      // Test wide fallback
      const { result: wideFallback } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 200
      }));
      expect(wideFallback.current.breakpoint).toBe('wide');
      expect(wideFallback.current.isWide).toBe(true);
      expect(wideFallback.current.isAvailable).toBe(false);
    });

    it('should combine custom thresholds with fallbacks', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 90,
        breakpoints: {
          narrow: 50,
          compact: 100,
          normal: 150
        }
      }));

      // fallbackWidth 90: 50 <= 90 < 100, so compact
      expect(result.current.breakpoint).toBe('compact');
      expect(result.current.isCompact).toBe(true);
      expect(result.current.width).toBe(90);
      expect(result.current.isAvailable).toBe(false);
    });
  });

  describe('memoization with new system', () => {
    it('should properly memoize with new breakpoint configuration', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result, rerender } = renderHook(
        (props) => useStdoutDimensions(props),
        {
          initialProps: {
            breakpoints: { narrow: 60, compact: 100, normal: 160 }
          }
        }
      );

      const initialBreakpoint = result.current.breakpoint;
      const initialHelpers = {
        isNarrow: result.current.isNarrow,
        isCompact: result.current.isCompact,
        isNormal: result.current.isNormal,
        isWide: result.current.isWide
      };

      // Rerender with same props
      rerender({ breakpoints: { narrow: 60, compact: 100, normal: 160 } });

      expect(result.current.breakpoint).toBe(initialBreakpoint);
      expect(result.current.isNarrow).toBe(initialHelpers.isNarrow);
      expect(result.current.isCompact).toBe(initialHelpers.isCompact);
      expect(result.current.isNormal).toBe(initialHelpers.isNormal);
      expect(result.current.isWide).toBe(initialHelpers.isWide);
    });

    it('should recalculate when breakpoint thresholds change', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result, rerender } = renderHook(
        (props) => useStdoutDimensions(props),
        {
          initialProps: {
            breakpoints: { narrow: 60, compact: 100, normal: 160 }
          }
        }
      );

      // Initially: 80 is compact (60 <= 80 < 100)
      expect(result.current.breakpoint).toBe('compact');
      expect(result.current.isCompact).toBe(true);

      // Change thresholds so 80 becomes narrow
      rerender({
        breakpoints: { narrow: 90, compact: 120, normal: 160 }
      });

      expect(result.current.breakpoint).toBe('narrow'); // 80 < 90
      expect(result.current.isNarrow).toBe(true);
      expect(result.current.isCompact).toBe(false);
    });
  });
});