/**
 * Partial Results Handling During Permission Revocation Tests
 *
 * This test suite verifies that when permissions are revoked during an active Claude SDK
 * streaming session, partial results are appropriately captured, marked, and retrievable.
 *
 * Acceptance Criteria:
 * 1. Partial streaming results are captured before termination
 * 2. Partial results are properly marked as incomplete
 * 3. Partial results can be retrieved after interruption
 *
 * Test Implementation Strategy:
 * - Use MockClaudeAgentSDK to simulate streaming responses with multiple events
 * - Use PermissionRevocationController to trigger revocation at specific points
 * - Create a PartialResultsController to capture and manage partial results
 * - Verify that partial results preserve completed work but indicate incompleteness
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { EventEmitter } from 'eventemitter3';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { TaskStore } from '../store';
import { MockClaudeAgentSDK, StreamingResponseBuilder } from './mocks/claude-agent-sdk';
import { PermissionRevokedError } from '@apexcli/core';
import type { StreamingEvent } from './mocks/claude-agent-sdk.types';
import type { Task, TaskLog, TaskArtifact, AgentMessage } from '@apexcli/core';

// Set up mock at module level
const mockSDKInstance = new MockClaudeAgentSDK();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn().mockImplementation((options) => mockSDKInstance.mockQuery(options))
}));

/**
 * Helper function to handle delays properly with fake timers
 */
async function testDelay(ms: number): Promise<void> {
  if (vi.isFakeTimers()) {
    await vi.advanceTimersByTimeAsync(ms);
  } else {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Represents captured partial results from an interrupted streaming session
 */
interface PartialResult {
  /** Unique identifier for this partial result set */
  id: string;
  /** When the interruption occurred */
  interruptedAt: Date;
  /** Why the interruption occurred */
  interruptionReason: string;
  /** Streaming events captured before interruption */
  capturedEvents: any[];
  /** Conversation messages captured before interruption */
  conversationSnapshot: AgentMessage[];
  /** Tool executions completed before interruption */
  completedToolExecutions: Array<{
    toolName: string;
    input: Record<string, unknown>;
    output?: string;
    timestamp: Date;
    completed: boolean;
  }>;
  /** Artifacts created before interruption */
  capturedArtifacts: TaskArtifact[];
  /** Log entries captured before interruption */
  capturedLogs: TaskLog[];
  /** Whether this result set is marked as incomplete */
  isIncomplete: boolean;
  /** Total events expected vs captured */
  completionStatus: {
    eventsExpected: number;
    eventsCaptured: number;
    completionPercentage: number;
  };
  /** Recovery metadata for potential resumption */
  recoveryMetadata?: {
    lastCompletedStage?: string;
    nextStepIndex?: number;
    stateSnapshot?: Record<string, unknown>;
  };
}

/**
 * Controller for managing partial results capture during interruptions
 */
class PartialResultsController extends EventEmitter {
  private permissionManager: PermissionManager;
  private taskStore: TaskStore;
  private mockSDK: MockClaudeAgentSDK;
  private capturedResults: Map<string, PartialResult> = new Map();
  private activeCaptureSessions: Set<string> = new Set();

  constructor(permissionManager: PermissionManager, taskStore: TaskStore, mockSDK: MockClaudeAgentSDK) {
    super();
    this.permissionManager = permissionManager;
    this.taskStore = taskStore;
    this.mockSDK = mockSDK;
  }

  /**
   * Start capturing partial results for a streaming session
   */
  async startCapture(sessionId: string, expectedEventCount: number): Promise<void> {
    this.activeCaptureSessions.add(sessionId);

    const partialResult: PartialResult = {
      id: sessionId,
      interruptedAt: new Date(),
      interruptionReason: '',
      capturedEvents: [],
      conversationSnapshot: [],
      completedToolExecutions: [],
      capturedArtifacts: [],
      capturedLogs: [],
      isIncomplete: false,
      completionStatus: {
        eventsExpected: expectedEventCount,
        eventsCaptured: 0,
        completionPercentage: 0
      },
      recoveryMetadata: {
        lastCompletedStage: undefined,
        nextStepIndex: 0,
        stateSnapshot: {}
      }
    };

    this.capturedResults.set(sessionId, partialResult);
    this.emit('capture:started', { sessionId, expectedEventCount });
  }

  /**
   * Capture an event during streaming
   */
  captureEvent(sessionId: string, event: any): void {
    const result = this.capturedResults.get(sessionId);
    if (!result) return;

    result.capturedEvents.push({
      ...event,
      capturedAt: new Date()
    });

    // Update completion status
    result.completionStatus.eventsCaptured = result.capturedEvents.length;
    result.completionStatus.completionPercentage =
      (result.completionStatus.eventsCaptured / result.completionStatus.eventsExpected) * 100;

    // Capture conversation messages
    if (event.type === 'assistant' && event.message) {
      result.conversationSnapshot.push(event.message);
    }

    // Capture completed tool executions
    if (event.type === 'tool_result') {
      const toolExecution = {
        toolName: event.tool_name || 'unknown',
        input: event.input || {},
        output: event.content || '',
        timestamp: new Date(),
        completed: true
      };
      result.completedToolExecutions.push(toolExecution);
    }

    // Capture in-progress tool executions
    if (event.type === 'assistant' && event.message?.content) {
      for (const content of event.message.content) {
        if (content.type === 'tool_use') {
          const toolExecution = {
            toolName: content.name,
            input: content.input || {},
            timestamp: new Date(),
            completed: false
          };
          result.completedToolExecutions.push(toolExecution);
        }
      }
    }

    this.emit('event:captured', { sessionId, event, totalCaptured: result.capturedEvents.length });
  }

  /**
   * Mark a session as interrupted and finalize the partial result
   */
  async markAsInterrupted(sessionId: string, reason: string, toolRevoked?: string): Promise<PartialResult> {
    const result = this.capturedResults.get(sessionId);
    if (!result) {
      throw new Error(`No capture session found for ${sessionId}`);
    }

    result.interruptedAt = new Date();
    result.interruptionReason = reason;
    result.isIncomplete = true;

    // Add metadata about the interruption
    result.recoveryMetadata = {
      lastCompletedStage: this.getLastCompletedStage(result.capturedEvents),
      nextStepIndex: result.capturedEvents.length,
      stateSnapshot: {
        revokedTool: toolRevoked,
        interruptionPoint: result.capturedEvents.length,
        totalExpected: result.completionStatus.eventsExpected
      }
    };

    // Generate summary artifacts
    const summaryArtifact: TaskArtifact = {
      name: 'Partial Results Summary',
      type: 'report',
      content: this.generatePartialResultsSummary(result),
      createdAt: new Date()
    };
    result.capturedArtifacts.push(summaryArtifact);

    // Generate log entry
    const logEntry: TaskLog = {
      timestamp: new Date(),
      level: 'warn',
      message: `Task interrupted due to ${reason}. Partial results captured: ${result.completionStatus.eventsCaptured}/${result.completionStatus.eventsExpected} events (${result.completionStatus.completionPercentage.toFixed(1)}%)`,
      metadata: {
        sessionId,
        interruptionReason: reason,
        capturedEvents: result.completionStatus.eventsCaptured,
        expectedEvents: result.completionStatus.eventsExpected,
        completionPercentage: result.completionStatus.completionPercentage,
        revokedTool: toolRevoked
      }
    };
    result.capturedLogs.push(logEntry);

    this.activeCaptureSessions.delete(sessionId);
    this.emit('capture:completed', { sessionId, result });
    return result;
  }

  /**
   * Retrieve partial results by session ID
   */
  getPartialResults(sessionId: string): PartialResult | undefined {
    return this.capturedResults.get(sessionId);
  }

  /**
   * Get all captured partial results
   */
  getAllPartialResults(): PartialResult[] {
    return Array.from(this.capturedResults.values());
  }

  /**
   * Check if a session is currently capturing
   */
  isCapturing(sessionId: string): boolean {
    return this.activeCaptureSessions.has(sessionId);
  }

  /**
   * Reset all captured results (for testing)
   */
  reset(): void {
    this.capturedResults.clear();
    this.activeCaptureSessions.clear();
    this.removeAllListeners();
  }

  /**
   * Generate a human-readable summary of partial results
   */
  private generatePartialResultsSummary(result: PartialResult): string {
    const summary = [
      `=== PARTIAL RESULTS SUMMARY ===`,
      `Session ID: ${result.id}`,
      `Interrupted At: ${result.interruptedAt.toISOString()}`,
      `Reason: ${result.interruptionReason}`,
      `Status: ${result.isIncomplete ? 'INCOMPLETE' : 'COMPLETE'}`,
      ``,
      `=== PROGRESS ===`,
      `Events Captured: ${result.completionStatus.eventsCaptured}/${result.completionStatus.eventsExpected}`,
      `Completion: ${result.completionStatus.completionPercentage.toFixed(1)}%`,
      ``,
      `=== COMPLETED WORK ===`,
      `Tool Executions: ${result.completedToolExecutions.filter(t => t.completed).length}`,
      `Conversation Messages: ${result.conversationSnapshot.length}`,
      ``,
      `=== RECOVERY INFO ===`,
      `Last Completed Stage: ${result.recoveryMetadata?.lastCompletedStage || 'None'}`,
      `Next Step Index: ${result.recoveryMetadata?.nextStepIndex || 0}`,
      ``
    ];

    // Add details about completed tool executions
    const completedTools = result.completedToolExecutions.filter(t => t.completed);
    if (completedTools.length > 0) {
      summary.push(`=== COMPLETED TOOL EXECUTIONS ===`);
      completedTools.forEach((tool, index) => {
        summary.push(`${index + 1}. ${tool.toolName} (${tool.timestamp.toISOString()})`);
        summary.push(`   Input: ${JSON.stringify(tool.input)}`);
        if (tool.output) {
          summary.push(`   Output: ${tool.output.substring(0, 100)}${tool.output.length > 100 ? '...' : ''}`);
        }
      });
      summary.push(``);
    }

    return summary.join('\n');
  }

  /**
   * Extract the last completed stage from captured events
   */
  private getLastCompletedStage(events: any[]): string | undefined {
    // Look for stage indicators in the events
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (event.type === 'assistant' && event.message?.content) {
        for (const content of event.message.content) {
          if (content.type === 'text' && content.text) {
            // Look for stage keywords in the text
            const text = content.text.toLowerCase();
            if (text.includes('implementation') || text.includes('implementing')) {
              return 'implementation';
            } else if (text.includes('planning') || text.includes('analyzing')) {
              return 'planning';
            } else if (text.includes('testing') || text.includes('running tests')) {
              return 'testing';
            }
          }
        }
      }
    }
    return undefined;
  }
}

describe('Partial Results During Permission Revocation', () => {
  let testDir: string;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let taskStore: TaskStore;
  let mockSDK: MockClaudeAgentSDK;
  let partialResultsController: PartialResultsController;

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `apex-partial-results-test-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    mkdirSync(testDir, { recursive: true });

    // Initialize stores and managers
    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);

    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    // Reset and use the module-level mock SDK
    mockSDKInstance.reset();
    mockSDK = mockSDKInstance;

    partialResultsController = new PartialResultsController(permissionManager, taskStore, mockSDK);
  });

  afterEach(async () => {
    try {
      if (permissionStore) {
        permissionStore.close();
      }
      if (taskStore) {
        taskStore.close();
      }
    } catch (error) {
      console.warn('Error closing stores:', error);
    }

    try {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Error cleaning up test directory:', error);
    }

    if (partialResultsController) {
      partialResultsController.reset();
    }

    if (mockSDK) {
      mockSDK.reset();
    }

    vi.resetAllMocks();
    vi.clearAllTimers();
  });

  // ==========================================================================
  // AC1: Partial streaming results are captured before termination
  // ==========================================================================
  describe('AC1: Partial streaming results are captured before termination', () => {
    it('should capture partial results when permission revoked mid-stream', async () => {
      // Setup: Grant permission and create a complex workflow
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      const streamingEvents = new StreamingResponseBuilder()
        .addTextChunk('Starting implementation phase...', 10)
        .addToolUse('write-1', 'Write', { path: '/src/component.tsx', content: 'import React from "react";' }, 10)
        .addTextChunk('Component header created, adding main functionality...', 10)
        .addToolUse('write-2', 'Write', { path: '/src/component.tsx', content: 'export function MyComponent() {' }, 10)
        .addTextChunk('Adding component logic...', 10)
        .addToolUse('write-3', 'Write', { path: '/src/component.tsx', content: 'return <div>Hello World</div>;' }, 10)
        .addTextChunk('Component implementation complete', 10)
        .build();

      mockSDK.addStreamingResponse(streamingEvents);

      const sessionId = 'partial-capture-test';
      const totalEvents = streamingEvents.length;

      // Start capturing partial results
      await partialResultsController.startCapture(sessionId, totalEvents);

      // Start streaming
      let capturedEvents: any[] = [];
      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Write'] });
        for await (const event of iterator) {
          capturedEvents.push(event);
          partialResultsController.captureEvent(sessionId, event);

          // Revoke permission after 4 events (mid-stream)
          if (capturedEvents.length === 4) {
            // Schedule revocation in next tick to avoid interrupting current iteration
            setTimeout(async () => {
              await permissionManager.revokePermission('Write');
              mockSDK.addError(new PermissionRevokedError('Request aborted due to permission revocation'));
            }, 5);
          }
        }
      })();

      // Expect stream to be interrupted
      await expect(streamPromise).rejects.toThrow(PermissionRevokedError);

      // Mark session as interrupted and get partial results
      const partialResult = await partialResultsController.markAsInterrupted(
        sessionId,
        'Permission revoked for Write tool',
        'Write'
      );

      // Verify partial results were captured
      expect(partialResult).toBeDefined();
      expect(partialResult.isIncomplete).toBe(true);
      expect(partialResult.capturedEvents.length).toBe(4);
      expect(partialResult.capturedEvents.length).toBeLessThan(totalEvents);

      // Verify completion status
      expect(partialResult.completionStatus.eventsCaptured).toBe(4);
      expect(partialResult.completionStatus.eventsExpected).toBe(totalEvents);
      expect(partialResult.completionStatus.completionPercentage).toBeLessThan(100);

      // Verify interruption metadata
      expect(partialResult.interruptionReason).toContain('Permission revoked');
      expect(partialResult.interruptedAt).toBeInstanceOf(Date);
    });

    it('should preserve all types of streaming events before interruption', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      const complexStreamingEvents = new StreamingResponseBuilder()
        .addTextChunk('Phase 1: Analysis', 5)
        .addThinking('Let me plan the implementation...', 5)
        .addTextChunk('Phase 2: Implementation', 5)
        .addToolUse('impl-1', 'Write', { path: '/src/file1.ts', content: 'const x = 1;' }, 5)
        .addTextChunk('Phase 3: Testing', 5)
        .addToolUse('test-1', 'Write', { path: '/tests/test1.ts', content: 'test("basic", () => {});' }, 5)
        .addUsage(1000, 500)
        .build();

      mockSDK.addStreamingResponse(complexStreamingEvents);

      const sessionId = 'complex-capture-test';
      await partialResultsController.startCapture(sessionId, complexStreamingEvents.length);

      let eventCount = 0;
      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Write'] });
        for await (const event of iterator) {
          eventCount++;
          partialResultsController.captureEvent(sessionId, event);

          // Interrupt after capturing text, thinking, and first tool_use
          if (eventCount === 4) {
            setTimeout(async () => {
              await permissionManager.revokePermission('Write');
              mockSDK.addError(new PermissionRevokedError('Permission revoked'));
            }, 5);
          }
        }
      })();

      await expect(streamPromise).rejects.toThrow();

      const partialResult = await partialResultsController.markAsInterrupted(
        sessionId,
        'Permission revoked during complex workflow'
      );

      // Verify different event types were captured
      expect(partialResult.capturedEvents.length).toBe(4);

      const eventTypes = partialResult.capturedEvents.map(e => e.type);
      expect(eventTypes).toContain('text');
      expect(eventTypes).toContain('thinking');
      expect(eventTypes).toContain('tool_use');

      // Verify conversation snapshot includes assistant messages
      expect(partialResult.conversationSnapshot.length).toBeGreaterThan(0);

      // Verify tool executions were tracked
      expect(partialResult.completedToolExecutions.length).toBeGreaterThan(0);
      const writeExecution = partialResult.completedToolExecutions.find(e => e.toolName === 'Write');
      expect(writeExecution).toBeDefined();
      expect(writeExecution?.input).toEqual({ path: '/src/file1.ts', content: 'const x = 1;' });
    });

    it('should handle rapid revocation during high-frequency streaming', async () => {
      await permissionManager.grantPermission('Read', undefined, 'allow-always');

      // Create many small events in rapid succession
      const rapidEvents = new StreamingResponseBuilder();
      for (let i = 0; i < 20; i++) {
        rapidEvents.addTextChunk(`Step ${i + 1}`, 1); // Very short delay
      }
      rapidEvents.addUsage(500, 300);

      const streamingEvents = rapidEvents.build();
      mockSDK.addStreamingResponse(streamingEvents);

      const sessionId = 'rapid-capture-test';
      await partialResultsController.startCapture(sessionId, streamingEvents.length);

      let eventCount = 0;
      const captureLog: Array<{ eventNumber: number; timestamp: Date }> = [];

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Read'] });
        for await (const event of iterator) {
          eventCount++;
          partialResultsController.captureEvent(sessionId, event);
          captureLog.push({ eventNumber: eventCount, timestamp: new Date() });

          // Rapidly revoke after 7 events
          if (eventCount === 7) {
            await permissionManager.revokePermission('Read');
            mockSDK.addError(new PermissionRevokedError('Rapid revocation test'));
            break;
          }
        }
      })();

      await expect(streamPromise).rejects.toThrow();

      const partialResult = await partialResultsController.markAsInterrupted(
        sessionId,
        'Rapid revocation test'
      );

      // Verify rapid capture worked correctly
      expect(partialResult.capturedEvents.length).toBe(7);
      expect(partialResult.isIncomplete).toBe(true);
      expect(partialResult.completionStatus.completionPercentage).toBeLessThan(50);

      // Verify temporal consistency
      expect(captureLog).toHaveLength(7);
      for (let i = 1; i < captureLog.length; i++) {
        expect(captureLog[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          captureLog[i - 1].timestamp.getTime()
        );
      }
    });
  });

  // ==========================================================================
  // AC2: Partial results are properly marked as incomplete
  // ==========================================================================
  describe('AC2: Partial results are properly marked as incomplete', () => {
    it('should mark partial results with incomplete status and metadata', async () => {
      await permissionManager.grantPermission('Edit', undefined, 'allow-always');

      const streamingEvents = new StreamingResponseBuilder()
        .addTextChunk('Starting edit workflow...', 10)
        .addToolUse('edit-1', 'Edit', {
          file_path: '/src/utils.ts',
          old_str: 'function old()',
          new_str: 'function new()'
        }, 10)
        .addTextChunk('Edit 1 complete, proceeding to edit 2...', 10)
        .addToolUse('edit-2', 'Edit', {
          file_path: '/src/utils.ts',
          old_str: 'const old = 1',
          new_str: 'const new = 2'
        }, 10)
        .addTextChunk('All edits complete', 10)
        .build();

      mockSDK.addStreamingResponse(streamingEvents);

      const sessionId = 'incomplete-marking-test';
      await partialResultsController.startCapture(sessionId, streamingEvents.length);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Edit'] });
        let count = 0;
        for await (const event of iterator) {
          count++;
          partialResultsController.captureEvent(sessionId, event);

          // Revoke after first edit completes
          if (count === 3) {
            setTimeout(async () => {
              await permissionManager.revokePermission('Edit');
              mockSDK.addError(new PermissionRevokedError('Permission revoked during editing'));
            }, 5);
          }
        }
      })();

      await expect(streamPromise).rejects.toThrow();

      const partialResult = await partialResultsController.markAsInterrupted(
        sessionId,
        'Permission revoked during multi-edit workflow',
        'Edit'
      );

      // Verify incomplete marking
      expect(partialResult.isIncomplete).toBe(true);
      expect(partialResult.interruptionReason).toBe('Permission revoked during multi-edit workflow');

      // Verify completion metadata
      expect(partialResult.completionStatus.eventsCaptured).toBe(3);
      expect(partialResult.completionStatus.eventsExpected).toBe(streamingEvents.length);
      expect(partialResult.completionStatus.completionPercentage).toBe(60); // 3/5 * 100

      // Verify recovery metadata
      expect(partialResult.recoveryMetadata).toBeDefined();
      expect(partialResult.recoveryMetadata?.stateSnapshot?.revokedTool).toBe('Edit');
      expect(partialResult.recoveryMetadata?.stateSnapshot?.interruptionPoint).toBe(3);

      // Verify summary artifact is created
      expect(partialResult.capturedArtifacts).toHaveLength(1);
      const summaryArtifact = partialResult.capturedArtifacts[0];
      expect(summaryArtifact.name).toBe('Partial Results Summary');
      expect(summaryArtifact.type).toBe('report');
      expect(summaryArtifact.content).toContain('INCOMPLETE');
      expect(summaryArtifact.content).toContain('60.0%');

      // Verify warning log is created
      expect(partialResult.capturedLogs).toHaveLength(1);
      const logEntry = partialResult.capturedLogs[0];
      expect(logEntry.level).toBe('warn');
      expect(logEntry.message).toContain('Task interrupted');
      expect(logEntry.message).toContain('60.0%');
      expect(logEntry.metadata?.revokedTool).toBe('Edit');
    });

    it('should differentiate between complete and incomplete tool executions', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      const streamingEvents = new StreamingResponseBuilder()
        .addToolUse('write-start', 'Write', { path: '/file1.txt', content: 'Starting...' }, 5)
        .addTextChunk('Write operation in progress...', 5) // This simulates tool_result
        .addToolUse('write-continue', 'Write', { path: '/file2.txt', content: 'Continuing...' }, 5)
        // Note: No tool_result for write-continue - it will be incomplete
        .build();

      mockSDK.addStreamingResponse(streamingEvents);

      const sessionId = 'tool-completion-test';
      await partialResultsController.startCapture(sessionId, streamingEvents.length);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Write'] });
        let count = 0;
        for await (const event of iterator) {
          count++;
          partialResultsController.captureEvent(sessionId, event);

          // Revoke after second tool_use but before its completion
          if (count === 3) {
            setTimeout(async () => {
              await permissionManager.revokePermission('Write');
              mockSDK.addError(new PermissionRevokedError('Permission revoked'));
            }, 5);
          }
        }
      })();

      await expect(streamPromise).rejects.toThrow();

      const partialResult = await partialResultsController.markAsInterrupted(
        sessionId,
        'Permission revoked during tool execution'
      );

      // Verify tool execution tracking
      expect(partialResult.completedToolExecutions.length).toBe(2);

      // First tool execution is tracked but not marked complete (no tool_result captured)
      const firstExecution = partialResult.completedToolExecutions.find(e => e.toolName === 'Write' && e.input.path === '/file1.txt');
      expect(firstExecution).toBeDefined();
      expect(firstExecution?.completed).toBe(false); // No tool_result was captured

      // Second tool execution is tracked and not complete
      const secondExecution = partialResult.completedToolExecutions.find(e => e.toolName === 'Write' && e.input.path === '/file2.txt');
      expect(secondExecution).toBeDefined();
      expect(secondExecution?.completed).toBe(false);

      // Verify summary reflects incomplete state
      expect(partialResult.capturedArtifacts[0].content).toContain('Tool Executions: 0'); // 0 completed
    });

    it('should preserve timestamp and causation metadata for interruption', async () => {
      await permissionManager.grantPermission('Bash', undefined, 'allow-always');

      const streamingEvents = new StreamingResponseBuilder()
        .addTextChunk('Executing bash commands...', 10)
        .addToolUse('bash-1', 'Bash', { command: 'ls -la' }, 10)
        .addTextChunk('Command executed, running next...', 10)
        .build();

      mockSDK.addStreamingResponse(streamingEvents);

      const sessionId = 'metadata-test';
      const startTime = new Date();

      await partialResultsController.startCapture(sessionId, streamingEvents.length);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Bash'] });
        let count = 0;
        for await (const event of iterator) {
          count++;
          partialResultsController.captureEvent(sessionId, event);

          if (count === 2) {
            setTimeout(async () => {
              await permissionManager.revokePermission('Bash');
              mockSDK.addError(new PermissionRevokedError('Permission revoked'));
            }, 5);
          }
        }
      })();

      await expect(streamPromise).rejects.toThrow();

      const interruptTime = new Date();
      const partialResult = await partialResultsController.markAsInterrupted(
        sessionId,
        'Permission revoked for security reasons',
        'Bash'
      );

      // Verify timing metadata
      expect(partialResult.interruptedAt.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      expect(partialResult.interruptedAt.getTime()).toBeLessThanOrEqual(interruptTime.getTime());

      // Verify causation metadata
      expect(partialResult.interruptionReason).toBe('Permission revoked for security reasons');
      expect(partialResult.recoveryMetadata?.stateSnapshot?.revokedTool).toBe('Bash');

      // Verify each captured event has timestamp
      partialResult.capturedEvents.forEach(event => {
        expect(event.capturedAt).toBeInstanceOf(Date);
        expect(event.capturedAt.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      });
    });
  });

  // ==========================================================================
  // AC3: Partial results can be retrieved after interruption
  // ==========================================================================
  describe('AC3: Partial results can be retrieved after interruption', () => {
    it('should allow retrieval of partial results by session ID', async () => {
      await permissionManager.grantPermission('Read', undefined, 'allow-always');

      const streamingEvents = new StreamingResponseBuilder()
        .addTextChunk('Reading configuration...', 10)
        .addToolUse('read-config', 'Read', { file_path: '/config.json' }, 10)
        .addTextChunk('Processing configuration...', 10)
        .build();

      mockSDK.addStreamingResponse(streamingEvents);

      const sessionId = 'retrieval-test-123';
      await partialResultsController.startCapture(sessionId, streamingEvents.length);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Read'] });
        let count = 0;
        for await (const event of iterator) {
          count++;
          partialResultsController.captureEvent(sessionId, event);

          if (count === 2) {
            setTimeout(async () => {
              await permissionManager.revokePermission('Read');
              mockSDK.addError(new PermissionRevokedError('Permission revoked'));
            }, 5);
          }
        }
      })();

      await expect(streamPromise).rejects.toThrow();

      await partialResultsController.markAsInterrupted(sessionId, 'Test interruption');

      // Test retrieval by session ID
      const retrievedResult = partialResultsController.getPartialResults(sessionId);
      expect(retrievedResult).toBeDefined();
      expect(retrievedResult?.id).toBe(sessionId);
      expect(retrievedResult?.capturedEvents.length).toBe(2);
      expect(retrievedResult?.isIncomplete).toBe(true);

      // Test retrieval of non-existent session
      const nonExistentResult = partialResultsController.getPartialResults('non-existent-session');
      expect(nonExistentResult).toBeUndefined();
    });

    it('should support retrieval of multiple partial result sets', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');
      await permissionManager.grantPermission('Edit', undefined, 'allow-always');

      // Create two different streaming scenarios
      const writeStreamEvents = new StreamingResponseBuilder()
        .addTextChunk('Write workflow starting...', 5)
        .addToolUse('write-1', 'Write', { path: '/file1.txt', content: 'content1' }, 5)
        .build();

      const editStreamEvents = new StreamingResponseBuilder()
        .addTextChunk('Edit workflow starting...', 5)
        .addToolUse('edit-1', 'Edit', { file_path: '/file2.txt', old_str: 'old', new_str: 'new' }, 5)
        .build();

      // First session
      mockSDK.addStreamingResponse(writeStreamEvents);
      const sessionId1 = 'multi-session-1';
      await partialResultsController.startCapture(sessionId1, writeStreamEvents.length);

      const stream1Promise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Write'] });
        let count = 0;
        for await (const event of iterator) {
          count++;
          partialResultsController.captureEvent(sessionId1, event);
          if (count === 1) {
            setTimeout(async () => {
              await permissionManager.revokePermission('Write');
              mockSDK.addError(new PermissionRevokedError('Write permission revoked'));
            }, 5);
          }
        }
      })();

      await expect(stream1Promise).rejects.toThrow();
      await partialResultsController.markAsInterrupted(sessionId1, 'Write tool revoked');

      // Second session (reset permission first)
      await permissionManager.grantPermission('Edit', undefined, 'allow-always');
      mockSDK.reset();
      mockSDK.addStreamingResponse(editStreamEvents);

      const sessionId2 = 'multi-session-2';
      await partialResultsController.startCapture(sessionId2, editStreamEvents.length);

      const stream2Promise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Edit'] });
        let count = 0;
        for await (const event of iterator) {
          count++;
          partialResultsController.captureEvent(sessionId2, event);
          if (count === 1) {
            setTimeout(async () => {
              await permissionManager.revokePermission('Edit');
              mockSDK.addError(new PermissionRevokedError('Edit permission revoked'));
            }, 5);
          }
        }
      })();

      await expect(stream2Promise).rejects.toThrow();
      await partialResultsController.markAsInterrupted(sessionId2, 'Edit tool revoked');

      // Retrieve all partial results
      const allResults = partialResultsController.getAllPartialResults();
      expect(allResults).toHaveLength(2);

      // Verify individual retrieval
      const result1 = partialResultsController.getPartialResults(sessionId1);
      const result2 = partialResultsController.getPartialResults(sessionId2);

      expect(result1?.id).toBe(sessionId1);
      expect(result1?.interruptionReason).toBe('Write tool revoked');

      expect(result2?.id).toBe(sessionId2);
      expect(result2?.interruptionReason).toBe('Edit tool revoked');

      // Verify they captured different tool executions
      const result1Tool = result1?.completedToolExecutions[0]?.toolName;
      const result2Tool = result2?.completedToolExecutions[0]?.toolName;
      expect(result1Tool).toBe('Write');
      expect(result2Tool).toBe('Edit');
    });

    it('should provide detailed recovery information for resumption', async () => {
      await permissionManager.grantPermission('Bash', undefined, 'allow-always');

      const complexStreamingEvents = new StreamingResponseBuilder()
        .addTextChunk('Starting complex multi-stage workflow...', 10)
        .addTextChunk('Stage 1: Environment setup', 10)
        .addToolUse('setup', 'Bash', { command: 'mkdir -p /tmp/workspace' }, 10)
        .addTextChunk('Stage 2: Implementation phase beginning...', 10)
        .addToolUse('impl-start', 'Bash', { command: 'echo "implementation" > /tmp/workspace/status.txt' }, 10)
        .addTextChunk('Stage 2: Implementation continuing...', 10)
        .addToolUse('impl-continue', 'Bash', { command: 'ls -la /tmp/workspace' }, 10)
        .addTextChunk('Stage 3: Testing phase', 10)
        .build();

      mockSDK.addStreamingResponse(complexStreamingEvents);

      const sessionId = 'recovery-info-test';
      await partialResultsController.startCapture(sessionId, complexStreamingEvents.length);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Bash'] });
        let count = 0;
        for await (const event of iterator) {
          count++;
          partialResultsController.captureEvent(sessionId, event);

          // Interrupt during implementation phase
          if (count === 6) {
            setTimeout(async () => {
              await permissionManager.revokePermission('Bash');
              mockSDK.addError(new PermissionRevokedError('Permission revoked'));
            }, 5);
          }
        }
      })();

      await expect(streamPromise).rejects.toThrow();

      const partialResult = await partialResultsController.markAsInterrupted(
        sessionId,
        'Interrupted during implementation phase'
      );

      // Verify detailed recovery information
      expect(partialResult.recoveryMetadata).toBeDefined();
      expect(partialResult.recoveryMetadata?.lastCompletedStage).toBe('implementation');
      expect(partialResult.recoveryMetadata?.nextStepIndex).toBe(6);

      // Verify state snapshot contains useful information
      expect(partialResult.recoveryMetadata?.stateSnapshot).toBeDefined();
      expect(partialResult.recoveryMetadata?.stateSnapshot?.revokedTool).toBe('Bash');
      expect(partialResult.recoveryMetadata?.stateSnapshot?.interruptionPoint).toBe(6);
      expect(partialResult.recoveryMetadata?.stateSnapshot?.totalExpected).toBe(complexStreamingEvents.length);

      // Verify conversation snapshot preserves context
      expect(partialResult.conversationSnapshot.length).toBeGreaterThan(0);

      // Find implementation phase messages
      const implementationMessages = partialResult.conversationSnapshot.filter(msg =>
        msg.content?.some(content =>
          content.type === 'text' && content.text?.includes('implementation')
        )
      );
      expect(implementationMessages.length).toBeGreaterThan(0);

      // Verify completed work can be identified
      const completedSetupWork = partialResult.completedToolExecutions.find(exec =>
        exec.toolName === 'Bash' && exec.input.command?.includes('mkdir')
      );
      expect(completedSetupWork).toBeDefined();

      // Verify summary provides actionable recovery information
      const summary = partialResult.capturedArtifacts[0].content;
      expect(summary).toContain('Last Completed Stage: implementation');
      expect(summary).toContain('Next Step Index: 6');
      expect(summary).toContain('COMPLETED TOOL EXECUTIONS');
    });

    it('should maintain retrieval performance with large result sets', async () => {
      // Create multiple sessions with substantial data
      const sessionCount = 10;
      const eventsPerSession = 50;

      for (let i = 0; i < sessionCount; i++) {
        await permissionManager.grantPermission('Write', undefined, 'allow-always');

        // Create large streaming response
        const builder = new StreamingResponseBuilder();
        for (let j = 0; j < eventsPerSession; j++) {
          builder.addTextChunk(`Event ${j} in session ${i}`, 1);
        }
        const events = builder.build();

        mockSDK.addStreamingResponse(events);

        const sessionId = `perf-test-session-${i}`;
        await partialResultsController.startCapture(sessionId, events.length);

        const streamPromise = (async () => {
          const iterator = await mockSDK.mockQuery({ tools: ['Write'] });
          let count = 0;
          for await (const event of iterator) {
            count++;
            partialResultsController.captureEvent(sessionId, event);

            // Interrupt each session halfway through
            if (count === Math.floor(eventsPerSession / 2)) {
              setTimeout(async () => {
                await permissionManager.revokePermission('Write');
                mockSDK.addError(new PermissionRevokedError('Performance test interruption'));
              }, 1);
            }
          }
        })();

        await expect(streamPromise).rejects.toThrow();
        await partialResultsController.markAsInterrupted(sessionId, `Performance test session ${i}`);

        // Re-grant permission for next iteration
        mockSDK.reset();
      }

      // Test retrieval performance
      const retrievalStart = Date.now();

      // Get all results
      const allResults = partialResultsController.getAllPartialResults();
      expect(allResults).toHaveLength(sessionCount);

      // Get individual results
      for (let i = 0; i < sessionCount; i++) {
        const sessionId = `perf-test-session-${i}`;
        const result = partialResultsController.getPartialResults(sessionId);
        expect(result).toBeDefined();
        expect(result?.capturedEvents.length).toBe(Math.floor(eventsPerSession / 2));
      }

      const retrievalEnd = Date.now();
      const retrievalTime = retrievalEnd - retrievalStart;

      // Performance assertion - should handle 10 sessions with 25 events each quickly
      expect(retrievalTime).toBeLessThan(1000); // Less than 1 second

      // Verify data integrity
      const firstSessionResult = partialResultsController.getPartialResults('perf-test-session-0');
      expect(firstSessionResult?.isIncomplete).toBe(true);
      expect(firstSessionResult?.completionStatus.completionPercentage).toBe(50);
    });
  });

  // ==========================================================================
  // Integration Tests: End-to-end partial results scenarios
  // ==========================================================================
  describe('Integration: End-to-end partial results scenarios', () => {
    it('should demonstrate complete partial results workflow', async () => {
      // This test demonstrates all acceptance criteria in a single comprehensive workflow
      await permissionManager.grantPermission('Write', undefined, 'allow-always');
      await permissionManager.grantPermission('Edit', undefined, 'allow-always');

      const fullWorkflowEvents = new StreamingResponseBuilder()
        .addTextChunk('=== Multi-Tool Development Workflow ===', 5)
        .addTextChunk('Phase 1: Initial file creation', 5)
        .addToolUse('create-base', 'Write', {
          path: '/src/feature.ts',
          content: 'export class Feature {\n  constructor() {}\n}'
        }, 5)
        .addTextChunk('Phase 2: Adding functionality', 5)
        .addToolUse('add-method', 'Edit', {
          file_path: '/src/feature.ts',
          old_str: '  constructor() {}',
          new_str: '  constructor() {}\n\n  public execute(): void {\n    console.log("executing");\n  }'
        }, 5)
        .addTextChunk('Phase 3: Creating tests', 5)
        .addToolUse('create-tests', 'Write', {
          path: '/tests/feature.test.ts',
          content: 'import { Feature } from "../src/feature";\n\ndescribe("Feature", () => {\n  it("should execute", () => {\n    const f = new Feature();\n    f.execute();\n  });\n});'
        }, 5)
        .addTextChunk('Phase 4: Final refinements', 5)
        .addToolUse('refine', 'Edit', {
          file_path: '/src/feature.ts',
          old_str: 'console.log("executing");',
          new_str: 'console.log("Feature is executing successfully");'
        }, 5)
        .addTextChunk('=== Workflow Complete ===', 5)
        .addUsage(2000, 1000)
        .build();

      mockSDK.addStreamingResponse(fullWorkflowEvents);

      const sessionId = 'end-to-end-demo';
      const eventLog: Array<{ type: string; timestamp: Date; details: any }> = [];

      // Track events from partial results controller
      partialResultsController.on('capture:started', (data) => {
        eventLog.push({ type: 'capture:started', timestamp: new Date(), details: data });
      });

      partialResultsController.on('event:captured', (data) => {
        eventLog.push({ type: 'event:captured', timestamp: new Date(), details: data });
      });

      partialResultsController.on('capture:completed', (data) => {
        eventLog.push({ type: 'capture:completed', timestamp: new Date(), details: data });
      });

      await partialResultsController.startCapture(sessionId, fullWorkflowEvents.length);

      let processedEvents = 0;
      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Write', 'Edit'] });
        for await (const event of iterator) {
          processedEvents++;
          partialResultsController.captureEvent(sessionId, event);

          // Interrupt during Phase 3 (after creating base file and editing, during test creation)
          if (processedEvents === 7) { // After creating tests, before final refinements
            setTimeout(async () => {
              // Revoke Edit permission specifically
              await permissionManager.revokePermission('Edit');
              mockSDK.addError(new PermissionRevokedError('Edit permission revoked for security review'));
            }, 10);
          }
        }
      })();

      // AC1: Verify stream is interrupted and partial results captured
      await expect(streamPromise).rejects.toThrow(PermissionRevokedError);

      const partialResult = await partialResultsController.markAsInterrupted(
        sessionId,
        'Edit permission revoked during security review',
        'Edit'
      );

      // AC1: Verify partial results were captured before termination
      expect(partialResult.capturedEvents.length).toBe(7);
      expect(partialResult.capturedEvents.length).toBeLessThan(fullWorkflowEvents.length);
      expect(partialResult.completionStatus.eventsCaptured).toBe(7);
      expect(partialResult.completionStatus.eventsExpected).toBe(fullWorkflowEvents.length);

      // Verify we captured the important work
      const createBaseExecution = partialResult.completedToolExecutions.find(exec =>
        exec.toolName === 'Write' && exec.input.path === '/src/feature.ts'
      );
      expect(createBaseExecution).toBeDefined();

      const editMethodExecution = partialResult.completedToolExecutions.find(exec =>
        exec.toolName === 'Edit' && exec.input.file_path === '/src/feature.ts'
      );
      expect(editMethodExecution).toBeDefined();

      const createTestsExecution = partialResult.completedToolExecutions.find(exec =>
        exec.toolName === 'Write' && exec.input.path === '/tests/feature.test.ts'
      );
      expect(createTestsExecution).toBeDefined();

      // AC2: Verify partial results are properly marked as incomplete
      expect(partialResult.isIncomplete).toBe(true);
      expect(partialResult.interruptionReason).toBe('Edit permission revoked during security review');
      expect(partialResult.completionStatus.completionPercentage).toBeLessThan(100);

      // Verify incomplete status is reflected in summary
      const summary = partialResult.capturedArtifacts[0].content;
      expect(summary).toContain('Status: INCOMPLETE');
      expect(summary).toContain('Edit permission revoked during security review');
      expect(summary).toContain('Tool Executions: 0'); // No completed tool_results captured

      // Verify log entry indicates incompleteness
      const logEntry = partialResult.capturedLogs[0];
      expect(logEntry.level).toBe('warn');
      expect(logEntry.message).toContain('Task interrupted');
      expect(logEntry.metadata?.revokedTool).toBe('Edit');

      // AC3: Verify partial results can be retrieved after interruption
      const retrievedResult = partialResultsController.getPartialResults(sessionId);
      expect(retrievedResult).toBeDefined();
      expect(retrievedResult?.id).toBe(sessionId);

      // Verify retrieval gives access to all captured data
      expect(retrievedResult?.capturedEvents.length).toBe(7);
      expect(retrievedResult?.completedToolExecutions.length).toBe(3); // 3 tool uses were captured
      expect(retrievedResult?.conversationSnapshot.length).toBeGreaterThan(0);

      // Verify recovery information is available
      expect(retrievedResult?.recoveryMetadata).toBeDefined();
      expect(retrievedResult?.recoveryMetadata?.lastCompletedStage).toBeDefined();
      expect(retrievedResult?.recoveryMetadata?.nextStepIndex).toBe(7);

      // Verify the partial results show what work was completed vs what remains
      const completedPhases = retrievedResult?.conversationSnapshot.filter(msg =>
        msg.content?.some(content =>
          content.type === 'text' &&
          (content.text?.includes('Phase 1') ||
           content.text?.includes('Phase 2') ||
           content.text?.includes('Phase 3'))
        )
      );
      expect(completedPhases?.length).toBeGreaterThan(0);

      // Verify event tracking consistency
      const captureStartEvent = eventLog.find(e => e.type === 'capture:started');
      const captureCompleteEvent = eventLog.find(e => e.type === 'capture:completed');
      const captureEvents = eventLog.filter(e => e.type === 'event:captured');

      expect(captureStartEvent).toBeDefined();
      expect(captureCompleteEvent).toBeDefined();
      expect(captureEvents.length).toBe(7);

      // Verify temporal consistency
      expect(captureCompleteEvent!.timestamp.getTime()).toBeGreaterThan(captureStartEvent!.timestamp.getTime());

      // Verify all acceptance criteria are met:
      console.log('=== ACCEPTANCE CRITERIA VERIFICATION ===');
      console.log(`✓ AC1: Captured ${partialResult.capturedEvents.length} events before termination`);
      console.log(`✓ AC2: Results marked incomplete with ${partialResult.completionStatus.completionPercentage.toFixed(1)}% completion`);
      console.log(`✓ AC3: Results retrievable with ID '${retrievedResult?.id}' and ${retrievedResult?.capturedEvents.length} events`);
    });
  });
});