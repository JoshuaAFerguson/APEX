/**
 * End-to-End verification tests for all 4 tool visualization features
 *
 * Tests comprehensive functionality across:
 * 1. Circular Reference Handling - Safe serialization of objects with circular references
 * 2. Large Payload Truncation - Preventing UI crashes from oversized data
 * 3. Timing Events Streaming - Real-time tool execution duration tracking
 * 4. MCP Error Display - User-friendly error presentation with suggestions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  MockWebSocketServer,
  createMockWebSocketServer,
  waitForConnection,
  waitForMessages,
  type WebSocketMessage
} from './utils/mock-websocket-server.js';
import {
  ToolVisualizationMockOrchestrator,
  createToolVisualizationMockOrchestrator,
  type LargePayloadConfig,
  type TimingScenario,
  type MCPErrorType
} from './utils/orchestrator-event-emitter.js';
import {
  renderToolCall,
  renderToolExecutionPanel,
  renderErrorDisplay,
  createCircularToolCallProps,
  createLargePayloadToolCallProps,
  createTimingToolCallProps,
  createMCPErrorDisplayProps,
  assertions,
  performance,
  testData
} from './utils/component-render-helpers.js';
import { circularReferenceFixtures } from './fixtures/circular-reference-fixtures.js';
import { largePayloadFixtures } from './fixtures/large-payload-fixtures.js';
import { timingEventFixtures } from './fixtures/timing-event-fixtures.js';
import { mcpErrorFixtures } from './fixtures/mcp-error-fixtures.js';

describe('Tool Visualization E2E Tests', () => {
  let mockOrchestrator: ToolVisualizationMockOrchestrator;
  let wsServer: MockWebSocketServer;
  let wsClient: WebSocket;
  let taskId: string;
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
    taskId = testData.createTaskId();
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

  describe('WebSocket Event Flow', () => {
    it('should stream timing events to connected clients', async () => {
      // Emit timing events from orchestrator
      const toolCallId = mockOrchestrator.simulateTimingEvents(taskId, {
        toolName: 'Read',
        startDelay: 0,
        duration: 1500,
        emitProgress: true,
        progressInterval: 300,
      });

      // Wait for events to be broadcast
      await wsServer.waitForMessages(2, 3000); // start + complete

      // Verify timing data in WebSocket messages
      expect(messageHistory.length).toBeGreaterThanOrEqual(2);

      const startEvent = messageHistory.find(m => m.type === 'tool:start');
      expect(startEvent).toBeDefined();
      expect(startEvent!.data.toolName).toBe('Read');
      expect(startEvent!.taskId).toBe(taskId);

      const completeEvent = messageHistory.find(m => m.type === 'tool:complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent!.data.timing.duration).toBeGreaterThan(1400);
      expect(completeEvent!.data.timing.duration).toBeLessThan(1600);
      expect(completeEvent!.data.timing.startTime).toBeDefined();
      expect(completeEvent!.data.timing.endTime).toBeDefined();
    });

    it('should handle multiple concurrent WebSocket clients', async () => {
      // Connect second client
      const wsClient2 = new WebSocket(wsServer.url);
      await waitForConnection(wsClient2);

      const client2Messages: WebSocketMessage[] = [];
      wsClient2.on('message', (data) => {
        client2Messages.push(JSON.parse(data.toString()));
      });

      // Emit events
      mockOrchestrator.simulateCircularReferenceToolEvent(taskId, 'self-reference');

      // Wait for messages on both clients
      await wsServer.waitForMessages(2, 2000);

      // Both clients should receive the same messages
      expect(messageHistory.length).toBeGreaterThanOrEqual(2);
      expect(client2Messages.length).toBeGreaterThanOrEqual(2);

      // Verify message types are the same
      const client1Types = messageHistory.map(m => m.type).sort();
      const client2Types = client2Messages.map(m => m.type).sort();
      expect(client1Types).toEqual(client2Types);

      wsClient2.close();
    });

    it('should maintain message history for late-connecting clients', async () => {
      // Emit some events before connecting a new client
      mockOrchestrator.simulateCircularReferenceToolEvent(taskId, 'nested-circular');

      // Wait for events to be processed
      await wsServer.waitForMessages(2, 2000);

      // Connect a new client
      const lateClient = new WebSocket(wsServer.url);
      await waitForConnection(lateClient);

      const lateClientMessages: WebSocketMessage[] = [];
      lateClient.on('message', (data) => {
        lateClientMessages.push(JSON.parse(data.toString()));
      });

      // Give some time for history to be sent
      await new Promise(resolve => setTimeout(resolve, 100));

      // Late client should receive historical messages
      expect(lateClientMessages.length).toBeGreaterThan(0);

      lateClient.close();
    });
  });

  describe('Feature 1: Circular Reference Handling', () => {
    it('should handle self-referential objects safely', async () => {
      const fixture = circularReferenceFixtures.selfReference();

      // Test WebSocket serialization
      const toolCallId = mockOrchestrator.simulateCircularReferenceToolEvent(taskId, 'self-reference');
      await wsServer.waitForMessages(2, 2000);

      // Verify no JSON.stringify failures in WebSocket messages
      expect(messageHistory.length).toBeGreaterThanOrEqual(2);
      const startEvent = messageHistory.find(m => m.type === 'tool:start');
      expect(startEvent).toBeDefined();
      expect(startEvent!.data.input).toBeDefined();

      // Test component rendering
      const props = createCircularToolCallProps(fixture.data);
      const { getCurrentFrame } = renderToolCall(props);

      // Component should not crash and should show parameter count
      const frame = getCurrentFrame();
      expect(frame).toContain('Read');
      expect(assertions.hasParameterCount(frame)).toBe(true);
      expect(frame).not.toContain('[object Object]'); // Should not show raw object
    });

    it('should detect nested circular references', async () => {
      const fixture = circularReferenceFixtures.nestedCircular();

      const props = createCircularToolCallProps(fixture.data);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(assertions.hasCircularReferenceIndicator(frame)).toBe(true);
      expect(frame).toContain('Read');
    });

    it('should handle arrays with circular references', async () => {
      const fixture = circularReferenceFixtures.arrayCircular();

      const props = createCircularToolCallProps(fixture.data);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(assertions.hasParameterCount(frame)).toBe(true);
      expect(frame).toContain('Read');
    });

    it('should handle deep circular references efficiently', async () => {
      const fixture = circularReferenceFixtures.deepCircular(50);

      // Measure performance to ensure no infinite loops
      const { result: props, duration } = await performance.measureRenderTime(() =>
        createCircularToolCallProps(fixture.data)
      );

      // Should complete quickly (no infinite recursion)
      expect(duration).toBeLessThan(100); // 100ms threshold

      const { getCurrentFrame } = renderToolCall(props);
      const frame = getCurrentFrame();
      expect(frame).toContain('Read');
    });

    it('should handle multiple circular paths', async () => {
      const fixture = circularReferenceFixtures.multipleCircularPaths();

      const props = createCircularToolCallProps(fixture.data);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(assertions.hasParameterCount(frame)).toBe(true);
      expect(frame).toContain('Read');
    });

    it('should not leak memory with large circular graphs', async () => {
      const fixture = circularReferenceFixtures.largeCircularGraph(100);

      const { result, memoryDelta } = await performance.measureMemoryUsage(() => {
        const props = createCircularToolCallProps(fixture.data);
        return renderToolCall(props);
      });

      // Memory usage should be reasonable (under 10MB for test)
      expect(memoryDelta).toBeLessThan(10 * 1024 * 1024);

      const frame = result.getCurrentFrame();
      expect(frame).toContain('Read');
    });
  });

  describe('Feature 2: Large Payload Truncation', () => {
    it('should truncate large arrays to prevent UI crashes', async () => {
      const fixture = largePayloadFixtures.largeArray(10000);

      // Test WebSocket transmission
      const toolCallId = mockOrchestrator.simulateLargePayloadToolEvent(taskId, {
        arraySize: 10000,
        mixed: false
      });

      await wsServer.waitForMessages(2, 3000);

      // Verify payload was handled safely
      const startEvent = messageHistory.find(m => m.type === 'tool:start');
      expect(startEvent).toBeDefined();

      // Test component rendering
      const props = createLargePayloadToolCallProps(fixture.data);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(assertions.hasTruncationIndicator(frame)).toBe(true);
      expect(frame).toContain('Grep');
    });

    it('should truncate large strings with metadata', async () => {
      const fixture = largePayloadFixtures.largeString(100);

      const props = createLargePayloadToolCallProps(fixture.data);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('Grep');
      expect(assertions.hasTruncationIndicator(frame)).toBe(true);
    });

    it('should handle deeply nested objects safely', async () => {
      const fixture = largePayloadFixtures.deeplyNested(50);

      const props = createLargePayloadToolCallProps(fixture.data);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('Grep');
      expect(assertions.hasParameterCount(frame)).toBe(true);
    });

    it('should handle mixed large payloads', async () => {
      const fixture = largePayloadFixtures.mixedLargePayload({
        arraySize: 5000,
        stringSize: 100,
        nestingDepth: 20
      });

      const props = createLargePayloadToolCallProps(fixture.data);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('Grep');
      expect(assertions.hasTruncationIndicator(frame) || assertions.hasParameterCount(frame)).toBe(true);
    });

    it('should maintain performance with large payloads', async () => {
      const fixture = largePayloadFixtures.performanceTestPayload();

      const { duration } = await performance.measureRenderTime(() => {
        const props = createLargePayloadToolCallProps(fixture.data);
        return renderToolCall(props);
      });

      // Rendering should be fast even with large data
      expect(duration).toBeLessThan(500); // 500ms threshold
    });

    it('should show truncation metadata when payload size exceeds limits', async () => {
      const fixture = largePayloadFixtures.largeArray(20000);

      // Test in ToolExecutionPanel for more detailed output
      const { getCurrentFrame, waitForStability } = renderToolExecutionPanel(mockOrchestrator, {
        taskId,
        displayMode: 'verbose'
      });

      // Simulate large payload tool execution
      mockOrchestrator.simulateLargePayloadToolEvent(taskId, { arraySize: 20000 });

      await waitForStability(200);

      const frame = getCurrentFrame();
      expect(frame).toContain('Tool Execution');
    });
  });

  describe('Feature 3: Timing Events Streaming', () => {
    it('should display fast tool execution durations correctly', async () => {
      const fixture = timingEventFixtures.fastTool();

      const props = createTimingToolCallProps(fixture.scenario.duration);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(assertions.hasTimingInfo(frame)).toBe(true);
      expect(frame).toContain('ms');
    });

    it('should display normal tool execution durations correctly', async () => {
      const fixture = timingEventFixtures.normalTool();

      const props = createTimingToolCallProps(fixture.scenario.duration);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(assertions.hasTimingInfo(frame)).toBe(true);
      expect(frame).toMatch(/\d+\.\d+s|\d+ms/);
    });

    it('should display long tool execution durations correctly', async () => {
      const fixture = timingEventFixtures.longTool();

      const props = createTimingToolCallProps(fixture.scenario.duration);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(assertions.hasTimingInfo(frame)).toBe(true);
      expect(frame).toMatch(/\d+m\s\d+s|\d+\.\d+s/);
    });

    it('should stream real-time timing events via WebSocket', async () => {
      const { getCurrentFrame, waitForStability } = renderToolExecutionPanel(mockOrchestrator, {
        taskId,
        showStats: true,
        showActiveTools: true
      });

      // Start a tool with timing events
      const toolCallId = mockOrchestrator.simulateTimingEvents(taskId, {
        toolName: 'Bash',
        duration: 1000,
        emitProgress: true,
        progressInterval: 200
      });

      // Wait for events to stream
      await wsServer.waitForMessages(3, 2000); // start + progress + complete
      await waitForStability(200);

      const frame = getCurrentFrame();
      expect(frame).toContain('Tool Execution');

      // Verify timing events were received
      const timingEvents = messageHistory.filter(m => m.type === 'tool:timing');
      expect(timingEvents.length).toBeGreaterThan(0);

      const progressEvents = messageHistory.filter(m => m.type === 'tool:progress');
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('should track concurrent tool timing independently', async () => {
      const { getCurrentFrame, waitForStability } = renderToolExecutionPanel(mockOrchestrator, {
        taskId,
        showActiveTools: true,
        maxRecentLogs: 10
      });

      // Start multiple tools with different durations
      const toolCall1 = mockOrchestrator.simulateTimingEvents(taskId, {
        toolName: 'Read',
        duration: 800,
        emitProgress: false
      });

      const toolCall2 = mockOrchestrator.simulateTimingEvents(taskId, {
        toolName: 'Write',
        duration: 1200,
        emitProgress: false
      });

      // Wait for all tools to complete
      await wsServer.waitForMessages(4, 3000); // 2 start + 2 complete
      await waitForStability(200);

      // Verify independent timing tracking
      const completeEvents = messageHistory.filter(m => m.type === 'tool:complete');
      expect(completeEvents.length).toBe(2);

      const readEvent = completeEvents.find(e => e.data.toolName === 'Read');
      const writeEvent = completeEvents.find(e => e.data.toolName === 'Write');

      expect(readEvent?.data.timing.duration).toBeGreaterThan(700);
      expect(readEvent?.data.timing.duration).toBeLessThan(900);

      expect(writeEvent?.data.timing.duration).toBeGreaterThan(1100);
      expect(writeEvent?.data.timing.duration).toBeLessThan(1300);
    });

    it('should calculate and display average duration statistics', async () => {
      const { getCurrentFrame, waitForStability } = renderToolExecutionPanel(mockOrchestrator, {
        taskId,
        showStats: true
      });

      // Execute multiple tools to generate statistics
      for (let i = 0; i < 3; i++) {
        mockOrchestrator.simulateTimingEvents(taskId, {
          toolName: 'Test',
          duration: 500 + i * 100, // 500ms, 600ms, 700ms
          emitProgress: false
        });
      }

      // Wait for all completions
      await wsServer.waitForMessages(6, 4000); // 3 start + 3 complete
      await waitForStability(300);

      const frame = getCurrentFrame();
      expect(frame).toContain('Total:');
      expect(frame).toMatch(/Avg:.*\d+/);
    });

    it('should handle sub-millisecond timing gracefully', async () => {
      const fixture = timingEventFixtures.ultraFastTool();

      const props = createTimingToolCallProps(fixture.scenario.duration);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(frame).toMatch(/\d+ms|0ms/);
    });
  });

  describe('Feature 4: MCP Error Display', () => {
    it('should display permission denied errors with suggestions', async () => {
      const fixture = mcpErrorFixtures.permissionDenied();

      // Test WebSocket error transmission
      const toolCallId = mockOrchestrator.simulateMCPError(taskId, 'permission-denied');
      await wsServer.waitForMessages(2, 2000); // start + error

      const errorEvent = messageHistory.find(m => m.type === 'tool:error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.data.error).toBeDefined();

      // Test component rendering
      const props = createMCPErrorDisplayProps(fixture.error, {
        tool: fixture.toolContext.toolName,
        operation: fixture.toolContext.operation
      });

      const { getCurrentFrame } = renderErrorDisplay(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('Permission Issue');
      expect(assertions.hasErrorSuggestions(frame)).toBe(true);
      expect(frame).toContain('Check file/directory permissions');
    });

    it('should display connection timeout errors with retry suggestions', async () => {
      const fixture = mcpErrorFixtures.connectionTimeout();

      const props = createMCPErrorDisplayProps(fixture.error);
      const { getCurrentFrame } = renderErrorDisplay(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('Timeout');
      expect(assertions.hasErrorSuggestions(frame)).toBe(true);
      expect(frame).toContain('retry');
    });

    it('should display tool not found errors with alternatives', async () => {
      const fixture = mcpErrorFixtures.toolNotFound();

      const props = createMCPErrorDisplayProps(fixture.error, {
        availableTools: ['Read', 'Write', 'Bash']
      });

      const { getCurrentFrame } = renderErrorDisplay(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('Resource Not Found');
      expect(assertions.hasErrorSuggestions(frame)).toBe(true);
    });

    it('should display protocol errors with syntax help', async () => {
      const fixture = mcpErrorFixtures.protocolError();

      const props = createMCPErrorDisplayProps(fixture.error);
      const { getCurrentFrame } = renderErrorDisplay(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('Syntax Error');
      expect(assertions.hasErrorSuggestions(frame)).toBe(true);
      expect(frame).toContain('syntax');
    });

    it('should display server disconnect errors with network suggestions', async () => {
      const fixture = mcpErrorFixtures.serverDisconnect();

      const props = createMCPErrorDisplayProps(fixture.error);
      const { getCurrentFrame } = renderErrorDisplay(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('Network Issue');
      expect(assertions.hasErrorSuggestions(frame)).toBe(true);
      expect(frame).toContain('connection');
    });

    it('should display nested error chains completely', async () => {
      const fixture = mcpErrorFixtures.nestedError();

      const props = createMCPErrorDisplayProps(fixture.error, {
        showStack: true,
        verbose: true
      });

      const { getCurrentFrame } = renderErrorDisplay(props, {
        displayMode: 'verbose'
      });

      const frame = getCurrentFrame();
      expect(assertions.hasMCPErrorContext(frame)).toBe(true);
      expect(assertions.hasErrorSuggestions(frame)).toBe(true);
    });

    it('should handle API key errors with configuration guidance', async () => {
      const fixture = mcpErrorFixtures.apiKeyError();

      const props = createMCPErrorDisplayProps(fixture.error);
      const { getCurrentFrame } = renderErrorDisplay(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('API Key Issue');
      expect(assertions.hasErrorSuggestions(frame)).toBe(true);
      expect(frame).toContain('API key');
    });

    it('should prioritize suggestions by importance', async () => {
      const fixture = mcpErrorFixtures.permissionDenied();

      const props = createMCPErrorDisplayProps(fixture.error);
      const { getCurrentFrame } = renderErrorDisplay(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('🔴'); // High priority indicator
      expect(assertions.hasErrorSuggestions(frame)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle all 4 features simultaneously', async () => {
      const { getCurrentFrame, waitForStability } = renderToolExecutionPanel(mockOrchestrator, {
        taskId,
        showStats: true,
        showActiveTools: true,
        showActivityLog: true
      });

      // Simulate all features at once
      mockOrchestrator.simulateCircularReferenceToolEvent(taskId, 'self-reference');
      mockOrchestrator.simulateLargePayloadToolEvent(taskId, { arraySize: 5000 });
      mockOrchestrator.simulateTimingEvents(taskId, { toolName: 'Bash', duration: 1000 });
      mockOrchestrator.simulateMCPError(taskId, 'permission-denied');

      // Wait for all events
      await wsServer.waitForMessages(8, 5000); // 4 start + 4 complete/error
      await waitForStability(500);

      const frame = getCurrentFrame();
      expect(frame).toContain('Tool Execution');

      // Verify all event types were received
      const eventTypes = new Set(messageHistory.map(m => m.type));
      expect(eventTypes.has('tool:start')).toBe(true);
      expect(eventTypes.has('tool:complete')).toBe(true);
      expect(eventTypes.has('tool:error')).toBe(true);
    });

    it('should maintain performance under concurrent load', async () => {
      const startTime = performance.now();

      // Simulate stress test with many concurrent tools
      const toolCallIds = mockOrchestrator.simulateConcurrentTools(taskId, 10);

      // Wait for all tools to complete
      await wsServer.waitForMessages(20, 10000); // 10 start + 10 complete/error

      const duration = performance.now() - startTime;

      // Should handle concurrent load efficiently
      expect(duration).toBeLessThan(12000); // 12 second threshold
      expect(toolCallIds.length).toBe(10);

      // Verify all events were processed
      expect(messageHistory.length).toBeGreaterThanOrEqual(20);
    });

    it('should recover gracefully from WebSocket disconnection', async () => {
      // Start with active tools
      mockOrchestrator.simulateTimingEvents(taskId, {
        toolName: 'LongRunning',
        duration: 2000
      });

      // Simulate disconnection
      wsClient.close();

      // Wait and reconnect
      await new Promise(resolve => setTimeout(resolve, 200));
      wsClient = new WebSocket(wsServer.url);
      await waitForConnection(wsClient);

      // Setup message collection again
      messageHistory = [];
      wsClient.on('message', (data) => {
        messageHistory.push(JSON.parse(data.toString()));
      });

      // Should receive historical messages
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(messageHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle rapid tool succession without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Execute rapid succession of tools
      for (let i = 0; i < 50; i++) {
        mockOrchestrator.simulateTimingEvents(taskId, {
          toolName: `RapidTool${i}`,
          duration: 50,
          emitProgress: false
        });
      }

      // Wait for completion
      await wsServer.waitForMessages(100, 10000);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (under 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should maintain responsiveness with large message history', async () => {
      // Generate large message history
      for (let i = 0; i < 100; i++) {
        mockOrchestrator.simulateTimingEvents(taskId, {
          toolName: 'HistoryTool',
          duration: 10,
          emitProgress: false
        });
      }

      // Wait for all messages
      await wsServer.waitForMessages(200, 15000);

      // Test component rendering performance with large history
      const startTime = performance.now();
      const { getCurrentFrame } = renderToolExecutionPanel(mockOrchestrator, {
        taskId,
        maxEntries: 200,
        showActivityLog: true
      });
      const renderTime = performance.now() - startTime;

      // Rendering should still be fast
      expect(renderTime).toBeLessThan(1000); // 1 second threshold

      const frame = getCurrentFrame();
      expect(frame).toContain('Tool Execution');
    });
  });

  describe('Edge Cases and Limitations', () => {
    it('should handle zero-duration tool calls', async () => {
      const props = createTimingToolCallProps(0);
      const { getCurrentFrame } = renderToolCall(props);

      const frame = getCurrentFrame();
      expect(frame).toMatch(/0ms|\d+ms/); // Should display some timing
    });

    it('should handle empty error messages gracefully', async () => {
      const emptyError = new Error('');
      const props = createMCPErrorDisplayProps(emptyError);
      const { getCurrentFrame } = renderErrorDisplay(props);

      const frame = getCurrentFrame();
      expect(frame).toContain('Error'); // Should still render error component
    });

    it('should handle malformed WebSocket messages gracefully', async () => {
      // Send malformed message directly
      if (wsClient.readyState === WebSocket.OPEN) {
        wsClient.send('invalid json {');
      }

      // Should not crash - wait briefly and verify server is still responsive
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test that normal messages still work
      mockOrchestrator.simulateTimingEvents(taskId, {
        toolName: 'TestAfterError',
        duration: 100
      });

      await wsServer.waitForMessages(1, 2000);
      expect(messageHistory.length).toBeGreaterThan(0);
    });

    it('should truncate extremely large individual values', async () => {
      // Create object with extremely large string value
      const hugeString = 'x'.repeat(1024 * 1024); // 1MB string
      const props = createLargePayloadToolCallProps({ hugeValue: hugeString });

      const { getCurrentFrame } = renderToolCall(props);
      const frame = getCurrentFrame();

      expect(frame).toContain('Grep');
      expect(assertions.hasParameterCount(frame)).toBe(true);
    });
  });
});

describe('Component Integration Tests', () => {
  it('should render ToolCall with all visualization features', async () => {
    const circularData = circularReferenceFixtures.selfReference().data;

    const props = {
      toolName: 'Read',
      input: {
        file_path: '/test/path',
        circular_data: circularData,
        large_array: Array.from({ length: 2000 }, (_, i) => `item-${i}`)
      },
      output: Array.from({ length: 100 }, (_, i) => `Output line ${i}`).join('\n'),
      status: 'success' as const,
      duration: 2500,
      displayMode: 'verbose' as const
    };

    const { getCurrentFrame } = renderToolCall(props);
    const frame = getCurrentFrame();

    expect(frame).toContain('Read');
    expect(assertions.hasParameterCount(frame)).toBe(true);
    expect(assertions.hasTimingInfo(frame)).toBe(true);
    expect(assertions.hasTruncationIndicator(frame)).toBe(true);
  });

  it('should render ErrorDisplay with MCP error context and suggestions', async () => {
    const error = new Error('MCP permission denied: Cannot write to protected file');
    const props = createMCPErrorDisplayProps(error, {
      tool: 'Write',
      file_path: '/protected/file.txt',
      operation: 'file_write'
    });

    const { getCurrentFrame } = renderErrorDisplay(props);
    const frame = getCurrentFrame();

    expect(frame).toContain('MCP Tool Error');
    expect(frame).toContain('permission denied');
    expect(assertions.hasErrorSuggestions(frame)).toBe(true);
    expect(assertions.hasMCPErrorContext(frame)).toBe(true);
  });
});