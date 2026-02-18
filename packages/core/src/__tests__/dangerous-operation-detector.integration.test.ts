/**
 * @fileoverview Integration tests for DangerousOperationDetector
 * Demonstrates actual usage patterns and validates integration with existing systems
 */

import { describe, expect, it } from 'vitest';
import {
  DangerousOperationDetector,
  isOperationDangerous,
  getConfirmationRequirements,
} from '../dangerous-operation-detector.js';
import type { ToolDefinition, ToolInvocation } from '../types.js';

describe('DangerousOperationDetector Integration', () => {
  describe('Real-world scenarios', () => {
    it('should handle a complete dangerous bash operation', () => {
      const bashTool: ToolDefinition = {
        name: 'Bash',
        description: 'Execute shell commands',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' }
          },
          required: ['command'],
          additionalProperties: false,
        },
        dangerous: false, // Not marked as dangerous in definition
        permissions: ['execute'],
        category: 'shell',
        enabled: true,
      };

      const dangerousInvocation: ToolInvocation = {
        toolName: 'Bash',
        parameters: {
          command: 'sudo rm -rf /',
        },
      };

      const detector = new DangerousOperationDetector();
      const result = detector.detectDangerousOperation(bashTool, dangerousInvocation);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.confirmation?.required).toBe(true);
      expect(result.confirmation?.type).toBe('elevated');
      expect(result.reason).toContain('destructive');
      expect(result.matchedPattern).toBeDefined();
    });

    it('should handle safe file operations', () => {
      const readTool: ToolDefinition = {
        name: 'Read',
        description: 'Read file contents',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to file' }
          },
          required: ['file_path'],
          additionalProperties: false,
        },
        dangerous: false,
        permissions: ['read'],
        category: 'filesystem',
        enabled: true,
      };

      const safeInvocation: ToolInvocation = {
        toolName: 'Read',
        parameters: {
          file_path: '/tmp/safe-file.txt',
        },
      };

      expect(isOperationDangerous(readTool, safeInvocation)).toBe(false);
      expect(getConfirmationRequirements(readTool, safeInvocation)).toBeNull();
    });

    it('should detect credential file access', () => {
      const readTool: ToolDefinition = {
        name: 'Read',
        description: 'Read file contents',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' }
          },
          required: ['file_path'],
          additionalProperties: false,
        },
        dangerous: false,
        permissions: ['read'],
        category: 'filesystem',
        enabled: true,
      };

      const dangerousInvocation: ToolInvocation = {
        toolName: 'Read',
        parameters: {
          file_path: '/home/user/.ssh/id_rsa',
        },
      };

      const confirmation = getConfirmationRequirements(readTool, dangerousInvocation);

      expect(confirmation?.required).toBe(true);
      expect(confirmation?.type).toBe('elevated');
      expect(confirmation?.message).toContain('CRITICAL RISK');
    });

    it('should handle network operations with suspicious domains', () => {
      const webFetchTool: ToolDefinition = {
        name: 'WebFetch',
        description: 'Fetch content from web',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string' }
          },
          required: ['url'],
          additionalProperties: false,
        },
        dangerous: false,
        permissions: ['network'],
        category: 'web',
        enabled: true,
      };

      const suspiciousInvocation: ToolInvocation = {
        toolName: 'WebFetch',
        parameters: {
          url: 'https://malicious.tk/payload.exe',
        },
      };

      const detector = new DangerousOperationDetector();
      const result = detector.detectDangerousOperation(webFetchTool, suspiciousInvocation);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('medium');
      expect(result.category).toBe('suspicious_domains');
    });

    it('should demonstrate custom pattern detection', () => {
      const detector = new DangerousOperationDetector({
        customPatterns: [{
          pattern: /api[_-]?key|secret[_-]?token/i,
          severity: 'high',
          category: 'credential_exposure',
          description: 'Potential API key or secret token detected',
        }],
      });

      const writeTool: ToolDefinition = {
        name: 'Write',
        description: 'Write file contents',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string' }
          },
          required: ['content'],
          additionalProperties: false,
        },
        dangerous: false,
        permissions: ['write'],
        category: 'filesystem',
        enabled: true,
      };

      const secretInvocation: ToolInvocation = {
        toolName: 'Write',
        parameters: {
          content: 'export API_KEY=secret123',
        },
      };

      const result = detector.detectDangerousOperation(writeTool, secretInvocation);

      expect(result.isDangerous).toBe(true);
      expect(result.severity).toBe('high');
      expect(result.category).toBe('credential_exposure');
    });
  });

  describe('Configuration scenarios', () => {
    it('should work with tools marked as dangerous in definition', () => {
      const dangerousTool: ToolDefinition = {
        name: 'AdminTool',
        description: 'Administrative operations tool',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        dangerous: true,
        permissions: ['admin'],
        category: 'system',
        enabled: true,
      };

      const safeInvocation: ToolInvocation = {
        toolName: 'AdminTool',
        parameters: {},
      };

      const result = isOperationDangerous(dangerousTool, safeInvocation);
      expect(result).toBe(true);
    });

    it('should allow disabling specific detection types', () => {
      const detector = new DangerousOperationDetector({
        useToolDefinition: false,
        usePatternMatching: true,
      });

      const dangerousTool: ToolDefinition = {
        name: 'AdminTool',
        description: 'Administrative operations',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        dangerous: true, // This should be ignored
        permissions: ['admin'],
        category: 'system',
        enabled: true,
      };

      const invocation: ToolInvocation = {
        toolName: 'AdminTool',
        parameters: {},
      };

      const result = detector.detectDangerousOperation(dangerousTool, invocation);
      expect(result.isDangerous).toBe(false);
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle empty parameters gracefully', () => {
      const detector = new DangerousOperationDetector();

      const tool: ToolDefinition = {
        name: 'TestTool',
        description: 'Test',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        dangerous: false,
        permissions: [],
        category: 'custom',
        enabled: true,
      };

      const emptyInvocation: ToolInvocation = {
        toolName: 'TestTool',
        parameters: {},
      };

      const result = detector.detectDangerousOperation(tool, emptyInvocation);
      expect(result.isDangerous).toBe(false);
    });

    it('should return all available categories', () => {
      const detector = new DangerousOperationDetector();
      const categories = detector.getDangerCategories();

      // Should include blocklist categories
      expect(categories).toContain('destructive');
      expect(categories).toContain('privilegeEscalation');

      // Should include filesystem categories
      expect(categories).toContain('path_traversal');
      expect(categories).toContain('system_files');

      // Should include network categories
      expect(categories).toContain('dark_web');
      expect(categories).toContain('suspicious_domains');
    });
  });
});