/**
 * Focused test suite for ApexOrchestrator MCP Tool Discovery functionality
 * Tests the core methods and integration points without complex setup
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index.js';
import { initializeApex, type ClaudeSDKTool, type MCPConnectionState } from '@apexcli/core';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn().mockResolvedValue({ result: 'success', usage: { tokens: 100 } }),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    const cb = (typeof opts === 'function' ? opts : callback) as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

describe('ApexOrchestrator MCP Tool Discovery', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-test-'));

    // Initialize APEX project
    await initializeApex(tempDir);

    // Create basic config
    const apexDir = path.join(tempDir, '.apex');
    await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: test-project
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
mcp:
  servers:
    test-server:
      name: test-server
      command: node
      args:
        - server.js
`);

    // Create minimal agent
    const agentsDir = path.join(apexDir, 'agents');
    await fs.writeFile(path.join(agentsDir, 'test.md'), '# Test Agent\nA test agent.');

    // Create minimal workflow
    const workflowsDir = path.join(apexDir, 'workflows');
    await fs.writeFile(path.join(workflowsDir, 'test.yaml'), `
name: test
description: test workflow
gates: []
stages:
  - name: test
    agent: test
    description: test stage
`);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (orchestrator) {
      try {
        await orchestrator.shutdown();
      } catch {
        // Ignore shutdown errors in tests
      }
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic MCP Tool Discovery Integration', () => {
    test('should initialize without errors when MCP is configured', async () => {
      orchestrator = new ApexOrchestrator(tempDir);

      // Should not throw during initialization
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Should have MCP components initialized (even if mocked)
      expect(orchestrator).toBeDefined();
    });

    test('should handle missing MCP configuration gracefully', async () => {
      // Create config without MCP section
      const apexDir = path.join(tempDir, '.apex');
      await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: test-project
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
`);

      orchestrator = new ApexOrchestrator(tempDir);
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });
  });

  describe('MCP Tool API Methods', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();
    });

    test('getMcpToolsForAgent should return array when no MCP registry', () => {
      // Clear the MCP tool registry to simulate no MCP tools
      (orchestrator as any).mcpToolRegistry = undefined;

      const tools = orchestrator.getMcpToolsForAgent();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toHaveLength(0);
    });

    test('getMcpToolsForAgent should return tools when registry is available', () => {
      // Mock a simple MCP tool registry
      const mockRegistry = {
        getAvailableTools: vi.fn().mockReturnValue([
          {
            tool: {
              name: 'test_tool',
              description: 'A test tool',
              inputSchema: {
                type: 'object',
                properties: {
                  input: { type: 'string' }
                }
              }
            },
            claudeTool: {
              name: 'test_tool',
              description: 'A test tool',
              input_schema: {
                type: 'object',
                properties: {
                  input: { type: 'string' }
                }
              }
            } as ClaudeSDKTool,
            serverId: 'test-server',
            serverName: 'Test Server'
          }
        ])
      };

      (orchestrator as any).mcpToolRegistry = mockRegistry;

      const tools = orchestrator.getMcpToolsForAgent();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
      expect(tools[0]).toHaveProperty('description');
      expect(tools[0]).toHaveProperty('input_schema');
    });

    test('getMcpToolStats should return undefined when no registry', () => {
      (orchestrator as any).mcpToolRegistry = undefined;

      const stats = orchestrator.getMcpToolStats();

      expect(stats).toBeUndefined();
    });

    test('getMcpToolStats should return stats when registry is available', () => {
      const mockStats = {
        totalTools: 3,
        serverCount: 2,
        lastRefresh: Date.now(),
        connectionStats: {
          'server1': {
            state: 'connected' as MCPConnectionState,
            toolCount: 2,
            lastSeen: Date.now()
          },
          'server2': {
            state: 'connected' as MCPConnectionState,
            toolCount: 1,
            lastSeen: Date.now()
          }
        }
      };

      const mockRegistry = {
        getStats: vi.fn().mockReturnValue(mockStats)
      };

      (orchestrator as any).mcpToolRegistry = mockRegistry;

      const stats = orchestrator.getMcpToolStats();

      expect(stats).toEqual(mockStats);
      expect(stats?.totalTools).toBe(3);
      expect(stats?.serverCount).toBe(2);
    });

    test('refreshMcpTools should return early when no registry', async () => {
      (orchestrator as any).mcpToolRegistry = undefined;

      // Should not throw
      await expect(orchestrator.refreshMcpTools()).resolves.not.toThrow();
    });

    test('refreshMcpTools should call registry refresh when available', async () => {
      const mockRegistry = {
        refreshAllTools: vi.fn().mockResolvedValue(undefined)
      };

      (orchestrator as any).mcpToolRegistry = mockRegistry;

      await orchestrator.refreshMcpTools();

      expect(mockRegistry.refreshAllTools).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator(tempDir);
      await orchestrator.initialize();
    });

    test('should handle getMcpToolsForAgent registry errors gracefully', () => {
      const mockRegistry = {
        getAvailableTools: vi.fn().mockImplementation(() => {
          throw new Error('Registry error');
        })
      };

      (orchestrator as any).mcpToolRegistry = mockRegistry;

      // Should not throw, should return empty array
      const tools = orchestrator.getMcpToolsForAgent();
      expect(tools).toEqual([]);
    });

    test('should handle getMcpToolStats registry errors gracefully', () => {
      const mockRegistry = {
        getStats: vi.fn().mockImplementation(() => {
          throw new Error('Stats error');
        })
      };

      (orchestrator as any).mcpToolRegistry = mockRegistry;

      // Should not throw, should return undefined
      const stats = orchestrator.getMcpToolStats();
      expect(stats).toBeUndefined();
    });

    test('should propagate refreshMcpTools errors', async () => {
      const mockRegistry = {
        refreshAllTools: vi.fn().mockRejectedValue(new Error('Refresh failed'))
      };

      (orchestrator as any).mcpToolRegistry = mockRegistry;

      await expect(orchestrator.refreshMcpTools()).rejects.toThrow('Refresh failed');
    });
  });

  describe('Integration with Configuration', () => {
    test('should initialize with complex MCP configuration', async () => {
      // Create config with multiple MCP servers
      const apexDir = path.join(tempDir, '.apex');
      await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: multi-mcp-test
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
mcp:
  servers:
    filesystem:
      name: filesystem
      command: npx
      args:
        - "@modelcontextprotocol/server-filesystem"
        - "/tmp"
      env:
        NODE_ENV: test
    browser:
      name: browser
      command: python
      args:
        - "-m"
        - "browser_server"
    database:
      name: database
      command: node
      args:
        - "db-server.js"
      env:
        DB_HOST: localhost
        DB_PORT: "5432"
`);

      orchestrator = new ApexOrchestrator(tempDir);

      // Should handle multiple server configs without errors
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Verify basic functionality
      expect(orchestrator.getMcpToolsForAgent()).toEqual([]);
      expect(orchestrator.getMcpToolStats()).toBeUndefined();
    });

    test('should handle malformed MCP configuration', async () => {
      const apexDir = path.join(tempDir, '.apex');
      await fs.writeFile(path.join(apexDir, 'config.yaml'), `
project:
  name: malformed-mcp-test
  version: 1.0.0
limits:
  maxConcurrentTasks: 5
  maxDailyTasks: 100
  maxTokensPerTask: 100000
mcp:
  servers:
    bad-server: "invalid-config-string"
    incomplete-server:
      name: incomplete
      # missing command
    empty-server: {}
`);

      orchestrator = new ApexOrchestrator(tempDir);

      // Should handle malformed config gracefully
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });
  });

  describe('Tool Format Validation', () => {
    test('should validate Claude SDK tool format', () => {
      const mockClaudeTool: ClaudeSDKTool = {
        name: 'test_tool',
        description: 'A test tool for validation',
        input_schema: {
          type: 'object',
          properties: {
            param1: {
              type: 'string',
              description: 'First parameter'
            },
            param2: {
              type: 'number',
              description: 'Second parameter'
            }
          },
          required: ['param1']
        }
      };

      const mockRegistry = {
        getAvailableTools: vi.fn().mockReturnValue([
          {
            tool: {
              name: 'test_tool',
              description: 'A test tool for validation',
              inputSchema: {
                type: 'object',
                properties: {
                  param1: { type: 'string', description: 'First parameter' },
                  param2: { type: 'number', description: 'Second parameter' }
                },
                required: ['param1']
              }
            },
            claudeTool: mockClaudeTool,
            serverId: 'test-server',
            serverName: 'Test Server'
          }
        ])
      };

      (orchestrator as any).mcpToolRegistry = mockRegistry;

      const tools = orchestrator.getMcpToolsForAgent();

      expect(tools).toHaveLength(1);

      const tool = tools[0];
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('input_schema');

      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.input_schema).toBe('object');

      expect(tool.input_schema).toHaveProperty('type');
      expect(tool.input_schema).toHaveProperty('properties');
      expect(tool.input_schema.type).toBe('object');

      // Validate specific tool properties
      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('A test tool for validation');
      expect(tool.input_schema.properties).toHaveProperty('param1');
      expect(tool.input_schema.properties).toHaveProperty('param2');
      expect(tool.input_schema.required).toEqual(['param1']);
    });
  });
});