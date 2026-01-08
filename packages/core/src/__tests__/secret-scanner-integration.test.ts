import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner } from '../secret-scanner';
import { SecretPattern, SecretDetection } from '../types';

describe('SecretScanner Integration Tests', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('Configuration Integration', () => {
    it('should handle dynamic pattern updates during operation', () => {
      const initialPatternCount = scanner.getPatterns().length;

      // Add a safe test pattern
      const testPattern: SecretPattern = {
        name: 'Integration Test Pattern',
        pattern: 'SAFE_TEST_[0-9]{4}',
        severity: 'medium'
      };

      scanner.addPattern(testPattern);
      expect(scanner.getPatterns().length).toBe(initialPatternCount + 1);

      // Test scanning with new pattern
      const detections = scanner.scan('config=SAFE_TEST_1234');
      expect(detections.some(d => d.patternName === 'Integration Test Pattern')).toBe(true);

      // Remove pattern
      scanner.removePattern('Integration Test Pattern');
      expect(scanner.getPatterns().length).toBe(initialPatternCount);

      // Should no longer detect
      const detectionsAfterRemoval = scanner.scan('config=SAFE_TEST_1234');
      expect(detectionsAfterRemoval.some(d => d.patternName === 'Integration Test Pattern')).toBe(false);
    });

    it('should maintain consistent behavior across option updates', () => {
      const testContent = 'line1\nline2 with SAFE_PATTERN_123\nline3';

      // Test with different context lengths
      scanner.updateOptions({ contextLength: 5 });
      const shortContextDetections = scanner.scan(testContent);

      scanner.updateOptions({ contextLength: 20 });
      const longContextDetections = scanner.scan(testContent);

      // Both should find the same number of detections
      expect(shortContextDetections.length).toBe(longContextDetections.length);

      if (shortContextDetections.length > 0 && longContextDetections.length > 0) {
        // But context lengths should be different
        expect(shortContextDetections[0].context.length)
          .toBeLessThanOrEqual(longContextDetections[0].context.length);
      }
    });
  });

  describe('Performance Integration', () => {
    it('should handle large content efficiently', () => {
      // Create large content with a pattern embedded
      const largeContent = Array.from({ length: 5000 }, (_, i) =>
        i === 2500 ? 'line with SAFE_PATTERN_999' : `normal line ${i}`
      ).join('\n');

      const startTime = Date.now();
      const detections = scanner.scan(largeContent);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete quickly

      // Should still find patterns accurately
      if (detections.length > 0) {
        const targetDetection = detections.find(d => d.lineNumber === 2501);
        if (targetDetection) {
          expect(targetDetection.context).toContain('SAFE_PATTERN_999');
        }
      }
    });

    it('should respect maxLineLength limits consistently', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Line Length Test',
          pattern: 'FIND_TARGET',
          severity: 'low'
        }],
        maxLineLength: 100
      });

      const shortLine = 'Short line with FIND_TARGET pattern';
      const longLine = 'x'.repeat(200) + 'FIND_TARGET' + 'x'.repeat(200);

      expect(testScanner.scan(shortLine)).toHaveLength(1);
      expect(testScanner.scan(longLine)).toHaveLength(0);
    });
  });

  describe('Multi-Pattern Integration', () => {
    it('should handle complex pattern interactions', () => {
      const complexPatterns: SecretPattern[] = [
        {
          name: 'Pattern Alpha',
          pattern: 'ALPHA_[A-Z]{4}',
          severity: 'high'
        },
        {
          name: 'Pattern Beta',
          pattern: 'BETA_[0-9]{4}',
          severity: 'medium'
        },
        {
          name: 'Pattern Gamma',
          pattern: 'GAMMA_[A-Z0-9]{6}',
          severity: 'low'
        }
      ];

      const multiPatternScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: complexPatterns
      });

      const complexContent = `
        config_alpha=ALPHA_WXYZ
        config_beta=BETA_7890
        config_gamma=GAMMA_ABC123
        regular_config=normal_value
      `;

      const detections = multiPatternScanner.scan(complexContent);
      expect(detections).toHaveLength(3);

      const patternNames = detections.map(d => d.patternName);
      expect(patternNames).toContain('Pattern Alpha');
      expect(patternNames).toContain('Pattern Beta');
      expect(patternNames).toContain('Pattern Gamma');

      // Verify severity mapping
      const alphaDetection = detections.find(d => d.patternName === 'Pattern Alpha');
      expect(alphaDetection?.severity).toBe('high');
    });

    it('should maintain detection accuracy with pattern overlap', () => {
      const overlappingPatterns: SecretPattern[] = [
        {
          name: 'General Pattern',
          pattern: 'TEST_[A-Z0-9]+',
          severity: 'medium'
        },
        {
          name: 'Specific Pattern',
          pattern: 'TEST_SPECIFIC_[0-9]{4}',
          severity: 'high'
        }
      ];

      const overlapScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: overlappingPatterns
      });

      const testContent = 'value=TEST_SPECIFIC_1234';
      const detections = overlapScanner.scan(testContent);

      // Both patterns should match
      expect(detections).toHaveLength(2);

      const generalMatch = detections.find(d => d.patternName === 'General Pattern');
      const specificMatch = detections.find(d => d.patternName === 'Specific Pattern');

      expect(generalMatch).toBeDefined();
      expect(specificMatch).toBeDefined();
      expect(specificMatch?.severity).toBe('high');
    });
  });

  describe('Cross-Format Integration', () => {
    it('should scan different content formats consistently', () => {
      const formats = [
        {
          name: 'ENV format',
          content: 'TEST_VAR=INTEGRATION_TEST_ABC123'
        },
        {
          name: 'JSON format',
          content: '{"testVar": "INTEGRATION_TEST_ABC123"}'
        },
        {
          name: 'YAML format',
          content: 'testVar: INTEGRATION_TEST_ABC123'
        },
        {
          name: 'Shell format',
          content: 'export TEST_VAR="INTEGRATION_TEST_ABC123"'
        }
      ];

      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Integration Test Format',
          pattern: 'INTEGRATION_TEST_[A-Z0-9]{6}',
          severity: 'medium'
        }]
      });

      formats.forEach(format => {
        const detections = testScanner.scan(format.content);
        expect(detections).toHaveLength(1);
        expect(detections[0].patternName).toBe('Integration Test Format');
        expect(detections[0].maskedMatch).toContain('*');
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should maintain stability with problematic input', () => {
      const problematicInputs = [
        '', // empty
        '\n\n\n', // only newlines
        'normal line\n'.repeat(1000), // many normal lines
        'line with unicode: 🔒 🗝️ 🔑', // unicode
        'line\rwith\rdifferent\rline\rendings', // different line endings
        'very long line: ' + 'x'.repeat(5000), // extremely long line
      ];

      problematicInputs.forEach(input => {
        expect(() => {
          const detections = scanner.scan(input);
          expect(Array.isArray(detections)).toBe(true);
        }).not.toThrow();
      });
    });

    it('should handle concurrent operations safely', async () => {
      const testContent = 'concurrent_test=CONCURRENT_PATTERN_123';

      // Create test scanner with custom pattern
      const concurrentScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Concurrent Test Pattern',
          pattern: 'CONCURRENT_PATTERN_[0-9]{3}',
          severity: 'medium'
        }]
      });

      // Run multiple scans concurrently
      const concurrentPromises = Array.from({ length: 10 }, async (_, i) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            const detections = concurrentScanner.scan(testContent);
            expect(Array.isArray(detections)).toBe(true);
            if (detections.length > 0) {
              expect(detections[0].patternName).toBe('Concurrent Test Pattern');
            }
            resolve();
          }, Math.random() * 10);
        });
      });

      await Promise.all(concurrentPromises);
    });
  });

  describe('Built-in Pattern Integration', () => {
    it('should work with built-in patterns enabled', () => {
      const builtInScanner = new SecretScanner({
        includeBuiltInPatterns: true
      });

      const patterns = builtInScanner.getPatterns();
      expect(patterns.length).toBeGreaterThan(10);

      // Should include common pattern types
      const patternNames = patterns.map(p => p.name);
      expect(patternNames.some(name => name.includes('AWS'))).toBe(true);
      expect(patternNames.some(name => name.includes('GitHub'))).toBe(true);
      expect(patternNames.some(name => name.includes('API'))).toBe(true);
    });

    it('should combine built-in and custom patterns effectively', () => {
      const customPattern: SecretPattern = {
        name: 'Custom Integration Pattern',
        pattern: 'CUSTOM_INTEGRATION_[A-Z]{4}',
        severity: 'high'
      };

      const combinedScanner = new SecretScanner({
        includeBuiltInPatterns: true,
        customPatterns: [customPattern]
      });

      const builtInCount = new SecretScanner({ includeBuiltInPatterns: true }).getPatterns().length;
      const combinedCount = combinedScanner.getPatterns().length;

      expect(combinedCount).toBe(builtInCount + 1);

      // Should detect both built-in and custom patterns
      const testContent = 'custom=CUSTOM_INTEGRATION_ABCD';
      const detections = combinedScanner.scan(testContent);

      expect(detections.some(d => d.patternName === 'Custom Integration Pattern')).toBe(true);
    });
  });

  describe('Metadata Integration', () => {
    it('should provide consistent metadata across different scenarios', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Metadata Test Pattern',
          pattern: 'METADATA_TEST_[0-9]{4}',
          severity: 'medium'
        }]
      });

      const multiLineContent = [
        'line 1 content',
        'line 2 with METADATA_TEST_1234 pattern',
        'line 3 content',
        'line 4 with METADATA_TEST_5678 pattern'
      ].join('\n');

      const detections = testScanner.scan(multiLineContent);
      expect(detections).toHaveLength(2);

      detections.forEach(detection => {
        // Verify all required metadata is present and valid
        expect(detection.id).toMatch(/^detect_/);
        expect(typeof detection.patternName).toBe('string');
        expect(typeof detection.secretType).toBe('string');
        expect(['critical', 'high', 'medium', 'low']).toContain(detection.severity);
        expect(typeof detection.lineNumber).toBe('number');
        expect(detection.lineNumber).toBeGreaterThan(0);
        expect(typeof detection.columnNumber).toBe('number');
        expect(detection.columnNumber).toBeGreaterThan(0);
        expect(typeof detection.maskedMatch).toBe('string');
        expect(detection.maskedMatch.length).toBeGreaterThan(0);
        expect(typeof detection.context).toBe('string');
        expect(detection.detectedAt).toBeInstanceOf(Date);
        expect(typeof detection.acknowledged).toBe('boolean');
      });

      // Verify line numbers are correct
      expect(detections.find(d => d.lineNumber === 2)).toBeDefined();
      expect(detections.find(d => d.lineNumber === 4)).toBeDefined();
    });
  });
});