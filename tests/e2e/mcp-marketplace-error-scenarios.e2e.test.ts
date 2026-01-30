/**
 * @fileoverview MCP Marketplace Error Scenarios E2E Tests
 *
 * End-to-end tests for MCP marketplace error scenarios according to ADR-076.
 * These tests verify error handling for:
 * - Network failures (timeout, connection refused, server crash)
 * - Invalid server configurations
 * - Permission and filesystem issues
 * - Duplicate installations and conflicts
 * - API error responses and WebSocket error events
 *
 * Architecture: Uses real test infrastructure with error injection and
 * mock server failures to simulate real-world error conditions.
 *
 * @see ADR-076 for implementation design and requirements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  createMCPTestContext,
  mcpHelpers,
  type MCPTestContext,
} from './helpers/mcp-e2e-helpers.js';
import {
  createAPITestServer,
  type APITestServer,
} from './helpers/api-e2e-test-server.js';
import { createWebSocketTestClient, type WebSocketTestClient } from './utils/ws-test-client.js';
import {
  createFailingServer,
  createSlowServer,
  createCorruptedServer,
  createCrashingServer,
} from './mocks/mock-marketplace-server.js';
import {
  INVALID_CONFIG_SERVER,
  MISSING_DEPS_SERVER,
  MALFORMED_CONFIG_SERVER,
  FILESYSTEM_SERVER,
  MEMORY_SERVER,
} from './fixtures/marketplace-data.js';

describe('MCP Marketplace Error Scenarios E2E (ADR-076)', () => {
  let ctx: MCPTestContext;
  let apiServer: APITestServer;
  let wsClient: WebSocketTestClient;

  beforeEach(async () => {
    ctx = await createMCPTestContext({
      prefix: 'mcp-error-scenarios-',
    });

    // Start API test server for API error testing
    apiServer = createAPITestServer({
      projectPath: ctx.projectDir,
    });
    await apiServer.start();

    // Create WebSocket client for error event verification
    wsClient = await apiServer.createWebSocketClient();
    await wsClient.connect();
  });

  afterEach(async () => {
    await wsClient?.disconnect();
    await apiServer?.stop();
    await ctx.cleanup();
  });

  describe('Network Failure Scenarios', () => {
    it('should handle server startup timeout gracefully', async () => {
      const slowServer = createSlowServer(FILESYSTEM_SERVER, 30000); // 30s timeout
      await ctx.mockManager.addServer(slowServer);

      const result = await mcpHelpers.installServer(ctx, 'filesystem');

      // Should handle timeout gracefully
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('timeout');

      // Verify server not added to config
      const isInstalled = await mcpHelpers.isServerInstalled(ctx, 'filesystem');
      expect(isInstalled).toBe(false);
    });

    it('should report clear error when connection is refused', async () => {
      const failingServer = createFailingServer(FILESYSTEM_SERVER, 'refused');
      await ctx.mockManager.addServer(failingServer);

      const result = await mcpHelpers.installServer(ctx, 'filesystem');

      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/connection refused|ECONNREFUSED/i);

      // Verify helpful error message
      expect(result.stderr).toContain('filesystem');
    });

    it('should handle server crash during operation', async () => {
      const crashingServer = createCrashingServer(FILESYSTEM_SERVER, 1);
      await ctx.mockManager.addServer(crashingServer);

      // First request might succeed
      const firstResult = await mcpHelpers.installServer(ctx, 'filesystem');

      if (firstResult.success) {
        // Second operation should detect the crash
        const statusResult = await mcpHelpers.getServerStatus(ctx, 'filesystem');
        expect(statusResult.success).toBe(false);
        expect(statusResult.stderr).toMatch(/crashed|disconnected|not running/i);
      } else {
        // If it failed immediately, that's also valid
        expect(firstResult.stderr).toMatch(/crashed|failed|error/i);
      }
    });
  });

  describe('Invalid Server Scenarios', () => {
    it('should report "not found" for non-existent server ID', async () => {
      const result = await mcpHelpers.installServer(ctx, 'nonexistent-server-xyz');

      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/not found|does not exist/i);
      expect(result.stderr).toContain('nonexistent-server-xyz');
    });

    it('should reject malformed server IDs', async () => {
      const invalidIds = ['', '   ', 'server with spaces', 'server/with/slashes'];

      for (const invalidId of invalidIds) {
        const result = await mcpHelpers.installServer(ctx, invalidId);

        expect(result.success).toBe(false);
        expect(result.stderr).toMatch(/invalid|malformed|bad format/i);
      }
    });

    it('should handle empty server ID parameter', async () => {
      const result = await mcpHelpers.installServer(ctx, '');

      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/required|missing|empty/i);
    });

    it('should handle server with missing required config fields', async () => {
      // Add invalid config server to test catalog
      await ctx.mockManager.addMarketplaceEntry(INVALID_CONFIG_SERVER);

      const result = await mcpHelpers.installServer(ctx, 'invalid-config');

      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/invalid|missing|required/i);
    });
  });

  describe('Permission & Filesystem Scenarios', () => {
    it('should report error when config file is read-only', async () => {
      // Skip on Windows as permission tests behave differently
      if (process.platform === 'win32') {
        return;
      }

      try {
        // Make config file read-only
        await fs.chmod(ctx.configPath, 0o444);

        const result = await mcpHelpers.installServer(ctx, 'filesystem');

        expect(result.success).toBe(false);
        expect(result.stderr).toMatch(/permission|read-only|EACCES/i);

      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(ctx.configPath, 0o644);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should report error when .apex directory is missing', async () => {
      // Remove .apex directory
      const apexDir = path.dirname(ctx.configPath);
      await fs.rmdir(apexDir, { recursive: true });

      const result = await mcpHelpers.installServer(ctx, 'filesystem');

      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/apex.*not found|directory.*missing/i);
    });

    it('should handle corrupted YAML config gracefully', async () => {
      // Write malformed YAML to config file
      await fs.writeFile(ctx.configPath, 'invalid: yaml: content: {broken');

      const result = await mcpHelpers.installServer(ctx, 'filesystem');

      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/yaml|parse|syntax|invalid config/i);
    });
  });

  describe('Duplicate & Conflict Scenarios', () => {
    it('should warn when installing an already-installed server', async () => {
      // Install server first time
      const firstResult = await mcpHelpers.installServer(ctx, 'filesystem');
      mcpHelpers.assertSuccess(firstResult);

      // Try to install again
      const secondResult = await mcpHelpers.installServer(ctx, 'filesystem');

      if (secondResult.success) {
        // Should warn about existing installation
        expect(secondResult.stdout).toMatch(/already installed|already exists/i);
      } else {
        // Or reject with appropriate error
        expect(secondResult.stderr).toMatch(/already installed|conflict/i);
      }
    });

    it('should handle uninstalling a server that is not installed', async () => {
      const result = await mcpHelpers.uninstallServer(ctx, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/not installed|not found/i);
    });

    it('should handle concurrent install attempts for same server', async () => {
      // Launch two concurrent install operations
      const promises = [
        mcpHelpers.installServer(ctx, 'filesystem'),
        mcpHelpers.installServer(ctx, 'filesystem'),
      ];

      const results = await Promise.all(promises);

      // At least one should succeed, the other should handle the conflict
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Failed result should indicate conflict
      expect(failures[0].stderr).toMatch(/already|conflict|concurrent/i);
    });
  });

  describe('API Error Scenarios', () => {
    it('should return 404 for non-existent server via API', async () => {
      const baseUrl = apiServer.getBaseUrl();

      const response = await fetch(`${baseUrl}/mcp/servers/nonexistent-server`);
      expect(response.status).toBe(404);

      const errorData = await response.json();
      expect(errorData.error).toContain('not found');
    });

    it('should return 400 for invalid request body', async () => {
      const baseUrl = apiServer.getBaseUrl();

      // POST with invalid server ID
      const installResponse = await fetch(`${baseUrl}/mcp/install/`, {
        method: 'POST',
      });
      expect(installResponse.status).toBe(400);

      const installData = await installResponse.json();
      expect(installData.error).toMatch(/required|invalid/i);
    });

    it('should return 409 for duplicate installation via API', async () => {
      const baseUrl = apiServer.getBaseUrl();

      // Install server first
      const firstResponse = await fetch(`${baseUrl}/mcp/install/filesystem`, {
        method: 'POST',
      });
      expect(firstResponse.status).toBe(200);

      // Try to install again
      const secondResponse = await fetch(`${baseUrl}/mcp/install/filesystem`, {
        method: 'POST',
      });

      // Should return conflict status (409) or success with warning
      if (secondResponse.status !== 200) {
        expect(secondResponse.status).toBe(409);
        const errorData = await secondResponse.json();
        expect(errorData.error).toMatch(/already installed|conflict/i);
      }
    });

    it('should emit error events via WebSocket on install failure', async () => {
      const baseUrl = apiServer.getBaseUrl();

      // Clear any existing events
      wsClient.clearEvents();

      // Trigger installation of non-existent server
      const installResponse = await fetch(`${baseUrl}/mcp/install/nonexistent-server`, {
        method: 'POST',
      });
      expect(installResponse.status).toBe(500);

      // Wait for error event
      const errorEvent = await wsClient.waitForEvent('mcp:install-error', 5000);

      expect(errorEvent.type).toBe('mcp:install-error');
      expect(errorEvent.data).toHaveProperty('serverId', 'nonexistent-server');
      expect(errorEvent.data).toHaveProperty('stage', 'error');
      expect(errorEvent.data).toHaveProperty('error');
      expect(errorEvent.data.error).toMatch(/not found|does not exist/i);
    });

    it('should provide structured error responses with helpful messages', async () => {
      const baseUrl = apiServer.getBaseUrl();

      // Test various error scenarios via API
      const testCases = [
        {
          url: `/mcp/install/`,
          method: 'POST',
          expectedStatus: 400,
          expectedPattern: /required|invalid/i,
        },
        {
          url: `/mcp/servers/nonexistent`,
          method: 'GET',
          expectedStatus: 404,
          expectedPattern: /not found/i,
        },
        {
          url: `/mcp/uninstall/   `,
          method: 'DELETE',
          expectedStatus: 400,
          expectedPattern: /required|invalid/i,
        },
      ];

      for (const testCase of testCases) {
        const response = await fetch(`${baseUrl}${testCase.url}`, {
          method: testCase.method,
        });

        expect(response.status).toBe(testCase.expectedStatus);

        const errorData = await response.json();
        expect(errorData).toHaveProperty('error');
        expect(errorData.error).toMatch(testCase.expectedPattern);
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary network failures', async () => {
      // Create server that fails first, then succeeds
      const intermittentServer = createFailingServer(FILESYSTEM_SERVER, 'timeout');
      await ctx.mockManager.addServer(intermittentServer);

      // First attempt should fail
      const firstResult = await mcpHelpers.installServer(ctx, 'filesystem');
      expect(firstResult.success).toBe(false);

      // Replace with working server
      await ctx.mockManager.removeServer('filesystem');
      await ctx.mockManager.addMarketplaceEntry(FILESYSTEM_SERVER);

      // Second attempt should succeed
      const secondResult = await mcpHelpers.installServer(ctx, 'filesystem');
      mcpHelpers.assertSuccess(secondResult);
    });

    it('should provide helpful troubleshooting information', async () => {
      const result = await mcpHelpers.installServer(ctx, 'nonexistent-server');

      expect(result.success).toBe(false);

      // Should provide helpful context in error messages
      expect(result.stderr).toMatch(/server.*not found|available servers|try.*list/i);
    });

    it('should maintain config integrity after errors', async () => {
      // Install a valid server first
      const successResult = await mcpHelpers.installServer(ctx, 'memory');
      mcpHelpers.assertSuccess(successResult);

      // Try to install invalid server
      const failResult = await mcpHelpers.installServer(ctx, 'nonexistent');
      expect(failResult.success).toBe(false);

      // Verify original server is still properly configured
      const isMemoryInstalled = await mcpHelpers.isServerInstalled(ctx, 'memory');
      expect(isMemoryInstalled).toBe(true);

      // Verify config is still valid YAML
      const config = await mcpHelpers.readConfig(ctx);
      expect(config).toBeDefined();
      expect(config.mcp?.servers?.memory).toBeDefined();
    });
  });

  describe('Comprehensive Error Logging', () => {
    it('should log detailed error information for debugging', async () => {
      // Enable verbose logging
      const result = await mcpHelpers.installServer(ctx, 'nonexistent', { verbose: true });

      expect(result.success).toBe(false);

      // Should provide detailed error information
      const output = result.stderr + result.stdout;
      expect(output).toMatch(/error|failed/i);
      expect(output).toContain('nonexistent');

      // Should include context for debugging
      expect(output.length).toBeGreaterThan(50); // More than just "not found"
    });
  });
});