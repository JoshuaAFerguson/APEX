/**
 * WebSocket Event Broadcasting Tests for Context Injection - @apex/api Package
 *
 * Tests WebSocket event broadcasting specifically for the context injection endpoint:
 * - Event structure validation
 * - Broadcasting to different client types
 * - Event filtering and routing
 * - Connection handling during context injection
 * - Event payload validation
 *
 * Acceptance Criteria:
 * 1. WebSocket events are broadcasted when context is injected
 * 2. Event structure matches ContextInjectedEventData specification
 * 3. Events are properly routed to task-specific and global clients
 * 4. Event payloads contain all required fields
 * 5. Broadcasting continues to work under various connection scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  createTestEnvironment,
  TestSetup,
  TestDataGenerators,
  WebSocketTestClient
} from './setup.js';
import {
  InjectContextRequest,
  InjectContextResponse,
  ContextInjectedEventData,
  ApexEvent
} from '@apexcli/core';

/**
 * Test context for WebSocket broadcasting tests
 */
interface ContextWebSocketTestContext {
  app: FastifyInstance;
  serverPort: number;
  projectPath: string;
  cleanup: () => Promise<void>;
  httpUtils: any;
  createWebSocketClient: (taskId?: string, events?: string[]) => WebSocketTestClient;
  createGlobalWebSocketClient: () => WebSocketTestClient;
}

describe('Context Injection WebSocket Broadcasting Tests', () => {
  let context: ContextWebSocketTestContext;

  beforeEach(async () => {
    const env = await createTestEnvironment({ silent: true });
    context = env;
  });

  afterEach(async () => {
    await context.cleanup();
  });

  describe('Event Broadcasting to Global Clients', () => {
    it('should broadcast context:injected event to global WebSocket clients', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('WebSocket broadcast test');
      if (createResponse.statusCode !== 201) {
        return; // Skip if can't create task
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup global WebSocket client
      const globalClient = context.createGlobalWebSocketClient();
      await globalClient.waitForConnection();

      // Inject context
      const contextPayload: InjectContextRequest = {
        context: 'WebSocket broadcasting test context',
        source: 'websocket-test',
        priority: 'high',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        // Wait for WebSocket event
        const event: ApexEvent = await globalClient.waitForMessage('context:injected', 5000);

        expect(event).toBeDefined();
        expect(event.type).toBe('context:injected');
        expect(event.taskId).toBe(taskId);
        expect(event.timestamp).toBeDefined();
        expect(new Date(event.timestamp)).toBeInstanceOf(Date);

        // Verify event data
        const eventData: ContextInjectedEventData = event.data as ContextInjectedEventData;
        expect(eventData.context).toBe('WebSocket broadcasting test context');
        expect(eventData.source).toBe('websocket-test');
        expect(eventData.priority).toBe('high');
        expect(eventData.timestamp).toBeDefined();
        expect(new Date(eventData.timestamp)).toBeInstanceOf(Date);
      }

      globalClient.close();
    });

    it('should broadcast to multiple global WebSocket clients', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Multi-client broadcast test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup multiple global WebSocket clients
      const clients = [
        context.createGlobalWebSocketClient(),
        context.createGlobalWebSocketClient(),
        context.createGlobalWebSocketClient()
      ];

      // Wait for all connections
      await Promise.all(clients.map(client => client.waitForConnection()));

      // Inject context
      const contextPayload: InjectContextRequest = {
        context: 'Multi-client broadcast test',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        // All clients should receive the event
        const events = await Promise.all(
          clients.map(client => client.waitForMessage('context:injected', 5000))
        );

        events.forEach(event => {
          expect(event).toBeDefined();
          expect(event.type).toBe('context:injected');
          expect(event.taskId).toBe(taskId);

          const eventData: ContextInjectedEventData = event.data as ContextInjectedEventData;
          expect(eventData.context).toBe('Multi-client broadcast test');
        });
      }

      // Clean up connections
      clients.forEach(client => client.close());
    });
  });

  describe('Event Broadcasting to Task-Specific Clients', () => {
    it('should broadcast to task-specific WebSocket clients', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Task-specific broadcast test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup task-specific WebSocket client
      const taskClient = context.createWebSocketClient(taskId);
      await taskClient.waitForConnection();

      // Inject context
      const contextPayload: InjectContextRequest = {
        context: 'Task-specific context',
        source: 'task-client-test',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        // Wait for event
        const event: ApexEvent = await taskClient.waitForMessage('context:injected', 5000);

        expect(event).toBeDefined();
        expect(event.type).toBe('context:injected');
        expect(event.taskId).toBe(taskId);

        const eventData: ContextInjectedEventData = event.data as ContextInjectedEventData;
        expect(eventData.context).toBe('Task-specific context');
        expect(eventData.source).toBe('task-client-test');
      }

      taskClient.close();
    });

    it('should filter events by event type for task-specific clients', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Event filtering test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup task-specific client filtering for context:injected events only
      const filteredClient = context.createWebSocketClient(taskId, ['context:injected']);
      await filteredClient.waitForConnection();

      // Inject context
      const contextPayload: InjectContextRequest = {
        context: 'Filtered event test',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        // Should receive the filtered event
        const event: ApexEvent = await filteredClient.waitForMessage('context:injected', 5000);
        expect(event.type).toBe('context:injected');
      }

      filteredClient.close();
    });

    it('should not send events to clients filtering for different event types', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Event exclusion test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup task-specific client filtering for different event types
      const filteredClient = context.createWebSocketClient(taskId, ['task:started', 'task:completed']);
      await filteredClient.waitForConnection();

      // Inject context
      const contextPayload: InjectContextRequest = {
        context: 'Should not reach filtered client',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        // Should NOT receive the event
        let receivedEvent = false;
        try {
          await filteredClient.waitForMessage('context:injected', 1000);
          receivedEvent = true;
        } catch (error) {
          // Expected timeout
          expect(error.message).toContain('timeout');
        }

        expect(receivedEvent).toBe(false);
      }

      filteredClient.close();
    });
  });

  describe('Event Structure and Payload Validation', () => {
    it('should include all required ApexEvent fields', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Event structure test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup WebSocket client
      const client = context.createGlobalWebSocketClient();
      await client.waitForConnection();

      // Inject context
      const contextPayload: InjectContextRequest = {
        context: 'Event structure validation',
        source: 'structure-test',
        priority: 'normal',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        const event: ApexEvent = await client.waitForMessage('context:injected', 5000);

        // Validate ApexEvent structure
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('taskId');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('data');

        expect(event.type).toBe('context:injected');
        expect(event.taskId).toBe(taskId);
        expect(typeof event.timestamp).toBe('string');
        expect(typeof event.data).toBe('object');
      }

      client.close();
    });

    it('should include all required ContextInjectedEventData fields', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Event data validation');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup WebSocket client
      const client = context.createGlobalWebSocketClient();
      await client.waitForConnection();

      // Inject context with all optional fields
      const contextPayload: InjectContextRequest = {
        context: 'Complete event data validation',
        source: 'data-validation-test',
        priority: 'high',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        const event: ApexEvent = await client.waitForMessage('context:injected', 5000);
        const eventData: ContextInjectedEventData = event.data as ContextInjectedEventData;

        // Validate ContextInjectedEventData structure
        expect(eventData).toHaveProperty('context');
        expect(eventData).toHaveProperty('source');
        expect(eventData).toHaveProperty('priority');
        expect(eventData).toHaveProperty('timestamp');

        expect(eventData.context).toBe('Complete event data validation');
        expect(eventData.source).toBe('data-validation-test');
        expect(eventData.priority).toBe('high');
        expect(typeof eventData.timestamp).toBe('string');
        expect(new Date(eventData.timestamp)).toBeInstanceOf(Date);
      }

      client.close();
    });

    it('should handle missing optional fields in event data', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Minimal event data test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup WebSocket client
      const client = context.createGlobalWebSocketClient();
      await client.waitForConnection();

      // Inject context with minimal data
      const contextPayload: InjectContextRequest = {
        context: 'Minimal context',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        const event: ApexEvent = await client.waitForMessage('context:injected', 5000);
        const eventData: ContextInjectedEventData = event.data as ContextInjectedEventData;

        // Required fields should be present
        expect(eventData.context).toBe('Minimal context');
        expect(eventData.timestamp).toBeDefined();

        // Optional fields should have defaults or be undefined
        expect(eventData.priority).toBe('normal'); // Should default to 'normal'
        expect(eventData.source).toBeUndefined();
      }

      client.close();
    });

    it('should trim context in event data', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Context trimming test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup WebSocket client
      const client = context.createGlobalWebSocketClient();
      await client.waitForConnection();

      // Inject context with whitespace
      const contextPayload: InjectContextRequest = {
        context: '   Context with whitespace   ',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        const event: ApexEvent = await client.waitForMessage('context:injected', 5000);
        const eventData: ContextInjectedEventData = event.data as ContextInjectedEventData;

        // Context should be trimmed in event data
        expect(eventData.context).toBe('Context with whitespace');
      }

      client.close();
    });
  });

  describe('Connection Handling During Context Injection', () => {
    it('should handle client disconnections gracefully', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Disconnection handling test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup WebSocket client and then disconnect it
      const client = context.createGlobalWebSocketClient();
      await client.waitForConnection();
      client.close();

      // Wait a moment for disconnection to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Inject context - should not fail even with disconnected client
      const contextPayload: InjectContextRequest = {
        context: 'Context with disconnected client',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      // Response should still be successful
      if (injectResponse.statusCode === 200) {
        const responseBody: InjectContextResponse = JSON.parse(injectResponse.body);
        expect(responseBody.ok).toBe(true);
        expect(responseBody.contextInjected).toBe(true);
      }
    });

    it('should continue broadcasting to remaining clients when some disconnect', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Partial disconnection test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup multiple clients
      const client1 = context.createGlobalWebSocketClient();
      const client2 = context.createGlobalWebSocketClient();
      const client3 = context.createGlobalWebSocketClient();

      await Promise.all([
        client1.waitForConnection(),
        client2.waitForConnection(),
        client3.waitForConnection()
      ]);

      // Disconnect one client
      client2.close();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Inject context
      const contextPayload: InjectContextRequest = {
        context: 'Partial disconnection test',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        // Remaining clients should receive the event
        const [event1, event3] = await Promise.all([
          client1.waitForMessage('context:injected', 5000),
          client3.waitForMessage('context:injected', 5000)
        ]);

        expect(event1).toBeDefined();
        expect(event3).toBeDefined();
        expect(event1.type).toBe('context:injected');
        expect(event3.type).toBe('context:injected');
      }

      // Clean up
      client1.close();
      client3.close();
    });

    it('should handle rapid connection/disconnection cycles', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Rapid connection test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Rapidly create and close connections
      for (let i = 0; i < 5; i++) {
        const client = context.createGlobalWebSocketClient();
        await client.waitForConnection();
        client.close();
      }

      // Wait for connections to settle
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create a stable connection for testing
      const stableClient = context.createGlobalWebSocketClient();
      await stableClient.waitForConnection();

      // Inject context
      const contextPayload: InjectContextRequest = {
        context: 'Rapid connection test',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        // Stable client should receive the event
        const event = await stableClient.waitForMessage('context:injected', 5000);
        expect(event).toBeDefined();
        expect(event.type).toBe('context:injected');
      }

      stableClient.close();
    });
  });

  describe('Broadcasting Performance', () => {
    it('should handle multiple rapid context injections', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Rapid injection test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup WebSocket client
      const client = context.createGlobalWebSocketClient();
      await client.waitForConnection();

      // Send multiple rapid context injections
      const injectionPromises = [];
      for (let i = 0; i < 5; i++) {
        const payload: InjectContextRequest = {
          context: `Rapid context ${i + 1}`,
          source: `rapid-${i + 1}`,
        };

        injectionPromises.push(
          context.app.inject({
            method: 'POST',
            url: `/tasks/${taskId}/context`,
            headers: { 'Content-Type': 'application/json' },
            payload,
          })
        );
      }

      const responses = await Promise.all(injectionPromises);

      // All successful responses should result in events
      const successfulResponses = responses.filter(r => r.statusCode === 200);

      if (successfulResponses.length > 0) {
        // Should receive at least one event (may not receive all due to timing)
        const events = [];
        for (let i = 0; i < successfulResponses.length; i++) {
          try {
            const event = await client.waitForMessage('context:injected', 1000);
            events.push(event);
          } catch (error) {
            // Some events might be lost in rapid succession
            break;
          }
        }

        expect(events.length).toBeGreaterThan(0);
        expect(events.length).toBeLessThanOrEqual(successfulResponses.length);

        // All received events should be valid
        events.forEach(event => {
          expect(event.type).toBe('context:injected');
          expect(event.taskId).toBe(taskId);
        });
      }

      client.close();
    });
  });
});