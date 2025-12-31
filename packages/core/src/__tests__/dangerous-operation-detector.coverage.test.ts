/**
 * @fileoverview Test coverage validation for DangerousOperationDetector
 * Validates that all major functionality areas are properly tested
 */

import { describe, expect, it } from 'vitest';
import {
  DangerousOperationDetector,
  createDefaultDetector,
  isOperationDangerous,
  getConfirmationRequirements,
} from '../dangerous-operation-detector.js';
import type { ToolDefinition, ToolInvocation } from '../types.js';

describe('DangerousOperationDetector Test Coverage Validation', () => {
  describe('API completeness', () => {
    it('should export all expected functions and classes', () => {
      expect(DangerousOperationDetector).toBeDefined();
      expect(createDefaultDetector).toBeDefined();
      expect(isOperationDangerous).toBeDefined();
      expect(getConfirmationRequirements).toBeDefined();
    });

    it('should have all required methods on DangerousOperationDetector class', () => {
      const detector = new DangerousOperationDetector();

      expect(typeof detector.detectDangerousOperation).toBe('function');
      expect(typeof detector.getDangerCategories).toBe('function');
      expect(typeof detector.getPatternsForCategory).toBe('function');
    });

    it('should handle all configuration options', () => {
      const fullConfig = {
        useToolDefinition: false,
        usePatternMatching: false,
        useFilesystemPatterns: false,
        useNetworkPatterns: false,
        customPatterns: [],
      };

      expect(() => {
        new DangerousOperationDetector(fullConfig);
      }).not.toThrow();
    });
  });

  describe('Tool coverage validation', () => {
    it('should handle all filesystem tools correctly', () => {
      const detector = new DangerousOperationDetector();
      const filesystemTools = ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob'];

      for (const toolName of filesystemTools) {
        const toolDef: ToolDefinition = {
          name: toolName,
          description: `${toolName} tool`,
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          dangerous: false,
          permissions: [],
          category: 'filesystem',
          enabled: true,
        };

        const invocation: ToolInvocation = {
          toolName,
          parameters: { file_path: '/etc/passwd' },
        };

        const result = detector.detectDangerousOperation(toolDef, invocation);
        expect(result).toBeDefined();
        expect(typeof result.isDangerous).toBe('boolean');
      }
    });

    it('should handle network tools correctly', () => {
      const detector = new DangerousOperationDetector();
      const networkTools = ['WebFetch', 'WebSearch'];

      for (const toolName of networkTools) {
        const toolDef: ToolDefinition = {
          name: toolName,
          description: `${toolName} tool`,
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          dangerous: false,
          permissions: [],
          category: 'web',
          enabled: true,
        };

        const invocation: ToolInvocation = {
          toolName,
          parameters: { url: 'https://safe.example.com' },
        };

        const result = detector.detectDangerousOperation(toolDef, invocation);
        expect(result).toBeDefined();
        expect(typeof result.isDangerous).toBe('boolean');
      }
    });

    it('should handle shell tools correctly', () => {
      const detector = new DangerousOperationDetector();
      const toolDef: ToolDefinition = {
        name: 'Bash',
        description: 'Bash shell tool',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        dangerous: false,
        permissions: [],
        category: 'shell',
        enabled: true,
      };

      const invocation: ToolInvocation = {
        toolName: 'Bash',
        parameters: { command: 'echo "safe"' },
      };

      const result = detector.detectDangerousOperation(toolDef, invocation);
      expect(result).toBeDefined();
      expect(typeof result.isDangerous).toBe('boolean');
    });
  });

  describe('Pattern category coverage', () => {
    it('should provide patterns for all major danger categories', () => {
      const detector = new DangerousOperationDetector();
      const categories = detector.getDangerCategories();

      // Essential categories that should be covered
      const essentialCategories = [
        'destructive',
        'privilegeEscalation',
        'path_traversal',
        'system_files',
        'credential_files',
        'configuration_files',
        'dark_web',
        'suspicious_domains',
      ];

      for (const category of essentialCategories) {
        expect(categories).toContain(category);

        const patterns = detector.getPatternsForCategory(category);
        // Categories should have at least one pattern (except those from command blocklist)
        if (category !== 'destructive' && category !== 'privilegeEscalation') {
          expect(patterns.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return valid pattern objects', () => {
      const detector = new DangerousOperationDetector();
      const categories = detector.getDangerCategories();

      for (const category of categories.slice(0, 5)) { // Test first 5 categories
        const patterns = detector.getPatternsForCategory(category);

        for (const pattern of patterns) {
          expect(pattern).toHaveProperty('pattern');
          expect(pattern).toHaveProperty('severity');
          expect(pattern).toHaveProperty('category');
          expect(pattern).toHaveProperty('description');

          expect(typeof pattern.severity).toBe('string');
          expect(['low', 'medium', 'high', 'critical']).toContain(pattern.severity);
          expect(typeof pattern.description).toBe('string');
          expect(pattern.description.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Severity level coverage', () => {
    it('should properly map permissions to severity levels', () => {
      const detector = new DangerousOperationDetector();

      const permissionTests = [
        { permissions: ['admin'], expectedSeverity: 'critical' },
        { permissions: ['execute'], expectedSeverity: 'high' },
        { permissions: ['write'], expectedSeverity: 'medium' },
        { permissions: ['read'], expectedSeverity: 'low' },
        { permissions: [], expectedSeverity: 'low' },
      ];

      for (const test of permissionTests) {
        const toolDef: ToolDefinition = {
          name: 'TestTool',
          description: 'Test tool',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          dangerous: true,
          permissions: test.permissions as any,
          category: 'custom',
          enabled: true,
        };

        const invocation: ToolInvocation = {
          toolName: 'TestTool',
          parameters: {},
        };

        const result = detector.detectDangerousOperation(toolDef, invocation);
        expect(result.severity).toBe(test.expectedSeverity);
      }
    });

    it('should generate appropriate confirmation requirements for each severity', () => {
      const detector = new DangerousOperationDetector();
      const severityTests = [
        { severity: 'critical', shouldRequire: true, type: 'elevated' },
        { severity: 'high', shouldRequire: true, type: 'detailed' },
        { severity: 'medium', shouldRequire: true, type: 'simple' },
        { severity: 'low', shouldRequire: false, type: 'simple' },
      ];

      for (const test of severityTests) {
        const toolDef: ToolDefinition = {
          name: 'TestTool',
          description: 'Test tool',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          dangerous: true,
          permissions: test.severity === 'critical' ? ['admin'] :
                      test.severity === 'high' ? ['execute'] :
                      test.severity === 'medium' ? ['write'] : ['read'],
          category: 'custom',
          enabled: true,
        };

        const invocation: ToolInvocation = {
          toolName: 'TestTool',
          parameters: {},
        };

        const result = detector.detectDangerousOperation(toolDef, invocation);
        expect(result.confirmation?.required).toBe(test.shouldRequire);
        expect(result.confirmation?.type).toBe(test.type);
      }
    });
  });

  describe('Utility function coverage', () => {
    it('should validate createDefaultDetector functionality', () => {
      const detector1 = createDefaultDetector();
      const detector2 = createDefaultDetector();

      expect(detector1).toBeInstanceOf(DangerousOperationDetector);
      expect(detector2).toBeInstanceOf(DangerousOperationDetector);

      // Should create independent instances
      expect(detector1).not.toBe(detector2);
    });

    it('should validate isOperationDangerous utility function', () => {
      const safeToolDef: ToolDefinition = {
        name: 'SafeTool',
        description: 'Safe tool',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        dangerous: false,
        permissions: [],
        category: 'custom',
        enabled: true,
      };

      const dangerousToolDef: ToolDefinition = {
        ...safeToolDef,
        dangerous: true,
        permissions: ['admin'],
      };

      const invocation: ToolInvocation = {
        toolName: 'TestTool',
        parameters: {},
      };

      expect(isOperationDangerous(safeToolDef, invocation)).toBe(false);
      expect(isOperationDangerous(dangerousToolDef, invocation)).toBe(true);
    });

    it('should validate getConfirmationRequirements utility function', () => {
      const safeToolDef: ToolDefinition = {
        name: 'SafeTool',
        description: 'Safe tool',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        dangerous: false,
        permissions: [],
        category: 'custom',
        enabled: true,
      };

      const dangerousToolDef: ToolDefinition = {
        ...safeToolDef,
        dangerous: true,
        permissions: ['admin'],
      };

      const invocation: ToolInvocation = {
        toolName: 'TestTool',
        parameters: {},
      };

      expect(getConfirmationRequirements(safeToolDef, invocation)).toBeNull();

      const requirements = getConfirmationRequirements(dangerousToolDef, invocation);
      expect(requirements).not.toBeNull();
      expect(requirements?.required).toBe(true);
      expect(requirements?.type).toBe('elevated');
    });
  });

  describe('Integration points coverage', () => {
    it('should properly integrate with command blocklist', () => {
      const detector = new DangerousOperationDetector();
      const bashTool: ToolDefinition = {
        name: 'Bash',
        description: 'Bash shell',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        dangerous: false,
        permissions: [],
        category: 'shell',
        enabled: true,
      };

      // Test some known dangerous commands
      const dangerousCommands = ['rm -rf /', 'sudo rm -f /etc/passwd', 'chmod 777 /etc/shadow'];

      for (const command of dangerousCommands) {
        const invocation: ToolInvocation = {
          toolName: 'Bash',
          parameters: { command },
        };

        const result = detector.detectDangerousOperation(bashTool, invocation);
        expect(result.isDangerous).toBe(true);
        expect(result.severity).toBe('critical');
        expect(result.matchedPattern).toBeDefined();
      }
    });

    it('should handle mixed configuration scenarios', () => {
      // Test with some features disabled
      const partialDetector = new DangerousOperationDetector({
        useToolDefinition: true,
        usePatternMatching: false,
        useFilesystemPatterns: false,
        useNetworkPatterns: true,
      });

      const toolDef: ToolDefinition = {
        name: 'WebFetch',
        description: 'Web fetch tool',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        dangerous: true,
        permissions: ['network'],
        category: 'web',
        enabled: true,
      };

      const invocation: ToolInvocation = {
        toolName: 'WebFetch',
        parameters: { url: 'https://evil.onion/malware' },
      };

      const result = partialDetector.detectDangerousOperation(toolDef, invocation);

      // Should detect based on tool definition being dangerous
      expect(result.isDangerous).toBe(true);
      expect(result.category).toBe('tool_definition');
    });
  });

  describe('Error handling coverage', () => {
    it('should gracefully handle malformed inputs', () => {
      const detector = new DangerousOperationDetector();

      // Test with minimal valid inputs
      const minimalTool: ToolDefinition = {
        name: 'Test',
        description: '',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        dangerous: false,
        permissions: [],
        category: 'custom',
        enabled: true,
      };

      const minimalInvocation: ToolInvocation = {
        toolName: 'Test',
        parameters: {},
      };

      expect(() => {
        const result = detector.detectDangerousOperation(minimalTool, minimalInvocation);
        expect(result).toBeDefined();
        expect(typeof result.isDangerous).toBe('boolean');
      }).not.toThrow();
    });

    it('should handle empty and null parameter values', () => {
      const detector = new DangerousOperationDetector();
      const toolDef: ToolDefinition = {
        name: 'Read',
        description: 'File reader',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        dangerous: false,
        permissions: [],
        category: 'filesystem',
        enabled: true,
      };

      const testCases = [
        { file_path: null },
        { file_path: undefined },
        { file_path: '' },
        {},
      ];

      for (const params of testCases) {
        const invocation: ToolInvocation = {
          toolName: 'Read',
          parameters: params,
        };

        expect(() => {
          const result = detector.detectDangerousOperation(toolDef, invocation);
          expect(result.isDangerous).toBe(false);
        }).not.toThrow();
      }
    });
  });
});