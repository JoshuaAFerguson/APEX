/**
 * @fileoverview WebSocket Permission Reconnection Tests (GAP-008)
 *
 * High priority gap identified in permission audit documentation.
 * Tests WebSocket reconnection scenarios during permission flows.
 *
 * Gap Reference: docs/permission-audit-documentation.md - GAP-008
 * Priority: High (Security/Reliability Impact)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { ApexAPI } from '../index.js';
import { ApexOrchestrator } from '@apex/orchestrator';

describe.skip('WebSocket Permission Reconnection (GAP-008)', () => {
  let api: ApexAPI;
  let orchestrator: ApexOrchestrator;
  let client: WebSocket;
  let reconnectClient: WebSocket;
  let serverPort: number;

  beforeEach(async () => {
    // Initialize API server
    api = await ApexAPI.create({
      port: 0,
      host: 'localhost'
    });

    await api.listen();
    orchestrator = api.getOrchestrator();

    const address = api.server.address();
    serverPort = typeof address === 'object' && address ? address.port : 3001;

    // Create initial WebSocket connection
    client = new WebSocket(`ws://localhost:${serverPort}/ws`);
    await new Promise(resolve => client.on('open', resolve));
  });

  afterEach(async () => {
    // Cleanup connections
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    if (reconnectClient && reconnectClient.readyState === WebSocket.OPEN) {
      reconnectClient.close();
    }
    if (api) {
      await api.close();
    }
  });

  async function waitForMessage(ws: WebSocket, timeoutMs = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`No message received within ${timeoutMs}ms`));
      }, timeoutMs);

      ws.once('message', (data) => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(data.toString()));
        } catch (error) {
          reject(new Error(`Failed to parse message: ${error}`));
        }
      });
    });
  }

  describe('Permission Request Queuing During Disconnection', () => {
    it('should queue permission responses during client disconnection', async () => {
      // Request permission while connected
      const permissionRequestPromise = orchestrator.requestPermission({
        tool: 'Write',
        scope: '/important/file.txt',
        operation: 'file-write'
      });

      // Wait for permission request message
      const requestMessage = await waitForMessage(client);
      expect(requestMessage.type).toBe('permission:request');
      expect(requestMessage.data.tool).toBe('Write');

      // Simulate client disconnect
      client.close();

      // Grant permission while client is disconnected
      await orchestrator.grantPermissionConfirmation(
        requestMessage.data.permissionId,
        'allow-once'
      );

      // Reconnect client
      reconnectClient = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => reconnectClient.on('open', resolve));

      // Should receive queued grant response after reconnection
      const grantMessage = await waitForMessage(reconnectClient);
      expect(grantMessage.type).toBe('permission:granted');
      expect(grantMessage.data.permissionId).toBe(requestMessage.data.permissionId);
      expect(grantMessage.data.level).toBe('allow-once');
    });

    it('should handle permission timeout during disconnection', async () => {
      // Set short timeout for testing
      const originalTimeout = process.env.APEX_PERMISSION_TIMEOUT;
      process.env.APEX_PERMISSION_TIMEOUT = '1000';

      try {
        // Request permission
        const requestPromise = orchestrator.requestPermission({
          tool: 'Bash',
          scope: 'dangerous-command'
        });

        const requestMessage = await waitForMessage(client);
        expect(requestMessage.type).toBe('permission:request');

        // Disconnect client
        client.close();

        // Wait for timeout to occur
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Reconnect
        reconnectClient = new WebSocket(`ws://localhost:${serverPort}/ws`);
        await new Promise(resolve => reconnectClient.on('open', resolve));

        // Should receive timeout notification
        const timeoutMessage = await waitForMessage(reconnectClient);
        expect(timeoutMessage.type).toBe('permission:timeout');
        expect(timeoutMessage.data.tool).toBe('Bash');
      } finally {
        // Restore original timeout
        if (originalTimeout) {
          process.env.APEX_PERMISSION_TIMEOUT = originalTimeout;
        } else {
          delete process.env.APEX_PERMISSION_TIMEOUT;
        }
      }
    });
  });

  describe('Permission State Synchronization', () => {
    it('should sync permission state on reconnection', async () => {
      // Create multiple permission requests
      const permission1Promise = orchestrator.requestPermission({
        tool: 'Read',
        scope: '/file1.txt'
      });

      const permission2Promise = orchestrator.requestPermission({
        tool: 'Write',
        scope: '/file2.txt'
      });

      // Wait for both requests
      const request1 = await waitForMessage(client);
      const request2 = await waitForMessage(client);

      // Grant first permission
      await orchestrator.grantPermissionConfirmation(
        request1.data.permissionId,
        'allow-always'
      );

      // Disconnect and reconnect
      client.close();
      reconnectClient = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => reconnectClient.on('open', resolve));

      // Should receive state sync message
      const syncMessage = await waitForMessage(reconnectClient);
      expect(syncMessage.type).toBe('permission:sync');
      expect(syncMessage.data.grantedPermissions).toHaveLength(1);
      expect(syncMessage.data.pendingRequests).toHaveLength(1);
      expect(syncMessage.data.grantedPermissions[0].tool).toBe('Read');
      expect(syncMessage.data.pendingRequests[0].tool).toBe('Write');
    });

    it('should handle multiple reconnection attempts gracefully', async () => {
      // Request permission
      const requestPromise = orchestrator.requestPermission({
        tool: 'Edit',
        scope: '/test.txt'
      });

      const requestMessage = await waitForMessage(client);

      // Multiple disconnect/reconnect cycles
      for (let i = 0; i < 3; i++) {
        client.close();

        // Short delay between reconnections
        await new Promise(resolve => setTimeout(resolve, 100));

        client = new WebSocket(`ws://localhost:${serverPort}/ws`);
        await new Promise(resolve => client.on('open', resolve));
      }

      // Grant permission after reconnections
      await orchestrator.grantPermissionConfirmation(
        requestMessage.data.permissionId,
        'allow-always'
      );

      // Should still receive grant notification
      const grantMessage = await waitForMessage(client);
      expect(grantMessage.type).toBe('permission:granted');
      expect(grantMessage.data.permissionId).toBe(requestMessage.data.permissionId);
    });
  });

  describe('Concurrent Permission Handling During Reconnection', () => {
    it('should handle concurrent permissions across reconnection', async () => {
      // Create multiple clients
      const client2 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => client2.on('open', resolve));

      try {
        // Both clients request permissions
        const request1Promise = orchestrator.requestPermission({
          tool: 'Write',
          scope: '/shared/file1.txt'
        });

        const request2Promise = orchestrator.requestPermission({
          tool: 'Write',
          scope: '/shared/file2.txt'
        });

        // Each client should receive both requests
        const req1_client1 = await waitForMessage(client);
        const req2_client1 = await waitForMessage(client);
        const req1_client2 = await waitForMessage(client2);
        const req2_client2 = await waitForMessage(client2);

        // Disconnect client1
        client.close();

        // Grant permission from client2
        await orchestrator.grantPermissionConfirmation(
          req1_client1.data.permissionId,
          'allow-always'
        );

        // Reconnect client1
        reconnectClient = new WebSocket(`ws://localhost:${serverPort}/ws`);
        await new Promise(resolve => reconnectClient.on('open', resolve));

        // Both clients should receive the grant notification
        const grantClient2 = await waitForMessage(client2);
        const grantReconnected = await waitForMessage(reconnectClient);

        expect(grantClient2.type).toBe('permission:granted');
        expect(grantReconnected.type).toBe('permission:granted');
        expect(grantClient2.data.permissionId).toBe(grantReconnected.data.permissionId);
      } finally {
        client2.close();
      }
    });

    it('should preserve permission session context across reconnection', async () => {
      // Set up session-specific permission
      await orchestrator.grantPermission('Read', '/session/*', 'allow-once');

      // Request using session permission
      const sessionRequest = orchestrator.requestPermission({
        tool: 'Read',
        scope: '/session/data.txt'
      });

      // Disconnect before permission is consumed
      client.close();

      // Reconnect
      reconnectClient = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => reconnectClient.on('open', resolve));

      // Permission should still be valid and consumable
      const sessionGrant = await waitForMessage(reconnectClient);
      expect(sessionGrant.type).toBe('permission:granted');
      expect(sessionGrant.data.level).toBe('allow-once');

      // Verify session context is preserved
      expect(sessionGrant.data.scope).toBe('/session/data.txt');
    });
  });

  describe('Error Handling During Reconnection', () => {
    it('should handle malformed permission messages during reconnection', async () => {
      // Send malformed message after reconnection
      reconnectClient = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => reconnectClient.on('open', resolve));

      // Send invalid permission request
      reconnectClient.send(JSON.stringify({
        type: 'permission:invalid',
        data: { malformed: true }
      }));

      // Server should handle gracefully and send error response
      const errorMessage = await waitForMessage(reconnectClient);
      expect(errorMessage.type).toBe('error');
      expect(errorMessage.data.message).toContain('Invalid permission message');
    });

    it('should handle server-side errors during permission sync', async () => {
      // Mock a server-side error condition
      const mockError = vi.spyOn(orchestrator, 'listPermissions')
        .mockRejectedValue(new Error('Database connection lost'));

      try {
        // Trigger reconnection with error condition
        client.close();
        reconnectClient = new WebSocket(`ws://localhost:${serverPort}/ws`);
        await new Promise(resolve => reconnectClient.on('open', resolve));

        // Should receive error notification instead of sync
        const errorMessage = await waitForMessage(reconnectClient);
        expect(errorMessage.type).toBe('error');
        expect(errorMessage.data.message).toContain('Failed to sync permissions');
      } finally {
        mockError.mockRestore();
      }
    });
  });
});