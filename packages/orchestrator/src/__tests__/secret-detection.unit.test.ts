/**
 * @fileoverview Unit tests for secret detection functionality
 *
 * These tests focus on the SecretScanner class functionality in isolation,
 * testing pattern matching, configuration options, and scanning behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner, type SecretPattern } from '../scanner';
import type { SecretFinding, SecretSeverity } from '@apexcli/core';

describe('SecretScanner Unit Tests', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultScanner = new SecretScanner();
      const patterns = defaultScanner.getPatterns();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.name === 'aws-access-key')).toBe(true);
      expect(patterns.some(p => p.name === 'github-token')).toBe(true);
    });

    it('should support custom configuration options', () => {
      const customScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        maxLineLength: 5000,
        maskSecrets: false,
        contextLength: 10,
      });

      expect(customScanner.getPatterns()).toHaveLength(0);
    });

    it('should add custom patterns correctly', () => {
      const customPattern: SecretPattern = {
        name: 'custom-test-pattern',
        regex: /TEST_KEY_[A-Z0-9]{8}/g,
        secretType: 'test-key',
        confidence: 0.95,
        severity: 'high',
        description: 'Custom test pattern for unit testing',
      };

      const customScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      const patterns = customScanner.getPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0]).toEqual(customPattern);
    });

    it('should combine built-in and custom patterns', () => {
      const customPattern: SecretPattern = {
        name: 'unit-test-pattern',
        regex: /UNIT_TEST_[0-9]+/g,
        secretType: 'unit-test',
        confidence: 0.8,
        severity: 'medium',
        description: 'Unit test pattern',
      };

      const combinedScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: true,
      });

      const patterns = combinedScanner.getPatterns();
      expect(patterns.length).toBeGreaterThan(1);
      expect(patterns.some(p => p.name === 'unit-test-pattern')).toBe(true);
      expect(patterns.some(p => p.name === 'aws-access-key')).toBe(true);
    });
  });

  describe('Pattern Management', () => {
    it('should add patterns dynamically', () => {
      const initialCount = scanner.getPatterns().length;

      const newPattern: SecretPattern = {
        name: 'dynamic-test-pattern',
        regex: /DYNAMIC_[A-F0-9]{8}/g,
        secretType: 'dynamic-test',
        confidence: 0.9,
        severity: 'high',
        description: 'Dynamically added test pattern',
      };

      scanner.addPattern(newPattern);
      expect(scanner.getPatterns()).toHaveLength(initialCount + 1);
      expect(scanner.getPatterns().some(p => p.name === 'dynamic-test-pattern')).toBe(true);
    });

    it('should remove patterns by name', () => {
      const initialPatterns = scanner.getPatterns();
      const targetPattern = initialPatterns.find(p => p.name === 'aws-access-key');
      expect(targetPattern).toBeDefined();

      scanner.removePattern('aws-access-key');
      const updatedPatterns = scanner.getPatterns();

      expect(updatedPatterns.length).toBe(initialPatterns.length - 1);
      expect(updatedPatterns.some(p => p.name === 'aws-access-key')).toBe(false);
    });

    it('should handle removing non-existent patterns gracefully', () => {
      const initialCount = scanner.getPatterns().length;

      scanner.removePattern('non-existent-pattern');
      expect(scanner.getPatterns()).toHaveLength(initialCount);
    });
  });

  describe('Secret Detection with Test Patterns', () => {
    it('should detect test patterns correctly', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'test-secret',
          regex: /TEST_SECRET_[A-Z0-9]{8}/g,
          secretType: 'test-secret',
          confidence: 1.0,
          severity: 'high',
          description: 'Test secret pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'Configuration: TEST_SECRET_ABCD1234';
      const findings = testScanner.scan(content, 'test.env');

      expect(findings).toHaveLength(1);
      expect(findings[0].secretType).toBe('test-secret');
      expect(findings[0].severity).toBe('high');
      expect(findings[0].file).toBe('test.env');
      expect(findings[0].line).toBe(1);
    });

    it('should detect multiple secrets in same content', () => {
      const testScanner = new SecretScanner({
        customPatterns: [
          {
            name: 'test-key-a',
            regex: /KEY_A_[0-9]{4}/g,
            secretType: 'test-key-a',
            confidence: 1.0,
            severity: 'medium',
            description: 'Test key A',
          },
          {
            name: 'test-key-b',
            regex: /KEY_B_[A-Z]{4}/g,
            secretType: 'test-key-b',
            confidence: 1.0,
            severity: 'high',
            description: 'Test key B',
          }
        ],
        includeBuiltInPatterns: false,
      });

      const content = `
First: KEY_A_1234
Second: KEY_B_ABCD
      `;
      const findings = testScanner.scan(content);

      expect(findings).toHaveLength(2);
      const secretTypes = findings.map(f => f.secretType);
      expect(secretTypes).toContain('test-key-a');
      expect(secretTypes).toContain('test-key-b');
    });

    it('should handle multiline content correctly', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'multiline-test',
          regex: /MULTI_[0-9]{3}/g,
          secretType: 'multiline-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Multiline test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = `Line 1: Normal content
Line 2: Config MULTI_123
Line 3: More content
Line 4: Another MULTI_456`;

      const findings = testScanner.scan(content);

      expect(findings).toHaveLength(2);
      expect(findings[0].line).toBe(2);
      expect(findings[1].line).toBe(4);
    });
  });

  describe('Content Masking', () => {
    it('should mask secrets by default', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'mask-test',
          regex: /MASK_TEST_[A-Z0-9]{12}/g,
          secretType: 'mask-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Mask test pattern',
        }],
        includeBuiltInPatterns: false,
        maskSecrets: true,
      });

      const content = 'Secret: MASK_TEST_ABCD12345678';
      const findings = testScanner.scan(content);

      expect(findings).toHaveLength(1);
      const match = findings[0].match;
      expect(match).toContain('*');
      expect(match).not.toBe('MASK_TEST_ABCD12345678');
    });

    it('should not mask when configured to show full content', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'nomask-test',
          regex: /NOMASK_[A-Z]{4}/g,
          secretType: 'nomask-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'No mask test pattern',
        }],
        includeBuiltInPatterns: false,
        maskSecrets: false,
      });

      const content = 'Value: NOMASK_ABCD';
      const findings = testScanner.scan(content);

      expect(findings).toHaveLength(1);
      expect(findings[0].match).not.toContain('*');
      expect(findings[0].match).toBe('NOMASK_ABCD');
    });

    it('should mask short secrets completely', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'short-test',
          regex: /SHORT_(\w{3})/g,
          secretType: 'short-test',
          confidence: 1.0,
          severity: 'low',
          description: 'Short secret for testing',
        }],
        includeBuiltInPatterns: false,
        maskSecrets: true,
      });

      const content = 'SHORT_ABC';
      const findings = testScanner.scan(content);

      expect(findings).toHaveLength(1);
      expect(findings[0].match.length).toBeLessThanOrEqual(10); // Should be masked
    });
  });

  describe('Context Extraction', () => {
    it('should provide context around matches', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'context-test',
          regex: /CONTEXT_\w+/g,
          secretType: 'context-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Context test pattern',
        }],
        includeBuiltInPatterns: false,
        contextLength: 10,
      });

      const content = 'This is a long line with CONTEXT_TEST123 in the middle of it';
      const findings = testScanner.scan(content);

      expect(findings).toHaveLength(1);
      expect(findings[0].context).toContain('with');
      expect(findings[0].context).toContain('in');
    });

    it('should add ellipsis when context is truncated', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'ellipsis-test',
          regex: /ELLIPSIS_\w+/g,
          secretType: 'ellipsis-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Ellipsis test pattern',
        }],
        includeBuiltInPatterns: false,
        contextLength: 5,
      });

      const longContent = 'x'.repeat(50) + 'ELLIPSIS_TEST123' + 'y'.repeat(50);
      const findings = testScanner.scan(longContent);

      expect(findings).toHaveLength(1);
      expect(findings[0].context).toMatch(/^\.\.\./);
      expect(findings[0].context).toMatch(/\.\.\.$/);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should skip very long lines when configured', () => {
      const shortLineScanner = new SecretScanner({
        customPatterns: [{
          name: 'long-line-test',
          regex: /LONG_LINE_\w+/g,
          secretType: 'long-line-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Long line test pattern',
        }],
        includeBuiltInPatterns: false,
        maxLineLength: 50,
      });

      const longLine = 'x'.repeat(100) + 'LONG_LINE_TEST123';
      const findings = shortLineScanner.scan(longLine);

      // Should not find secrets in lines that exceed maxLineLength
      expect(findings).toHaveLength(0);
    });

    it('should handle empty content', () => {
      const findings = scanner.scan('');
      expect(findings).toEqual([]);
    });

    it('should handle content with only whitespace', () => {
      const findings = scanner.scan('   \n\t\n   ');
      expect(findings).toEqual([]);
    });

    it('should handle special characters in content', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'special-char-test',
          regex: /SPECIAL_\w{4}/g,
          secretType: 'special-char-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Special character test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'Config with émojis 🔑 and chars: SPECIAL_TEST end';
      const findings = testScanner.scan(content);

      expect(findings).toHaveLength(1);
      expect(findings[0].secretType).toBe('special-char-test');
    });

    it('should handle regex special characters in content', () => {
      const content = 'Pattern: .*+?[]{}()^$ end';
      expect(() => scanner.scan(content)).not.toThrow();
    });
  });

  describe('Column Position Tracking', () => {
    it('should track start and end column positions', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'column-test',
          regex: /COLUMN_\w{4}/g,
          secretType: 'column-test',
          confidence: 1.0,
          severity: 'medium',
          description: 'Column test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = '  COLUMN_TEST  ';
      const findings = testScanner.scan(content);

      expect(findings).toHaveLength(1);
      expect(findings[0].column).toBe(3); // 1-based, starts at position 2 + 1
      expect(findings[0].endColumn).toBeGreaterThan(findings[0].column);
    });
  });

  describe('Severity Classification', () => {
    it('should classify different secret types with appropriate severity', () => {
      const testScanner = new SecretScanner({
        customPatterns: [
          {
            name: 'critical-test',
            regex: /CRITICAL_\w{8}/g,
            secretType: 'critical-test',
            confidence: 1.0,
            severity: 'critical',
            description: 'Critical test pattern',
          },
          {
            name: 'high-test',
            regex: /HIGH_\w{8}/g,
            secretType: 'high-test',
            confidence: 1.0,
            severity: 'high',
            description: 'High test pattern',
          },
          {
            name: 'medium-test',
            regex: /MEDIUM_\w{8}/g,
            secretType: 'medium-test',
            confidence: 1.0,
            severity: 'medium',
            description: 'Medium test pattern',
          },
          {
            name: 'low-test',
            regex: /LOW_\w{8}/g,
            secretType: 'low-test',
            confidence: 1.0,
            severity: 'low',
            description: 'Low test pattern',
          }
        ],
        includeBuiltInPatterns: false,
      });

      const criticalContent = 'Config: CRITICAL_ABCD1234';
      const highContent = 'Value: HIGH_ABCD1234';
      const mediumContent = 'Setting: MEDIUM_ABCD1234';
      const lowContent = 'Info: LOW_ABCD1234';

      const criticalFindings = testScanner.scan(criticalContent);
      const highFindings = testScanner.scan(highContent);
      const mediumFindings = testScanner.scan(mediumContent);
      const lowFindings = testScanner.scan(lowContent);

      expect(criticalFindings[0]?.severity).toBe('critical');
      expect(highFindings[0]?.severity).toBe('high');
      expect(mediumFindings[0]?.severity).toBe('medium');
      expect(lowFindings[0]?.severity).toBe('low');
    });
  });

  describe('Confidence Levels', () => {
    it('should assign appropriate confidence levels to patterns', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'confidence-test',
          regex: /CONFIDENCE_\w{8}/g,
          secretType: 'confidence-test',
          confidence: 0.85,
          severity: 'medium',
          description: 'Confidence test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'Test: CONFIDENCE_ABCD1234';
      const findings = testScanner.scan(content);

      expect(findings).toHaveLength(1);
      expect(findings[0].confidence).toBe(0.85);
      expect(findings[0].confidence).toBeGreaterThan(0);
      expect(findings[0].confidence).toBeLessThanOrEqual(1.0);
    });
  });
});