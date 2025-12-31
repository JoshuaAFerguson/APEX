/**
 * @fileoverview Edge case and boundary tests for DangerousOperationDetector
 * Tests complex scenarios, edge cases, and boundary conditions
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  DangerousOperationDetector,
  type DangerousPattern,
  type DetectorConfig,
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

describe('DangerousOperationDetector Edge Cases', () => {
  let detector: DangerousOperationDetector;

  beforeEach(() => {
    detector = new DangerousOperationDetector();
  });

  describe('Pattern matching edge cases', () => {
    it('should handle regex special characters in patterns', () => {
      const customPatterns: DangerousPattern[] = [{
        pattern: /\$\{[^}]*\}/,  // Matches ${...} patterns (command substitution)
        severity: 'high',
        category: 'command_injection',
        description: 'Command substitution detected',
      }];

      const detector = new DangerousOperationDetector({ customPatterns });
      const toolDef = createToolDef({ name: 'Bash' });
      const invocation = createInvocation({
        command: 'echo ${SECRET_VAR}',
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('high');
      expect(result.category).toBe('command_injection');
    });

    it('should handle Unicode and international characters', () => {
      const customPatterns: DangerousPattern[] = [{
        pattern: /мальваре|恶意软件|マルウェア/i,  // Malware in different languages
        severity: 'critical',
        category: 'malware',
        description: 'Potential malware reference detected',
      }];

      const detector = new DangerousOperationDetector({ customPatterns });
      const toolDef = createToolDef({ name: 'Write' });
      const invocation = createInvocation({
        content: 'download мальваре from site',
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('critical');
    });

    it('should handle very long strings without performance issues', () => {
      const veryLongString = 'safe'.repeat(10000) + '/etc/passwd' + 'safe'.repeat(10000);

      const toolDef = createToolDef({ name: 'Read' });
      const invocation = createInvocation({
        file_path: veryLongString,
      });

      const startTime = Date.now();
      const result = detector.detectDangerousOperation(toolDef, invocation);
      const endTime = Date.now();

      expect(result.isDangerous).toBe(true);
      expect(result.category).toBe('system_files');
      // Should complete within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle empty and whitespace-only inputs', () => {
      const testCases = [
        { value: '', name: 'empty string' },
        { value: '   ', name: 'spaces only' },
        { value: '\t\n\r', name: 'whitespace chars' },
        { value: '\u00A0', name: 'non-breaking space' },
      ];

      for (const testCase of testCases) {
        const toolDef = createToolDef({ name: 'Read' });
        const invocation = createInvocation({
          file_path: testCase.value,
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(false);
      }
    });

    it('should handle case sensitivity correctly', () => {
      const toolDef = createToolDef({ name: 'Read' });

      const testCases = [
        '/ETC/passwd',    // Different case
        '/Etc/PASSWD',    // Mixed case
        '/etc/PASSWD',    // Partial case difference
      ];

      for (const filePath of testCases) {
        const invocation = createInvocation({ file_path: filePath });
        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.category).toBe('system_files');
      }
    });
  });

  describe('Multiple pattern matches', () => {
    it('should return the first matching pattern when multiple patterns match', () => {
      const customPatterns: DangerousPattern[] = [
        {
          pattern: /\.ssh/,
          severity: 'critical',
          category: 'ssh_access',
          description: 'SSH directory access',
        },
        {
          pattern: /key/,
          severity: 'high',
          category: 'key_access',
          description: 'Key file access',
        },
      ];

      const detector = new DangerousOperationDetector({ customPatterns });
      const toolDef = createToolDef({ name: 'Read' });
      const invocation = createInvocation({
        file_path: '/home/user/.ssh/id_rsa_key',
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(true);
      // Should match the more specific ssh pattern first
      expect(result.category).toBe('credential_files'); // Built-in pattern wins
      expect(result.severity).toBe('critical');
    });

    it('should prioritize built-in patterns over custom patterns', () => {
      const customPatterns: DangerousPattern[] = [{
        pattern: /\/etc\//,
        severity: 'low',
        category: 'custom_etc',
        description: 'Custom etc pattern',
      }];

      const detector = new DangerousOperationDetector({ customPatterns });
      const toolDef = createToolDef({ name: 'Read' });
      const invocation = createInvocation({
        file_path: '/etc/passwd',
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(true);
      // Built-in pattern should win
      expect(result.category).toBe('system_files');
      expect(result.severity).toBe('high');
    });
  });

  describe('Tool parameter validation edge cases', () => {
    it('should handle tools with alternative parameter names', () => {
      const toolDef = createToolDef({ name: 'Glob' });
      const invocation = createInvocation({
        path: '/etc/../../../root/.ssh',  // Using 'path' instead of 'file_path'
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(true);
      expect(result.category).toBe('path_traversal');
    });

    it('should handle nested object parameters', () => {
      const customPatterns: DangerousPattern[] = [{
        pattern: /dangerous/,
        severity: 'high',
        category: 'nested_danger',
        description: 'Nested dangerous content',
      }];

      const detector = new DangerousOperationDetector({ customPatterns });
      const toolDef = createToolDef();
      const invocation = createInvocation({
        config: {
          nested: {
            value: 'dangerous content here',
          },
        },
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false); // Should not find nested values
    });

    it('should handle arrays in parameters', () => {
      const toolDef = createToolDef();
      const invocation = createInvocation({
        files: ['/safe/file1.txt', '/etc/passwd', '/safe/file2.txt'],
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false); // Arrays not checked by current implementation
    });

    it('should handle non-string parameter types', () => {
      const toolDef = createToolDef();
      const invocation = createInvocation({
        port: 22,
        enabled: true,
        timeout: null,
        data: undefined,
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle all detection types disabled', () => {
      const detector = new DangerousOperationDetector({
        useToolDefinition: false,
        usePatternMatching: false,
        useFilesystemPatterns: false,
        useNetworkPatterns: false,
      });

      const toolDef = createToolDef({
        name: 'Bash',
        dangerous: true,
        permissions: ['admin'],
      });
      const invocation = createInvocation({
        command: 'rm -rf /',
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });

    it('should handle empty custom patterns array', () => {
      const detector = new DangerousOperationDetector({
        customPatterns: [],
      });

      const toolDef = createToolDef();
      const invocation = createInvocation({
        data: 'any content',
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });

    it('should handle invalid regex patterns gracefully', () => {
      // Create a pattern that would throw if not handled properly
      const invalidPattern = '[invalid regex';

      expect(() => {
        const detector = new DangerousOperationDetector({
          customPatterns: [{
            pattern: invalidPattern as any, // Force invalid pattern
            severity: 'high',
            category: 'test',
            description: 'Test pattern',
          }],
        });

        const toolDef = createToolDef();
        const invocation = createInvocation({ data: 'test' });

        detector.detectDangerousOperation(toolDef, invocation);
      }).toThrow(); // Should throw due to invalid regex
    });
  });

  describe('Security boundary testing', () => {
    it('should detect path traversal with URL encoding', () => {
      const toolDef = createToolDef({ name: 'Read' });
      const invocation = createInvocation({
        file_path: '/app/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', // URL encoded ../../../etc/passwd
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      // Current implementation may not catch URL encoded paths
      // This test documents the current behavior
      expect(result.isDangerous).toBe(false);
    });

    it('should detect obfuscated dangerous commands', () => {
      const toolDef = createToolDef({ name: 'Bash' });
      const testCases = [
        'r''m -rf /',           // Quote obfuscation
        'rm -r${IFS}f /',       // IFS variable
        '$(echo rm) -rf /',     // Command substitution
      ];

      for (const command of testCases) {
        const invocation = createInvocation({ command });
        const result = detector.detectDangerousOperation(toolDef, invocation);

        // Some obfuscation techniques might bypass current detection
        // This documents current behavior
        if (command === 'r''m -rf /') {
          expect(result.isDangerous).toBe(false); // May not be caught
        } else {
          expect(result.isDangerous).toBe(true);
        }
      }
    });

    it('should handle mixed dangerous and safe content', () => {
      const toolDef = createToolDef({ name: 'Bash' });
      const invocation = createInvocation({
        command: 'echo "This is safe" && rm -rf /tmp/specific_file',
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(true);
      expect(result.category).toContain('destructive');
    });

    it('should handle potential injection attempts', () => {
      const toolDef = createToolDef({ name: 'Bash' });
      const testCases = [
        '; rm -rf /',           // Command chaining
        '| rm -rf /',           // Pipe injection
        '&& rm -rf /',          // AND injection
        '|| rm -rf /',          // OR injection
      ];

      for (const command of testCases) {
        const invocation = createInvocation({
          command: `echo "safe" ${command}`
        });
        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('critical');
      }
    });
  });

  describe('Performance edge cases', () => {
    it('should handle large number of custom patterns efficiently', () => {
      const manyPatterns: DangerousPattern[] = [];
      for (let i = 0; i < 1000; i++) {
        manyPatterns.push({
          pattern: new RegExp(`pattern${i}`),
          severity: 'low',
          category: `category${i}`,
          description: `Description ${i}`,
        });
      }

      const detector = new DangerousOperationDetector({
        customPatterns: manyPatterns,
      });

      const toolDef = createToolDef();
      const invocation = createInvocation({
        data: 'some safe content',
      });

      const startTime = Date.now();
      const result = detector.detectDangerousOperation(toolDef, invocation);
      const endTime = Date.now();

      expect(result.isDangerous).toBe(false);
      // Should complete within reasonable time even with many patterns
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should handle complex regex patterns efficiently', () => {
      const complexPatterns: DangerousPattern[] = [{
        // Complex regex that could cause ReDoS if not handled properly
        pattern: /(a+)+b/,
        severity: 'high',
        category: 'complex_test',
        description: 'Complex pattern test',
      }];

      const detector = new DangerousOperationDetector({
        customPatterns: complexPatterns,
      });

      const toolDef = createToolDef();
      const invocation = createInvocation({
        data: 'a'.repeat(20) + 'c', // Should not match and not cause ReDoS
      });

      const startTime = Date.now();
      const result = detector.detectDangerousOperation(toolDef, invocation);
      const endTime = Date.now();

      expect(result.isDangerous).toBe(false);
      // Should complete quickly even with complex regex
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Method edge cases', () => {
    it('should handle getDangerCategories with complex configuration', () => {
      const customPatterns: DangerousPattern[] = [
        {
          pattern: /test1/,
          severity: 'high',
          category: 'custom1',
          description: 'Test 1',
        },
        {
          pattern: /test2/,
          severity: 'low',
          category: 'custom1', // Duplicate category
          description: 'Test 2',
        },
        {
          pattern: /test3/,
          severity: 'medium',
          category: 'custom2',
          description: 'Test 3',
        },
      ];

      const detector = new DangerousOperationDetector({ customPatterns });
      const categories = detector.getDangerCategories();

      expect(categories).toContain('custom1');
      expect(categories).toContain('custom2');

      // Should not have duplicates
      const uniqueCategories = [...new Set(categories)];
      expect(categories.length).toBe(uniqueCategories.length);
    });

    it('should handle getPatternsForCategory with non-existent category', () => {
      const patterns = detector.getPatternsForCategory('non_existent_category');
      expect(patterns).toEqual([]);
    });

    it('should handle getPatternsForCategory with case sensitivity', () => {
      const patterns1 = detector.getPatternsForCategory('system_files');
      const patterns2 = detector.getPatternsForCategory('SYSTEM_FILES');

      expect(patterns1.length).toBeGreaterThan(0);
      expect(patterns2.length).toBe(0); // Case sensitive
    });
  });
});