/**
 * Edge cases and additional tests for MCP add command
 * Covers scenarios not fully tested in the main test file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
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
  },
}));

// Mock the MCP and config functions
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    getMCPTemplate: vi.fn(),
  };
});

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Add Command - Edge Cases', () => {
  let mockContext: CliContext;
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let mockGetMCPTemplate: any;

  beforeEach(async () => {
    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: null,
    } as CliContext;

    // Get the mocked functions
    const { loadConfig, saveConfig, getMCPTemplate } = await import('@apexcli/core');
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);
    mockGetMCPTemplate = vi.mocked(getMCPTemplate);

    // Reset all mocks
    mockConsoleLog.mockClear();
    mockLoadConfig.mockClear();
    mockSaveConfig.mockClear();
    mockGetMCPTemplate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Environment variables handling', () => {
    it('should handle servers with complex environment variable configurations', async () => {
      const templateWithComplexEnvVars: MCPTemplate = {
        id: 'complex-server',
        name: 'Complex Server',
        description: 'Server with complex environment variables',
        package: '@test/complex-server',
        config: {
          name: 'complex-server',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
          autoStart: true,
        },
        envVars: [
          {
            name: 'API_KEY',
            description: 'API key for authentication',
            required: true,
            sensitive: true,
          },
          {
            name: 'API_URL',
            description: 'API endpoint URL',
            required: true,
            sensitive: false,
            defaultValue: 'https://api.example.com',
          },
          {
            name: 'DEBUG_MODE',
            description: 'Enable debug logging',
            required: false,
            sensitive: false,
            defaultValue: 'false',
          },
          {
            name: 'TIMEOUT',
            description: 'Request timeout in milliseconds',
            required: false,
            sensitive: false,
          },
        ],
        capabilities: ['api'],
        verified: true,
        defaultEnabled: false,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      mockGetMCPTemplate.mockResolvedValue(templateWithComplexEnvVars);
      mockLoadConfig.mockResolvedValue(mockConfig);
      mockSaveConfig.mockResolvedValue(undefined);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'complex-server']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const serverConfig = savedConfig.mcp.servers['complex-server'];

      expect(serverConfig.envVars).toHaveLength(4);

      // Sensitive variables should not have values
      const apiKeyVar = serverConfig.envVars.find((v: any) => v.name === 'API_KEY');
      expect(apiKeyVar.value).toBeUndefined();

      // Non-sensitive variables with defaults should have values
      const apiUrlVar = serverConfig.envVars.find((v: any) => v.name === 'API_URL');
      expect(apiUrlVar.value).toBe('https://api.example.com');

      const debugVar = serverConfig.envVars.find((v: any) => v.name === 'DEBUG_MODE');
      expect(debugVar.value).toBe('false');

      // Non-sensitive without default should not have value
      const timeoutVar = serverConfig.envVars.find((v: any) => v.name === 'TIMEOUT');
      expect(timeoutVar.value).toBeUndefined();
    });

    it('should display environment variable information correctly', async () => {
      const templateWithEnvVars: MCPTemplate = {
        id: 'env-server',
        name: 'Environment Server',
        description: 'Server with environment variables',
        package: '@test/env-server',
        config: {
          name: 'env-server',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        envVars: [
          {
            name: 'REQUIRED_VAR',
            description: 'A required variable',
            required: true,
            sensitive: false,
          },
          {
            name: 'SENSITIVE_VAR',
            description: 'A sensitive variable',
            required: false,
            sensitive: true,
          },
        ],
        capabilities: [],
        verified: true,
        defaultEnabled: false,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      mockGetMCPTemplate.mockResolvedValue(templateWithEnvVars);
      mockLoadConfig.mockResolvedValue(mockConfig);
      mockSaveConfig.mockResolvedValue(undefined);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'env-server']);

      // Should display configuration notes
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📝 Configuration Notes:')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Required environment variables:')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('REQUIRED_VAR: A required variable')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Sensitive environment variables (configure separately):')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('SENSITIVE_VAR: A sensitive variable')
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Edit .apex/config.yaml to configure environment variables')
      );
    });

    it('should handle environment variables without descriptions', async () => {
      const templateWithNoDesc: MCPTemplate = {
        id: 'no-desc',
        name: 'No Description',
        description: 'Server with env vars without descriptions',
        package: '@test/no-desc',
        config: {
          name: 'no-desc',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        envVars: [
          {
            name: 'VAR_WITHOUT_DESC',
            required: true,
            sensitive: false,
          },
        ],
        capabilities: [],
        verified: true,
        defaultEnabled: false,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      mockGetMCPTemplate.mockResolvedValue(templateWithNoDesc);
      mockLoadConfig.mockResolvedValue(mockConfig);
      mockSaveConfig.mockResolvedValue(undefined);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'no-desc']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('VAR_WITHOUT_DESC: No description')
      );
    });
  });

  describe('Server configuration edge cases', () => {
    it('should handle templates with capabilities correctly', async () => {
      const templateWithCapabilities: MCPTemplate = {
        id: 'capable-server',
        name: 'Capable Server',
        description: 'Server with various capabilities',
        package: '@test/capable-server',
        config: {
          name: 'capable-server',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        capabilities: ['filesystem', 'network', 'database', 'api'],
        verified: true,
        defaultEnabled: false,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      mockGetMCPTemplate.mockResolvedValue(templateWithCapabilities);
      mockLoadConfig.mockResolvedValue(mockConfig);
      mockSaveConfig.mockResolvedValue(undefined);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'capable-server']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const serverConfig = savedConfig.mcp.servers['capable-server'];

      expect(serverConfig.capabilities).toEqual(['filesystem', 'network', 'database', 'api']);
    });

    it('should handle defaultEnabled property correctly', async () => {
      const templateEnabledByDefault: MCPTemplate = {
        id: 'auto-start',
        name: 'Auto Start Server',
        description: 'Server that starts automatically',
        package: '@test/auto-start',
        config: {
          name: 'auto-start',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        capabilities: [],
        verified: true,
        defaultEnabled: true,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      mockGetMCPTemplate.mockResolvedValue(templateEnabledByDefault);
      mockLoadConfig.mockResolvedValue(mockConfig);
      mockSaveConfig.mockResolvedValue(undefined);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'auto-start']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const serverConfig = savedConfig.mcp.servers['auto-start'];

      expect(serverConfig.autoStart).toBe(true);
    });

    it('should handle templates without defaultEnabled property', async () => {
      const templateWithoutDefault: MCPTemplate = {
        id: 'no-default',
        name: 'No Default Server',
        description: 'Server without defaultEnabled property',
        package: '@test/no-default',
        config: {
          name: 'no-default',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        capabilities: [],
        verified: true,
        // defaultEnabled is undefined
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      mockGetMCPTemplate.mockResolvedValue(templateWithoutDefault);
      mockLoadConfig.mockResolvedValue(mockConfig);
      mockSaveConfig.mockResolvedValue(undefined);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'no-default']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      const serverConfig = savedConfig.mcp.servers['no-default'];

      expect(serverConfig).not.toHaveProperty('autoStart');
    });
  });

  describe('Documentation URL handling', () => {
    it('should display documentation URL when available', async () => {
      const templateWithDocs: MCPTemplate = {
        id: 'documented-server',
        name: 'Documented Server',
        description: 'Server with documentation',
        package: '@test/documented-server',
        config: {
          name: 'documented-server',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        capabilities: [],
        verified: true,
        defaultEnabled: false,
        documentationUrl: 'https://docs.example.com/server',
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      mockGetMCPTemplate.mockResolvedValue(templateWithDocs);
      mockLoadConfig.mockResolvedValue(mockConfig);
      mockSaveConfig.mockResolvedValue(undefined);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'documented-server']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Documentation: https://docs.example.com/server')
      );
    });

    it('should not display documentation URL when not available', async () => {
      const templateWithoutDocs: MCPTemplate = {
        id: 'undocumented-server',
        name: 'Undocumented Server',
        description: 'Server without documentation',
        package: '@test/undocumented-server',
        config: {
          name: 'undocumented-server',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        capabilities: [],
        verified: true,
        defaultEnabled: false,
        // No documentationUrl
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      mockGetMCPTemplate.mockResolvedValue(templateWithoutDocs);
      mockLoadConfig.mockResolvedValue(mockConfig);
      mockSaveConfig.mockResolvedValue(undefined);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'undocumented-server']);

      // Should not mention documentation
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(allOutput).not.toContain('Documentation:');
    });
  });

  describe('Duplicate server handling', () => {
    it('should handle duplicate server IDs correctly', async () => {
      const existingConfig: ApexConfig = {
        mcp: {
          servers: {
            'existing-server': {
              name: 'Existing Server',
              type: 'stdio',
              command: 'existing',
              args: [],
            },
          },
        },
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      const duplicateTemplate: MCPTemplate = {
        id: 'existing-server',
        name: 'New Server',
        description: 'A new server with same ID',
        package: '@test/new-server',
        config: {
          name: 'new-server',
          type: 'stdio',
          command: 'node',
          args: ['new.js'],
        },
        capabilities: [],
        verified: true,
        defaultEnabled: false,
      };

      mockGetMCPTemplate.mockResolvedValue(duplicateTemplate);
      mockLoadConfig.mockResolvedValue(existingConfig);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'existing-server']);

      // Should warn about existing server and not save
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Server \'existing-server\' already exists in configuration')
      );
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle configuration with no existing MCP servers section', async () => {
      const configWithoutMCPServers: ApexConfig = {
        mcp: {
          // No servers section
        },
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      const template: MCPTemplate = {
        id: 'first-server',
        name: 'First Server',
        description: 'First server to be added',
        package: '@test/first-server',
        config: {
          name: 'first-server',
          type: 'stdio',
          command: 'node',
          args: ['first.js'],
        },
        capabilities: [],
        verified: true,
        defaultEnabled: false,
      };

      mockGetMCPTemplate.mockResolvedValue(template);
      mockLoadConfig.mockResolvedValue(configWithoutMCPServers);
      mockSaveConfig.mockResolvedValue(undefined);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'first-server']);

      const savedConfig = mockSaveConfig.mock.calls[0][1];
      expect(savedConfig.mcp.servers).toEqual({
        'first-server': template.config,
      });
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle template loading with network errors', async () => {
      mockGetMCPTemplate.mockRejectedValue(new Error('Network timeout'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'remote-server']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error adding MCP server: Network timeout')
      );
      expect(mockLoadConfig).not.toHaveBeenCalled();
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle config loading with permission errors', async () => {
      const template: MCPTemplate = {
        id: 'test-server',
        name: 'Test Server',
        description: 'Test server',
        package: '@test/test-server',
        config: {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
          args: ['test.js'],
        },
        capabilities: [],
        verified: true,
        defaultEnabled: false,
      };

      mockGetMCPTemplate.mockResolvedValue(template);
      mockLoadConfig.mockRejectedValue(new Error('Permission denied reading config'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'test-server']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error adding MCP server: Permission denied reading config')
      );
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle config saving with file system errors', async () => {
      const template: MCPTemplate = {
        id: 'test-server',
        name: 'Test Server',
        description: 'Test server',
        package: '@test/test-server',
        config: {
          name: 'test-server',
          type: 'stdio',
          command: 'node',
          args: ['test.js'],
        },
        capabilities: [],
        verified: true,
        defaultEnabled: false,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      mockGetMCPTemplate.mockResolvedValue(template);
      mockLoadConfig.mockResolvedValue(mockConfig);
      mockSaveConfig.mockRejectedValue(new Error('Disk full'));

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'test-server']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error adding MCP server: Disk full')
      );
    });
  });

  describe('Server name validation', () => {
    it('should handle server names with special characters', async () => {
      const template: MCPTemplate = {
        id: 'special-server@2024',
        name: 'Special Server @2024',
        description: 'Server with special characters',
        package: '@test/special-server',
        config: {
          name: 'special-server@2024',
          type: 'stdio',
          command: 'node',
          args: ['special.js'],
        },
        capabilities: [],
        verified: true,
        defaultEnabled: false,
      };

      const mockConfig: ApexConfig = {
        agents: {},
        workflows: {},
        limits: { maxTokens: 100000, maxCost: 10.0, timeoutMs: 300000 },
        autonomy: { level: 'medium', autoApprove: false },
      };

      mockGetMCPTemplate.mockResolvedValue(template);
      mockLoadConfig.mockResolvedValue(mockConfig);
      mockSaveConfig.mockResolvedValue(undefined);

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', 'special-server@2024']);

      expect(mockGetMCPTemplate).toHaveBeenCalledWith('special-server@2024');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully added MCP server \'Special Server @2024\' (special-server@2024)')
      );
    });

    it('should handle empty server name parameter', async () => {
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['add', '']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: Server name is required')
      );
      expect(mockGetMCPTemplate).not.toHaveBeenCalled();
    });
  });
});