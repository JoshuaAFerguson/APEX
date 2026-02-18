/**
 * Graceful Termination of In-Flight Requests when Permissions are Revoked
 *
 * This test suite verifies that when permissions are revoked during an active Claude SDK
 * streaming session, in-flight requests are terminated gracefully rather than abruptly killed.
 *
 * Acceptance Criteria:
 * 1. In-flight Claude SDK requests are terminated gracefully (not abruptly killed)
 * 2. Proper cleanup occurs (no hanging connections)
 * 3. Termination emits appropriate events
 *
 * @see ADR-055-graceful-termination-in-flight-requests-tests.md
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { EventEmitter } from 'eventemitter3';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { MockClaudeAgentSDK } from './mocks/claude-agent-sdk';
import { PermissionRevokedError } from '@apexcli/core';
import type { StreamingEvent } from './mocks/claude-agent-sdk.types';

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
    // For fake timers, advance time and wait for promise resolution
    await vi.advanceTimersByTimeAsync(ms);
  } else {
    // For real timers, use actual setTimeout
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Enhanced permission revocation simulator for testing graceful termination
 */
class GracefulTerminationController extends EventEmitter {
  private permissionManager: PermissionManager;
  private mockSDK: MockClaudeAgentSDK;
  private activeStreams = new Set<string>();
  private cleanupLog: Array<{
    timestamp: Date;
    action: string;
    streamId: string;
    success: boolean;
  }> = [];

  constructor(permissionManager: PermissionManager, mockSDK: MockClaudeAgentSDK) {
    super();
    this.permissionManager = permissionManager;
    this.mockSDK = mockSDK;
  }

  async revokePermissionDuringStream(tool: string, streamId: string): Promise<void> {
    // Revoke the permission
    const wasRevoked = await this.permissionManager.revokePermission(tool);

    // Gracefully terminate the stream if it's active
    if (this.activeStreams.has(streamId)) {
      // Configure the SDK to throw a graceful termination error on next iteration
      this.mockSDK.addError(new PermissionRevokedError('Request aborted due to permission revocation'));

      // Emit termination events
      this.emit('stream:terminated', {
        streamId,
        tool,
        method: 'graceful',
        timestamp: new Date()
      });

      // Perform cleanup
      await this.cleanupStream(streamId);
    }

    this.emit('permission:revoked', {
      tool,
      wasRevoked,
      timestamp: new Date(),
      affectedStreams: Array.from(this.activeStreams)
    });
  }

  async startStream(streamId: string): Promise<void> {
    this.activeStreams.add(streamId);
    this.emit('stream:started', {
      streamId,
      timestamp: new Date()
    });
  }

  async cleanupStream(streamId: string): Promise<void> {
    try {
      // Simulate connection cleanup with immediate promise resolution in tests
      await new Promise(resolve => {
        if (vi.isFakeTimers()) {
          // Use immediate resolution when using fake timers
          resolve(undefined);
        } else {
          setTimeout(resolve, 5);
        }
      });

      this.activeStreams.delete(streamId);
      this.cleanupLog.push({
        timestamp: new Date(),
        action: 'cleanup_connection',
        streamId,
        success: true
      });

      this.emit('stream:cleanup:complete', {
        streamId,
        timestamp: new Date()
      });

    } catch (error: any) {
      this.cleanupLog.push({
        timestamp: new Date(),
        action: 'cleanup_connection',
        streamId,
        success: false
      });

      this.emit('stream:cleanup:failed', {
        streamId,
        error: error?.message || String(error),
        timestamp: new Date()
      });
    }
  }

  getActiveStreams() {
    return Array.from(this.activeStreams);
  }

  getCleanupLog() {
    return this.cleanupLog;
  }

  reset() {
    this.activeStreams.clear();
    this.cleanupLog = [];
    this.removeAllListeners();
  }
}

describe('Graceful Termination of In-Flight Requests', () => {
  let testDir: string;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let mockSDK: MockClaudeAgentSDK;
  let terminationController: GracefulTerminationController;

  beforeAll(() => {
    // Use fake timers for reliable test timing
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `apex-graceful-termination-test-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    mkdirSync(testDir, { recursive: true });

    // Initialize stores and manager
    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);

    // Reset and use the module-level mock SDK
    mockSDKInstance.reset();
    mockSDK = mockSDKInstance;
    terminationController = new GracefulTerminationController(permissionManager, mockSDK);
  });

  afterEach(async () => {
    try {
      if (permissionStore) {
        permissionStore.close();
      }
    } catch (error) {
      console.warn('Error closing permission store:', error);
    }

    try {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Error cleaning up test directory:', error);
    }

    if (terminationController) {
      terminationController.reset();
    }

    if (mockSDK) {
      mockSDK.reset();
    }

    vi.resetAllMocks();
    vi.clearAllTimers();
  });

  // ==========================================================================
  // AC1: In-flight Claude SDK requests are terminated gracefully
  // ==========================================================================
  describe('AC1: In-flight requests terminated gracefully', () => {
    it('should terminate streaming request gracefully when permission is revoked', async () => {
      // Setup: Grant permission and create streaming events
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      const streamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Starting write operation...' }] } },
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', id: 'call-1', input: { path: '/tmp/test.txt', content: 'hello' } }] } },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Write operation in progress...' }] } },
      ];

      mockSDK.addStreamingEvents(streamingEvents);

      const streamId = 'test-stream-1';
      await terminationController.startStream(streamId);

      // Start the stream processing
      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Write'] });
        const events = [];
        for await (const event of iterator) {
          events.push(event);
        }
        return events;
      })();

      // Wait a bit for stream to start
      await testDelay(20);
      expect(mockSDK.isCurrentlyStreaming()).toBe(true);

      // Revoke permission mid-stream
      await terminationController.revokePermissionDuringStream('Write', streamId);

      // Verify the stream terminates gracefully with a catchable error
      await expect(streamPromise).rejects.toThrow(PermissionRevokedError);

      // Verify termination was graceful, not abrupt
      const terminations = mockSDK.getTerminations();
      expect(terminations).toHaveLength(1);
      expect(terminations[0].method).toBe('graceful');
      expect(terminations[0].reason).toContain('Permission revoked for Write');
    });

    it('should handle multiple concurrent streams gracefully when permissions revoked', async () => {
      // Setup: Grant permissions for multiple tools
      await permissionManager.grantPermission('Read', undefined, 'allow-always');
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      const streamEvents1 = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', id: 'read-1', input: { path: '/tmp/input.txt' } }] } },
      ];

      const streamEvents2 = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', id: 'write-1', input: { path: '/tmp/output.txt', content: 'data' } }] } },
      ];

      // Create multiple stream controllers
      const mockSDK1 = new MockClaudeAgentSDK();
      const mockSDK2 = new MockClaudeAgentSDK();
      mockSDK1.addStreamingEvents(streamEvents1);
      mockSDK2.addStreamingEvents(streamEvents2);

      const controller1 = new GracefulTerminationController(permissionManager, mockSDK1);
      const controller2 = new GracefulTerminationController(permissionManager, mockSDK2);

      // Start both streams
      await controller1.startStream('stream-1');
      await controller2.startStream('stream-2');

      const stream1Promise = (async () => {
        const iterator = await mockSDK1.mockQuery({ tools: ['Read'] });
        for await (const event of iterator) {
          // Process events
        }
      })();

      const stream2Promise = (async () => {
        const iterator = await mockSDK2.mockQuery({ tools: ['Write'] });
        for await (const event of iterator) {
          // Process events
        }
      })();

      await testDelay(20);

      // Revoke Write permission - should only affect stream 2
      await controller2.revokePermissionDuringStream('Write', 'stream-2');

      // Stream 1 should complete successfully
      await expect(stream1Promise).resolves.not.toThrow();

      // Stream 2 should terminate gracefully
      await expect(stream2Promise).rejects.toThrow(PermissionRevokedError);

      // Verify only stream 2 was terminated
      expect(mockSDK1.getTerminations()).toHaveLength(0);
      expect(mockSDK2.getTerminations()).toHaveLength(1);
      expect(mockSDK2.getTerminations()[0].method).toBe('graceful');

      controller1.reset();
      controller2.reset();
    });

    it('should emit proper termination events when request is aborted', async () => {
      await permissionManager.grantPermission('Bash', undefined, 'allow-always');

      const streamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', id: 'exec-1', input: { command: 'long-running-process' } }] } },
      ];

      mockSDK.addStreamingEvents(streamingEvents);

      const streamId = 'bash-stream';
      const eventLog: Array<{ event: string; data: any }> = [];

      // Track termination events
      terminationController.on('stream:terminated', (data) => {
        eventLog.push({ event: 'stream:terminated', data });
      });

      terminationController.on('permission:revoked', (data) => {
        eventLog.push({ event: 'permission:revoked', data });
      });

      await terminationController.startStream(streamId);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Bash'] });
        for await (const event of iterator) {
          // Process stream
        }
      })();

      await testDelay(15);

      // Revoke permission
      await terminationController.revokePermissionDuringStream('Bash', streamId);

      await expect(streamPromise).rejects.toThrow(PermissionRevokedError);

      // Verify events were emitted
      expect(eventLog).toHaveLength(2);
      expect(eventLog[0].event).toBe('stream:terminated');
      expect(eventLog[0].data.method).toBe('graceful');
      expect(eventLog[0].data.tool).toBe('Bash');
      expect(eventLog[1].event).toBe('permission:revoked');
      expect(eventLog[1].data.tool).toBe('Bash');
    });

    it('should throw PermissionRevokedError with correct properties', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      const streamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', id: 'write-1', input: { path: '/test.txt', content: 'test' } }] } },
      ];

      mockSDK.addStreamingEvents(streamingEvents);

      const streamId = 'error-properties-test';
      await terminationController.startStream(streamId);

      let caughtError: any = null;

      const streamPromise = (async () => {
        try {
          const iterator = await mockSDK.mockQuery({ tools: ['Write'] });
          for await (const event of iterator) {
            // Process events
          }
        } catch (error) {
          caughtError = error;
          throw error;
        }
      })();

      await testDelay(15);
      await terminationController.revokePermissionDuringStream('Write', streamId);

      await expect(streamPromise).rejects.toThrow(PermissionRevokedError);

      // Verify the error has the correct properties
      expect(caughtError).toBeInstanceOf(PermissionRevokedError);
      expect(caughtError.code).toBe('PERMISSION_REVOKED');
      expect(caughtError.name).toBe('PermissionRevokedError');
      expect(caughtError.message).toContain('Request aborted due to permission revocation');
    });
  });

  // ==========================================================================
  // AC2: Proper cleanup occurs (no hanging connections)
  // ==========================================================================
  describe('AC2: Proper cleanup occurs', () => {
    it('should clean up connections after graceful termination', async () => {
      await permissionManager.grantPermission('Edit', undefined, 'allow-always');

      const streamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', id: 'edit-1', input: {} }] } },
      ];

      mockSDK.addStreamingEvents(streamingEvents);

      const streamId = 'edit-stream';
      await terminationController.startStream(streamId);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Edit'] });
        for await (const event of iterator) {
          // Process events
        }
      })();

      await testDelay(15);

      // Verify stream is active
      expect(terminationController.getActiveStreams()).toContain(streamId);

      await terminationController.revokePermissionDuringStream('Edit', streamId);

      await expect(streamPromise).rejects.toThrow();

      // Wait for cleanup to complete
      await testDelay(20);

      // Verify cleanup occurred
      expect(terminationController.getActiveStreams()).not.toContain(streamId);

      const cleanupLog = terminationController.getCleanupLog();
      expect(cleanupLog).toHaveLength(1);
      expect(cleanupLog[0].action).toBe('cleanup_connection');
      expect(cleanupLog[0].success).toBe(true);
      expect(cleanupLog[0].streamId).toBe(streamId);
    });

    it('should handle cleanup failures gracefully', async () => {
      await permissionManager.grantPermission('Glob', undefined, 'allow-always');

      const streamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Glob', id: 'glob-1', input: {} }] } },
      ];

      mockSDK.addStreamingEvents(streamingEvents);

      const streamId = 'glob-stream';

      // Mock cleanup failure by overriding the cleanup method
      const originalCleanup = terminationController.cleanupStream;
      terminationController.cleanupStream = async (id: string) => {
        throw new Error('Cleanup failed');
      };

      const cleanupEvents: Array<any> = [];
      terminationController.on('stream:cleanup:failed', (data) => {
        cleanupEvents.push(data);
      });

      await terminationController.startStream(streamId);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Glob'] });
        for await (const event of iterator) {
          // Process stream
        }
      })();

      await testDelay(15);
      await terminationController.revokePermissionDuringStream('Glob', streamId);

      await expect(streamPromise).rejects.toThrow();

      // Wait for cleanup attempt
      await testDelay(20);

      // Verify cleanup failure was handled
      expect(cleanupEvents).toHaveLength(1);
      expect(cleanupEvents[0].error).toBe('Cleanup failed');

      // Restore original cleanup
      terminationController.cleanupStream = originalCleanup;
    });

    it('should prevent hanging connections during mass revocation', async () => {
      const tools = ['Read', 'Write', 'Edit', 'Bash', 'Glob'];

      // Grant all permissions
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Create multiple active streams
      const streamPromises: Promise<any>[] = [];
      const streamIds: string[] = [];

      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        const streamId = `stream-${tool.toLowerCase()}`;
        streamIds.push(streamId);

        mockSDK.addStreamingEvents([
          { type: 'assistant', message: { content: [{ type: 'tool_use', name: tool, id: `${tool}-call`, input: {} }] } },
        ]);

        await terminationController.startStream(streamId);

        streamPromises.push((async () => {
          const iterator = await mockSDK.mockQuery({ tools: [tool] });
          for await (const event of iterator) {
            // Process events
          }
        })());
      }

      await testDelay(25);

      // Verify all streams are active
      const activeStreams = terminationController.getActiveStreams();
      expect(activeStreams).toHaveLength(tools.length);

      // Revoke all permissions simultaneously
      const revocationPromises = streamIds.map((streamId, index) =>
        terminationController.revokePermissionDuringStream(tools[index], streamId)
      );

      await Promise.all(revocationPromises);

      // All streams should terminate gracefully
      for (const promise of streamPromises) {
        await expect(promise).rejects.toThrow();
      }

      // Wait for all cleanup to complete
      await testDelay(50);

      // Verify no hanging connections
      expect(terminationController.getActiveStreams()).toHaveLength(0);

      const cleanupLog = terminationController.getCleanupLog();
      expect(cleanupLog.filter(entry => entry.success)).toHaveLength(tools.length);
    });

    it('should verify no resource leaks after termination', async () => {
      await permissionManager.grantPermission('Read', undefined, 'allow-always');

      const streamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', id: 'read-1', input: { path: '/test.txt' } }] } },
      ];

      mockSDK.addStreamingEvents(streamingEvents);

      const streamId = 'resource-leak-test';
      await terminationController.startStream(streamId);

      // Track resources before termination
      const initialActiveStreams = terminationController.getActiveStreams().length;
      const initialMockState = mockSDK.getQueryCallHistory().length;

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Read'] });
        for await (const event of iterator) {
          // Process events
        }
      })();

      await testDelay(15);

      // Verify stream is active before termination
      expect(terminationController.getActiveStreams()).toContain(streamId);
      expect(mockSDK.isCurrentlyStreaming()).toBe(true);

      await terminationController.revokePermissionDuringStream('Read', streamId);

      await expect(streamPromise).rejects.toThrow(PermissionRevokedError);

      // Wait for cleanup
      await testDelay(30);

      // Verify no resource leaks
      expect(terminationController.getActiveStreams()).not.toContain(streamId);
      expect(mockSDK.isCurrentlyStreaming()).toBe(false);

      // Verify cleanup was logged
      const cleanupLog = terminationController.getCleanupLog();
      const streamCleanup = cleanupLog.find(entry => entry.streamId === streamId);
      expect(streamCleanup).toBeDefined();
      expect(streamCleanup!.success).toBe(true);

      // Verify mock SDK is in a clean state for subsequent tests
      expect(mockSDK.getTerminations()).toHaveLength(1);
    });
  });

  // ==========================================================================
  // AC3: Termination emits appropriate events
  // ==========================================================================
  describe('AC3: Termination emits appropriate events', () => {
    it('should emit termination events with correct metadata', async () => {
      await permissionManager.grantPermission('Write', 'test-scope', 'allow-always');

      const streamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', id: 'write-call', input: { path: '/test.txt' } }] } },
      ];

      mockSDK.addStreamingEvents(streamingEvents);

      const streamId = 'metadata-test-stream';
      const emittedEvents: Array<{ event: string; data: any; timestamp: Date }> = [];

      // Capture all termination events
      ['stream:terminated', 'permission:revoked', 'stream:cleanup:complete'].forEach(eventName => {
        terminationController.on(eventName, (data) => {
          emittedEvents.push({ event: eventName, data, timestamp: new Date() });
        });
      });

      await terminationController.startStream(streamId);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Write'] });
        for await (const event of iterator) {
          // Process stream
        }
      })();

      await testDelay(15);
      const revocationTime = new Date();
      await terminationController.revokePermissionDuringStream('Write', streamId);

      await expect(streamPromise).rejects.toThrow();
      await testDelay(20);

      // Verify all expected events were emitted
      expect(emittedEvents).toHaveLength(3);

      // Verify stream:terminated event
      const terminatedEvent = emittedEvents.find(e => e.event === 'stream:terminated');
      expect(terminatedEvent).toBeDefined();
      expect(terminatedEvent!.data.streamId).toBe(streamId);
      expect(terminatedEvent!.data.tool).toBe('Write');
      expect(terminatedEvent!.data.method).toBe('graceful');
      expect(terminatedEvent!.data.timestamp).toBeInstanceOf(Date);

      // Verify permission:revoked event
      const revokedEvent = emittedEvents.find(e => e.event === 'permission:revoked');
      expect(revokedEvent).toBeDefined();
      expect(revokedEvent!.data.tool).toBe('Write');
      expect(revokedEvent!.data.wasRevoked).toBe(true);
      expect(revokedEvent!.data.affectedStreams).toContain(streamId);

      // Verify stream:cleanup:complete event
      const cleanupEvent = emittedEvents.find(e => e.event === 'stream:cleanup:complete');
      expect(cleanupEvent).toBeDefined();
      expect(cleanupEvent!.data.streamId).toBe(streamId);
    });

    it('should emit events in correct chronological order', async () => {
      await permissionManager.grantPermission('Bash', undefined, 'allow-always');

      const streamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', id: 'bash-1', input: { command: 'sleep 1' } }] } },
      ];

      mockSDK.addStreamingEvents(streamingEvents);

      const streamId = 'order-test-stream';
      const eventSequence: Array<string> = [];

      // Track event order
      terminationController.on('stream:started', () => eventSequence.push('stream:started'));
      terminationController.on('permission:revoked', () => eventSequence.push('permission:revoked'));
      terminationController.on('stream:terminated', () => eventSequence.push('stream:terminated'));
      terminationController.on('stream:cleanup:complete', () => eventSequence.push('stream:cleanup:complete'));

      await terminationController.startStream(streamId);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Bash'] });
        for await (const event of iterator) {
          // Process events
        }
      })();

      await testDelay(15);
      await terminationController.revokePermissionDuringStream('Bash', streamId);

      await expect(streamPromise).rejects.toThrow();
      await testDelay(25);

      // Verify correct event order
      expect(eventSequence).toEqual([
        'stream:started',
        'stream:terminated',
        'permission:revoked',
        'stream:cleanup:complete'
      ]);
    });

    it('should include correlation IDs and timestamps in events', async () => {
      await permissionManager.grantPermission('Edit', undefined, 'allow-always');

      const streamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', id: 'edit-1', input: {} }] } },
      ];

      mockSDK.addStreamingEvents(streamingEvents);

      const streamId = 'correlation-test-stream';
      let terminationEvent: any;
      let revocationEvent: any;

      terminationController.on('stream:terminated', (data) => {
        terminationEvent = data;
      });

      terminationController.on('permission:revoked', (data) => {
        revocationEvent = data;
      });

      await terminationController.startStream(streamId);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Edit'] });
        for await (const event of iterator) {
          // Process stream
        }
      })();

      await testDelay(15);
      const revocationStartTime = Date.now();
      await terminationController.revokePermissionDuringStream('Edit', streamId);

      await expect(streamPromise).rejects.toThrow();
      await testDelay(20);

      const revocationEndTime = Date.now();

      // Verify timestamp consistency
      expect(terminationEvent.timestamp).toBeInstanceOf(Date);
      expect(revocationEvent.timestamp).toBeInstanceOf(Date);

      const terminationTime = terminationEvent.timestamp.getTime();
      const revocationTime = revocationEvent.timestamp.getTime();

      expect(terminationTime).toBeGreaterThanOrEqual(revocationStartTime);
      expect(terminationTime).toBeLessThanOrEqual(revocationEndTime);
      expect(revocationTime).toBeGreaterThanOrEqual(revocationStartTime);
      expect(revocationTime).toBeLessThanOrEqual(revocationEndTime);

      // Verify correlation data
      expect(terminationEvent.streamId).toBe(streamId);
      expect(revocationEvent.affectedStreams).toContain(streamId);
    });

    it('should emit events with precise timing and sequencing', async () => {
      await permissionManager.grantPermission('Edit', undefined, 'allow-always');

      const streamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', id: 'edit-1', input: {} }] } },
      ];

      mockSDK.addStreamingEvents(streamingEvents);

      const streamId = 'timing-test-stream';
      const eventTimeline: Array<{ event: string; timestamp: number; data?: any }> = [];

      // Track all events with precise timestamps
      ['stream:started', 'stream:terminated', 'permission:revoked', 'stream:cleanup:complete', 'stream:cleanup:failed'].forEach(eventName => {
        terminationController.on(eventName, (data) => {
          eventTimeline.push({
            event: eventName,
            timestamp: Date.now(),
            data
          });
        });
      });

      const startTime = Date.now();
      await terminationController.startStream(streamId);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Edit'] });
        for await (const event of iterator) {
          // Process stream
        }
      })();

      await testDelay(20);
      const revocationTime = Date.now();
      await terminationController.revokePermissionDuringStream('Edit', streamId);

      await expect(streamPromise).rejects.toThrow(PermissionRevokedError);
      await testDelay(25);

      const endTime = Date.now();

      // Verify all expected events were emitted
      expect(eventTimeline).toHaveLength(4); // started, terminated, revoked, cleanup:complete

      // Verify event order (timestamps should be monotonically increasing)
      const timestamps = eventTimeline.map(e => e.timestamp);
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }

      // Verify timing constraints
      const streamStarted = eventTimeline.find(e => e.event === 'stream:started');
      const streamTerminated = eventTimeline.find(e => e.event === 'stream:terminated');
      const permissionRevoked = eventTimeline.find(e => e.event === 'permission:revoked');
      const cleanupComplete = eventTimeline.find(e => e.event === 'stream:cleanup:complete');

      expect(streamStarted!.timestamp).toBeGreaterThanOrEqual(startTime);
      expect(streamTerminated!.timestamp).toBeGreaterThanOrEqual(revocationTime);
      expect(permissionRevoked!.timestamp).toBeGreaterThanOrEqual(revocationTime);
      expect(cleanupComplete!.timestamp).toBeGreaterThan(streamTerminated!.timestamp);
      expect(cleanupComplete!.timestamp).toBeLessThanOrEqual(endTime);

      // Verify event data consistency
      expect(streamTerminated!.data.streamId).toBe(streamId);
      expect(permissionRevoked!.data.tool).toBe('Edit');
      expect(cleanupComplete!.data.streamId).toBe(streamId);
    });
  });

  // ==========================================================================
  // Integration Tests: Real-world scenarios
  // ==========================================================================
  describe('Integration: Real-world termination scenarios', () => {
    it('should handle complex multi-tool workflow termination', async () => {
      // Grant multiple permissions
      const tools = ['Read', 'Write', 'Edit'];
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      const complexStreamingEvents = [
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Starting complex workflow...' }] } },
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', id: 'read-1', input: { path: '/input.txt' } }] } },
        { type: 'tool_result', message: { content: [{ type: 'text', text: 'File content read successfully' }] } },
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', id: 'edit-1', input: { path: '/input.txt', old_str: 'old', new_str: 'new' } }] } },
        { type: 'tool_result', message: { content: [{ type: 'text', text: 'Edit completed' }] } },
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', id: 'write-1', input: { path: '/output.txt', content: 'processed data' } }] } },
      ];

      mockSDK.addStreamingEvents(complexStreamingEvents);

      const streamId = 'complex-workflow-stream';
      const processedEvents: any[] = [];
      const errorEvents: any[] = [];

      terminationController.on('stream:terminated', (data) => {
        errorEvents.push(data);
      });

      await terminationController.startStream(streamId);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools });
        for await (const event of iterator) {
          processedEvents.push(event);

          // Simulate revocation mid-workflow (after Edit tool use)
          if (event.type === 'tool_result' && processedEvents.length === 4) {
            // Trigger revocation in next tick to avoid interference
            setTimeout(() => {
              terminationController.revokePermissionDuringStream('Write', streamId);
            }, 5);
          }
        }
      })();

      await expect(streamPromise).rejects.toThrow(PermissionRevokedError);

      // Verify partial processing occurred before termination
      expect(processedEvents.length).toBeGreaterThan(0);
      expect(processedEvents.length).toBeLessThan(complexStreamingEvents.length);

      // Verify graceful termination
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].method).toBe('graceful');
    });

    it('should preserve partial results when terminated mid-stream', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      const partialWorkflowEvents = [
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Step 1: Analyzing requirements...' }] } },
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', id: 'step1', input: { path: '/step1.txt', content: 'Step 1 complete' } }] } },
        { type: 'tool_result', message: { content: [{ type: 'text', text: 'Step 1 written successfully' }] } },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Step 2: Processing data...' }] } },
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', id: 'step2', input: { path: '/step2.txt', content: 'Step 2 complete' } }] } },
      ];

      mockSDK.addStreamingEvents(partialWorkflowEvents);

      const streamId = 'partial-work-stream';
      const completedWork: any[] = [];

      await terminationController.startStream(streamId);

      const streamPromise = (async () => {
        const iterator = await mockSDK.mockQuery({ tools: ['Write'] });
        for await (const event of iterator) {
          completedWork.push(event);

          // Revoke after first tool use completes
          if (event.type === 'tool_result' && completedWork.length === 3) {
            setTimeout(() => {
              terminationController.revokePermissionDuringStream('Write', streamId);
            }, 5);
          }
        }
      })();

      await expect(streamPromise).rejects.toThrow();

      // Verify partial work was preserved
      expect(completedWork.length).toBeGreaterThanOrEqual(3); // At least first tool use + result

      const step1ToolUse = completedWork.find(event =>
        event.type === 'assistant' &&
        event.message?.content?.[0]?.id === 'step1'
      );

      expect(step1ToolUse).toBeDefined();
      expect(step1ToolUse.message.content[0].input.content).toBe('Step 1 complete');
    });

    it('should demonstrate complete end-to-end graceful termination flow', async () => {
      // This test demonstrates the full acceptance criteria in a single comprehensive flow
      await permissionManager.grantPermission('Bash', undefined, 'allow-always');

      const longRunningEvents = [
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Starting long-running process...' }] } },
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', id: 'long-cmd', input: { command: 'sleep 10 && echo "Long process complete"' } }] } },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Process is running...' }] } },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Still processing...' }] } },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Almost done...' }] } },
      ];

      mockSDK.addStreamingEvents(longRunningEvents);

      const streamId = 'end-to-end-test';
      const eventLog: Array<any> = [];
      let caughtError: any = null;
      const processedEvents: any[] = [];

      // Track all termination events
      ['stream:started', 'stream:terminated', 'permission:revoked', 'stream:cleanup:complete'].forEach(eventName => {
        terminationController.on(eventName, (data) => {
          eventLog.push({ event: eventName, data, timestamp: Date.now() });
        });
      });

      await terminationController.startStream(streamId);

      const streamPromise = (async () => {
        try {
          const iterator = await mockSDK.mockQuery({ tools: ['Bash'] });
          for await (const event of iterator) {
            processedEvents.push(event);
          }
        } catch (error) {
          caughtError = error;
          throw error;
        }
      })();

      // Let the stream process some events
      await testDelay(25);

      // Verify stream is active and processing
      expect(terminationController.getActiveStreams()).toContain(streamId);
      expect(mockSDK.isCurrentlyStreaming()).toBe(true);

      // Revoke permission mid-stream
      await terminationController.revokePermissionDuringStream('Bash', streamId);

      // AC1: Verify graceful termination (not abrupt killing)
      await expect(streamPromise).rejects.toThrow(PermissionRevokedError);
      expect(caughtError).toBeInstanceOf(PermissionRevokedError);
      expect(caughtError.code).toBe('PERMISSION_REVOKED');

      // Verify partial processing occurred before termination
      expect(processedEvents.length).toBeGreaterThan(0);
      expect(processedEvents.length).toBeLessThan(longRunningEvents.length);

      await testDelay(30);

      // AC2: Verify proper cleanup (no hanging connections)
      expect(terminationController.getActiveStreams()).not.toContain(streamId);
      expect(mockSDK.isCurrentlyStreaming()).toBe(false);

      const cleanupLog = terminationController.getCleanupLog();
      const streamCleanup = cleanupLog.find(entry => entry.streamId === streamId);
      expect(streamCleanup).toBeDefined();
      expect(streamCleanup!.success).toBe(true);

      // AC3: Verify appropriate events were emitted
      expect(eventLog).toHaveLength(4); // started, terminated, revoked, cleanup:complete

      const events = eventLog.map(e => e.event);
      expect(events).toEqual([
        'stream:started',
        'stream:terminated',
        'permission:revoked',
        'stream:cleanup:complete'
      ]);

      // Verify event metadata
      const terminatedEvent = eventLog.find(e => e.event === 'stream:terminated');
      expect(terminatedEvent.data.streamId).toBe(streamId);
      expect(terminatedEvent.data.method).toBe('graceful');
      expect(terminatedEvent.data.tool).toBe('Bash');

      const revokedEvent = eventLog.find(e => e.event === 'permission:revoked');
      expect(revokedEvent.data.tool).toBe('Bash');
      expect(revokedEvent.data.wasRevoked).toBe(true);
      expect(revokedEvent.data.affectedStreams).toContain(streamId);

      const cleanupEvent = eventLog.find(e => e.event === 'stream:cleanup:complete');
      expect(cleanupEvent.data.streamId).toBe(streamId);

      // Verify timestamps are consistent
      const timestamps = eventLog.map(e => e.timestamp);
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });
});