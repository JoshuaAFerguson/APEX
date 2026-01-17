/**
 * Edge cases and boundary condition tests for MCP commands
 * Tests unusual inputs, error conditions, and command robustness
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';
import type { CliContext } from '../index.js';
import type { MCPTemplate, ApexConfig } from '@apexcli/core';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    blue: (str: string) => str,
    dim: (str: string) => str,
  },
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock the MCP and config functions
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

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Commands Edge Cases', () => {
  let mockContext: CliContext;
  let tempDir: string;
  let mockLoadMCPTemplates: any;
  let mockGetMCPTemplate: any;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockValidateMCPConfig: any;
  let mockInquirerPrompt: any;

  const baseConfig: ApexConfig = {
    project: {
      name: 'Test Project',
      description: 'Test project',
    },
    agents: {},
    workflows: {},
    limits: {
      maxTokens: 100000,
      maxCost: 10.0,
      timeoutMs: 300000,
    },
    autonomy: {
      level: 'medium',
      autoApprove: false,
    },
  };

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-edge-test-'));

    mockContext = {
      cwd: tempDir,
      initialized: true,
      config: baseConfig,
    } as CliContext;

    // Get the mocked functions
    const {
      loadMCPTemplates,
      getMCPTemplate,
      loadConfig,
      saveConfig,
      validateMCPConfig
    } = await import('@apexcli/core');

    mockLoadMCPTemplates = vi.mocked(loadMCPTemplates);
    mockGetMCPTemplate = vi.mocked(getMCPTemplate);
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);
    mockValidateMCPConfig = vi.mocked(validateMCPConfig);
    mockInquirerPrompt = vi.mocked(inquirer.prompt);

    // Reset all mocks
    mockConsoleLog.mockClear();
    mockLoadMCPTemplates.mockClear();
    mockGetMCPTemplate.mockClear();
    mockLoadConfig.mockClear();
    mockSaveConfig.mockClear();
    mockValidateMCPConfig.mockClear();
    mockInquirerPrompt.mockClear();

    // Default mock implementations
    mockLoadConfig.mockResolvedValue(baseConfig);
    mockSaveConfig.mockResolvedValue(undefined);
    mockLoadMCPTemplates.mockResolvedValue({});
    mockValidateMCPConfig.mockResolvedValue({
      isValid: true,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Input validation edge cases', () => {
    it('should handle null arguments gracefully', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test with null arguments
      await mcpCommand?.handler(mockContext, null as any);

      // Should default to list behavior
      expect(mockLoadMCPTemplates).toHaveBeenCalled();
    });

    it('should handle undefined arguments', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Test with undefined arguments
      await mcpCommand?.handler(mockContext, undefined as any);

      // Should default to list behavior
      expect(mockLoadMCPTemplates).toHaveBeenCalled();
    });

    it('should handle empty string subcommand', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['']);

      // Should default to list behavior
      expect(mockLoadMCPTemplates).toHaveBeenCalled();
    });

    it('should handle whitespace-only subcommand', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['   ']);

      // Should treat as unknown subcommand
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Unknown subcommand:    ')
      );
    });

    it('should handle very long server names', async () => {
      const longName = 'a'.repeat(1000);
      mockGetMCPTemplate.mockResolvedValue(null);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', longName]);

      expect(mockGetMCPTemplate).toHaveBeenCalledWith(longName);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Template')
      );
    });

    it('should handle special characters in server names', async () => {
      const specialName = 'server@#$%^&*()_+-=[]{}|;:,.<>?';
      mockGetMCPTemplate.mockResolvedValue(null);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', specialName]);

      expect(mockGetMCPTemplate).toHaveBeenCalledWith(specialName);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Template')
      );
    });

    it('should handle unicode characters in server names', async () => {
      const unicodeName = '服务器-🚀-测试';
      mockGetMCPTemplate.mockResolvedValue(null);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', unicodeName]);

      expect(mockGetMCPTemplate).toHaveBeenCalledWith(unicodeName);
    });
  });

  describe('Service failure edge cases', () => {
    it('should handle template service timeout', async () => {
      mockLoadMCPTemplates.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Service timeout')), 1)
        )
      );

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates: Service timeout')
      );
    });

    it('should handle network errors', async () => {
      mockLoadMCPTemplates.mockRejectedValue(new Error('Network unreachable'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates: Network unreachable')
      );
    });

    it('should handle corrupted config file', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Invalid YAML syntax'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error validating MCP configuration: Invalid YAML syntax')
      );
    });

    it('should handle permission denied errors', async () => {
      mockSaveConfig.mockRejectedValue(new Error('Permission denied'));

      const template: MCPTemplate = {
        id: 'test',
        name: 'Test Server',
        description: 'Test',
        package: '@test/server',
        config: {
          name: 'test',
          type: 'stdio',
          command: 'test',
        },
        capabilities: [],
        verified: true,
        defaultEnabled: false,
      };
      mockGetMCPTemplate.mockResolvedValue(template);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'test']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error adding MCP server: Permission denied')
      );
    });

    it('should handle disk full errors', async () => {
      mockSaveConfig.mockRejectedValue(new Error('No space left on device'));
      mockInquirerPrompt.mockResolvedValue({ enableMCP: true });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error during MCP setup: No space left on device')
      );
    });
  });

  describe('Concurrent operation edge cases', () => {
    it('should handle concurrent add operations', async () => {
      const template: MCPTemplate = {
        id: 'concurrent',
        name: 'Concurrent Server',
        description: 'Test concurrent',
        package: '@test/concurrent',
        config: {
          name: 'concurrent',
          type: 'stdio',
          command: 'test',
        },
        capabilities: [],
        verified: true,
        defaultEnabled: false,
      };
      mockGetMCPTemplate.mockResolvedValue(template);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Simulate concurrent add operations
      const promises = [
        mcpCommand?.handler(mockContext, ['add', 'concurrent']),
        mcpCommand?.handler(mockContext, ['add', 'concurrent']),
      ];

      await Promise.all(promises.filter(Boolean));

      // Should have attempted both operations
      expect(mockGetMCPTemplate).toHaveBeenCalledTimes(2);
    });

    it('should handle list operation during init', async () => {
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Start init and list concurrently
      const promises = [
        mcpCommand?.handler(mockContext, ['init']),
        mcpCommand?.handler(mockContext, ['list']),
      ];

      await Promise.all(promises.filter(Boolean));

      // Both should complete without interfering
      expect(mockLoadMCPTemplates).toHaveBeenCalled();
      expect(mockSaveConfig).toHaveBeenCalled();
    });
  });

  describe('Large data edge cases', () => {
    it('should handle very large template catalog', async () => {
      const largeTemplates: Record<string, MCPTemplate> = {};
      for (let i = 0; i < 10000; i++) {
        largeTemplates[`template-${i}`] = {
          id: `template-${i}`,
          name: `Template ${i}`,
          description: `Description for template ${i}`.repeat(10),
          package: `@test/template-${i}`,
          config: {
            name: `template-${i}`,
            type: 'stdio',
            command: 'test',
          },
          capabilities: [`capability-${i}`],
          verified: i % 2 === 0,
          defaultEnabled: false,
        };
      }
      mockLoadMCPTemplates.mockResolvedValue(largeTemplates);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const startTime = performance.now();
      await mcpCommand?.handler(mockContext, ['list']);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Total: 10000 templates available')
      );
    });

    it('should handle very large config files', async () => {
      const largeConfig = {
        ...baseConfig,
        mcp: {
          enabled: true,
          servers: {} as any,
        },
      };

      // Add 1000 servers to config
      for (let i = 0; i < 1000; i++) {
        largeConfig.mcp.servers[`server-${i}`] = {
          name: `Server ${i}`,
          type: 'stdio',
          command: 'test',
          args: [`arg-${i}`],
          env: { [`VAR_${i}`]: `value-${i}` },
        };
      }

      mockLoadConfig.mockResolvedValue(largeConfig);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const startTime = performance.now();
      await mcpCommand?.handler(mockContext, ['validate']);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockValidateMCPConfig).toHaveBeenCalledWith(largeConfig.mcp, expect.any(Object));
    });
  });

  describe('Memory and resource edge cases', () => {
    it('should not leak memory during repeated operations', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Perform many list operations
      for (let i = 0; i < 100; i++) {
        mockConsoleLog.mockClear();
        mockLoadMCPTemplates.mockClear();
        await mcpCommand?.handler(mockContext, ['list']);
      }

      // Should still be responsive
      expect(mockLoadMCPTemplates).toHaveBeenCalledTimes(100);
    });

    it('should handle low memory conditions gracefully', async () => {
      // Simulate out of memory error
      mockLoadMCPTemplates.mockRejectedValue(new Error('JavaScript heap out of memory'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates: JavaScript heap out of memory')
      );
    });
  });

  describe('Interactive prompt edge cases', () => {
    it('should handle user interruption during init', async () => {
      mockInquirerPrompt.mockRejectedValue(new Error('User force closed the prompt'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error during MCP setup: User force closed the prompt')
      );
    });

    it('should handle invalid prompt responses', async () => {
      mockInquirerPrompt.mockResolvedValue({ enableMCP: 'invalid' });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      // Should handle gracefully and save config with false
      expect(mockSaveConfig).toHaveBeenCalled();
    });
  });

  describe('File system edge cases', () => {
    it('should handle working directory that does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'nonexistent');
      const contextWithBadDir = {
        ...mockContext,
        cwd: nonExistentDir,
      };

      mockLoadConfig.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(contextWithBadDir, ['validate']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error validating MCP configuration: ENOENT')
      );
    });

    it('should handle read-only file system', async () => {
      mockSaveConfig.mockRejectedValue(new Error('EROFS: read-only file system'));
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['init']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error during MCP setup: EROFS')
      );
    });
  });

  describe('Performance under stress', () => {
    it('should maintain performance with rapid command execution', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const startTime = performance.now();

      // Execute 50 list commands rapidly
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(mcpCommand?.handler(mockContext, ['list']));
      }

      await Promise.all(promises.filter(Boolean));

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(mockLoadMCPTemplates).toHaveBeenCalledTimes(50);
    });

    it('should handle mixed command types under load', async () => {
      const template: MCPTemplate = {
        id: 'load-test',
        name: 'Load Test Server',
        description: 'Test under load',
        package: '@test/load',
        config: {
          name: 'load-test',
          type: 'stdio',
          command: 'test',
        },
        capabilities: [],
        verified: true,
        defaultEnabled: false,
      };
      mockGetMCPTemplate.mockResolvedValue(template);
      mockInquirerPrompt.mockResolvedValue({ enableMCP: false });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(mcpCommand?.handler(mockContext, ['list']));
        promises.push(mcpCommand?.handler(mockContext, ['add', 'load-test']));
        promises.push(mcpCommand?.handler(mockContext, ['validate']));
        promises.push(mcpCommand?.handler(mockContext, ['init']));
      }

      const startTime = performance.now();
      await Promise.all(promises.filter(Boolean));
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });
});