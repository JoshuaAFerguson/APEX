import { describe, it, expect } from 'vitest';

// Since getBreakpoint is not exported, we'll test it through the main hook
// but focus on pure function behavior
import { useStdoutDimensions } from '../useStdoutDimensions.js';
import { vi } from 'vitest';

// Mock ink-use-stdout-dimensions
vi.mock('ink-use-stdout-dimensions', () => {
  const mockHook = vi.fn();
  return {
    default: mockHook,
  };
});

import useStdoutDimensionsBase from 'ink-use-stdout-dimensions';
import { renderHook } from '@testing-library/react';

describe('useStdoutDimensions Unit Tests', () => {
  const mockBaseHook = vi.mocked(useStdoutDimensionsBase);

  describe('getBreakpoint function behavior', () => {
    // Test the internal getBreakpoint function through the hook

    it('should classify breakpoints according to exact specifications', () => {
      const testCases = [
        // Edge cases around default thresholds
        { width: 0, expectedBreakpoint: 'narrow', description: 'zero width' },
        { width: 1, expectedBreakpoint: 'narrow', description: 'minimum positive width' },
        { width: 59, expectedBreakpoint: 'narrow', description: 'just below narrow threshold' },
        { width: 60, expectedBreakpoint: 'normal', description: 'exactly at narrow threshold' },
        { width: 61, expectedBreakpoint: 'normal', description: 'just above narrow threshold' },
        { width: 119, expectedBreakpoint: 'normal', description: 'just below wide threshold' },
        { width: 120, expectedBreakpoint: 'wide', description: 'exactly at wide threshold' },
        { width: 121, expectedBreakpoint: 'wide', description: 'just above wide threshold' },
        { width: 1000, expectedBreakpoint: 'wide', description: 'very wide' },
      ] as const;

      testCases.forEach(({ width, expectedBreakpoint, description }) => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.breakpoint).toBe(expectedBreakpoint);
      });
    });

    it('should handle custom thresholds correctly', () => {
      const customTestCases = [
        {
          width: 50,
          options: { narrowThreshold: 60, wideThreshold: 120 },
          expected: 'narrow'
        },
        {
          width: 70,
          options: { narrowThreshold: 60, wideThreshold: 120 },
          expected: 'normal'
        },
        {
          width: 130,
          options: { narrowThreshold: 60, wideThreshold: 120 },
          expected: 'wide'
        },
        {
          width: 80,
          options: { narrowThreshold: 90, wideThreshold: 140 },
          expected: 'narrow'
        },
        {
          width: 100,
          options: { narrowThreshold: 90, wideThreshold: 140 },
          expected: 'normal'
        },
        {
          width: 150,
          options: { narrowThreshold: 90, wideThreshold: 140 },
          expected: 'wide'
        },
      ];

      customTestCases.forEach(({ width, options, expected }) => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions(options));

        expect(result.current.breakpoint).toBe(expected);
      });
    });

    it('should handle edge case threshold configurations', () => {
      const edgeCases = [
        // Same thresholds
        {
          width: 100,
          options: { narrowThreshold: 100, wideThreshold: 100 },
          expected: 'wide', // width >= wideThreshold
          description: 'identical thresholds'
        },
        // Very low thresholds
        {
          width: 50,
          options: { narrowThreshold: 1, wideThreshold: 2 },
          expected: 'wide',
          description: 'very low thresholds'
        },
        // Very high thresholds
        {
          width: 80,
          options: { narrowThreshold: 1000, wideThreshold: 2000 },
          expected: 'narrow',
          description: 'very high thresholds'
        },
        // Inverted thresholds (wide < narrow)
        {
          width: 100,
          options: { narrowThreshold: 150, wideThreshold: 80 },
          expected: 'narrow', // First condition wins: 100 < 150
          description: 'inverted thresholds'
        },
        // Zero thresholds
        {
          width: 50,
          options: { narrowThreshold: 0, wideThreshold: 0 },
          expected: 'wide', // 50 >= 0
          description: 'zero thresholds'
        },
        // Negative thresholds
        {
          width: 50,
          options: { narrowThreshold: -10, wideThreshold: -5 },
          expected: 'wide', // 50 >= -5
          description: 'negative thresholds'
        },
      ];

      edgeCases.forEach(({ width, options, expected, description }) => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions(options));

        expect(result.current.breakpoint).toBe(expected);
      });
    });

    it('should handle negative and extreme width values', () => {
      const extremeValues = [
        { width: -100, expected: 'narrow', description: 'negative width' },
        { width: -1, expected: 'narrow', description: 'negative one' },
        { width: Number.MAX_SAFE_INTEGER, expected: 'wide', description: 'maximum safe integer' },
        { width: Number.MIN_SAFE_INTEGER, expected: 'narrow', description: 'minimum safe integer' },
        { width: Infinity, expected: 'wide', description: 'positive infinity' },
        { width: -Infinity, expected: 'narrow', description: 'negative infinity' },
      ];

      extremeValues.forEach(({ width, expected, description }) => {
        mockBaseHook.mockReturnValue([width, 24]);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.breakpoint).toBe(expected);
      });
    });
  });

  describe('fallback value calculation', () => {
    it('should apply fallbacks when base hook returns undefined', () => {
      const fallbackTests = [
        { fallbackWidth: 100, fallbackHeight: 30 },
        { fallbackWidth: 0, fallbackHeight: 0 },
        { fallbackWidth: 200, fallbackHeight: 50 },
        { fallbackWidth: -10, fallbackHeight: -5 },
      ];

      fallbackTests.forEach(({ fallbackWidth, fallbackHeight }) => {
        mockBaseHook.mockReturnValue([undefined as any, undefined as any]);
        const { result } = renderHook(() => useStdoutDimensions({
          fallbackWidth,
          fallbackHeight
        }));

        expect(result.current.width).toBe(fallbackWidth);
        expect(result.current.height).toBe(fallbackHeight);
        expect(result.current.isAvailable).toBe(false);
      });
    });

    it('should use actual dimensions when available, regardless of fallbacks', () => {
      mockBaseHook.mockReturnValue([150, 40]);

      const { result } = renderHook(() => useStdoutDimensions({
        fallbackWidth: 80,
        fallbackHeight: 24
      }));

      expect(result.current.width).toBe(150);
      expect(result.current.height).toBe(40);
      expect(result.current.isAvailable).toBe(true);
    });

    it('should handle partial undefined values correctly', () => {
      // Test various combinations of defined/undefined values
      const partialTests = [
        { actual: [undefined, 30], expected: { width: 80, height: 24, isAvailable: false } },
        { actual: [100, undefined], expected: { width: 80, height: 24, isAvailable: false } },
        { actual: [null, 30], expected: { width: 80, height: 24, isAvailable: false } },
        { actual: [100, null], expected: { width: 80, height: 24, isAvailable: false } },
      ];

      partialTests.forEach(({ actual, expected }) => {
        mockBaseHook.mockReturnValue(actual as any);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.width).toBe(expected.width);
        expect(result.current.height).toBe(expected.height);
        expect(result.current.isAvailable).toBe(expected.isAvailable);
      });
    });
  });

  describe('availability detection', () => {
    it('should correctly identify when dimensions are available', () => {
      const availabilityTests = [
        { input: [80, 24], expected: true },
        { input: [0, 0], expected: true },
        { input: [-10, -5], expected: true },
        { input: [1000, 500], expected: true },
        { input: [undefined, undefined], expected: false },
        { input: [null, null], expected: false },
        { input: [80, undefined], expected: false },
        { input: [undefined, 24], expected: false },
        { input: [80, null], expected: false },
        { input: [null, 24], expected: false },
        { input: [NaN, NaN], expected: true }, // NaN is not undefined
        { input: [Infinity, -Infinity], expected: true },
      ];

      availabilityTests.forEach(({ input, expected }) => {
        mockBaseHook.mockReturnValue(input as any);
        const { result } = renderHook(() => useStdoutDimensions());

        expect(result.current.isAvailable).toBe(expected);
      });
    });
  });

  describe('option defaulting', () => {
    it('should apply correct default values for all options', () => {
      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      const { result } = renderHook(() => useStdoutDimensions({}));

      // Check defaults are applied correctly
      expect(result.current.width).toBe(80); // fallbackWidth default
      expect(result.current.height).toBe(24); // fallbackHeight default

      // Test breakpoint uses default thresholds (narrowThreshold: 60, wideThreshold: 120)
      // 80 should be 'normal' (60 <= 80 < 120)
      expect(result.current.breakpoint).toBe('normal');
    });

    it('should preserve provided options and default missing ones', () => {
      const partialOptions = [
        { fallbackWidth: 100 },
        { fallbackHeight: 30 },
        { narrowThreshold: 70 },
        { wideThreshold: 130 },
      ];

      mockBaseHook.mockReturnValue([undefined as any, undefined as any]);

      partialOptions.forEach((options) => {
        const { result } = renderHook(() => useStdoutDimensions(options));

        // Check that provided option is used
        if ('fallbackWidth' in options) {
          expect(result.current.width).toBe(options.fallbackWidth);
        } else {
          expect(result.current.width).toBe(80); // default
        }

        if ('fallbackHeight' in options) {
          expect(result.current.height).toBe(options.fallbackHeight);
        } else {
          expect(result.current.height).toBe(24); // default
        }
      });
    });
  });

  describe('return object structure', () => {
    it('should always return the exact interface structure', () => {
      mockBaseHook.mockReturnValue([80, 24]);
      const { result } = renderHook(() => useStdoutDimensions());

      const returnValue = result.current;

      // Check all required properties exist
      expect(returnValue).toHaveProperty('width');
      expect(returnValue).toHaveProperty('height');
      expect(returnValue).toHaveProperty('breakpoint');
      expect(returnValue).toHaveProperty('isAvailable');

      // Check no extra properties
      const expectedKeys = ['width', 'height', 'breakpoint', 'isAvailable'];
      const actualKeys = Object.keys(returnValue);
      expect(actualKeys.sort()).toEqual(expectedKeys.sort());

      // Check property types
      expect(typeof returnValue.width).toBe('number');
      expect(typeof returnValue.height).toBe('number');
      expect(typeof returnValue.breakpoint).toBe('string');
      expect(['narrow', 'normal', 'wide']).toContain(returnValue.breakpoint);
      expect(typeof returnValue.isAvailable).toBe('boolean');
    });

    it('should maintain consistent object shape across different scenarios', () => {
      const scenarios = [
        { dims: [80, 24], desc: 'normal dimensions' },
        { dims: [undefined, undefined], desc: 'undefined dimensions' },
        { dims: [0, 0], desc: 'zero dimensions' },
        { dims: [1000, 500], desc: 'large dimensions' },
        { dims: [-10, -5], desc: 'negative dimensions' },
      ];

      scenarios.forEach(({ dims, desc }) => {
        mockBaseHook.mockReturnValue(dims as any);
        const { result } = renderHook(() => useStdoutDimensions());

        const keys = Object.keys(result.current);
        expect(keys.sort()).toEqual(['width', 'height', 'breakpoint', 'isAvailable'].sort());
      });
    });
  });
});