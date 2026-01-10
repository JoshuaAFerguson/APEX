/**
 * Unit tests for useLimitColors hook
 */

import { getUsageLevel, getUsagePercentage, getUsageColor } from '../useLimitColors.js';

describe('useLimitColors', () => {
  describe('getUsageLevel', () => {
    it('should return safe for usage under 50%', () => {
      expect(getUsageLevel(25, 100)).toBe('safe');
      expect(getUsageLevel(49, 100)).toBe('safe');
    });

    it('should return warning for usage between 50% and 80%', () => {
      expect(getUsageLevel(50, 100)).toBe('warning');
      expect(getUsageLevel(75, 100)).toBe('warning');
      expect(getUsageLevel(79, 100)).toBe('warning');
    });

    it('should return danger for usage 80% and above', () => {
      expect(getUsageLevel(80, 100)).toBe('danger');
      expect(getUsageLevel(95, 100)).toBe('danger');
      expect(getUsageLevel(110, 100)).toBe('danger'); // Over limit
    });

    it('should return safe for zero or negative limits', () => {
      expect(getUsageLevel(50, 0)).toBe('safe');
      expect(getUsageLevel(50, -10)).toBe('safe');
    });

    it('should handle edge cases', () => {
      expect(getUsageLevel(0, 100)).toBe('safe');
      expect(getUsageLevel(100, 100)).toBe('danger');
      expect(getUsageLevel(50, 100)).toBe('warning');
    });
  });

  describe('getUsagePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(getUsagePercentage(25, 100)).toBe(25);
      expect(getUsagePercentage(75, 100)).toBe(75);
      expect(getUsagePercentage(100, 100)).toBe(100);
    });

    it('should handle values over limit', () => {
      expect(getUsagePercentage(150, 100)).toBe(100); // Clamped to 100
    });

    it('should handle zero and negative limits', () => {
      expect(getUsagePercentage(50, 0)).toBe(0);
      expect(getUsagePercentage(50, -10)).toBe(0);
    });

    it('should handle zero current value', () => {
      expect(getUsagePercentage(0, 100)).toBe(0);
    });

    it('should clamp negative percentages to 0', () => {
      expect(getUsagePercentage(-10, 100)).toBe(0);
    });
  });

  describe('getUsageColor', () => {
    const mockColors = {
      success: 'green',
      warning: 'yellow',
      error: 'red',
      muted: 'gray'
    } as any;

    it('should return correct colors for usage levels', () => {
      expect(getUsageColor('safe', mockColors)).toBe('green');
      expect(getUsageColor('warning', mockColors)).toBe('yellow');
      expect(getUsageColor('danger', mockColors)).toBe('red');
    });

    it('should return muted color for unknown levels', () => {
      expect(getUsageColor('unknown' as any, mockColors)).toBe('gray');
    });
  });
});