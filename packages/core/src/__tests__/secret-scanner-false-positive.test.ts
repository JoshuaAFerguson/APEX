import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner } from '../secret-scanner';
import { SecretPattern } from '../types';

describe('SecretScanner False Positive Handling', () => {
  let scanner: SecretScanner;
  let testPattern: SecretPattern;

  beforeEach(() => {
    // Use a completely safe test pattern that cannot be mistaken for real credentials
    testPattern = {
      name: 'Safe Test Pattern',
      pattern: 'SAFE_[A-Z]{4}',
      severity: 'medium',
      description: 'Safe pattern for testing false positives'
    };

    scanner = new SecretScanner({
      includeBuiltInPatterns: false,
      customPatterns: [testPattern]
    });
  });

  describe('Test File Content Context Detection', () => {
    it('should detect patterns in test files and provide contextual information', () => {
      const testFileContent = `
        // test/auth.test.js
        const mockValue = 'SAFE_TEST';
        describe('auth tests', () => {
          it('should work with SAFE_DEMO', () => {
            // test implementation
          });
        });
      `;

      const detections = scanner.scan(testFileContent);
      expect(detections).toHaveLength(2);

      // Verify detection metadata
      detections.forEach(detection => {
        expect(detection.id).toBeTruthy();
        expect(detection.patternName).toBe('Safe Test Pattern');
        expect(detection.lineNumber).toBeGreaterThan(0);
        expect(detection.columnNumber).toBeGreaterThan(0);
        expect(detection.context).toBeTruthy();
        expect(detection.maskedMatch).toContain('*');
        expect(detection.acknowledged).toBe(false);
      });

      // Check context includes test-related indicators
      const testContextDetection = detections.find(d =>
        d.context?.includes('test/auth.test.js')
      );
      expect(testContextDetection).toBeDefined();
    });

    it('should distinguish between different file contexts', () => {
      const contexts = [
        { content: 'production_config: SAFE_PROD', context: 'production' },
        { content: 'test_config: SAFE_TEST', context: 'test' },
        { content: 'example_value: SAFE_DEMO', context: 'example' },
        { content: '# comment: SAFE_DOCS', context: 'docs' }
      ];

      contexts.forEach(({ content, context }) => {
        const detections = scanner.scan(content);
        expect(detections).toHaveLength(1);

        const detection = detections[0];
        expect(detection.context?.toLowerCase()).toContain(context);
      });
    });
  });

  describe('Documentation Context Handling', () => {
    it('should detect patterns in documentation examples', () => {
      const docContent = `
        # Configuration Guide

        Set your value:
        \`\`\`
        export VALUE="SAFE_CONF"
        \`\`\`

        Example:
        const config = 'SAFE_EXMP';
      `;

      const detections = scanner.scan(docContent);
      expect(detections).toHaveLength(2);

      // Should detect in code blocks and examples
      detections.forEach(detection => {
        expect(detection.patternName).toBe('Safe Test Pattern');
        expect(detection.context).toBeTruthy();
      });
    });

    it('should handle comments and inline documentation', () => {
      const commentContent = `
        /**
         * Example configuration
         * Use value: SAFE_CMNT
         */
        function setup() {
          // TODO: Replace SAFE_TODO with actual value
          return true;
        }
      `;

      const detections = scanner.scan(commentContent);
      expect(detections).toHaveLength(2);

      // Check for comment context
      const commentDetection = detections.find(d =>
        d.context?.includes('*') || d.context?.includes('//')
      );
      expect(commentDetection).toBeDefined();
    });
  });

  describe('Template and Configuration File Handling', () => {
    it('should detect patterns in template files', () => {
      const templateContent = `
        # .env.example
        CONFIG_VALUE=SAFE_TMPL

        # Replace with your actual values
        ANOTHER_VALUE=SAFE_REPL
      `;

      const detections = scanner.scan(templateContent);
      expect(detections).toHaveLength(2);

      detections.forEach(detection => {
        expect(detection.context?.includes('.env.example')).toBe(true);
      });
    });

    it('should handle fixture and test data files', () => {
      const fixtureContent = `
        # fixtures/data.yml
        test_user:
          value: "SAFE_FIXD"
        admin:
          config: "SAFE_ADMN"
      `;

      const detections = scanner.scan(fixtureContent);
      expect(detections).toHaveLength(2);

      detections.forEach(detection => {
        expect(detection.context?.includes('fixtures/data.yml')).toBe(true);
      });
    });
  });

  describe('Context Quality and Analysis', () => {
    it('should provide sufficient context for false positive analysis', () => {
      const content = 'prefix_text_before_SAFE_CTXT_suffix_text_after';

      const detections = scanner.scan(content);
      expect(detections).toHaveLength(1);

      const detection = detections[0];
      expect(detection.context).toContain('prefix_text_before');
      expect(detection.context).toContain('SAFE_CTXT');
      expect(detection.context).toContain('suffix_text_after');
      expect(detection.context!.length).toBeGreaterThan(10);
    });

    it('should generate unique IDs for each detection', () => {
      const content = `
        line1: SAFE_ONE1
        line2: SAFE_TWO2
        line3: SAFE_THR3
      `;

      const detections = scanner.scan(content);
      expect(detections).toHaveLength(3);

      const ids = detections.map(d => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);

      ids.forEach(id => {
        expect(id).toMatch(/^detect_/);
      });
    });

    it('should provide accurate line and column information', () => {
      const multilineContent = `first line
      second line with SAFE_LINE here
      third line`;

      const detections = scanner.scan(multilineContent);
      expect(detections).toHaveLength(1);

      const detection = detections[0];
      expect(detection.lineNumber).toBe(2);
      expect(detection.columnNumber).toBeGreaterThan(15);
    });
  });

  describe('Secret Masking Consistency', () => {
    it('should mask secrets consistently across contexts', () => {
      const contexts = [
        'production: SAFE_MASK',
        'testing: SAFE_MASK',
        'example: SAFE_MASK',
        '# comment: SAFE_MASK'
      ];

      contexts.forEach(content => {
        const detections = scanner.scan(content);
        expect(detections).toHaveLength(1);

        const detection = detections[0];
        expect(detection.maskedMatch).toBe('SA***ASK');
      });
    });

    it('should handle different pattern lengths appropriately', () => {
      // Test short pattern
      const shortScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Short Pattern',
          pattern: 'SH_[A-Z]{2}',
          severity: 'low'
        }]
      });

      const shortDetection = shortScanner.scan('value=SH_AB');
      expect(shortDetection).toHaveLength(1);
      expect(shortDetection[0].maskedMatch).toBe('*****');
    });
  });

  describe('Pattern Management and Configuration', () => {
    it('should handle dynamic pattern addition', () => {
      const dynamicScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: []
      });

      dynamicScanner.addPattern({
        name: 'Dynamic Pattern',
        pattern: 'DYN_[0-9]{3}',
        severity: 'low'
      });

      const detections = dynamicScanner.scan('config=DYN_123');
      expect(detections).toHaveLength(1);
      expect(detections[0].patternName).toBe('Dynamic Pattern');
    });

    it('should maintain consistency when patterns change', () => {
      const content = 'value=SAFE_TSTD';

      // Initial scan
      const originalDetections = scanner.scan(content);
      expect(originalDetections).toHaveLength(1);

      // Add another pattern that might also match
      scanner.addPattern({
        name: 'Additional Pattern',
        pattern: 'SAFE_[A-Z]{4}',
        severity: 'high'
      });

      const newDetections = scanner.scan(content);
      expect(newDetections).toHaveLength(2);

      // Remove added pattern
      scanner.removePattern('Additional Pattern');
      const finalDetections = scanner.scan(content);
      expect(finalDetections).toHaveLength(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid input gracefully', () => {
      const invalidInputs = [null, undefined, '', '   ', 123, {}, []];

      invalidInputs.forEach(input => {
        expect(() => scanner.scan(input as any)).not.toThrow();
        const detections = scanner.scan(input as any);
        expect(Array.isArray(detections)).toBe(true);
        expect(detections).toHaveLength(0);
      });
    });

    it('should respect line length limits', () => {
      const limitedScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [testPattern],
        maxLineLength: 50
      });

      const shortLine = 'config=SAFE_SHRT';
      const longLine = 'x'.repeat(100) + 'SAFE_LONG' + 'x'.repeat(100);

      expect(limitedScanner.scan(shortLine)).toHaveLength(1);
      expect(limitedScanner.scan(longLine)).toHaveLength(0);
    });
  });

  describe('Integration Testing', () => {
    it('should work correctly with built-in patterns enabled', () => {
      const combinedScanner = new SecretScanner({
        includeBuiltInPatterns: true,
        customPatterns: [testPattern]
      });

      const content = 'test=SAFE_INTG';
      const detections = combinedScanner.scan(content);

      expect(detections.length).toBeGreaterThanOrEqual(1);

      const customDetection = detections.find(d =>
        d.patternName === 'Safe Test Pattern'
      );
      expect(customDetection).toBeDefined();

      // Should have both custom and built-in patterns
      const allPatterns = combinedScanner.getPatterns();
      expect(allPatterns.length).toBeGreaterThan(1);
      expect(allPatterns.some(p => p.name === 'Safe Test Pattern')).toBe(true);
    });

    it('should handle scanner reconfiguration', () => {
      scanner.updateOptions({
        contextLength: 5,
        maxLineLength: 1000
      });

      const content = 'before_SAFE_RECONFIG_after';
      const detections = scanner.scan(content);

      expect(detections).toHaveLength(1);
      expect(detections[0].context!.length).toBeLessThan(content.length);
    });
  });
});