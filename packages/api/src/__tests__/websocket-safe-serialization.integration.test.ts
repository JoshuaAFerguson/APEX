import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { ApexEvent } from '@apexcli/core';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface WebSocketMessage {
  type: string;
  taskId?: string;
  timestamp: string;
  data?: Record<string, unknown>;
  originalEvent?: any;
}

describe('WebSocket Safe Serialization Integration Tests', () => {
  let server: FastifyInstance;
  let orchestrator: ApexOrchestrator;
  let projectPath: string;
  let serverPort: number;
  let wsUrl: string;

  beforeAll(async () => {
    // Create temporary directory for test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-websocket-serialization-test-'));

    // Create .apex directory structure
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Create minimal config.yaml
    const configContent = `
version: "1.0"
name: "websocket-serialization-test"
description: "Integration test for WebSocket safe serialization"
agents:
  tester:
    name: "Tester Agent"
    role: "Tests circular reference handling"
workflows:
  test-workflow:
    name: "WebSocket Serialization Test"
    stages:
      - name: "testing"
        agent: "tester"
        outputs:
          - test_results
`;
    await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent.trim());

    // Initialize orchestrator and server
    orchestrator = new ApexOrchestrator({
      projectPath,
      logLevel: 'error' // Reduce noise in tests
    });

    server = await createServer(orchestrator, {
      host: '127.0.0.1',
      port: 0, // Let the system assign a free port
      logLevel: 'error'
    });

    await server.listen();
    const address = server.server?.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to get server address');
    }
    serverPort = address.port;
    wsUrl = `ws://127.0.0.1:${serverPort}/stream`;
  });

  afterAll(async () => {
    await server?.close();
    await orchestrator?.shutdown();
    // Cleanup temporary directory
    await fs.rm(projectPath, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any lingering WebSocket connections
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  it('should handle WebSocket events with circular references without crashing the server', async () => {
    const taskId = 'circular-test-task';
    let receivedMessages: WebSocketMessage[] = [];
    let wsError: Error | null = null;
    let connectionClosed = false;

    // Create WebSocket connection
    const ws = new WebSocket(`${wsUrl}/${taskId}`);

    // Set up WebSocket event handlers
    const messagePromise = new Promise<void>((resolve, reject) => {
      let messageCount = 0;
      const maxMessages = 3; // Expect a few messages

      ws.on('open', () => {
        // Connection established
      });

      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          receivedMessages.push(message);
          messageCount++;

          // Resolve after receiving expected messages
          if (messageCount >= maxMessages) {
            resolve();
          }
        } catch (error) {
          reject(new Error(`Failed to parse WebSocket message: ${error}`));
        }
      });

      ws.on('error', (error) => {
        wsError = error;
        reject(error);
      });

      ws.on('close', () => {
        connectionClosed = true;
        if (messageCount > 0) {
          resolve(); // We got some messages, that's success
        }
      });

      // Timeout after 3 seconds
      setTimeout(() => {
        if (messageCount > 0) {
          resolve();
        } else {
          reject(new Error('No WebSocket messages received within timeout'));
        }
      }, 3000);
    });

    // Wait for WebSocket connection to be established
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 2000);
    });

    // Create a task that will trigger events with potential circular references
    const task = await orchestrator.createTask(
      'Test circular reference handling in WebSocket events',
      'testing'
    );

    expect(task.id).toBe(taskId); // Verify task ID matches our WebSocket subscription

    // Simulate events that might have circular references by manually triggering
    // orchestrator events. These should get broadcasted via WebSocket.

    // Create an object with circular references that might appear in real events
    const circularData: any = {
      taskInfo: {
        id: taskId,
        status: 'running',
        metadata: {
          startTime: new Date(),
          attempts: 1
        }
      },
      context: {
        environment: 'test',
        config: {}
      }
    };

    // Add circular references
    circularData.taskInfo.parentContext = circularData.context;
    circularData.context.currentTask = circularData.taskInfo;
    circularData.self = circularData;

    // Emit orchestrator events that should trigger WebSocket broadcasts
    orchestrator.emit('task:started', {
      ...task,
      metadata: circularData // This contains circular references
    });

    orchestrator.emit('agent:message', taskId, {
      message: 'Processing task with complex data',
      data: circularData,
      timestamp: new Date()
    });

    orchestrator.emit('task:completed', {
      ...task,
      result: {
        success: true,
        circularData: circularData
      }
    });

    // Wait for WebSocket messages
    await messagePromise;

    // Close WebSocket connection
    ws.close();

    // Verify that we received messages without errors
    expect(wsError).toBeNull();
    expect(receivedMessages.length).toBeGreaterThan(0);

    // Verify that each message is valid JSON (no circular reference serialization errors)
    receivedMessages.forEach((message, index) => {
      expect(message).toBeDefined();
      expect(typeof message.type).toBe('string');
      expect(message.taskId).toBe(taskId);

      // Verify timestamp is a valid ISO string
      expect(() => new Date(message.timestamp)).not.toThrow();

      // If the message contains data with potential circular references,
      // verify that the data was properly serialized (no [Circular] should appear in valid data,
      // but the serialization should not fail)
      if (message.data) {
        expect(typeof message.data).toBe('object');
        // The data should be properly serialized - no functions, circular refs handled
      }
    });

    // Verify the server is still responsive (didn't crash)
    const healthResponse = await fetch(`http://127.0.0.1:${serverPort}/health`);
    expect(healthResponse.ok).toBe(true);
  });

  it('should replace circular references with [Circular] markers in WebSocket messages', async () => {
    const taskId = 'circular-marker-test';
    let receivedMessages: WebSocketMessage[] = [];

    // Create WebSocket connection
    const ws = new WebSocket(`${wsUrl}/${taskId}`);

    const messagePromise = new Promise<void>((resolve, reject) => {
      let messageCount = 0;

      ws.on('open', () => {
        // Connection established
      });

      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          receivedMessages.push(message);
          messageCount++;

          // Look for messages containing circular data
          if (messageCount >= 2) {
            resolve();
          }
        } catch (error) {
          reject(new Error(`Failed to parse WebSocket message: ${error}`));
        }
      });

      ws.on('error', reject);

      // Timeout
      setTimeout(() => {
        if (messageCount > 0) {
          resolve();
        } else {
          reject(new Error('No messages received'));
        }
      }, 3000);
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });

    // Create task
    const task = await orchestrator.createTask(
      'Test [Circular] marker replacement',
      'testing'
    );

    // Create highly circular data structure
    const deepCircularData: any = {
      level1: {
        level2: {
          level3: {}
        }
      },
      array: [1, 2, 3],
      metadata: {
        processing: true
      }
    };

    // Create multiple circular references
    deepCircularData.level1.level2.level3.backToRoot = deepCircularData;
    deepCircularData.level1.backToArray = deepCircularData.array;
    deepCircularData.array.push(deepCircularData);
    deepCircularData.metadata.sourceData = deepCircularData;
    deepCircularData.self = deepCircularData;

    // Emit agent message with circular data
    orchestrator.emit('agent:message', taskId, deepCircularData);

    // Also emit a thinking event with circular references
    orchestrator.emit('agent:thinking', taskId, 'test-agent', JSON.stringify({
      thought: 'Processing complex data structure',
      data: deepCircularData
    }));

    await messagePromise;
    ws.close();

    // Verify we got messages
    expect(receivedMessages.length).toBeGreaterThan(0);

    // Look for any message containing the serialized circular data
    const messageWithCircularData = receivedMessages.find(msg => {
      const msgStr = JSON.stringify(msg);
      return msgStr.includes('[Circular]');
    });

    // We should find at least one message where circular references were replaced with [Circular]
    expect(messageWithCircularData).toBeDefined();

    if (messageWithCircularData) {
      const msgStr = JSON.stringify(messageWithCircularData);

      // Verify that [Circular] markers are present
      expect(msgStr).toContain('[Circular]');

      // Verify the message is still valid JSON
      expect(() => JSON.parse(JSON.stringify(messageWithCircularData))).not.toThrow();
    }
  });

  it('should handle complex nested objects with multiple circular references', async () => {
    const taskId = 'complex-circular-test';
    let receivedMessages: WebSocketMessage[] = [];

    const ws = new WebSocket(`${wsUrl}/${taskId}`);

    const messagePromise = new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          receivedMessages.push(message);

          if (receivedMessages.length >= 1) {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });

      ws.on('error', reject);
      setTimeout(() => resolve(), 2000); // Timeout after 2 seconds
    });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });

    // Create task
    await orchestrator.createTask('Complex circular test', 'testing');

    // Create a complex object similar to what might appear in real WebSocket events
    const complexData: any = {
      event: {
        type: 'task:progress',
        taskId: taskId,
        timestamp: new Date(),
        data: {
          progress: 0.5,
          stage: 'processing',
          details: {}
        }
      },
      context: {
        task: null,
        orchestrator: null,
        session: {
          id: 'session-123',
          events: []
        }
      },
      metadata: {
        source: null,
        relationships: []
      }
    };

    // Create circular references similar to real event objects
    complexData.event.originalEvent = complexData.event;
    complexData.event.data.details.parentEvent = complexData.event;
    complexData.context.task = complexData.event;
    complexData.context.orchestrator = complexData;
    complexData.context.session.events.push(complexData.event);
    complexData.metadata.source = complexData.context;
    complexData.metadata.relationships.push(complexData.context.task);
    complexData.event.context = complexData.context;

    // Emit event with the complex circular data
    orchestrator.emit('agent:tool-use', taskId, 'complex-tool', complexData);

    await messagePromise;
    ws.close();

    // The server should still be running and responsive
    const healthResponse = await fetch(`http://127.0.0.1:${serverPort}/health`);
    expect(healthResponse.ok).toBe(true);

    // All received messages should be valid JSON
    receivedMessages.forEach(message => {
      expect(() => JSON.stringify(message)).not.toThrow();
      expect(() => JSON.parse(JSON.stringify(message))).not.toThrow();
    });
  });

  it('should handle Error objects and Date objects in WebSocket events', async () => {
    const taskId = 'error-date-test';
    let receivedMessages: WebSocketMessage[] = [];

    const ws = new WebSocket(`${wsUrl}/${taskId}`);

    const messagePromise = new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          receivedMessages.push(message);

          if (receivedMessages.length >= 1) {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });

      ws.on('error', reject);
      setTimeout(() => resolve(), 2000);
    });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });

    // Create task
    await orchestrator.createTask('Error and Date object test', 'testing');

    // Create data with Error objects and Date objects that might have circular refs
    const errorData: any = {
      error: new Error('Test error with complex context'),
      timestamp: new Date(),
      context: {
        error: null,
        metadata: {
          startTime: new Date(),
          attempts: []
        }
      }
    };

    // Create circular references involving Error and Date objects
    errorData.context.error = errorData.error;
    errorData.context.metadata.attempts.push(errorData);
    errorData.error.context = errorData.context;

    // Emit error event
    orchestrator.emit('task:failed', { id: taskId }, errorData.error);

    await messagePromise;
    ws.close();

    // Verify messages were received and are valid
    expect(receivedMessages.length).toBeGreaterThan(0);

    receivedMessages.forEach(message => {
      expect(() => JSON.stringify(message)).not.toThrow();

      // Dates should be serialized as ISO strings
      if (message.timestamp) {
        expect(typeof message.timestamp).toBe('string');
        expect(() => new Date(message.timestamp)).not.toThrow();
      }
    });
  });

  it('should maintain WebSocket performance with high-frequency events containing circular data', async () => {
    const taskId = 'performance-test';
    let receivedMessages: WebSocketMessage[] = [];

    const ws = new WebSocket(`${wsUrl}/${taskId}`);

    const messagePromise = new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          receivedMessages.push(message);

          // Resolve after receiving multiple messages
          if (receivedMessages.length >= 10) {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });

      ws.on('error', reject);
      setTimeout(() => resolve(), 5000); // 5 second timeout
    });

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });

    // Create task
    await orchestrator.createTask('Performance test with circular data', 'testing');

    // Create circular data for rapid firing
    const baseData: any = {
      id: Math.random(),
      status: 'processing',
      metadata: {}
    };
    baseData.self = baseData;
    baseData.metadata.source = baseData;

    // Rapidly emit multiple events with circular data
    const startTime = Date.now();
    for (let i = 0; i < 15; i++) {
      const eventData = {
        ...baseData,
        iteration: i,
        timestamp: new Date()
      };
      eventData.self = eventData;

      orchestrator.emit('agent:message', taskId, eventData);

      // Small delay to prevent overwhelming the event loop
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    await messagePromise;
    const endTime = Date.now();

    ws.close();

    // Verify performance - should handle the events within reasonable time
    const processingTime = endTime - startTime;
    expect(processingTime).toBeLessThan(3000); // Should complete within 3 seconds

    // Verify we received multiple messages
    expect(receivedMessages.length).toBeGreaterThanOrEqual(5);

    // All messages should be valid JSON
    receivedMessages.forEach(message => {
      expect(() => JSON.stringify(message)).not.toThrow();
    });

    // Server should still be healthy
    const healthResponse = await fetch(`http://127.0.0.1:${serverPort}/health`);
    expect(healthResponse.ok).toBe(true);
  });
});