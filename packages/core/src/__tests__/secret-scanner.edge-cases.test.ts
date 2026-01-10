/**
 * @fileoverview Additional edge case tests for SecretScanner to achieve >80% coverage
 *
 * Tests cover:
 * - Performance edge cases and resource limits
 * - Error handling scenarios
 * - Pattern matching edge cases
 * - Unicode and encoding handling
 * - Memory management and large input handling
 * - Zero-width match prevention
 * - Context extraction edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner } from '../secret-scanner';
import { SecretPattern } from '../types';

describe('SecretScanner Edge Cases', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  // ============================================================================
  // Performance and Resource Management
  // ============================================================================

  describe('performance and resource management', () => {
    it('should respect maxLineLength configuration', () => {
      const maxLineLength = 100;
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Pattern',
          pattern: 'SECRET_[A-Z]{8}',
          severity: 'medium'
        }],
        maxLineLength
      });

      // Create a line that exceeds maxLineLength with a secret at the end
      const longLine = 'x'.repeat(maxLineLength + 50) + 'SECRET_ABCDEFGH';
      const detections = testScanner.scan(longLine);

      expect(detections).toHaveLength(0); // Should skip due to length limit
    });

    it('should handle very large content efficiently', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Pattern',
          pattern: 'FIND_ME',
          severity: 'low'
        }],
        maxLineLength: 10000
      });

      // Create large content (1MB+)
      const largeContent = 'safe content '.repeat(100000) + '\nFIND_ME\n' + 'more safe content '.repeat(100000);

      const startTime = Date.now();
      const detections = testScanner.scan(largeContent);
      const endTime = Date.now();

      expect(detections).toHaveLength(1);
      expect(detections[0].patternName).toBe('Test Pattern');
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle content with many lines efficiently', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Line Pattern',
          pattern: 'LINE_\\d+',
          severity: 'low'
        }]
      });

      // Create content with many lines
      const lines = Array.from({ length: 10000 }, (_, i) => `Line ${i} content`);
      lines[5000] = 'Special line with LINE_5000 pattern';
      const content = lines.join('\n');

      const detections = testScanner.scan(content);

      expect(detections).toHaveLength(1);
      expect(detections[0].lineNumber).toBe(5001); // 1-based indexing
      expect(detections[0].maskedMatch).toBe('LI*****000');
    });
  });

  // ============================================================================
  // Error Handling and Input Validation
  // ============================================================================

  describe('error handling and input validation', () => {
    it('should handle invalid input types gracefully', () => {
      const invalidInputs = [
        123,
        { object: 'value' },
        [1, 2, 3],
        true,
        false,
        Symbol('test')
      ];

      invalidInputs.forEach(input => {
        expect(() => {
          const detections = scanner.scan(input as any);
          expect(detections).toEqual([]);
        }).not.toThrow();
      });
    });

    it('should handle malformed regex patterns gracefully', () => {
      const malformedPatterns: SecretPattern[] = [
        {
          name: 'Invalid Bracket',
          pattern: '[unclosed',
          severity: 'low'
        },
        {
          name: 'Invalid Group',
          pattern: '(unclosed',
          severity: 'low'
        },
        {
          name: 'Invalid Quantifier',
          pattern: '*invalid',
          severity: 'low'
        },
        {
          name: 'Invalid Escape',
          pattern: '\\k<invalid>',
          severity: 'low'
        }
      ];

      malformedPatterns.forEach(pattern => {
        expect(() => {
          const testScanner = new SecretScanner({
            includeBuiltInPatterns: false,
            customPatterns: [pattern]
          });

          // Should not throw, should just skip the invalid pattern
          const detections = testScanner.scan('test content here');
          expect(detections).toEqual([]);
        }).not.toThrow();
      });
    });

    it('should handle extremely long lines without memory issues', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Pattern',
          pattern: 'NEEDLE',
          severity: 'low'
        }],
        maxLineLength: 1000000 // 1MB limit
      });

      // Create a line approaching the limit but under it
      const longLine = 'hay'.repeat(300000) + 'NEEDLE' + 'hay'.repeat(33000); // ~999KB

      const detections = testScanner.scan(longLine);
      expect(detections).toHaveLength(1);
      expect(detections[0].patternName).toBe('Test Pattern');
    });

    it('should handle empty and whitespace-only content', () => {
      const whitespaceInputs = ['', ' ', '\t', '\n', '\r\n', '  \t\n\r  ', '\u00A0', '\u2000'];

      whitespaceInputs.forEach(input => {
        const detections = scanner.scan(input);
        expect(detections).toEqual([]);
      });
    });
  });

  // ============================================================================
  // Pattern Matching Edge Cases
  // ============================================================================

  describe('pattern matching edge cases', () => {
    it('should prevent infinite loops on zero-width matches', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Zero Width',
          pattern: '(?=secret)', // Positive lookahead - zero width
          severity: 'low'
        }]
      });

      const content = 'secretsecret';

      const startTime = Date.now();
      const detections = testScanner.scan(content);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should not hang
      expect(detections.length).toBeLessThanOrEqual(2); // Should not create infinite matches
    });

    it('should handle overlapping pattern matches', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [
          {
            name: 'Pattern A',
            pattern: 'ABCDEFGH',
            severity: 'high'
          },
          {
            name: 'Pattern B',
            pattern: 'CDEFGHIJ',
            severity: 'medium'
          }
        ]
      });

      const content = 'prefix_ABCDEFGHIJ_suffix';
      const detections = testScanner.scan(content);

      expect(detections).toHaveLength(2); // Both patterns should match
      expect(detections.some(d => d.patternName === 'Pattern A')).toBe(true);
      expect(detections.some(d => d.patternName === 'Pattern B')).toBe(true);
    });

    it('should handle case-insensitive matching', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Case Test',
          pattern: 'secret_[a-z]+',
          severity: 'medium'
        }]
      });

      const variations = [
        'secret_abc',
        'SECRET_ABC',
        'Secret_Abc',
        'sEcReT_aBc'
      ];

      variations.forEach(variation => {
        const detections = testScanner.scan(variation);
        expect(detections).toHaveLength(1);
        expect(detections[0].patternName).toBe('Case Test');
      });
    });

    it('should handle global pattern matching on same line', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Multiple Pattern',
          pattern: 'KEY_\\d+',
          severity: 'medium'
        }]
      });

      const content = 'config: KEY_123 and backup: KEY_456 and fallback: KEY_789';
      const detections = testScanner.scan(content);

      expect(detections).toHaveLength(3);
      detections.forEach((detection, index) => {
        expect(detection.patternName).toBe('Multiple Pattern');
        expect(detection.lineNumber).toBe(1);
        expect(detection.maskedMatch).toMatch(/^KE.*\d$/);
      });
    });
  });

  // ============================================================================
  // Context Extraction Edge Cases
  // ============================================================================

  describe('context extraction edge cases', () => {
    it('should handle context extraction at line boundaries', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Boundary Pattern',
          pattern: 'SECRET',
          severity: 'medium'
        }],
        contextLength: 10
      });

      // Secret at the very beginning
      let detections = testScanner.scan('SECRET followed by content');
      expect(detections[0].context).toBe('SECRET fol...');

      // Secret at the very end
      detections = testScanner.scan('content before SECRET');
      expect(detections[0].context).toBe('...ent before SECRET');

      // Secret in very short content
      detections = testScanner.scan('SECRET');
      expect(detections[0].context).toBe('SECRET');
    });

    it('should handle unicode characters in context', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Unicode Pattern',
          pattern: 'SECRET',
          severity: 'medium'
        }],
        contextLength: 15
      });

      const content = '前面的文本 SECRET 后面的文本 emoji🔐更多文本';
      const detections = testScanner.scan(content);

      expect(detections).toHaveLength(1);
      expect(detections[0].context).toContain('前面的文本');
      expect(detections[0].context).toContain('后面的文本');
      expect(detections[0].context).toContain('🔐');
    });

    it('should handle various line endings in content', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Line Ending Pattern',
          pattern: 'SECRET_\\d+',
          severity: 'medium'
        }]
      });

      const lineEndings = ['\n', '\r\n', '\r'];
      lineEndings.forEach((ending, index) => {
        const content = `line1${ending}line2 with SECRET_${index}${ending}line3`;
        const detections = testScanner.scan(content);

        expect(detections).toHaveLength(1);
        expect(detections[0].lineNumber).toBe(2);
        expect(detections[0].maskedMatch).toBe(`SE*****_${index}`);
      });
    });
  });

  // ============================================================================
  // Secret Masking Edge Cases
  // ============================================================================

  describe('secret masking edge cases', () => {
    it('should handle very short secrets correctly', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [
          { name: 'One Char', pattern: 'A', severity: 'low' },
          { name: 'Two Char', pattern: 'AB', severity: 'low' },
          { name: 'Three Char', pattern: 'ABC', severity: 'low' },
          { name: 'Four Char', pattern: 'ABCD', severity: 'low' }
        ]
      });

      const expectations = [
        { content: 'prefix A suffix', expectedMask: '*' },
        { content: 'prefix AB suffix', expectedMask: '**' },
        { content: 'prefix ABC suffix', expectedMask: '***' },
        { content: 'prefix ABCD suffix', expectedMask: '****' }
      ];

      expectations.forEach((test, index) => {
        const detections = testScanner.scan(test.content);
        expect(detections).toHaveLength(1);
        expect(detections[0].maskedMatch).toBe(test.expectedMask);
      });
    });

    it('should handle very long secrets correctly', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Long Secret',
          pattern: 'LONG_[A-Z0-9]{100}',
          severity: 'high'
        }]
      });

      const longSecret = 'LONG_' + 'A'.repeat(100);
      const detections = testScanner.scan(`key=${longSecret}`);

      expect(detections).toHaveLength(1);
      expect(detections[0].maskedMatch).toBe('LO' + '*'.repeat(101) + 'AA'); // First 2 + middle masked + last 2
      expect(detections[0].maskedMatch.length).toBe(longSecret.length);
    });

    it('should handle secrets with special characters in masking', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Special Chars',
          pattern: '[A-Z0-9_\\-\\.\\+/=]{16}',
          severity: 'medium'
        }]
      });

      const specialSecrets = [
        'ABCD-EFGH_IJKL.MN',
        '1234+5678/9012=345',
        'MIX3D.Ch4r5_T3st!'
      ];

      specialSecrets.forEach(secret => {
        const detections = testScanner.scan(`token=${secret}`);
        if (detections.length > 0) {
          const masked = detections[0].maskedMatch;
          expect(masked.length).toBe(secret.length);
          expect(masked.startsWith(secret.substring(0, 2))).toBe(true);
          expect(masked.endsWith(secret.substring(secret.length - 2))).toBe(true);
        }
      });
    });
  });

  // ============================================================================
  // Pattern Management Edge Cases
  // ============================================================================

  describe('pattern management edge cases', () => {
    it('should handle duplicate pattern names', () => {
      const pattern1: SecretPattern = {
        name: 'Duplicate Name',
        pattern: 'PATTERN1_[A-Z]+',
        severity: 'high'
      };

      const pattern2: SecretPattern = {
        name: 'Duplicate Name', // Same name
        pattern: 'PATTERN2_[0-9]+',
        severity: 'low'
      };

      scanner.addPattern(pattern1);
      scanner.addPattern(pattern2);

      const content = 'test PATTERN1_ABC and PATTERN2_123';
      const detections = scanner.scan(content);

      expect(detections.length).toBeGreaterThanOrEqual(2);
      expect(detections.some(d => d.maskedMatch.includes('PATTERN1'))).toBe(true);
      expect(detections.some(d => d.maskedMatch.includes('PATTERN2'))).toBe(true);
    });

    it('should handle pattern removal edge cases', () => {
      const pattern: SecretPattern = {
        name: 'Removable',
        pattern: 'REMOVE_[A-Z]+',
        severity: 'medium'
      };

      // Test removing non-existent pattern
      expect(scanner.removePattern('NonExistent')).toBe(false);

      // Test removing after adding
      scanner.addPattern(pattern);
      expect(scanner.removePattern('Removable')).toBe(true);

      // Test removing again (should return false)
      expect(scanner.removePattern('Removable')).toBe(false);

      // Verify pattern is actually removed
      const detections = scanner.scan('test REMOVE_ABC');
      expect(detections.some(d => d.patternName === 'Removable')).toBe(false);
    });

    it('should handle option updates correctly', () => {
      // Start with built-in patterns
      expect(scanner.getPatterns().length).toBeGreaterThan(0);

      // Update to disable built-in patterns
      scanner.updateOptions({ includeBuiltInPatterns: false });
      expect(scanner.getPatterns()).toHaveLength(0);

      // Add custom pattern
      scanner.addPattern({
        name: 'Custom',
        pattern: 'CUSTOM_[A-Z]+',
        severity: 'high'
      });
      expect(scanner.getPatterns()).toHaveLength(1);

      // Update context length
      scanner.updateOptions({ contextLength: 5 });
      const detections = scanner.scan('before CUSTOM_ABC after');
      expect(detections[0].context.length).toBeLessThan(20); // Should be shorter
    });
  });

  // ============================================================================
  // Secret Type Classification Edge Cases
  // ============================================================================

  describe('secret type classification edge cases', () => {
    it('should handle pattern names with mixed casing', () => {
      const patterns = [
        { name: 'Api Key Pattern', expectedType: 'api_key' },
        { name: 'TOKEN pattern', expectedType: 'token' },
        { name: 'Password PATTERN', expectedType: 'password' },
        { name: 'PRIVATE KEY pattern', expectedType: 'private_key' },
        { name: 'Auth Pattern', expectedType: 'auth_credential' },
        { name: 'SECRET pattern', expectedType: 'secret' },
        { name: 'Random Name', expectedType: 'credential' }
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

    it('should handle patterns with multiple type keywords', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'API Key Token Password', // Multiple keywords
          pattern: 'MULTI_[A-Z]{4}',
          severity: 'high'
        }]
      });

      const detections = testScanner.scan('config=MULTI_ABCD');
      expect(detections).toHaveLength(1);
      // Should match the first keyword found (api_key comes first in the method)
      expect(detections[0].secretType).toBe('api_key');
    });

    it('should handle empty or null pattern names gracefully', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [
          {
            name: '', // Empty name
            pattern: 'EMPTY_[A-Z]{4}',
            severity: 'low'
          },
          {
            name: '   ', // Whitespace name
            pattern: 'SPACE_[A-Z]{4}',
            severity: 'low'
          }
        ]
      });

      const detections1 = testScanner.scan('config=EMPTY_ABCD');
      const detections2 = testScanner.scan('config=SPACE_ABCD');

      detections1.forEach(d => {
        expect(d.secretType).toBe('credential'); // Should default
      });

      detections2.forEach(d => {
        expect(d.secretType).toBe('credential'); // Should default
      });
    });
  });

  // ============================================================================
  // Built-in Pattern Testing
  // ============================================================================

  describe('built-in pattern robustness', () => {
    it('should detect AWS Access Key IDs correctly', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const detections = scanner.scan(content);

      expect(detections.some(d => d.patternName === 'AWS Access Key ID')).toBe(true);
    });

    it('should handle JWT tokens with various encodings', () => {
      const jwtTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ',
        'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.' // No signature part
      ];

      jwtTokens.forEach(token => {
        const detections = scanner.scan(`Bearer ${token}`);
        expect(detections.some(d => d.patternName === 'JWT Token')).toBe(true);
      });
    });

    it('should not produce false positives on common patterns', () => {
      const falsePositives = [
        'this is not a secret',
        'API_KEY but no equals',
        'password hint not actual password',
        'base64 but not JWT: dGVzdA==',
        'looks like key but too short: KEY_AB'
      ];

      falsePositives.forEach(content => {
        const detections = scanner.scan(content);
        // Should either have no detections or only very low severity ones
        const highSeverityDetections = detections.filter(d =>
          d.severity === 'critical' || d.severity === 'high'
        );
        expect(highSeverityDetections).toHaveLength(0);
      });
    });
  });
});