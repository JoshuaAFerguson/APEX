/**
 * Functional tests for useStdoutDimensions hook
 *
 * Tests the hook functionality in realistic scenarios to ensure
 * it meets the practical requirements for terminal UI adaptation.
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

describe('useStdoutDimensions - Functional Tests', () => {
  const mockBaseHook = vi.mocked(useStdoutDimensionsBase);

  beforeEach(() => {
    mockBaseHook.mockClear();
    mockBaseHook.mockReturnValue([80, 24]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('real-world terminal sizes', () => {
    it('should handle common terminal sizes correctly', () => {
      const commonSizes = [
        // Mobile terminals (narrow)
        { width: 40, height: 20, expectedBreakpoint: 'narrow', expectedIsNarrow: true },
        { width: 50, height: 15, expectedBreakpoint: 'narrow', expectedIsNarrow: true },

        // Small terminals (compact)
        { width: 80, height: 24, expectedBreakpoint: 'compact', expectedIsCompact: true },
        { width: 90, height: 30, expectedBreakpoint: 'compact', expectedIsCompact: true },

        // Standard terminals (normal)
        { width: 120, height: 30, expectedBreakpoint: 'normal', expectedIsNormal: true },
        { width: 140, height: 40, expectedBreakpoint: 'normal', expectedIsNormal: true },

        // Large terminals (wide)
        { width: 180, height: 50, expectedBreakpoint: 'wide', expectedIsWide: true },
        { width: 200, height: 60, expectedBreakpoint: 'wide', expectedIsWide: true },
      ];

      commonSizes.forEach(({ width, height, expectedBreakpoint, ...expectedHelpers }) => {
        mockBaseHook.mockReturnValue([width, height]);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.width).toBe(width);
        expect(result.current.height).toBe(height);
        expect(result.current.breakpoint).toBe(expectedBreakpoint);

        // Check that the expected boolean helper is true
        Object.entries(expectedHelpers).forEach(([helper, expected]) => {
          expect(result.current[helper as keyof typeof result.current]).toBe(expected);
        });
      });
    });

    it('should provide consistent breakpoint classification for responsive layouts', () => {
      // Test that layouts can reliably use the breakpoints for responsive design
      const layouts = {
        narrow: { maxColumns: 59, showSidebar: false, showDetails: false },
        compact: { maxColumns: 99, showSidebar: false, showDetails: true },
        normal: { maxColumns: 159, showSidebar: true, showDetails: true },
        wide: { maxColumns: Infinity, showSidebar: true, showDetails: true },
      };

      Object.entries(layouts).forEach(([breakpointName, config]) => {
        const testWidth = config.maxColumns === Infinity ? 200 : config.maxColumns;

        mockBaseHook.mockReturnValue([testWidth, 30]);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.breakpoint).toBe(breakpointName);

        // Verify the appropriate boolean helper is true
        const helperName = `is${breakpointName.charAt(0).toUpperCase()}${breakpointName.slice(1)}` as keyof typeof result.current;
        expect(result.current[helperName]).toBe(true);
      });
    });
  });

  describe('dynamic resizing scenarios', () => {
    it('should handle window resizing from narrow to wide', () => {
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      // Start narrow
      mockBaseHook.mockReturnValue([40, 20]);
      rerender();
      expect(result.current.isNarrow).toBe(true);
      expect(result.current.breakpoint).toBe('narrow');

      // Resize to compact
      mockBaseHook.mockReturnValue([80, 25]);
      rerender();
      expect(result.current.isCompact).toBe(true);
      expect(result.current.breakpoint).toBe('compact');

      // Resize to normal
      mockBaseHook.mockReturnValue([130, 35]);
      rerender();
      expect(result.current.isNormal).toBe(true);
      expect(result.current.breakpoint).toBe('normal');

      // Resize to wide
      mockBaseHook.mockReturnValue([200, 50]);
      rerender();
      expect(result.current.isWide).toBe(true);
      expect(result.current.breakpoint).toBe('wide');
    });

    it('should handle sudden size changes correctly', () => {
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      // Jump from narrow to wide
      mockBaseHook.mockReturnValue([30, 15]);
      rerender();
      expect(result.current.isNarrow).toBe(true);

      mockBaseHook.mockReturnValue([250, 80]);
      rerender();
      expect(result.current.isWide).toBe(true);

      // Jump back to compact
      mockBaseHook.mockReturnValue([85, 25]);
      rerender();
      expect(result.current.isCompact).toBe(true);
    });
  });

  describe('breakpoint utilities usage', () => {
    it('should support conditional rendering based on boolean helpers', () => {
      const testCases = [
        { width: 50, expectVisible: { mobile: true, desktop: false, full: false } },
        { width: 80, expectVisible: { mobile: false, desktop: true, full: false } },
        { width: 120, expectVisible: { mobile: false, desktop: true, full: false } },
        { width: 180, expectVisible: { mobile: false, desktop: false, full: true } },
      ];

      testCases.forEach(({ width, expectVisible }) => {
        mockBaseHook.mockReturnValue([width, 30]);
        const { result } = renderHook(() => useStdoutDimensions());

        // Simulate component logic
        const showMobileLayout = result.current.isNarrow;
        const showDesktopLayout = result.current.isCompact || result.current.isNormal;
        const showFullLayout = result.current.isWide;

        expect(showMobileLayout).toBe(expectVisible.mobile);
        expect(showDesktopLayout).toBe(expectVisible.desktop);
        expect(showFullLayout).toBe(expectVisible.full);
      });
    });

    it('should support style calculations based on breakpoints', () => {
      const testCases = [
        { width: 50, expectedPadding: 1, expectedColumns: 1 },
        { width: 80, expectedPadding: 2, expectedColumns: 2 },
        { width: 120, expectedPadding: 3, expectedColumns: 3 },
        { width: 180, expectedPadding: 4, expectedColumns: 4 },
      ];

      testCases.forEach(({ width, expectedPadding, expectedColumns }) => {
        mockBaseHook.mockReturnValue([width, 30]);
        const { result } = renderHook(() => useStdoutDimensions());

        // Simulate responsive style calculations
        const padding = result.current.isNarrow ? 1 :
                       result.current.isCompact ? 2 :
                       result.current.isNormal ? 3 : 4;

        const columns = result.current.isNarrow ? 1 :
                       result.current.isCompact ? 2 :
                       result.current.isNormal ? 3 : 4;

        expect(padding).toBe(expectedPadding);
        expect(columns).toBe(expectedColumns);
      });
    });
  });

  describe('fallback behavior', () => {
    it('should provide reasonable defaults when terminal size is unavailable', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 100,
        fallbackHeight: 30
      }));

      expect(result.current.width).toBe(100);
      expect(result.current.height).toBe(30);
      expect(result.current.isNormal).toBe(true); // 100 falls in normal range
      expect(result.current.breakpoint).toBe('normal');
      expect(result.current.isAvailable).toBe(false);
    });

    it('should work in non-terminal environments', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() => useStdoutDimensions());

      // Should use default fallbacks (80x24)
      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);
      expect(result.current.isCompact).toBe(true); // 80 falls in compact range
      expect(result.current.isAvailable).toBe(false);
    });
  });

  describe('performance in realistic usage', () => {
    it('should not cause excessive re-calculations during normal usage', () => {
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      // Simulate normal terminal usage with stable dimensions
      mockBaseHook.mockReturnValue([120, 30]);

      const initialBreakpoint = result.current.breakpoint;
      const initialHelpers = {
        isNarrow: result.current.isNarrow,
        isCompact: result.current.isCompact,
        isNormal: result.current.isNormal,
        isWide: result.current.isWide,
      };

      // Multiple component re-renders (common in React apps)
      for (let i = 0; i < 10; i++) {
        rerender();
      }

      // Values should remain consistent
      expect(result.current.breakpoint).toBe(initialBreakpoint);
      expect(result.current.isNarrow).toBe(initialHelpers.isNarrow);
      expect(result.current.isCompact).toBe(initialHelpers.isCompact);
      expect(result.current.isNormal).toBe(initialHelpers.isNormal);
      expect(result.current.isWide).toBe(initialHelpers.isWide);
    });
  });
});