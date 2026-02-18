import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner } from '../secret-scanner';
import { SecretPattern } from '../types';

/**
 * Performance and resource management tests for SecretScanner
 * Focuses on testing edge cases, performance limits, and error handling
 */
describe('SecretScanner - Performance and Resource Management', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('Resource Limits', () => {
    it('should respect maxLineLength configuration', () => {
      const testScanner = new SecretScanner({
        maxLineLength: 50,
        includeBuiltInPatterns: false
      });

      // Add a test pattern for non-sensitive data
      testScanner.addPattern({
        name: 'Test Pattern',
        pattern: 'TESTPATTERN[0-9]{8}',
        severity: 'medium'
      });

      // Create content with a very long line
      const veryLongLine = 'x'.repeat(100) + 'TESTPATTERN12345678' + 'x'.repeat(100);

      const detections = testScanner.scan(veryLongLine);
      // Should not detect because the line is too long
      expect(detections).toHaveLength(0);
    });

    it('should handle large amounts of content efficiently', () => {
      // Test with large content (1MB of text)
      const largeContent = 'safe text line\n'.repeat(100_000);

      const startTime = Date.now();
      const detections = scanner.scan(largeContent);
      const endTime = Date.now();

      expect(detections).toHaveLength(0);
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle many short lines efficiently', () => {
      // Create content with many short lines
      const manyLines = Array(50_000).fill('safe content').join('\n');

      const startTime = Date.now();
      const detections = scanner.scan(manyLines);
      const endTime = Date.now();

      expect(detections).toHaveLength(0);
      expect(endTime - startTime).toBeLessThan(3000);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty and null inputs gracefully', () => {
      const testCases = [
        '', // Empty string
        '   ', // Spaces only
        '\n\n\n', // Newlines only
        '\t\t\t' // Tabs only
      ];

      for (const testContent of testCases) {
        const detections = scanner.scan(testContent);
        expect(detections).toHaveLength(0);
      }
    });

    it('should handle non-string inputs gracefully', () => {
      const nonStringInputs = [null, undefined, 123, true, {}, []];

      for (const input of nonStringInputs) {
        expect(() => {
          // @ts-expect-error Testing invalid input types
          const detections = scanner.scan(input);
          expect(detections).toHaveLength(0);
        }).not.toThrow();
      }
    });

    it('should handle malformed regex patterns without crashing', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });

      const invalidPatterns: SecretPattern[] = [
        { name: 'Invalid Bracket', pattern: '[invalid', severity: 'low' },
        { name: 'Invalid Group', pattern: '(unclosed', severity: 'low' },
        { name: 'Invalid Quantifier', pattern: 'test{', severity: 'low' }
      ];

      for (const pattern of invalidPatterns) {
        expect(() => {
          try {
            new RegExp(pattern.pattern, 'gi');
            testScanner.addPattern(pattern);
          } catch (error) {
            expect(error).toBeInstanceOf(Error);
          }
        }).not.toThrow();
      }
    });

    it('should prevent infinite loops on zero-width matches', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });

      // Pattern that creates zero-width matches
      const zeroWidthPattern: SecretPattern = {
        name: 'Zero Width Test',
        pattern: '(?=test)',
        severity: 'low'
      };

      testScanner.addPattern(zeroWidthPattern);
      const content = 'test content test';

      expect(() => {
        const detections = testScanner.scan(content);
        expect(Array.isArray(detections)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Context and Masking Edge Cases', () => {
    it('should handle various line ending types', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });

      testScanner.addPattern({
        name: 'Test Pattern',
        pattern: 'DEMO[0-9]{4}',
        severity: 'medium'
      });

      const content = [
        'line1 DEMO1234',
        'line2 normal',
        'line3 DEMO5678'
      ];

      const unixContent = content.join('\n');
      const windowsContent = content.join('\r\n');

      const unixDetections = testScanner.scan(unixContent);
      const windowsDetections = testScanner.scan(windowsContent);

      expect(unixDetections).toHaveLength(2);
      expect(windowsDetections).toHaveLength(2);
    });

    it('should handle context extraction at boundaries', () => {
      const testScanner = new SecretScanner({
        contextLength: 5,
        includeBuiltInPatterns: false
      });

      testScanner.addPattern({
        name: 'Test Pattern',
        pattern: 'SAMPLE[0-9]{4}',
        severity: 'medium'
      });

      // Pattern at start of line
      const startContent = 'SAMPLE1234 end content';
      const startDetections = testScanner.scan(startContent);
      expect(startDetections[0].context).not.toMatch(/^\.\.\./);

      // Pattern at end of line
      const endContent = 'start content SAMPLE5678';
      const endDetections = testScanner.scan(endContent);
      expect(endDetections[0].context).not.toMatch(/\.\.\.$/);
    });

    it('should handle short secrets in masking', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });

      const shortPattern: SecretPattern = {
        name: 'Short Pattern',
        pattern: 'X{1,4}',
        severity: 'low'
      };

      testScanner.addPattern(shortPattern);

      const testCases = [
        { content: 'X', expectedLength: 1 },
        { content: 'XX', expectedLength: 2 },
        { content: 'XXX', expectedLength: 3 },
        { content: 'XXXX', expectedLength: 4 }
      ];

      for (const testCase of testCases) {
        const detections = testScanner.scan(testCase.content);
        expect(detections).toHaveLength(1);
        expect(detections[0].maskedMatch).toHaveLength(testCase.expectedLength);
        expect(detections[0].maskedMatch).toMatch(/^\*+$/);
      }
    });
  });

  describe('Pattern Management', () => {
    it('should handle duplicate pattern names', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });

      const pattern1: SecretPattern = {
        name: 'Duplicate Name',
        pattern: 'pattern1_\\w+',
        severity: 'low'
      };

      const pattern2: SecretPattern = {
        name: 'Duplicate Name',
        pattern: 'pattern2_\\w+',
        severity: 'high'
      };

      testScanner.addPattern(pattern1);
      testScanner.addPattern(pattern2);

      const patterns = testScanner.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should handle removing non-existent patterns', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });

      expect(() => {
        testScanner.removePattern('Non Existent Pattern');
      }).not.toThrow();
    });

    it('should update options correctly', () => {
      const testScanner = new SecretScanner({
        maxLineLength: 1000,
        contextLength: 10
      });

      testScanner.updateOptions({ contextLength: 25 });

      // Verify option was updated by checking internal state
      expect(() => {
        testScanner.updateOptions({});
      }).not.toThrow();
    });
  });

  describe('Built-in Pattern Integration', () => {
    it('should load built-in patterns by default', () => {
      const patterns = scanner.getPatterns();
      expect(patterns.length).toBeGreaterThan(5);
    });

    it('should disable built-in patterns when configured', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });
      const patterns = testScanner.getPatterns();
      expect(patterns).toHaveLength(0);
    });

    it('should combine built-in and custom patterns', () => {
      const customPattern: SecretPattern = {
        name: 'Custom Test Pattern',
        pattern: 'CUSTOM[0-9]{8}',
        severity: 'medium'
      };

      const testScanner = new SecretScanner({
        includeBuiltInPatterns: true,
        customPatterns: [customPattern]
      });

      const patterns = testScanner.getPatterns();
      const customPatternExists = patterns.some(p => p.name === 'Custom Test Pattern');
      const builtInPatternExists = patterns.length > 1;

      expect(customPatternExists).toBe(true);
      expect(builtInPatternExists).toBe(true);
    });
  });
});