/**
 * Edge case and comprehensive tests for useLimitColors hook
 * Tests extreme values, boundary conditions, and integration scenarios
 */

import { renderHook } from '@testing-library/react';
import {
  getUsageLevel,
  getUsagePercentage,
  getUsageColor,
  useLimitColors,
  type UsageLevel
} from '../useLimitColors.js';
import { ThemeProvider, useThemeColors } from '../../../context/ThemeContext.js';
import React from 'react';

describe('useLimitColors Edge Cases', () => {
  describe('getUsageLevel edge cases', () => {
    it('should handle floating point precision issues', () => {
      // Test values that might cause floating point precision issues
      expect(getUsageLevel(49.9999999, 100)).toBe('safe');
      expect(getUsageLevel(50.0000001, 100)).toBe('warning');
      expect(getUsageLevel(79.9999999, 100)).toBe('warning');
      expect(getUsageLevel(80.0000001, 100)).toBe('danger');
    });

    it('should handle very small numbers', () => {
      expect(getUsageLevel(0.0001, 0.001)).toBe('safe'); // 10%
      expect(getUsageLevel(0.0005, 0.001)).toBe('warning'); // 50%
      expect(getUsageLevel(0.0008, 0.001)).toBe('danger'); // 80%
    });

    it('should handle very large numbers', () => {
      const billion = 1_000_000_000;
      expect(getUsageLevel(billion * 0.4, billion)).toBe('safe');
      expect(getUsageLevel(billion * 0.6, billion)).toBe('warning');
      expect(getUsageLevel(billion * 0.9, billion)).toBe('danger');
    });

    it('should handle extreme ratios', () => {
      expect(getUsageLevel(1, 1_000_000_000)).toBe('safe'); // Tiny usage
      expect(getUsageLevel(999_999_999, 1_000_000_000)).toBe('danger'); // Almost at limit
    });

    it('should handle infinity and NaN scenarios', () => {
      expect(getUsageLevel(Infinity, 100)).toBe('danger');
      expect(getUsageLevel(100, Infinity)).toBe('safe');
      expect(getUsageLevel(NaN, 100)).toBe('safe'); // NaN comparisons should default to safe
      expect(getUsageLevel(100, NaN)).toBe('safe');
      expect(getUsageLevel(Infinity, Infinity)).toBe('safe'); // Both infinite
    });

    it('should handle negative infinity', () => {
      expect(getUsageLevel(-Infinity, 100)).toBe('safe');
      expect(getUsageLevel(100, -Infinity)).toBe('safe');
    });
  });

  describe('getUsagePercentage edge cases', () => {
    it('should handle overflow beyond 100%', () => {
      expect(getUsagePercentage(150, 100)).toBe(100); // Clamped
      expect(getUsagePercentage(1000, 100)).toBe(100); // Heavily clamped
      expect(getUsagePercentage(Infinity, 100)).toBe(100);
    });

    it('should handle underflow below 0%', () => {
      expect(getUsagePercentage(-50, 100)).toBe(0); // Clamped
      expect(getUsagePercentage(-Infinity, 100)).toBe(0);
    });

    it('should handle division by zero', () => {
      expect(getUsagePercentage(50, 0)).toBe(0);
      expect(getUsagePercentage(0, 0)).toBe(0);
    });

    it('should handle very small denominators', () => {
      const epsilon = Number.EPSILON;
      const result = getUsagePercentage(epsilon * 0.5, epsilon);
      expect(result).toBe(50);
    });

    it('should handle precision for floating point calculations', () => {
      // Test that 1/3 doesn't cause precision issues
      const result = getUsagePercentage(1, 3);
      expect(result).toBeCloseTo(33.333, 2);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should handle negative limits', () => {
      expect(getUsagePercentage(50, -100)).toBe(0); // Should return 0 for negative limits
      expect(getUsagePercentage(-50, -100)).toBe(0);
    });
  });

  describe('getUsageColor edge cases', () => {
    const mockColors = {
      success: 'green',
      warning: 'yellow',
      error: 'red',
      muted: 'gray',
      primary: 'blue',
      info: 'cyan'
    } as any;

    it('should handle all valid usage levels', () => {
      const levels: UsageLevel[] = ['safe', 'warning', 'danger'];

      levels.forEach(level => {
        const color = getUsageColor(level, mockColors);
        expect(typeof color).toBe('string');
        expect(color.length).toBeGreaterThan(0);
      });
    });

    it('should handle invalid usage levels gracefully', () => {
      const invalidLevels = ['unknown', 'invalid', '', null, undefined] as any[];

      invalidLevels.forEach(level => {
        const color = getUsageColor(level, mockColors);
        expect(color).toBe('gray'); // Should fall back to muted
      });
    });

    it('should handle missing theme colors', () => {
      const incompleteColors = {
        success: 'green'
        // Missing warning, error, muted
      } as any;

      expect(getUsageColor('safe', incompleteColors)).toBe('green');
      expect(getUsageColor('warning', incompleteColors)).toBeUndefined(); // Missing property
      expect(getUsageColor('danger', incompleteColors)).toBeUndefined();
      expect(getUsageColor('unknown' as any, incompleteColors)).toBeUndefined();
    });

    it('should handle null/undefined theme colors object', () => {
      expect(() => getUsageColor('safe', null as any)).toThrow();
      expect(() => getUsageColor('safe', undefined as any)).toThrow();
    });
  });

  describe('useLimitColors hook integration', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
    );

    it('should return consistent object structure', () => {
      const { result } = renderHook(
        () => useLimitColors(50, 100),
        { wrapper }
      );

      expect(result.current).toHaveProperty('level');
      expect(result.current).toHaveProperty('percentage');
      expect(result.current).toHaveProperty('color');
      expect(result.current).toHaveProperty('isExceeded');
      expect(result.current).toHaveProperty('isNearLimit');
    });

    it('should handle theme context properly', () => {
      const { result } = renderHook(
        () => useLimitColors(80, 100),
        { wrapper }
      );

      expect(result.current.level).toBe('danger');
      expect(result.current.percentage).toBe(80);
      expect(result.current.isNearLimit).toBe(true);
      expect(result.current.isExceeded).toBe(false);
      expect(typeof result.current.color).toBe('string');
    });

    it('should recalculate when values change', () => {
      let current = 40;
      let limit = 100;

      const { result, rerender } = renderHook(
        () => useLimitColors(current, limit),
        { wrapper }
      );

      expect(result.current.level).toBe('safe');

      // Change to warning level
      current = 60;
      rerender();

      expect(result.current.level).toBe('warning');

      // Change to danger level
      current = 85;
      rerender();

      expect(result.current.level).toBe('danger');

      // Exceed limit
      current = 110;
      rerender();

      expect(result.current.level).toBe('danger');
      expect(result.current.isExceeded).toBe(true);
    });

    it('should handle rapid value changes', () => {
      let current = 0;
      const limit = 100;

      const { result, rerender } = renderHook(
        () => useLimitColors(current, limit),
        { wrapper }
      );

      // Rapidly change values
      for (current = 0; current <= 150; current += 10) {
        rerender();

        // Should always return valid results
        expect(result.current.level).toMatch(/^(safe|warning|danger)$/);
        expect(result.current.percentage).toBeGreaterThanOrEqual(0);
        expect(result.current.percentage).toBeLessThanOrEqual(100);
        expect(typeof result.current.color).toBe('string');
        expect(typeof result.current.isExceeded).toBe('boolean');
        expect(typeof result.current.isNearLimit).toBe('boolean');
      }
    });

    it('should handle edge cases in isNearLimit calculation', () => {
      const testCases = [
        { current: 49, limit: 100, expected: false }, // Safe
        { current: 50, limit: 100, expected: true },  // Warning
        { current: 79, limit: 100, expected: true },  // Warning
        { current: 80, limit: 100, expected: true },  // Danger
        { current: 100, limit: 100, expected: true }, // At limit (danger)
        { current: 110, limit: 100, expected: true }, // Over limit (danger)
      ];

      testCases.forEach(({ current, limit, expected }) => {
        const { result } = renderHook(
          () => useLimitColors(current, limit),
          { wrapper }
        );

        expect(result.current.isNearLimit).toBe(expected);
      });
    });

    it('should handle edge cases in isExceeded calculation', () => {
      const testCases = [
        { current: 99, limit: 100, expected: false },
        { current: 100, limit: 100, expected: false }, // At limit, not exceeded
        { current: 100.001, limit: 100, expected: true }, // Minimally exceeded
        { current: 150, limit: 100, expected: true },
      ];

      testCases.forEach(({ current, limit, expected }) => {
        const { result } = renderHook(
          () => useLimitColors(current, limit),
          { wrapper }
        );

        expect(result.current.isExceeded).toBe(expected);
      });
    });

    it('should handle boundary conditions precisely', () => {
      const boundaries = [
        { current: 49.99999, limit: 100, expectedLevel: 'safe' },
        { current: 50.00001, limit: 100, expectedLevel: 'warning' },
        { current: 79.99999, limit: 100, expectedLevel: 'warning' },
        { current: 80.00001, limit: 100, expectedLevel: 'danger' },
      ];

      boundaries.forEach(({ current, limit, expectedLevel }) => {
        const { result } = renderHook(
          () => useLimitColors(current, limit),
          { wrapper }
        );

        expect(result.current.level).toBe(expectedLevel);
      });
    });

    it('should handle zero and negative limits gracefully', () => {
      const { result: zeroResult } = renderHook(
        () => useLimitColors(50, 0),
        { wrapper }
      );

      expect(zeroResult.current.level).toBe('safe');
      expect(zeroResult.current.percentage).toBe(0);

      const { result: negativeResult } = renderHook(
        () => useLimitColors(50, -100),
        { wrapper }
      );

      expect(negativeResult.current.level).toBe('safe');
      expect(negativeResult.current.percentage).toBe(0);
    });
  });

  describe('mathematical consistency', () => {
    it('should maintain consistent behavior across equivalent ratios', () => {
      const ratios = [
        [1, 2], [10, 20], [100, 200], [1000, 2000], [10000, 20000]
      ];

      const results = ratios.map(([current, limit]) => ({
        level: getUsageLevel(current, limit),
        percentage: getUsagePercentage(current, limit)
      }));

      // All should be equivalent (50% usage)
      results.forEach(result => {
        expect(result.level).toBe('warning'); // 50% is warning level
        expect(result.percentage).toBe(50);
      });
    });

    it('should handle percentage calculation consistency', () => {
      // Test that percentage calculations are consistent
      const testValue = 33;
      const testLimit = 100;

      const percentage = getUsagePercentage(testValue, testLimit);
      const level = getUsageLevel(testValue, testLimit);

      // Manual calculation check
      expect(percentage).toBe(33);
      expect(level).toBe('safe'); // 33% is under 50%

      // Verify consistency with decimal inputs
      const decimalPercentage = getUsagePercentage(33.0, 100.0);
      const decimalLevel = getUsageLevel(33.0, 100.0);

      expect(decimalPercentage).toBe(percentage);
      expect(decimalLevel).toBe(level);
    });
  });
});