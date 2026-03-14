/**
 * Basic infrastructure test for tool visualization E2E testing
 * Verifies that our mock WebSocket server and orchestrator work correctly
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  MockWebSocketServer,
  createMockWebSocketServer,
  waitForConnection,
  type WebSocketMessage
} from './utils/mock-websocket-server.js';
import {
  ToolVisualizationMockOrchestrator,
  createToolVisualizationMockOrchestrator,
} from './utils/orchestrator-event-emitter.js';
import { circularReferenceFixtures } from './fixtures/circular-reference-fixtures.js';
import { largePayloadFixtures } from './fixtures/large-payload-fixtures.js';
import { timingEventFixtures } from './fixtures/timing-event-fixtures.js';
import { mcpErrorFixtures } from './fixtures/mcp-error-fixtures.js';

describe('Tool Visualization Infrastructure Tests', () => {
  let mockOrchestrator: ToolVisualizationMockOrchestrator;
  let wsServer: MockWebSocketServer;
  let wsClient: WebSocket;
  let messageHistory: WebSocketMessage[];

  beforeAll(async () => {
    // Setup mock infrastructure
    wsServer = createMockWebSocketServer({ port: 0 });
    mockOrchestrator = createToolVisualizationMockOrchestrator();

    // Start server and attach orchestrator
    await wsServer.start();
    wsServer.attachOrchestrator(mockOrchestrator);

    console.log(`Mock WebSocket server started on ${wsServer.url}`);
  });

  afterAll(async () => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    await wsServer.close();
    mockOrchestrator.cleanup();
  });

  beforeEach(async () => {
    // Create fresh client connection for each test
    messageHistory = [];

    wsClient = new WebSocket(wsServer.url);
    await waitForConnection(wsClient);

    // Collect messages for verification
    wsClient.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        messageHistory.push(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    // Clear orchestrator state
    mockOrchestrator.clearActiveToolCalls();
    wsServer.clearHistory();
  });

  afterEach(() => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
  });

  describe('Basic Infrastructure', () => {
    it('should create mock WebSocket server successfully', () => {
      expect(wsServer).toBeDefined();
      expect(wsServer.getClientCount()).toBeGreaterThan(0);
      expect(wsServer.port).toBeGreaterThan(0);
    });

    it('should create mock orchestrator successfully', () => {
      expect(mockOrchestrator).toBeDefined();
      expect(mockOrchestrator.getToolCallStats).toBeDefined();
      const stats = mockOrchestrator.getToolCallStats();
      expect(stats.activeCount).toBe(0);
    });

    it('should establish WebSocket connection', () => {
      expect(wsClient.readyState).toBe(WebSocket.OPEN);
    });

    it('should stream basic tool events', async () => {
      // Emit a simple tool event
      const toolCallId = mockOrchestrator.simulateCircularReferenceToolEvent('test-task', 'self-reference');

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify we received messages
      expect(messageHistory.length).toBeGreaterThan(0);

      // Check for start event
      const startEvent = messageHistory.find(m => m.type === 'tool:start');
      expect(startEvent).toBeDefined();
      expect(startEvent!.data.toolName).toBe('Read');
    });
  });

  describe('Test Fixtures', () => {
    it('should load circular reference fixtures', () => {
      const fixtures = circularReferenceFixtures.getAllFixtures();
      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);

      const selfRef = circularReferenceFixtures.selfReference();
      expect(selfRef.data).toBeDefined();
      expect(selfRef.name).toBe('Self Reference');
    });

    it('should load large payload fixtures', () => {
      const fixtures = largePayloadFixtures.getAllFixtures();
      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);

      const largeArray = largePayloadFixtures.largeArray(100);
      expect(largeArray.data).toBeDefined();
      expect(Array.isArray(largeArray.data)).toBe(true);
      expect(largeArray.data.length).toBe(100);
    });

    it('should load timing event fixtures', () => {
      const fixtures = timingEventFixtures.getAllFixtures();
      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);

      const fastTool = timingEventFixtures.fastTool();
      expect(fastTool.scenario).toBeDefined();
      expect(fastTool.scenario.duration).toBe(50);
    });

    it('should load MCP error fixtures', () => {
      const fixtures = mcpErrorFixtures.getAllFixtures();
      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);

      const permissionError = mcpErrorFixtures.permissionDenied();
      expect(permissionError.error).toBeDefined();
      expect(permissionError.error.message).toContain('permission denied');
    });
  });

  describe('Feature 1: Circular Reference Handling (Basic)', () => {
    it('should handle self-referential objects in WebSocket transmission', async () => {
      const toolCallId = mockOrchestrator.simulateCircularReferenceToolEvent('test-task', 'self-reference');

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify no JSON.stringify failures
      expect(messageHistory.length).toBeGreaterThanOrEqual(2); // start + complete

      const startEvent = messageHistory.find(m => m.type === 'tool:start');
      expect(startEvent).toBeDefined();
      expect(startEvent!.data.input).toBeDefined();
    });

    it('should handle nested circular references', async () => {
      const toolCallId = mockOrchestrator.simulateCircularReferenceToolEvent('test-task', 'nested-circular');

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(messageHistory.length).toBeGreaterThanOrEqual(2);

      const completeEvent = messageHistory.find(m => m.type === 'tool:complete');
      expect(completeEvent).toBeDefined();
    });
  });

  describe('Feature 2: Large Payload Truncation (Basic)', () => {
    it('should handle large arrays without crashing', async () => {
      const toolCallId = mockOrchestrator.simulateLargePayloadToolEvent('test-task', {
        arraySize: 1000,
        mixed: false
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(messageHistory.length).toBeGreaterThanOrEqual(2);

      const startEvent = messageHistory.find(m => m.type === 'tool:start');
      expect(startEvent).toBeDefined();
    });
  });

  describe('Feature 3: Timing Events (Basic)', () => {
    it('should stream timing events for tool execution', async () => {
      const toolCallId = mockOrchestrator.simulateTimingEvents('test-task', {
        toolName: 'TestTool',
        duration: 500,
        emitProgress: true,
        progressInterval: 100,
      });

      await new Promise(resolve => setTimeout(resolve, 800));

      // Should have start, timing, progress, and complete events
      expect(messageHistory.length).toBeGreaterThan(2);

      const timingEvents = messageHistory.filter(m => m.type === 'tool:timing');
      expect(timingEvents.length).toBeGreaterThan(0);

      const progressEvents = messageHistory.filter(m => m.type === 'tool:progress');
      expect(progressEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Feature 4: MCP Error Display (Basic)', () => {
    it('should handle MCP errors in WebSocket transmission', async () => {
      const toolCallId = mockOrchestrator.simulateMCPError('test-task', 'permission-denied');

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(messageHistory.length).toBeGreaterThanOrEqual(2); // start + error

      const errorEvent = messageHistory.find(m => m.type === 'tool:error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.data.error).toBeDefined();
    });

    it('should handle different MCP error types', async () => {
      const errorTypes: Array<'connection-timeout' | 'tool-not-found' | 'protocol-error'> = [
        'connection-timeout',
        'tool-not-found',
        'protocol-error'
      ];

      for (const errorType of errorTypes) {
        // Clear history for each error type
        messageHistory = [];
        wsServer.clearHistory();

        const toolCallId = mockOrchestrator.simulateMCPError('test-task', errorType);
        await new Promise(resolve => setTimeout(resolve, 100));

        const errorEvent = messageHistory.find(m => m.type === 'tool:error');
        expect(errorEvent).toBeDefined();
        expect(errorEvent!.data.error.message).toBeDefined();
      }
    });
  });

  describe('Integration Tests (Basic)', () => {
    it('should handle multiple tool types concurrently', async () => {
      const toolCallIds = mockOrchestrator.simulateConcurrentTools('test-task', 3);

      expect(toolCallIds.length).toBe(3);

      // Wait for all tools to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have events for all tools
      expect(messageHistory.length).toBeGreaterThan(6); // At least 3 start + 3 complete/error

      const startEvents = messageHistory.filter(m => m.type === 'tool:start');
      const completeEvents = messageHistory.filter(m => m.type === 'tool:complete' || m.type === 'tool:error');

      expect(startEvents.length).toBe(3);
      expect(completeEvents.length).toBe(3);
    });

    it('should maintain performance with rapid tool execution', async () => {
      const startTime = Date.now();

      // Execute many fast tools
      for (let i = 0; i < 10; i++) {
        mockOrchestrator.simulateTimingEvents('test-task', {
          toolName: `FastTool${i}`,
          duration: 50,
          emitProgress: false,
        });
      }

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 500));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(1000);

      // Should have events for all tools
      expect(messageHistory.length).toBeGreaterThanOrEqual(20); // 10 start + 10 complete
    });
  });

  describe('Edge Cases', () => {
    it('should handle WebSocket disconnection gracefully', async () => {
      // Close client
      wsClient.close();

      // Try to emit events (should not crash)
      const toolCallId = mockOrchestrator.simulateTimingEvents('test-task', {
        toolName: 'TestAfterDisconnect',
        duration: 100,
      });

      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should not throw errors
      expect(toolCallId).toBeDefined();
    });

    it('should handle malformed tool events gracefully', async () => {
      // Emit event with null data
      mockOrchestrator.emit('tool:start', null);

      // Emit event with undefined data
      mockOrchestrator.emit('tool:complete', undefined);

      // Should not crash
      await new Promise(resolve => setTimeout(resolve, 100));

      // Server should still be responsive
      expect(wsServer.getClientCount()).toBeGreaterThan(0);
    });
  });
});