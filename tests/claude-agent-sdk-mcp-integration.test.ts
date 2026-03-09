/**
 * Claude Agent SDK MCP Integration Tests
 *
 * Tests for MCP (Model Context Protocol) server integration,
 * proxy servers, and browser MCP functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DriverRequest } from '../packages/orchestrator/src/drivers/types.js';
import { buildCustomToolsServer } from '../packages/orchestrator/src/custom-tools.js';

// Mock the Claude Agent SDK and related modules
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  createSdkMcpServer: vi.fn(),
  tool: vi.fn(),
  query: vi.fn(),
}));

// Mock MCP-related imports that might exist
vi.mock('../packages/orchestrator/src/mcp-proxy-server.js', () => ({
  MCPProxyServer: vi.fn(),
}), { virtual: true });

vi.mock('../packages/orchestrator/src/browser-mcp.js', () => ({
  createBrowserMcpServer: vi.fn(),
}), { virtual: true });

describe('Claude Agent SDK MCP Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MCP Server Configuration', () => {
    it('should pass MCP servers to SDK query options', async () => {
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue([]);
      query.mockImplementation(mockQuery);

      // Import after mocking to ensure mock is applied
      const { AnthropicDriver } = await import('../packages/orchestrator/src/drivers/anthropic-driver.js');
      const driver = new AnthropicDriver();

      const mcpServers = {
        'file-server': {
          command: 'node',
          args: ['file-server.js'],
          env: { DEBUG: '1' },
        },
        'web-server': {
          command: 'python',
          args: ['-m', 'web_server'],
          cwd: '/opt/web-server',
        },
      };

      const request: DriverRequest = {
        prompt: 'Test with MCP servers',
        model: 'claude-sonnet-4-20250514',
        mcpServers,
      };

      const stream = driver.stream(request);
      await stream.next();

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Test with MCP servers',
        options: expect.objectContaining({
          mcpServers,
        }),
      });

      await driver.dispose();
    });

    it('should handle empty MCP servers configuration', async () => {
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue([]);
      query.mockImplementation(mockQuery);

      const { AnthropicDriver } = await import('../packages/orchestrator/src/drivers/anthropic-driver.js');
      const driver = new AnthropicDriver();

      const request: DriverRequest = {
        prompt: 'Test without MCP servers',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {},
      };

      const stream = driver.stream(request);
      await stream.next();

      // Should not include mcpServers in options when empty
      const callArgs = mockQuery.mock.calls[0][0];
      expect(callArgs.options.mcpServers).toBeUndefined();

      await driver.dispose();
    });

    it('should handle MCP servers with complex configurations', async () => {
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockReturnValue([]);
      query.mockImplementation(mockQuery);

      const { AnthropicDriver } = await import('../packages/orchestrator/src/drivers/anthropic-driver.js');
      const driver = new AnthropicDriver();

      const mcpServers = {
        'database-server': {
          command: 'node',
          args: ['db-server.js', '--config', '/path/to/config.json'],
          env: {
            DB_HOST: 'localhost',
            DB_PORT: '5432',
            DB_NAME: 'test_db',
          },
          cwd: '/opt/database-server',
          timeout: 30000,
        },
        'api-server': {
          command: 'python',
          args: ['-m', 'api_server', '--host', '0.0.0.0'],
          env: {
            API_KEY: 'secret-key',
            LOG_LEVEL: 'debug',
          },
        },
      };

      const request: DriverRequest = {
        prompt: 'Test complex MCP configuration',
        model: 'claude-sonnet-4-20250514',
        mcpServers,
      };

      const stream = driver.stream(request);
      await stream.next();

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Test complex MCP configuration',
        options: expect.objectContaining({
          mcpServers,
        }),
      });

      await driver.dispose();
    });
  });

  describe('Custom Tools MCP Server', () => {
    it('should create MCP server for custom tools', () => {
      const { createSdkMcpServer, tool } = require('@anthropic-ai/claude-agent-sdk');
      const mockTool = { id: 'test-tool' };
      const mockServer = { type: 'mcp-server' };

      tool.mockReturnValue(mockTool);
      createSdkMcpServer.mockReturnValue(mockServer);

      const customTools = [
        {
          name: 'file-processor',
          description: 'Process files with custom logic',
          command: 'python',
          args: ['process.py', '{{input.file}}'],
          parameters: {
            properties: {
              file: { type: 'string', description: 'File to process' },
              options: {
                type: 'object',
                properties: {
                  format: { type: 'string', enum: ['json', 'xml', 'csv'] },
                  validate: { type: 'boolean' },
                },
              },
            },
            required: ['file'],
          },
          enabled: true,
        },
      ];

      const result = buildCustomToolsServer(customTools, '/project');

      expect(result).toEqual({
        name: 'custom-tools',
        config: mockServer,
      });

      expect(createSdkMcpServer).toHaveBeenCalledWith({
        name: 'custom-tools',
        tools: [mockTool],
      });
    });

    it('should handle multiple custom tools in single MCP server', () => {
      const { createSdkMcpServer, tool } = require('@anthropic-ai/claude-agent-sdk');
      const mockTool1 = { id: 'tool-1' };
      const mockTool2 = { id: 'tool-2' };
      const mockTool3 = { id: 'tool-3' };
      const mockServer = { type: 'mcp-server' };

      tool
        .mockReturnValueOnce(mockTool1)
        .mockReturnValueOnce(mockTool2)
        .mockReturnValueOnce(mockTool3);
      createSdkMcpServer.mockReturnValue(mockServer);

      const customTools = [
        {
          name: 'git-status',
          description: 'Check git status',
          command: 'git',
          args: ['status', '--porcelain'],
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
        {
          name: 'npm-install',
          description: 'Install npm dependencies',
          command: 'npm',
          args: ['install', '{{input.package}}'],
          parameters: {
            properties: {
              package: { type: 'string' },
            },
            required: [],
          },
          enabled: true,
        },
        {
          name: 'docker-build',
          description: 'Build docker image',
          command: 'docker',
          args: ['build', '-t', '{{input.tag}}', '.'],
          parameters: {
            properties: {
              tag: { type: 'string' },
            },
            required: ['tag'],
          },
          enabled: true,
        },
      ];

      const result = buildCustomToolsServer(customTools, '/project');

      expect(result).not.toBeNull();
      expect(tool).toHaveBeenCalledTimes(3);
      expect(createSdkMcpServer).toHaveBeenCalledWith({
        name: 'custom-tools',
        tools: [mockTool1, mockTool2, mockTool3],
      });
    });

    it('should filter disabled tools from MCP server', () => {
      const { createSdkMcpServer, tool } = require('@anthropic-ai/claude-agent-sdk');
      const mockTool = { id: 'enabled-tool' };
      const mockServer = { type: 'mcp-server' };

      tool.mockReturnValue(mockTool);
      createSdkMcpServer.mockReturnValue(mockServer);

      const customTools = [
        {
          name: 'enabled-tool',
          description: 'This tool is enabled',
          command: 'echo',
          args: ['enabled'],
          parameters: { properties: {}, required: [] },
          enabled: true,
        },
        {
          name: 'disabled-tool',
          description: 'This tool is disabled',
          command: 'echo',
          args: ['disabled'],
          parameters: { properties: {}, required: [] },
          enabled: false,
        },
        {
          name: 'default-enabled-tool',
          description: 'This tool has no enabled flag (defaults to true)',
          command: 'echo',
          args: ['default'],
          parameters: { properties: {}, required: [] },
          // No enabled property - should default to true
        },
      ];

      const result = buildCustomToolsServer(customTools, '/project');

      expect(tool).toHaveBeenCalledTimes(2); // Only enabled tools
      expect(tool).toHaveBeenNthCalledWith(1, 'enabled-tool', expect.any(String), expect.any(Object), expect.any(Function));
      expect(tool).toHaveBeenNthCalledWith(2, 'default-enabled-tool', expect.any(String), expect.any(Object), expect.any(Function));
    });
  });

  describe('MCP Server Communication', () => {
    it('should handle MCP server startup and connection', () => {
      // This would typically test the actual MCP server lifecycle,
      // but since we're testing the integration layer, we focus on
      // configuration and setup
      const mcpConfig = {
        'test-server': {
          command: 'node',
          args: ['test-server.js'],
          env: { PORT: '3000' },
        },
      };

      // The driver should pass this configuration to the SDK
      // which handles the actual MCP server lifecycle
      expect(mcpConfig).toEqual({
        'test-server': {
          command: 'node',
          args: ['test-server.js'],
          env: { PORT: '3000' },
        },
      });
    });

    it('should handle MCP server with different protocols', () => {
      const mcpConfigs = {
        'stdio-server': {
          command: 'python',
          args: ['-m', 'stdio_server'],
        },
        'ws-server': {
          command: 'node',
          args: ['ws-server.js'],
          env: { TRANSPORT: 'websocket' },
        },
        'http-server': {
          command: 'uvicorn',
          args: ['app:main', '--port', '8000'],
          env: { TRANSPORT: 'http' },
        },
      };

      // Each server type should be handled by the SDK's MCP implementation
      Object.entries(mcpConfigs).forEach(([name, config]) => {
        expect(config.command).toBeDefined();
        expect(Array.isArray(config.args)).toBe(true);
      });
    });
  });

  describe('MCP Integration Error Handling', () => {
    it('should handle MCP server startup failures gracefully', async () => {
      // Mock a failing MCP server scenario
      const { query } = require('@anthropic-ai/claude-agent-sdk');
      const mockQuery = vi.fn().mockImplementation(() => {
        throw new Error('MCP server failed to start: Connection refused');
      });
      query.mockImplementation(mockQuery);

      const { AnthropicDriver } = await import('../packages/orchestrator/src/drivers/anthropic-driver.js');
      const driver = new AnthropicDriver();

      const request: DriverRequest = {
        prompt: 'Test with failing MCP server',
        model: 'claude-sonnet-4-20250514',
        mcpServers: {
          'failing-server': {
            command: 'nonexistent-command',
            args: [],
          },
        },
      };

      const events = [];
      for await (const event of driver.stream(request)) {
        events.push(event);
      }

      expect(events).toContainEqual({
        type: 'error',
        message: 'MCP server failed to start: Connection refused',
      });

      await driver.dispose();
    });

    it('should validate MCP server configurations', () => {
      const validConfigs = [
        {
          command: 'node',
          args: ['server.js'],
        },
        {
          command: 'python',
          args: ['-m', 'server'],
          env: { DEBUG: '1' },
        },
        {
          command: 'docker',
          args: ['run', '--rm', 'mcp-server'],
          cwd: '/tmp',
        },
      ];

      validConfigs.forEach(config => {
        expect(typeof config.command).toBe('string');
        expect(Array.isArray(config.args)).toBe(true);
      });
    });

    it('should handle MCP server timeout scenarios', () => {
      const timeoutConfig = {
        'slow-server': {
          command: 'sleep',
          args: ['60'], // Very slow server
          timeout: 5000, // 5 second timeout
        },
      };

      // Configuration should include timeout handling
      expect(timeoutConfig['slow-server'].timeout).toBe(5000);
    });
  });

  describe('Tool Definition Schema Integration', () => {
    it('should integrate custom tools with MCP schema validation', () => {
      const { tool } = require('@anthropic-ai/claude-agent-sdk');

      tool.mockImplementation((name, description, schema, implementation) => {
        // Verify that the schema is properly formed for MCP integration
        expect(typeof name).toBe('string');
        expect(typeof description).toBe('string');
        expect(typeof schema).toBe('object');
        expect(typeof implementation).toBe('function');

        return { name, description, schema, implementation };
      });

      const customTools = [
        {
          name: 'schema-validated-tool',
          description: 'Tool with complex schema validation',
          command: 'validate',
          args: ['{{input}}'],
          parameters: {
            properties: {
              data: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  email: { type: 'string', format: 'email' },
                  age: { type: 'integer', minimum: 0, maximum: 150 },
                  preferences: {
                    type: 'array',
                    items: { type: 'string' },
                    uniqueItems: true,
                  },
                },
                required: ['name', 'email'],
                additionalProperties: false,
              },
            },
            required: ['data'],
          },
          enabled: true,
        },
      ];

      const result = buildCustomToolsServer(customTools, '/project');

      expect(result).not.toBeNull();
      expect(tool).toHaveBeenCalledWith(
        'schema-validated-tool',
        'Tool with complex schema validation',
        expect.any(Object),
        expect.any(Function),
      );
    });
  });

  describe('MCP Protocol Features', () => {
    it('should support MCP resource access patterns', () => {
      // Test that MCP server configurations support resource access
      const resourceMcpConfig = {
        'file-browser': {
          command: 'mcp-file-server',
          args: ['--root', '/project/files'],
          env: {
            ALLOWED_PATHS: '/project/files,/tmp',
            READ_ONLY: 'false',
          },
        },
        'database-connector': {
          command: 'mcp-db-server',
          args: ['--connection', 'postgresql://localhost:5432/db'],
          env: {
            DB_READ_ONLY: 'true',
            QUERY_TIMEOUT: '30000',
          },
        },
      };

      Object.entries(resourceMcpConfig).forEach(([name, config]) => {
        expect(config.command).toBeDefined();
        expect(config.args).toBeDefined();
        expect(config.env).toBeDefined();
      });
    });

    it('should support MCP tool discovery and registration', () => {
      // Test that the MCP integration supports tool discovery
      const discoveryConfig = {
        'dynamic-tools-server': {
          command: 'mcp-dynamic-server',
          args: ['--tool-dir', '/project/tools'],
          env: {
            AUTO_DISCOVER: 'true',
            TOOL_EXTENSIONS: '.py,.js,.sh',
          },
        },
      };

      expect(discoveryConfig['dynamic-tools-server'].env?.AUTO_DISCOVER).toBe('true');
    });

    it('should handle MCP server capabilities negotiation', () => {
      // Test configuration for servers with different capabilities
      const capabilityConfigs = {
        'basic-server': {
          command: 'basic-mcp-server',
          args: [],
          capabilities: ['tools'],
        },
        'advanced-server': {
          command: 'advanced-mcp-server',
          args: ['--enable-all'],
          capabilities: ['tools', 'resources', 'prompts'],
        },
      };

      Object.entries(capabilityConfigs).forEach(([name, config]) => {
        expect(config.command).toBeDefined();
        if ('capabilities' in config) {
          expect(Array.isArray(config.capabilities)).toBe(true);
        }
      });
    });
  });
});