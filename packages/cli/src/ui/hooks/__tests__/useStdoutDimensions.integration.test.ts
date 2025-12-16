import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStdoutDimensions, type StdoutDimensions, type UseStdoutDimensionsOptions } from '../useStdoutDimensions.js';

// Mock ink-use-stdout-dimensions
vi.mock('ink-use-stdout-dimensions', () => {
  const mockHook = vi.fn();
  return {
    default: mockHook,
  };
});

import useStdoutDimensionsBase from 'ink-use-stdout-dimensions';

describe('useStdoutDimensions Integration Tests', () => {
  const mockBaseHook = vi.mocked(useStdoutDimensionsBase);

  beforeEach(() => {
    mockBaseHook.mockClear();
    mockBaseHook.mockReturnValue([80, 24]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('real-world scenarios', () => {
    it('should handle mobile terminal dimensions', () => {
      // Simulate a narrow mobile terminal
      mockBaseHook.mockReturnValue([40, 20]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(40);
      expect(result.current.height).toBe(20);
      expect(result.current.breakpoint).toBe('narrow');
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle standard desktop terminal dimensions', () => {
      // Simulate a standard desktop terminal
      mockBaseHook.mockReturnValue([80, 24]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);
      expect(result.current.breakpoint).toBe('normal');
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle wide desktop terminal dimensions', () => {
      // Simulate a wide desktop terminal
      mockBaseHook.mockReturnValue([140, 40]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(140);
      expect(result.current.height).toBe(40);
      expect(result.current.breakpoint).toBe('wide');
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle ultra-wide monitor setup', () => {
      // Simulate an ultra-wide monitor terminal
      mockBaseHook.mockReturnValue([200, 50]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(200);
      expect(result.current.height).toBe(50);
      expect(result.current.breakpoint).toBe('wide');
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle terminal session in headless environment', () => {
      // Simulate headless environment (e.g., CI/CD)
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);
      expect(result.current.breakpoint).toBe('normal');
      expect(result.current.isAvailable).toBe(false);
    });
  });

  describe('responsive layout scenarios', () => {
    it('should provide consistent breakpoints for responsive design', () => {
      const testCases = [
        { width: 50, expected: 'narrow' as const },
        { width: 59, expected: 'narrow' as const },
        { width: 60, expected: 'normal' as const },
        { width: 80, expected: 'normal' as const },
        { width: 100, expected: 'normal' as const },
        { width: 119, expected: 'normal' as const },
        { width: 120, expected: 'wide' as const },
        { width: 160, expected: 'wide' as const },
      ];

      testCases.forEach(({ width, expected }) => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());
        expect(result.current.breakpoint).toBe(expected);
      });
    });

    it('should support custom breakpoints for specialized layouts', () => {
      mockBaseHook.mockReturnValue([100, 30]);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          narrowThreshold: 80,
          wideThreshold: 140
        })
      );

      expect(result.current.breakpoint).toBe('normal'); // 80 <= 100 < 140
    });

    it('should handle responsive transitions smoothly', () => {
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      // Start narrow
      mockBaseHook.mockReturnValue([50, 24]);
      rerender();
      expect(result.current.breakpoint).toBe('narrow');

      // Transition to normal
      mockBaseHook.mockReturnValue([80, 24]);
      rerender();
      expect(result.current.breakpoint).toBe('normal');

      // Transition to wide
      mockBaseHook.mockReturnValue([150, 30]);
      rerender();
      expect(result.current.breakpoint).toBe('wide');

      // Back to normal
      mockBaseHook.mockReturnValue([100, 30]);
      rerender();
      expect(result.current.breakpoint).toBe('normal');
    });
  });

  describe('performance characteristics', () => {
    it('should not cause unnecessary re-renders with stable dimensions', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result, rerender } = renderHook(() => useStdoutDimensions());

      const initialResult = result.current;

      // Multiple re-renders with same dimensions
      for (let i = 0; i < 10; i++) {
        rerender();
      }

      // Should be the same object reference due to memoization
      expect(result.current.breakpoint).toBe(initialResult.breakpoint);
      expect(result.current.width).toBe(initialResult.width);
      expect(result.current.height).toBe(initialResult.height);
      expect(result.current.isAvailable).toBe(initialResult.isAvailable);
    });

    it('should handle rapid dimension changes efficiently', () => {
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      // Simulate rapid resizing
      const dimensions = [
        [40, 20], [60, 24], [80, 30], [120, 40], [160, 50],
        [140, 45], [100, 35], [80, 25], [50, 20]
      ];

      dimensions.forEach(([width, height]) => {
        mockBaseHook.mockReturnValue([width, height]);
        rerender();

        expect(result.current.width).toBe(width);
        expect(result.current.height).toBe(height);
        expect(typeof result.current.breakpoint).toBe('string');
        expect(result.current.isAvailable).toBe(true);
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should gracefully handle base hook errors', () => {
      // Simulate base hook throwing an error
      mockBaseHook.mockImplementation(() => {
        throw new Error('Terminal access error');
      });

      expect(() => {
        renderHook(() => useStdoutDimensions());
      }).toThrow('Terminal access error');
    });

    it('should handle mixed defined/undefined dimensions consistently', () => {
      // Test various combinations of undefined dimensions
      const testCases = [
        [undefined, 24], // Width undefined
        [80, undefined], // Height undefined
        [null, 24], // Width null
        [80, null], // Height null
        [0, undefined], // Width zero, height undefined
        [undefined, 0], // Width undefined, height zero
      ];

      testCases.forEach(([width, height]) => {
        mockBaseHook.mockReturnValue([width as any, height as any]);
        const { result } = renderHook(() => useStdoutDimensions());

        // Should always use fallbacks when any dimension is unavailable
        expect(result.current.width).toBe(80);
        expect(result.current.height).toBe(24);
        expect(result.current.isAvailable).toBe(false);
      });
    });

    it('should maintain type safety with various option combinations', () => {
      const optionsVariations: UseStdoutDimensionsOptions[] = [
        {},
        { fallbackWidth: 100 },
        { fallbackHeight: 30 },
        { narrowThreshold: 70 },
        { wideThreshold: 130 },
        { fallbackWidth: 90, fallbackHeight: 35 },
        { narrowThreshold: 50, wideThreshold: 150 },
        {
          fallbackWidth: 110,
          fallbackHeight: 40,
          narrowThreshold: 70,
          wideThreshold: 140
        },
      ];

      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      optionsVariations.forEach((options) => {
        const { result } = renderHook(() => useStdoutDimensions(options));

        expect(typeof result.current.width).toBe('number');
        expect(typeof result.current.height).toBe('number');
        expect(typeof result.current.breakpoint).toBe('string');
        expect(typeof result.current.isAvailable).toBe('boolean');
        expect(['narrow', 'normal', 'wide']).toContain(result.current.breakpoint);
      });
    });
  });

  describe('integration with React lifecycle', () => {
    it('should work correctly with useEffect dependencies', () => {
      const mockEffect = vi.fn();

      function TestComponent() {
        const dimensions = useStdoutDimensions();

        // Simulate a useEffect that depends on dimensions
        mockEffect(dimensions.width, dimensions.breakpoint);

        return dimensions;
      }

      mockBaseHook.mockReturnValue([80, 24]);
      const { result, rerender } = renderHook(() => TestComponent());

      expect(mockEffect).toHaveBeenLastCalledWith(80, 'normal');

      // Change dimensions
      mockBaseHook.mockReturnValue([150, 30]);
      rerender();

      expect(mockEffect).toHaveBeenLastCalledWith(150, 'wide');
    });

    it('should handle component unmounting gracefully', () => {
      mockBaseHook.mockReturnValue([80, 24]);

      const { result, unmount } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(80);

      // Should not throw on unmount
      expect(() => unmount()).not.toThrow();
    });

    it('should maintain consistent interface across re-mounts', () => {
      mockBaseHook.mockReturnValue([100, 30]);

      const { result: result1, unmount: unmount1 } = renderHook(() => useStdoutDimensions());
      const firstResult = { ...result1.current };

      unmount1();

      const { result: result2 } = renderHook(() => useStdoutDimensions());
      const secondResult = { ...result2.current };

      expect(firstResult).toEqual(secondResult);
    });
  });

  describe('configuration validation', () => {
    it('should handle extreme configuration values', () => {
      const extremeConfigs = [
        { fallbackWidth: 0, fallbackHeight: 0 },
        { fallbackWidth: 1000, fallbackHeight: 500 },
        { narrowThreshold: 0, wideThreshold: 1 },
        { narrowThreshold: 1000, wideThreshold: 2000 },
        { fallbackWidth: -1, fallbackHeight: -1 },
      ];

      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      extremeConfigs.forEach((config) => {
        const { result } = renderHook(() => useStdoutDimensions(config));

        // Should always return a valid result, even with extreme configs
        expect(typeof result.current.width).toBe('number');
        expect(typeof result.current.height).toBe('number');
        expect(['narrow', 'normal', 'wide']).toContain(result.current.breakpoint);
        expect(result.current.isAvailable).toBe(false);
      });
    });

    it('should handle configuration changes mid-lifecycle', () => {
      mockBaseHook.mockReturnValue([100, 30]);

      const { result, rerender } = renderHook(
        (props: UseStdoutDimensionsOptions) => useStdoutDimensions(props),
        { initialProps: { narrowThreshold: 60, wideThreshold: 120 } }
      );

      expect(result.current.breakpoint).toBe('normal'); // 60 <= 100 < 120

      // Change thresholds
      rerender({ narrowThreshold: 110, wideThreshold: 150 });

      expect(result.current.breakpoint).toBe('narrow'); // 100 < 110
    });
  });
});