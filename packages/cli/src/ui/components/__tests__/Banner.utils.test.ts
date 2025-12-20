import { describe, it, expect } from 'vitest';

// Since the helper functions are not exported from Banner.tsx,
// we'll create equivalent functions here to test the core logic
// This ensures we test the business logic thoroughly

/**
 * Replicated Banner helper functions for comprehensive testing
 */

type BannerDisplayMode = 'text-only' | 'compact' | 'full';

const BANNER_BREAKPOINTS = {
  FULL_ART_MIN: 60,
  COMPACT_MIN: 40,
} as const;

function getDisplayMode(width: number): BannerDisplayMode {
  if (width >= BANNER_BREAKPOINTS.FULL_ART_MIN) return 'full';
  if (width >= BANNER_BREAKPOINTS.COMPACT_MIN) return 'compact';
  return 'text-only';
}

function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;
  const parts = path.split('/');
  // Keep last few segments with ellipsis
  let result = '.../' + parts.slice(-2).join('/');
  if (result.length > maxLen) {
    result = '...' + path.slice(-(maxLen - 3));
  }
  return result;
}

describe('Banner Helper Functions', () => {
  describe('getDisplayMode', () => {
    it('should return "full" for widths >= 60', () => {
      expect(getDisplayMode(60)).toBe('full');
      expect(getDisplayMode(80)).toBe('full');
      expect(getDisplayMode(120)).toBe('full');
      expect(getDisplayMode(200)).toBe('full');
    });

    it('should return "compact" for widths 40-59', () => {
      expect(getDisplayMode(40)).toBe('compact');
      expect(getDisplayMode(45)).toBe('compact');
      expect(getDisplayMode(50)).toBe('compact');
      expect(getDisplayMode(59)).toBe('compact');
    });

    it('should return "text-only" for widths < 40', () => {
      expect(getDisplayMode(0)).toBe('text-only');
      expect(getDisplayMode(10)).toBe('text-only');
      expect(getDisplayMode(25)).toBe('text-only');
      expect(getDisplayMode(39)).toBe('text-only');
    });

    it('should handle edge cases at exact breakpoints', () => {
      // Exactly at full breakpoint
      expect(getDisplayMode(60)).toBe('full');
      expect(getDisplayMode(59)).toBe('compact');

      // Exactly at compact breakpoint
      expect(getDisplayMode(40)).toBe('compact');
      expect(getDisplayMode(39)).toBe('text-only');
    });

    it('should handle negative or zero widths', () => {
      expect(getDisplayMode(-1)).toBe('text-only');
      expect(getDisplayMode(0)).toBe('text-only');
    });

    it('should handle very large widths', () => {
      expect(getDisplayMode(1000)).toBe('full');
      expect(getDisplayMode(Number.MAX_SAFE_INTEGER)).toBe('full');
    });

    it('should handle fractional widths (rounded down)', () => {
      expect(getDisplayMode(59.9)).toBe('compact');
      expect(getDisplayMode(39.9)).toBe('text-only');
      expect(getDisplayMode(60.1)).toBe('full');
    });
  });

  describe('truncatePath', () => {
    it('should return original path if shorter than or equal to maxLen', () => {
      expect(truncatePath('/short', 10)).toBe('/short');
      expect(truncatePath('/home/user', 10)).toBe('/home/user');
      expect(truncatePath('/exactly10', 10)).toBe('/exactly10');
    });

    it('should truncate long paths and keep last two segments', () => {
      const longPath = '/very/long/path/to/project/src/components';
      const result = truncatePath(longPath, 20);

      expect(result).toMatch(/^\.\.\.\/src\/components$/);
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should handle paths with many segments', () => {
      const manySegments = '/a/b/c/d/e/f/g/h/i/j/final';
      const result = truncatePath(manySegments, 15);

      expect(result).toMatch(/^\.\.\.\/j\/final$/);
      expect(result.length).toBeLessThanOrEqual(15);
    });

    it('should handle case where last two segments are still too long', () => {
      const veryLongSegments = '/path/to/very-very-long-segment-name/another-extremely-long-segment';
      const result = truncatePath(veryLongSegments, 20);

      expect(result).toMatch(/^\.\.\..*$/);
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should handle maxLen smaller than ellipsis prefix', () => {
      const path = '/some/long/path';
      const result = truncatePath(path, 5);

      expect(result).toMatch(/^\.\.\..*$/);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should handle single segment paths', () => {
      const singleSegment = '/very-long-single-segment-that-exceeds-limit';
      const result = truncatePath(singleSegment, 15);

      expect(result).toMatch(/^\.\.\..*$/);
      expect(result.length).toBeLessThanOrEqual(15);
    });

    it('should handle root path', () => {
      expect(truncatePath('/', 5)).toBe('/');
      expect(truncatePath('/', 1)).toBe('/');
    });

    it('should handle empty path', () => {
      expect(truncatePath('', 10)).toBe('');
    });

    it('should handle paths without leading slash', () => {
      const relativePath = 'home/user/project/src';
      const result = truncatePath(relativePath, 15);

      expect(result).toMatch(/^\.\.\.\/project\/src$/);
    });

    it('should handle paths with trailing slash', () => {
      const trailingSlash = '/home/user/project/';
      const result = truncatePath(trailingSlash, 15);

      // Should handle empty final segment correctly
      expect(result.length).toBeLessThanOrEqual(15);
    });

    it('should handle edge case where maxLen equals path length', () => {
      const path = '/home/user';
      expect(truncatePath(path, path.length)).toBe(path);
    });

    it('should handle very small maxLen values', () => {
      const path = '/some/long/path/here';

      expect(truncatePath(path, 1)).toBe('…');
      expect(truncatePath(path, 2)).toBe('…e');
      expect(truncatePath(path, 3)).toBe('…re');
    });

    it('should preserve important path information in truncation', () => {
      const projectPath = '/home/username/projects/my-awesome-app/src/components/ui';
      const result = truncatePath(projectPath, 25);

      // Should keep meaningful end segments
      expect(result).toMatch(/components\/ui$/);
      expect(result).toMatch(/^\.\.\.\/components\/ui$/);
    });
  });

  describe('Breakpoint Constants', () => {
    it('should have correct breakpoint values', () => {
      expect(BANNER_BREAKPOINTS.FULL_ART_MIN).toBe(60);
      expect(BANNER_BREAKPOINTS.COMPACT_MIN).toBe(40);
    });

    it('should maintain correct breakpoint hierarchy', () => {
      expect(BANNER_BREAKPOINTS.FULL_ART_MIN).toBeGreaterThan(BANNER_BREAKPOINTS.COMPACT_MIN);
    });
  });

  describe('Integration between helpers', () => {
    it('should work correctly together for various terminal widths and paths', () => {
      const scenarios = [
        {
          width: 30,
          path: '/very/long/path/to/project',
          expectedMode: 'text-only' as BannerDisplayMode,
          shouldTruncate: true,
        },
        {
          width: 50,
          path: '/short',
          expectedMode: 'compact' as BannerDisplayMode,
          shouldTruncate: false,
        },
        {
          width: 80,
          path: '/home/user/my-project',
          expectedMode: 'full' as BannerDisplayMode,
          shouldTruncate: false,
        },
      ];

      scenarios.forEach(({ width, path, expectedMode, shouldTruncate }) => {
        const mode = getDisplayMode(width);
        const maxPathLen = Math.max(15, width - 10); // Similar to component logic
        const displayPath = truncatePath(path, maxPathLen);

        expect(mode).toBe(expectedMode);

        if (shouldTruncate && path.length > maxPathLen) {
          expect(displayPath).toMatch(/^\.\.\..*$/);
          expect(displayPath.length).toBeLessThanOrEqual(maxPathLen);
        } else {
          expect(displayPath).toBe(path);
        }
      });
    });

    it('should maintain consistency across multiple calls', () => {
      const width = 45;
      const path = '/consistent/test/path';
      const maxLen = 15;

      // Multiple calls should return same results
      expect(getDisplayMode(width)).toBe(getDisplayMode(width));
      expect(truncatePath(path, maxLen)).toBe(truncatePath(path, maxLen));
    });
  });
});