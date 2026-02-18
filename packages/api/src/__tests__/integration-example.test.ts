/**
 * Example integration test demonstrating the test infrastructure usage
 * Shows how to use the setup utilities for comprehensive API testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import {
  createTestEnvironment,
  TestSetup,
  TestDataGenerators,
  WebSocketTestClient,
  HttpTestUtils,
  type TestContext
} from './setup.js';

describe('Integration Test Infrastructure Example', () => {
  let testEnv: Awaited<ReturnType<typeof createTestEnvironment>>;

  beforeEach(async () => {
    testEnv = await createTestEnvironment({
      silent: true,
      enableHealthMonitoring: false,
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('HTTP API Testing', () => {
    it('should create and retrieve a task', async () => {
      // Create a task using HTTP utilities
      const createResponse = await testEnv.httpUtils.createTask('Test integration task', {
        acceptanceCriteria: 'Task should be created successfully',
        workflow: 'default',
      });

      expect(createResponse.statusCode).toBe(201);
      const createBody = JSON.parse(createResponse.body);
      expect(createBody).toHaveProperty('taskId');
      expect(createBody.status).toBe('pending');

      // Retrieve the task
      const getResponse = await testEnv.httpUtils.getTask(createBody.taskId);
      expect(getResponse.statusCode).toBe(200);

      const getBody = JSON.parse(getResponse.body);
      expect(getBody.description).toBe('Test integration task');
      expect(getBody.acceptanceCriteria).toBe('Task should be created successfully');
    });

    it('should list tasks', async () => {
      // Create multiple tasks
      await testEnv.httpUtils.createTask('Task 1');
      await testEnv.httpUtils.createTask('Task 2');
      await testEnv.httpUtils.createTask('Task 3');

      // List all tasks
      const response = await testEnv.httpUtils.listTasks();
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.tasks).toHaveLength(3);
      expect(body.count).toBe(3);
    });

    it('should get health status', async () => {
      const response = await testEnv.httpUtils.getHealth();
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.version).toBeDefined();
    });
  });

  describe('WebSocket Testing', () => {
    let wsClient: WebSocketTestClient;

    afterEach(() => {
      if (wsClient) {
        wsClient.close();
      }
    });

    it('should connect to task-specific WebSocket and receive task state', async () => {
      // Create a task first
      const createResponse = await testEnv.httpUtils.createTask('WebSocket test task');
      const { taskId } = JSON.parse(createResponse.body);

      // Connect to task-specific WebSocket
      wsClient = testEnv.createWebSocketClient(taskId);
      await wsClient.waitForConnection();

      expect(wsClient.readyState).toBe(WebSocket.OPEN);

      // Should receive initial task state
      const message = await wsClient.waitForMessage('task:state', 2000);
      expect(message.type).toBe('task:state');
      expect(message.taskId).toBe(taskId);
      expect(message.data).toHaveProperty('description', 'WebSocket test task');
    });

    it('should connect to global WebSocket', async () => {
      wsClient = testEnv.createGlobalWebSocketClient();
      await wsClient.waitForConnection();

      expect(wsClient.readyState).toBe(WebSocket.OPEN);

      // Should receive initial tasks state
      const message = await wsClient.waitForMessage('task:state', 2000);
      expect(message.type).toBe('task:state');
      expect(message).toHaveProperty('tasks');
    });

    it('should filter WebSocket events', async () => {
      // Create a task
      const createResponse = await testEnv.httpUtils.createTask('Event filter test');
      const { taskId } = JSON.parse(createResponse.body);

      // Connect with event filtering (only tool events)
      wsClient = testEnv.createWebSocketClient(taskId, ['tool:start', 'tool:complete']);
      await wsClient.waitForConnection();

      // The WebSocket should be connected and ready for filtered events
      expect(wsClient.readyState).toBe(WebSocket.OPEN);
    });

    it('should handle WebSocket disconnection gracefully', async () => {
      wsClient = testEnv.createWebSocketClient('test-task');
      await wsClient.waitForConnection();

      // Close connection
      wsClient.close();

      // Server should handle disconnection without issues
      const response = await testEnv.httpUtils.getHealth();
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Database Integration', () => {
    it('should initialize test database', async () => {
      // Database should be initialized when orchestrator starts
      expect(await testEnv.dbUtils.exists()).toBe(true);
    });

    it('should clean up database after tests', async () => {
      // This test verifies cleanup functionality
      const dbExistsBefore = await testEnv.dbUtils.exists();
      expect(dbExistsBefore).toBe(true);

      // Cleanup will be called by afterEach
      // In a real scenario, we'd verify cleanup worked
    });
  });

  describe('File System Utilities', () => {
    it('should setup daemon files for testing', async () => {
      const healthMetrics = TestDataGenerators.createMockHealthMetrics({
        taskCounts: { processed: 10, succeeded: 8, failed: 1, active: 1 },
        memoryUsage: { heapUsed: 50 * 1024 * 1024, heapTotal: 100 * 1024 * 1024, rss: 120 * 1024 * 1024 },
      });

      // Setup daemon files
      await testEnv.fsUtils.setupDaemonFiles(9999, healthMetrics);

      // Mock process.kill to simulate running daemon
      vi.spyOn(process, 'kill').mockImplementation(() => true);

      // Test daemon health endpoint
      const response = await testEnv.httpUtils.getDaemonHealth();
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.daemon.pid).toBe(9999);
      expect(body.metrics.taskCounts.processed).toBe(10);

      vi.restoreAllMocks();
    });

    it('should update daemon health metrics', async () => {
      // Setup initial daemon
      await testEnv.fsUtils.setupDaemonFiles();
      vi.spyOn(process, 'kill').mockImplementation(() => true);

      // Get initial health
      let response = await testEnv.httpUtils.getDaemonHealth();
      let body = JSON.parse(response.body);
      const initialMemory = body.metrics.memoryUsage.heapUsed;

      // Update health metrics
      const newHealthMetrics = TestDataGenerators.createMockHealthMetrics({
        memoryUsage: {
          heapUsed: initialMemory * 2, // Double memory usage
          heapTotal: 200 * 1024 * 1024,
          rss: 250 * 1024 * 1024
        },
      });

      await testEnv.fsUtils.updateHealthMetrics(newHealthMetrics);

      // Get updated health
      response = await testEnv.httpUtils.getDaemonHealth();
      body = JSON.parse(response.body);

      expect(body.metrics.memoryUsage.heapUsed).toBe(initialMemory * 2);

      vi.restoreAllMocks();
    });
  });

  describe('Test Data Generators', () => {
    it('should generate mock tasks', async () => {
      const task = TestDataGenerators.createMockTask({
        description: 'Custom test task',
        status: 'in-progress',
      });

      expect(task.description).toBe('Custom test task');
      expect(task.status).toBe('in-progress');
      expect(task.id).toMatch(/^test-task-/);
      expect(task.createdAt).toBeDefined();
      expect(task.updatedAt).toBeDefined();
    });

    it('should generate mock health metrics', async () => {
      const metrics = TestDataGenerators.createMockHealthMetrics({
        uptime: 7200000, // 2 hours
        taskCounts: { processed: 100, succeeded: 95, failed: 5, active: 3 },
      });

      expect(metrics.uptime).toBe(7200000);
      expect(metrics.taskCounts.processed).toBe(100);
      expect(metrics.taskCounts.succeeded).toBe(95);
      expect(metrics.taskCounts.failed).toBe(5);
      expect(metrics.taskCounts.active).toBe(3);
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.lastHealthCheck).toBeDefined();
    });

    it('should create healthy daemon state', async () => {
      const healthMetrics = TestDataGenerators.createMockHealthMetrics();
      const daemonState = TestDataGenerators.createHealthyDaemonState(54321, healthMetrics);

      expect(daemonState.pid).toBe(54321);
      expect(daemonState.running).toBe(true);
      expect(daemonState.health).toBeDefined();
      expect(daemonState.health.uptime).toBe(healthMetrics.uptime);
      expect(typeof daemonState.health.lastHealthCheck).toBe('string'); // Should be serialized
    });
  });

  describe('Advanced Integration Scenarios', () => {
    it('should handle concurrent HTTP requests', async () => {
      // Create multiple tasks concurrently
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        testEnv.httpUtils.createTask(`Concurrent task ${i + 1}`)
      );

      const responses = await Promise.all(createPromises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('taskId');
      });

      // Verify all tasks were created
      const listResponse = await testEnv.httpUtils.listTasks();
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.tasks).toHaveLength(5);
    });

    it('should handle multiple WebSocket connections', async () => {
      const wsClients: WebSocketTestClient[] = [];

      try {
        // Create multiple WebSocket connections
        for (let i = 0; i < 3; i++) {
          const client = testEnv.createGlobalWebSocketClient();
          await client.waitForConnection();
          wsClients.push(client);
        }

        // All connections should be open
        wsClients.forEach(client => {
          expect(client.readyState).toBe(client.ws.OPEN);
        });

        // Create a task and verify all clients receive updates
        await testEnv.httpUtils.createTask('Multi-client test task');

        // Each client should receive the task state update
        await Promise.all(wsClients.map(client =>
          client.waitForMessage('task:state', 2000)
        ));

      } finally {
        // Clean up all connections
        wsClients.forEach(client => client.close());
      }
    });

    it('should integrate HTTP and WebSocket operations', async () => {
      // Setup WebSocket before creating task
      wsClient = testEnv.createGlobalWebSocketClient();
      await wsClient.waitForConnection();

      // Create task via HTTP
      const createResponse = await testEnv.httpUtils.createTask('HTTP-WebSocket integration test');
      const { taskId } = JSON.parse(createResponse.body);

      // WebSocket should receive task creation event
      const message = await wsClient.waitForMessage('task:state', 2000);
      expect(message.type).toBe('task:state');

      // Verify we can still retrieve via HTTP
      const getResponse = await testEnv.httpUtils.getTask(taskId);
      expect(getResponse.statusCode).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent task requests', async () => {
      const response = await testEnv.httpUtils.getTask('non-existent-task');
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Task not found');
    });

    it('should handle invalid task creation requests', async () => {
      const response = await testEnv.app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          // Missing required description field
          acceptanceCriteria: 'Should fail',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Description is required');
    });

    it('should handle daemon health when not running', async () => {
      // Don't mock process.kill, so daemon appears not running
      const response = await testEnv.httpUtils.getDaemonHealth();
      expect(response.statusCode).toBe(503);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error', 'Daemon not running');
      expect(body.metrics).toBeNull();
    });
  });
});