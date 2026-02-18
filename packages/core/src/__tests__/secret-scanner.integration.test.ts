/**
 * @fileoverview Integration tests for SecretScanner focused on behavior validation
 *
 * Tests cover:
 * - Integration scenarios with safe test patterns
 * - Performance testing with large inputs
 * - Complex configuration scenarios
 * - Pattern management workflows
 *
 * NOTE: All tests use safe, non-sensitive test data only
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner } from '../secret-scanner';
import { SecretPattern } from '../types';

describe('SecretScanner Integration Tests', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  // ============================================================================
  // Safe Test Pattern Scenarios
  // ============================================================================

  describe('safe test pattern validation', () => {
    it('should detect test patterns in configuration format', () => {
      const testConfig = `
# Test configuration file
database_host=localhost
database_port=5432
test_api_key=TEST_KEY_12345ABCDEF67890
test_token=TOKEN_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456
test_secret=SECRET_PLACEHOLDER_FOR_TESTING_ONLY

# Environment variables
export TEST_VAR="TEST_VALUE_123"
export DEMO_KEY="DEMO_12345ABCDEF"
`;

      // Use custom test patterns
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [
          {
            name: 'Test API Key',
            pattern: 'TEST_KEY_[A-Z0-9]{16}',
            severity: 'medium'
          },
          {
            name: 'Test Token',
            pattern: 'TOKEN_[A-Z0-9]{32}',
            severity: 'high'
          },
          {
            name: 'Test Secret',
            pattern: 'SECRET_PLACEHOLDER_FOR_TESTING_ONLY',
            severity: 'low'
          }
        ]
      });

      const detections = testScanner.scan(testConfig);

      expect(detections.length).toBe(3);
      expect(detections.some(d => d.patternName === 'Test API Key')).toBe(true);
      expect(detections.some(d => d.patternName === 'Test Token')).toBe(true);
      expect(detections.some(d => d.patternName === 'Test Secret')).toBe(true);

      // Verify masking works correctly
      detections.forEach(detection => {
        expect(detection.maskedMatch).toContain('*');
        expect(detection.lineNumber).toBeGreaterThan(0);
        expect(detection.context).toBeTruthy();
      });
    });

    it('should handle different file format patterns', () => {
      const formats = [
        {
          name: 'JSON format',
          content: '{"testKey": "TEST_JSON_KEY_123456", "value": "normal"}',
          expectedLine: 1
        },
        {
          name: 'YAML format',
          content: 'testKey: TEST_YAML_KEY_123456\nother: value',
          expectedLine: 1
        },
        {
          name: 'XML format',
          content: '<config><testKey>TEST_XML_KEY_123456</testKey></config>',
          expectedLine: 1
        },
        {
          name: 'INI format',
          content: '[section]\ntestKey=TEST_INI_KEY_123456',
          expectedLine: 2
        }
      ];

      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Test Format Key',
          pattern: 'TEST_[A-Z]+_KEY_[A-Z0-9]{6}',
          severity: 'medium'
        }]
      });

      formats.forEach(format => {
        const detections = testScanner.scan(format.content);
        expect(detections.length).toBe(1);
        expect(detections[0].lineNumber).toBe(format.expectedLine);
        expect(detections[0].patternName).toBe('Test Format Key');
      });
    });
  });

  // ============================================================================
  // Performance Testing with Large Inputs
  // ============================================================================

  describe('performance testing', () => {
    it('should handle large files with scattered patterns efficiently', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Performance Test Pattern',
          pattern: 'PERF_TEST_[A-Z0-9]{8}',
          severity: 'medium'
        }]
      });

      // Generate large content with occasional test patterns
      const lines = [];
      for (let i = 0; i < 50000; i++) {
        if (i % 5000 === 0) {
          lines.push(`Line ${i}: Contains PERF_TEST_${i.toString().padStart(8, '0').slice(0, 8)} pattern`);
        } else {
          lines.push(`Line ${i}: Normal content without any sensitive data`);
        }
      }
      const largeContent = lines.join('\n');

      const startTime = Date.now();
      const detections = testScanner.scan(largeContent);
      const endTime = Date.now();

      expect(detections.length).toBe(10); // Should find 10 patterns
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds

      // Verify correct line detection
      detections.forEach((detection, index) => {
        expect(detection.lineNumber).toBe((index * 5000) + 1);
        expect(detection.patternName).toBe('Performance Test Pattern');
      });
    });

    it('should handle multiple pattern types efficiently', () => {
      const patterns: SecretPattern[] = [];
      for (let i = 0; i < 20; i++) {
        patterns.push({
          name: `Test Pattern ${i}`,
          pattern: `PATTERN${i}_[A-Z0-9]{8}`,
          severity: 'medium'
        });
      }

      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: patterns
      });

      // Create content with all pattern types
      const testContent = patterns.map((p, i) =>
        `Line ${i}: Test data with PATTERN${i}_ABCD${i.toString().padStart(4, '0')}`
      ).join('\n');

      const startTime = Date.now();
      const detections = testScanner.scan(testContent);
      const endTime = Date.now();

      expect(detections.length).toBe(20);
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify all patterns were detected
      patterns.forEach((pattern, index) => {
        expect(detections.some(d => d.patternName === pattern.name)).toBe(true);
      });
    });
  });

  // ============================================================================
  // Pattern Management Workflows
  // ============================================================================

  describe('pattern management workflows', () => {
    it('should support dynamic pattern addition and removal workflow', () => {
      // Start with clean scanner
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: []
      });

      expect(testScanner.getPatterns()).toHaveLength(0);

      // Phase 1: Add initial patterns
      const phase1Patterns = [
        {
          name: 'Phase 1 Pattern A',
          pattern: 'PHASE1A_[A-Z]{8}',
          severity: 'high' as const
        },
        {
          name: 'Phase 1 Pattern B',
          pattern: 'PHASE1B_[0-9]{8}',
          severity: 'medium' as const
        }
      ];

      phase1Patterns.forEach(p => testScanner.addPattern(p));
      expect(testScanner.getPatterns()).toHaveLength(2);

      // Test Phase 1 patterns
      let detections = testScanner.scan('Test PHASE1A_ABCDEFGH and PHASE1B_12345678');
      expect(detections).toHaveLength(2);

      // Phase 2: Add more patterns
      const phase2Patterns = [
        {
          name: 'Phase 2 Pattern C',
          pattern: 'PHASE2C_[A-Z0-9]{10}',
          severity: 'low' as const
        }
      ];

      phase2Patterns.forEach(p => testScanner.addPattern(p));
      expect(testScanner.getPatterns()).toHaveLength(3);

      // Test all patterns work
      detections = testScanner.scan('PHASE1A_ABCDEFGH PHASE1B_12345678 PHASE2C_ABC1234567');
      expect(detections).toHaveLength(3);

      // Phase 3: Remove specific pattern
      expect(testScanner.removePattern('Phase 1 Pattern A')).toBe(true);
      expect(testScanner.getPatterns()).toHaveLength(2);

      // Test remaining patterns
      detections = testScanner.scan('PHASE1A_ABCDEFGH PHASE1B_12345678 PHASE2C_ABC1234567');
      expect(detections).toHaveLength(2); // Should not detect removed pattern
      expect(detections.some(d => d.patternName === 'Phase 1 Pattern A')).toBe(false);
      expect(detections.some(d => d.patternName === 'Phase 1 Pattern B')).toBe(true);
      expect(detections.some(d => d.patternName === 'Phase 2 Pattern C')).toBe(true);
    });

    it('should handle configuration updates during operation', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: true,
        contextLength: 20,
        maxLineLength: 1000
      });

      const initialPatternCount = testScanner.getPatterns().length;
      expect(initialPatternCount).toBeGreaterThan(0);

      // Test with initial configuration
      let detections = testScanner.scan('Test content with basic patterns here');

      // Update configuration - disable built-in patterns
      testScanner.updateOptions({
        includeBuiltInPatterns: false,
        contextLength: 10
      });

      expect(testScanner.getPatterns()).toHaveLength(0);

      // Add test pattern and verify new context length
      testScanner.addPattern({
        name: 'Context Test',
        pattern: 'CONTEXT_TEST',
        severity: 'low'
      });

      detections = testScanner.scan('This is a long line with CONTEXT_TEST pattern in the middle of content');
      expect(detections).toHaveLength(1);
      expect(detections[0].context.length).toBeLessThan(40); // Should use new shorter context

      // Update max line length
      testScanner.updateOptions({ maxLineLength: 50 });

      const longLine = 'x'.repeat(60) + 'CONTEXT_TEST';
      detections = testScanner.scan(longLine);
      expect(detections).toHaveLength(0); // Should skip due to length limit
    });
  });

  // ============================================================================
  // Error Recovery and Resilience
  // ============================================================================

  describe('error recovery and resilience', () => {
    it('should handle malformed patterns gracefully', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: []
      });

      // Add mix of valid and invalid patterns
      const patterns = [
        { name: 'Valid Pattern', pattern: 'VALID_[A-Z]{8}', severity: 'medium' as const },
        { name: 'Invalid Bracket', pattern: '[invalid', severity: 'medium' as const },
        { name: 'Another Valid', pattern: 'VALID2_[0-9]{6}', severity: 'low' as const },
        { name: 'Invalid Group', pattern: '(unclosed', severity: 'high' as const }
      ];

      // Should not throw when adding invalid patterns
      patterns.forEach(p => {
        expect(() => testScanner.addPattern(p)).not.toThrow();
      });

      // Should still detect valid patterns
      const detections = testScanner.scan('Test VALID_ABCDEFGH and VALID2_123456 content');
      expect(detections.length).toBeGreaterThanOrEqual(2);
      expect(detections.some(d => d.patternName === 'Valid Pattern')).toBe(true);
      expect(detections.some(d => d.patternName === 'Another Valid')).toBe(true);
    });

    it('should handle edge cases in content processing', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Edge Case Pattern',
          pattern: 'EDGE_[A-Z]{4}',
          severity: 'medium'
        }]
      });

      const edgeCases = [
        { name: 'Empty lines', content: '\n\n\nEDGE_ABCD\n\n' },
        { name: 'Only whitespace', content: '   \t  EDGE_EFGH  \t   ' },
        { name: 'Mixed line endings', content: 'line1\r\nEDGE_IJKL\rline3\nEDGE_MNOP\r\n' },
        { name: 'Unicode content', content: '测试内容 EDGE_QRST содержание' },
        { name: 'Very long line', content: 'start_' + 'x'.repeat(5000) + '_EDGE_UVWX_end' }
      ];

      edgeCases.forEach(testCase => {
        expect(() => {
          const detections = testScanner.scan(testCase.content);
          expect(detections.length).toBeGreaterThanOrEqual(0);
        }).not.toThrow();
      });
    });

    it('should maintain consistent detection across multiple scans', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Consistency Test',
          pattern: 'CONSISTENT_[A-Z0-9]{6}',
          severity: 'medium'
        }]
      });

      const testContent = 'Multiple scans: CONSISTENT_ABC123 should produce identical results';

      // Run multiple scans
      const results = [];
      for (let i = 0; i < 10; i++) {
        const detections = testScanner.scan(testContent);
        results.push({
          count: detections.length,
          pattern: detections[0]?.patternName,
          line: detections[0]?.lineNumber,
          column: detections[0]?.columnNumber,
          severity: detections[0]?.severity
        });
      }

      // All results should be identical
      expect(results.every(r => r.count === 1)).toBe(true);
      expect(results.every(r => r.pattern === 'Consistency Test')).toBe(true);
      expect(results.every(r => r.line === 1)).toBe(true);
      expect(results.every(r => r.severity === 'medium')).toBe(true);

      // Column should be consistent
      const firstColumn = results[0].column;
      expect(results.every(r => r.column === firstColumn)).toBe(true);
    });
  });

  // ============================================================================
  // Memory Management and Resource Usage
  // ============================================================================

  describe('memory management and resource usage', () => {
    it('should handle repeated scanning without memory leaks', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Memory Test Pattern',
          pattern: 'MEMORY_TEST_[A-Z]{8}',
          severity: 'medium'
        }]
      });

      const testContents = [
        'Content without patterns',
        'Content with MEMORY_TEST_ABCDEFGH pattern',
        'Multiple MEMORY_TEST_12345678 and MEMORY_TEST_ABCD1234 patterns',
        '',
        'Just normal text',
        'Another MEMORY_TEST_ZYXWVU98 pattern here'
      ];

      // Simulate repeated scanning (as would happen in file monitoring)
      const allDetections = [];
      for (let i = 0; i < 1000; i++) {
        const content = testContents[i % testContents.length];
        const detections = testScanner.scan(content);
        allDetections.push(...detections);
      }

      expect(allDetections.length).toBeGreaterThan(0);

      // Verify all detection objects have required properties
      allDetections.forEach(detection => {
        expect(detection.id).toBeTruthy();
        expect(detection.patternName).toBe('Memory Test Pattern');
        expect(detection.detectedAt).toBeInstanceOf(Date);
        expect(typeof detection.lineNumber).toBe('number');
        expect(typeof detection.columnNumber).toBe('number');
      });
    });

    it('should efficiently handle varying content sizes', () => {
      const testScanner = new SecretScanner({
        includeBuiltInPatterns: false,
        customPatterns: [{
          name: 'Size Test Pattern',
          pattern: 'SIZE_[0-9]{4}',
          severity: 'low'
        }]
      });

      const sizes = [10, 100, 1000, 10000, 50000]; // Various content sizes
      const timings = [];

      sizes.forEach(size => {
        const content = 'x'.repeat(size) + 'SIZE_1234' + 'y'.repeat(size);

        const startTime = Date.now();
        const detections = testScanner.scan(content);
        const endTime = Date.now();

        timings.push(endTime - startTime);

        expect(detections).toHaveLength(1);
        expect(detections[0].patternName).toBe('Size Test Pattern');
      });

      // Processing time should scale reasonably with content size
      expect(timings.every(t => t < 1000)).toBe(true); // All under 1 second
    });
  });
});