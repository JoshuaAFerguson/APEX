/**
 * @fileoverview Performance and stress tests for DangerousOperationDetector
 * Tests detector performance under various load conditions and stress scenarios
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  DangerousOperationDetector,
  type DangerousPattern,
} from '../dangerous-operation-detector.js';
import type { ToolDefinition, ToolInvocation } from '../types.js';

// Test data helpers
const createToolDef = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: 'TestTool',
  description: 'Test tool',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  dangerous: false,
  permissions: [],
  category: 'custom',
  enabled: true,
  ...overrides,
});

const createInvocation = (parameters: Record<string, unknown> = {}): ToolInvocation => ({
  toolName: 'TestTool',
  parameters,
});

describe('DangerousOperationDetector Performance Tests', () => {
  let detector: DangerousOperationDetector;

  beforeEach(() => {
    detector = new DangerousOperationDetector();
  });

  describe('Pattern matching performance', () => {
    it('should handle very long input strings efficiently', () => {
      const longSafeString = 'safe'.repeat(50000); // 200KB string
      const longDangerousString = 'safe'.repeat(25000) + '/etc/passwd' + 'safe'.repeat(25000);

      const toolDef = createToolDef({ name: 'Read' });

      // Test safe long string
      const safeInvocation = createInvocation({ file_path: longSafeString });
      const safeStartTime = Date.now();
      const safeResult = detector.detectDangerousOperation(toolDef, safeInvocation);
      const safeEndTime = Date.now();

      expect(safeResult.isDangerous).toBe(false);
      expect(safeEndTime - safeStartTime).toBeLessThan(50); // Should be very fast

      // Test dangerous long string
      const dangerousInvocation = createInvocation({ file_path: longDangerousString });
      const dangerousStartTime = Date.now();
      const dangerousResult = detector.detectDangerousOperation(toolDef, dangerousInvocation);
      const dangerousEndTime = Date.now();

      expect(dangerousResult.isDangerous).toBe(true);
      expect(dangerousEndTime - dangerousStartTime).toBeLessThan(50); // Should still be fast
    });

    it('should handle many custom patterns efficiently', () => {
      const patterns: DangerousPattern[] = [];

      // Create 500 diverse patterns
      for (let i = 0; i < 500; i++) {
        patterns.push({
          pattern: new RegExp(`dangerous_pattern_${i}`, 'i'),
          severity: 'high',
          category: `category_${i % 10}`,
          description: `Dangerous pattern ${i}`,
        });
      }

      const detector = new DangerousOperationDetector({
        customPatterns: patterns,
      });

      const toolDef = createToolDef();
      const invocation = createInvocation({
        data: 'some safe content that does not match any patterns',
      });

      const startTime = Date.now();
      const result = detector.detectDangerousOperation(toolDef, invocation);
      const endTime = Date.now();

      expect(result.isDangerous).toBe(false);
      expect(endTime - startTime).toBeLessThan(100); // Should handle many patterns efficiently
    });

    it('should handle complex regex patterns without excessive backtracking', () => {
      // Patterns that could potentially cause ReDoS (Regular Expression Denial of Service)
      const potentiallySlowPatterns: DangerousPattern[] = [
        {
          pattern: /^(a|a)*$/,
          severity: 'high',
          category: 'redos_test_1',
          description: 'Potential ReDoS pattern 1',
        },
        {
          pattern: /(a+)+b/,
          severity: 'high',
          category: 'redos_test_2',
          description: 'Potential ReDoS pattern 2',
        },
        {
          pattern: /(a|a)*b/,
          severity: 'high',
          category: 'redos_test_3',
          description: 'Potential ReDoS pattern 3',
        },
      ];

      const detector = new DangerousOperationDetector({
        customPatterns: potentiallySlowPatterns,
      });

      const toolDef = createToolDef();

      // Test with input that doesn't match (worst case for ReDoS)
      const problematicInput = 'a'.repeat(20) + 'c'; // Many 'a's but no 'b'
      const invocation = createInvocation({ data: problematicInput });

      const startTime = Date.now();
      const result = detector.detectDangerousOperation(toolDef, invocation);
      const endTime = Date.now();

      expect(result.isDangerous).toBe(false);
      // Should complete quickly even with potentially problematic patterns
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should maintain consistent performance with repeated calls', () => {
      const toolDef = createToolDef({ name: 'Bash' });
      const invocation = createInvocation({
        command: 'echo "test command"',
      });

      const times: number[] = [];
      const iterations = 100;

      // Run many iterations to check for performance degradation
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        detector.detectDangerousOperation(toolDef, invocation);
        const endTime = Date.now();
        times.push(endTime - startTime);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(averageTime).toBeLessThan(5); // Average should be very fast
      expect(maxTime).toBeLessThan(20); // Even worst case should be fast
    });
  });

  describe('Memory usage and resource management', () => {
    it('should not leak memory with many detector instances', () => {
      const detectors: DangerousOperationDetector[] = [];

      // Create many detector instances
      for (let i = 0; i < 100; i++) {
        detectors.push(new DangerousOperationDetector({
          customPatterns: [{
            pattern: new RegExp(`test${i}`),
            severity: 'low',
            category: 'test',
            description: 'Test pattern',
          }],
        }));
      }

      const toolDef = createToolDef();
      const invocation = createInvocation({ data: 'test data' });

      // Use all detectors
      const startTime = Date.now();
      for (const det of detectors) {
        det.detectDangerousOperation(toolDef, invocation);
      }
      const endTime = Date.now();

      // Should complete reasonably quickly even with many instances
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should handle large configuration objects efficiently', () => {
      const largeCustomPatterns: DangerousPattern[] = [];

      // Create a large configuration
      for (let i = 0; i < 1000; i++) {
        largeCustomPatterns.push({
          pattern: new RegExp(`pattern${i}_${Math.random().toString(36)}`),
          severity: i % 2 === 0 ? 'high' : 'low',
          category: `category_${i % 20}`,
          description: `Auto-generated pattern ${i} with description containing some longer text to simulate real-world usage patterns`,
          applicableTools: i % 3 === 0 ? ['Read', 'Write'] : undefined,
        });
      }

      const startTime = Date.now();
      const detector = new DangerousOperationDetector({
        customPatterns: largeCustomPatterns,
      });
      const creationTime = Date.now() - startTime;

      expect(creationTime).toBeLessThan(100); // Creation should be fast

      // Test getDangerCategories performance with large config
      const categoriesStartTime = Date.now();
      const categories = detector.getDangerCategories();
      const categoriesEndTime = Date.now();

      expect(categories.length).toBeGreaterThan(15);
      expect(categoriesEndTime - categoriesStartTime).toBeLessThan(50);
    });
  });

  describe('Concurrent usage simulation', () => {
    it('should handle multiple simultaneous detection calls', async () => {
      const toolDef = createToolDef({ name: 'Read' });
      const invocations = [
        createInvocation({ file_path: '/safe/file1.txt' }),
        createInvocation({ file_path: '/etc/passwd' }),
        createInvocation({ file_path: '/home/user/.ssh/id_rsa' }),
        createInvocation({ file_path: '/tmp/safe_file.txt' }),
        createInvocation({ file_path: '/app/config.env' }),
      ];

      // Simulate concurrent calls
      const startTime = Date.now();
      const promises = invocations.map(inv =>
        Promise.resolve(detector.detectDangerousOperation(toolDef, inv))
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(results[0].isDangerous).toBe(false); // safe file
      expect(results[1].isDangerous).toBe(true);  // /etc/passwd
      expect(results[2].isDangerous).toBe(true);  // ssh key
      expect(results[3].isDangerous).toBe(false); // tmp file
      expect(results[4].isDangerous).toBe(true);  // .env file

      // Should handle concurrent calls efficiently
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should maintain thread safety with shared detector instance', async () => {
      const sharedDetector = new DangerousOperationDetector();
      const toolDef = createToolDef({ name: 'Bash' });

      const commands = [
        'echo "safe command"',
        'rm -rf /',
        'sudo systemctl stop service',
        'ls -la',
        'chmod 777 /etc/passwd',
      ];

      // Create many concurrent operations
      const operations = [];
      for (let i = 0; i < 50; i++) {
        const command = commands[i % commands.length];
        const invocation = createInvocation({ command });
        operations.push(
          Promise.resolve(sharedDetector.detectDangerousOperation(toolDef, invocation))
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();

      expect(results).toHaveLength(50);

      // Verify results are consistent
      const safeResults = results.filter((_, idx) => {
        const cmd = commands[idx % commands.length];
        return cmd === 'echo "safe command"' || cmd === 'ls -la';
      });
      const dangerousResults = results.filter((_, idx) => {
        const cmd = commands[idx % commands.length];
        return cmd !== 'echo "safe command"' && cmd !== 'ls -la';
      });

      safeResults.forEach(result => {
        expect(result.isDangerous).toBe(false);
      });

      dangerousResults.forEach(result => {
        expect(result.isDangerous).toBe(true);
      });

      // Should handle concurrent operations efficiently
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('Stress testing with extreme inputs', () => {
    it('should handle extremely large parameter objects', () => {
      const hugeParameterObject: Record<string, unknown> = {};

      // Create object with many properties
      for (let i = 0; i < 1000; i++) {
        hugeParameterObject[`param_${i}`] = `value_${i}`.repeat(100);
      }

      const toolDef = createToolDef();
      const invocation = createInvocation(hugeParameterObject);

      const startTime = Date.now();
      const result = detector.detectDangerousOperation(toolDef, invocation);
      const endTime = Date.now();

      expect(result.isDangerous).toBe(false);
      expect(endTime - startTime).toBeLessThan(200); // Should handle large objects reasonably
    });

    it('should handle patterns with various character encodings', () => {
      const customPatterns: DangerousPattern[] = [{
        pattern: /[\u0000-\u001F\u007F-\u009F]/,  // Control characters
        severity: 'medium',
        category: 'control_chars',
        description: 'Control characters detected',
      }];

      const detector = new DangerousOperationDetector({ customPatterns });
      const toolDef = createToolDef();

      // Test with control characters
      const invocation = createInvocation({
        data: 'normal text\x00\x01\x1F',
      });

      const startTime = Date.now();
      const result = detector.detectDangerousOperation(toolDef, invocation);
      const endTime = Date.now();

      expect(result.isDangerous).toBe(true);
      expect(result.category).toBe('control_chars');
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should handle rapid successive calls without performance degradation', () => {
      const toolDef = createToolDef({ name: 'Read' });
      const testFiles = [
        '/safe/file.txt',
        '/etc/passwd',
        '/home/user/.bashrc',
        '/tmp/temp.txt',
        '/usr/bin/dangerous',
      ];

      const times: number[] = [];

      // Make many rapid calls
      for (let i = 0; i < 200; i++) {
        const filePath = testFiles[i % testFiles.length];
        const invocation = createInvocation({ file_path: filePath });

        const startTime = Date.now();
        detector.detectDangerousOperation(toolDef, invocation);
        const endTime = Date.now();

        times.push(endTime - startTime);
      }

      // Check that performance doesn't degrade over time
      const firstQuartile = times.slice(0, 50);
      const lastQuartile = times.slice(-50);

      const avgFirst = firstQuartile.reduce((a, b) => a + b, 0) / firstQuartile.length;
      const avgLast = lastQuartile.reduce((a, b) => a + b, 0) / lastQuartile.length;

      // Performance should not significantly degrade
      expect(avgLast).toBeLessThan(avgFirst * 2);
      expect(Math.max(...times)).toBeLessThan(20);
    });
  });
});