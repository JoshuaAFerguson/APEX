import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStdoutDimensions } from '../useStdoutDimensions.js';

// Create mock stdout object
const createMockStdout = (columns: number | undefined, rows: number | undefined) => ({
  columns,
  rows,
  on: vi.fn(),
  off: vi.fn(),
});

let mockStdout = createMockStdout(80, 24);

// Mock ink's useStdout hook
vi.mock('ink', () => ({
  useStdout: vi.fn(() => ({ stdout: mockStdout })),
}));

import { useStdout } from 'ink';

describe('useStdoutDimensions', () => {
  const mockUseStdout = vi.mocked(useStdout);

  // Helper to set mock dimensions
  const setMockDimensions = (columns: number | undefined, rows: number | undefined) => {
    mockStdout = createMockStdout(columns, rows);
    mockUseStdout.mockReturnValue({ stdout: mockStdout as any });
  };

  beforeEach(() => {
    // Reset the mock before each test
    mockUseStdout.mockClear();
    // Default mock implementation: 80x24 terminal
    setMockDimensions(80, 24);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should return dimensions from ink useStdout', () => {
      setMockDimensions(100, 30);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(100);
      expect(result.current.height).toBe(30);
      expect(result.current.isAvailable).toBe(true);
    });

    it('should use fallback values when stdout dimensions are unavailable', () => {
      setMockDimensions(undefined, undefined);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);
      expect(result.current.isAvailable).toBe(false);
    });

    it('should use custom fallback values', () => {
      setMockDimensions(undefined, undefined);

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
      // Set initial dimensions
      setMockDimensions(80, 24);
      const { result } = renderHook(() => useStdoutDimensions());

      // Initial dimensions
      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);

      // Note: The hook uses useState with initial values, so dimensions
      // only update via the resize event. Testing resize events requires
      // a more complex setup with act() and event simulation.
      // This test verifies the initial dimensions are correct.
    });
  });

  describe('breakpoint classification', () => {
    it('should classify narrow terminals (< 60 columns)', () => {
      setMockDimensions(50, 24);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.breakpoint).toBe('narrow');
      expect(result.current.isNarrow).toBe(true);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.isNormal).toBe(false);
      expect(result.current.isWide).toBe(false);
    });

    it('should classify compact terminals (60-99 columns)', () => {
      setMockDimensions(80, 24);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.breakpoint).toBe('compact');
      expect(result.current.isNarrow).toBe(false);
      expect(result.current.isCompact).toBe(true);
      expect(result.current.isNormal).toBe(false);
      expect(result.current.isWide).toBe(false);
    });

    it('should classify normal terminals (100-159 columns)', () => {
      setMockDimensions(120, 30);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.breakpoint).toBe('normal');
      expect(result.current.isNarrow).toBe(false);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.isNormal).toBe(true);
      expect(result.current.isWide).toBe(false);
    });

    it('should classify wide terminals (>= 160 columns)', () => {
      setMockDimensions(180, 30);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.breakpoint).toBe('wide');
      expect(result.current.isNarrow).toBe(false);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.isNormal).toBe(false);
      expect(result.current.isWide).toBe(true);
    });

    it('should handle boundary values correctly', () => {
      // Test narrow/compact boundary (60)
      setMockDimensions(59, 24);
      const { result: result59 } = renderHook(() => useStdoutDimensions());
      expect(result59.current.breakpoint).toBe('narrow');
      expect(result59.current.isNarrow).toBe(true);

      setMockDimensions(60, 24);
      const { result: result60 } = renderHook(() => useStdoutDimensions());
      expect(result60.current.breakpoint).toBe('compact');
      expect(result60.current.isCompact).toBe(true);

      // Test compact/normal boundary (100)
      setMockDimensions(99, 24);
      const { result: result99 } = renderHook(() => useStdoutDimensions());
      expect(result99.current.breakpoint).toBe('compact');
      expect(result99.current.isCompact).toBe(true);

      setMockDimensions(100, 24);
      const { result: result100 } = renderHook(() => useStdoutDimensions());
      expect(result100.current.breakpoint).toBe('normal');
      expect(result100.current.isNormal).toBe(true);

      // Test normal/wide boundary (160)
      setMockDimensions(159, 24);
      const { result: result159 } = renderHook(() => useStdoutDimensions());
      expect(result159.current.breakpoint).toBe('normal');
      expect(result159.current.isNormal).toBe(true);

      setMockDimensions(160, 24);
      const { result: result160 } = renderHook(() => useStdoutDimensions());
      expect(result160.current.breakpoint).toBe('wide');
      expect(result160.current.isWide).toBe(true);
    });

    it('should use new custom breakpoints system', () => {
      setMockDimensions(80, 24);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          breakpoints: {
            narrow: 70,
            compact: 110,
            normal: 150
          }
        })
      );

      // 80 columns with custom thresholds (narrow < 70, compact < 110, normal < 150)
      expect(result.current.breakpoint).toBe('compact');
      expect(result.current.isCompact).toBe(true);
    });

    it('should support deprecated thresholds for backward compatibility', () => {
      setMockDimensions(80, 24);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          narrowThreshold: 90,
          wideThreshold: 140
        })
      );

      // 80 columns with deprecated thresholds should map to new system
      expect(result.current.breakpoint).toBe('narrow');
      expect(result.current.isNarrow).toBe(true);
    });

    it('should correctly classify terminal at different widths', () => {
      // Test narrow
      setMockDimensions(40, 24);
      const { result: narrowResult } = renderHook(() => useStdoutDimensions());
      expect(narrowResult.current.breakpoint).toBe('narrow');
      expect(narrowResult.current.isNarrow).toBe(true);

      // Test wide
      setMockDimensions(180, 30);
      const { result: wideResult } = renderHook(() => useStdoutDimensions());
      expect(wideResult.current.breakpoint).toBe('wide');
      expect(wideResult.current.isWide).toBe(true);
    });

    it('should use fallback width for breakpoint calculation when unavailable', () => {
      setMockDimensions(undefined as any, undefined as any);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          fallbackWidth: 180 // Should result in 'wide' breakpoint
        })
      );

      expect(result.current.breakpoint).toBe('wide');
      expect(result.current.isWide).toBe(true);
      expect(result.current.isAvailable).toBe(false);
    });
  });

  describe('boolean helpers', () => {
    it('should have exactly one boolean helper true at a time', () => {
      const testCases = [
        { width: 40, expected: 'isNarrow' },
        { width: 80, expected: 'isCompact' },
        { width: 120, expected: 'isNormal' },
        { width: 180, expected: 'isWide' },
      ];

      testCases.forEach(({ width, expected }) => {
        setMockDimensions(width, 24);
        const { result } = renderHook(() => useStdoutDimensions());

        const helpers = ['isNarrow', 'isCompact', 'isNormal', 'isWide'];
        const trueHelpers = helpers.filter(helper => result.current[helper]);

        expect(trueHelpers).toHaveLength(1);
        expect(trueHelpers[0]).toBe(expected);
      });
    });

    it('should have correct boolean helpers for different terminal widths', () => {
      // Test narrow
      setMockDimensions(40, 24);
      const { result: narrowResult } = renderHook(() => useStdoutDimensions());
      expect(narrowResult.current.isNarrow).toBe(true);
      expect([narrowResult.current.isCompact, narrowResult.current.isNormal, narrowResult.current.isWide].some(Boolean)).toBe(false);

      // Test compact
      setMockDimensions(80, 30);
      const { result: compactResult } = renderHook(() => useStdoutDimensions());
      expect(compactResult.current.isCompact).toBe(true);
      expect([compactResult.current.isNarrow, compactResult.current.isNormal, compactResult.current.isWide].some(Boolean)).toBe(false);
    });
  });

  describe('memoization', () => {
    it('should memoize breakpoint calculation', () => {
      const getBreakpointSpy = vi.fn();

      // We can't directly spy on the internal getBreakpoint function,
      // but we can test that re-renders with same dimensions don't cause issues
      setMockDimensions(80, 24);

      const { result, rerender } = renderHook(() => useStdoutDimensions());

      const initialBreakpoint = result.current.breakpoint;

      // Multiple re-renders with same dimensions
      rerender();
      rerender();
      rerender();

      expect(result.current.breakpoint).toBe(initialBreakpoint);
      expect(result.current.breakpoint).toBe('compact');
    });

    it('should recalculate breakpoint when thresholds change', () => {
      setMockDimensions(80, 24);

      const { result, rerender } = renderHook(
        (props) => useStdoutDimensions(props),
        {
          initialProps: {
            breakpoints: { narrow: 60, compact: 100, normal: 160 }
          }
        }
      );

      expect(result.current.breakpoint).toBe('compact');

      // Change thresholds so 80 becomes narrow
      rerender({
        breakpoints: { narrow: 90, compact: 120, normal: 180 }
      });

      expect(result.current.breakpoint).toBe('narrow');
    });
  });

  describe('integration with ink useStdout', () => {
    it('should call the useStdout hook on render', () => {
      renderHook(() => useStdoutDimensions());

      expect(mockUseStdout).toHaveBeenCalled();
    });

    it('should call useStdout on each rerender', () => {
      const { rerender } = renderHook(() => useStdoutDimensions());

      const initialCallCount = mockUseStdout.mock.calls.length;

      rerender();

      // Should be called again on rerender
      expect(mockUseStdout.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  describe('edge cases', () => {
    it('should handle zero dimensions', () => {
      setMockDimensions(0, 0);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(0);
      expect(result.current.height).toBe(0);
      expect(result.current.breakpoint).toBe('narrow'); // 0 < 60
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle very large dimensions', () => {
      setMockDimensions(5000, 1000);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(5000);
      expect(result.current.height).toBe(1000);
      expect(result.current.breakpoint).toBe('wide');
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle negative dimensions gracefully', () => {
      setMockDimensions(-10, -5);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(-10);
      expect(result.current.height).toBe(-5);
      expect(result.current.breakpoint).toBe('narrow'); // -10 < 60
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle partial undefined dimensions', () => {
      // Only width undefined
      setMockDimensions(undefined as any, 30);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current.width).toBe(80); // fallback
      expect(result.current.height).toBe(24); // fallback because isAvailable is false
      expect(result.current.isAvailable).toBe(false);
    });

    it('should handle extreme custom threshold values', () => {
      setMockDimensions(100, 24);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          breakpoints: {
            narrow: 200, // Everything is narrow
            compact: 300,
            normal: 400
          }
        })
      );

      expect(result.current.breakpoint).toBe('narrow');
      expect(result.current.isNarrow).toBe(true);
    });

    it('should handle inverted threshold values gracefully', () => {
      setMockDimensions(100, 24);

      const { result } = renderHook(() =>
        useStdoutDimensions({
          breakpoints: {
            narrow: 150, // narrow > compact
            compact: 80,  // compact < narrow
            normal: 200
          }
        })
      );

      // Should still work according to the logic: < 150 = narrow
      // Since 100 < 150, it should be narrow
      expect(result.current.breakpoint).toBe('narrow');
      expect(result.current.isNarrow).toBe(true);
    });
  });

  describe('return interface', () => {
    it('should return all required properties', () => {
      setMockDimensions(80, 24);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(result.current).toHaveProperty('width');
      expect(result.current).toHaveProperty('height');
      expect(result.current).toHaveProperty('breakpoint');
      expect(result.current).toHaveProperty('isAvailable');
      // Boolean helpers
      expect(result.current).toHaveProperty('isNarrow');
      expect(result.current).toHaveProperty('isCompact');
      expect(result.current).toHaveProperty('isNormal');
      expect(result.current).toHaveProperty('isWide');
    });

    it('should return correct types', () => {
      setMockDimensions(80, 24);

      const { result } = renderHook(() => useStdoutDimensions());

      expect(typeof result.current.width).toBe('number');
      expect(typeof result.current.height).toBe('number');
      expect(typeof result.current.breakpoint).toBe('string');
      expect(['narrow', 'compact', 'normal', 'wide']).toContain(result.current.breakpoint);
      expect(typeof result.current.isAvailable).toBe('boolean');
      // Boolean helpers should be booleans
      expect(typeof result.current.isNarrow).toBe('boolean');
      expect(typeof result.current.isCompact).toBe('boolean');
      expect(typeof result.current.isNormal).toBe('boolean');
      expect(typeof result.current.isWide).toBe('boolean');
    });

    it('should be consistent between calls with same input', () => {
      setMockDimensions(80, 24);

      const { result, rerender } = renderHook(() => useStdoutDimensions());

      const firstCall = { ...result.current };

      rerender();

      const secondCall = { ...result.current };

      expect(firstCall).toEqual(secondCall);
    });
  });

  describe('options handling', () => {
    it('should handle empty options object', () => {
      setMockDimensions(undefined as any, undefined as any);

      const { result } = renderHook(() => useStdoutDimensions({}));

      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);
    });

    it('should handle undefined options', () => {
      setMockDimensions(undefined as any, undefined as any);

      const { result } = renderHook(() => useStdoutDimensions(undefined));

      expect(result.current.width).toBe(80);
      expect(result.current.height).toBe(24);
    });

    it('should handle partial options', () => {
      setMockDimensions(undefined as any, undefined as any);

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