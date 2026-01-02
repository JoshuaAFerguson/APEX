import { SecretScanner, SecretPattern } from './scanner';
import { SecretFinding } from '@apexcli/core';

describe('SecretScanner', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('constructor', () => {
    it('should create scanner with default configuration', () => {
      const testScanner = new SecretScanner();
      expect(testScanner.getPatterns().length).toBeGreaterThan(0);
    });

    it('should create scanner without built-in patterns when disabled', () => {
      const testScanner = new SecretScanner({ includeBuiltInPatterns: false });
      expect(testScanner.getPatterns()).toHaveLength(0);
    });

    it('should add custom patterns', () => {
      const customPattern: SecretPattern = {
        name: 'test-pattern',
        regex: /test-\w+-\d+/g,
        secretType: 'test-type',
        confidence: 0.8,
        description: 'Test pattern for unit testing',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      expect(testScanner.getPatterns()).toHaveLength(1);
      expect(testScanner.getPatterns()[0]).toEqual(customPattern);
    });
  });

  describe('scan method API', () => {
    it('should return empty array for normal text content', () => {
      const content = 'This is just normal text content\nwith multiple lines\nbut no sensitive data';
      const findings = scanner.scan(content, 'test.txt');
      expect(findings).toEqual([]);
    });

    it('should accept file path parameter', () => {
      const content = 'normal content';
      const findings = scanner.scan(content, 'path/to/file.txt');
      expect(Array.isArray(findings)).toBe(true);
    });

    it('should default file path to "unknown" when not provided', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'test-match',
          regex: /special-test-value-999/g,
          secretType: 'test',
          confidence: 0.9,
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'config=special-test-value-999';
      const findings = testScanner.scan(content);

      expect(findings).toHaveLength(1);
      expect(findings[0].file).toBe('unknown');
    });

    it('should track line numbers correctly', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'test-match',
          regex: /special-test-value-999/g,
          secretType: 'test',
          confidence: 0.9,
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = `Line 1: normal content
Line 2: config=special-test-value-999
Line 3: more content`;

      const findings = testScanner.scan(content, 'test.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(2);
    });

    it('should track column positions correctly', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'test-match',
          regex: /special-test-value-999/g,
          secretType: 'test',
          confidence: 0.9,
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'prefix special-test-value-999 suffix';
      const findings = testScanner.scan(content, 'test.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].column).toBe(8); // 1-based indexing
      expect(findings[0].endColumn).toBe(29);
    });
  });

  describe('masking functionality', () => {
    it('should mask values by default', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'test-match',
          regex: /special-test-value-123456789/g,
          secretType: 'test',
          confidence: 0.9,
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'data=special-test-value-123456789';
      const findings = testScanner.scan(content, 'test.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].match).not.toBe('special-test-value-123456789');
      expect(findings[0].match).toContain('*');
    });

    it('should not mask values when masking is disabled', () => {
      const testScanner = new SecretScanner({
        maskSecrets: false,
        customPatterns: [{
          name: 'test-match',
          regex: /special-test-value-123456789/g,
          secretType: 'test',
          confidence: 0.9,
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'data=special-test-value-123456789';
      const findings = testScanner.scan(content, 'test.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].match).toBe('special-test-value-123456789');
    });
  });

  describe('configuration options', () => {
    it('should respect maxLineLength configuration', () => {
      const testScanner = new SecretScanner({
        maxLineLength: 10,
        customPatterns: [{
          name: 'test-match',
          regex: /test/g,
          secretType: 'test',
          confidence: 0.9,
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const longLine = 'this is a very long line that exceeds the max length and contains test';
      const findings = testScanner.scan(longLine, 'test.txt');

      expect(findings).toHaveLength(0); // Should skip long lines
    });

    it('should include context around matches', () => {
      const testScanner = new SecretScanner({
        contextLength: 5,
        customPatterns: [{
          name: 'test-match',
          regex: /MATCH/g,
          secretType: 'test',
          confidence: 0.9,
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'prefix MATCH suffix';
      const findings = testScanner.scan(content, 'test.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].context).toBeDefined();
      expect(findings[0].context).toContain('MATCH');
    });
  });

  describe('pattern management', () => {
    it('should allow adding patterns dynamically', () => {
      const initialCount = scanner.getPatterns().length;

      const newPattern: SecretPattern = {
        name: 'dynamic-pattern',
        regex: /dynamic-\w+/g,
        secretType: 'dynamic',
        confidence: 0.7,
        description: 'Dynamically added pattern',
      };

      scanner.addPattern(newPattern);
      expect(scanner.getPatterns()).toHaveLength(initialCount + 1);
    });

    it('should allow removing patterns by name', () => {
      // First add a pattern to remove
      const testPattern: SecretPattern = {
        name: 'removable-pattern',
        regex: /removable-\w+/g,
        secretType: 'removable',
        confidence: 0.7,
        description: 'Pattern to be removed',
      };

      scanner.addPattern(testPattern);
      const countAfterAdd = scanner.getPatterns().length;

      scanner.removePattern('removable-pattern');
      expect(scanner.getPatterns()).toHaveLength(countAfterAdd - 1);
    });
  });

  describe('built-in patterns', () => {
    it('should have built-in patterns available', () => {
      const patterns = scanner.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);

      // Check that built-in patterns have required properties
      patterns.forEach(pattern => {
        expect(pattern.name).toBeDefined();
        expect(pattern.regex).toBeInstanceOf(RegExp);
        expect(pattern.secretType).toBeDefined();
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
        expect(pattern.description).toBeDefined();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty content gracefully', () => {
      const findings = scanner.scan('', 'test.txt');
      expect(findings).toEqual([]);
    });

    it('should handle whitespace-only content', () => {
      const findings = scanner.scan('   \n\t  \n   ', 'test.txt');
      expect(findings).toEqual([]);
    });

    it('should handle special characters without errors', () => {
      const content = 'config={"value":"test","symbol":"🔑"}';
      const findings = scanner.scan(content, 'test.txt');
      expect(Array.isArray(findings)).toBe(true);
    });
  });

  describe('finding structure', () => {
    it('should return findings with correct structure', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'structure-test',
          regex: /TESTPATTERN123/g,
          secretType: 'test-secret',
          confidence: 0.85,
          description: 'Test pattern for structure validation',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'value=TESTPATTERN123';
      const findings = testScanner.scan(content, 'example.txt');

      expect(findings).toHaveLength(1);

      const finding = findings[0];
      expect(finding).toHaveProperty('file', 'example.txt');
      expect(finding).toHaveProperty('line', 1);
      expect(finding).toHaveProperty('column');
      expect(finding).toHaveProperty('endColumn');
      expect(finding).toHaveProperty('secretType', 'test-secret');
      expect(finding).toHaveProperty('match');
      expect(finding).toHaveProperty('confidence', 0.85);
      expect(finding).toHaveProperty('patternName', 'structure-test');
      expect(finding).toHaveProperty('context');

      expect(typeof finding.column).toBe('number');
      expect(typeof finding.endColumn).toBe('number');
      expect(finding.endColumn).toBeGreaterThan(finding.column);
    });
  });
});