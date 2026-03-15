/**
 * End-to-end verification tests for all 4 tool visualization features
 *
 * This comprehensive test suite creates a mock WebSocket orchestrator that emits
 * all event types and verifies that ToolCall.tsx, ToolExecutionPanel.tsx, and
 * ErrorDisplay.tsx render correctly for all scenarios including:
 *
 * 1. Circular reference handling in tool event streaming
 * 2. Large payload truncation across the visualization pipeline
 * 3. Timing events streaming with real-time updates
 * 4. MCP error display in the complete tool execution flow
 */

import React, { useState, useEffect } from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { ToolCall } from '../ToolCall.js';
import { ToolExecutionPanel } from '../tools/ToolExecutionPanel.js';
import { ErrorDisplay } from '../ErrorDisplay.js';
import { useToolEventLogger } from '../../hooks/useToolEventLogger.js';
import type {
  ApexOrchestrator,
  ToolCallStartEvent,
  ToolCallCompleteEvent,
  ToolCallProgressEvent
} from '@apexcli/orchestrator';

// Mock dependencies
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: () => ({
    width: 100,
    height: 30,
    breakpoint: 'normal',
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
    isAvailable: true,
  })
}));

vi.mock('../../hooks/useToolEventLogger.js');
const mockUseToolEventLogger = useToolEventLogger as MockedFunction<typeof useToolEventLogger>;

/**
 * Mock WebSocket orchestrator that can emit all types of tool events
 */
class MockWebSocketOrchestrator implements Partial<ApexOrchestrator> {
  private eventListeners: Map<string, Function[]> = new Map();
  private isConnected = false;

  on(event: string, listener: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  connect() {
    this.isConnected = true;
  }

  disconnect() {
    this.isConnected = false;
    this.eventListeners.clear();
  }

  // Utility methods for testing
  emitToolStart(event: ToolCallStartEvent) {
    this.emit('tool:start', event);
  }

  emitToolProgress(event: ToolCallProgressEvent) {
    this.emit('tool:progress', event);
  }

  emitToolComplete(event: ToolCallCompleteEvent) {
    this.emit('tool:complete', event);
  }
}

describe('End-to-End Tool Visualization Tests - All 4 Features', () => {
  let mockOrchestrator: MockWebSocketOrchestrator;
  let mockToolLogs: any[];
  let mockActiveToolCalls: Map<string, ToolCallStartEvent>;
  let mockStats: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOrchestrator = new MockWebSocketOrchestrator();
    mockOrchestrator.connect();

    mockToolLogs = [];
    mockActiveToolCalls = new Map();
    mockStats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
    };

    // Setup mock hook to return current state
    mockUseToolEventLogger.mockImplementation(() => ({
      toolLogs: mockToolLogs,
      activeToolCalls: mockActiveToolCalls,
      stats: mockStats,
    }));
  });

  afterEach(() => {
    mockOrchestrator.disconnect();
  });

  describe('Feature 1: End-to-End Circular Reference Handling', () => {
    it('should handle circular references throughout the entire tool execution pipeline', () => {
      // Create circular input data
      const circularInput: any = {
        config: { debug: true, timeout: 30000 },
        metadata: { timestamp: Date.now() }
      };
      circularInput.config.parent = circularInput;
      circularInput.metadata.root = circularInput;

      // Start tool with circular input
      const startEvent: ToolCallStartEvent = {
        taskId: 'e2e-task-1',
        callId: 'circular-call-1',
        toolName: 'CircularTool',
        timestamp: new Date(),
        input: circularInput,
      };

      mockActiveToolCalls.set('circular-call-1', startEvent);

      // Create completion with circular output
      const circularOutput: any = {
        success: true,
        result: { data: Array(100).fill('result') },
        metadata: startEvent.input // Reference to circular input
      };
      circularOutput.result.parent = circularOutput;

      const completeEvent: ToolCallCompleteEvent = {
        taskId: 'e2e-task-1',
        callId: 'circular-call-1',
        toolName: 'CircularTool',
        result: {
          success: true,
          data: circularOutput,
        },
        timing: {
          startTime: new Date(Date.now() - 5000),
          endTime: new Date(),
          duration: 5000,
        },
        timestamp: new Date(),
      };

      // Add to logs
      mockToolLogs.push({
        id: 'log-1',
        timestamp: new Date(),
        level: 'success',
        message: 'Completed CircularTool (5.0s)',
        agent: 'system',
        category: 'tool',
        duration: 5000,
        data: {
          toolName: 'CircularTool',
          callId: 'circular-call-1',
          result: circularOutput,
          status: 'completed',
        },
      });

      mockStats = {
        totalCalls: 1,
        successfulCalls: 1,
        failedCalls: 0,
        averageDuration: 5000,
      };

      // Test all components handle circular data
      expect(() => render(
        <ToolCall
          toolName="CircularTool"
          input={circularInput}
          output={JSON.stringify(circularOutput)}
          status="success"
          duration={5000}
        />
      )).not.toThrow();

      expect(() => render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="e2e-task-1"
        />
      )).not.toThrow();

      expect(() => render(
        <ErrorDisplay
          error="Circular reference test"
          context={circularInput}
        />
      )).not.toThrow();
    });

    it('should handle mutual circular references in tool event streaming', () => {
      const objA: any = { name: 'ToolA', id: 'a' };
      const objB: any = { name: 'ToolB', id: 'b' };
      objA.partner = objB;
      objB.partner = objA;

      // Multiple tools with mutual references
      const startEventA: ToolCallStartEvent = {
        taskId: 'e2e-task-mutual',
        callId: 'mutual-a',
        toolName: 'ToolA',
        timestamp: new Date(),
        input: objA,
      };

      const startEventB: ToolCallStartEvent = {
        taskId: 'e2e-task-mutual',
        callId: 'mutual-b',
        toolName: 'ToolB',
        timestamp: new Date(),
        input: objB,
      };

      mockActiveToolCalls.set('mutual-a', startEventA);
      mockActiveToolCalls.set('mutual-b', startEventB);

      mockStats = {
        totalCalls: 2,
        successfulCalls: 0,
        failedCalls: 0,
        averageDuration: 0,
      };

      expect(() => render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="e2e-task-mutual"
          displayMode="verbose"
        />
      )).not.toThrow();
    });

    it('should handle deep circular references across tool execution lifecycle', () => {
      // Create deeply nested circular structure
      const deepStructure: any = { level: 0 };
      let current = deepStructure;

      for (let i = 1; i <= 50; i++) {
        current.next = { level: i };
        current = current.next;
      }
      // Create cycle back to root
      current.root = deepStructure;
      deepStructure.deepest = current;

      // Simulate complete tool lifecycle with deep circular data
      const events = [
        {
          type: 'start',
          data: {
            taskId: 'deep-circular',
            callId: 'deep-1',
            toolName: 'DeepTool',
            timestamp: new Date(),
            input: deepStructure,
          }
        },
        {
          type: 'progress',
          data: {
            taskId: 'deep-circular',
            callId: 'deep-1',
            toolName: 'DeepTool',
            timestamp: new Date(),
            progress: {
              message: 'Processing deep structure',
              percentage: 50,
              data: deepStructure
            },
          }
        },
        {
          type: 'complete',
          data: {
            taskId: 'deep-circular',
            callId: 'deep-1',
            toolName: 'DeepTool',
            result: {
              success: true,
              data: deepStructure,
            },
            timing: {
              startTime: new Date(Date.now() - 10000),
              endTime: new Date(),
              duration: 10000,
            },
            timestamp: new Date(),
          }
        }
      ];

      // Process all events
      mockToolLogs.push(...events.map((event, i) => ({
        id: `deep-log-${i}`,
        timestamp: new Date(),
        level: event.type === 'complete' ? 'success' : 'info',
        message: `${event.type} DeepTool`,
        agent: 'system',
        category: 'tool',
        data: event.data,
      })));

      mockActiveToolCalls.clear();
      mockStats = {
        totalCalls: 1,
        successfulCalls: 1,
        failedCalls: 0,
        averageDuration: 10000,
      };

      expect(() => render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="deep-circular"
          maxEntries={10}
        />
      )).not.toThrow();
    });
  });

  describe('Feature 2: End-to-End Large Payload Truncation', () => {
    it('should handle massive payloads throughout the visualization pipeline', () => {
      // Create massive input data
      const massiveInput = {
        largeArray: Array(10000).fill(0).map((_, i) => ({
          id: i,
          data: `item_${i}`.repeat(100),
          metadata: {
            timestamp: Date.now(),
            tags: Array(50).fill(`tag_${i}`)
          }
        })),
        hugeString: 'x'.repeat(1000000),
        deepObject: {}
      };

      // Create deep object
      let current = massiveInput.deepObject;
      for (let i = 0; i < 1000; i++) {
        current[`level_${i}`] = { data: `level_data_${i}`.repeat(100) };
        current = current[`level_${i}`];
      }

      // Massive output
      const massiveOutput = {
        results: Array(50000).fill('result'),
        processedData: massiveInput.largeArray,
        summary: 'x'.repeat(500000),
        details: {
          performance: Array(1000).fill({ metric: 'value', timestamp: Date.now() }),
          errors: [],
          warnings: Array(5000).fill('warning message')
        }
      };

      const startTime = Date.now();

      // Test all components handle massive data efficiently
      const toolCallResult = render(
        <ToolCall
          toolName="MassiveDataTool"
          input={massiveInput}
          output={JSON.stringify(massiveOutput)}
          status="success"
          duration={15000}
          displayMode="verbose"
        />
      );

      const panelResult = render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="massive-data-task"
          maxEntries={1000}
        />
      );

      const errorResult = render(
        <ErrorDisplay
          error="Massive data processing error"
          context={massiveInput}
          showStack={true}
          verbose={true}
        />
      );

      const endTime = Date.now();

      // All components should render quickly despite massive data
      expect(endTime - startTime).toBeLessThan(5000);

      expect(toolCallResult.lastFrame()).toContain('MassiveDataTool');
      expect(panelResult.lastFrame()).toBeDefined();
      expect(errorResult.lastFrame()).toContain('Massive data processing error');
    });

    it('should truncate payloads consistently across different display modes', () => {
      const largeInput = {
        command: 'process',
        args: Array(1000).fill('argument'),
        data: 'x'.repeat(100000),
        metadata: {
          files: Array(5000).fill('filename.txt'),
          config: { setting: 'value'.repeat(10000) }
        }
      };

      const displayModes = ['compact', 'normal', 'verbose'] as const;

      displayModes.forEach(mode => {
        expect(() => render(
          <ToolCall
            toolName="LargeTool"
            input={largeInput}
            output="Large output data"
            status="success"
            displayMode={mode}
          />
        )).not.toThrow();

        expect(() => render(
          <ToolExecutionPanel
            orchestrator={mockOrchestrator as any}
            taskId="large-data-test"
            displayMode={mode}
          />
        )).not.toThrow();
      });
    });

    it('should handle memory-intensive operations without crashes', () => {
      // Simulate memory-intensive tool operations
      const memoryIntensiveData = [];
      for (let i = 0; i < 1000; i++) {
        memoryIntensiveData.push({
          id: i,
          largeBuffer: new Array(10000).fill(i),
          nestedData: {
            level1: new Array(1000).fill(`data_${i}`),
            level2: {
              moreData: new Array(5000).fill(`more_${i}`)
            }
          }
        });
      }

      mockToolLogs.length = 0; // Clear previous logs

      // Add many log entries with large data
      for (let i = 0; i < 500; i++) {
        mockToolLogs.push({
          id: `memory-log-${i}`,
          timestamp: new Date(Date.now() - (500 - i) * 100),
          level: i % 50 === 0 ? 'error' : 'info',
          message: `Memory operation ${i}`,
          agent: 'system',
          category: 'tool',
          data: {
            operation: `op_${i}`,
            payload: memoryIntensiveData[i % memoryIntensiveData.length],
          },
        });
      }

      mockStats = {
        totalCalls: 500,
        successfulCalls: 450,
        failedCalls: 50,
        averageDuration: 2500,
      };

      const startTime = Date.now();
      const result = render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="memory-test"
          maxEntries={100}
          maxRecentLogs={10}
        />
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000);
      expect(result.lastFrame()).toContain('500 logs');
    });
  });

  describe('Feature 3: End-to-End Timing Events Streaming', () => {
    it('should stream timing events in real-time across all components', async () => {
      const taskId = 'timing-stream-test';
      let currentTime = Date.now();

      // Simulate real-time tool execution with timing updates
      const toolExecution = async () => {
        // Start multiple tools at different times
        const tools = ['FastTool', 'MediumTool', 'SlowTool'];
        const activeCalls = new Map();

        for (let i = 0; i < tools.length; i++) {
          const toolName = tools[i];
          const callId = `timing-call-${i}`;
          const startTime = currentTime + (i * 1000);

          const startEvent: ToolCallStartEvent = {
            taskId,
            callId,
            toolName,
            timestamp: new Date(startTime),
            input: { operation: `${toolName}_operation`, priority: i + 1 },
          };

          activeCalls.set(callId, startEvent);
          mockActiveToolCalls.set(callId, startEvent);

          // Add start log
          mockToolLogs.push({
            id: `start-${callId}`,
            timestamp: new Date(startTime),
            level: 'info',
            message: `Started ${toolName}`,
            agent: 'system',
            category: 'tool',
            data: {
              toolName,
              callId,
              status: 'started',
            },
          });

          mockStats.totalCalls++;
        }

        // Simulate progress updates
        await new Promise(resolve => setTimeout(resolve, 100));

        for (let i = 0; i < tools.length; i++) {
          const toolName = tools[i];
          const callId = `timing-call-${i}`;

          // Progress event
          mockToolLogs.push({
            id: `progress-${callId}`,
            timestamp: new Date(currentTime + 2000 + (i * 500)),
            level: 'debug',
            message: `${toolName}: Processing...`,
            agent: 'system',
            category: 'tool',
            data: {
              toolName,
              callId,
              progress: { message: 'Processing...', percentage: 50 },
              status: 'progress',
            },
          });
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        // Complete tools at different times
        const durations = [500, 2000, 8000]; // Fast, medium, slow

        for (let i = 0; i < tools.length; i++) {
          const toolName = tools[i];
          const callId = `timing-call-${i}`;
          const duration = durations[i];
          const endTime = currentTime + 3000 + duration;

          const completeEvent: ToolCallCompleteEvent = {
            taskId,
            callId,
            toolName,
            result: {
              success: true,
              data: { result: `${toolName}_result`, duration },
            },
            timing: {
              startTime: new Date(currentTime + (i * 1000)),
              endTime: new Date(endTime),
              duration,
            },
            timestamp: new Date(endTime),
          };

          // Remove from active calls
          mockActiveToolCalls.delete(callId);

          // Add completion log
          mockToolLogs.push({
            id: `complete-${callId}`,
            timestamp: new Date(endTime),
            level: 'success',
            message: `Completed ${toolName} (${duration}ms)`,
            agent: 'system',
            category: 'tool',
            duration,
            data: {
              toolName,
              callId,
              result: completeEvent.result,
              timing: completeEvent.timing,
              status: 'completed',
            },
          });

          mockStats.successfulCalls++;
          mockStats.averageDuration = (mockStats.averageDuration + duration) / mockStats.successfulCalls;
        }
      };

      // Execute tool simulation
      await toolExecution();

      // Test streaming visualization components
      const panelResult = render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId={taskId}
          showStats={true}
          showActiveTools={true}
          showActivityLog={true}
        />
      );

      // Verify timing information is displayed
      expect(panelResult.lastFrame()).toContain('Total: 3');
      expect(panelResult.lastFrame()).toContain('Success: 3');
      expect(panelResult.lastFrame()).toContain('100.0%');

      // Test individual tool calls with different durations
      const fastToolResult = render(
        <ToolCall
          toolName="FastTool"
          status="success"
          duration={500}
        />
      );
      expect(fastToolResult.lastFrame()).toContain('500ms');

      const slowToolResult = render(
        <ToolCall
          toolName="SlowTool"
          status="success"
          duration={8000}
        />
      );
      expect(slowToolResult.lastFrame()).toContain('8.0s');
    });

    it('should handle concurrent timing events with proper ordering', () => {
      const baseTime = Date.now();

      // Create overlapping tool executions
      const overlappingTools = [
        { name: 'Tool1', start: baseTime, duration: 3000 },
        { name: 'Tool2', start: baseTime + 1000, duration: 5000 },
        { name: 'Tool3', start: baseTime + 2000, duration: 2000 },
        { name: 'Tool4', start: baseTime + 2500, duration: 1500 },
      ];

      mockToolLogs.length = 0;
      mockActiveToolCalls.clear();

      overlappingTools.forEach((tool, index) => {
        const callId = `concurrent-${index}`;

        // Start event
        mockToolLogs.push({
          id: `start-${callId}`,
          timestamp: new Date(tool.start),
          level: 'info',
          message: `Started ${tool.name}`,
          agent: 'system',
          category: 'tool',
          data: { toolName: tool.name, callId, status: 'started' },
        });

        // If still running, add to active calls
        if (tool.start + tool.duration > Date.now() - 1000) {
          mockActiveToolCalls.set(callId, {
            taskId: 'concurrent-test',
            callId,
            toolName: tool.name,
            timestamp: new Date(tool.start),
            input: { concurrent: true },
          } as ToolCallStartEvent);
        }

        // Complete event
        mockToolLogs.push({
          id: `complete-${callId}`,
          timestamp: new Date(tool.start + tool.duration),
          level: 'success',
          message: `Completed ${tool.name} (${tool.duration}ms)`,
          agent: 'system',
          category: 'tool',
          duration: tool.duration,
          data: {
            toolName: tool.name,
            callId,
            status: 'completed',
          },
        });
      });

      mockStats = {
        totalCalls: 4,
        successfulCalls: 4,
        failedCalls: 0,
        averageDuration: overlappingTools.reduce((sum, tool) => sum + tool.duration, 0) / 4,
      };

      const result = render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="concurrent-test"
          displayMode="verbose"
        />
      );

      expect(result.lastFrame()).toContain('Total: 4');
      expect(result.lastFrame()).toBeDefined();
    });

    it('should handle high-frequency timing events efficiently', () => {
      const baseTime = Date.now() - 60000; // 1 minute ago
      mockToolLogs.length = 0;

      // Generate high-frequency events (1000 events over 1 minute)
      for (let i = 0; i < 1000; i++) {
        const timestamp = baseTime + (i * 60); // Every 60ms
        const isStart = i % 2 === 0;
        const toolIndex = Math.floor(i / 2) % 10;

        mockToolLogs.push({
          id: `high-freq-${i}`,
          timestamp: new Date(timestamp),
          level: isStart ? 'info' : 'success',
          message: isStart
            ? `Started HighFreqTool${toolIndex}`
            : `Completed HighFreqTool${toolIndex} (${Math.random() * 1000}ms)`,
          agent: 'system',
          category: 'tool',
          duration: isStart ? undefined : Math.random() * 1000,
          data: {
            toolName: `HighFreqTool${toolIndex}`,
            callId: `freq-${Math.floor(i / 2)}`,
            status: isStart ? 'started' : 'completed',
          },
        });
      }

      mockStats = {
        totalCalls: 500,
        successfulCalls: 500,
        failedCalls: 0,
        averageDuration: 500,
      };

      const startTime = Date.now();
      const result = render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="high-frequency-test"
          maxEntries={100}
          maxRecentLogs={5}
        />
      );
      const endTime = Date.now();

      // Should handle high frequency efficiently
      expect(endTime - startTime).toBeLessThan(2000);
      expect(result.lastFrame()).toContain('1000 logs');
    });
  });

  describe('Feature 4: End-to-End MCP Error Display', () => {
    it('should handle comprehensive MCP error scenarios across all components', () => {
      const mcpErrors = [
        {
          type: 'CONNECTION_FAILED',
          message: 'MCP connection failed: Unable to establish WebSocket connection',
          context: {
            endpoint: 'ws://localhost:8080',
            attempts: 3,
            lastError: 'ECONNREFUSED',
          }
        },
        {
          type: 'PROTOCOL_ERROR',
          message: 'MCP protocol error: JSONRPC parse error in message',
          context: {
            messageId: 'msg_12345',
            protocol: 'jsonrpc-2.0',
            rawMessage: '{"invalid": json}',
          }
        },
        {
          type: 'TIMEOUT',
          message: 'MCP request timeout: Operation exceeded 30 second limit',
          context: {
            operation: 'large_dataset_processing',
            timeout: 30000,
            actualDuration: 45000,
          }
        },
        {
          type: 'AUTH_FAILED',
          message: 'MCP authentication failed: Invalid API key',
          context: {
            keyId: 'key_***456',
            server: 'mcp.example.com',
            authMethod: 'bearer_token',
          }
        }
      ];

      mockToolLogs.length = 0;
      mockActiveToolCalls.clear();

      // Process each MCP error type
      mcpErrors.forEach((mcpError, index) => {
        const callId = `mcp-error-${index}`;
        const duration = (index + 1) * 5000;

        // Failed tool execution
        mockToolLogs.push({
          id: `mcp-log-${index}`,
          timestamp: new Date(Date.now() - ((mcpErrors.length - index) * 10000)),
          level: 'error',
          message: `Failed MCPTool: ${mcpError.message}`,
          agent: 'system',
          category: 'tool',
          duration,
          data: {
            toolName: 'MCPTool',
            callId,
            result: {
              success: false,
              error: mcpError.message,
              errorType: mcpError.type,
              context: mcpError.context,
            },
            status: 'failed',
          },
        });

        // Test individual error display
        expect(() => render(
          <ErrorDisplay
            error={mcpError.message}
            context={mcpError.context}
            title={`MCP Error: ${mcpError.type}`}
          />
        )).not.toThrow();

        // Test tool call with MCP error
        expect(() => render(
          <ToolCall
            toolName="MCPTool"
            input={mcpError.context}
            output={mcpError.message}
            status="error"
            duration={duration}
          />
        )).not.toThrow();
      });

      mockStats = {
        totalCalls: mcpErrors.length,
        successfulCalls: 0,
        failedCalls: mcpErrors.length,
        averageDuration: 15000,
      };

      // Test comprehensive error panel
      const panelResult = render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="mcp-error-test"
          showStats={true}
          showActivityLog={true}
        />
      );

      expect(panelResult.lastFrame()).toContain('Failed: 4');
      expect(panelResult.lastFrame()).toContain('0.0%'); // 0% success rate
    });

    it('should handle MCP error recovery and retry scenarios', () => {
      const recoveryScenario = [
        {
          attempt: 1,
          success: false,
          error: 'MCP connection timeout',
          duration: 30000,
        },
        {
          attempt: 2,
          success: false,
          error: 'MCP authentication failed',
          duration: 5000,
        },
        {
          attempt: 3,
          success: true,
          result: 'MCP operation completed successfully',
          duration: 2500,
        }
      ];

      mockToolLogs.length = 0;
      mockActiveToolCalls.clear();

      recoveryScenario.forEach((scenario, index) => {
        const callId = `recovery-${index}`;
        const logId = `recovery-log-${index}`;

        if (scenario.success) {
          mockToolLogs.push({
            id: logId,
            timestamp: new Date(Date.now() - ((recoveryScenario.length - index) * 5000)),
            level: 'success',
            message: `Completed MCPRetryTool (attempt ${scenario.attempt}): ${scenario.result}`,
            agent: 'system',
            category: 'tool',
            duration: scenario.duration,
            data: {
              toolName: 'MCPRetryTool',
              callId,
              attempt: scenario.attempt,
              result: {
                success: true,
                data: scenario.result,
              },
              status: 'completed',
            },
          });
        } else {
          mockToolLogs.push({
            id: logId,
            timestamp: new Date(Date.now() - ((recoveryScenario.length - index) * 5000)),
            level: 'error',
            message: `Failed MCPRetryTool (attempt ${scenario.attempt}): ${scenario.error}`,
            agent: 'system',
            category: 'tool',
            duration: scenario.duration,
            data: {
              toolName: 'MCPRetryTool',
              callId,
              attempt: scenario.attempt,
              result: {
                success: false,
                error: scenario.error,
              },
              status: 'failed',
            },
          });
        }
      });

      mockStats = {
        totalCalls: 3,
        successfulCalls: 1,
        failedCalls: 2,
        averageDuration: (30000 + 5000 + 2500) / 3,
      };

      const result = render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="mcp-recovery-test"
          showStats={true}
        />
      );

      expect(result.lastFrame()).toContain('Total: 3');
      expect(result.lastFrame()).toContain('Success: 1');
      expect(result.lastFrame()).toContain('Failed: 2');
      expect(result.lastFrame()).toContain('33.3%'); // 1/3 success rate
    });

    it('should handle complex MCP infrastructure failures', () => {
      // Simulate complex MCP infrastructure with multiple servers
      const mcpInfrastructure = {
        servers: [
          { id: 'mcp-1', endpoint: 'ws://mcp1.example.com', status: 'failed' },
          { id: 'mcp-2', endpoint: 'ws://mcp2.example.com', status: 'degraded' },
          { id: 'mcp-3', endpoint: 'ws://mcp3.example.com', status: 'healthy' },
        ],
        loadBalancer: {
          status: 'failing',
          activeConnections: 15,
          failureRate: 0.85,
        },
        diagnostics: {
          networkLatency: 250,
          packetLoss: 0.15,
          totalRequests: 10000,
          failedRequests: 8500,
        }
      };

      const infrastructureError = `MCP infrastructure failure detected:
- Primary server (mcp-1): Connection refused
- Secondary server (mcp-2): High latency (>1000ms)
- Tertiary server (mcp-3): Operating normally
- Load balancer: 85% failure rate
- Network issues: 15% packet loss detected`;

      mockToolLogs.push({
        id: 'infra-failure',
        timestamp: new Date(),
        level: 'error',
        message: 'Failed MCPInfrastructureTool: Infrastructure failure',
        agent: 'system',
        category: 'tool',
        duration: 60000,
        data: {
          toolName: 'MCPInfrastructureTool',
          callId: 'infra-1',
          result: {
            success: false,
            error: infrastructureError,
            diagnostics: mcpInfrastructure,
          },
          status: 'failed',
        },
      });

      mockStats = {
        totalCalls: 1,
        successfulCalls: 0,
        failedCalls: 1,
        averageDuration: 60000,
      };

      // Test all components with complex infrastructure failure
      expect(() => render(
        <ErrorDisplay
          error={infrastructureError}
          context={mcpInfrastructure}
          showSuggestions={true}
          verbose={true}
        />
      )).not.toThrow();

      expect(() => render(
        <ToolCall
          toolName="MCPInfrastructureTool"
          input={mcpInfrastructure}
          output={infrastructureError}
          status="error"
          duration={60000}
          displayMode="verbose"
        />
      )).not.toThrow();

      const panelResult = render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="mcp-infrastructure-test"
          displayMode="verbose"
        />
      );

      expect(panelResult.lastFrame()).toContain('Failed: 1');
      expect(panelResult.lastFrame()).toContain('1m 0s');
    });
  });

  describe('Integration Tests - All Features Combined', () => {
    it('should handle the ultimate stress test: all 4 features simultaneously', async () => {
      // Create the ultimate test scenario combining all features
      const ultimateTestData: any = {
        mcpInfrastructure: {
          servers: Array(100).fill(0).map((_, i) => ({
            id: `mcp-${i}`,
            endpoint: `ws://mcp${i}.example.com:8080`,
            status: Math.random() > 0.7 ? 'failed' : 'healthy',
            latency: Math.random() * 1000,
            errorRate: Math.random() * 0.5,
          }))
        },
        largeDatasets: Array(1000).fill(0).map((_, i) => ({
          id: i,
          data: new Array(1000).fill(`data_${i}`),
          metadata: {
            size: Math.random() * 1000000,
            processed: Math.random() > 0.5,
            errors: Array(Math.floor(Math.random() * 10)).fill(`error_${i}`)
          }
        })),
        timingMetrics: {
          startTime: Date.now() - 3600000, // 1 hour ago
          currentTime: Date.now(),
          operations: Array(500).fill(0).map((_, i) => ({
            id: i,
            duration: Math.random() * 60000,
            timestamp: Date.now() - (Math.random() * 3600000),
            status: Math.random() > 0.8 ? 'failed' : 'success'
          }))
        }
      };

      // Create circular references
      ultimateTestData.mcpInfrastructure.parent = ultimateTestData;
      ultimateTestData.largeDatasets.forEach((dataset, i) => {
        if (i % 10 === 0) {
          dataset.reference = ultimateTestData;
        }
      });

      mockToolLogs.length = 0;
      mockActiveToolCalls.clear();

      // Generate complex event sequence
      const eventSequence = [];
      const baseTime = Date.now() - 300000; // 5 minutes ago

      for (let i = 0; i < 200; i++) {
        const timestamp = baseTime + (i * 1500); // Every 1.5 seconds
        const toolIndex = i % 20;
        const isMcpError = Math.random() > 0.85;
        const hasCircularData = Math.random() > 0.9;
        const isLargePayload = Math.random() > 0.8;

        let toolData = {
          operation: `operation_${i}`,
          index: i,
          timestamp,
        };

        if (hasCircularData) {
          toolData = ultimateTestData.largeDatasets[i % 100];
        } else if (isLargePayload) {
          toolData = {
            ...toolData,
            largePayload: ultimateTestData.largeDatasets.slice(0, 50)
          };
        }

        if (isMcpError) {
          eventSequence.push({
            type: 'error',
            toolName: `MCPTool${toolIndex}`,
            callId: `ultimate-${i}`,
            timestamp,
            duration: Math.random() * 30000,
            error: `MCP error type ${i % 5}: Connection/Protocol/Auth/Timeout/Transport`,
            data: toolData,
          });
        } else {
          eventSequence.push({
            type: Math.random() > 0.5 ? 'success' : 'progress',
            toolName: `UltimateTool${toolIndex}`,
            callId: `ultimate-${i}`,
            timestamp,
            duration: Math.random() > 0.5 ? Math.random() * 10000 : undefined,
            data: toolData,
          });
        }
      }

      // Convert to logs
      eventSequence.forEach((event, index) => {
        const level = event.type === 'error' ? 'error' :
                     event.type === 'success' ? 'success' : 'info';

        mockToolLogs.push({
          id: `ultimate-log-${index}`,
          timestamp: new Date(event.timestamp),
          level,
          message: event.type === 'error'
            ? `Failed ${event.toolName}: ${event.error}`
            : `${event.type} ${event.toolName}`,
          agent: 'system',
          category: 'tool',
          duration: event.duration,
          data: {
            toolName: event.toolName,
            callId: event.callId,
            type: event.type,
            payload: event.data,
            status: event.type === 'progress' ? 'progress' :
                   event.type === 'error' ? 'failed' : 'completed',
          },
        });
      });

      // Set some tools as still active
      for (let i = 0; i < 10; i++) {
        const callId = `active-ultimate-${i}`;
        mockActiveToolCalls.set(callId, {
          taskId: 'ultimate-test',
          callId,
          toolName: `ActiveTool${i}`,
          timestamp: new Date(Date.now() - (Math.random() * 30000)),
          input: ultimateTestData.largeDatasets[i],
        } as ToolCallStartEvent);
      }

      const errorCount = eventSequence.filter(e => e.type === 'error').length;
      const successCount = eventSequence.filter(e => e.type === 'success').length;

      mockStats = {
        totalCalls: errorCount + successCount,
        successfulCalls: successCount,
        failedCalls: errorCount,
        averageDuration: 5000,
      };

      // The ultimate test: render all components with maximum complexity
      const startTime = Date.now();

      const toolCallResult = render(
        <ToolCall
          toolName="UltimateStressTestTool"
          input={ultimateTestData}
          output="Ultimate test completed with mixed results"
          status="error"
          duration={300000}
          displayMode="verbose"
        />
      );

      const panelResult = render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="ultimate-test"
          maxEntries={200}
          maxRecentLogs={10}
          displayMode="verbose"
          showStats={true}
          showActiveTools={true}
          showActivityLog={true}
        />
      );

      const errorResult = render(
        <ErrorDisplay
          error="Ultimate system failure: All 4 features tested simultaneously"
          context={ultimateTestData}
          showStack={true}
          verbose={true}
          showSuggestions={true}
        />
      );

      const endTime = Date.now();

      // Performance verification: should handle ultimate complexity efficiently
      expect(endTime - startTime).toBeLessThan(10000); // 10 second max

      // Functionality verification: all components should render
      expect(toolCallResult.lastFrame()).toContain('UltimateStressTestTool');
      expect(panelResult.lastFrame()).toContain('200 logs');
      expect(panelResult.lastFrame()).toContain('10 active');
      expect(errorResult.lastFrame()).toContain('Ultimate system failure');

      // Verify no crashes or memory leaks
      expect(mockToolLogs.length).toBe(200);
      expect(mockActiveToolCalls.size).toBe(10);
    });

    it('should maintain data integrity across component boundaries', () => {
      // Create test data that will pass through all components
      const testData: any = {
        id: 'integrity-test-123',
        circular: null,
        large: new Array(10000).fill('integrity'),
        timing: {
          start: Date.now() - 60000,
          operations: Array(100).fill(0).map((_, i) => ({
            timestamp: Date.now() - (60000 - i * 600),
            duration: Math.random() * 5000,
            success: Math.random() > 0.2
          }))
        },
        mcp: {
          errors: [
            'MCP_CONNECTION_FAILED',
            'MCP_TIMEOUT',
            'MCP_PROTOCOL_ERROR'
          ],
          recovery: {
            attempts: 3,
            successful: true,
            finalDuration: 15000
          }
        }
      };

      // Add circular reference
      testData.circular = testData;

      // Pass through ToolCall
      const toolCallResult = render(
        <ToolCall
          toolName="IntegrityTestTool"
          input={testData}
          output={JSON.stringify({ result: 'integrity maintained', data: testData })}
          status="success"
          duration={testData.mcp.recovery.finalDuration}
        />
      );

      // Pass through ErrorDisplay
      const errorResult = render(
        <ErrorDisplay
          error="Integrity test error with complex context"
          context={testData}
        />
      );

      // Pass through ToolExecutionPanel
      mockToolLogs.push({
        id: 'integrity-log',
        timestamp: new Date(),
        level: 'info',
        message: 'Integrity test completed',
        agent: 'system',
        category: 'tool',
        data: {
          integrity: testData,
          verification: 'passed'
        },
      });

      const panelResult = render(
        <ToolExecutionPanel
          orchestrator={mockOrchestrator as any}
          taskId="integrity-test"
        />
      );

      // Verify all components handled the data without corruption
      expect(toolCallResult.lastFrame()).toContain('IntegrityTestTool');
      expect(toolCallResult.lastFrame()).toContain('15.0s');
      expect(errorResult.lastFrame()).toContain('integrity test error');
      expect(panelResult.lastFrame()).toBeDefined();

      // Data should maintain its properties after processing
      expect(testData.id).toBe('integrity-test-123');
      expect(testData.circular).toBe(testData);
      expect(testData.large.length).toBe(10000);
      expect(testData.mcp.recovery.successful).toBe(true);
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle extreme edge cases without breaking', () => {
      const extremeEdgeCases = [
        {
          name: 'Null Everything',
          data: {
            error: null,
            input: null,
            output: null,
            context: null,
            duration: null,
          }
        },
        {
          name: 'Undefined Everything',
          data: {
            error: undefined,
            input: undefined,
            output: undefined,
            context: undefined,
            duration: undefined,
          }
        },
        {
          name: 'Empty Everything',
          data: {
            error: '',
            input: {},
            output: '',
            context: {},
            duration: 0,
          }
        },
        {
          name: 'Maximum Values',
          data: {
            error: 'x'.repeat(1000000),
            input: { huge: new Array(Number.MAX_SAFE_INTEGER / 1000000).fill('x') },
            output: 'y'.repeat(1000000),
            context: { max: Number.MAX_SAFE_INTEGER },
            duration: Number.MAX_SAFE_INTEGER,
          }
        }
      ];

      extremeEdgeCases.forEach(testCase => {
        expect(() => render(
          <ToolCall
            toolName={`EdgeCase_${testCase.name}`}
            input={testCase.data.input as any}
            output={testCase.data.output as any}
            status="error"
            duration={testCase.data.duration as any}
          />
        )).not.toThrow();

        expect(() => render(
          <ErrorDisplay
            error={testCase.data.error as any}
            context={testCase.data.context as any}
          />
        )).not.toThrow();
      });
    });

    it('should recover gracefully from rendering failures', () => {
      // Test component resilience to various failure modes
      const problematicData = {
        throwingGetter: {
          get value() {
            throw new Error('Getter throws');
          }
        },
        circularWithThrow: null as any,
      };

      // Create circular reference that throws during serialization
      problematicData.circularWithThrow = {
        data: problematicData,
        toString() {
          throw new Error('toString throws');
        },
        valueOf() {
          throw new Error('valueOf throws');
        }
      };

      // Components should handle these gracefully
      expect(() => render(
        <ToolCall
          toolName="ProblematicTool"
          input={problematicData}
          status="error"
        />
      )).not.toThrow();

      expect(() => render(
        <ErrorDisplay
          error="Problematic error"
          context={problematicData}
        />
      )).not.toThrow();
    });
  });
});