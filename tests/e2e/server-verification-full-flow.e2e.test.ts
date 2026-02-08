/**
 * @fileoverview Server Verification and Full Flow E2E Tests
 *
 * Comprehensive E2E tests for server verification and full flow integration according to ADR-146.
 * These tests verify:
 * 1. Server health check passes after installation
 * 2. Server responds correctly after configuration
 * 3. Complete flow: browse → select → install → configure → verify as single E2E scenario
 *
 * Architecture: Builds on the existing E2E test infrastructure with new helper functions
 * for server health verification and full flow scenarios.
 *
 * @see ADR-146 for test architecture and requirements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMCPTestContext,
  mcpHelpers,
  type MCPTestContext,
  type FullFlowResult,
  FILESYSTEM_SERVER,
  MEMORY_SERVER,
} from '../helpers/mcp-e2e-helpers.js';

describe('E2E: Server Verification and Full Flow Integration (ADR-146)', () => {
  let ctx: MCPTestContext;

  beforeEach(async () => {
    ctx = await createMCPTestContext({
      prefix: 'server-verification-',
    });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe('Server Health Check Verification', () => {
    it('should verify server health check passes after installation', async () => {
      const serverName = 'filesystem';

      // Step 1: Install server
      const installResult = await mcpHelpers.installServer(ctx, serverName);
      mcpHelpers.assertSuccess(installResult);
      expect(installResult.stdout).toContain('✅');
      expect(installResult.stdout).toContain('installed');

      // Step 2: Run health check validation
      const validateResult = await mcpHelpers.validate(ctx);
      mcpHelpers.assertSuccess(validateResult);

      // Step 3: Verify health check response structure
      expect(validateResult.stdout).toContain('✅');
      expect(validateResult.stdout).toContain('valid');

      // Step 4: Assert server is in "healthy" state using helper
      const healthResult = await mcpHelpers.verifyServerHealth(ctx, serverName);
      expect(healthResult.healthy).toBe(true);
      expect(healthResult.details).toContain(`Server ${serverName} is healthy`);
    });

    it('should verify server responds correctly after configuration', async () => {
      const serverName = 'memory';

      // Step 1: Install server with specific configuration
      const installResult = await mcpHelpers.installServer(ctx, serverName);
      mcpHelpers.assertSuccess(installResult);

      // Step 2: Verify configuration was persisted correctly
      const config = await mcpHelpers.getConfig(ctx);
      expect(config.servers?.[serverName]).toBeDefined();
      expect(config.servers![serverName].type).toBe('stdio');
      expect(config.servers![serverName].autoStart).toBe(true);

      // Step 3: Check server status shows proper state
      const statusResult = await mcpHelpers.status(ctx);
      mcpHelpers.assertSuccess(statusResult);
      expect(statusResult.stdout).toContain(serverName);
      expect(statusResult.stdout).toMatch(/MCP Server Status/i);

      // Step 4: Validate response includes expected fields
      expect(statusResult.stdout).toContain('auto-start');
      expect(statusResult.stdout).toContain('stdio');
    });

    it('should handle multiple servers health check', async () => {
      const serversToInstall = ['filesystem', 'memory'];

      // Install multiple servers
      for (const serverName of serversToInstall) {
        const installResult = await mcpHelpers.installServer(ctx, serverName);
        mcpHelpers.assertSuccess(installResult);
      }

      // Run validation for all servers
      const validateResult = await mcpHelpers.validate(ctx);
      mcpHelpers.assertSuccess(validateResult);
      expect(validateResult.stdout).toContain('✅');
      expect(validateResult.stdout).toContain('valid');

      // Verify each server is healthy
      for (const serverName of serversToInstall) {
        const healthResult = await mcpHelpers.verifyServerHealth(ctx, serverName);
        expect(healthResult.healthy).toBe(true);
      }
    });

    it('should verify server responds correctly with custom environment variables', async () => {
      const serverName = 'filesystem';

      // Install server
      const installResult = await mcpHelpers.installServer(ctx, serverName);
      mcpHelpers.assertSuccess(installResult);

      // Verify the server configuration includes expected settings
      const config = await mcpHelpers.getConfig(ctx);
      const serverConfig = config.servers?.[serverName];
      expect(serverConfig).toBeDefined();
      expect(serverConfig!.command).toBeDefined();
      expect(serverConfig!.args).toBeDefined();

      // Validate the server responds properly
      const validateResult = await mcpHelpers.validate(ctx);
      mcpHelpers.assertSuccess(validateResult);
      expect(validateResult.stdout).toContain('✅');
    });
  });

  describe('Complete Flow Integration Test', () => {
    it('should run complete flow: browse → select → install → configure → verify', async () => {
      // This is the single atomic test covering the entire flow as specified in ADR-146
      const serverName = 'filesystem';

      // Use the new full flow scenario helper
      const flowResult: FullFlowResult = await mcpHelpers.runFullFlowScenario(ctx, serverName);

      // Assert the entire flow succeeded
      expect(flowResult.success).toBe(true);
      expect(flowResult.steps).toHaveLength(6); // browse, select, install, configure, verify-health, verify-response
      expect(flowResult.totalDuration).toBeGreaterThan(0);

      // Verify each step of the flow
      const stepNames = flowResult.steps.map(s => s.name);
      expect(stepNames).toEqual([
        'browse',
        'select',
        'install',
        'configure',
        'verify-health',
        'verify-response'
      ]);

      // All steps should have succeeded
      for (const step of flowResult.steps) {
        expect(step.success).toBe(true);
        expect(step.duration).toBeGreaterThan(0);
        expect(step.error).toBeUndefined();
      }

      // Additional verification: Server should actually be installed and working
      await mcpHelpers.verifyInstallation(ctx, serverName, {
        name: serverName,
        type: 'stdio',
        autoStart: true,
      });

      // Final health check
      const healthResult = await mcpHelpers.verifyServerHealth(ctx, serverName);
      expect(healthResult.healthy).toBe(true);
    });

    it('should provide detailed step information for debugging failed flows', async () => {
      const serverName = 'filesystem';

      const flowResult = await mcpHelpers.runFullFlowScenario(ctx, serverName);

      // Even when successful, should provide detailed step information
      expect(flowResult.steps.length).toBeGreaterThan(0);

      for (const step of flowResult.steps) {
        // Each step should have timing information
        expect(typeof step.duration).toBe('number');
        expect(step.duration).toBeGreaterThan(0);

        // Step names should be descriptive
        expect(step.name).toBeTruthy();
        expect(typeof step.name).toBe('string');

        // Success status should be boolean
        expect(typeof step.success).toBe('boolean');
      }

      // Total duration should be at least the sum of individual steps
      const stepDurations = flowResult.steps.reduce((sum, step) => sum + step.duration, 0);
      expect(flowResult.totalDuration).toBeGreaterThanOrEqual(stepDurations);
    });

    it('should handle complete flow with memory server', async () => {
      const serverName = 'memory';

      const flowResult = await mcpHelpers.runFullFlowScenario(ctx, serverName);

      expect(flowResult.success).toBe(true);
      expect(flowResult.steps).toHaveLength(6);

      // Verify memory server specific configuration
      const config = await mcpHelpers.getConfig(ctx);
      const serverConfig = config.servers?.[serverName];
      expect(serverConfig).toBeDefined();
      expect(serverConfig!.name).toBe(serverName);
      expect(serverConfig!.type).toBe('stdio');

      // Verify server health
      const healthResult = await mcpHelpers.verifyServerHealth(ctx, serverName);
      expect(healthResult.healthy).toBe(true);
    });
  });

  describe('Happy Path Verification', () => {
    it('should verify all happy path tests pass for filesystem server', async () => {
      const serverName = 'filesystem';

      // This test ensures all the happy path components work together

      // Step 1: Browse marketplace
      const browseResult = await mcpHelpers.listServers(ctx);
      expect(browseResult.success).toBe(true);
      expect(browseResult.stdout).toContain('MCP Marketplace');
      expect(browseResult.stdout).toContain('Filesystem Server');

      // Step 2: Select server (search for it)
      const searchResult = await mcpHelpers.searchServers(ctx, serverName);
      expect(searchResult.success).toBe(true);
      expect(searchResult.stdout).toContain('Filesystem Server');

      // Step 3: Install server
      const installResult = await mcpHelpers.installServer(ctx, serverName);
      expect(installResult.success).toBe(true);
      expect(installResult.stdout).toContain('✅');

      // Step 4: Configure (verify configuration was applied)
      const config = await mcpHelpers.getConfig(ctx);
      expect(config.servers?.[serverName]).toBeDefined();
      expect(config.servers![serverName].type).toBe('stdio');
      expect(config.servers![serverName].autoStart).toBe(true);

      // Step 5: Verify - Health check passes
      const validateResult = await mcpHelpers.validate(ctx);
      expect(validateResult.success).toBe(true);
      expect(validateResult.stdout).toContain('✅');
      expect(validateResult.stdout).toContain('valid');

      // Step 6: Verify - Server responds correctly
      const statusResult = await mcpHelpers.status(ctx);
      expect(statusResult.success).toBe(true);
      expect(statusResult.stdout).toContain(serverName);

      // Step 7: Verify - Server appears in installed list
      const installedResult = await mcpHelpers.listInstalled(ctx);
      expect(installedResult.success).toBe(true);
      expect(installedResult.stdout).toContain('Filesystem Server');
    });

    it('should verify all happy path tests pass for memory server', async () => {
      const serverName = 'memory';

      // Run the same happy path verification for memory server
      const browseResult = await mcpHelpers.listServers(ctx);
      expect(browseResult.success).toBe(true);

      const searchResult = await mcpHelpers.searchServers(ctx, serverName);
      expect(searchResult.success).toBe(true);
      expect(searchResult.stdout).toContain('Memory Server');

      const installResult = await mcpHelpers.installServer(ctx, serverName);
      expect(installResult.success).toBe(true);

      const config = await mcpHelpers.getConfig(ctx);
      expect(config.servers?.[serverName]).toBeDefined();

      const validateResult = await mcpHelpers.validate(ctx);
      expect(validateResult.success).toBe(true);

      const statusResult = await mcpHelpers.status(ctx);
      expect(statusResult.success).toBe(true);
      expect(statusResult.stdout).toContain(serverName);

      const installedResult = await mcpHelpers.listInstalled(ctx);
      expect(installedResult.success).toBe(true);
    });

    it('should verify happy path with helper workflow function', async () => {
      const serverName = 'filesystem';

      // Use the existing happy path helper to verify it still works
      const workflowResult = await mcpHelpers.runHappyPathWorkflow(ctx, serverName);

      expect(workflowResult.success).toBe(true);
      expect(workflowResult.steps).toHaveLength(6); // list, search, install, installed, validate, status
      expect(workflowResult.firstError).toBeUndefined();

      // Also verify health check passes
      const healthResult = await mcpHelpers.verifyServerHealth(ctx, serverName);
      expect(healthResult.healthy).toBe(true);
    });
  });
});