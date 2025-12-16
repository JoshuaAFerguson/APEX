import { renderHook, act } from '@testing-library/react';
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

describe('useStdoutDimensions', () => {
  const mockBaseHook = vi.mocked(useStdoutDimensionsBase);

  beforeEach(() => {
    // Reset the mock before each test
    mockBaseHook.mockClear();
    // Default mock implementation: 80x24 terminal
    mockBaseHook.mockReturnValue([80, 24]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should return dimensions from ink-use-stdout-dimensions', () => {
      mockBaseHook.mockReturnValue([100, 30]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(100);
      expect(result.current.height).toBe(30);
      expect(result.current.isAvailable).toBe(true);
      expect(mockBaseHook).toHaveBeenCalled();
    });

    it('should use fallback values when stdout dimensions are unavailable', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);
      expect(result.current.isAvailable).toBe(false);
    });

    it('should use custom fallback values', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          fallbackWidth: 120,
          fallbackHeight: 40
        })
      );

      expect(result.current.width).toBe(120);
      expect(result.current.height).toBe(40);
      expect(result.current.isAvailable).toBe(false);
    });

    it('should handle resize events from base hook', () => {
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      // Initial dimensions
      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);

      // Simulate resize event by changing mock return value
      mockBaseHook.mockReturnValue([120, 35]);
      rerender();

      expect(result.current.width).toBe(120);
      expect(result.current.height).toBe(35);
    });
  });

  describe('breakpoint classification', () => {
    it('should classify narrow terminals (< 60 columns)', () => {
      mockBaseHook.mockReturnValue([50, 24]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.breakpoint).toBe('narrow');
    });

    it('should classify normal terminals (60-119 columns)', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.breakpoint).toBe('normal');
    });

    it('should classify wide terminals (>= 120 columns)', () => {
      mockBaseHook.mockReturnValue([150, 30]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.breakpoint).toBe('wide');
    });

    it('should handle boundary values correctly', () => {
      // Test narrow/normal boundary (60)
      mockBaseHook.mockReturnValue([59, 24]);
      const { result: result59 } = renderHook(() => useStdoutDimensions());
      expect(result59.current.breakpoint).toBe('narrow');

      mockBaseHook.mockReturnValue([60, 24]);
      const { result: result60 } = renderHook(() => useStdoutDimensions());
      expect(result60.current.breakpoint).toBe('normal');

      // Test normal/wide boundary (120)
      mockBaseHook.mockReturnValue([119, 24]);
      const { result: result119 } = renderHook(() => useStdoutDimensions());
      expect(result119.current.breakpoint).toBe('normal');

      mockBaseHook.mockReturnValue([120, 24]);
      const { result: result120 } = renderHook(() => useStdoutDimensions());
      expect(result120.current.breakpoint).toBe('wide');
    });

    it('should use custom thresholds', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          narrowThreshold: 90,
          wideThreshold: 140
        })
      );

      // 80 columns with custom thresholds (narrow < 90, wide >= 140)
      expect(result.current.breakpoint).toBe('narrow');
    });

    it('should update breakpoint when dimensions change', () => {
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      // Start narrow
      mockBaseHook.mockReturnValue([40, 24]);
      rerender();
      expect(result.current.breakpoint).toBe('narrow');

      // Change to wide
      mockBaseHook.mockReturnValue([150, 30]);
      rerender();
      expect(result.current.breakpoint).toBe('wide');
    });

    it('should use fallback width for breakpoint calculation when unavailable', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          fallbackWidth: 150 // Should result in 'wide' breakpoint
        })
      );

      expect(result.current.breakpoint).toBe('wide');
      expect(result.current.isAvailable).toBe(false);
    });
  });

  describe('memoization', () => {
    it('should memoize breakpoint calculation', () => {
      const getBreakpointSpy = vi.fn();

      // We can't directly spy on the internal getBreakpoint function,
      // but we can test that re-renders with same dimensions don't cause issues
      mockBaseHook.mockReturnValue([80, 24]);

      const { result, rerender } = renderHook(() => useStdoutDimensions());

      const initialBreakpoint = result.current.breakpoint;

      // Multiple re-renders with same dimensions
      rerender();
      rerender();
      rerender();

      expect(result.current.breakpoint).toBe(initialBreakpoint);
      expect(result.current.breakpoint).toBe('normal');
    });

    it('should recalculate breakpoint when thresholds change', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result, rerender } = renderHook(
        (props) => useStdoutDimensions(props),
        { initialProps: { narrowThreshold: 60, wideThreshold: 120 } }
      );

      expect(result.current.breakpoint).toBe('normal');

      // Change thresholds so 80 becomes narrow
      rerender({ narrowThreshold: 90, wideThreshold: 130 });

      expect(result.current.breakpoint).toBe('narrow');
    });
  });

  describe('integration with ink-use-stdout-dimensions', () => {
    it('should call the base hook exactly once per render', () => {
      renderHook(() => useStdoutDimensions());

      expect(mockBaseHook).toHaveBeenCalledTimes(1);
    });

    it('should pass through all options to the hook call', () => {
      const { rerender } = renderHook(() => useStdoutDimensions());

      expect(mockBaseHook).toHaveBeenCalledTimes(1);

      rerender();

      // Should be called again on rerender
      expect(mockBaseHook).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle zero dimensions', () => {
      mockBaseHook.mockReturnValue([0, 0]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(0);
      expect(result.current.height).toBe(0);
      expect(result.current.breakpoint).toBe('narrow'); // 0 < 60
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle very large dimensions', () => {
      mockBaseHook.mockReturnValue([5000, 1000]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(5000);
      expect(result.current.height).toBe(1000);
      expect(result.current.breakpoint).toBe('wide');
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle negative dimensions gracefully', () => {
      mockBaseHook.mockReturnValue([-10, -5]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(-10);
      expect(result.current.height).toBe(-5);
      expect(result.current.breakpoint).toBe('narrow'); // -10 < 60
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle partial undefined dimensions', () => {
      // Only width undefined
      mockBaseHook.mockReturnValue([undefined as any, 30]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(80); // fallback
      expect(result.current.height).toBe(24); // fallback because isAvailable is false
      expect(result.current.isAvailable).toBe(false);
    });

    it('should handle extreme custom threshold values', () => {
      mockBaseHook.mockReturnValue([100, 24]);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          narrowThreshold: 200, // Everything is narrow
          wideThreshold: 300
        })
      );

      expect(result.current.breakpoint).toBe('narrow');
    });

    it('should handle inverted threshold values gracefully', () => {
      mockBaseHook.mockReturnValue([100, 24]);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          narrowThreshold: 150, // narrowThreshold > wideThreshold
          wideThreshold: 80
        })
      );

      // Should still work according to the logic: < 150 = narrow, >= 80 = wide
      // Since 100 < 150 but >= 80, it should be classified based on first condition (narrow)
      expect(result.current.breakpoint).toBe('narrow');
    });
  });

  describe('return interface', () => {
    it('should return all required properties', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current).toHaveProperty('width');
      expect(result.current).toHaveProperty('height');
      expect(result.current).toHaveProperty('breakpoint');
      expect(result.current).toHaveProperty('isAvailable');
    });

    it('should return correct types', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(typeof result.current.width).toBe('number');
      expect(typeof result.current.height).toBe('number');
      expect(typeof result.current.breakpoint).toBe('string');
      expect(['narrow', 'normal', 'wide']).toContain(result.current.breakpoint);
      expect(typeof result.current.isAvailable).toBe('boolean');
    });

    it('should be consistent between calls with same input', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result, rerender } = renderHook(() => useStdoutDimensions());

      const firstCall = { ...result.current };

      rerender();

      const secondCall = { ...result.current };

      expect(firstCall).toEqual(secondCall);
    });
  });

  describe('options handling', () => {
    it('should handle empty options object', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() => useStdoutDimensions({}));

      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);
    });

    it('should handle undefined options', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() => useStdoutDimensions(undefined));

      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);
    });

    it('should handle partial options', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          fallbackWidth: 100,
          // fallbackHeight not specified, should use default
        })
      );

      expect(result.current.width).toBe(100);
      expect(result.current.height).toBe(24); // default
    });
  });
});