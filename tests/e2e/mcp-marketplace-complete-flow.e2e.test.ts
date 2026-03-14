/**
 * @fileoverview MCP Marketplace Complete CLI Flow E2E Tests
 *
 * Complete end-to-end tests for MCP marketplace CLI workflows according to ADR-072.
 * These tests verify the complete flows:
 * - browse marketplace → search server → install → configure → verify working
 * - Multi-server installation workflows
 * - Uninstallation flows
 *
 * Architecture: Uses the high-level workflow helpers from mcp-e2e-helpers.ts
 * to compose complete flows with real CLI execution and filesystem operations.
 *
 * @see ADR-072 for test architecture and requirements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMCPTestContext,
  mcpHelpers,
  type MCPTestContext,
  type MarketplaceWorkflowResult,
  FILESYSTEM_SERVER,
  MEMORY_SERVER,
  ALL_MARKETPLACE_ENTRIES,
} from './helpers/mcp-e2e-helpers.js';

describe('MCP Marketplace Complete CLI Flow Tests (ADR-072)', () => {
  let ctx: MCPTestContext;

  beforeEach(async () => {
    ctx = await createMCPTestContext({
      prefix: 'mcp-complete-flow-',
    });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe('Flow 1: Happy Path - Single Server Installation', () => {
    it('should complete: browse → search → install → configure → verify working', async () => {
      // This is the core acceptance criteria flow
      const serverName = 'filesystem';

      // Step 1: Browse marketplace
      const listResult = await mcpHelpers.listServers(ctx);
      mcpHelpers.assertSuccess(listResult);
      mcpHelpers.assertMarketplace(listResult, {
        hasHeader: true,
        hasServers: true,
        hasCommands: true,
      });

      // Step 2: Search for target server
      const searchResult = await mcpHelpers.searchServers(ctx, serverName);
      mcpHelpers.assertSuccess(searchResult);
      expect(searchResult.stdout).toContain('Filesystem Server');
      expect(searchResult.stdout).toContain('filesystem access');

      // Step 3: Install server
      const installResult = await mcpHelpers.installServer(ctx, serverName);
      mcpHelpers.assertSuccess(installResult);
      expect(installResult.stdout).toContain('✅');
      expect(installResult.stdout).toContain('installed');

      // Step 4: Configure verification (implicit - server should be in config)
      await mcpHelpers.verifyInstallation(ctx, serverName, {
        name: serverName,
        type: 'stdio',
        autoStart: true,
      });

      // Step 5: Verify working - validate configuration
      const validateResult = await mcpHelpers.validate(ctx);
      mcpHelpers.assertSuccess(validateResult);
      expect(validateResult.stdout).toContain('✅');
      expect(validateResult.stdout).toContain('valid');

      // Step 6: Status check - verify server appears in status
      const statusResult = await mcpHelpers.status(ctx);
      mcpHelpers.assertSuccess(statusResult);
      expect(statusResult.stdout).toContain(serverName);
      expect(statusResult.stdout).toMatch(/MCP Server Status/i);

      // Step 7: Final verification - server should be in installed list
      const installedResult = await mcpHelpers.listInstalled(ctx);
      mcpHelpers.assertSuccess(installedResult);
      expect(installedResult.stdout).toContain('Filesystem Server');
      expect(installedResult.stdout).toContain('auto-start: true');
    });

    it('should provide consistent JSON output throughout the flow', async () => {
      const serverName = 'filesystem';

      // Browse with JSON
      const listResult = await mcpHelpers.listServers(ctx, true);
      mcpHelpers.assertSuccess(listResult);
      const availableServers = JSON.parse(listResult.stdout);
      expect(Array.isArray(availableServers)).toBe(true);
      expect(availableServers.length).toBeGreaterThan(0);

      // Search with JSON
      const searchResult = await mcpHelpers.searchServers(ctx, serverName, true);
      mcpHelpers.assertSuccess(searchResult);
      const searchResults = JSON.parse(searchResult.stdout);
      expect(Array.isArray(searchResults)).toBe(true);
      const filesystemServer = searchResults.find((s: any) => s.id === serverName);
      expect(filesystemServer).toBeDefined();

      // Install server
      await mcpHelpers.installServer(ctx, serverName);

      // Verify with JSON
      const installedResult = await mcpHelpers.listInstalled(ctx, true);
      mcpHelpers.assertSuccess(installedResult);
      const installedServers = JSON.parse(installedResult.stdout);
      expect(Array.isArray(installedServers)).toBe(true);
      expect(installedServers.length).toBe(1);
      expect(installedServers[0].name).toBe(serverName);
    });

    it('should handle workflow using the helper runHappyPathWorkflow', async () => {
      const serverName = 'filesystem';

      const workflowResult = await mcpHelpers.runHappyPathWorkflow(ctx, serverName);

      expect(workflowResult.success).toBe(true);
      expect(workflowResult.steps).toHaveLength(6); // list, search, install, installed, validate, status
      expect(workflowResult.firstError).toBeUndefined();
      expect(workflowResult.totalDuration).toBeGreaterThan(0);

      // Verify all steps succeeded
      for (const step of workflowResult.steps) {
        expect(step.success).toBe(true);
        expect(step.duration).toBeGreaterThan(0);
      }

      // Verify server was actually installed
      await mcpHelpers.verifyInstallation(ctx, serverName);
    });
  });

  describe('Flow 2: Multi-Server Installation', () => {
    it('should install server A → install server B → install server C → verify all working', async () => {
      const serversToInstall = ['filesystem', 'memory', 'fetch'];

      // Install each server sequentially
      for (const serverName of serversToInstall) {
        const installResult = await mcpHelpers.installServer(ctx, serverName);
        mcpHelpers.assertSuccess(installResult);
        expect(installResult.stdout).toContain('✅');
        expect(installResult.stdout).toContain('installed');
      }

      // Verify all servers are in the installed list
      const installedResult = await mcpHelpers.listInstalled(ctx, true);
      mcpHelpers.assertSuccess(installedResult);
      const installedServers = JSON.parse(installedResult.stdout);
      expect(installedServers).toHaveLength(3);

      const serverNames = installedServers.map((s: any) => s.name);
      expect(serverNames).toContain('filesystem');
      expect(serverNames).toContain('memory');
      expect(serverNames).toContain('fetch');

      // Verify configuration is still valid with multiple servers
      const validateResult = await mcpHelpers.validate(ctx);
      mcpHelpers.assertSuccess(validateResult);
      expect(validateResult.stdout).toContain('✅');
      expect(validateResult.stdout).toContain('valid');

      // Verify each server individually
      for (const serverName of serversToInstall) {
        await mcpHelpers.verifyInstallation(ctx, serverName);
      }
    });

    it('should handle multi-server installation with helper runMultiInstallWorkflow', async () => {
      const serversToInstall = ['filesystem', 'memory', 'fetch'];

      const workflowResult = await mcpHelpers.runMultiInstallWorkflow(ctx, serversToInstall);

      expect(workflowResult.success).toBe(true);
      expect(workflowResult.steps).toHaveLength(4); // 3 installs + 1 verification
      expect(workflowResult.firstError).toBeUndefined();

      // Verify all install steps succeeded
      for (let i = 0; i < 3; i++) {
        const step = workflowResult.steps[i];
        expect(step.step).toMatch(/install-/);
        expect(step.success).toBe(true);
      }

      // Verify final verification step
      const verificationStep = workflowResult.steps[3];
      expect(verificationStep.step).toBe('verify-installed');
      expect(verificationStep.success).toBe(true);
    });

    it('should maintain different autoStart settings for different servers', async () => {
      // Install filesystem (autoStart: true) and memory (autoStart: false)
      await mcpHelpers.installServer(ctx, 'filesystem');
      await mcpHelpers.installServer(ctx, 'memory');

      const config = await mcpHelpers.getConfig(ctx);
      expect(config.servers).toBeDefined();
      expect(config.servers!.filesystem).toBeDefined();
      expect(config.servers!.memory).toBeDefined();

      // Verify different autoStart settings
      expect(config.servers!.filesystem.autoStart).toBe(true);
      expect(config.servers!.memory.autoStart).toBe(false);
    });
  });

  describe('Flow 3: Uninstallation Flow', () => {
    beforeEach(async () => {
      // Install a server for uninstallation tests
      await mcpHelpers.installServer(ctx, 'filesystem');
    });

    it('should complete: verify installed → uninstall → verify removed', async () => {
      const serverName = 'filesystem';

      // Step 1: Verify server is installed
      const beforeResult = await mcpHelpers.listInstalled(ctx, true);
      mcpHelpers.assertSuccess(beforeResult);
      const beforeServers = JSON.parse(beforeResult.stdout);
      expect(beforeServers).toHaveLength(1);
      expect(beforeServers[0].name).toBe(serverName);

      // Step 2: Uninstall server
      // Note: This test assumes there's an uninstall command - we'll use config manipulation for now
      await mcpHelpers.removeServerFromConfig(ctx, serverName);

      // Step 3: Verify server is removed
      const afterResult = await mcpHelpers.listInstalled(ctx, true);
      mcpHelpers.assertSuccess(afterResult);
      const afterServers = JSON.parse(afterResult.stdout);
      expect(afterServers).toHaveLength(0);

      // Verify configuration is still valid after removal
      const validateResult = await mcpHelpers.validate(ctx);
      mcpHelpers.assertSuccess(validateResult);
      expect(validateResult.stdout).toContain('✅');
    });

    it('should handle uninstalling from multi-server setup', async () => {
      // Install additional servers
      await mcpHelpers.installServer(ctx, 'memory');
      await mcpHelpers.installServer(ctx, 'fetch');

      // Verify we have 3 servers
      const beforeResult = await mcpHelpers.listInstalled(ctx, true);
      const beforeServers = JSON.parse(beforeResult.stdout);
      expect(beforeServers).toHaveLength(3);

      // Remove one server
      await mcpHelpers.removeServerFromConfig(ctx, 'memory');

      // Verify we now have 2 servers
      const afterResult = await mcpHelpers.listInstalled(ctx, true);
      const afterServers = JSON.parse(afterResult.stdout);
      expect(afterServers).toHaveLength(2);

      const remainingNames = afterServers.map((s: any) => s.name);
      expect(remainingNames).toContain('filesystem');
      expect(remainingNames).toContain('fetch');
      expect(remainingNames).not.toContain('memory');

      // Configuration should still be valid
      const validateResult = await mcpHelpers.validate(ctx);
      mcpHelpers.assertSuccess(validateResult);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle the full flow with error recovery', async () => {
      // Try to install non-existent server (should fail gracefully)
      const errorResult = await mcpHelpers.installServer(ctx, 'nonexistent-server');
      mcpHelpers.assertFailure(errorResult);
      expect(errorResult.stdout).toContain('not found');

      // Should still be able to install valid server after error
      const successResult = await mcpHelpers.installServer(ctx, 'filesystem');
      mcpHelpers.assertSuccess(successResult);
      expect(successResult.stdout).toContain('✅');

      // Try to install the same server again (should warn about duplicate)
      const duplicateResult = await mcpHelpers.installServer(ctx, 'filesystem');
      // Note: This might succeed but warn, or might fail - either is acceptable
      expect(duplicateResult.stdout).toMatch(/(already installed|✅)/);

      // Validation should still pass
      const validateResult = await mcpHelpers.validate(ctx);
      mcpHelpers.assertSuccess(validateResult);

      // Should show exactly one server installed
      const installedResult = await mcpHelpers.listInstalled(ctx, true);
      const installedServers = JSON.parse(installedResult.stdout);
      expect(installedServers).toHaveLength(1);
      expect(installedServers[0].name).toBe('filesystem');
    });

    it('should preserve existing config when installing servers', async () => {
      // Add custom setting to config
      const originalConfig = await mcpHelpers.getConfig(ctx);
      const modifiedConfig = {
        ...originalConfig,
        customTestSetting: 'test-value'
      };
      await mcpHelpers.setConfig(ctx, modifiedConfig);

      // Install server
      await mcpHelpers.installServer(ctx, 'filesystem');

      // Verify custom setting is preserved
      const finalConfig = await mcpHelpers.getConfig(ctx);
      expect((finalConfig as any).customTestSetting).toBe('test-value');

      // And server is properly added
      await mcpHelpers.verifyInstallation(ctx, 'filesystem');
    });

    it('should handle empty marketplace search gracefully', async () => {
      const searchResult = await mcpHelpers.searchServers(ctx, 'nonexistent-search-term');
      mcpHelpers.assertSuccess(searchResult);
      expect(searchResult.stdout).toContain('No servers found matching');

      // JSON version should return empty array
      const jsonResult = await mcpHelpers.searchServers(ctx, 'nonexistent-search-term', true);
      mcpHelpers.assertSuccess(jsonResult);
      const results = JSON.parse(jsonResult.stdout);
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });
  });

  describe('Performance and Timing', () => {
    it('should complete full workflow within reasonable time', async () => {
      const startTime = Date.now();

      const workflowResult = await mcpHelpers.runHappyPathWorkflow(ctx, 'filesystem');

      const totalTime = Date.now() - startTime;
      expect(workflowResult.success).toBe(true);

      // Should complete within 30 seconds (generous for CI)
      expect(totalTime).toBeLessThan(30000);

      // Each individual step should be reasonably fast
      for (const step of workflowResult.steps) {
        expect(step.duration).toBeLessThan(10000); // 10 seconds per step max
      }
    });

    it('should handle concurrent installation attempts gracefully', async () => {
      // Attempt to install the same server concurrently
      // This tests that the CLI handles concurrent access properly
      const promises = [
        mcpHelpers.installServer(ctx, 'filesystem'),
        mcpHelpers.installServer(ctx, 'filesystem'),
      ];

      const results = await Promise.allSettled(promises);

      // At least one should succeed
      const successes = results.filter(r => r.status === 'fulfilled' && r.value.success);
      expect(successes.length).toBeGreaterThanOrEqual(1);

      // Verify we end up with exactly one installation
      const installedResult = await mcpHelpers.listInstalled(ctx, true);
      const installedServers = JSON.parse(installedResult.stdout);
      expect(installedServers).toHaveLength(1);
      expect(installedServers[0].name).toBe('filesystem');
    });
  });

  describe('Integration with Existing E2E Patterns', () => {
    it('should work consistently with browse-marketplace.e2e.test.ts patterns', async () => {
      // This ensures our complete flow tests are compatible with existing browse tests

      // Use the same assertions as the browse tests
      const listResult = await mcpHelpers.listServers(ctx);
      mcpHelpers.assertSuccess(listResult);

      expect(listResult.stdout).toContain('📦 MCP Marketplace');
      expect(listResult.stdout).toContain('Available Servers');
      expect(listResult.stdout).toContain('Filesystem Server');
      expect(listResult.stdout).toContain('✓'); // Verification badges
      expect(listResult.stdout).toContain('Marketplace commands');
    });

    it('should be compatible with existing mcp-marketplace.e2e.test.ts test expectations', async () => {
      // Ensure we don't break existing test expectations

      const serverName = 'filesystem';
      await mcpHelpers.installServer(ctx, serverName);

      // These are the same expectations as the existing E2E tests
      const config = await mcpHelpers.getConfig(ctx);
      expect(config.servers).toBeDefined();
      expect(config.servers![serverName]).toBeDefined();
      expect(config.servers![serverName].name).toBe(serverName);
      expect(config.servers![serverName].type).toBe('stdio');
      expect(config.servers![serverName].command).toBe('npx');
      expect(config.servers![serverName].args).toContain('@modelcontextprotocol/server-filesystem');
      expect(config.servers![serverName].autoStart).toBe(true);
      expect(config.servers![serverName].env).toHaveProperty('ALLOWED_PATHS');
    });
  });
});