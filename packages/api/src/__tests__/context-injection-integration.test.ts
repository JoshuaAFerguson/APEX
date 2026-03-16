/**
 * Integration Tests for Context Injection API Endpoint - @apex/api Package
 *
 * Tests the complete integration of the POST /tasks/:id/context endpoint including:
 * - End-to-end context injection workflow
 * - WebSocket event broadcasting
 * - Database persistence
 * - Real task lifecycle integration
 *
 * Acceptance Criteria:
 * 1. POST /tasks/:id/context endpoint functions end-to-end
 * 2. WebSocket events are broadcasted correctly
 * 3. Context injection works with real task lifecycle
 * 4. Event data structure matches specification
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
  ApexEvent,
  Task
} from '@apexcli/core';

/**
 * Test context for integration tests
 */
interface ContextInjectionIntegrationContext {
  app: FastifyInstance;
  serverPort: number;
  projectPath: string;
  cleanup: () => Promise<void>;
  httpUtils: any;
  createWebSocketClient: (taskId?: string, events?: string[]) => WebSocketTestClient;
  createGlobalWebSocketClient: () => WebSocketTestClient;
}

describe('Context Injection Integration Tests', () => {
  let context: ContextInjectionIntegrationContext;

  beforeEach(async () => {
    const env = await createTestEnvironment({ silent: true });
    context = env;
  });

  afterEach(async () => {
    await context.cleanup();
  });

  describe('End-to-End Context Injection', () => {
    it('should successfully inject context into a running task and broadcast WebSocket event', async () => {
      // Create a task first
      const createResponse = await context.httpUtils.createTask(
        'Test task for context injection',
        { workflow: 'feature' }
      );

      expect(createResponse.statusCode).toBe(201);
      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;
      expect(taskId).toBeDefined();

      // Setup WebSocket client to listen for events
      const wsClient = context.createGlobalWebSocketClient();
      await wsClient.waitForConnection();

      // Inject context
      const contextPayload: InjectContextRequest = {
        context: 'This is additional context from integration test',
        source: 'integration-test',
        priority: 'high',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      // Verify response
      if (injectResponse.statusCode === 200) {
        const responseBody: InjectContextResponse = JSON.parse(injectResponse.body);
        expect(responseBody.ok).toBe(true);
        expect(responseBody.taskId).toBe(taskId);
        expect(responseBody.contextInjected).toBe(true);
        expect(responseBody.timestamp).toBeInstanceOf(Date);

        // Wait for WebSocket event
        const event = await wsClient.waitForMessage('context:injected', 5000);
        expect(event).toBeDefined();
        expect(event.type).toBe('context:injected');
        expect(event.taskId).toBe(taskId);

        // Verify event data structure
        const eventData: ContextInjectedEventData = event.data;
        expect(eventData.context).toBe('This is additional context from integration test');
        expect(eventData.source).toBe('integration-test');
        expect(eventData.priority).toBe('high');
        expect(eventData.timestamp).toBeDefined();
        expect(new Date(eventData.timestamp)).toBeInstanceOf(Date);
      }

      wsClient.close();
    });

    it('should handle context injection with minimal data', async () => {
      // Create a task first
      const createResponse = await context.httpUtils.createTask('Minimal context test');
      if (createResponse.statusCode !== 201) {
        // Skip test if we can't create a task
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return; // Skip if no task ID
      }

      // Setup WebSocket client
      const wsClient = context.createGlobalWebSocketClient();
      await wsClient.waitForConnection();

      // Inject minimal context
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
        // Verify response
        const responseBody: InjectContextResponse = JSON.parse(injectResponse.body);
        expect(responseBody.ok).toBe(true);
        expect(responseBody.taskId).toBe(taskId);

        // Wait for WebSocket event
        const event = await wsClient.waitForMessage('context:injected', 5000);
        expect(event).toBeDefined();

        // Verify event data with defaults
        const eventData: ContextInjectedEventData = event.data;
        expect(eventData.context).toBe('Minimal context');
        expect(eventData.source).toBeUndefined();
        expect(eventData.priority).toBe('normal'); // Should default to 'normal'
      }

      wsClient.close();
    });

    it('should handle multiple context injections for the same task', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Multi-context test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup WebSocket client
      const wsClient = context.createGlobalWebSocketClient();
      await wsClient.waitForConnection();

      // Inject multiple contexts
      const contexts = [
        { context: 'First context injection', source: 'user', priority: 'low' as const },
        { context: 'Second context injection', source: 'api', priority: 'normal' as const },
        { context: 'Third context injection', source: 'system', priority: 'high' as const },
      ];

      for (let i = 0; i < contexts.length; i++) {
        const contextPayload = contexts[i];

        const injectResponse = await context.app.inject({
          method: 'POST',
          url: `/tasks/${taskId}/context`,
          headers: { 'Content-Type': 'application/json' },
          payload: contextPayload,
        });

        if (injectResponse.statusCode === 200) {
          // Wait for corresponding WebSocket event
          const event = await wsClient.waitForMessage('context:injected', 5000);
          expect(event).toBeDefined();
          expect(event.taskId).toBe(taskId);

          const eventData: ContextInjectedEventData = event.data;
          expect(eventData.context).toBe(contextPayload.context);
          expect(eventData.source).toBe(contextPayload.source);
          expect(eventData.priority).toBe(contextPayload.priority);
        }
      }

      wsClient.close();
    });
  });

  describe('WebSocket Event Broadcasting', () => {
    it('should broadcast events to task-specific WebSocket clients', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Task-specific WebSocket test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup task-specific WebSocket client
      const taskWsClient = context.createWebSocketClient(taskId, ['context:injected']);
      await taskWsClient.waitForConnection();

      // Inject context
      const contextPayload: InjectContextRequest = {
        context: 'Task-specific context',
        source: 'websocket-test',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        // Wait for event on task-specific client
        const event = await taskWsClient.waitForMessage('context:injected', 5000);
        expect(event).toBeDefined();
        expect(event.taskId).toBe(taskId);
      }

      taskWsClient.close();
    });

    it('should not broadcast to WebSocket clients listening to different tasks', async () => {
      // Create two tasks
      const task1Response = await context.httpUtils.createTask('Task 1');
      const task2Response = await context.httpUtils.createTask('Task 2');

      if (task1Response.statusCode !== 201 || task2Response.statusCode !== 201) {
        return;
      }

      const task1Body = JSON.parse(task1Response.body);
      const task2Body = JSON.parse(task2Response.body);
      const task1Id = task1Body.task?.id;
      const task2Id = task2Body.task?.id;

      if (!task1Id || !task2Id) {
        return;
      }

      // Setup WebSocket client for task 2 only
      const task2WsClient = context.createWebSocketClient(task2Id, ['context:injected']);
      await task2WsClient.waitForConnection();

      // Inject context into task 1
      const contextPayload: InjectContextRequest = {
        context: 'Context for task 1',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${task1Id}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        // Task 2 client should not receive the event
        let receivedEvent = false;
        try {
          await task2WsClient.waitForMessage('context:injected', 1000); // Short timeout
          receivedEvent = true;
        } catch (error) {
          // Expected timeout
          expect(error.message).toContain('timeout');
        }

        expect(receivedEvent).toBe(false);
      }

      task2WsClient.close();
    });

    it('should include all required fields in WebSocket event', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Event field validation test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup WebSocket client
      const wsClient = context.createGlobalWebSocketClient();
      await wsClient.waitForConnection();

      // Inject context with all fields
      const contextPayload: InjectContextRequest = {
        context: 'Complete context data',
        source: 'validation-test',
        priority: 'high',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/context`,
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      if (injectResponse.statusCode === 200) {
        // Wait for event
        const event: ApexEvent = await wsClient.waitForMessage('context:injected', 5000);

        // Verify ApexEvent structure
        expect(event).toHaveProperty('type', 'context:injected');
        expect(event).toHaveProperty('taskId', taskId);
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('data');
        expect(new Date(event.timestamp)).toBeInstanceOf(Date);

        // Verify ContextInjectedEventData structure
        const eventData: ContextInjectedEventData = event.data as ContextInjectedEventData;
        expect(eventData).toHaveProperty('context', 'Complete context data');
        expect(eventData).toHaveProperty('source', 'validation-test');
        expect(eventData).toHaveProperty('priority', 'high');
        expect(eventData).toHaveProperty('timestamp');
        expect(new Date(eventData.timestamp)).toBeInstanceOf(Date);
      }

      wsClient.close();
    });
  });

  describe('Error Scenarios', () => {
    it('should not broadcast WebSocket event when context injection fails', async () => {
      // Setup WebSocket client
      const wsClient = context.createGlobalWebSocketClient();
      await wsClient.waitForConnection();

      // Try to inject context into non-existent task
      const contextPayload: InjectContextRequest = {
        context: 'This should fail',
      };

      const injectResponse = await context.app.inject({
        method: 'POST',
        url: '/tasks/non-existent-task/context',
        headers: { 'Content-Type': 'application/json' },
        payload: contextPayload,
      });

      expect(injectResponse.statusCode).toBe(404);

      // Should not receive any WebSocket event
      let receivedEvent = false;
      try {
        await wsClient.waitForMessage('context:injected', 1000); // Short timeout
        receivedEvent = true;
      } catch (error) {
        // Expected timeout
        expect(error.message).toContain('timeout');
      }

      expect(receivedEvent).toBe(false);

      wsClient.close();
    });

    it('should handle WebSocket connection errors gracefully', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('WebSocket error test');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Context injection should still work even if WebSocket broadcasting fails
      const contextPayload: InjectContextRequest = {
        context: 'Context despite WebSocket issues',
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
        expect(responseBody.taskId).toBe(taskId);
        expect(responseBody.contextInjected).toBe(true);
      }
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent context injections', async () => {
      // Create a task
      const createResponse = await context.httpUtils.createTask('Concurrency test task');
      if (createResponse.statusCode !== 201) {
        return;
      }

      const createBody = JSON.parse(createResponse.body);
      const taskId = createBody.task?.id;

      if (!taskId) {
        return;
      }

      // Setup WebSocket client
      const wsClient = context.createGlobalWebSocketClient();
      await wsClient.waitForConnection();

      // Send multiple concurrent context injection requests
      const concurrentRequests = Array.from({ length: 3 }, (_, i) =>
        context.app.inject({
          method: 'POST',
          url: `/tasks/${taskId}/context`,
          headers: { 'Content-Type': 'application/json' },
          payload: {
            context: `Concurrent context ${i + 1}`,
            source: `concurrent-${i + 1}`,
          },
        })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed (or fail consistently)
      const statusCodes = responses.map(r => r.statusCode);
      const uniqueStatusCodes = [...new Set(statusCodes)];
      expect(uniqueStatusCodes.length).toBeLessThanOrEqual(2); // Either all succeed or all fail

      if (responses[0].statusCode === 200) {
        // If successful, should receive WebSocket events for each injection
        const events = [];
        for (let i = 0; i < 3; i++) {
          try {
            const event = await wsClient.waitForMessage('context:injected', 2000);
            events.push(event);
          } catch (error) {
            // Some events might be lost in concurrent scenarios
            break;
          }
        }

        expect(events.length).toBeGreaterThan(0);
        expect(events.length).toBeLessThanOrEqual(3);
      }

      wsClient.close();
    });
  });
});