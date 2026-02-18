import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner, type SecretScanPattern } from './scanner';
import type { SecretDetection, SecretPattern } from '@apexcli/core';

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
        pattern: 'test-\\w+-\\d+',
        severity: 'medium',
        description: 'Test pattern for unit testing',
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false,
      });

      expect(testScanner.getPatterns()).toHaveLength(1);
      expect(testScanner.getPatterns()[0].name).toBe('test-pattern');
      expect(testScanner.getPatterns()[0].secretType).toBe('test-pattern'); // secretType defaults to name
    });
  });

  describe('scan method API', () => {
    it('should return empty array for normal text content', () => {
      const content = 'This is just normal text content\nwith multiple lines\nbut no sensitive data';
      const detections = scanner.scan(content, 'test.txt');
      expect(detections).toEqual([]);
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
          pattern: 'special-test-value-999',
          severity: 'medium',
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'config=special-test-value-999';
      const detections = testScanner.scan(content);

      expect(detections).toHaveLength(1);
      expect(detections[0].filePath).toBe('unknown');
    });

    it('should track line numbers correctly', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'test-match',
          pattern: 'special-test-value-999',
          severity: 'medium',
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = `Line 1: normal content
Line 2: config=special-test-value-999
Line 3: more content`;

      const detections = testScanner.scan(content, 'test.txt');

      expect(detections).toHaveLength(1);
      expect(detections[0].lineNumber).toBe(2);
    });

    it('should track column positions correctly', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'test-match',
          pattern: 'special-test-value-999',
          severity: 'medium',
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'prefix special-test-value-999 suffix';
      const detections = testScanner.scan(content, 'test.txt');

      expect(detections).toHaveLength(1);
      expect(detections[0].columnNumber).toBe(8); // 1-based indexing (prefix = 6 chars + 1 space + 1 for 1-based = 8)
    });
  });

  describe('masking functionality', () => {
    it('should mask values by default', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'test-match',
          pattern: 'special-test-value-123456789',
          severity: 'medium',
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'data=special-test-value-123456789';
      const detections = testScanner.scan(content, 'test.txt');

      expect(detections).toHaveLength(1);
      expect(detections[0].maskedMatch).not.toBe('special-test-value-123456789');
      expect(detections[0].maskedMatch).toContain('*');
    });

    it('should not mask values when masking is disabled', () => {
      const testScanner = new SecretScanner({
        maskSecrets: false,
        customPatterns: [{
          name: 'test-match',
          pattern: 'special-test-value-123456789',
          severity: 'medium',
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'data=special-test-value-123456789';
      const detections = testScanner.scan(content, 'test.txt');

      expect(detections).toHaveLength(1);
      expect(detections[0].maskedMatch).toBe('special-test-value-123456789');
    });
  });

  describe('configuration options', () => {
    it('should respect maxLineLength configuration', () => {
      const testScanner = new SecretScanner({
        maxLineLength: 10,
        customPatterns: [{
          name: 'test-match',
          pattern: 'test',
          severity: 'medium',
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const longLine = 'this is a very long line that exceeds the max length and contains test';
      const detections = testScanner.scan(longLine, 'test.txt');

      expect(detections).toHaveLength(0); // Should skip long lines
    });

    it('should include context around matches', () => {
      const testScanner = new SecretScanner({
        contextLength: 5,
        customPatterns: [{
          name: 'test-match',
          pattern: 'MATCH',
          severity: 'medium',
          description: 'Test pattern',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'prefix MATCH suffix';
      const detections = testScanner.scan(content, 'test.txt');

      expect(detections).toHaveLength(1);
      expect(detections[0].context).toBeDefined();
      expect(detections[0].context).toContain('MATCH');
    });
  });

  describe('pattern management', () => {
    it('should allow adding patterns dynamically', () => {
      const initialCount = scanner.getPatterns().length;

      const newPattern: SecretPattern = {
        name: 'dynamic-pattern',
        pattern: 'dynamic-\\w+',
        severity: 'low',
        description: 'Dynamically added pattern',
      };

      scanner.addPattern(newPattern);
      expect(scanner.getPatterns()).toHaveLength(initialCount + 1);
    });

    it('should allow removing patterns by name', () => {
      // First add a pattern to remove
      const testPattern: SecretPattern = {
        name: 'removable-pattern',
        pattern: 'removable-\\w+',
        severity: 'low',
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
        expect(pattern.severity).toMatch(/^(critical|high|medium|low)$/);
        expect(pattern.description).toBeDefined();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty content gracefully', () => {
      const detections = scanner.scan('', 'test.txt');
      expect(detections).toEqual([]);
    });

    it('should handle whitespace-only content', () => {
      const detections = scanner.scan('   \n\t  \n   ', 'test.txt');
      expect(detections).toEqual([]);
    });

    it('should handle special characters without errors', () => {
      const content = 'config={"value":"test","symbol":"🔑"}';
      const detections = scanner.scan(content, 'test.txt');
      expect(Array.isArray(detections)).toBe(true);
    });
  });

  describe('detection structure', () => {
    it('should return detections with correct structure', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'structure-test',
          pattern: 'TESTPATTERN123',
          severity: 'high',
          description: 'Test pattern for structure validation',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'value=TESTPATTERN123';
      const detections = testScanner.scan(content, 'example.txt');

      expect(detections).toHaveLength(1);

      const detection = detections[0];
      expect(detection).toHaveProperty('id');
      expect(detection).toHaveProperty('filePath', 'example.txt');
      expect(detection).toHaveProperty('lineNumber', 1);
      expect(detection).toHaveProperty('columnNumber');
      expect(detection).toHaveProperty('secretType', 'structure-test'); // Defaults to pattern name
      expect(detection).toHaveProperty('maskedMatch');
      expect(detection).toHaveProperty('patternName', 'structure-test');
      expect(detection).toHaveProperty('severity', 'high');
      expect(detection).toHaveProperty('context');
      expect(detection).toHaveProperty('detectedAt');
      expect(detection).toHaveProperty('acknowledged', false);

      expect(typeof detection.columnNumber).toBe('number');
      expect(typeof detection.id).toBe('string');
      expect(detection.detectedAt).toBeInstanceOf(Date);
    });
  });

  describe('file scanning functionality', () => {
    it('should handle non-existent files gracefully', async () => {
      const detections = await scanner.scanFile('/path/to/nonexistent/file.txt');
      expect(detections).toEqual([]);
    });

    it('should scan multiple files and aggregate results', async () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'file-test',
          pattern: 'test_secret_123',
          severity: 'medium',
          description: 'Test pattern for file scanning',
        }],
        includeBuiltInPatterns: false,
      });

      // Test with non-existent files
      const filePaths = [
        '/path/to/nonexistent1.txt',
        '/path/to/nonexistent2.txt',
      ];

      const detections = await testScanner.scanFiles(filePaths);
      expect(Array.isArray(detections)).toBe(true);
      expect(detections).toHaveLength(0);
    });

    it('should handle mixed existing and non-existing files', async () => {
      const filePaths = [
        '/path/to/nonexistent1.txt',
        '/path/to/nonexistent2.txt',
        '/another/nonexistent/file.txt',
      ];

      const detections = await scanner.scanFiles(filePaths);
      expect(Array.isArray(detections)).toBe(true);
    });
  });

  describe('createScanResult method', () => {
    it('should create scan result with no detections', () => {
      const detections: SecretDetection[] = [];
      const result = scanner.createScanResult(detections);

      expect(result.hasSecrets).toBe(false);
      expect(result.count).toBe(0);
      expect(result.detections).toEqual([]);
      expect(result.scannedAt).toBeInstanceOf(Date);
    });

    it('should create scan result with detections', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'result-test',
          pattern: 'RESULT_TEST_VALUE',
          severity: 'low',
          description: 'Test pattern for scan results',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'data=RESULT_TEST_VALUE';
      const detections = testScanner.scan(content, 'result.txt');
      const result = testScanner.createScanResult(detections, content);

      expect(result.hasSecrets).toBe(true);
      expect(result.count).toBe(1);
      expect(result.detections).toHaveLength(1);
      expect(result.scannedContent).toBe(content);
      expect(result.scannedAt).toBeInstanceOf(Date);
    });
  });

  describe('advanced edge cases', () => {
    it('should handle regex with global flag properly', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'global-test',
          pattern: 'GLOBAL\\d+',
          severity: 'medium',
          description: 'Test pattern with global matching',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'First: GLOBAL123, Second: GLOBAL456, Third: GLOBAL789';
      const detections = testScanner.scan(content, 'global.txt');

      expect(detections).toHaveLength(3);
      expect(detections[0].maskedMatch).toContain('GL');
      expect(detections[1].maskedMatch).toContain('GL');
      expect(detections[2].maskedMatch).toContain('GL');
    });

    it('should handle zero-length matches gracefully', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'zero-length-test',
          pattern: '(?=secret)',
          severity: 'medium',
          description: 'Test pattern that can match zero-length',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'this contains secret word';
      const detections = testScanner.scan(content, 'zero.txt');
      expect(Array.isArray(detections)).toBe(true);
    });

    it('should mask short secrets correctly', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'short-test',
          pattern: 'abc',
          severity: 'low',
          description: 'Test pattern for short secrets',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'value=abc';
      const detections = testScanner.scan(content, 'short.txt');

      expect(detections).toHaveLength(1);
      expect(detections[0].maskedMatch).toBe('***');
    });

    it('should handle context extraction at line boundaries', () => {
      const testScanner = new SecretScanner({
        contextLength: 100,
        customPatterns: [{
          name: 'boundary-test',
          pattern: 'BOUNDARY',
          severity: 'medium',
          description: 'Test pattern for boundary conditions',
        }],
        includeBuiltInPatterns: false,
      });

      const content = 'BOUNDARY';
      const detections = testScanner.scan(content, 'boundary.txt');

      expect(detections).toHaveLength(1);
      expect(detections[0].context).toBe('BOUNDARY');
    });

    it('should handle unicode characters in content', () => {
      const testScanner = new SecretScanner({
        customPatterns: [{
          name: 'unicode-test',
          pattern: 'TOKEN123',
          severity: 'medium',
          description: 'Test pattern with unicode content',
        }],
        includeBuiltInPatterns: false,
      });

      const content = '🔐 secure: TOKEN123 🔒';
      const detections = testScanner.scan(content, 'unicode.txt');

      expect(detections).toHaveLength(1);
      expect(detections[0].context).toContain('🔐');
      expect(detections[0].context).toContain('🔒');
    });
  });
});