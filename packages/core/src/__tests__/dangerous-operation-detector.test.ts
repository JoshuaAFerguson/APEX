/**
 * @fileoverview Tests for DangerousOperationDetector
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  DangerousOperationDetector,
  createDefaultDetector,
  isOperationDangerous,
  getConfirmationRequirements,
  type DangerousPattern,
  type DetectorConfig,
} from '../dangerous-operation-detector.js';
import type { ToolDefinition, ToolInvocation } from '../types.js';

// Test data setup
const createToolDefinition = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: 'TestTool',
  description: 'Test tool for dangerous operation detection',
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

const createToolInvocation = (parameters: Record<string, unknown> = {}): ToolInvocation => ({
  toolName: 'TestTool',
  parameters,
});

describe('DangerousOperationDetector', () => {
  let detector: DangerousOperationDetector;

  beforeEach(() => {
    detector = new DangerousOperationDetector();
  });

  describe('constructor', () => {
    it('should create detector with default configuration', () => {
      const defaultDetector = new DangerousOperationDetector();
      expect(defaultDetector).toBeInstanceOf(DangerousOperationDetector);
    });

    it('should create detector with custom configuration', () => {
      const config: Partial<DetectorConfig> = {
        useToolDefinition: false,
        usePatternMatching: false,
        customPatterns: [{
          pattern: /test/,
          severity: 'high',
          category: 'test',
          description: 'Test pattern',
        }],
      };
      const customDetector = new DangerousOperationDetector(config);
      expect(customDetector).toBeInstanceOf(DangerousOperationDetector);
    });
  });

  describe('detectDangerousOperation', () => {
    describe('tool definition dangerous flag', () => {
      it('should detect dangerous tool marked in definition', () => {
        const toolDef = createToolDefinition({ dangerous: true });
        const invocation = createToolInvocation();

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.category).toBe('tool_definition');
        expect(result.reason).toContain('marked as dangerous');
        expect(result.confirmation).toBeDefined();
      });

      it('should determine severity based on permissions', () => {
        const testCases = [
          { permissions: ['admin'], expectedSeverity: 'critical' },
          { permissions: ['execute'], expectedSeverity: 'high' },
          { permissions: ['write'], expectedSeverity: 'medium' },
          { permissions: ['read'], expectedSeverity: 'low' },
          { permissions: [], expectedSeverity: 'low' },
        ];

        for (const testCase of testCases) {
          const toolDef = createToolDefinition({
            dangerous: true,
            permissions: testCase.permissions as any,
          });
          const invocation = createToolInvocation();

          const result = detector.detectDangerousOperation(toolDef, invocation);

          expect(result.severity).toBe(testCase.expectedSeverity);
        }
      });

      it('should not detect safe tool', () => {
        const toolDef = createToolDefinition({ dangerous: false });
        const invocation = createToolInvocation();

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(false);
        expect(result.severity).toBeUndefined();
      });
    });

    describe('Bash command blocklist integration', () => {
      it('should detect dangerous bash commands', () => {
        const toolDef = createToolDefinition({ name: 'Bash' });
        const invocation = createToolInvocation({
          command: 'rm -rf /',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('critical');
        expect(result.category).toContain('destructive');
        expect(result.confirmation?.required).toBe(true);
      });

      it('should detect privilege escalation commands', () => {
        const toolDef = createToolDefinition({ name: 'Bash' });
        const invocation = createToolInvocation({
          command: 'sudo rm file.txt',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('critical');
        expect(result.category).toContain('privilegeEscalation');
      });

      it('should allow safe bash commands', () => {
        const toolDef = createToolDefinition({ name: 'Bash' });
        const invocation = createToolInvocation({
          command: 'echo "Hello World"',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(false);
      });
    });

    describe('filesystem patterns', () => {
      it('should detect path traversal attacks', () => {
        const toolDef = createToolDefinition({ name: 'Read' });
        const invocation = createToolInvocation({
          file_path: '/app/../../../etc/passwd',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('high');
        expect(result.category).toBe('path_traversal');
      });

      it('should detect access to system directories', () => {
        const toolDef = createToolDefinition({ name: 'Write' });
        const invocation = createToolInvocation({
          file_path: '/etc/hosts',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('high');
        expect(result.category).toBe('system_files');
      });

      it('should detect access to credential files', () => {
        const toolDef = createToolDefinition({ name: 'Read' });
        const invocation = createToolInvocation({
          file_path: '/home/user/.ssh/id_rsa',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('critical');
        expect(result.category).toBe('credential_files');
      });

      it('should detect environment files', () => {
        const toolDef = createToolDefinition({ name: 'Edit' });
        const invocation = createToolInvocation({
          file_path: '/app/.env',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('medium');
        expect(result.category).toBe('configuration_files');
      });

      it('should allow safe file operations', () => {
        const toolDef = createToolDefinition({ name: 'Write' });
        const invocation = createToolInvocation({
          file_path: '/tmp/safe_file.txt',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(false);
      });
    });

    describe('network patterns', () => {
      it('should detect dark web domains', () => {
        const toolDef = createToolDefinition({ name: 'WebFetch' });
        const invocation = createToolInvocation({
          url: 'https://example.onion/malicious',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('high');
        expect(result.category).toBe('dark_web');
      });

      it('should detect suspicious domains', () => {
        const toolDef = createToolDefinition({ name: 'WebFetch' });
        const invocation = createToolInvocation({
          url: 'https://malicious.tk/payload',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('medium');
        expect(result.category).toBe('suspicious_domains');
      });

      it('should allow safe network requests', () => {
        const toolDef = createToolDefinition({ name: 'WebFetch' });
        const invocation = createToolInvocation({
          url: 'https://api.github.com/repos',
        });

        const result = detector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(false);
      });
    });

    describe('custom patterns', () => {
      it('should detect custom dangerous patterns', () => {
        const customPatterns: DangerousPattern[] = [{
          pattern: /secret.*token/i,
          severity: 'high',
          category: 'secret_exposure',
          description: 'Potential secret token exposure',
          applicableTools: ['TestTool'],
        }];

        const customDetector = new DangerousOperationDetector({
          customPatterns,
        });

        const toolDef = createToolDefinition();
        const invocation = createToolInvocation({
          data: 'secret_token=abc123',
        });

        const result = customDetector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('high');
        expect(result.category).toBe('secret_exposure');
      });

      it('should respect tool restrictions in custom patterns', () => {
        const customPatterns: DangerousPattern[] = [{
          pattern: /dangerous/,
          severity: 'high',
          category: 'test',
          description: 'Test pattern',
          applicableTools: ['OtherTool'], // Not TestTool
        }];

        const customDetector = new DangerousOperationDetector({
          customPatterns,
        });

        const toolDef = createToolDefinition();
        const invocation = createToolInvocation({
          data: 'dangerous content',
        });

        const result = customDetector.detectDangerousOperation(toolDef, invocation);

        expect(result.isDangerous).toBe(false);
      });
    });
  });

  describe('confirmation requirements', () => {
    it('should require elevated confirmation for critical operations', () => {
      const toolDef = createToolDefinition({
        dangerous: true,
        permissions: ['admin'],
      });
      const invocation = createToolInvocation();

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.confirmation?.required).toBe(true);
      expect(result.confirmation?.type).toBe('elevated');
      expect(result.confirmation?.message).toContain('CRITICAL RISK');
      expect(result.confirmation?.alternatives).toBeDefined();
    });

    it('should require detailed confirmation for high risk operations', () => {
      const toolDef = createToolDefinition({
        dangerous: true,
        permissions: ['execute'],
      });
      const invocation = createToolInvocation();

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.confirmation?.required).toBe(true);
      expect(result.confirmation?.type).toBe('detailed');
      expect(result.confirmation?.message).toContain('HIGH RISK');
    });

    it('should require simple confirmation for medium risk operations', () => {
      const toolDef = createToolDefinition({
        dangerous: true,
        permissions: ['write'],
      });
      const invocation = createToolInvocation();

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.confirmation?.required).toBe(true);
      expect(result.confirmation?.type).toBe('simple');
      expect(result.confirmation?.message).toContain('MODERATE RISK');
    });

    it('should not require confirmation for low risk operations', () => {
      const toolDef = createToolDefinition({
        dangerous: true,
        permissions: ['read'],
      });
      const invocation = createToolInvocation();

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.confirmation?.required).toBe(false);
      expect(result.confirmation?.type).toBe('simple');
      expect(result.confirmation?.message).toContain('LOW RISK');
    });
  });

  describe('configuration options', () => {
    it('should respect disabled tool definition checking', () => {
      const customDetector = new DangerousOperationDetector({
        useToolDefinition: false,
      });

      const toolDef = createToolDefinition({ dangerous: true });
      const invocation = createToolInvocation();

      const result = customDetector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });

    it('should respect disabled pattern matching', () => {
      const customDetector = new DangerousOperationDetector({
        usePatternMatching: false,
      });

      const toolDef = createToolDefinition({ name: 'Bash' });
      const invocation = createToolInvocation({
        command: 'rm -rf /',
      });

      const result = customDetector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });

    it('should respect disabled filesystem patterns', () => {
      const customDetector = new DangerousOperationDetector({
        useFilesystemPatterns: false,
      });

      const toolDef = createToolDefinition({ name: 'Read' });
      const invocation = createToolInvocation({
        file_path: '/etc/passwd',
      });

      const result = customDetector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });

    it('should respect disabled network patterns', () => {
      const customDetector = new DangerousOperationDetector({
        useNetworkPatterns: false,
      });

      const toolDef = createToolDefinition({ name: 'WebFetch' });
      const invocation = createToolInvocation({
        url: 'https://example.onion/malicious',
      });

      const result = customDetector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });
  });

  describe('utility methods', () => {
    describe('getDangerCategories', () => {
      it('should return all available danger categories', () => {
        const categories = detector.getDangerCategories();

        expect(categories).toContain('destructive');
        expect(categories).toContain('privilegeEscalation');
        expect(categories).toContain('path_traversal');
        expect(categories).toContain('system_files');
        expect(categories).toContain('credential_files');
        expect(categories).toContain('dark_web');
        expect(categories).toContain('suspicious_domains');
        expect(categories.length).toBeGreaterThan(10);
      });

      it('should include custom categories', () => {
        const customDetector = new DangerousOperationDetector({
          customPatterns: [{
            pattern: /test/,
            severity: 'low',
            category: 'custom_test',
            description: 'Test category',
          }],
        });

        const categories = customDetector.getDangerCategories();

        expect(categories).toContain('custom_test');
      });
    });

    describe('getPatternsForCategory', () => {
      it('should return patterns for filesystem category', () => {
        const patterns = detector.getPatternsForCategory('system_files');

        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns[0]).toHaveProperty('pattern');
        expect(patterns[0]).toHaveProperty('severity');
        expect(patterns[0]).toHaveProperty('description');
      });

      it('should return patterns for network category', () => {
        const patterns = detector.getPatternsForCategory('dark_web');

        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns[0].category).toBe('dark_web');
      });

      it('should return empty array for unknown category', () => {
        const patterns = detector.getPatternsForCategory('unknown_category');

        expect(patterns).toEqual([]);
      });
    });
  });

  describe('utility functions', () => {
    describe('createDefaultDetector', () => {
      it('should create detector with default configuration', () => {
        const defaultDetector = createDefaultDetector();

        expect(defaultDetector).toBeInstanceOf(DangerousOperationDetector);
      });
    });

    describe('isOperationDangerous', () => {
      it('should return true for dangerous operations', () => {
        const toolDef = createToolDefinition({ dangerous: true });
        const invocation = createToolInvocation();

        const result = isOperationDangerous(toolDef, invocation);

        expect(result).toBe(true);
      });

      it('should return false for safe operations', () => {
        const toolDef = createToolDefinition({ dangerous: false });
        const invocation = createToolInvocation();

        const result = isOperationDangerous(toolDef, invocation);

        expect(result).toBe(false);
      });
    });

    describe('getConfirmationRequirements', () => {
      it('should return confirmation requirements for dangerous operations', () => {
        const toolDef = createToolDefinition({ dangerous: true });
        const invocation = createToolInvocation();

        const requirements = getConfirmationRequirements(toolDef, invocation);

        expect(requirements).not.toBeNull();
        expect(requirements?.required).toBe(false); // Low severity by default
        expect(requirements?.message).toContain('LOW RISK');
      });

      it('should return null for safe operations', () => {
        const toolDef = createToolDefinition({ dangerous: false });
        const invocation = createToolInvocation();

        const requirements = getConfirmationRequirements(toolDef, invocation);

        expect(requirements).toBeNull();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle missing command parameter for Bash tool', () => {
      const toolDef = createToolDefinition({ name: 'Bash' });
      const invocation = createToolInvocation({}); // No command

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });

    it('should handle missing file_path parameter for filesystem tools', () => {
      const toolDef = createToolDefinition({ name: 'Read' });
      const invocation = createToolInvocation({}); // No file_path

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });

    it('should handle missing url parameter for network tools', () => {
      const toolDef = createToolDefinition({ name: 'WebFetch' });
      const invocation = createToolInvocation({}); // No url

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });

    it('should handle tool with no defined category', () => {
      const toolDef = createToolDefinition({ name: 'UnknownTool' });
      const invocation = createToolInvocation({
        suspicious_param: 'rm -rf /',
      });

      const result = detector.detectDangerousOperation(toolDef, invocation);

      // Should still check custom patterns
      expect(result.isDangerous).toBe(false);
    });

    it('should handle empty invocation parameters', () => {
      const toolDef = createToolDefinition();
      const invocation = createToolInvocation();

      const result = detector.detectDangerousOperation(toolDef, invocation);

      expect(result.isDangerous).toBe(false);
    });
  });
});