import { describe, it, expect } from 'vitest';
import { truncateToolOutput, type TruncateOptions, type TruncateResult } from '../utils';

describe('truncateToolOutput', () => {
  describe('basic functionality', () => {
    it('should return input unchanged when under limit', () => {
      const input = 'This is a short string';
      const result = truncateToolOutput(input, { maxLength: 100 });

      expect(result).toEqual({
        output: input,
        truncated: false,
        originalLength: input.length,
        truncatedLength: input.length,
      });
    });

    it('should truncate long text with default options', () => {
      const input = 'A'.repeat(15000);
      const result = truncateToolOutput(input);

      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(15000);
      expect(result.output).toMatch(/\.\.\..*\[truncated\]$/);
      expect(result.truncatedLength).toBeLessThanOrEqual(10000);
    });

    it('should handle null and undefined input', () => {
      const resultNull = truncateToolOutput(null as any);
      const resultUndefined = truncateToolOutput(undefined as any);
      const resultEmpty = truncateToolOutput('');

      expect(resultNull.output).toBe('');
      expect(resultNull.truncated).toBe(false);

      expect(resultUndefined.output).toBe('');
      expect(resultUndefined.truncated).toBe(false);

      expect(resultEmpty.output).toBe('');
      expect(resultEmpty.truncated).toBe(false);
    });
  });

  describe('configuration options', () => {
    it('should respect custom maxLength', () => {
      const input = 'A'.repeat(1000);
      const result = truncateToolOutput(input, { maxLength: 500 });

      expect(result.truncated).toBe(true);
      expect(result.truncatedLength).toBeLessThanOrEqual(500);
    });

    it('should use custom suffix', () => {
      const input = 'A'.repeat(1000);
      const customSuffix = '... [CUSTOM]';
      const result = truncateToolOutput(input, { maxLength: 100, suffix: customSuffix });

      expect(result.output).toEndWith(customSuffix);
      expect(result.truncated).toBe(true);
    });

    it('should disable JSON preservation when preserveJson is false', () => {
      const jsonInput = JSON.stringify({ a: 1, b: 2, c: 3, d: 4, e: 5 });
      const longJsonInput = JSON.stringify({
        data: 'A'.repeat(1000),
        more: 'B'.repeat(1000),
      });

      const result = truncateToolOutput(longJsonInput, {
        maxLength: 100,
        preserveJson: false,
      });

      expect(result.truncated).toBe(true);
      expect(result.output).not.toMatch(/^\{.*\}$/s);
      expect(result.output).toEndWith('... [truncated]');
    });

    it('should disable word boundary when wordBoundary is false', () => {
      const input = 'word1 word2 word3 word4 word5 ' + 'A'.repeat(1000);
      const result = truncateToolOutput(input, {
        maxLength: 100,
        wordBoundary: false,
      });

      expect(result.truncated).toBe(true);
      // Should not end at a space
      expect(result.output).not.toMatch(/ \.\.\./);
    });
  });

  describe('word boundary truncation', () => {
    it('should truncate at word boundaries when possible', () => {
      const input = 'This is a very long sentence with many words that should be truncated at word boundaries when possible.';
      const result = truncateToolOutput(input, { maxLength: 50, wordBoundary: true });

      expect(result.truncated).toBe(true);
      // Should end with a complete word before the suffix
      const withoutSuffix = result.output.replace('... [truncated]', '').trim();
      expect(withoutSuffix).not.toMatch(/\w+$/); // Should not end mid-word
    });

    it('should truncate at newline boundaries when available', () => {
      const input = 'Line 1\nLine 2\nThis is a very long line that would exceed the limit and should be truncated';
      const result = truncateToolOutput(input, { maxLength: 50, wordBoundary: true });

      expect(result.truncated).toBe(true);
      const withoutSuffix = result.output.replace('... [truncated]', '');
      // Should prefer newline boundary
      expect(withoutSuffix).toMatch(/\n$/);
    });

    it('should fall back to character truncation when word boundary is too far back', () => {
      const input = 'Word ' + 'A'.repeat(1000) + ' NextWord';
      const result = truncateToolOutput(input, { maxLength: 100, wordBoundary: true });

      expect(result.truncated).toBe(true);
      // Should not truncate back to just "Word" since that's too far back
      expect(result.output.replace('... [truncated]', '').length).toBeGreaterThan(80);
    });
  });

  describe('JSON structure preservation', () => {
    it('should preserve JSON array structure', () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`,
      }));

      const input = JSON.stringify(largeArray);
      const result = truncateToolOutput(input, { maxLength: 1000 });

      expect(result.truncated).toBe(true);
      expect(() => JSON.parse(result.output.replace('... [truncated]', ''))).not.toThrow();
      expect(result.output).toMatch(/\.\.\.\s*\d+\s*more items/);
    });

    it('should preserve JSON object structure', () => {
      const largeObject: Record<string, any> = {};
      for (let i = 0; i < 50; i++) {
        largeObject[`property${i}`] = `Value for property ${i}`.repeat(10);
      }

      const input = JSON.stringify(largeObject);
      const result = truncateToolOutput(input, { maxLength: 1000 });

      expect(result.truncated).toBe(true);
      expect(() => JSON.parse(result.output.replace('... [truncated]', ''))).not.toThrow();
      expect(result.output).toMatch(/\.\.\.\s*\d+\s*more properties/);
    });

    it('should handle nested JSON structures', () => {
      const nestedObject = {
        level1: {
          level2: {
            level3: {
              data: 'A'.repeat(500),
              moreData: 'B'.repeat(500),
            },
          },
        },
        otherData: 'C'.repeat(500),
      };

      const input = JSON.stringify(nestedObject);
      const result = truncateToolOutput(input, { maxLength: 500 });

      expect(result.truncated).toBe(true);
      // Should still be valid JSON after removing truncation suffix
      const cleanOutput = result.output.replace('... [truncated]', '');
      expect(() => JSON.parse(cleanOutput)).not.toThrow();
    });

    it('should handle JSON primitives', () => {
      const stringInput = JSON.stringify('A'.repeat(1000));
      const result = truncateToolOutput(stringInput, { maxLength: 100 });

      expect(result.truncated).toBe(true);
      expect(result.output).toEndWith('... [truncated]');
    });

    it('should fall back to regular truncation for malformed JSON', () => {
      const malformedJson = '{"invalid": json content}';
      const result = truncateToolOutput(malformedJson, { maxLength: 10 });

      expect(result.truncated).toBe(true);
      expect(result.output).toEndWith('... [truncated]');
    });

    it('should handle empty arrays and objects', () => {
      const emptyArray = JSON.stringify([]);
      const emptyObject = JSON.stringify({});

      const arrayResult = truncateToolOutput(emptyArray, { maxLength: 10 });
      const objectResult = truncateToolOutput(emptyObject, { maxLength: 10 });

      expect(arrayResult.truncated).toBe(false);
      expect(objectResult.truncated).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle exact maxLength boundary', () => {
      const input = 'A'.repeat(100);
      const result = truncateToolOutput(input, { maxLength: 100 });

      expect(result.truncated).toBe(false);
      expect(result.output).toBe(input);
    });

    it('should handle very small maxLength', () => {
      const input = 'This is a test';
      const result = truncateToolOutput(input, { maxLength: 5 });

      expect(result.truncated).toBe(true);
      expect(result.truncatedLength).toBeLessThanOrEqual(5);
    });

    it('should handle maxLength smaller than suffix', () => {
      const input = 'Test input';
      const longSuffix = '... [very long truncation suffix]';
      const result = truncateToolOutput(input, {
        maxLength: 10,
        suffix: longSuffix
      });

      expect(result.truncated).toBe(true);
      // Should still work even when suffix is longer than maxLength
      expect(result.output).toContain(longSuffix);
    });

    it('should handle unicode characters correctly', () => {
      const input = '🚀'.repeat(1000) + ' Unicode test';
      const result = truncateToolOutput(input, { maxLength: 100 });

      expect(result.truncated).toBe(true);
      // Should not break unicode characters
      expect(result.output).not.toMatch(/�/); // No replacement characters
    });

    it('should maintain trailing whitespace behavior consistently', () => {
      const input = 'Content with trailing spaces    ' + 'A'.repeat(1000);
      const result = truncateToolOutput(input, { maxLength: 100, wordBoundary: true });

      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(input.length);
    });
  });

  describe('performance considerations', () => {
    it('should handle very large JSON arrays efficiently', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
      const input = JSON.stringify(largeArray);

      const startTime = Date.now();
      const result = truncateToolOutput(input, { maxLength: 5000 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.truncated).toBe(true);
    });

    it('should handle very large text content efficiently', () => {
      const input = 'Line of text\n'.repeat(100000);

      const startTime = Date.now();
      const result = truncateToolOutput(input, { maxLength: 10000 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast for simple text
      expect(result.truncated).toBe(true);
    });
  });

  describe('return value structure', () => {
    it('should always return consistent TruncateResult structure', () => {
      const testCases = [
        'short text',
        'A'.repeat(1000),
        JSON.stringify({ test: 'data' }),
        '',
        null as any,
      ];

      for (const testCase of testCases) {
        const result = truncateToolOutput(testCase);

        expect(result).toHaveProperty('output');
        expect(result).toHaveProperty('truncated');
        expect(result).toHaveProperty('originalLength');
        expect(result).toHaveProperty('truncatedLength');

        expect(typeof result.output).toBe('string');
        expect(typeof result.truncated).toBe('boolean');
        expect(typeof result.originalLength).toBe('number');
        expect(typeof result.truncatedLength).toBe('number');
      }
    });

    it('should have consistent length calculations', () => {
      const input = 'A'.repeat(1000);
      const result = truncateToolOutput(input, { maxLength: 500 });

      if (result.truncated) {
        expect(result.originalLength).toBe(input.length);
        expect(result.truncatedLength).toBe(result.output.length);
        expect(result.truncatedLength).toBeLessThanOrEqual(500);
      }
    });
  });
});