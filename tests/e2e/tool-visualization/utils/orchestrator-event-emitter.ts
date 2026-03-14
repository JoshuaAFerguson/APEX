/**
 * Extended mock orchestrator for tool visualization E2E testing
 * Adds simulation methods for all 4 visualization features
 */

import { MockOrchestrator } from '../../../../packages/cli/src/ui/components/agents/__tests__/test-utils/MockOrchestrator.js';
import type { WebSocketMessage } from './mock-websocket-server.js';

export interface LargePayloadConfig {
  /** Size of arrays to generate */
  arraySize?: number;
  /** Size of strings to generate (in KB) */
  stringSize?: number;
  /** Nesting depth for objects */
  nestingDepth?: number;
  /** Whether to mix different payload types */
  mixed?: boolean;
}

export interface TimingScenario {
  /** Tool name to simulate */
  toolName: string;
  /** Delay before starting (ms) */
  startDelay?: number;
  /** Tool execution duration (ms) */
  duration: number;
  /** Whether to emit progress events */
  emitProgress?: boolean;
  /** Progress interval (ms) */
  progressInterval?: number;
}

export type MCPErrorType =
  | 'permission-denied'
  | 'connection-timeout'
  | 'tool-not-found'
  | 'protocol-error'
  | 'server-disconnect'
  | 'nested-error'
  | 'api-key-error';

export interface ToolEventData {
  taskId: string;
  toolName: string;
  input?: any;
  output?: any;
  error?: Error;
  timing?: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Extended mock orchestrator for tool visualization E2E testing
 * Adds simulation methods for all 4 visualization features
 */
export class ToolVisualizationMockOrchestrator extends MockOrchestrator {
  private activeToolCalls: Map<string, ToolEventData> = new Map();
  private toolCallCounter = 0;

  /**
   * Generate unique tool call ID
   */
  private generateToolCallId(): string {
    return `tool-call-${++this.toolCallCounter}-${Date.now()}`;
  }

  /**
   * Simulate tool events with circular references
   */
  simulateCircularReferenceToolEvent(taskId: string, scenario: 'self-reference' | 'nested-circular' | 'array-circular' | 'deep-circular' | 'multiple-paths' = 'self-reference'): string {
    const toolCallId = this.generateToolCallId();

    // Create input with circular reference based on scenario
    let circularInput: any;

    switch (scenario) {
      case 'self-reference':
        circularInput = { name: 'test', value: 42 };
        circularInput.self = circularInput;
        break;

      case 'nested-circular':
        const parent: any = { type: 'parent' };
        const child: any = { type: 'child' };
        parent.child = child;
        child.parent = parent;
        circularInput = parent;
        break;

      case 'array-circular':
        const arr: any[] = [1, 2, 3];
        arr.push(arr);
        circularInput = arr;
        break;

      case 'deep-circular':
        let obj: any = { level: 0 };
        const root = obj;
        for (let i = 1; i < 10; i++) {
          obj.child = { level: i };
          obj = obj.child;
        }
        obj.root = root; // Create circular reference
        circularInput = root;
        break;

      case 'multiple-paths':
        const a: any = { id: 'a' };
        const b: any = { id: 'b' };
        const c: any = { id: 'c' };
        a.toB = b;
        b.toC = c;
        c.toA = a;
        a.toC = c;
        b.toA = a;
        c.toB = b;
        circularInput = a;
        break;
    }

    const startTime = Date.now();
    const eventData: ToolEventData = {
      taskId,
      toolName: 'Read',
      input: { file_path: '/test/path', circular_data: circularInput },
      timing: { startTime },
    };

    this.activeToolCalls.set(toolCallId, eventData);

    // Emit tool start event
    this.emit('tool:start', { ...eventData, toolCallId });

    // Simulate completion after short delay
    setTimeout(() => {
      const endTime = Date.now();
      eventData.timing!.endTime = endTime;
      eventData.timing!.duration = endTime - startTime;
      eventData.output = `File content with circular reference (scenario: ${scenario})`;

      this.activeToolCalls.delete(toolCallId);
      this.emit('tool:complete', { ...eventData, toolCallId });
    }, 50);

    return toolCallId;
  }

  /**
   * Simulate tool events with large payloads
   */
  simulateLargePayloadToolEvent(taskId: string, payloadConfig: LargePayloadConfig = {}): string {
    const toolCallId = this.generateToolCallId();

    const config = {
      arraySize: payloadConfig.arraySize ?? 10000,
      stringSize: payloadConfig.stringSize ?? 100, // KB
      nestingDepth: payloadConfig.nestingDepth ?? 20,
      mixed: payloadConfig.mixed ?? false,
      ...payloadConfig,
    };

    let largePayload: any;

    if (config.mixed) {
      // Create mixed large payload
      largePayload = {
        largeArray: Array.from({ length: config.arraySize }, (_, i) => ({
          index: i,
          value: `item-${i}`,
          timestamp: new Date().toISOString(),
        })),
        largeString: 'x'.repeat(config.stringSize * 1024),
        nested: this.createDeeplyNested(config.nestingDepth),
        metadata: {
          arraySize: config.arraySize,
          stringSize: config.stringSize,
          nestingDepth: config.nestingDepth,
        },
      };
    } else if (config.arraySize > 1000) {
      // Large array payload
      largePayload = Array.from({ length: config.arraySize }, (_, i) => ({
        index: i,
        data: `data-${i}`,
        timestamp: Date.now() + i,
      }));
    } else if (config.stringSize > 50) {
      // Large string payload
      largePayload = 'A'.repeat(config.stringSize * 1024);
    } else {
      // Deeply nested payload
      largePayload = this.createDeeplyNested(config.nestingDepth);
    }

    const startTime = Date.now();
    const eventData: ToolEventData = {
      taskId,
      toolName: 'Grep',
      input: { pattern: 'test', path: '/', payload: largePayload },
      timing: { startTime },
    };

    this.activeToolCalls.set(toolCallId, eventData);

    // Emit tool start event
    this.emit('tool:start', { ...eventData, toolCallId });

    // Simulate completion with large output
    setTimeout(() => {
      const endTime = Date.now();
      eventData.timing!.endTime = endTime;
      eventData.timing!.duration = endTime - startTime;

      // Create large output
      eventData.output = Array.from({ length: 100 }, (_, i) =>
        `Line ${i + 1}: This is a very long line with lots of content that should be truncated properly in the UI`
      ).join('\n');

      this.activeToolCalls.delete(toolCallId);
      this.emit('tool:complete', { ...eventData, toolCallId });
    }, 100);

    return toolCallId;
  }

  /**
   * Create deeply nested object
   */
  private createDeeplyNested(depth: number): any {
    let obj: any = { value: 'leaf', depth };
    for (let i = depth; i > 0; i--) {
      obj = { level: i, child: obj, timestamp: Date.now() };
    }
    return obj;
  }

  /**
   * Simulate timing events for tool execution
   */
  simulateTimingEvents(taskId: string, timingScenario: TimingScenario): string {
    const toolCallId = this.generateToolCallId();

    const scenario = {
      startDelay: 0,
      emitProgress: true,
      progressInterval: 100,
      ...timingScenario,
    };

    setTimeout(() => {
      const startTime = Date.now();
      const eventData: ToolEventData = {
        taskId,
        toolName: scenario.toolName,
        input: { action: 'timing-test', duration: scenario.duration },
        timing: { startTime },
      };

      this.activeToolCalls.set(toolCallId, eventData);

      // Emit tool start event
      this.emit('tool:start', { ...eventData, toolCallId });

      // Emit timing events during execution
      this.emit('tool:timing', {
        taskId,
        toolCallId,
        toolName: scenario.toolName,
        event: 'started',
        timestamp: startTime,
        timing: { startTime },
      });

      let progressCount = 0;
      const maxProgress = Math.floor(scenario.duration / scenario.progressInterval);

      // Emit progress events if enabled
      const progressInterval = scenario.emitProgress ? setInterval(() => {
        progressCount++;
        const progress = Math.min(progressCount / maxProgress, 0.99); // Never reach 100% until completion

        this.emit('tool:progress', {
          taskId,
          toolCallId,
          toolName: scenario.toolName,
          progress,
          timestamp: Date.now(),
        });

        this.emit('tool:timing', {
          taskId,
          toolCallId,
          toolName: scenario.toolName,
          event: 'progress',
          timestamp: Date.now(),
          timing: {
            startTime,
            elapsedTime: Date.now() - startTime,
            estimatedRemaining: scenario.duration - (Date.now() - startTime),
          },
        });
      }, scenario.progressInterval) : null;

      // Complete the tool call
      setTimeout(() => {
        if (progressInterval) {
          clearInterval(progressInterval);
        }

        const endTime = Date.now();
        eventData.timing!.endTime = endTime;
        eventData.timing!.duration = endTime - startTime;
        eventData.output = `Tool execution completed in ${endTime - startTime}ms`;

        // Final timing event
        this.emit('tool:timing', {
          taskId,
          toolCallId,
          toolName: scenario.toolName,
          event: 'completed',
          timestamp: endTime,
          timing: {
            startTime,
            endTime,
            duration: endTime - startTime,
          },
        });

        this.activeToolCalls.delete(toolCallId);
        this.emit('tool:complete', { ...eventData, toolCallId });
      }, scenario.duration);

    }, scenario.startDelay);

    return toolCallId;
  }

  /**
   * Simulate MCP error events with various error types
   */
  simulateMCPError(taskId: string, errorType: MCPErrorType): string {
    const toolCallId = this.generateToolCallId();

    let error: Error;
    let toolName: string;
    let input: any;

    switch (errorType) {
      case 'permission-denied':
        error = new Error('MCP permission denied: Cannot write to /system/protected');
        toolName = 'Write';
        input = { file_path: '/system/protected/file.txt', content: 'test' };
        break;

      case 'connection-timeout':
        error = new Error('MCP connection timeout after 30000ms');
        (error as any).code = 'ETIMEDOUT';
        toolName = 'WebFetch';
        input = { url: 'https://slow-server.example.com' };
        break;

      case 'tool-not-found':
        error = new Error('MCP tool "custom-tool" not found on server');
        toolName = 'custom-tool';
        input = { action: 'test' };
        break;

      case 'protocol-error':
        error = new Error('Invalid JSON-RPC message: missing "id" field');
        (error as any).code = 'PROTOCOL_ERROR';
        toolName = 'Bash';
        input = { command: 'echo test' };
        break;

      case 'server-disconnect':
        error = new Error('MCP server disconnected unexpectedly');
        (error as any).code = 'ECONNRESET';
        toolName = 'Read';
        input = { file_path: '/remote/file.txt' };
        break;

      case 'api-key-error':
        error = new Error('Invalid API key for MCP marketplace authentication');
        toolName = 'WebSearch';
        input = { query: 'test search' };
        break;

      case 'nested-error':
        const rootCause = new Error('Network unreachable');
        const midLevel = new Error('Failed to connect to MCP server');
        (midLevel as any).cause = rootCause;
        error = new Error('MCP tool execution failed');
        (error as any).cause = midLevel;
        toolName = 'WebFetch';
        input = { url: 'https://example.com' };
        break;

      default:
        error = new Error('Unknown MCP error');
        toolName = 'Unknown';
        input = {};
    }

    const startTime = Date.now();
    const eventData: ToolEventData = {
      taskId,
      toolName,
      input,
      error,
      timing: { startTime },
    };

    this.activeToolCalls.set(toolCallId, eventData);

    // Emit tool start event
    this.emit('tool:start', { ...eventData, toolCallId });

    // Simulate error after brief delay
    setTimeout(() => {
      const endTime = Date.now();
      eventData.timing!.endTime = endTime;
      eventData.timing!.duration = endTime - startTime;

      this.activeToolCalls.delete(toolCallId);
      this.emit('tool:error', { ...eventData, toolCallId, error });
    }, 30);

    return toolCallId;
  }

  /**
   * Simulate multiple concurrent tool calls
   */
  simulateConcurrentTools(taskId: string, count: number): string[] {
    const toolCallIds: string[] = [];

    for (let i = 0; i < count; i++) {
      // Mix different types of tool calls
      const scenarioType = i % 4;
      let toolCallId: string;

      switch (scenarioType) {
        case 0:
          toolCallId = this.simulateCircularReferenceToolEvent(taskId, 'self-reference');
          break;
        case 1:
          toolCallId = this.simulateLargePayloadToolEvent(taskId, { arraySize: 1000 + i * 1000 });
          break;
        case 2:
          toolCallId = this.simulateTimingEvents(taskId, {
            toolName: `Tool${i}`,
            duration: 500 + i * 200,
            emitProgress: true,
          });
          break;
        case 3:
          toolCallId = this.simulateMCPError(taskId, i % 2 === 0 ? 'permission-denied' : 'connection-timeout');
          break;
        default:
          toolCallId = this.simulateCircularReferenceToolEvent(taskId);
      }

      toolCallIds.push(toolCallId);
    }

    return toolCallIds;
  }

  /**
   * Simulate stress test with rapid tool calls
   */
  simulateStressTest(taskId: string, callsPerSecond: number, durationSeconds: number): Promise<string[]> {
    return new Promise((resolve) => {
      const toolCallIds: string[] = [];
      const intervalMs = 1000 / callsPerSecond;
      const totalCalls = callsPerSecond * durationSeconds;
      let callCount = 0;

      const interval = setInterval(() => {
        if (callCount >= totalCalls) {
          clearInterval(interval);
          resolve(toolCallIds);
          return;
        }

        // Alternate between different tool types for stress testing
        const toolType = callCount % 3;
        let toolCallId: string;

        switch (toolType) {
          case 0:
            toolCallId = this.simulateTimingEvents(taskId, {
              toolName: 'FastTool',
              duration: 50,
              emitProgress: false,
            });
            break;
          case 1:
            toolCallId = this.simulateCircularReferenceToolEvent(taskId, 'self-reference');
            break;
          case 2:
            toolCallId = this.simulateLargePayloadToolEvent(taskId, { arraySize: 100, stringSize: 1 });
            break;
          default:
            toolCallId = this.simulateCircularReferenceToolEvent(taskId);
        }

        toolCallIds.push(toolCallId);
        callCount++;
      }, intervalMs);
    });
  }

  /**
   * Get active tool calls for debugging
   */
  getActiveToolCalls(): Map<string, ToolEventData> {
    return new Map(this.activeToolCalls);
  }

  /**
   * Clear all active tool calls
   */
  clearActiveToolCalls(): void {
    this.activeToolCalls.clear();
  }

  /**
   * Get statistics about tool calls
   */
  getToolCallStats() {
    return {
      activeCount: this.activeToolCalls.size,
      totalCalls: this.toolCallCounter,
      activeTools: Array.from(this.activeToolCalls.values()).map(call => ({
        toolName: call.toolName,
        startTime: call.timing?.startTime,
        elapsed: call.timing?.startTime ? Date.now() - call.timing.startTime : 0,
      })),
    };
  }
}

/**
 * Factory function to create a ToolVisualizationMockOrchestrator
 */
export function createToolVisualizationMockOrchestrator(): ToolVisualizationMockOrchestrator {
  return new ToolVisualizationMockOrchestrator();
}