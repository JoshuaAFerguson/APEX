/**
 * @fileoverview MCP Test Infrastructure Integration Test
 *
 * This test validates that all components of the MCP E2E test infrastructure
 * work together correctly and meet the acceptance criteria specified in the
 * implementation task.
 *
 * Tests cover:
 * - Test helpers functionality
 * - Mock server integration
 * - Fixture data usage
 * - Base test utilities
 * - End-to-end workflow execution
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMCPTestContext,
  mcpHelpers,
  type MCPTestContext,
  FILESYSTEM_SERVER,
  MEMORY_SERVER,
  FETCH_SERVER,
  MockMarketplaceServer,
  createMockMarketplaceServer,
  createFailingServer,
  createSlowServer,
} from './helpers/mcp-e2e-helpers.js';

describe('MCP E2E Test Infrastructure Integration', () => {
  let ctx: MCPTestContext;

  beforeEach(async () => {
    // Create test context with marketplace data
    ctx = await createMCPTestContext({
      prefix: 'mcp-infrastructure-test-',
      autoStartMocks: [FILESYSTEM_SERVER, MEMORY_SERVER],
    });
  });

  afterEach(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  describe('Test Context Management', () => {
    it('should create isolated test context with required resources', async () => {
      expect(ctx.projectDir).toBeDefined();
      expect(ctx.configPath).toBeDefined();
      expect(ctx.serverManager).toBeDefined();
      expect(ctx.cliBinaryAvailable).toBeDefined();
      expect(typeof ctx.cleanup).toBe('function');
    });

    it('should provide clean project structure', async () => {
      const config = await mcpHelpers.getConfig(ctx);
      expect(config).toBeDefined();
      expect(config.servers).toBeDefined();
    });

    it('should track installed servers', async () => {
      expect(ctx.installedServers).toBeDefined();
      expect(Array.isArray(ctx.installedServers)).toBe(true);
      expect(ctx.installedServers.length).toBe(0); // Initially empty
    });
  });

  describe('Mock Server Infrastructure', () => {
    it('should support multiple mock servers', async () => {
      const stats = ctx.serverManager.getAllStats();
      expect(stats.size).toBeGreaterThanOrEqual(2); // filesystem and memory

      const mockCount = ctx.serverManager.getRunningCount();
      expect(mockCount).toBeGreaterThanOrEqual(2);
    });

    it('should create and manage failing mock servers', async () => {
      const failingServer = createFailingServer(FETCH_SERVER, 'Simulated startup failure');
      ctx.serverManager.addServer(FETCH_SERVER, {
        failOnStart: true,
        startupErrorMessage: 'Simulated startup failure'
      });

      // Server should fail to start
      const server = ctx.serverManager.getServer('fetch');
      expect(server).toBeDefined();

      // Attempting to start should fail
      await expect(async () => {
        await server!.start();
      }).rejects.toThrow('Simulated startup failure');
    });

    it('should create and manage slow mock servers', async () => {
      const slowServer = createSlowServer(FETCH_SERVER, 500);
      expect(slowServer.behavior.startupDelayMs).toBe(500);
      expect(slowServer.behavior.requestDelayMs).toBe(250);
    });

    it('should track server statistics', async () => {
      const stats = ctx.serverManager.getAllStats();
      for (const [name, serverStats] of stats) {
        expect(serverStats.totalRequests).toBeGreaterThanOrEqual(0);
        expect(serverStats.isRunning).toBe(true);
        expect(serverStats.uptime).toBeGreaterThan(0);
      }
    });
  });

  describe('CLI Workflow Integration', () => {
    it('should list available servers', async () => {
      const result = await mcpHelpers.listServers(ctx);
      mcpHelpers.assertSuccess(result);
      expect(result.stdout).toContain('MCP Marketplace');
    });

    it('should list servers in JSON format', async () => {
      const result = await mcpHelpers.listServers(ctx, true);
      mcpHelpers.assertSuccess(result);

      expect(result.json).toBeDefined();
      expect(Array.isArray(result.json)).toBe(true);

      const servers = result.json as any[];
      expect(servers.length).toBeGreaterThan(0);

      const filesystemServer = servers.find(s => s.id === 'filesystem');
      expect(filesystemServer).toBeDefined();
      expect(filesystemServer.name).toBe('Filesystem Server');
    });

    it('should search for servers by name', async () => {
      const result = await mcpHelpers.searchServers(ctx, 'filesystem');
      mcpHelpers.assertSuccess(result);
      expect(result.stdout).toContain('Search Results');
      expect(result.stdout).toContain('Filesystem Server');
    });

    it('should search servers with JSON output', async () => {
      const result = await mcpHelpers.searchServers(ctx, 'memory', true);
      mcpHelpers.assertSuccess(result);

      expect(result.json).toBeDefined();
      expect(Array.isArray(result.json)).toBe(true);

      const servers = result.json as any[];
      const memoryServer = servers.find(s => s.id === 'memory');
      expect(memoryServer).toBeDefined();
    });

    it('should handle no-match searches gracefully', async () => {
      const result = await mcpHelpers.searchServers(ctx, 'nonexistent-server-xyz');
      mcpHelpers.assertSuccess(result);
      expect(result.stdout).toContain('No servers found matching');
    });
  });

  describe('Server Installation Workflow', () => {
    it('should install a server and track it', async () => {
      const result = await mcpHelpers.installServer(ctx, 'filesystem');
      mcpHelpers.assertSuccess(result);

      expect(result.stdout).toContain('✅');
      expect(result.stdout).toContain('installed');

      // Should be tracked in context
      expect(ctx.installedServers).toContain('filesystem');

      // Should appear in config
      await mcpHelpers.verifyInstallation(ctx, 'filesystem', {
        name: 'filesystem',
        type: 'stdio',
        autoStart: true
      });
    });

    it('should handle duplicate installation attempts', async () => {
      // Install filesystem server
      await mcpHelpers.installServer(ctx, 'filesystem');

      // Try to install again
      const result = await mcpHelpers.installServer(ctx, 'filesystem');
      mcpHelpers.assertSuccess(result);
      expect(result.stdout).toContain('already installed');
    });

    it('should install multiple servers sequentially', async () => {
      const results = await mcpHelpers.installServers(ctx, ['filesystem', 'memory']);

      expect(results.size).toBe(2);
      for (const [name, result] of results) {
        mcpHelpers.assertSuccess(result, `Failed to install ${name}`);
      }

      expect(ctx.installedServers).toContain('filesystem');
      expect(ctx.installedServers).toContain('memory');
    });

    it('should handle non-existent server installation', async () => {
      const result = await mcpHelpers.installServer(ctx, 'nonexistent-server');
      // Should handle gracefully (exact behavior depends on CLI implementation)
      expect(result).toBeDefined();
      expect(result.stdout || result.stderr).toContain('not found');
    });
  });

  describe('Server Verification Workflow', () => {
    beforeEach(async () => {
      // Install a server for verification tests
      await mcpHelpers.installServer(ctx, 'filesystem');
    });

    it('should list installed servers', async () => {
      const result = await mcpHelpers.listInstalled(ctx);
      mcpHelpers.assertSuccess(result);
      expect(result.stdout).toContain('Installed MCP Servers');
      expect(result.stdout).toContain('filesystem');
    });

    it('should list installed servers in JSON format', async () => {
      const result = await mcpHelpers.listInstalled(ctx, true);
      mcpHelpers.assertSuccess(result);

      expect(result.json).toBeDefined();
      expect(Array.isArray(result.json)).toBe(true);

      const servers = result.json as any[];
      expect(servers.length).toBe(1);
      expect(servers[0].name).toBe('filesystem');
    });

    it('should validate server configuration', async () => {
      const result = await mcpHelpers.validate(ctx);
      mcpHelpers.assertSuccess(result);
      expect(result.stdout).toContain('✅');
      expect(result.stdout).toContain('valid');
    });

    it('should check server status', async () => {
      const result = await mcpHelpers.status(ctx);
      mcpHelpers.assertSuccess(result);
      expect(result.stdout).toContain('MCP Server Status');
      expect(result.stdout).toContain('filesystem');
    });
  });

  describe('Complete Happy Path Workflow', () => {
    it('should execute full marketplace workflow', async () => {
      const workflowResult = await mcpHelpers.runHappyPathWorkflow(ctx, 'filesystem');

      expect(workflowResult.success).toBe(true);
      expect(workflowResult.steps).toHaveLength(6); // list, search, install, installed, validate, status
      expect(workflowResult.totalDuration).toBeGreaterThan(0);

      // Verify all steps succeeded
      for (const step of workflowResult.steps) {
        expect(step.success).toBe(true);
        expect(step.duration).toBeGreaterThan(0);
      }

      // Verify server is properly installed
      await mcpHelpers.verifyInstallation(ctx, 'filesystem');
    });

    it('should execute multi-server installation workflow', async () => {
      const serverNames = ['filesystem', 'memory', 'fetch'];
      const workflowResult = await mcpHelpers.runMultiInstallWorkflow(ctx, serverNames);

      expect(workflowResult.success).toBe(true);
      expect(workflowResult.steps.length).toBeGreaterThanOrEqual(serverNames.length);

      // Verify all servers were installed
      for (const name of serverNames) {
        expect(ctx.installedServers).toContain(name);
      }
    });
  });

  describe('Configuration Management', () => {
    it('should read and modify MCP configuration', async () => {
      const config = await mcpHelpers.getConfig(ctx);
      expect(config).toBeDefined();

      // Add a server directly to config
      await mcpHelpers.addServerToConfig(ctx, 'test-server', {
        name: 'test-server',
        type: 'stdio',
        command: 'test',
        args: ['--test'],
        autoStart: false
      });

      const updatedConfig = await mcpHelpers.getConfig(ctx);
      expect(updatedConfig.servers?.['test-server']).toBeDefined();
      expect(updatedConfig.servers?.['test-server'].command).toBe('test');
    });

    it('should remove servers from configuration', async () => {
      // Add server first
      await mcpHelpers.addServerToConfig(ctx, 'temp-server', {
        name: 'temp-server',
        type: 'stdio',
        command: 'temp',
        autoStart: false
      });

      // Verify it's there
      let config = await mcpHelpers.getConfig(ctx);
      expect(config.servers?.['temp-server']).toBeDefined();

      // Remove it
      await mcpHelpers.removeServerFromConfig(ctx, 'temp-server');

      // Verify it's gone
      config = await mcpHelpers.getConfig(ctx);
      expect(config.servers?.['temp-server']).toBeUndefined();
    });
  });

  describe('Assertion Helpers', () => {
    it('should provide comprehensive assertion methods', async () => {
      const result = await mcpHelpers.listServers(ctx);

      // Test positive assertions
      mcpHelpers.assertListContains(result, ['Filesystem Server']);

      // Test negative assertions
      mcpHelpers.assertListNotContains(result, ['NonExistent Server']);

      // Test marketplace-specific assertions
      mcpHelpers.assertMarketplace(result, {
        containsServers: ['filesystem'],
        minEntries: 1,
        containsCategories: ['filesystem']
      });
    });

    it('should validate command success/failure assertions', async () => {
      const successResult = await mcpHelpers.listServers(ctx);
      expect(() => mcpHelpers.assertSuccess(successResult)).not.toThrow();

      // Create a mock failure result
      const failureResult = {
        success: false,
        stdout: '',
        stderr: 'Command failed',
        exitCode: 1,
        duration: 100
      };
      expect(() => mcpHelpers.assertFailure(failureResult)).not.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle CLI timeout scenarios', async () => {
      const slowCtx = await createMCPTestContext({
        autoStartMocks: [createSlowServer(FILESYSTEM_SERVER, 1000)]
      });

      try {
        // This may timeout or succeed depending on CLI implementation
        const result = await mcpHelpers.listServers(slowCtx);
        expect(result).toBeDefined();
      } finally {
        await slowCtx.cleanup();
      }
    });

    it('should handle mock server failures gracefully', async () => {
      const failCtx = await createMCPTestContext({
        autoStartMocks: [createFailingServer(FILESYSTEM_SERVER)]
      });

      try {
        // Should handle failing servers gracefully
        const result = await mcpHelpers.listServers(failCtx);
        expect(result).toBeDefined();
      } finally {
        await failCtx.cleanup();
      }
    });

    it('should maintain test isolation between runs', async () => {
      const ctx1 = await createMCPTestContext({ prefix: 'isolation-test-1-' });
      const ctx2 = await createMCPTestContext({ prefix: 'isolation-test-2-' });

      try {
        // Install server in first context
        await mcpHelpers.installServer(ctx1, 'filesystem');

        // Second context should be isolated
        const installed2 = await mcpHelpers.listInstalled(ctx2);
        const servers = installed2.json as any[] || [];
        expect(servers.length).toBe(0); // Should be empty

      } finally {
        await ctx1.cleanup();
        await ctx2.cleanup();
      }
    });
  });

  describe('Test Coverage Verification', () => {
    it('should cover all acceptance criteria components', () => {
      // Verify all required components are tested
      const testedComponents = {
        testHelpers: mcpHelpers,
        mockServers: MockMarketplaceServer,
        fixtures: FILESYSTEM_SERVER,
        baseUtilities: createMCPTestContext,
        e2eWorkflows: mcpHelpers.runHappyPathWorkflow,
      };

      for (const [name, component] of Object.entries(testedComponents)) {
        expect(component).toBeDefined();
        expect(typeof component === 'function' || typeof component === 'object').toBe(true);
      }
    });

    it('should support both unit and E2E test modes', async () => {
      // E2E mode should be active in this test context
      expect(ctx.cliBinaryAvailable).toBeDefined();

      // Verify the infrastructure can distinguish between modes
      expect(process.env.APEX_TEST_MODE).toBe('e2e');
    });
  });
});