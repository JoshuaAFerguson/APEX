import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner, type SecretPattern, type SecretScannerConfig } from './scanner';
import type { SecretFinding } from '@apexcli/core';

describe('SecretScanner - Comprehensive Tests', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('Configuration Management', () => {
    it('should handle all configuration options correctly', () => {
      const customPattern: SecretPattern = {
        name: 'test-pattern',
        regex: /TEST_SECRET_\w{16}/g,
        secretType: 'test-secret',
        confidence: 0.9,
        description: 'Test pattern for validation',
      };

      const config: SecretScannerConfig = {
        customPatterns: [customPattern],
        includeBuiltInPatterns: true,
        maxLineLength: 1000,
        maskSecrets: false,
        contextLength: 15,
      };

      const testScanner = new SecretScanner(config);
      const patterns = testScanner.getPatterns();

      expect(patterns.length).toBeGreaterThan(1); // Built-in + custom
      expect(patterns.some(p => p.name === 'test-pattern')).toBe(true);
    });

    it('should allow configuration with empty custom patterns', () => {
      const config: SecretScannerConfig = {
        customPatterns: [],
        includeBuiltInPatterns: true,
      };

      const testScanner = new SecretScanner(config);
      const patterns = testScanner.getPatterns();

      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should handle undefined configuration gracefully', () => {
      const testScanner = new SecretScanner(undefined);
      expect(testScanner.getPatterns().length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Detection Accuracy', () => {
    it('should detect multiple patterns in single content', () => {
      const customPatterns: SecretPattern[] = [
        {
          name: 'pattern-a',
          regex: /PATTERN_A_\w{8}/g,
          secretType: 'type-a',
          confidence: 0.8,
          description: 'Pattern A',
        },
        {
          name: 'pattern-b',
          regex: /PATTERN_B_\d{8}/g,
          secretType: 'type-b',
          confidence: 0.9,
          description: 'Pattern B',
        },
      ];

      const testScanner = new SecretScanner({
        customPatterns,
        includeBuiltInPatterns: false,
      });

      const content = 'config: PATTERN_A_abcd1234 and PATTERN_B_12345678';
      const findings = testScanner.scan(content, 'test.txt');

      expect(findings).toHaveLength(2);
      expect(findings.some(f => f.secretType === 'type-a')).toBe(true);
      expect(findings.some(f => f.secretType === 'type-b')).toBe(true);
    });

    it('should handle overlapping pattern matches', () => {
      const customPatterns: SecretPattern[] = [
        {
          name: 'broad-pattern',
          regex: /secret_\w+/g,
          secretType: 'broad',
          confidence: 0.7,
          description: 'Broad pattern',
        },
        {
          name: 'specific-pattern',
          regex: /secret_key_\w+/g,
          secretType: 'specific',
          confidence: 0.9,
          description: 'Specific pattern',
        },
      ];

      const testScanner = new SecretScanner({
        customPatterns,
        includeBuiltInPatterns: false,
      });

      const content = 'value: secret_key_abc123';
      const findings = testScanner.scan(content, 'overlap.txt');

      expect(findings.length).toBeGreaterThanOrEqual(1);
      // Both patterns should match the same text
    });

    it('should respect pattern confidence levels', () => {
      const customPattern: SecretPattern = {
        name: 'confidence-test',
        regex: /CONFIDENCE_TEST_\w{6}/g,
        secretType: 'confidence-type',
        confidence: 0.75,
        description: 'Confidence test pattern',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = 'test: CONFIDENCE_TEST_abc123';
      const findings = testScanner.scan(content, 'confidence.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].confidence).toBe(0.75);
    });
  });

  describe('Line and Column Tracking', () => {
    it('should track positions correctly in multi-line content', () => {
      const customPattern: SecretPattern = {
        name: 'position-test',
        regex: /POSITION_TEST_\w{4}/g,
        secretType: 'position',
        confidence: 0.8,
        description: 'Position tracking test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = `First line of content
Second line with POSITION_TEST_abcd here
Third line continues`;

      const findings = testScanner.scan(content, 'multiline.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(2);
      expect(findings[0].column).toBe(18); // Position in the line
      expect(findings[0].endColumn).toBeGreaterThan(findings[0].column);
    });

    it('should handle indented content correctly', () => {
      const customPattern: SecretPattern = {
        name: 'indent-test',
        regex: /INDENT_TEST_\w{4}/g,
        secretType: 'indent',
        confidence: 0.8,
        description: 'Indentation test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = '    indented: INDENT_TEST_xyz9';
      const findings = testScanner.scan(content, 'indented.yaml');

      expect(findings).toHaveLength(1);
      expect(findings[0].column).toBe(15); // After indentation and field name
    });

    it('should track multiple matches on same line', () => {
      const customPattern: SecretPattern = {
        name: 'multi-test',
        regex: /MULTI_\w{4}/g,
        secretType: 'multi',
        confidence: 0.8,
        description: 'Multiple matches test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = 'first: MULTI_abc1 second: MULTI_xyz9';
      const findings = testScanner.scan(content, 'multiple.txt');

      expect(findings).toHaveLength(2);
      expect(findings[0].line).toBe(1);
      expect(findings[1].line).toBe(1);
      expect(findings[0].column).toBeLessThan(findings[1].column);
    });
  });

  describe('Masking Behavior', () => {
    it('should mask secrets correctly with default settings', () => {
      const customPattern: SecretPattern = {
        name: 'mask-test',
        regex: /MASK_TEST_\w{12}/g,
        secretType: 'maskable',
        confidence: 0.8,
        description: 'Masking test pattern',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
        maskSecrets: true,
      });

      const content = 'secret: MASK_TEST_abcdef123456';
      const findings = testScanner.scan(content, 'masked.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].match).not.toBe('MASK_TEST_abcdef123456');
      expect(findings[0].match).toContain('*');
      // Should show first and last 2 characters
      expect(findings[0].match).toMatch(/^MA.*56$/);
    });

    it('should handle short secrets in masking', () => {
      const customPattern: SecretPattern = {
        name: 'short-test',
        regex: /SHORT_\w{2}/g,
        secretType: 'short',
        confidence: 0.8,
        description: 'Short secret test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
        maskSecrets: true,
      });

      const content = 'value: SHORT_ab';
      const findings = testScanner.scan(content, 'short.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].match).toBe('********'); // All asterisks for short secrets
    });

    it('should not mask when masking is disabled', () => {
      const customPattern: SecretPattern = {
        name: 'no-mask-test',
        regex: /NO_MASK_\w{8}/g,
        secretType: 'unmasked',
        confidence: 0.8,
        description: 'No masking test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
        maskSecrets: false,
      });

      const content = 'plain: NO_MASK_abcd1234';
      const findings = testScanner.scan(content, 'unmasked.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].match).toBe('NO_MASK_abcd1234');
      expect(findings[0].match).not.toContain('*');
    });
  });

  describe('Context Extraction', () => {
    it('should extract context with default length', () => {
      const customPattern: SecretPattern = {
        name: 'context-test',
        regex: /CONTEXT_TEST_\w{6}/g,
        secretType: 'context',
        confidence: 0.8,
        description: 'Context extraction test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = 'This is some prefix text CONTEXT_TEST_abc123 and some suffix text';
      const findings = testScanner.scan(content, 'context.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].context).toBeDefined();
      expect(findings[0].context).toContain('CONTEXT_TEST_abc123');
      expect(findings[0].context).toContain('prefix');
      expect(findings[0].context).toContain('suffix');
    });

    it('should truncate context with ellipsis when needed', () => {
      const customPattern: SecretPattern = {
        name: 'ellipsis-test',
        regex: /ELLIPSIS_\w{4}/g,
        secretType: 'ellipsis',
        confidence: 0.8,
        description: 'Ellipsis test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
        contextLength: 5,
      });

      const longPrefix = 'a'.repeat(50);
      const longSuffix = 'z'.repeat(50);
      const content = `${longPrefix}ELLIPSIS_test${longSuffix}`;
      const findings = testScanner.scan(content, 'ellipsis.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].context).toContain('...');
    });

    it('should respect custom context length', () => {
      const customPattern: SecretPattern = {
        name: 'custom-context-test',
        regex: /CUSTOM_CONTEXT_\w{4}/g,
        secretType: 'custom-context',
        confidence: 0.8,
        description: 'Custom context length test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
        contextLength: 10,
      });

      const content = '1234567890CUSTOM_CONTEXT_test1234567890';
      const findings = testScanner.scan(content, 'custom-context.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].context).toBeDefined();
      // Context should include 10 characters before and after
      expect(findings[0].context!.length).toBeGreaterThan(20);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle completely empty input', () => {
      const findings = scanner.scan('', 'empty.txt');
      expect(findings).toEqual([]);
    });

    it('should handle whitespace-only content', () => {
      const whitespaceContent = '   \n\t\r\n   \n\t  ';
      const findings = scanner.scan(whitespaceContent, 'whitespace.txt');
      expect(findings).toEqual([]);
    });

    it('should skip lines exceeding maxLineLength', () => {
      const customPattern: SecretPattern = {
        name: 'length-test',
        regex: /LENGTH_TEST_\w{4}/g,
        secretType: 'length',
        confidence: 0.8,
        description: 'Line length test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
        maxLineLength: 20,
      });

      const shortLine = 'LENGTH_TEST_abc1';
      const longLine = 'This is a very long line that exceeds the limit and contains LENGTH_TEST_xyz9';

      const findings1 = testScanner.scan(shortLine, 'short.txt');
      const findings2 = testScanner.scan(longLine, 'long.txt');

      expect(findings1).toHaveLength(1); // Should find in short line
      expect(findings2).toHaveLength(0); // Should skip long line
    });

    it('should handle special characters and unicode', () => {
      const customPattern: SecretPattern = {
        name: 'unicode-test',
        regex: /UNICODE_\w{4}/g,
        secretType: 'unicode',
        confidence: 0.8,
        description: 'Unicode test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = '🔐 secret: UNICODE_test 🗝️';
      const findings = testScanner.scan(content, 'unicode.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].secretType).toBe('unicode');
    });

    it('should handle regex patterns with global flag correctly', () => {
      const customPattern: SecretPattern = {
        name: 'global-flag-test',
        regex: /GLOBAL_\w{4}/g, // Already has global flag
        secretType: 'global',
        confidence: 0.8,
        description: 'Global flag test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = 'first: GLOBAL_abc1 second: GLOBAL_xyz9';
      const findings = testScanner.scan(content, 'global.txt');

      expect(findings).toHaveLength(2); // Should find both matches
    });

    it('should handle regex patterns without global flag', () => {
      const customPattern: SecretPattern = {
        name: 'no-global-test',
        regex: /NO_GLOBAL_\w{4}/, // No global flag
        secretType: 'no-global',
        confidence: 0.8,
        description: 'No global flag test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = 'first: NO_GLOBAL_abc1 second: NO_GLOBAL_xyz9';
      const findings = testScanner.scan(content, 'no-global.txt');

      expect(findings).toHaveLength(2); // Should still find both matches
    });

    it('should prevent infinite loops on zero-length matches', () => {
      const customPattern: SecretPattern = {
        name: 'zero-length-test',
        regex: /(?=ZERO_LENGTH)/g, // Lookahead can cause zero-length matches
        secretType: 'zero-length',
        confidence: 0.8,
        description: 'Zero length match test',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = 'test: ZERO_LENGTH content';

      // This should not hang or cause infinite loop
      expect(() => {
        const findings = testScanner.scan(content, 'zero-length.txt');
        expect(Array.isArray(findings)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Dynamic Pattern Management', () => {
    it('should allow adding multiple patterns dynamically', () => {
      const initialCount = scanner.getPatterns().length;

      const pattern1: SecretPattern = {
        name: 'dynamic-1',
        regex: /DYNAMIC_1_\w{4}/g,
        secretType: 'dynamic-type-1',
        confidence: 0.8,
        description: 'Dynamic pattern 1',
      };

      const pattern2: SecretPattern = {
        name: 'dynamic-2',
        regex: /DYNAMIC_2_\w{4}/g,
        secretType: 'dynamic-type-2',
        confidence: 0.9,
        description: 'Dynamic pattern 2',
      };

      scanner.addPattern(pattern1);
      scanner.addPattern(pattern2);

      expect(scanner.getPatterns()).toHaveLength(initialCount + 2);

      const content = 'test: DYNAMIC_1_abc1 and DYNAMIC_2_xyz9';
      const findings = scanner.scan(content, 'dynamic.txt');

      expect(findings.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle removing non-existent patterns gracefully', () => {
      const initialCount = scanner.getPatterns().length;

      scanner.removePattern('non-existent-pattern');

      expect(scanner.getPatterns()).toHaveLength(initialCount); // Should remain unchanged
    });

    it('should allow removing and re-adding patterns', () => {
      const testPattern: SecretPattern = {
        name: 'removable-addable',
        regex: /REMOVABLE_\w{4}/g,
        secretType: 'removable',
        confidence: 0.8,
        description: 'Removable and addable pattern',
      };

      // Add pattern
      scanner.addPattern(testPattern);
      const countAfterAdd = scanner.getPatterns().length;
      expect(scanner.getPatterns().some(p => p.name === 'removable-addable')).toBe(true);

      // Remove pattern
      scanner.removePattern('removable-addable');
      expect(scanner.getPatterns()).toHaveLength(countAfterAdd - 1);
      expect(scanner.getPatterns().some(p => p.name === 'removable-addable')).toBe(false);

      // Re-add pattern
      scanner.addPattern(testPattern);
      expect(scanner.getPatterns()).toHaveLength(countAfterAdd);
      expect(scanner.getPatterns().some(p => p.name === 'removable-addable')).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle moderately large content efficiently', () => {
      const customPattern: SecretPattern = {
        name: 'perf-test',
        regex: /PERF_TEST_\w{8}/g,
        secretType: 'performance',
        confidence: 0.8,
        description: 'Performance test pattern',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      // Generate content with 1000 lines
      const lines = [];
      for (let i = 0; i < 1000; i++) {
        if (i === 500) {
          lines.push('line with secret: PERF_TEST_abcd1234');
        } else {
          lines.push(`line ${i} with regular content that is somewhat long to test performance`);
        }
      }
      const content = lines.join('\n');

      const startTime = Date.now();
      const findings = testScanner.scan(content, 'large-content.txt');
      const duration = Date.now() - startTime;

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(501); // 1-based line number
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle content with many potential false positives', () => {
      const customPattern: SecretPattern = {
        name: 'false-positive-test',
        regex: /\b[A-Za-z0-9]{8}\b/g, // Broad pattern that might match many things
        secretType: 'broad-match',
        confidence: 0.5,
        description: 'Broad pattern for false positive testing',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = `
        function test() {
          const value1 = "abcd1234";
          const value2 = "efgh5678";
          const value3 = "ijkl9012";
          return value1 + value2 + value3;
        }
      `;

      const startTime = Date.now();
      const findings = testScanner.scan(content, 'broad-pattern.js');
      const duration = Date.now() - startTime;

      expect(findings.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Should still be fast
    });
  });

  describe('Finding Structure Validation', () => {
    it('should return findings with all required properties', () => {
      const customPattern: SecretPattern = {
        name: 'structure-validation',
        regex: /STRUCT_VALID_\w{6}/g,
        secretType: 'validation-test',
        confidence: 0.85,
        description: 'Structure validation test pattern',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const content = 'test_value: STRUCT_VALID_abc123';
      const findings = testScanner.scan(content, 'structure.txt');

      expect(findings).toHaveLength(1);

      const finding = findings[0];

      // Validate all required properties exist
      expect(finding).toHaveProperty('file');
      expect(finding).toHaveProperty('line');
      expect(finding).toHaveProperty('column');
      expect(finding).toHaveProperty('endColumn');
      expect(finding).toHaveProperty('secretType');
      expect(finding).toHaveProperty('match');
      expect(finding).toHaveProperty('confidence');
      expect(finding).toHaveProperty('patternName');
      expect(finding).toHaveProperty('context');

      // Validate property types
      expect(typeof finding.file).toBe('string');
      expect(typeof finding.line).toBe('number');
      expect(typeof finding.column).toBe('number');
      expect(typeof finding.endColumn).toBe('number');
      expect(typeof finding.secretType).toBe('string');
      expect(typeof finding.match).toBe('string');
      expect(typeof finding.confidence).toBe('number');
      expect(typeof finding.patternName).toBe('string');
      expect(typeof finding.context).toBe('string');

      // Validate property values
      expect(finding.file).toBe('structure.txt');
      expect(finding.line).toBeGreaterThan(0);
      expect(finding.column).toBeGreaterThan(0);
      expect(finding.endColumn).toBeGreaterThan(finding.column);
      expect(finding.secretType).toBe('validation-test');
      expect(finding.confidence).toBe(0.85);
      expect(finding.patternName).toBe('structure-validation');
      expect(finding.context).toContain('STRUCT_VALID_abc123');
    });

    it('should maintain consistent finding structure across different patterns', () => {
      const patterns: SecretPattern[] = [
        {
          name: 'pattern-type-a',
          regex: /TYPE_A_\w{4}/g,
          secretType: 'type-a',
          confidence: 0.7,
          description: 'Type A pattern',
        },
        {
          name: 'pattern-type-b',
          regex: /TYPE_B_\d{4}/g,
          secretType: 'type-b',
          confidence: 0.8,
          description: 'Type B pattern',
        },
      ];

      const testScanner = new SecretScanner({
        customPatterns: patterns,
        includeBuiltInPatterns: false,
      });

      const content = 'data: TYPE_A_test and TYPE_B_1234';
      const findings = testScanner.scan(content, 'consistency.txt');

      expect(findings).toHaveLength(2);

      // Both findings should have the same structure
      findings.forEach(finding => {
        expect(finding).toHaveProperty('file', 'consistency.txt');
        expect(finding).toHaveProperty('line', 1);
        expect(finding.column).toBeGreaterThan(0);
        expect(finding.endColumn).toBeGreaterThan(finding.column);
        expect(['type-a', 'type-b']).toContain(finding.secretType);
        expect(finding.match).toBeDefined();
        expect(finding.confidence).toBeGreaterThan(0);
        expect(['pattern-type-a', 'pattern-type-b']).toContain(finding.patternName);
        expect(finding.context).toBeDefined();
      });
    });
  });
});