import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner } from '../secret-scanner';
import { SecretPattern } from '../types';

describe('SecretScanner Comprehensive Tests', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('Pattern Compilation and Management', () => {
    it('should compile patterns on initialization', () => {
      const patterns = scanner.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every(p => typeof p.name === 'string')).toBe(true);
      expect(patterns.every(p => typeof p.pattern === 'string')).toBe(true);
      expect(patterns.every(p => ['critical', 'high', 'medium', 'low'].includes(p.severity))).toBe(true);
    });

    it('should recompile patterns when options are updated', () => {
      const initialCount = scanner.getPatterns().length;

      scanner.updateOptions({ includeBuiltInPatterns: false });
      expect(scanner.getPatterns()).toHaveLength(0);

      scanner.updateOptions({ includeBuiltInPatterns: true });
      expect(scanner.getPatterns().length).toBe(initialCount);
    });

    it('should handle pattern addition and removal', () => {
      const testPattern: SecretPattern = {
        name: 'Test Pattern Management',
        pattern: 'TEST_[0-9]{8}',
        severity: 'medium'
      };

      const initialCount = scanner.getPatterns().length;

      scanner.addPattern(testPattern);
      expect(scanner.getPatterns().length).toBe(initialCount + 1);

      const removed = scanner.removePattern('Test Pattern Management');
      expect(removed).toBe(true);
      expect(scanner.getPatterns().length).toBe(initialCount);

      const removedAgain = scanner.removePattern('Non Existent Pattern');
      expect(removedAgain).toBe(false);
    });
  });

  describe('Built-in Pattern Verification', () => {
    it('should include all expected built-in pattern types', () => {
      const patterns = scanner.getPatterns();
      const patternNames = patterns.map(p => p.name);

      const expectedTypes = [
        'AWS Access Key ID',
        'AWS Secret Access Key',
        'GitHub Token',
        'Generic API Key',
        'JWT Token',
        'Private Key Header',
        'Basic Auth Header',
        'Bearer Token'
      ];

      expectedTypes.forEach(type => {
        expect(patternNames).toContain(type);
      });
    });

    it('should have appropriate severity levels for built-in patterns', () => {
      const patterns = scanner.getPatterns();

      const criticalPatterns = patterns.filter(p => p.severity === 'critical');
      const highPatterns = patterns.filter(p => p.severity === 'high');
      const mediumPatterns = patterns.filter(p => p.severity === 'medium');

      expect(criticalPatterns.length).toBeGreaterThan(0);
      expect(highPatterns.length).toBeGreaterThan(0);
      expect(mediumPatterns.length).toBeGreaterThan(0);

      // Critical patterns should include private keys and production tokens
      expect(criticalPatterns.some(p => p.name.includes('Private Key'))).toBe(true);
    });
  });

  describe('Scanning Performance and Limits', () => {
    it('should respect maxLineLength configuration', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Length Test',
          pattern: 'FIND_ME',
          severity: 'low'
        }],
        maxLineLength: 50
      });

      const shortLine = 'This is short FIND_ME content';
      const longLine = 'x'.repeat(100) + 'FIND_ME' + 'x'.repeat(100);

      expect(testScanner.scan(shortLine)).toHaveLength(1);
      expect(testScanner.scan(longLine)).toHaveLength(0);
    });

    it('should handle large numbers of lines efficiently', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Performance Test',
          pattern: 'TARGET_LINE',
          severity: 'low'
        }]
      });

      const manyLines = Array.from({ length: 5000 }, (_, i) =>
        i === 2500 ? 'content TARGET_LINE here' : `line ${i} content`
      ).join('\n');

      const startTime = Date.now();
      const detections = testScanner.scan(manyLines);
      const duration = Date.now() - startTime;

      expect(detections).toHaveLength(1);
      expect(detections[0].lineNumber).toBe(2501);
      expect(duration).toBeLessThan(1000); // Should be reasonably fast
    });
  });

  describe('Detection Metadata Accuracy', () => {
    it('should provide accurate line and column numbers for multiline content', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Position Test',
          pattern: 'LOCATE_[A-Z]{4}',
          severity: 'medium'
        }]
      });

      const multilineContent = [
        'first line here',
        '  second line with some content',
        '    third line has LOCATE_ABCD in middle',
        'fourth line'
      ].join('\n');

      const detections = testScanner.scan(multilineContent);
      expect(detections).toHaveLength(1);
      expect(detections[0].lineNumber).toBe(3);
      expect(detections[0].columnNumber).toBeGreaterThan(15); // Should be in middle of line
    });

    it('should generate unique IDs for each detection', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'ID Test Pattern',
          pattern: 'UNIQUE_[0-9]+',
          severity: 'medium'
        }]
      });

      const content = [
        'config1=UNIQUE_123',
        'config2=UNIQUE_456',
        'config3=UNIQUE_789'
      ].join('\n');

      const detections = testScanner.scan(content);
      expect(detections).toHaveLength(3);

      const ids = detections.map(d => d.id);
      expect(new Set(ids).size).toBe(3); // All IDs should be unique
      expect(ids.every(id => id.startsWith('detect_'))).toBe(true);
    });

    it('should set detection timestamps appropriately', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Time Test',
          pattern: 'TIME_TEST',
          severity: 'low'
        }]
      });

      const before = new Date();
      const detections = testScanner.scan('value=TIME_TEST');
      const after = new Date();

      expect(detections).toHaveLength(1);
      expect(detections[0].detectedAt).toBeInstanceOf(Date);
      expect(detections[0].detectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(detections[0].detectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Context Extraction and Formatting', () => {
    it('should extract appropriate context around matches', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Context Test',
          pattern: 'CONTEXT_TARGET',
          severity: 'medium'
        }],
        contextLength: 8
      });

      const content = 'prefix_text_CONTEXT_TARGET_suffix_text';
      const detections = testScanner.scan(content);

      expect(detections).toHaveLength(1);
      expect(detections[0].context).toContain('prefix');
      expect(detections[0].context).toContain('CONTEXT_TARGET');
      expect(detections[0].context).toContain('suffix');
      expect(detections[0].context.length).toBeLessThan(content.length);
    });

    it('should handle context at line boundaries gracefully', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Boundary Test',
          pattern: 'BOUNDARY',
          severity: 'low'
        }],
        contextLength: 5
      });

      const testCases = [
        'BOUNDARY at start',
        'at end BOUNDARY',
        'BOUNDARY'
      ];

      testCases.forEach(testCase => {
        const detections = testScanner.scan(testCase);
        expect(detections).toHaveLength(1);
        expect(detections[0].context).toBeTruthy();
        expect(detections[0].context).toContain('BOUNDARY');
      });
    });
  });

  describe('Secret Type Classification', () => {
    it('should classify secret types based on pattern names', () => {
      const typeTestCases = [
        { namePattern: 'API Key Test', expectedType: 'api_key' },
        { namePattern: 'Token Pattern', expectedType: 'token' },
        { namePattern: 'Password Field', expectedType: 'password' },
        { namePattern: 'Private Key Format', expectedType: 'private_key' },
        { namePattern: 'Auth Credential', expectedType: 'auth_credential' },
        { namePattern: 'Secret Value', expectedType: 'secret' },
        { namePattern: 'Unknown Format', expectedType: 'credential' }
      ];

      typeTestCases.forEach(({ namePattern, expectedType }, index) => {
        const testScanner = new SecretScanner({
          includeBuiltInPatterns: false,
          customPatterns: [{
            name: namePattern,
            pattern: `TYPE_${index}`,
            severity: 'medium'
          }]
        });

        const detections = testScanner.scan(`test=TYPE_${index}`);
        expect(detections).toHaveLength(1);
        expect(detections[0].secretType).toBe(expectedType);
      });
    });
  });

  describe('Input Validation and Error Handling', () => {
    it('should handle various invalid inputs gracefully', () => {
      const invalidInputs = [
        null,
        undefined,
        123,
        {},
        [],
        true,
        false
      ];

      invalidInputs.forEach(input => {
        expect(() => scanner.scan(input as any)).not.toThrow();
        expect(scanner.scan(input as any)).toEqual([]);
      });
    });

    it('should handle empty and whitespace-only content', () => {
      const emptyTestCases = ['', '   ', '\n\n\n', '\t\t', ' \n \t \r '];

      emptyTestCases.forEach(content => {
        const detections = scanner.scan(content);
        expect(detections).toEqual([]);
      });
    });

    it('should handle scanner with no patterns', () => {
      const emptyScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: []
      });

      expect(emptyScanner.getPatterns()).toHaveLength(0);
      expect(emptyScanner.scan('any content here')).toHaveLength(0);
    });
  });

  describe('Configuration Options', () => {
    it('should allow disabling built-in patterns', () => {
      const noBuiltInsScanner = new SecretScanner({
        includeBuiltInPatterns: false
      });

      expect(noBuiltInsScanner.getPatterns()).toHaveLength(0);
    });

    it('should merge custom patterns with built-ins when enabled', () => {
      const customPattern: SecretPattern = {
        name: 'Custom Test Pattern',
        pattern: 'CUSTOM_[0-9]+',
        severity: 'high'
      };

      const mergedScanner = new SecretScanner({
        includeBuiltInPatterns: true,
        customPatterns: [customPattern]
      });

      const patterns = mergedScanner.getPatterns();
      const builtInCount = new SecretScanner().getPatterns().length;

      expect(patterns.length).toBe(builtInCount + 1);
      expect(patterns.some(p => p.name === 'Custom Test Pattern')).toBe(true);
      expect(patterns.some(p => p.name === 'AWS Access Key ID')).toBe(true);
    });

    it('should respect contextLength configuration', () => {
      const shortContextScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Context Length Test',
          pattern: 'CTX_TEST',
          severity: 'medium'
        }],
        contextLength: 3
      });

      const content = 'long_prefix_CTX_TEST_long_suffix';
      const detections = shortContextScanner.scan(content);

      expect(detections).toHaveLength(1);
      expect(detections[0].context.length).toBeLessThan(content.length);
      expect(detections[0].context).toContain('CTX_TEST');
    });
  });

  describe('Multi-pattern Scenarios', () => {
    it('should detect multiple different patterns in the same content', () => {
      const multiPatternScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [
          {
            name: 'Pattern A',
            pattern: 'FIND_A_[0-9]+',
            severity: 'high'
          },
          {
            name: 'Pattern B',
            pattern: 'FIND_B_[A-Z]+',
            severity: 'medium'
          }
        ]
      });

      const content = 'config1=FIND_A_123 and config2=FIND_B_XYZ';
      const detections = multiPatternScanner.scan(content);

      expect(detections).toHaveLength(2);

      const detectionA = detections.find(d => d.patternName === 'Pattern A');
      const detectionB = detections.find(d => d.patternName === 'Pattern B');

      expect(detectionA).toBeDefined();
      expect(detectionB).toBeDefined();
      expect(detectionA?.severity).toBe('high');
      expect(detectionB?.severity).toBe('medium');
    });
  });
});