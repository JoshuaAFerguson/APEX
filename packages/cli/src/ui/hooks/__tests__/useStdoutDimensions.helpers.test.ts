/**
 * Boolean helpers tests for useStdoutDimensions hook
 *
 * Tests specifically focus on the boolean helper properties:
 * - isNarrow, isCompact, isNormal, isWide
 * - Mutual exclusivity of boolean helpers
 * - Consistency with breakpoint string
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

describe('useStdoutDimensions - Boolean Helpers', () => {
  const mockBaseHook = vi.mocked(useStdoutDimensionsBase);

  beforeEach(() => {
    mockBaseHook.mockClear();
    mockBaseHook.mockReturnValue([80, 24]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isNarrow helper', () => {
    it('should be true only for narrow breakpoints', () => {
      // Test values that should be narrow (< 60)
      const narrowWidths = [0, 1, 30, 45, 59];

      narrowWidths.forEach(width => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.isNarrow).toBe(true);
        expect(result.current.isCompact).toBe(false);
        expect(result.current.isNormal).toBe(false);
        expect(result.current.isWide).toBe(false);
        expect(result.current.breakpoint).toBe('narrow');
      });
    });

    it('should be false for non-narrow breakpoints', () => {
      // Test values that should not be narrow (>= 60)
      const nonNarrowWidths = [60, 61, 99, 100, 159, 160, 200];

      nonNarrowWidths.forEach(width => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.isNarrow).toBe(false);
        expect(result.current.breakpoint).not.toBe('narrow');
      });
    });

    it('should work with custom narrow threshold', () => {
      mockBaseHook.mockReturnValue([70, 24]);

      // Default threshold: 70 should be compact
      const { result: defaultResult } = renderHook(() => useStdoutDimensions());
      expect(defaultResult.current.isNarrow).toBe(false);
      expect(defaultResult.current.isCompact).toBe(true);

      // Custom threshold: narrow < 80, so 70 should be narrow
      const { result: customResult } = renderHook(() => useStdoutDimensions({
        breakpoints: { narrow: 80, compact: 120, normal: 160 }
      }));
      expect(customResult.current.isNarrow).toBe(true);
      expect(customResult.current.isCompact).toBe(false);
    });
  });

  describe('isCompact helper', () => {
    it('should be true only for compact breakpoints', () => {
      // Test values that should be compact (60 <= x < 100)
      const compactWidths = [60, 61, 75, 80, 90, 99];

      compactWidths.forEach(width => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.isNarrow).toBe(false);
        expect(result.current.isCompact).toBe(true);
        expect(result.current.isNormal).toBe(false);
        expect(result.current.isWide).toBe(false);
        expect(result.current.breakpoint).toBe('compact');
      });
    });

    it('should be false for non-compact breakpoints', () => {
      // Test boundary values
      mockBaseHook.mockReturnValue([59, 24]); // narrow
      const { result: narrowResult } = renderHook(() => useStdoutDimensions());
      expect(narrowResult.current.isCompact).toBe(false);

      mockBaseHook.mockReturnValue([100, 24]); // normal
      const { result: normalResult } = renderHook(() => useStdoutDimensions());
      expect(normalResult.current.isCompact).toBe(false);

      mockBaseHook.mockReturnValue([160, 24]); // wide
      const { result: wideResult } = renderHook(() => useStdoutDimensions());
      expect(wideResult.current.isCompact).toBe(false);
    });

    it('should work with custom compact threshold', () => {
      mockBaseHook.mockReturnValue([90, 24]);

      // Custom thresholds: narrow < 50, compact < 120, so 90 should be compact
      const { result } = renderHook(() => useStdoutDimensions({
        breakpoints: { narrow: 50, compact: 120, normal: 160 }
      }));

      expect(result.current.isNarrow).toBe(false);
      expect(result.current.isCompact).toBe(true);
      expect(result.current.isNormal).toBe(false);
      expect(result.current.isWide).toBe(false);
    });
  });

  describe('isNormal helper', () => {
    it('should be true only for normal breakpoints', () => {
      // Test values that should be normal (100 <= x < 160)
      const normalWidths = [100, 101, 120, 140, 159];

      normalWidths.forEach(width => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.isNarrow).toBe(false);
        expect(result.current.isCompact).toBe(false);
        expect(result.current.isNormal).toBe(true);
        expect(result.current.isWide).toBe(false);
        expect(result.current.breakpoint).toBe('normal');
      });
    });

    it('should be false for non-normal breakpoints', () => {
      // Test boundary values
      mockBaseHook.mockReturnValue([99, 24]); // compact
      const { result: compactResult } = renderHook(() => useStdoutDimensions());
      expect(compactResult.current.isNormal).toBe(false);

      mockBaseHook.mockReturnValue([160, 24]); // wide
      const { result: wideResult } = renderHook(() => useStdoutDimensions());
      expect(wideResult.current.isNormal).toBe(false);
    });

    it('should work with custom normal threshold', () => {
      mockBaseHook.mockReturnValue([130, 24]);

      // Custom thresholds: normal < 140, so 130 should be normal
      const { result } = renderHook(() => useStdoutDimensions({
        breakpoints: { narrow: 60, compact: 100, normal: 140 }
      }));

      expect(result.current.isNormal).toBe(true);
      expect(result.current.isWide).toBe(false);
    });
  });

  describe('isWide helper', () => {
    it('should be true only for wide breakpoints', () => {
      // Test values that should be wide (>= 160)
      const wideWidths = [160, 161, 200, 500, 1920];

      wideWidths.forEach(width => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.isNarrow).toBe(false);
        expect(result.current.isCompact).toBe(false);
        expect(result.current.isNormal).toBe(false);
        expect(result.current.isWide).toBe(true);
        expect(result.current.breakpoint).toBe('wide');
      });
    });

    it('should be false for non-wide breakpoints', () => {
      // Test boundary values
      mockBaseHook.mockReturnValue([159, 24]); // normal
      const { result: normalResult } = renderHook(() => useStdoutDimensions());
      expect(normalResult.current.isWide).toBe(false);
    });

    it('should work with custom wide threshold', () => {
      mockBaseHook.mockReturnValue([180, 24]);

      // Custom thresholds: normal < 200, so 180 should be normal, not wide
      const { result } = renderHook(() => useStdoutDimensions({
        breakpoints: { narrow: 60, compact: 100, normal: 200 }
      }));

      expect(result.current.isNormal).toBe(true);
      expect(result.current.isWide).toBe(false);
    });
  });

  describe('mutual exclusivity', () => {
    it('should ensure only one boolean helper is true at any time', () => {
      const testWidths = [
        10, 30, 59,     // narrow
        60, 80, 99,     // compact
        100, 120, 159,  // normal
        160, 200, 500   // wide
      ];

      testWidths.forEach(width => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());

        const helpers = [
          result.current.isNarrow,
          result.current.isCompact,
          result.current.isNormal,
          result.current.isWide
        ];

        const trueCount = helpers.filter(Boolean).length;
        expect(trueCount).toBe(1);
      });
    });

    it('should ensure boolean helpers match breakpoint string', () => {
      const testCases = [
        { width: 40, expectedBreakpoint: 'narrow', expectedHelper: 'isNarrow' },
        { width: 80, expectedBreakpoint: 'compact', expectedHelper: 'isCompact' },
        { width: 120, expectedBreakpoint: 'normal', expectedHelper: 'isNormal' },
        { width: 180, expectedBreakpoint: 'wide', expectedHelper: 'isWide' }
      ];

      testCases.forEach(({ width, expectedBreakpoint, expectedHelper }) => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.breakpoint).toBe(expectedBreakpoint);
        expect(result.current[expectedHelper as keyof typeof result.current]).toBe(true);

        // All other helpers should be false
        const allHelpers = ['isNarrow', 'isCompact', 'isNormal', 'isWide'];
        allHelpers.filter(h => h !== expectedHelper).forEach(helperName => {
          expect(result.current[helperName as keyof typeof result.current]).toBe(false);
        });
      });
    });
  });

  describe('consistency with fallback values', () => {
    it('should calculate helpers correctly with fallback values', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      // Test each breakpoint tier with fallbacks
      const fallbackCases = [
        { fallbackWidth: 40, expectedHelper: 'isNarrow' },
        { fallbackWidth: 80, expectedHelper: 'isCompact' },
        { fallbackWidth: 120, expectedHelper: 'isNormal' },
        { fallbackWidth: 200, expectedHelper: 'isWide' }
      ];

      fallbackCases.forEach(({ fallbackWidth, expectedHelper }) => {
        const { result } = renderHook(() => useStdoutDimensions({
          fallbackWidth
        }));

        expect(result.current[expectedHelper as keyof typeof result.current]).toBe(true);
        expect(result.current.isAvailable).toBe(false);

        // Ensure only the expected helper is true
        const allHelpers = ['isNarrow', 'isCompact', 'isNormal', 'isWide'];
        allHelpers.filter(h => h !== expectedHelper).forEach(helperName => {
          expect(result.current[helperName as keyof typeof result.current]).toBe(false);
        });
      });
    });
  });

  describe('dynamic updates', () => {
    it('should update boolean helpers when dimensions change', () => {
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      // Start with narrow
      mockBaseHook.mockReturnValue([40, 24]);
      rerender();
      expect(result.current.isNarrow).toBe(true);
      expect(result.current.breakpoint).toBe('narrow');

      // Change to compact
      mockBaseHook.mockReturnValue([80, 24]);
      rerender();
      expect(result.current.isNarrow).toBe(false);
      expect(result.current.isCompact).toBe(true);
      expect(result.current.breakpoint).toBe('compact');

      // Change to normal
      mockBaseHook.mockReturnValue([120, 24]);
      rerender();
      expect(result.current.isCompact).toBe(false);
      expect(result.current.isNormal).toBe(true);
      expect(result.current.breakpoint).toBe('normal');

      // Change to wide
      mockBaseHook.mockReturnValue([180, 24]);
      rerender();
      expect(result.current.isNormal).toBe(false);
      expect(result.current.isWide).toBe(true);
      expect(result.current.breakpoint).toBe('wide');
    });

    it('should update helpers when custom thresholds change', () => {
      mockBaseHook.mockReturnValue([90, 24]);

      const { result, rerender } = renderHook(
        (props) => useStdoutDimensions(props),
        {
          initialProps: {
            breakpoints: { narrow: 60, compact: 100, normal: 160 }
          }
        }
      );

      // Initially: 90 should be compact (60 <= 90 < 100)
      expect(result.current.isCompact).toBe(true);
      expect(result.current.breakpoint).toBe('compact');

      // Change thresholds so 90 becomes narrow
      rerender({
        breakpoints: { narrow: 100, compact: 140, normal: 180 }
      });

      expect(result.current.isCompact).toBe(false);
      expect(result.current.isNarrow).toBe(true);
      expect(result.current.breakpoint).toBe('narrow');
    });
  });

  describe('edge cases', () => {
    it('should handle zero width correctly', () => {
      mockBaseHook.mockReturnValue([0, 24]);
      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.isNarrow).toBe(true);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.isNormal).toBe(false);
      expect(result.current.isWide).toBe(false);
    });

    it('should handle negative width correctly', () => {
      mockBaseHook.mockReturnValue([-10, 24]);
      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.isNarrow).toBe(true);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.isNormal).toBe(false);
      expect(result.current.isWide).toBe(false);
    });

    it('should handle extremely large width correctly', () => {
      mockBaseHook.mockReturnValue([Number.MAX_SAFE_INTEGER, 24]);
      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.isNarrow).toBe(false);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.isNormal).toBe(false);
      expect(result.current.isWide).toBe(true);
    });

    it('should handle equal threshold values', () => {
      mockBaseHook.mockReturnValue([100, 24]);

      // All thresholds equal - should result in wide classification
      const { result } = renderHook(() => useStdoutDimensions({
        breakpoints: { narrow: 100, compact: 100, normal: 100 }
      }));

      expect(result.current.isWide).toBe(true);
      expect(result.current.isNarrow).toBe(false);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.isNormal).toBe(false);
    });
  });
});