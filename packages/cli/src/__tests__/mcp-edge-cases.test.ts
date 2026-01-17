/**
 * @fileoverview Edge case and stress tests for MCP commands
 *
 * Tests unusual scenarios, boundary conditions, and stress cases for:
 * - Malformed templates and configurations
 * - Network failures and timeouts
 * - File system permissions
 * - Unicode and special character handling
 * - Memory and performance limits
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import chalk from 'chalk';
import inquirer from 'inquirer';
import type { CliContext } from '../index.js';
import type { MCPTemplate } from '@apexcli/core';

// Mock dependencies
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    blue: (str: string) => str,
  },
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadMCPTemplates: vi.fn(),
    getMCPTemplate: vi.fn(),
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    validateMCPConfig: vi.fn(),
  };
});

const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Commands Edge Cases', () => {
  let mockContext: CliContext;
  let mockLoadMCPTemplates: any;
  let mockGetMCPTemplate: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockValidateMCPConfig: any;
  let mockInquirerPrompt: any;

  beforeEach(async () => {
    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: {
        project: { name: 'Test', description: 'Test' },
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      },
    } as CliContext;

    // Get mocked functions
    const coreModule = await import('@apexcli/core');
    mockLoadMCPTemplates = vi.mocked(coreModule.loadMCPTemplates);
    mockGetMCPTemplate = vi.mocked(coreModule.getMCPTemplate);
    mockLoadConfig = vi.mocked(coreModule.loadConfig);
    mockSaveConfig = vi.mocked(coreModule.saveConfig);
    mockValidateMCPConfig = vi.mocked(coreModule.validateMCPConfig);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    // Clear all mocks
    vi.clearAllMocks();
    mockConsoleLog.mockClear();

    // Default implementations
    mockLoadConfig.mockResolvedValue(mockContext.config);
    mockSaveConfig.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Malformed Template Data', () => {
    it('should handle templates with missing required fields', async () => {
      const malformedTemplates = {
        incomplete: {
          // Missing id, name, description
          package: '@test/incomplete',
          config: {},
        } as MCPTemplate,
        partial: {
          id: 'partial',
          name: 'Partial Template',
          // Missing description
          package: '@test/partial',
          config: {},
        } as MCPTemplate,
      };

      mockLoadMCPTemplates.mockResolvedValue(malformedTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should handle gracefully without crashing
      await mcpCommand?.handler(mockContext, ['list']);

      // Should still attempt to display what it can
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(output).toContain('📦 Available MCP Server Templates');
    });

    it('should handle templates with malformed environment variables', async () => {
      const templatesWithBadEnvVars = {
        badenvs: {
          id: 'badenvs',
          name: 'Bad EnvVars Template',
          description: 'Template with malformed environment variables',
          package: '@test/badenvs',
          config: {},
          envVars: [
            // Missing required name field
            { description: 'Missing name', required: true },
            // Invalid sensitive value
            { name: 'INVALID_SENSITIVE', sensitive: 'maybe' },
            // Null values
            { name: null, description: null },
          ] as any,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(templatesWithBadEnvVars);
      mockGetMCPTemplate.mockResolvedValue(templatesWithBadEnvVars.badenvs);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should not crash when trying to add this template
      await mcpCommand?.handler(mockContext, ['add', 'badenvs']);

      // Should either succeed gracefully or show appropriate error
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle templates with circular references', async () => {
      const circularTemplate = {
        id: 'circular',
        name: 'Circular Template',
        description: 'Template with circular reference',
        package: '@test/circular',
        config: {},
      };

      // Create circular reference
      (circularTemplate as any).self = circularTemplate;
      (circularTemplate.config as any).template = circularTemplate;

      mockLoadMCPTemplates.mockResolvedValue({ circular: circularTemplate });
      mockGetMCPTemplate.mockResolvedValue(circularTemplate);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should handle JSON serialization issues gracefully
      await mcpCommand?.handler(mockContext, ['add', 'circular']);

      // Should not crash and should provide feedback
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Unicode and Special Characters', () => {
    it('should handle templates with unicode names and descriptions', async () => {
      const unicodeTemplates = {
        unicode1: {
          id: 'unicode1',
          name: '🚀 Rocket Server 测试',
          description: 'Server with émojis and ñoñ-ASCII characters: 🔥💯',
          package: '@unicode/rocket-测试',
          config: {
            name: 'rocket-测试',
            command: 'node',
            args: ['--title=🚀 Server'],
          },
          capabilities: ['unicode', '测试', 'émoji'],
          verified: true,
          defaultEnabled: false,
        },
        rtl: {
          id: 'rtl',
          name: 'العربية Server',
          description: 'Server with RTL script: مرحبا بك',
          package: '@rtl/arabic',
          config: {
            name: 'arabic-server',
            command: 'node',
          },
          capabilities: ['rtl', 'العربية'],
          verified: false,
          defaultEnabled: false,
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(unicodeTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const output = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(output).toContain('🚀 Rocket Server 测试');
      expect(output).toContain('émojis and ñoñ-ASCII');
      expect(output).toContain('العربية Server');
      expect(output).toContain('مرحبا بك');
    });

    it('should handle special characters in template IDs and paths', async () => {
      const specialCharTemplates = {
        'special-chars_123': {
          id: 'special-chars_123',
          name: 'Special-Chars_Server',
          description: 'Server with special characters in paths',
          package: '@special/chars_server-123',
          config: {
            name: 'special_server',
            command: 'node',
            args: ['--path=/special/chars_123/server.js'],
          },
        },
        'dots.and.spaces': {
          id: 'dots.and.spaces',
          name: 'Dots And Spaces',
          description: 'Template with dots and spaces',
          package: '@dots/and.spaces',
          config: {},
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(specialCharTemplates);
      mockGetMCPTemplate.mockImplementation((id) =>
        Promise.resolve(specialCharTemplates[id] || null)
      );

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should handle special character template IDs
      await mcpCommand?.handler(mockContext, ['add', 'special-chars_123']);
      await mcpCommand?.handler(mockContext, ['add', 'dots.and.spaces']);

      expect(mockGetMCPTemplate).toHaveBeenCalledWith('special-chars_123');
      expect(mockGetMCPTemplate).toHaveBeenCalledWith('dots.and.spaces');
    });

    it('should handle very long template names and descriptions', async () => {
      const longString = 'A'.repeat(1000);
      const longTemplates = {
        long: {
          id: 'long',
          name: `Long Template Name ${longString}`,
          description: `Very long description that exceeds normal limits ${longString}`,
          package: '@long/template',
          config: {
            name: 'long-template',
            command: 'node',
            args: [`--config=${longString}`],
          },
        },
      };

      mockLoadMCPTemplates.mockResolvedValue(longTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should handle without crashing or hanging
      const startTime = performance.now();
      await mcpCommand?.handler(mockContext, ['list']);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete in reasonable time
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Network and I/O Failures', () => {
    it('should handle template loading timeouts', async () => {
      mockLoadMCPTemplates.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates: Request timeout')
      );
    });

    it('should handle configuration file permission errors', async () => {
      mockLoadConfig.mockRejectedValue(new Error('EACCES: permission denied'));
      mockSaveConfig.mockRejectedValue(new Error('EACCES: permission denied'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error validating MCP configuration: EACCES: permission denied')
      );
    });

    it('should handle disk space errors during config saving', async () => {
      mockSaveConfig.mockRejectedValue(new Error('ENOSPC: no space left on device'));
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error during MCP setup: ENOSPC: no space left on device')
      );
    });

    it('should handle interrupted network requests gracefully', async () => {
      let callCount = 0;
      mockLoadMCPTemplates.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('ECONNRESET: connection reset'));
        }
        return Promise.resolve({});
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // First call should fail
      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates: ECONNRESET: connection reset')
      );

      // Subsequent call should work
      mockConsoleLog.mockClear();
      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No MCP templates found')
      );
    });
  });

  describe('Memory and Performance Limits', () => {
    it('should handle extremely large template datasets', async () => {
      // Create 10,000 templates
      const massiveTemplates: Record<string, MCPTemplate> = {};
      for (let i = 0; i < 10000; i++) {
        massiveTemplates[`template${i}`] = {
          id: `template${i}`,
          name: `Template ${i}`,
          description: `Description ${i}`.repeat(100), // Large descriptions
          package: `@test/template${i}`,
          config: {
            name: `template${i}`,
            command: 'node',
            args: Array(50).fill(`arg${i}`), // Large args arrays
          },
          capabilities: Array(20).fill(`cap${i}`), // Large capabilities arrays
          verified: i % 2 === 0,
          defaultEnabled: false,
        };
      }

      mockLoadMCPTemplates.mockResolvedValue(massiveTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const startTime = performance.now();
      const memoryStart = process.memoryUsage().heapUsed;

      await mcpCommand?.handler(mockContext, ['list']);

      const endTime = performance.now();
      const memoryEnd = process.memoryUsage().heapUsed;
      const memoryUsed = memoryEnd - memoryStart;

      // Should complete in reasonable time even with large dataset
      expect(endTime - startTime).toBeLessThan(10000);

      // Should not consume excessive memory (less than 100MB for this test)
      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Total: 10000 templates available')
      );
    });

    it('should handle rapid consecutive command executions', async () => {
      mockLoadMCPTemplates.mockResolvedValue({});

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Execute 100 list commands rapidly
      const promises = Array(100).fill(null).map(() =>
        mcpCommand?.handler(mockContext, ['list'])
      );

      const startTime = performance.now();
      await Promise.all(promises);
      const endTime = performance.now();

      // Should complete all requests in reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
      expect(mockLoadMCPTemplates).toHaveBeenCalledTimes(100);
    });

    it('should handle memory pressure during large config operations', async () => {
      // Create large config with many servers
      const largeConfig = {
        ...mockContext.config,
        mcp: {
          enabled: true,
          servers: {} as any,
        }
      };

      // Add 1000 servers to config
      for (let i = 0; i < 1000; i++) {
        largeConfig.mcp.servers[`server${i}`] = {
          name: `Server ${i}`,
          type: 'stdio',
          command: 'node',
          args: Array(10).fill(`arg${i}`),
          envVars: Array(5).fill({
            name: `ENV_VAR_${i}`,
            description: `Environment variable ${i}`,
            value: 'value'.repeat(100),
          }),
        };
      }

      mockLoadConfig.mockResolvedValue(largeConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const startTime = performance.now();
      await mcpCommand?.handler(mockContext, ['validate']);
      const endTime = performance.now();

      // Should handle large configs without excessive delay
      expect(endTime - startTime).toBeLessThan(5000);
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(
        largeConfig.mcp,
        expect.any(Object)
      );
    });
  });

  describe('Edge Case Input Handling', () => {
    it('should handle null and undefined command arguments', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test various null/undefined argument patterns
      const testCases = [
        null as any,
        undefined as any,
        [] as any,
        [null] as any,
        [undefined] as any,
        [''] as any,
        ['', ''] as any,
      ];

      for (const args of testCases) {
        mockConsoleLog.mockClear();
        mockLoadMCPTemplates.mockResolvedValue({});

        await mcpCommand?.handler(mockContext, args);

        // Should default to list behavior for invalid args
        expect(mockLoadMCPTemplates).toHaveBeenCalled();
      }
    });

    it('should handle extremely long command arguments', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const veryLongArgument = 'a'.repeat(10000);

      mockGetMCPTemplate.mockResolvedValue(null);

      await mcpCommand?.handler(mockContext, ['add', veryLongArgument]);

      expect(mockGetMCPTemplate).toHaveBeenCalledWith(veryLongArgument);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(`❌ Error: Template '${veryLongArgument}' not found`)
      );
    });

    it('should handle special command characters and injection attempts', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const maliciousInputs = [
        '$(rm -rf /)',
        '`rm -rf /`',
        '; rm -rf /',
        '| rm -rf /',
        '../../../etc/passwd',
        'template && rm -rf /',
        'template; echo "hacked"',
      ];

      mockGetMCPTemplate.mockResolvedValue(null);

      for (const maliciousInput of maliciousInputs) {
        mockConsoleLog.mockClear();

        await mcpCommand?.handler(mockContext, ['add', maliciousInput]);

        // Should treat as normal template ID, not execute commands
        expect(mockGetMCPTemplate).toHaveBeenCalledWith(maliciousInput);
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining(`❌ Error: Template '${maliciousInput}' not found`)
        );
      }
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle deeply nested configuration structures', async () => {
      const deepConfig = {
        ...mockContext.config,
        mcp: {
          enabled: true,
          servers: {
            complex: {
              name: 'Complex Server',
              type: 'stdio',
              command: 'node',
              config: {
                nested: {
                  level1: {
                    level2: {
                      level3: {
                        value: 'deep value',
                        array: [
                          { deeply: { nested: { object: true } } }
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      mockLoadConfig.mockResolvedValue(deepConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should handle deeply nested structures without stack overflow
      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockValidateMCPConfig).toHaveBeenCalledWith(
        deepConfig.mcp,
        expect.any(Object)
      );
    });

    it('should handle configuration with prototype pollution attempts', async () => {
      const maliciousConfig = {
        ...mockContext.config,
        mcp: {
          enabled: true,
          servers: {
            '__proto__': { polluted: true },
            'constructor': { polluted: true },
            'prototype': { polluted: true },
          } as any
        }
      };

      mockLoadConfig.mockResolvedValue(maliciousConfig);
      mockValidateMCPConfig.mockResolvedValue({
        isValid: true,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Should handle potentially malicious property names safely
      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockValidateMCPConfig).toHaveBeenCalled();
    });
  });
});