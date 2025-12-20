/**
 * Coverage analysis tests for useStdoutDimensions hook
 *
 * These tests specifically target edge cases and code paths
 * to ensure comprehensive test coverage.
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStdoutDimensions, type UseStdoutDimensionsOptions } from '../useStdoutDimensions.js';

// Mock ink-use-stdout-dimensions
vi.mock('ink-use-stdout-dimensions', () => {
  const mockHook = vi.fn();
  return {
    default: mockHook,
  };
});

import useStdoutDimensionsBase from 'ink-use-stdout-dimensions';

describe('useStdoutDimensions - Coverage Tests', () => {
  const mockBaseHook = vi.mocked(useStdoutDimensionsBase);

  beforeEach(() => {
    mockBaseHook.mockClear();
    mockBaseHook.mockReturnValue([80, 24]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('function coverage', () => {
    it('should cover getBreakpoint function with all branches', () => {
      // Test all three branches of getBreakpoint function

      // Branch 1: width < narrowThreshold (return 'narrow')
      mockBaseHook.mockReturnValue([30, 24]);
      const { result: narrowResult } = renderHook(() => useStdoutDimensions());
      expect(narrowResult.current.breakpoint).toBe('narrow');

      // Branch 2: width >= wideThreshold (return 'wide')
      mockBaseHook.mockReturnValue([150, 24]);
      const { result: wideResult } = renderHook(() => useStdoutDimensions());
      expect(wideResult.current.breakpoint).toBe('wide');

      // Branch 3: narrowThreshold <= width < wideThreshold (return 'normal')
      mockBaseHook.mockReturnValue([80, 24]);
      const { result: normalResult } = renderHook(() => useStdoutDimensions());
      expect(normalResult.current.breakpoint).toBe('normal');
    });

    it('should cover all option destructuring paths', () => {
      // Test with no options
      const { result: noOptions } = renderHook(() => useStdoutDimensions());
      expect(noOptions.current).toBeTruthy();

      // Test with empty options
      const { result: emptyOptions } = renderHook(() => useStdoutDimensions({}));
      expect(emptyOptions.current).toBeTruthy();

      // Test with all options
      const { result: fullOptions } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 100,
        fallbackHeight: 30,
        narrowThreshold: 70,
        wideThreshold: 140
      }));
      expect(fullOptions.current).toBeTruthy();
    });

    it('should cover isAvailable calculation logic', () => {
      // Both width and height defined -> isAvailable = true
      mockBaseHook.mockReturnValue([80, 24]);
      const { result: available } = renderHook(() => useStdoutDimensions());
      expect(available.current.isAvailable).toBe(true);

      // Width undefined -> isAvailable = false
      mockBaseHook.mockReturnValue([undefined as any, 24]);
      const { result: widthUndefined } = renderHook(() => useStdoutDimensions());
      expect(widthUndefined.current.isAvailable).toBe(false);

      // Height undefined -> isAvailable = false
      mockBaseHook.mockReturnValue([80, undefined as any]);
      const { result: heightUndefined } = renderHook(() => useStdoutDimensions());
      expect(heightUndefined.current.isAvailable).toBe(false);

      // Both undefined -> isAvailable = false
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);
      const { result: bothUndefined } = renderHook(() => useStdoutDimensions());
      expect(bothUndefined.current.isAvailable).toBe(false);
    });

    it('should cover fallback value assignment', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      // Test default fallbacks
      const { result: defaultFallbacks } = renderHook(() => useStdoutDimensions());
      expect(defaultFallbacks.current.width).toBe(80);
      expect(defaultFallbacks.current.height).toBe(24);

      // Test custom fallbacks
      const { result: customFallbacks } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 120,
        fallbackHeight: 35
      }));
      expect(customFallbacks.current.width).toBe(120);
      expect(customFallbacks.current.height).toBe(35);
    });
  });

  describe('statement coverage', () => {
    it('should execute all variable declarations', () => {
      const { result } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 100,
        fallbackHeight: 30,
        narrowThreshold: 70,
        wideThreshold: 130
      }));

      // Verify all destructured variables are used
      expect(typeof result.current.width).toBe('number');
      expect(typeof result.current.height).toBe('number');
      expect(['narrow', 'normal', 'wide']).toContain(result.current.breakpoint);
      expect(typeof result.current.isAvailable).toBe('boolean');
    });

    it('should execute all conditional branches', () => {
      // Test available dimensions path
      mockBaseHook.mockReturnValue([100, 30]);
      const { result: available } = renderHook(() => useStdoutDimensions());
      expect(available.current.width).toBe(100);
      expect(available.current.height).toBe(30);

      // Test unavailable dimensions path
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);
      const { result: unavailable } = renderHook(() => useStdoutDimensions());
      expect(unavailable.current.width).toBe(80); // fallback
      expect(unavailable.current.height).toBe(24); // fallback
    });

    it('should execute useMemo dependency array', () => {
      const { result, rerender } = renderHook(
        (props: UseStdoutDimensionsOptions) => useStdoutDimensions(props),
        { initialProps: { narrowThreshold: 60, wideThreshold: 120 } }
      );

      mockBaseHook.mockReturnValue([80, 24]);

      // Initial render
      expect(result.current.breakpoint).toBe('normal');

      // Change width (should trigger recalculation)
      mockBaseHook.mockReturnValue([50, 24]);
      rerender({ narrowThreshold: 60, wideThreshold: 120 });
      expect(result.current.breakpoint).toBe('narrow');

      // Change thresholds (should trigger recalculation)
      mockBaseHook.mockReturnValue([80, 24]);
      rerender({ narrowThreshold: 90, wideThreshold: 120 });
      expect(result.current.breakpoint).toBe('narrow');
    });

    it('should execute return statement', () => {
      const { result } = renderHook(() => useStdoutDimensions());

      // Verify return object structure
      expect(result.current).toHaveProperty('width');
      expect(result.current).toHaveProperty('height');
      expect(result.current).toHaveProperty('breakpoint');
      expect(result.current).toHaveProperty('isAvailable');
    });
  });

  describe('branch coverage', () => {
    it('should cover ternary operator branches in finalWidth/finalHeight', () => {
      // isAvailable true branch
      mockBaseHook.mockReturnValue([100, 30]);
      const { result: trueBranch } = renderHook(() => useStdoutDimensions());
      expect(trueBranch.current.width).toBe(100); // actual width
      expect(trueBranch.current.height).toBe(30); // actual height

      // isAvailable false branch
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);
      const { result: falseBranch } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 120,
        fallbackHeight: 35
      }));
      expect(falseBranch.current.width).toBe(120); // fallback width
      expect(falseBranch.current.height).toBe(35); // fallback height
    });

    it('should cover getBreakpoint conditional branches', () => {
      const options = { narrowThreshold: 60, wideThreshold: 120 };

      // Test width < narrowThreshold branch
      mockBaseHook.mockReturnValue([50, 24]);
      const { result: lessThanNarrow } = renderHook(() => useStdoutDimensions(options));
      expect(lessThanNarrow.current.breakpoint).toBe('narrow');

      // Test width >= wideThreshold branch
      mockBaseHook.mockReturnValue([120, 24]);
      const { result: greaterThanWide } = renderHook(() => useStdoutDimensions(options));
      expect(greaterThanWide.current.breakpoint).toBe('wide');

      // Test middle branch (narrowThreshold <= width < wideThreshold)
      mockBaseHook.mockReturnValue([80, 24]);
      const { result: middle } = renderHook(() => useStdoutDimensions(options));
      expect(middle.current.breakpoint).toBe('normal');
    });
  });

  describe('line coverage edge cases', () => {
    it('should cover type annotations and imports', () => {
      // Test that TypeScript interfaces are properly used
      const options: UseStdoutDimensionsOptions = {
        fallbackWidth: 100,
        fallbackHeight: 30,
        narrowThreshold: 70,
        wideThreshold: 140
      };

      const { result } = renderHook(() => useStdoutDimensions(options));

      // Verify types are correctly inferred
      const dimensions: {
        width: number;
        height: number;
        breakpoint: 'narrow' | 'normal' | 'wide';
        isAvailable: boolean;
      } = result.current;

      expect(typeof dimensions.width).toBe('number');
      expect(typeof dimensions.height).toBe('number');
      expect(typeof dimensions.breakpoint).toBe('string');
      expect(typeof dimensions.isAvailable).toBe('boolean');
    });

    it('should cover default parameter values', () => {
      // Test that default parameters work when options object is undefined
      const { result } = renderHook(() => useStdoutDimensions(undefined));

      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      // Should use built-in defaults
      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);
    });

    it('should cover hook dependencies', () => {
      // Verify ink-use-stdout-dimensions is called
      renderHook(() => useStdoutDimensions());
      expect(mockBaseHook).toHaveBeenCalled();

      // Verify useMemo is utilized (indirectly through consistent behavior)
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      const initialBreakpoint = result.current.breakpoint;

      // Same dimensions should produce same breakpoint
      rerender();
      expect(result.current.breakpoint).toBe(initialBreakpoint);
    });
  });

  describe('parameter coverage', () => {
    it('should handle all possible parameter combinations', () => {
      const parameterSets = [
        undefined,
        {},
        { fallbackWidth: 90 },
        { fallbackHeight: 25 },
        { narrowThreshold: 50 },
        { wideThreshold: 100 },
        { fallbackWidth: 90, fallbackHeight: 25 },
        { narrowThreshold: 50, wideThreshold: 100 },
        { fallbackWidth: 90, narrowThreshold: 50 },
        { fallbackWidth: 90, wideThreshold: 100 },
        { fallbackHeight: 25, narrowThreshold: 50 },
        { fallbackHeight: 25, wideThreshold: 100 },
        { narrowThreshold: 50, wideThreshold: 100 },
        {
          fallbackWidth: 90,
          fallbackHeight: 25,
          narrowThreshold: 50,
          wideThreshold: 100
        }
      ];

      parameterSets.forEach((params) => {
        mockBaseHook.mockReturnValue([80, 24]);
        const { result, unmount } = renderHook(() => useStdoutDimensions(params));

        expect(typeof result.current.width).toBe('number');
        expect(typeof result.current.height).toBe('number');
        expect(['narrow', 'normal', 'wide']).toContain(result.current.breakpoint);
        expect(typeof result.current.isAvailable).toBe('boolean');

        unmount();
      });
    });
  });
});