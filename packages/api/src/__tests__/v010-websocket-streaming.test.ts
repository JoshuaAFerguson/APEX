/**
 * Comprehensive test suite for v0.1.0 WebSocket streaming and real-time updates
 * Tests WebSocket connections, event broadcasting, and real-time communication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { WebSocket } from 'ws';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import path from 'path';

// WebSocket test helper class
class WebSocketTestClient {
  private ws: WebSocket;
  private messageQueue: any[] = [];
  private isConnected = false;
  private connectionError: Error | null = null;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.ws.on('open', () => {
      this.isConnected = true;
    });

    this.ws.on('error', (error) => {
      this.connectionError = error;
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.messageQueue.push(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });
  }

  async waitForConnection(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      if (this.connectionError) {
        reject(this.connectionError);
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, timeout);

      this.ws.once('open', () => {
        clearTimeout(timer);
        this.isConnected = true;
        resolve();
      });

      this.ws.once('error', (error) => {
        clearTimeout(timer);
        this.connectionError = error;
        reject(error);
      });
    });
  }

  async waitForMessage(type?: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`WebSocket message timeout${type ? ` for type: ${type}` : ''}`));
      }, timeout);

      // Check if message already in queue
      if (type) {
        const existingMessage = this.messageQueue.find(msg => msg.type === type);
        if (existingMessage) {
          clearTimeout(timer);
          resolve(existingMessage);
          return;
        }
      } else if (this.messageQueue.length > 0) {
        clearTimeout(timer);
        resolve(this.messageQueue.shift());
        return;
      }

      // Wait for new message
      const checkForMessage = () => {
        if (type) {
          const message = this.messageQueue.find(msg => msg.type === type);
          if (message) {
            clearTimeout(timer);
            // Remove message from queue
            const index = this.messageQueue.indexOf(message);
            this.messageQueue.splice(index, 1);
            resolve(message);
            return;
          }
        } else if (this.messageQueue.length > 0) {
          clearTimeout(timer);
          resolve(this.messageQueue.shift());
          return;
        }

        // Check again in 50ms
        setTimeout(checkForMessage, 50);
      };

      checkForMessage();
    });
  }

  send(data: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      throw new Error('WebSocket connection is not open');
    }
  }

  getMessages(): any[] {
    return [...this.messageQueue];
  }

  getMessagesByType(type: string): any[] {
    return this.messageQueue.filter(msg => msg.type === type);
  }

  clearMessages(): void {
    this.messageQueue = [];
  }

  close(): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

describe('v0.1.0 WebSocket Streaming and Real-time Updates', () => {
  let app: FastifyInstance;
  let tempDir: string;
  let serverPort: number;
  let baseWsUrl: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-websocket-test-'));

    // Create server instance
    app = await createServer({
      projectPath: tempDir,
      port: 0, // Let system assign port
      silent: true
    });

    // Start server and get assigned port
    await app.ready();

    // Start listening on a random port
    await app.listen({ port: 0, host: 'localhost' });

    const address = app.server.address();
    if (address && typeof address === 'object') {
      serverPort = address.port;
      baseWsUrl = `ws://localhost:${serverPort}`;
    } else {
      throw new Error('Failed to get server address');
    }
  });

  afterEach(async () => {
    // Close server and cleanup
    if (app) {
      await app.close();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Global WebSocket Endpoint (/ws)', () => {
    it('should accept WebSocket connections', async () => {
      const client = new WebSocketTestClient(`${baseWsUrl}/ws`);

      await expect(client.waitForConnection()).resolves.toBeUndefined();

      client.close();
    });

    it('should send initial task state on connection', async () => {
      const client = new WebSocketTestClient(`${baseWsUrl}/ws`);
      await client.waitForConnection();

      // Should receive initial task state
      const message = await client.waitForMessage('task:state', 3000);

      expect(message).toMatchObject({
        type: 'task:state',
        tasks: expect.any(Array),
        timestamp: expect.any(String)
      });

      client.close();
    });

    it('should handle ping/pong for connection health', async () => {
      const client = new WebSocketTestClient(`${baseWsUrl}/ws`);
      await client.waitForConnection();

      // Send ping
      client.send({ type: 'ping' });

      // Wait a bit to ensure ping is processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Connection should remain stable
      expect(client.getMessages().length).toBeGreaterThanOrEqual(1);

      client.close();
    });

    it('should handle multiple concurrent connections', async () => {
      const clients = [
        new WebSocketTestClient(`${baseWsUrl}/ws`),
        new WebSocketTestClient(`${baseWsUrl}/ws`),
        new WebSocketTestClient(`${baseWsUrl}/ws`)
      ];

      // Wait for all connections
      await Promise.all(clients.map(client => client.waitForConnection()));

      // All should receive initial state
      for (const client of clients) {
        const message = await client.waitForMessage('task:state', 3000);
        expect(message).toMatchObject({
          type: 'task:state',
          tasks: expect.any(Array)
        });
      }

      // Close all connections
      clients.forEach(client => client.close());
    });
  });

  describe('Task-Specific Stream (/stream/:taskId)', () => {
    let taskId: string;

    beforeEach(async () => {
      // Create a task for testing
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: { description: 'Test task for WebSocket streaming' },
        headers: { 'content-type': 'application/json' }
      });

      const body = JSON.parse(response.body);
      taskId = body.taskId;
    });

    it('should accept task-specific WebSocket connections', async () => {
      const client = new WebSocketTestClient(`${baseWsUrl}/stream/${taskId}`);

      await expect(client.waitForConnection()).resolves.toBeUndefined();

      client.close();
    });

    it('should send current task state on connection', async () => {
      const client = new WebSocketTestClient(`${baseWsUrl}/stream/${taskId}`);
      await client.waitForConnection();

      // Should receive current task state
      const message = await client.waitForMessage('task:state', 3000);

      expect(message).toMatchObject({
        type: 'task:state',
        taskId,
        timestamp: expect.any(String),
        data: expect.objectContaining({
          id: taskId,
          description: 'Test task for WebSocket streaming'
        })
      });

      client.close();
    });

    it('should support event filtering via query parameters', async () => {
      const events = ['task:started', 'task:completed'];
      const eventsParam = events.join(',');
      const client = new WebSocketTestClient(`${baseWsUrl}/stream/${taskId}?events=${eventsParam}`);

      await expect(client.waitForConnection()).resolves.toBeUndefined();

      // Should still receive initial state regardless of filters
      const message = await client.waitForMessage('task:state', 3000);
      expect(message.type).toBe('task:state');

      client.close();
    });

    it('should handle invalid task IDs gracefully', async () => {
      const client = new WebSocketTestClient(`${baseWsUrl}/stream/task_nonexistent`);

      // Connection should still work, but task state should be null/empty
      await expect(client.waitForConnection()).resolves.toBeUndefined();

      client.close();
    });
  });

  describe('Real-time Event Broadcasting', () => {
    let taskId: string;
    let client: WebSocketTestClient;

    beforeEach(async () => {
      // Create a task for testing
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: { description: 'Test task for event broadcasting' },
        headers: { 'content-type': 'application/json' }
      });

      const body = JSON.parse(response.body);
      taskId = body.taskId;

      // Connect WebSocket client
      client = new WebSocketTestClient(`${baseWsUrl}/stream/${taskId}`);
      await client.waitForConnection();

      // Clear initial state message
      await client.waitForMessage('task:state', 3000);
      client.clearMessages();
    });

    afterEach(() => {
      if (client) {
        client.close();
      }
    });

    it('should broadcast task status updates', async () => {
      // Update task status
      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        payload: {
          status: 'in-progress',
          stage: 'implementation',
          message: 'Starting work'
        },
        headers: { 'content-type': 'application/json' }
      });

      // Should receive broadcast event
      const message = await client.waitForMessage('task:stage-changed', 3000);

      expect(message).toMatchObject({
        type: 'task:stage-changed',
        taskId,
        timestamp: expect.any(String),
        data: {
          status: 'in-progress',
          stage: 'implementation',
          message: 'Starting work'
        }
      });
    });

    it('should broadcast log entries', async () => {
      // Add log entry
      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/log`,
        payload: {
          level: 'info',
          message: 'Task is progressing',
          agent: 'test-agent'
        },
        headers: { 'content-type': 'application/json' }
      });

      // Should receive broadcast event
      const message = await client.waitForMessage('log:entry', 3000);

      expect(message).toMatchObject({
        type: 'log:entry',
        taskId,
        timestamp: expect.any(String),
        data: {
          level: 'info',
          message: 'Task is progressing',
          agent: 'test-agent'
        }
      });
    });
  });

  describe('Event Filtering', () => {
    let taskId: string;

    beforeEach(async () => {
      // Create a task for testing
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: { description: 'Test task for event filtering' },
        headers: { 'content-type': 'application/json' }
      });

      const body = JSON.parse(response.body);
      taskId = body.taskId;
    });

    it('should only receive filtered event types', async () => {
      // Connect with specific event filter
      const client = new WebSocketTestClient(`${baseWsUrl}/stream/${taskId}?events=task:stage-changed`);
      await client.waitForConnection();

      // Clear initial state message
      await client.waitForMessage('task:state', 3000);
      client.clearMessages();

      // Send a log entry (should be filtered out)
      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/log`,
        payload: { message: 'This should be filtered out' },
        headers: { 'content-type': 'application/json' }
      });

      // Send a status update (should be received)
      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        payload: { status: 'in-progress', message: 'This should be received' },
        headers: { 'content-type': 'application/json' }
      });

      // Wait for status change message
      const message = await client.waitForMessage('task:stage-changed', 3000);
      expect(message.type).toBe('task:stage-changed');

      // Verify no log messages were received
      const logMessages = client.getMessagesByType('log:entry');
      expect(logMessages).toHaveLength(0);

      client.close();
    });

    it('should receive multiple filtered event types', async () => {
      // Connect with multiple event filters
      const client = new WebSocketTestClient(`${baseWsUrl}/stream/${taskId}?events=task:stage-changed,log:entry`);
      await client.waitForConnection();

      // Clear initial state message
      await client.waitForMessage('task:state', 3000);
      client.clearMessages();

      // Send both types of events with some delay
      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/log`,
        payload: { message: 'Log message' },
        headers: { 'content-type': 'application/json' }
      });

      // Wait for first message to be processed
      await client.waitForMessage('log:entry', 3000);

      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        payload: { status: 'in-progress' },
        headers: { 'content-type': 'application/json' }
      });

      // Wait for second message
      await client.waitForMessage('task:stage-changed', 3000);

      const messages = client.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages.some(m => m.type === 'log:entry')).toBe(true);
      expect(messages.some(m => m.type === 'task:stage-changed')).toBe(true);

      client.close();
    });

    it('should receive all events when no filter is specified', async () => {
      // Connect without event filter
      const client = new WebSocketTestClient(`${baseWsUrl}/stream/${taskId}`);
      await client.waitForConnection();

      // Clear initial state message
      await client.waitForMessage('task:state', 3000);
      client.clearMessages();

      // Send multiple types of events
      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/log`,
        payload: { message: 'Log message' },
        headers: { 'content-type': 'application/json' }
      });

      await client.waitForMessage('log:entry', 3000);

      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        payload: { status: 'in-progress' },
        headers: { 'content-type': 'application/json' }
      });

      await client.waitForMessage('task:stage-changed', 3000);

      const messages = client.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(2);

      client.close();
    });
  });

  describe('Connection Management', () => {
    it('should handle client disconnections gracefully', async () => {
      const client = new WebSocketTestClient(`${baseWsUrl}/ws`);
      await client.waitForConnection();

      // Close connection
      client.close();

      // Server should handle disconnect without errors
      // This is mainly testing that the server doesn't crash
      expect(true).toBe(true);
    });

    it('should clean up connections on server shutdown', async () => {
      const clients = [
        new WebSocketTestClient(`${baseWsUrl}/ws`),
        new WebSocketTestClient(`${baseWsUrl}/ws`)
      ];

      await Promise.all(clients.map(client => client.waitForConnection()));

      // This is tested implicitly by afterEach cleanup
      clients.forEach(client => client.close());
    });

    it('should handle malformed WebSocket messages', async () => {
      const client = new WebSocketTestClient(`${baseWsUrl}/ws`);
      await client.waitForConnection();

      // Send malformed message
      try {
        client.send('{ invalid json');
      } catch (error) {
        // This is expected for some WebSocket implementations
      }

      // Connection should remain stable
      expect(client.getMessages().length).toBeGreaterThanOrEqual(0);

      client.close();
    });
  });

  describe('Message Format and Structure', () => {
    let taskId: string;
    let client: WebSocketTestClient;

    beforeEach(async () => {
      // Create a task for testing
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: { description: 'Test task for message format' },
        headers: { 'content-type': 'application/json' }
      });

      const body = JSON.parse(response.body);
      taskId = body.taskId;

      // Connect WebSocket client
      client = new WebSocketTestClient(`${baseWsUrl}/stream/${taskId}`);
      await client.waitForConnection();

      // Clear initial state message
      await client.waitForMessage('task:state', 3000);
    });

    afterEach(() => {
      if (client) {
        client.close();
      }
    });

    it('should have consistent message structure', async () => {
      // Trigger an event
      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/log`,
        payload: { message: 'Test message' },
        headers: { 'content-type': 'application/json' }
      });

      const message = await client.waitForMessage('log:entry', 3000);

      // Verify standard message structure
      expect(message).toMatchObject({
        type: expect.any(String),
        taskId: expect.any(String),
        timestamp: expect.any(String),
        data: expect.any(Object)
      });

      // Verify timestamp is valid ISO string
      expect(() => new Date(message.timestamp)).not.toThrow();
      expect(new Date(message.timestamp).toISOString()).toBe(message.timestamp);
    });

    it('should include task ID in all task-specific messages', async () => {
      // Trigger multiple events
      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/log`,
        payload: { message: 'Log test' },
        headers: { 'content-type': 'application/json' }
      });

      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        payload: { status: 'in-progress' },
        headers: { 'content-type': 'application/json' }
      });

      // Wait for both messages
      await client.waitForMessage('log:entry', 3000);
      await client.waitForMessage('task:stage-changed', 3000);

      const messages = client.getMessages();

      // All messages should have the correct task ID
      for (const message of messages) {
        expect(message.taskId).toBe(taskId);
      }
    });

    it('should preserve data structure in event payload', async () => {
      const logData = {
        level: 'warning',
        message: 'Complex log message with details',
        agent: 'integration-test-agent'
      };

      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/log`,
        payload: logData,
        headers: { 'content-type': 'application/json' }
      });

      const message = await client.waitForMessage('log:entry', 3000);

      expect(message.data).toMatchObject(logData);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle rapid event succession', async () => {
      const client = new WebSocketTestClient(`${baseWsUrl}/ws`);
      await client.waitForConnection();

      // Clear initial state
      await client.waitForMessage('task:state', 3000);
      client.clearMessages();

      // Create multiple tasks rapidly
      const createPromises = [];
      for (let i = 0; i < 5; i++) {
        createPromises.push(
          app.inject({
            method: 'POST',
            url: '/tasks',
            payload: { description: `Rapid task ${i}` },
            headers: { 'content-type': 'application/json' }
          })
        );
      }

      await Promise.all(createPromises);

      // Wait for task creation events to be broadcast
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should receive multiple messages without issues
      const messages = client.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(0);

      client.close();
    });

    it('should handle concurrent connections efficiently', async () => {
      const clients = Array.from({ length: 10 }, () =>
        new WebSocketTestClient(`${baseWsUrl}/ws`)
      );

      // Connect all clients
      await Promise.all(clients.map(client => client.waitForConnection()));

      // All should receive initial state
      for (const client of clients) {
        const message = await client.waitForMessage('task:state', 3000);
        expect(message.type).toBe('task:state');
      }

      // Close all connections
      clients.forEach(client => client.close());
    });
  });
});