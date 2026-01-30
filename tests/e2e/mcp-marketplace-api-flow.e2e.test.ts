/**
 * @fileoverview MCP Marketplace API Flow E2E Tests
 *
 * End-to-end tests for MCP marketplace API workflows according to ADR-072.
 * These tests verify the complete API flows:
 * - browse marketplace → search server → install → configure → verify working (via API)
 * - WebSocket event verification for installation/uninstallation
 * - API endpoint comprehensive coverage
 *
 * Architecture: Uses real Fastify server with orchestrator integration
 * and WebSocket client for event verification.
 *
 * @see ADR-072 for test architecture and requirements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import {
  createMCPTestContext,
  mcpHelpers,
  type MCPTestContext,
} from '../helpers/mcp-e2e-helpers.js';
import { createAPITestServer, type APITestServer } from '../helpers/api-e2e-test-server.js';
import { WebSocketTestClient } from '../utils/ws-test-client.js';

describe('MCP Marketplace API Flow E2E Tests (ADR-072)', () => {
  let ctx: MCPTestContext;
  let apiServer: APITestServer;
  let wsClient: WebSocketTestClient;

  beforeEach(async () => {
    ctx = await createMCPTestContext({
      prefix: 'mcp-api-flow-',
    });

    // Start API test server with real orchestrator
    apiServer = await createAPITestServer({
      projectPath: ctx.projectDir,
    });
    await apiServer.start();

    // Create WebSocket client for event verification
    wsClient = await apiServer.createWebSocketClient();
    await wsClient.connect();
  });

  afterEach(async () => {
    await wsClient?.disconnect();
    await apiServer?.stop();
    await ctx.cleanup();
  });

  describe('API Path Flow 1: Complete Marketplace to Installation Flow', () => {
    it('should complete: GET marketplace → GET search → POST install → GET installed → GET status via API', async () => {
      const baseUrl = apiServer.getBaseUrl();

      // Step 1: Browse marketplace
      const marketplaceResponse = await fetch(`${baseUrl}/mcp/marketplace`);
      expect(marketplaceResponse.status).toBe(200);
      const marketplaceData = await marketplaceResponse.json();
      expect(marketplaceData.entries).toBeDefined();
      expect(Array.isArray(marketplaceData.entries)).toBe(true);
      expect(marketplaceData.entries.length).toBeGreaterThan(0);

      // Verify filesystem server is available
      const filesystemEntry = marketplaceData.entries.find((e: any) => e.id === 'filesystem');
      expect(filesystemEntry).toBeDefined();
      expect(filesystemEntry.name).toBe('Filesystem Server');

      // Step 2: Search for specific server
      const searchResponse = await fetch(`${baseUrl}/mcp/marketplace?search=filesystem`);
      expect(searchResponse.status).toBe(200);
      const searchData = await searchResponse.json();
      expect(searchData.entries).toBeDefined();
      const filesystemSearchResult = searchData.entries.find((e: any) => e.id === 'filesystem');
      expect(filesystemSearchResult).toBeDefined();

      // Step 3: Install server via API
      const serverId = 'filesystem';
      const installResponse = await fetch(`${baseUrl}/mcp/install/${serverId}`, {
        method: 'POST',
      });
      expect(installResponse.status).toBe(200);
      const installData = await installResponse.json();
      expect(installData.ok).toBe(true);
      expect(installData.message).toContain('installed successfully');
      expect(installData.serverConfig).toBeDefined();

      // Step 4: Verify installation via installed endpoint
      const installedResponse = await fetch(`${baseUrl}/mcp/installed`);
      expect(installedResponse.status).toBe(200);
      const installedData = await installedResponse.json();
      expect(installedData.installations).toBeDefined();
      expect(Array.isArray(installedData.installations)).toBe(true);
      expect(installedData.installations.length).toBe(1);
      expect(installedData.installations[0].serverId).toBe(serverId);

      // Step 5: Get server details
      const serverDetailsResponse = await fetch(`${baseUrl}/mcp/servers/${serverId}`);
      expect(serverDetailsResponse.status).toBe(200);
      const serverDetails = await serverDetailsResponse.json();
      expect(serverDetails.id).toBe(serverId);
      expect(serverDetails.name).toBe('filesystem');

      // Step 6: Check server status
      const serverStatusResponse = await fetch(`${baseUrl}/mcp/servers/${serverId}/status`);
      expect(serverStatusResponse.status).toBe(200);
      const statusData = await serverStatusResponse.json();
      expect(statusData).toBeDefined();
      // Status might be 'stopped', 'not connected', etc. - that's expected in E2E
    });

    it('should handle filtering and categorization via API', async () => {
      const baseUrl = apiServer.getBaseUrl();

      // Test category filtering
      const categoryResponse = await fetch(`${baseUrl}/mcp/marketplace?category=filesystem`);
      expect(categoryResponse.status).toBe(200);
      const categoryData = await categoryResponse.json();
      expect(categoryData.entries).toBeDefined();

      // Test verified filtering
      const verifiedResponse = await fetch(`${baseUrl}/mcp/marketplace?verified=true`);
      expect(verifiedResponse.status).toBe(200);
      const verifiedData = await verifiedResponse.json();
      expect(verifiedData.entries).toBeDefined();

      // Test featured filtering
      const featuredResponse = await fetch(`${baseUrl}/mcp/marketplace?featured=true`);
      expect(featuredResponse.status).toBe(200);
      const featuredData = await featuredResponse.json();
      expect(featuredData.entries).toBeDefined();

      // Test combined filters
      const combinedResponse = await fetch(`${baseUrl}/mcp/marketplace?category=filesystem&verified=true`);
      expect(combinedResponse.status).toBe(200);
      const combinedData = await combinedResponse.json();
      expect(combinedData.entries).toBeDefined();
    });

    it('should provide consistent data format across all endpoints', async () => {
      const baseUrl = apiServer.getBaseUrl();
      const serverId = 'filesystem';

      // Install a server first
      await fetch(`${baseUrl}/mcp/install/${serverId}`, { method: 'POST' });

      // Get server from marketplace
      const marketplaceResponse = await fetch(`${baseUrl}/mcp/marketplace?search=${serverId}`);
      const marketplaceData = await marketplaceResponse.json();
      const marketplaceEntry = marketplaceData.entries.find((e: any) => e.id === serverId);

      // Get server from installed list
      const installedResponse = await fetch(`${baseUrl}/mcp/installed`);
      const installedData = await installedResponse.json();
      const installedEntry = installedData.installations[0];

      // Get server details
      const detailsResponse = await fetch(`${baseUrl}/mcp/servers/${serverId}`);
      const detailsData = await detailsResponse.json();

      // Verify consistent server identification
      expect(marketplaceEntry.id).toBe(serverId);
      expect(installedEntry.serverId).toBe(serverId);
      expect(detailsData.id).toBe(serverId);

      // Verify consistent naming
      expect(marketplaceEntry.name).toBe('Filesystem Server');
      expect(detailsData.name).toBe('filesystem'); // Config name
    });
  });

  describe('WebSocket Event Verification', () => {
    it('should broadcast mcp:install-start and mcp:install-complete events', async () => {
      const baseUrl = apiServer.getBaseUrl();
      const serverId = 'filesystem';

      // Collect events
      const events: any[] = [];
      wsClient.onMessage((event) => {
        if (event.type?.startsWith('mcp:install') || event.type?.startsWith('mcp:uninstall')) {
          events.push(event);
        }
      });

      // Trigger installation
      const installResponse = await fetch(`${baseUrl}/mcp/install/${serverId}`, {
        method: 'POST',
      });
      expect(installResponse.status).toBe(200);

      // Wait for events to be broadcasted
      await wsClient.waitForEvents((events) => events.length >= 2, 5000);

      // Verify we got start and complete events
      expect(events.length).toBeGreaterThanOrEqual(2);

      const startEvent = events.find(e => e.type === 'mcp:install-start');
      expect(startEvent).toBeDefined();
      expect(startEvent.data.serverId).toBe(serverId);
      expect(startEvent.data.stage).toBe('starting');
      expect(startEvent.data.progress).toBe(0);

      const completeEvent = events.find(e => e.type === 'mcp:install-complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.data.serverId).toBe(serverId);
      expect(completeEvent.data.stage).toBe('complete');
      expect(completeEvent.data.progress).toBe(100);
      expect(completeEvent.data.config).toBeDefined();
    });

    it('should broadcast mcp:uninstall-start and mcp:uninstall-complete events', async () => {
      const baseUrl = apiServer.getBaseUrl();
      const serverId = 'filesystem';

      // Install server first
      await fetch(`${baseUrl}/mcp/install/${serverId}`, { method: 'POST' });

      // Clear previous events and collect new ones
      const events: any[] = [];
      wsClient.onMessage((event) => {
        if (event.type?.startsWith('mcp:uninstall')) {
          events.push(event);
        }
      });

      // Trigger uninstallation
      const uninstallResponse = await fetch(`${baseUrl}/mcp/uninstall/${serverId}`, {
        method: 'DELETE',
      });
      expect(uninstallResponse.status).toBe(200);

      // Wait for events
      await wsClient.waitForEvents((events) => events.length >= 2, 5000);

      // Verify uninstall events
      const startEvent = events.find(e => e.type === 'mcp:uninstall-start');
      expect(startEvent).toBeDefined();
      expect(startEvent.data.serverId).toBe(serverId);
      expect(startEvent.data.stage).toBe('uninstalling');

      const completeEvent = events.find(e => e.type === 'mcp:uninstall-complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.data.serverId).toBe(serverId);
      expect(completeEvent.data.stage).toBe('complete');
    });

    it('should broadcast mcp:install-error events on failure', async () => {
      const baseUrl = apiServer.getBaseUrl();
      const invalidServerId = 'nonexistent-server';

      // Collect events
      const events: any[] = [];
      wsClient.onMessage((event) => {
        if (event.type?.includes('mcp:install')) {
          events.push(event);
        }
      });

      // Trigger installation of non-existent server
      const installResponse = await fetch(`${baseUrl}/mcp/install/${invalidServerId}`, {
        method: 'POST',
      });
      expect(installResponse.status).toBe(500);

      // Wait for error event
      await wsClient.waitForEvents((events) =>
        events.some(e => e.type === 'mcp:install-error'), 5000);

      const errorEvent = events.find(e => e.type === 'mcp:install-error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.data.serverId).toBe(invalidServerId);
      expect(errorEvent.data.stage).toBe('error');
      expect(errorEvent.data.error).toBeDefined();
    });

    it('should provide event structure validation', async () => {
      const baseUrl = apiServer.getBaseUrl();
      const serverId = 'filesystem';

      const events: any[] = [];
      wsClient.onMessage((event) => {
        events.push(event);
      });

      // Trigger installation
      await fetch(`${baseUrl}/mcp/install/${serverId}`, { method: 'POST' });

      // Wait for events
      await wsClient.waitForEvents((events) => events.length >= 2, 5000);

      // Validate event structure
      for (const event of events) {
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('taskId');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('data');
        expect(event.data).toHaveProperty('serverId');
        expect(event.data).toHaveProperty('stage');
        expect(event.data).toHaveProperty('progress');
        expect(event.data).toHaveProperty('message');
        expect(typeof event.data.progress).toBe('number');
      }
    });
  });

  describe('API Endpoint Comprehensive Coverage', () => {
    it('should test all MCP marketplace API endpoints', async () => {
      const baseUrl = apiServer.getBaseUrl();
      const serverId = 'filesystem';

      // GET /mcp/marketplace - Browse marketplace
      const marketplaceResponse = await fetch(`${baseUrl}/mcp/marketplace`);
      expect(marketplaceResponse.status).toBe(200);

      // GET /mcp/marketplace/search?q=term - Search servers
      const searchResponse = await fetch(`${baseUrl}/mcp/marketplace?search=${serverId}`);
      expect(searchResponse.status).toBe(200);

      // POST /mcp/install/:id - Install server
      const installResponse = await fetch(`${baseUrl}/mcp/install/${serverId}`, {
        method: 'POST',
      });
      expect(installResponse.status).toBe(200);

      // GET /mcp/servers/:id - Get server details
      const serverResponse = await fetch(`${baseUrl}/mcp/servers/${serverId}`);
      expect(serverResponse.status).toBe(200);

      // GET /mcp/installed - List installed servers
      const installedResponse = await fetch(`${baseUrl}/mcp/installed`);
      expect(installedResponse.status).toBe(200);

      // GET /mcp/servers/:id/status - Get MCP status
      const statusResponse = await fetch(`${baseUrl}/mcp/servers/${serverId}/status`);
      expect(statusResponse.status).toBe(200);

      // DELETE /mcp/uninstall/:id - Uninstall server
      const uninstallResponse = await fetch(`${baseUrl}/mcp/uninstall/${serverId}`, {
        method: 'DELETE',
      });
      expect(uninstallResponse.status).toBe(200);
    });

    it('should handle server lifecycle operations via API', async () => {
      const baseUrl = apiServer.getBaseUrl();
      const serverId = 'filesystem';

      // Install server
      const installResponse = await fetch(`${baseUrl}/mcp/install/${serverId}`, {
        method: 'POST',
      });
      expect(installResponse.status).toBe(200);

      // Start server
      const startResponse = await fetch(`${baseUrl}/mcp/servers/${serverId}/start`, {
        method: 'POST',
      });
      expect(startResponse.status).toBe(200);

      // Stop server
      const stopResponse = await fetch(`${baseUrl}/mcp/servers/${serverId}/stop`, {
        method: 'POST',
      });
      expect(stopResponse.status).toBe(200);

      // Uninstall server
      const uninstallResponse = await fetch(`${baseUrl}/mcp/uninstall/${serverId}`, {
        method: 'DELETE',
      });
      expect(uninstallResponse.status).toBe(200);
    });

    it('should validate API error responses', async () => {
      const baseUrl = apiServer.getBaseUrl();

      // Test invalid server ID
      const invalidInstallResponse = await fetch(`${baseUrl}/mcp/install/`, {
        method: 'POST',
      });
      expect(invalidInstallResponse.status).toBe(400);

      // Test non-existent server details
      const nonExistentResponse = await fetch(`${baseUrl}/mcp/servers/nonexistent`);
      expect(nonExistentResponse.status).toBe(404);

      // Test invalid uninstall
      const invalidUninstallResponse = await fetch(`${baseUrl}/mcp/uninstall/   `, {
        method: 'DELETE',
      });
      expect(invalidUninstallResponse.status).toBe(400);
    });
  });

  describe('Integration with CLI Path', () => {
    it('should maintain consistency between CLI and API operations', async () => {
      const baseUrl = apiServer.getBaseUrl();
      const serverId = 'filesystem';

      // Install via API
      const apiInstallResponse = await fetch(`${baseUrl}/mcp/install/${serverId}`, {
        method: 'POST',
      });
      expect(apiInstallResponse.status).toBe(200);

      // Verify installation via CLI
      const cliInstalledResult = await mcpHelpers.listInstalled(ctx, true);
      mcpHelpers.assertSuccess(cliInstalledResult);
      const cliServers = JSON.parse(cliInstalledResult.stdout);
      expect(cliServers).toHaveLength(1);
      expect(cliServers[0].name).toBe(serverId);

      // Verify same server is visible via API
      const apiInstalledResponse = await fetch(`${baseUrl}/mcp/installed`);
      const apiServers = await apiInstalledResponse.json();
      expect(apiServers.installations).toHaveLength(1);
      expect(apiServers.installations[0].serverId).toBe(serverId);
    });

    it('should handle mixed CLI/API workflows', async () => {
      const baseUrl = apiServer.getBaseUrl();

      // Install filesystem via CLI
      await mcpHelpers.installServer(ctx, 'filesystem');

      // Install memory via API
      const apiInstallResponse = await fetch(`${baseUrl}/mcp/install/memory`, {
        method: 'POST',
      });
      expect(apiInstallResponse.status).toBe(200);

      // Verify both are visible via API
      const apiResponse = await fetch(`${baseUrl}/mcp/installed`);
      const apiData = await apiResponse.json();
      expect(apiData.installations).toHaveLength(2);

      const serverIds = apiData.installations.map((i: any) => i.serverId);
      expect(serverIds).toContain('filesystem');
      expect(serverIds).toContain('memory');

      // Verify both are visible via CLI
      const cliResult = await mcpHelpers.listInstalled(ctx, true);
      const cliServers = JSON.parse(cliResult.stdout);
      expect(cliServers).toHaveLength(2);

      const cliNames = cliServers.map((s: any) => s.name);
      expect(cliNames).toContain('filesystem');
      expect(cliNames).toContain('memory');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent API requests', async () => {
      const baseUrl = apiServer.getBaseUrl();

      // Make multiple concurrent requests
      const promises = [
        fetch(`${baseUrl}/mcp/marketplace`),
        fetch(`${baseUrl}/mcp/marketplace?category=filesystem`),
        fetch(`${baseUrl}/mcp/marketplace?search=memory`),
        fetch(`${baseUrl}/mcp/marketplace?verified=true`),
      ];

      const responses = await Promise.all(promises);

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });

    it('should maintain WebSocket connections during heavy API usage', async () => {
      const baseUrl = apiServer.getBaseUrl();

      let eventCount = 0;
      wsClient.onMessage(() => {
        eventCount++;
      });

      // Perform multiple operations that generate events
      await fetch(`${baseUrl}/mcp/install/filesystem`, { method: 'POST' });
      await fetch(`${baseUrl}/mcp/install/memory`, { method: 'POST' });
      await fetch(`${baseUrl}/mcp/uninstall/filesystem`, { method: 'DELETE' });
      await fetch(`${baseUrl}/mcp/uninstall/memory`, { method: 'DELETE' });

      // Wait for all events to be received
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have received multiple events (start/complete for each operation)
      expect(eventCount).toBeGreaterThan(4);
    });
  });
});