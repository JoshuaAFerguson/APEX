/**
 * Performance tests for useStdoutDimensions hook
 *
 * Tests to ensure the hook performs well under various conditions
 * and doesn't cause performance bottlenecks in terminal applications.
 */

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

describe('useStdoutDimensions - Performance Tests', () => {
  const mockBaseHook = vi.mocked(useStdoutDimensionsBase);

  beforeEach(() => {
    mockBaseHook.mockClear();
    mockBaseHook.mockReturnValue([80, 24]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('memoization efficiency', () => {
    it('should not recalculate breakpoint unnecessarily', () => {
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      const initialBreakpoint = result.current.breakpoint;
      const initialWidth = result.current.width;

      // Multiple re-renders with same dimensions
      rerender();
      rerender();
      rerender();

      expect(result.current.breakpoint).toBe(initialBreakpoint);
      expect(result.current.width).toBe(initialWidth);
      // Object reference should be different due to new object creation,
      // but values should remain consistent
      expect(result.current.breakpoint).toBe('compact');
    });

    it('should recalculate breakpoint only when relevant values change', () => {
      const { result, rerender } = renderHook(
        (props) => useStdoutDimensions(props),
        { initialProps: { narrowThreshold: 60, wideThreshold: 120 } }
      );

      mockBaseHook.mockReturnValue([80, 24]);
      rerender({ narrowThreshold: 60, wideThreshold: 120 });

      const initialBreakpoint = result.current.breakpoint;

      // Change unrelated option (should not affect breakpoint calculation)
      rerender({ narrowThreshold: 60, wideThreshold: 120, fallbackHeight: 30 });
      expect(result.current.breakpoint).toBe(initialBreakpoint);

      // Change threshold (should trigger recalculation)
      rerender({ narrowThreshold: 90, wideThreshold: 120 });
      expect(result.current.breakpoint).toBe('narrow'); // 80 < 90
    });
  });

  describe('scaling performance', () => {
    it('should handle frequent dimension updates efficiently', () => {
      const startTime = performance.now();
      const { rerender } = renderHook(() => useStdoutDimensions());

      // Simulate 100 rapid dimension changes
      for (let i = 0; i < 100; i++) {
        mockBaseHook.mockReturnValue([40 + i, 20 + i]);
        rerender();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(100); // 100ms for 100 updates
    });

    it('should handle multiple hook instances efficiently', () => {
      const startTime = performance.now();
      const hooks: any[] = [];

      // Create multiple hook instances
      for (let i = 0; i < 50; i++) {
        const dimensions = [40 + i * 2, 20 + i];
        mockBaseHook.mockReturnValue(dimensions);

        hooks.push(renderHook(() => useStdoutDimensions()));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should create all hooks efficiently
      expect(duration).toBeLessThan(50); // 50ms for 50 instances
      expect(hooks).toHaveLength(50);

      // Clean up
      hooks.forEach(hook => hook.unmount());
    });

    it('should not leak memory with repeated mount/unmount cycles', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Perform many mount/unmount cycles
      for (let i = 0; i < 20; i++) {
        mockBaseHook.mockReturnValue([80 + i, 24 + i]);
        const { unmount } = renderHook(() => useStdoutDimensions());
        unmount();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Memory should not grow significantly (allow some variance)
      if (initialMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        expect(memoryGrowth).toBeLessThan(1024 * 1024); // Less than 1MB growth
      }
    });
  });

  describe('computational efficiency', () => {
    it('should compute breakpoints efficiently for various widths', () => {
      const widths = Array.from({ length: 1000 }, (_, i) => i);
      const startTime = performance.now();

      widths.forEach(width => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result, unmount } = renderHook(() => useStdoutDimensions());

        // Verify breakpoint is computed correctly
        expect(['narrow', 'compact', 'normal', 'wide']).toContain(result.current.breakpoint);

        unmount();
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 1000 different widths quickly
      expect(duration).toBeLessThan(200); // 200ms for 1000 computations
    });

    it('should handle complex custom configurations efficiently', () => {
      const complexConfigs = Array.from({ length: 100 }, (_, i) => ({
        fallbackWidth: 50 + i,
        fallbackHeight: 20 + i,
        narrowThreshold: 30 + i,
        wideThreshold: 100 + i * 2,
      }));

      const startTime = performance.now();

      complexConfigs.forEach(config => {
        mockBaseHook.mockReturnValue([undefined as any, undefined as any]);
        const { result, unmount } = renderHook(() => useStdoutDimensions(config));

        expect(result.current.width).toBe(config.fallbackWidth);
        expect(result.current.height).toBe(config.fallbackHeight);
        expect(['narrow', 'compact', 'normal', 'wide']).toContain(result.current.breakpoint);

        unmount();
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle complex configs efficiently
      expect(duration).toBeLessThan(150); // 150ms for 100 complex configs
    });
  });

  describe('dependency optimization', () => {
    it('should minimize base hook calls', () => {
      const { rerender } = renderHook(() => useStdoutDimensions());

      const initialCallCount = mockBaseHook.mock.calls.length;

      // Multiple re-renders should call base hook each time (as expected)
      rerender();
      rerender();
      rerender();

      const finalCallCount = mockBaseHook.mock.calls.length;

      // Should call base hook on each render (this is expected behavior)
      expect(finalCallCount).toBe(initialCallCount + 3);
    });

    it('should handle stable options object efficiently', () => {
      const stableOptions = { narrowThreshold: 60, wideThreshold: 120 };

      const { result, rerender } = renderHook(() => useStdoutDimensions(stableOptions));

      const initialBreakpoint = result.current.breakpoint;

      // Re-render with same options object
      for (let i = 0; i < 5; i++) {
        rerender();
      }

      // Should maintain consistent results
      expect(result.current.breakpoint).toBe(initialBreakpoint);
    });

    it('should detect option changes correctly', () => {
      const { result, rerender } = renderHook(
        (options) => useStdoutDimensions(options),
        { initialProps: { narrowThreshold: 60 } }
      );

      mockBaseHook.mockReturnValue([80, 24]);

      rerender({ narrowThreshold: 60 });
      const firstBreakpoint = result.current.breakpoint;

      rerender({ narrowThreshold: 90 });
      const secondBreakpoint = result.current.breakpoint;

      // Should detect the change and recalculate
      expect(firstBreakpoint).toBe('compact'); // 80 >= 60 and < 120
      expect(secondBreakpoint).toBe('narrow'); // 80 < 90
    });
  });

  describe('stress testing', () => {
    it('should handle rapid resize simulation', () => {
      const { result, rerender } = renderHook(() => useStdoutDimensions());

      const startTime = performance.now();

      // Simulate very rapid resizing (like dragging window edge)
      for (let i = 0; i < 500; i++) {
        const width = 40 + (i % 200); // Oscillate between 40 and 240
        const height = 20 + (i % 50); // Oscillate between 20 and 70

        mockBaseHook.mockReturnValue([width, height]);
        rerender();

        // Verify state remains consistent
        expect(result.current.width).toBe(width);
        expect(result.current.height).toBe(height);
        expect(['narrow', 'compact', 'normal', 'wide']).toContain(result.current.breakpoint);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 500 rapid changes efficiently
      expect(duration).toBeLessThan(300); // 300ms for 500 changes
    });

    it('should maintain performance with extreme dimensions', () => {
      const extremeDimensions = [
        [0, 0],
        [1, 1],
        [10000, 5000],
        [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
        [-1000, -500],
      ];

      const startTime = performance.now();

      extremeDimensions.forEach(([width, height]) => {
        mockBaseHook.mockReturnValue([width, height]);
        const { result, unmount } = renderHook(() => useStdoutDimensions());

        expect(typeof result.current.breakpoint).toBe('string');
        expect(['narrow', 'compact', 'normal', 'wide']).toContain(result.current.breakpoint);

        unmount();
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle extreme values efficiently
      expect(duration).toBeLessThan(50); // 50ms for extreme cases
    });
  });
});
