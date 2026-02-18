import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner } from '../secret-scanner';
import { SecretPattern } from '../types';

describe('SecretScanner', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default options', () => {
      const patterns = scanner.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.name === 'AWS Access Key ID')).toBe(true);
    });

    it('should accept custom options', () => {
      const customPattern: SecretPattern = {
        name: 'Test Pattern',
        pattern: 'TEST_[A-Z0-9]{16}',
        severity: 'high'
      };

      const customScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [customPattern],
        maxLineLength: 5000,
        contextLength: 10
      });

      const patterns = customScanner.getPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].name).toBe('Test Pattern');
    });

    it('should combine built-in and custom patterns', () => {
      const customPattern: SecretPattern = {
        name: 'Custom API Key',
        pattern: 'CUSTOM_[A-Z0-9]{32}',
        severity: 'critical'
      };

      const customScanner = new SecretScanner({
        includeBuiltInPatterns: true,
        customPatterns: [customPattern]
      });

      const patterns = customScanner.getPatterns();
      expect(patterns.length).toBeGreaterThan(1);
      expect(patterns.some(p => p.name === 'AWS Access Key ID')).toBe(true);
      expect(patterns.some(p => p.name === 'Custom API Key')).toBe(true);
    });
  });

  describe('Basic Scanning Functionality', () => {
    it('should return empty array for empty content', () => {
      expect(scanner.scan('')).toEqual([]);
      expect(scanner.scan('   ')).toEqual([]);
    });

    it('should return empty array for null/undefined content', () => {
      expect(scanner.scan(null as any)).toEqual([]);
      expect(scanner.scan(undefined as any)).toEqual([]);
    });

    it('should detect test patterns', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Secret',
          pattern: 'TESTSECRET_[A-Z0-9]{16}',
          severity: 'high'
        }]
      });

      const content = 'config=TESTSECRET_ABC1234567890DEF';
      const detections = testScanner.scan(content);

      expect(detections).toHaveLength(1);
      expect(detections[0].patternName).toBe('Test Secret');
      expect(detections[0].severity).toBe('high');
      expect(detections[0].lineNumber).toBe(1);
      expect(detections[0].columnNumber).toBeGreaterThan(0);
    });
  });

  describe('Pattern Matching', () => {
    it('should detect private key headers', () => {
      const content = '-----BEGIN PRIVATE KEY-----\nSample key content here';
      const detections = scanner.scan(content);

      expect(detections).toHaveLength(1);
      expect(detections[0].patternName).toBe('Private Key Header');
      expect(detections[0].severity).toBe('critical');
      expect(detections[0].secretType).toBe('private_key');
    });

    it('should skip very long lines', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Pattern',
          pattern: 'SECRET_[A-Z]{8}',
          severity: 'high'
        }],
        maxLineLength: 100
      });

      const longLine = 'x'.repeat(200) + 'SECRET_ABCDEFGH';
      const detections = testScanner.scan(longLine);
      expect(detections).toHaveLength(0);
    });
  });

  describe('Detection Metadata', () => {
    it('should generate unique detection IDs', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Pattern',
          pattern: 'SECRET_[A-Z]{4}',
          severity: 'medium'
        }]
      });

      const content = `
        config1=SECRET_ABCD
        config2=SECRET_EFGH
      `;

      const detections = testScanner.scan(content);
      expect(detections).toHaveLength(2);
      expect(detections[0].id).not.toBe(detections[1].id);
      expect(detections[0].id).toMatch(/^detect_/);
    });

    it('should include correct line and column numbers', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Pattern',
          pattern: 'SECRET_[A-Z]{4}',
          severity: 'medium'
        }]
      });

      const content = `line 1
      line 2 with config=SECRET_ABCD here
      line 3`;

      const detections = testScanner.scan(content);
      expect(detections).toHaveLength(1);
      expect(detections[0].lineNumber).toBe(2);
      expect(detections[0].columnNumber).toBeGreaterThan(15);
    });

    it('should provide context around matches', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Pattern',
          pattern: 'SECRET_[A-Z]{4}',
          severity: 'medium'
        }],
        contextLength: 10
      });

      const content = 'This is some text before config=SECRET_ABCD and some text after';
      const detections = testScanner.scan(content);

      expect(detections).toHaveLength(1);
      expect(detections[0].context).toContain('before');
      expect(detections[0].context).toContain('after');
      expect(detections[0].context.length).toBeLessThan(content.length);
    });

    it('should mask secrets properly', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Pattern',
          pattern: 'SECRET_[A-Z]{8}',
          severity: 'medium'
        }]
      });

      const content = 'config=SECRET_ABCDEFGH';
      const detections = testScanner.scan(content);

      expect(detections).toHaveLength(1);
      expect(detections[0].maskedMatch).not.toBe('SECRET_ABCDEFGH');
      expect(detections[0].maskedMatch).toMatch(/^SE.*GH$/);
      expect(detections[0].maskedMatch).toContain('*');
    });

    it('should handle short secrets in masking', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Short Secret',
          pattern: 'SHORT',
          severity: 'low'
        }]
      });

      const detections = testScanner.scan('config=SHORT');
      expect(detections).toHaveLength(1);
      expect(detections[0].maskedMatch).toBe('*****');
    });

    it('should set detection timestamp', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Pattern',
          pattern: 'SECRET_[A-Z]{4}',
          severity: 'medium'
        }]
      });

      const before = new Date();
      const detections = testScanner.scan('config=SECRET_ABCD');
      const after = new Date();

      expect(detections).toHaveLength(1);
      expect(detections[0].detectedAt).toBeInstanceOf(Date);
      expect(detections[0].detectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(detections[0].detectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Custom Patterns', () => {
    it('should detect custom patterns', () => {
      const customPattern: SecretPattern = {
        name: 'Internal API Key',
        pattern: 'INTERNAL_[A-Z0-9]{16}',
        severity: 'high',
        description: 'Internal API key format'
      };

      const customScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [customPattern]
      });

      const detections = customScanner.scan('key=INTERNAL_ABC1234567890DEF');
      expect(detections).toHaveLength(1);
      expect(detections[0].patternName).toBe('Internal API Key');
      expect(detections[0].severity).toBe('high');
    });

    it('should add patterns dynamically', () => {
      const customPattern: SecretPattern = {
        name: 'Dynamic Pattern',
        pattern: 'DYNAMIC_[0-9]{8}',
        severity: 'medium'
      };

      scanner.addPattern(customPattern);

      const detections = scanner.scan('test=DYNAMIC_12345678');
      expect(detections.length).toBeGreaterThan(0);

      const dynamicDetection = detections.find(d => d.patternName === 'Dynamic Pattern');
      expect(dynamicDetection).toBeDefined();
    });

    it('should remove patterns dynamically', () => {
      const customPattern: SecretPattern = {
        name: 'Removable Pattern',
        pattern: 'REMOVE_[A-Z]{4}',
        severity: 'low'
      };

      scanner.addPattern(customPattern);

      // Should detect with pattern
      let detections = scanner.scan('test=REMOVE_ABCD');
      expect(detections.some(d => d.patternName === 'Removable Pattern')).toBe(true);

      // Remove pattern
      const removed = scanner.removePattern('Removable Pattern');
      expect(removed).toBe(true);

      // Should not detect anymore
      detections = scanner.scan('test=REMOVE_ABCD');
      expect(detections.some(d => d.patternName === 'Removable Pattern')).toBe(false);
    });

    it('should return false when removing non-existent pattern', () => {
      const removed = scanner.removePattern('Non Existent Pattern');
      expect(removed).toBe(false);
    });
  });

  describe('Options Management', () => {
    it('should update options dynamically', () => {
      scanner.updateOptions({
        includeBuiltInPatterns: false,
        maxLineLength: 500
      });

      const patterns = scanner.getPatterns();
      expect(patterns).toHaveLength(0);

      // Add a custom pattern and verify it works
      scanner.addPattern({
        name: 'Test Update',
        pattern: 'UPDATE_[0-9]+',
        severity: 'low'
      });

      const detections = scanner.scan('test=UPDATE_123');
      expect(detections).toHaveLength(1);
    });

    it('should get current patterns', () => {
      const patterns = scanner.getPatterns();
      expect(patterns).toBeInstanceOf(Array);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every(p => p.name && p.pattern && p.severity)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty pattern arrays', () => {
      const emptyScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: []
      });

      expect(emptyScanner.getPatterns()).toHaveLength(0);
      expect(emptyScanner.scan('any content here')).toHaveLength(0);
    });

    it('should handle malformed input gracefully', () => {
      expect(() => scanner.scan(123 as any)).not.toThrow();
      expect(() => scanner.scan({} as any)).not.toThrow();
      expect(() => scanner.scan([] as any)).not.toThrow();
    });
  });

  describe('Secret Type Classification', () => {
    it('should classify secret types correctly', () => {
      const patterns = [
        { name: 'API Key Pattern', expectedType: 'api_key' },
        { name: 'Token Pattern', expectedType: 'token' },
        { name: 'Password Pattern', expectedType: 'password' },
        { name: 'Private Key Pattern', expectedType: 'private_key' },
        { name: 'Auth Pattern', expectedType: 'auth_credential' },
        { name: 'Secret Pattern', expectedType: 'secret' },
        { name: 'Unknown Pattern', expectedType: 'credential' }
      ];

      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: patterns.map((p, i) => ({
          name: p.name,
          pattern: `TEST${i}_[A-Z]{4}`,
          severity: 'medium'
        }))
      });

      patterns.forEach((p, i) => {
        const detections = testScanner.scan(`config=TEST${i}_ABCD`);
        expect(detections).toHaveLength(1);
        expect(detections[0].secretType).toBe(p.expectedType);
      });
    });
  });
});