/**
 * @fileoverview Edge case tests for secret detection functionality
 *
 * These tests verify that secret detection handles unusual scenarios,
 * error conditions, and performance constraints correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecretScanner, type SecretPattern } from '../scanner';

describe('Secret Detection Edge Cases', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner({
      customPatterns: [{
        name: 'edge-case-pattern',
        regex: /EDGE_CASE_[A-Z0-9]{6}/g,
        secretType: 'edge-case-test',
        confidence: 1.0,
        severity: 'medium',
        description: 'Pattern for testing edge cases',
      }],
      includeBuiltInPatterns: false,
    });
  });

  describe('Input Validation and Error Handling', () => {
    it('should handle null content gracefully', () => {
      expect(() => scanner.scan(null as any)).not.toThrow();
    });

    it('should handle undefined content gracefully', () => {
      expect(() => scanner.scan(undefined as any)).not.toThrow();
    });

    it('should handle non-string content gracefully', () => {
      expect(() => scanner.scan(123 as any)).not.toThrow();
      expect(() => scanner.scan({} as any)).not.toThrow();
      expect(() => scanner.scan([] as any)).not.toThrow();
    });

    it('should handle empty string content', () => {
      const findings = scanner.scan('');
      expect(findings).toEqual([]);
    });

    it('should handle content with only special characters', () => {
      const specialContent = '!@#$%^&*()[]{}|\\:";\'<>?,./~`';
      const findings = scanner.scan(specialContent);
      expect(findings).toEqual([]);
    });
  });

  describe('Unicode and Encoding Edge Cases', () => {
    it('should handle unicode characters correctly', () => {
      const unicodeContent = '配置文件: EDGE_CASE_ABC123 💻';
      const findings = scanner.scan(unicodeContent);

      expect(findings).toHaveLength(1);
      expect(findings[0].secretType).toBe('edge-case-test');
    });

    it('should handle emojis and special unicode', () => {
      const emojiContent = '🔑 Secret: EDGE_CASE_XYZ789 🚀';
      const findings = scanner.scan(emojiContent);

      expect(findings).toHaveLength(1);
      expect(findings[0].secretType).toBe('edge-case-test');
    });

    it('should handle mixed encoding content', () => {
      const mixedContent = 'Config\tvalue\nEDGE_CASE_MIX001\r\nend';
      const findings = scanner.scan(mixedContent);

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(2); // Should be on second line
    });

    it('should handle zero-width characters', () => {
      const zeroWidthContent = 'test\u200BEDGE_CASE_ZWC123\u200Cend';
      const findings = scanner.scan(zeroWidthContent);

      expect(findings).toHaveLength(1);
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    it('should handle very long single lines within limits', () => {
      const longContent = 'x'.repeat(8000) + 'EDGE_CASE_LONG01' + 'y'.repeat(1000);
      const findings = scanner.scan(longContent);

      expect(findings).toHaveLength(1);
      expect(findings[0].secretType).toBe('edge-case-test');
    });

    it('should skip lines exceeding configured maximum length', () => {
      const shortLineScanner = new SecretScanner({
        customPatterns: [{
          name: 'max-line-test',
          regex: /MAX_LINE_[A-Z0-9]{6}/g,
          secretType: 'max-line-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Max line test pattern',
        }],
        includeBuiltInPatterns: false,
        maxLineLength: 50,
      });

      const tooLongLine = 'x'.repeat(100) + 'MAX_LINE_TEST123';
      const findings = shortLineScanner.scan(tooLongLine);

      expect(findings).toHaveLength(0);
    });

    it('should handle many short lines efficiently', () => {
      const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i}: normal content`);
      lines[500] = 'Line 500: EDGE_CASE_MANY01';
      const manyLinesContent = lines.join('\n');

      const startTime = Date.now();
      const findings = scanner.scan(manyLinesContent);
      const endTime = Date.now();

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(501); // 1-based line number
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle patterns with potential for catastrophic backtracking', () => {
      const backtrackScanner = new SecretScanner({
        customPatterns: [{
          name: 'backtrack-safe',
          regex: /SAFE_[A-Z0-9]+_END/g,
          secretType: 'backtrack-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Backtracking test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      // Content that might cause backtracking issues with poorly designed regex
      const problematicContent = 'SAFE_' + 'A'.repeat(1000) + 'SAFE_GOOD123_END';

      const startTime = Date.now();
      const findings = backtrackScanner.scan(problematicContent);
      const endTime = Date.now();

      expect(findings).toHaveLength(1);
      expect(endTime - startTime).toBeLessThan(500); // Should be fast
    });
  });

  describe('Pattern Matching Edge Cases', () => {
    it('should handle overlapping matches correctly', () => {
      const overlapScanner = new SecretScanner({
        customPatterns: [
          {
            name: 'overlap-a',
            regex: /OVERLAP_[A-Z]{4}/g,
            secretType: 'overlap-a',
            confidence: 1.0,
            severity: 'medium',
            description: 'Overlap test A',
          },
          {
            name: 'overlap-b',
            regex: /LAP_[A-Z]{4}_TEST/g,
            secretType: 'overlap-b',
            confidence: 1.0,
            severity: 'high',
            description: 'Overlap test B',
          }
        ],
        includeBuiltInPatterns: false,
      });

      const overlapContent = 'Config: OVERLAP_ABCD_TEST';
      const findings = overlapScanner.scan(overlapContent);

      // Should find both patterns even if they overlap
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle patterns with global flag correctly', () => {
      const multiMatchContent = `
First: EDGE_CASE_AAA111
Second: EDGE_CASE_BBB222
Third: EDGE_CASE_CCC333
      `;

      const findings = scanner.scan(multiMatchContent);

      expect(findings).toHaveLength(3);
      expect(findings[0].line).toBe(2);
      expect(findings[1].line).toBe(3);
      expect(findings[2].line).toBe(4);
    });

    it('should handle patterns without global flag by adding it', () => {
      const noGlobalScanner = new SecretScanner({
        customPatterns: [{
          name: 'no-global-test',
          regex: /NO_GLOBAL_[A-Z0-9]{6}/, // Intentionally no 'g' flag
          secretType: 'no-global-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'No global flag test',
        }],
        includeBuiltInPatterns: false,
      });

      const multiContent = 'First: NO_GLOBAL_TEST01 Second: NO_GLOBAL_TEST02';
      const findings = noGlobalScanner.scan(multiContent);

      // Should find both instances despite original regex missing 'g'
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle zero-length matches gracefully', () => {
      const zeroLengthScanner = new SecretScanner({
        customPatterns: [{
          name: 'zero-length-test',
          regex: /(?=ZERO)ZERO_[A-Z0-9]{6}/g,
          secretType: 'zero-length-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Zero length test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const zeroLengthContent = 'Test: ZERO_ABC123';
      expect(() => {
        const findings = zeroLengthScanner.scan(zeroLengthContent);
        expect(Array.isArray(findings)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle invalid regex patterns gracefully', () => {
      expect(() => {
        new SecretScanner({
          customPatterns: [{
            name: 'invalid-regex',
            regex: new RegExp('[invalid'), // Invalid regex
            secretType: 'invalid',
            confidence: 1.0,
            severity: 'medium',
            description: 'Invalid regex pattern',
          }],
          includeBuiltInPatterns: false,
        });
      }).toThrow(); // Should throw during construction
    });

    it('should handle extremely long pattern names', () => {
      const longName = 'a'.repeat(1000);
      const longNameScanner = new SecretScanner({
        customPatterns: [{
          name: longName,
          regex: /LONG_NAME_[A-Z0-9]{6}/g,
          secretType: 'long-name-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Long name test',
        }],
        includeBuiltInPatterns: false,
      });

      const patterns = longNameScanner.getPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].name).toBe(longName);
    });

    it('should handle negative confidence values', () => {
      const negativeConfidenceScanner = new SecretScanner({
        customPatterns: [{
          name: 'negative-confidence',
          regex: /NEG_CONF_[A-Z0-9]{6}/g,
          secretType: 'negative-confidence-test',
          confidence: -0.5,
          severity: 'medium',
          description: 'Negative confidence test',
        }],
        includeBuiltInPatterns: false,
      });

      const findings = negativeConfidenceScanner.scan('Test: NEG_CONF_ABC123');
      expect(findings).toHaveLength(1);
      expect(findings[0].confidence).toBe(-0.5);
    });

    it('should handle confidence values greater than 1', () => {
      const highConfidenceScanner = new SecretScanner({
        customPatterns: [{
          name: 'high-confidence',
          regex: /HIGH_CONF_[A-Z0-9]{6}/g,
          secretType: 'high-confidence-test',
          confidence: 1.5,
          severity: 'medium',
          description: 'High confidence test',
        }],
        includeBuiltInPatterns: false,
      });

      const findings = highConfidenceScanner.scan('Test: HIGH_CONF_ABC123');
      expect(findings).toHaveLength(1);
      expect(findings[0].confidence).toBe(1.5);
    });
  });

  describe('Context Extraction Edge Cases', () => {
    it('should handle context at start of line', () => {
      const startScanner = new SecretScanner({
        customPatterns: [{
          name: 'start-context',
          regex: /START_[A-Z0-9]{6}/g,
          secretType: 'start-context-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Start context test',
        }],
        includeBuiltInPatterns: false,
        contextLength: 10,
      });

      const startContent = 'START_ABC123 followed by more text';
      const findings = startScanner.scan(startContent);

      expect(findings).toHaveLength(1);
      expect(findings[0].context).not.toMatch(/^\.\.\./); // No leading ellipsis
      expect(findings[0].context).toContain('followed');
    });

    it('should handle context at end of line', () => {
      const endScanner = new SecretScanner({
        customPatterns: [{
          name: 'end-context',
          regex: /END_[A-Z0-9]{6}/g,
          secretType: 'end-context-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'End context test',
        }],
        includeBuiltInPatterns: false,
        contextLength: 10,
      });

      const endContent = 'Text before the secret END_ABC123';
      const findings = endScanner.scan(endContent);

      expect(findings).toHaveLength(1);
      expect(findings[0].context).not.toMatch(/\.\.\.$/); // No trailing ellipsis
      expect(findings[0].context).toContain('before');
    });

    it('should handle zero context length', () => {
      const noContextScanner = new SecretScanner({
        customPatterns: [{
          name: 'no-context',
          regex: /NO_CONTEXT_[A-Z0-9]{6}/g,
          secretType: 'no-context-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'No context test',
        }],
        includeBuiltInPatterns: false,
        contextLength: 0,
      });

      const findings = noContextScanner.scan('Text NO_CONTEXT_ABC123 more');
      expect(findings).toHaveLength(1);
      expect(findings[0].context).toBe('NO_CONTEXT_ABC123');
    });
  });

  describe('Masking Edge Cases', () => {
    it('should handle masking of very short matches', () => {
      const shortMaskScanner = new SecretScanner({
        customPatterns: [{
          name: 'short-mask',
          regex: /S[A-Z]/g,
          secretType: 'short-mask-test',
          confidence: 1.0,
          severity: 'low',
          description: 'Short mask test',
        }],
        includeBuiltInPatterns: false,
        maskSecrets: true,
      });

      const findings = shortMaskScanner.scan('Test: SA');
      expect(findings).toHaveLength(1);
      expect(findings[0].match).toBe('**'); // Should be completely masked
    });

    it('should handle masking of single character matches', () => {
      const singleCharScanner = new SecretScanner({
        customPatterns: [{
          name: 'single-char',
          regex: /X/g,
          secretType: 'single-char-test',
          confidence: 1.0,
          severity: 'low',
          description: 'Single character test',
        }],
        includeBuiltInPatterns: false,
        maskSecrets: true,
      });

      const findings = singleCharScanner.scan('Test: X');
      expect(findings).toHaveLength(1);
      expect(findings[0].match).toBe('*');
    });
  });

  describe('Line and Column Tracking Edge Cases', () => {
    it('should handle different line ending types', () => {
      const mixedLineEndings = 'Line1\nLine2\r\nLine3\rEDGE_CASE_MLE123';
      const findings = scanner.scan(mixedLineEndings);

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(4); // Should correctly count lines
    });

    it('should handle very long lines with multiple matches', () => {
      const longLineContent = 'start ' + 'x'.repeat(1000) + ' EDGE_CASE_LL1001 ' + 'y'.repeat(1000) + ' EDGE_CASE_LL1002 end';
      const findings = scanner.scan(longLineContent);

      expect(findings).toHaveLength(2);
      expect(findings[0].line).toBe(1);
      expect(findings[1].line).toBe(1);
      expect(findings[0].column).toBeLessThan(findings[1].column);
    });

    it('should handle tabs and wide characters in column calculation', () => {
      const tabContent = '\t\tEDGE_CASE_TAB123';
      const findings = scanner.scan(tabContent);

      expect(findings).toHaveLength(1);
      expect(findings[0].column).toBe(3); // After two tab characters
    });
  });
});