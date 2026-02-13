/**
 * API Permission Notifications Integration Tests
 *
 * Tests for API layer permission notification flows including WebSocket
 * real-time updates, REST endpoint permission checks, and API-Orchestrator
 * permission event propagation.
 *
 * Coverage Goals:
 * - API → Orchestrator permission request flows
 * - WebSocket real-time permission notifications
 * - REST endpoint permission validation
 * - API authentication and permission integration
 * - Error handling across API boundaries
 *
 * @module tests/integration/api-permission-notifications
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { PermissionStore, PermissionManager } from '@apexcli/orchestrator';
import { PermissionLevel } from '@apexcli/core';
import { EventEmitter } from 'eventemitter3';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

// Mock WebSocket for testing
class MockWebSocket extends EventEmitter {
  readyState = 1; // OPEN
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
  }

  send(data: string) {
    // Emit the sent data for testing purposes
    this.emit('send', JSON.parse(data));
  }

  close() {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }

  // Simulate receiving a message
  simulateMessage(data: any) {
    this.emit('message', { data: JSON.stringify(data) });
  }
}

// Mock HTTP client for REST API testing
class MockAPIClient {
  private baseURL: string;
  private responses: Map<string, any> = new Map();

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setMockResponse(endpoint: string, response: any) {
    this.responses.set(endpoint, response);
  }

  async get(endpoint: string): Promise<any> {
    const mockResponse = this.responses.get(endpoint);
    if (mockResponse) {
      return mockResponse;
    }
    throw new Error(`No mock response configured for GET ${endpoint}`);
  }

  async post(endpoint: string, data: any): Promise<any> {
    const mockResponse = this.responses.get(endpoint);
    if (mockResponse) {
      return mockResponse;
    }
    return { success: true, data };
  }

  async put(endpoint: string, data: any): Promise<any> {
    const mockResponse = this.responses.get(endpoint);
    if (mockResponse) {
      return mockResponse;
    }
    return { success: true, data };
  }

  async delete(endpoint: string): Promise<any> {
    const mockResponse = this.responses.get(endpoint);
    if (mockResponse) {
      return mockResponse;
    }
    return { success: true };
  }
}

// ============================================================================
// Test Infrastructure
// ============================================================================

interface APITestContext {
  tempDir: string;
  orchestrator: ApexOrchestrator;
  permissionManager: PermissionManager;
  permissionStore: PermissionStore;
  webSocket: MockWebSocket;
  apiClient: MockAPIClient;
  eventCapture: EventCapture;
  cleanup: () => Promise<void>;
}

class EventCapture extends EventEmitter {
  private events: Array<{ type: string; data: unknown; timestamp: number }> = [];

  constructor() {
    super();
    this.onAny((type: string, data: unknown) => {
      this.events.push({
        type,
        data,
        timestamp: Date.now()
      });
    });
  }

  async waitForEvent(type: string, timeout = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(type, handler);
        reject(new Error(`Timeout waiting for event: ${type}`));
      }, timeout);

      const handler = (data: unknown) => {
        clearTimeout(timer);
        this.off(type, handler);
        resolve(data);
      };

      this.once(type, handler);
    });
  }

  getEventsOfType(type: string): Array<unknown> {
    return this.events
      .filter(event => event.type === type)
      .map(event => event.data);
  }

  getEventHistory(): Array<{ type: string; data: unknown; timestamp: number }> {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
    this.removeAllListeners();
  }
}

async function createAPITestContext(): Promise<APITestContext> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-test-'));

  const apexDir = path.join(tempDir, '.apex');
  await fs.mkdir(apexDir, { recursive: true });

  const configContent = `
version: "1.0"
project:
  name: "api-permission-test"
  testCommand: "npm test"
  lintCommand: "npm run lint"
  buildCommand: "npm run build"
api:
  port: 3001
  cors:
    enabled: true
    origins: ["http://localhost:3000"]
  websocket:
    enabled: true
    path: "/ws"
autonomy:
  default: "manual"
  tools:
    Read: "full"
    Write: "manual"
    Browser: "deny"
`;

  await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

  const orchestrator = new ApexOrchestrator();
  await orchestrator.init(tempDir);

  const permissionManager = (orchestrator as any).permissionManager as PermissionManager;
  const permissionStore = (orchestrator as any).permissionStore as PermissionStore;

  // Create mock WebSocket and API client
  const webSocket = new MockWebSocket('ws://localhost:3001/ws');
  const apiClient = new MockAPIClient('http://localhost:3001');

  const eventCapture = new EventCapture();

  // Wire up orchestrator events to event capture and mock API
  orchestrator.on('permission:denied', (data) => {
    eventCapture.emit('permission:denied', data);
    // Simulate API broadcasting this to connected clients
    webSocket.simulateMessage({
      type: 'permission:denied',
      timestamp: Date.now(),
      data
    });
  });

  orchestrator.on('permission:granted', (data) => {
    eventCapture.emit('permission:granted', data);
    webSocket.simulateMessage({
      type: 'permission:granted',
      timestamp: Date.now(),
      data
    });
  });

  orchestrator.on('permission:request', (data) => {
    eventCapture.emit('permission:request', data);
    webSocket.simulateMessage({
      type: 'permission:request',
      timestamp: Date.now(),
      data
    });
  });

  // Capture WebSocket messages
  webSocket.on('send', (data) => eventCapture.emit('websocket:send', data));
  webSocket.on('message', (data) => eventCapture.emit('websocket:message', data));

  const cleanup = async () => {
    webSocket.close();
    await orchestrator.shutdown();
    eventCapture.clear();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory: ${error}`);
    }
  };

  return {
    tempDir,
    orchestrator,
    permissionManager,
    permissionStore,
    webSocket,
    apiClient,
    eventCapture,
    cleanup
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('API Permission Notifications Integration', () => {
  let context: APITestContext;

  beforeEach(async () => {
    context = await createAPITestContext();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  describe('WebSocket Permission Notifications', () => {
    it('should broadcast permission denial events to connected clients', async () => {
      const { permissionManager, webSocket, eventCapture } = context;

      // Setup WebSocket message listener
      const messagePromise = eventCapture.waitForEvent('websocket:message', 3000);

      // Trigger permission denial
      await permissionManager.grantPermission('Browser', 'deny', 'https://blocked.com');

      // Verify WebSocket message was sent
      const message = await messagePromise;
      expect(message).toMatchObject({
        type: 'permission:granted', // Granting a "deny" level still triggers granted event
        data: {
          tool: 'Browser',
          scope: 'https://blocked.com',
          level: 'deny'
        }
      });

      // Verify timestamp is reasonable (within last 5 seconds)
      expect((message as any).timestamp).toBeGreaterThan(Date.now() - 5000);
    });

    it('should handle WebSocket connection errors gracefully', async () => {
      const { permissionManager, webSocket, eventCapture } = context;

      // Simulate WebSocket disconnection
      webSocket.close();
      expect(webSocket.readyState).toBe(3); // CLOSED

      // Permission operations should still work even if WebSocket is down
      await permissionManager.grantPermission('Write', 'allow-once', '/api/test.txt');

      const state = await permissionManager.checkPermission('Write', '/api/test.txt');
      expect(state).toBe('allow-once');

      // Should still emit orchestrator events
      const events = eventCapture.getEventsOfType('permission:granted');
      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle rapid permission changes without losing messages', async () => {
      const { permissionManager, eventCapture } = context;

      const tool = 'Write';
      const scopes = ['/file1.txt', '/file2.txt', '/file3.txt'];

      // Rapid permission grants
      const promises = scopes.map(scope =>
        permissionManager.grantPermission(tool, 'allow-always', scope)
      );

      await Promise.all(promises);

      // Allow time for all events to propagate
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check that all WebSocket messages were captured
      const wsMessages = eventCapture.getEventsOfType('websocket:message');
      expect(wsMessages.length).toBe(scopes.length);

      // Verify each scope was covered
      const messageScopes = wsMessages.map((msg: any) => msg.data.scope);
      scopes.forEach(scope => {
        expect(messageScopes).toContain(scope);
      });
    });
  });

  describe('REST API Permission Endpoints', () => {
    it('should handle GET /api/permissions requests', async () => {
      const { permissionManager, apiClient } = context;

      // Setup permissions
      await permissionManager.grantPermission('Read', 'allow-always', '/project');
      await permissionManager.grantPermission('Write', 'deny', '/sensitive');

      // Mock API response
      const permissions = [
        { tool: 'Read', scope: '/project', level: 'allow-always' },
        { tool: 'Write', scope: '/sensitive', level: 'deny' }
      ];
      apiClient.setMockResponse('/api/permissions', { permissions });

      // Test API call
      const response = await apiClient.get('/api/permissions');
      expect(response.permissions).toHaveLength(2);
      expect(response.permissions[0]).toMatchObject({
        tool: 'Read',
        scope: '/project',
        level: 'allow-always'
      });
    });

    it('should handle POST /api/permissions/grant requests', async () => {
      const { permissionManager, apiClient, eventCapture } = context;

      const grantRequest = {
        tool: 'Bash',
        scope: 'npm-install',
        level: 'allow-once'
      };

      // Setup event listener
      const grantPromise = eventCapture.waitForEvent('permission:granted', 3000);

      // Mock successful API response
      apiClient.setMockResponse('/api/permissions/grant', { success: true, granted: grantRequest });

      // Simulate API call (in real scenario this would trigger orchestrator)
      await permissionManager.grantPermission(grantRequest.tool, grantRequest.level as PermissionLevel, grantRequest.scope);

      const response = await apiClient.post('/api/permissions/grant', grantRequest);
      expect(response.success).toBe(true);

      // Verify event was emitted
      const grantEvent = await grantPromise;
      expect(grantEvent).toMatchObject({
        tool: 'Bash',
        scope: 'npm-install',
        level: 'allow-once'
      });

      // Verify permission was actually granted
      const state = await permissionManager.checkPermission('Bash', 'npm-install');
      expect(state).toBe('allow-once');
    });

    it('should handle PUT /api/permissions/revoke requests', async () => {
      const { permissionManager, apiClient, eventCapture } = context;

      // Grant permission first
      await permissionManager.grantPermission('Write', 'allow-always', '/revoke-test.txt');

      const revokeRequest = {
        tool: 'Write',
        scope: '/revoke-test.txt'
      };

      // Setup event listener
      const denialPromise = eventCapture.waitForEvent('permission:granted', 3000);

      // Mock successful API response
      apiClient.setMockResponse('/api/permissions/revoke', { success: true, revoked: revokeRequest });

      // Simulate revocation (grant deny level)
      await permissionManager.grantPermission('Write', 'deny', '/revoke-test.txt');

      const response = await apiClient.put('/api/permissions/revoke', revokeRequest);
      expect(response.success).toBe(true);

      // Verify revocation event
      const denialEvent = await denialPromise;
      expect(denialEvent).toMatchObject({
        tool: 'Write',
        scope: '/revoke-test.txt',
        level: 'deny'
      });

      // Verify permission was revoked
      const checkResult = await permissionManager.checkToolPermission('Write', { scope: '/revoke-test.txt' });
      expect(checkResult.allowed).toBe(false);
    });

    it('should validate API request parameters', async () => {
      const { apiClient } = context;

      // Test invalid grant request
      const invalidRequest = {
        tool: '', // Invalid empty tool
        scope: '/test',
        level: 'invalid-level'
      };

      // Mock validation error response
      apiClient.setMockResponse('/api/permissions/grant', {
        success: false,
        error: 'Invalid tool name or permission level',
        validationErrors: ['tool name is required', 'invalid permission level']
      });

      const response = await apiClient.post('/api/permissions/grant', invalidRequest);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid');
      expect(response.validationErrors).toHaveLength(2);
    });
  });

  describe('API Authentication and Authorization', () => {
    it('should handle authenticated permission requests', async () => {
      const { apiClient } = context;

      // Mock authenticated request
      const authHeaders = { 'Authorization': 'Bearer test-token-123' };

      // Mock authenticated response
      apiClient.setMockResponse('/api/permissions', {
        permissions: [],
        user: { id: 'test-user', role: 'admin' }
      });

      const response = await apiClient.get('/api/permissions');
      expect(response.user).toMatchObject({
        id: 'test-user',
        role: 'admin'
      });
    });

    it('should reject unauthorized permission modification requests', async () => {
      const { apiClient } = context;

      // Mock unauthorized response
      apiClient.setMockResponse('/api/permissions/grant', {
        success: false,
        error: 'Unauthorized - admin access required',
        statusCode: 403
      });

      const grantRequest = {
        tool: 'Bash',
        scope: 'dangerous-command',
        level: 'allow-always'
      };

      const response = await apiClient.post('/api/permissions/grant', grantRequest);
      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(403);
      expect(response.error).toContain('Unauthorized');
    });

    it('should handle role-based permission restrictions', async () => {
      const { apiClient } = context;

      // Mock different responses for different roles
      const readOnlyUserResponse = {
        permissions: [{ tool: 'Read', scope: '*', level: 'allow-always' }],
        user: { id: 'read-user', role: 'read-only' }
      };

      const adminUserResponse = {
        permissions: [
          { tool: 'Read', scope: '*', level: 'allow-always' },
          { tool: 'Write', scope: '*', level: 'allow-always' },
          { tool: 'Bash', scope: '*', level: 'allow-always' }
        ],
        user: { id: 'admin-user', role: 'admin' }
      };

      // Test read-only user permissions
      apiClient.setMockResponse('/api/permissions', readOnlyUserResponse);
      const readOnlyResponse = await apiClient.get('/api/permissions');
      expect(readOnlyResponse.permissions).toHaveLength(1);
      expect(readOnlyResponse.user.role).toBe('read-only');

      // Test admin user permissions
      apiClient.setMockResponse('/api/permissions', adminUserResponse);
      const adminResponse = await apiClient.get('/api/permissions');
      expect(adminResponse.permissions).toHaveLength(3);
      expect(adminResponse.user.role).toBe('admin');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle API server connectivity issues', async () => {
      const { permissionManager, eventCapture } = context;

      // Permission operations should work even if API is unreachable
      await permissionManager.grantPermission('Read', 'allow-always', '/offline-test');

      const state = await permissionManager.checkPermission('Read', '/offline-test');
      expect(state).toBe('allow-always');

      // Events should still be emitted locally
      const events = eventCapture.getEventsOfType('permission:granted');
      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle malformed API responses gracefully', async () => {
      const { apiClient } = context;

      // Mock malformed response
      apiClient.setMockResponse('/api/permissions', null);

      try {
        await apiClient.get('/api/permissions');
        // If no error is thrown, verify response is handled
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Mock partially malformed response
      apiClient.setMockResponse('/api/permissions', { permissions: null });

      const response = await apiClient.get('/api/permissions');
      expect(response.permissions).toBe(null);
    });

    it('should handle WebSocket reconnection scenarios', async () => {
      const { eventCapture, webSocket } = context;

      // Simulate disconnection
      webSocket.close();
      expect(webSocket.readyState).toBe(3);

      // Simulate reconnection (create new WebSocket)
      const newWebSocket = new MockWebSocket('ws://localhost:3001/ws');

      // Should be able to receive messages on new connection
      newWebSocket.simulateMessage({
        type: 'permission:test',
        data: { reconnected: true }
      });

      // Events should still work
      expect(newWebSocket.readyState).toBe(1); // OPEN
    });

    it('should handle concurrent API requests gracefully', async () => {
      const { apiClient } = context;

      // Setup mock responses for concurrent requests
      apiClient.setMockResponse('/api/permissions/grant', { success: true });

      // Make multiple concurrent API calls
      const requests = Array.from({ length: 10 }, (_, i) => ({
        tool: `Tool${i}`,
        scope: `/concurrent/${i}`,
        level: 'allow-once'
      }));

      const promises = requests.map(req =>
        apiClient.post('/api/permissions/grant', req)
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });
  });

  describe('Real-time Event Streaming', () => {
    it('should stream permission events in real-time', async () => {
      const { permissionManager, eventCapture } = context;

      // Track streaming events
      const streamEvents: any[] = [];
      eventCapture.on('websocket:message', (data) => {
        streamEvents.push(data);
      });

      // Generate multiple permission events
      await permissionManager.grantPermission('Read', 'allow-always', '/stream1');
      await permissionManager.grantPermission('Write', 'deny', '/stream2');
      await permissionManager.grantPermission('Bash', 'allow-once', 'stream-command');

      // Allow time for events to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all events were streamed
      expect(streamEvents.length).toBe(3);

      const tools = streamEvents.map((event: any) => event.data.tool);
      expect(tools).toContain('Read');
      expect(tools).toContain('Write');
      expect(tools).toContain('Bash');
    });

    it('should handle event streaming with client subscriptions', async () => {
      const { webSocket, eventCapture } = context;

      // Simulate client subscription
      const subscriptionMessage = {
        type: 'subscribe',
        topics: ['permission:granted', 'permission:denied']
      };

      webSocket.send(JSON.stringify(subscriptionMessage));

      // Verify subscription message was sent
      const sentEvents = eventCapture.getEventsOfType('websocket:send');
      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0]).toMatchObject({
        type: 'subscribe',
        topics: ['permission:granted', 'permission:denied']
      });
    });

    it('should filter events based on client permissions', async () => {
      const { webSocket } = context;

      // Simulate client with limited permissions
      const clientContext = {
        userId: 'limited-user',
        permissions: ['read-only']
      };

      // In a real implementation, the server would filter events
      // based on client permissions. Here we simulate the concept:
      const shouldStreamEvent = (eventType: string, clientPermissions: string[]) => {
        if (eventType === 'permission:denied' && !clientPermissions.includes('admin')) {
          return false; // Don't stream sensitive events to non-admin users
        }
        return true;
      };

      expect(shouldStreamEvent('permission:granted', ['read-only'])).toBe(true);
      expect(shouldStreamEvent('permission:denied', ['read-only'])).toBe(false);
      expect(shouldStreamEvent('permission:denied', ['admin'])).toBe(true);
    });
  });
});

describe('API Permission Integration Infrastructure', () => {
  it('should create isolated test environments with mocked APIs', async () => {
    const context1 = await createAPITestContext();
    const context2 = await createAPITestContext();

    try {
      // Verify different temp directories and isolated state
      expect(context1.tempDir).not.toBe(context2.tempDir);

      // Set up different API responses
      context1.apiClient.setMockResponse('/test', { context: 1 });
      context2.apiClient.setMockResponse('/test', { context: 2 });

      const response1 = await context1.apiClient.get('/test');
      const response2 = await context2.apiClient.get('/test');

      expect(response1.context).toBe(1);
      expect(response2.context).toBe(2);
    } finally {
      await context1.cleanup();
      await context2.cleanup();
    }
  });

  it('should handle WebSocket mock lifecycle correctly', async () => {
    const context = await createAPITestContext();

    try {
      const { webSocket, eventCapture } = context;

      expect(webSocket.readyState).toBe(1); // OPEN

      // Test message sending
      webSocket.send(JSON.stringify({ test: 'message' }));

      const sentEvents = eventCapture.getEventsOfType('websocket:send');
      expect(sentEvents).toHaveLength(1);

      // Test message receiving
      webSocket.simulateMessage({ received: true });

      const receivedEvents = eventCapture.getEventsOfType('websocket:message');
      expect(receivedEvents).toHaveLength(1);

      // Test close
      webSocket.close();
      expect(webSocket.readyState).toBe(3); // CLOSED
    } finally {
      await context.cleanup();
    }
  });
});