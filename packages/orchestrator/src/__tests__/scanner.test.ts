import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner, type SecretPattern } from '../scanner';

describe('SecretScanner - Comprehensive Unit Tests', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('Default Patterns Detection - Structure Tests', () => {
    it('should have at least 11 built-in patterns', () => {
      const patterns = scanner.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(11);
    });

    it('should have all expected pattern names', () => {
      const patterns = scanner.getPatterns();
      const patternNames = patterns.map(p => p.name);

      const expectedPatterns = [
        'generic-api-key',
        'aws-access-key',
        'aws-secret-key',
        'github-token',
        'github-classic-token',
        'jwt-token',
        'database-url',
        'private-key',
        'password-field',
        'slack-token',
        'high-entropy-string',
        'base64-secret'
      ];

      expectedPatterns.forEach(expectedPattern => {
        expect(patternNames).toContain(expectedPattern);
      });
    });

    it('should have correct severity assignments', () => {
      const patterns = scanner.getPatterns();

      // Critical severity patterns
      const criticalPatterns = patterns.filter(p => p.severity === 'critical');
      expect(criticalPatterns.some(p => p.name === 'private-key')).toBe(true);

      // High severity patterns
      const highPatterns = patterns.filter(p => p.severity === 'high');
      expect(highPatterns.some(p => p.name === 'aws-access-key')).toBe(true);
      expect(highPatterns.some(p => p.name === 'github-token')).toBe(true);

      // Medium severity patterns
      const mediumPatterns = patterns.filter(p => p.severity === 'medium');
      expect(mediumPatterns.some(p => p.name === 'generic-api-key')).toBe(true);
      expect(mediumPatterns.some(p => p.name === 'jwt-token')).toBe(true);
    });

    it('should have valid confidence levels for all patterns', () => {
      const patterns = scanner.getPatterns();

      patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);

        // Critical patterns should have high confidence
        if (pattern.severity === 'critical') {
          expect(pattern.confidence).toBeGreaterThanOrEqual(0.9);
        }
      });
    });
  });

  describe('Custom Patterns', () => {
    it('should work with custom patterns only', () => {
      const customPattern: SecretPattern = {
        name: 'test-pattern',
        regex: /TESTPAT_[A-Z0-9]{8}/g,
        secretType: 'test-type',
        confidence: 0.9,
        severity: 'high',
        description: 'Test pattern'
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: false
      });

      expect(testScanner.getPatterns()).toHaveLength(1);
      expect(testScanner.getPatterns()[0].name).toBe('test-pattern');
    });

    it('should combine custom patterns with built-in patterns', () => {
      const customPattern: SecretPattern = {
        name: 'custom-pattern',
        regex: /CUSTOMPAT_[A-Z0-9]{10}/g,
        secretType: 'custom-type',
        confidence: 0.95,
        severity: 'critical',
        description: 'Custom pattern'
      };

      const testScanner = new SecretScanner({
        customPatterns: [customPattern],
        includeBuiltInPatterns: true
      });

      expect(testScanner.getPatterns().length).toBeGreaterThan(11);
      expect(testScanner.getPatterns().some(p => p.name === 'custom-pattern')).toBe(true);
      expect(testScanner.getPatterns().some(p => p.name === 'aws-access-key')).toBe(true);
    });

    it('should preserve custom pattern properties', () => {
      const customPatterns: SecretPattern[] = [
        {
          name: 'low-severity',
          regex: /LOWPAT_[A-Z0-9]{6}/g,
          secretType: 'low-risk',
          confidence: 0.5,
          severity: 'low',
          description: 'Low severity pattern'
        },
        {
          name: 'critical-severity',
          regex: /CRITPAT_[A-Z0-9]{6}/g,
          secretType: 'critical-risk',
          confidence: 0.95,
          severity: 'critical',
          description: 'Critical severity pattern'
        }
      ];

      const testScanner = new SecretScanner({
        customPatterns,
        includeBuiltInPatterns: false
      });

      const patterns = testScanner.getPatterns();
      expect(patterns).toHaveLength(2);

      const lowPattern = patterns.find(p => p.name === 'low-severity');
      const criticalPattern = patterns.find(p => p.name === 'critical-severity');

      expect(lowPattern?.severity).toBe('low');
      expect(criticalPattern?.severity).toBe('critical');
      expect(lowPattern?.confidence).toBe(0.5);
      expect(criticalPattern?.confidence).toBe(0.95);
    });
  });

  describe('Line and Column Accuracy', () => {
    it('should accurately report line numbers', () => {
      const testPattern: SecretPattern = {
        name: 'line-test',
        regex: /LINEPAT_[A-Z0-9]+/g,
        secretType: 'test',
        confidence: 0.8,
        severity: 'medium',
        description: 'Line test pattern'
      };

      const testScanner = new SecretScanner({
        customPatterns: [testPattern],
        includeBuiltInPatterns: false
      });

      const content = `Line 1: regular content
Line 2: also regular
Line 3: value=LINEPAT_TEST123
Line 4: more content
Line 5: another=LINEPAT_TEST789`;

      const findings = testScanner.scan(content, 'lines.txt');

      expect(findings).toHaveLength(2);
      expect(findings[0].line).toBe(3);
      expect(findings[1].line).toBe(5);
    });

    it('should accurately report column positions', () => {
      const testPattern: SecretPattern = {
        name: 'col-test',
        regex: /COLPAT_[A-Z0-9]+/g,
        secretType: 'test',
        confidence: 0.8,
        severity: 'medium',
        description: 'Column test pattern'
      };

      const testScanner = new SecretScanner({
        customPatterns: [testPattern],
        includeBuiltInPatterns: false
      });

      const content = 'prefix COLPAT_TEST123 suffix';
      const findings = testScanner.scan(content, 'columns.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].column).toBe(8); // 1-based: 'prefix ' is 7 chars
      expect(findings[0].endColumn).toBeGreaterThan(findings[0].column);
    });

    it('should handle zero-based to one-based conversion correctly', () => {
      const testPattern: SecretPattern = {
        name: 'base-test',
        regex: /BASETEST/g,
        secretType: 'test',
        confidence: 0.8,
        severity: 'medium',
        description: 'Base test pattern'
      };

      const testScanner = new SecretScanner({
        customPatterns: [testPattern],
        includeBuiltInPatterns: false
      });

      const content = 'BASETEST'; // Pattern at the very beginning
      const findings = testScanner.scan(content, 'base.txt');

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(1);    // 1-based
      expect(findings[0].column).toBe(1);  // 1-based
      expect(findings[0].endColumn).toBe(9); // BASETEST is 8 chars, end at position 9
    });
  });

  describe('Severity Level Accuracy', () => {
    it('should maintain consistency between pattern definition and findings', () => {
      const patterns = scanner.getPatterns();

      const awsAccessPattern = patterns.find(p => p.name === 'aws-access-key');
      const privateKeyPattern = patterns.find(p => p.name === 'private-key');
      const apiKeyPattern = patterns.find(p => p.name === 'generic-api-key');

      expect(awsAccessPattern?.severity).toBe('high');
      expect(privateKeyPattern?.severity).toBe('critical');
      expect(apiKeyPattern?.severity).toBe('medium');
    });

    it('should preserve severity from custom patterns in findings', () => {
      const testPattern: SecretPattern = {
        name: 'severity-test',
        regex: /SEVPAT_[A-Z0-9]{6}/g,
        secretType: 'severity-test',
        confidence: 0.85,
        severity: 'critical',
        description: 'Severity test pattern'
      };

      const testScanner = new SecretScanner({
        customPatterns: [testPattern],
        includeBuiltInPatterns: false
      });

      const content = 'test=SEVPAT_TEST12';
      const findings = testScanner.scan(content, 'severity.test');

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].confidence).toBe(0.85);
      expect(findings[0].patternName).toBe('severity-test');
    });
  });

  describe('Edge Cases', () => {
    describe('Empty Content', () => {
      it('should handle completely empty content', () => {
        const findings = scanner.scan('', 'empty.txt');
        expect(findings).toEqual([]);
      });

      it('should handle whitespace-only content', () => {
        const whitespaceContent = '   \n\t\r\n   \n\t  ';
        const findings = scanner.scan(whitespaceContent, 'whitespace.txt');
        expect(findings).toEqual([]);
      });

      it('should handle content with only newlines', () => {
        const content = '\n\n\n\n';
        const findings = scanner.scan(content, 'newlines.txt');
        expect(findings).toEqual([]);
      });
    });

    describe('Binary-like Content', () => {
      it('should handle content with null bytes', () => {
        const testPattern: SecretPattern = {
          name: 'null-test',
          regex: /NULLPAT_[A-Z0-9]{6}/g,
          secretType: 'test',
          confidence: 0.8,
          severity: 'medium',
          description: 'Null byte test'
        };

        const testScanner = new SecretScanner({
          customPatterns: [testPattern],
          includeBuiltInPatterns: false
        });

        const content = 'prefix\0NULLPAT_TEST12\0suffix';
        const findings = testScanner.scan(content, 'binary.dat');

        expect(findings).toHaveLength(1);
        expect(findings[0].secretType).toBe('test');
      });

      it('should skip extremely long lines to prevent performance issues', () => {
        const longPrefix = 'x'.repeat(15000); // Exceeds default maxLineLength
        const content = longPrefix + 'SHORTPATTERN';

        const testScanner = new SecretScanner({
          customPatterns: [{
            name: 'short-pattern',
            regex: /SHORTPATTERN/g,
            secretType: 'test',
            confidence: 0.8,
            severity: 'medium',
            description: 'Short pattern test'
          }],
          includeBuiltInPatterns: false
        });

        const findings = testScanner.scan(content, 'long.txt');
        expect(findings).toEqual([]); // Should skip the long line
      });
    });

    describe('Multiline Content', () => {
      it('should handle multiline content correctly', () => {
        const testPattern: SecretPattern = {
          name: 'multi-test',
          regex: /MULTIPAT_[A-Z0-9]{8}/g,
          secretType: 'test',
          confidence: 0.8,
          severity: 'medium',
          description: 'Multiline test pattern'
        };

        const testScanner = new SecretScanner({
          customPatterns: [testPattern],
          includeBuiltInPatterns: false
        });

        const content = `{
  "config": {
    "value": "MULTIPAT_TEST1234"
  }
}`;

        const findings = testScanner.scan(content, 'structured.json');

        expect(findings).toHaveLength(1);
        expect(findings[0].line).toBe(3);
      });
    });

    describe('Performance Edge Cases', () => {
      it('should handle content with many lines efficiently', () => {
        const lines = [];
        for (let i = 0; i < 100; i++) {
          lines.push(`line${i}: some_regular_content_${i}`);
        }

        const content = lines.join('\n');
        const startTime = Date.now();
        const findings = scanner.scan(content, 'performance.txt');
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(1000); // Should complete within 1 second
        expect(Array.isArray(findings)).toBe(true);
      });
    });

    describe('Context and Masking', () => {
      it('should provide context for findings', () => {
        const testPattern: SecretPattern = {
          name: 'context-test',
          regex: /CTXPAT_[A-Z0-9]{6}/g,
          secretType: 'test',
          confidence: 0.8,
          severity: 'medium',
          description: 'Context test pattern'
        };

        const testScanner = new SecretScanner({
          customPatterns: [testPattern],
          includeBuiltInPatterns: false
        });

        const content = 'CTXPAT_TEST12';
        const findings = testScanner.scan(content, 'context.txt');

        expect(findings).toHaveLength(1);
        expect(findings[0].context).toBeDefined();
        expect(typeof findings[0].context).toBe('string');
      });

      it('should respect masking configuration', () => {
        const testPattern: SecretPattern = {
          name: 'mask-test',
          regex: /MASKPAT_[A-Z0-9]{8}/g,
          secretType: 'test',
          confidence: 0.8,
          severity: 'medium',
          description: 'Masking test pattern'
        };

        const maskedScanner = new SecretScanner({
          customPatterns: [testPattern],
          includeBuiltInPatterns: false,
          maskSecrets: true
        });

        const unmaskedScanner = new SecretScanner({
          customPatterns: [testPattern],
          includeBuiltInPatterns: false,
          maskSecrets: false
        });

        const content = 'value=MASKPAT_TEST1234';

        const maskedFindings = maskedScanner.scan(content, 'masked.txt');
        const unmaskedFindings = unmaskedScanner.scan(content, 'unmasked.txt');

        expect(maskedFindings).toHaveLength(1);
        expect(unmaskedFindings).toHaveLength(1);

        expect(maskedFindings[0].match).toContain('*');
        expect(unmaskedFindings[0].match).toBe('MASKPAT_TEST1234');
      });
    });
  });

  describe('Finding Structure Validation', () => {
    it('should return findings with all required properties', () => {
      const testPattern: SecretPattern = {
        name: 'struct-test',
        regex: /STRUCTPAT_[A-Z0-9]{6}/g,
        secretType: 'structure-test',
        confidence: 0.85,
        severity: 'high',
        description: 'Structure validation pattern'
      };

      const testScanner = new SecretScanner({
        customPatterns: [testPattern],
        includeBuiltInPatterns: false
      });

      const content = 'test_value: STRUCTPAT_TEST12';
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
      expect(finding).toHaveProperty('severity');
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
      expect(typeof finding.severity).toBe('string');

      // Validate property values
      expect(finding.file).toBe('structure.txt');
      expect(finding.line).toBeGreaterThan(0);
      expect(finding.column).toBeGreaterThan(0);
      expect(finding.endColumn).toBeGreaterThan(finding.column);
      expect(finding.secretType).toBe('structure-test');
      expect(finding.confidence).toBe(0.85);
      expect(finding.patternName).toBe('struct-test');
      expect(finding.severity).toBe('high');
    });
  });
});