/**
 * @fileoverview Stress and error handling tests for ConfirmationSimulator
 *
 * These tests focus on error conditions, edge cases, performance under load,
 * and ensuring the simulator gracefully handles various failure scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  ApexOrchestrator,
  ApprovalRequiredEventData,
  PermissionRequestEventData,
  DangerousOperationDetectedEventData,
} from '@apexcli/orchestrator';
import {
  ConfirmationSimulator,
  createConfirmationSimulator,
  waitForOrchestratorEvent,
} from './confirmation-simulator';

// Error-prone Mock Orchestrator for stress testing
class ErrorProneOrchestrator extends EventEmitter {
  respondToApproval = vi.fn();
  private failureMode: 'none' | 'timeout' | 'error' | 'intermittent' = 'none';
  private errorCount = 0;
  private callCount = 0;

  constructor() {
    super();
    this.setupRespondToApproval();
  }

  setFailureMode(mode: 'none' | 'timeout' | 'error' | 'intermittent') {
    this.failureMode = mode;
    this.errorCount = 0;
    this.callCount = 0;
    this.setupRespondToApproval();
  }

  private setupRespondToApproval() {
    this.respondToApproval = vi.fn().mockImplementation(async (approvalId: string, response: any) => {
      this.callCount++;

      switch (this.failureMode) {
        case 'timeout':
          // Simulate timeout by never resolving
          return new Promise(() => {}); // Hangs forever

        case 'error':
          throw new Error(`Orchestrator error for approval ${approvalId}`);

        case 'intermittent':
          // Fail every 3rd call
          if (this.callCount % 3 === 0) {
            throw new Error(`Intermittent failure ${this.errorCount++}`);
          }
          return { success: true };

        case 'none':
        default:
          return { success: true };
      }
    });
  }

  // Helper methods for testing
  getCallCount(): number {
    return this.callCount;
  }

  getErrorCount(): number {
    return this.errorCount;
  }
}

describe('ConfirmationSimulator Stress Tests', () => {
  let mockOrchestrator: ErrorProneOrchestrator;
  let simulator: ConfirmationSimulator;

  beforeEach(() => {
    mockOrchestrator = new ErrorProneOrchestrator();
    simulator = new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);
  });

  afterEach(() => {
    simulator.dispose();
    vi.clearAllMocks();
  });

  describe('High Load Scenarios', () => {
    it('should handle rapid-fire events without dropping requests', async () => {
      const REQUEST_COUNT = 100;
      const responses = new Map<string, boolean>();

      // Configure responses for all requests
      for (let i = 0; i < REQUEST_COUNT; i++) {
        simulator.simulateUserApproval(`rapid-${i}`, {
          approver: `approver-${i % 10}`, // Rotate approvers
        });
      }

      // Track responses
      mockOrchestrator.respondToApproval.mockImplementation(async (approvalId) => {
        responses.set(approvalId, true);
        // Add small delay to simulate database work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        return { success: true };
      });

      // Emit all events as fast as possible
      const startTime = Date.now();
      for (let i = 0; i < REQUEST_COUNT; i++) {
        const approvalData: ApprovalRequiredEventData = {
          approvalId: `rapid-${i}`,
          taskId: `task-rapid-${i}`,
          gateName: `gate-${i}`,
          gateType: 'stress-test',
          description: `Stress test approval ${i}`,
          timestamp: new Date(),
          minApprovals: 1,
        };

        // Don't await - fire them all immediately
        process.nextTick(() => {
          mockOrchestrator.emit('approval:required', approvalData);
        });
      }

      // Wait for all to process
      await new Promise(resolve => setTimeout(resolve, 200));

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Verify all requests were handled
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledTimes(REQUEST_COUNT);
      expect(responses.size).toBe(REQUEST_COUNT);

      // Performance expectation - should handle 100 requests quickly
      expect(elapsed).toBeLessThan(1000);

      console.log(`Processed ${REQUEST_COUNT} rapid events in ${elapsed}ms`);
    });

    it('should handle mixed event types under load', async () => {
      const EVENT_COUNT_PER_TYPE = 30;
      const totalEvents = EVENT_COUNT_PER_TYPE * 3; // 3 event types

      // Configure universal responses
      simulator.simulateBatchResponses([
        { type: 'approval', action: 'approve' },
        { type: 'permission', action: 'approve' },
        { type: 'dangerous-operation', action: 'approve' },
      ]);

      const processedEvents = {
        approval: 0,
        permission: 0,
        dangerous: 0,
      };

      // Track all event types
      mockOrchestrator.on('permission:granted', () => processedEvents.permission++);
      mockOrchestrator.on('dangerous:confirmed', () => processedEvents.dangerous++);

      mockOrchestrator.respondToApproval.mockImplementation(async () => {
        processedEvents.approval++;
        return { success: true };
      });

      // Emit events in random order
      const events: Array<() => void> = [];

      // Prepare approval events
      for (let i = 0; i < EVENT_COUNT_PER_TYPE; i++) {
        events.push(() => {
          mockOrchestrator.emit('approval:required', {
            approvalId: `mixed-approval-${i}`,
            taskId: `mixed-task-${i}`,
            gateName: `mixed-gate-${i}`,
            gateType: 'mixed',
            description: `Mixed test ${i}`,
            timestamp: new Date(),
            minApprovals: 1,
          });
        });
      }

      // Prepare permission events
      for (let i = 0; i < EVENT_COUNT_PER_TYPE; i++) {
        events.push(() => {
          mockOrchestrator.emit('permission:request', {
            requestId: `mixed-perm-${i}`,
            tool: 'MixedTool',
            scope: [`/mixed/${i}`],
            timestamp: new Date(),
          });
        });
      }

      // Prepare dangerous operation events
      for (let i = 0; i < EVENT_COUNT_PER_TYPE; i++) {
        events.push(() => {
          mockOrchestrator.emit('dangerous:detected', {
            operationId: `mixed-danger-${i}`,
            tool: 'Bash',
            operation: `dangerous-op-${i}`,
            severity: 'medium',
            timestamp: new Date(),
          });
        });
      }

      // Shuffle events for random order
      for (let i = events.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [events[i], events[j]] = [events[j], events[i]];
      }

      // Fire all events rapidly
      events.forEach((emitEvent, index) => {
        setTimeout(emitEvent, index); // Small stagger
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify all events were processed
      expect(processedEvents.approval).toBe(EVENT_COUNT_PER_TYPE);
      expect(processedEvents.permission).toBe(EVENT_COUNT_PER_TYPE);
      expect(processedEvents.dangerous).toBe(EVENT_COUNT_PER_TYPE);
    });

    it('should handle memory pressure with many concurrent timeouts', async () => {
      const TIMEOUT_COUNT = 50;
      const timeoutEvents: string[] = [];

      // Configure many timeouts
      for (let i = 0; i < TIMEOUT_COUNT; i++) {
        simulator.simulateTimeout(`timeout-stress-${i}`, {
          timeoutMs: 100 + (i * 10), // Spread out timeouts
          timeoutAction: 'escalate',
          message: `Stress timeout ${i}`
        });
      }

      // Listen for escalation events
      mockOrchestrator.on('apex-event', (event) => {
        if (event.type === 'confirmation:escalated') {
          timeoutEvents.push(event.data.requestId);
        }
      });

      const startMemory = process.memoryUsage().heapUsed;

      // Emit all approval events
      for (let i = 0; i < TIMEOUT_COUNT; i++) {
        mockOrchestrator.emit('approval:required', {
          approvalId: `timeout-stress-${i}`,
          taskId: `timeout-task-${i}`,
          gateName: `timeout-gate-${i}`,
          gateType: 'timeout-stress',
          description: `Timeout stress test ${i}`,
          timestamp: new Date(),
          minApprovals: 1,
        });
      }

      // Wait for all timeouts to trigger
      await new Promise(resolve => setTimeout(resolve, 1000));

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Verify all timeouts escalated
      expect(timeoutEvents).toHaveLength(TIMEOUT_COUNT);

      // Memory usage should be reasonable (less than 50MB increase)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory increase for ${TIMEOUT_COUNT} timeouts: ${Math.round(memoryIncrease / 1024)}KB`);
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle orchestrator errors', async () => {
      mockOrchestrator.setFailureMode('error');

      simulator.simulateUserApproval('error-test', {
        approver: 'error-tester'
      });

      const approvalData: ApprovalRequiredEventData = {
        approvalId: 'error-test',
        taskId: 'error-task',
        gateName: 'error-gate',
        gateType: 'error',
        description: 'Error handling test',
        timestamp: new Date(),
        minApprovals: 1,
      };

      // This should not throw even though orchestrator will error
      expect(() => {
        mockOrchestrator.emit('approval:required', approvalData);
      }).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify the call was attempted despite the error
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledTimes(1);
    });

    it('should handle intermittent failures with retries', async () => {
      mockOrchestrator.setFailureMode('intermittent');

      // Configure multiple approvals
      for (let i = 0; i < 10; i++) {
        simulator.simulateUserApproval(`intermittent-${i}`, {
          approver: `approver-${i}`
        });
      }

      // Emit all events
      for (let i = 0; i < 10; i++) {
        mockOrchestrator.emit('approval:required', {
          approvalId: `intermittent-${i}`,
          taskId: `intermittent-task-${i}`,
          gateName: `intermittent-gate-${i}`,
          gateType: 'intermittent',
          description: `Intermittent test ${i}`,
          timestamp: new Date(),
          minApprovals: 1,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      // All calls should have been attempted
      expect(mockOrchestrator.getCallCount()).toBe(10);

      // Some calls should have failed (every 3rd one)
      expect(mockOrchestrator.getErrorCount()).toBe(Math.floor(10 / 3));
    });

    it('should handle malformed event data gracefully', async () => {
      simulator.simulateUserApproval('malformed-test', {
        approver: 'malform-tester'
      });

      // Emit malformed events
      const malformedEvents = [
        // Missing required fields
        { approvalId: 'malformed-test' },
        // Invalid data types
        { approvalId: 'malformed-test', taskId: null, timestamp: 'invalid-date' },
        // Empty objects
        {},
        // Null event
        null as any,
      ];

      for (const eventData of malformedEvents) {
        expect(() => {
          mockOrchestrator.emit('approval:required', eventData as any);
        }).not.toThrow();

        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // The valid approval should still work when we emit proper data
      mockOrchestrator.emit('approval:required', {
        approvalId: 'malformed-test',
        taskId: 'valid-task',
        gateName: 'valid-gate',
        gateType: 'valid',
        description: 'Valid after malformed',
        timestamp: new Date(),
        minApprovals: 1,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // At least one valid call should have succeeded
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        'malformed-test',
        expect.any(Object)
      );
    });

    it('should handle event listener errors without crashing', async () => {
      // Create a simulator that will cause internal errors
      const faultySim = new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);

      // Override internal methods to cause errors
      const originalExecuteResponse = (faultySim as any).executeResponse;
      (faultySim as any).executeResponse = vi.fn().mockImplementation(() => {
        throw new Error('Internal simulator error');
      });

      faultySim.simulateUserApproval('faulty-test', { approver: 'faulty' });

      // This should not crash the process
      expect(() => {
        mockOrchestrator.emit('approval:required', {
          approvalId: 'faulty-test',
          taskId: 'faulty-task',
          gateName: 'faulty-gate',
          gateType: 'faulty',
          description: 'Faulty test',
          timestamp: new Date(),
          minApprovals: 1,
        });
      }).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 20));

      faultySim.dispose();
    });
  });

  describe('Resource Management', () => {
    it('should prevent memory leaks with many create/dispose cycles', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const CYCLE_COUNT = 100;

      for (let i = 0; i < CYCLE_COUNT; i++) {
        const tempSim = new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);

        // Add some load to each simulator
        tempSim.simulateUserApproval(`cycle-${i}`, { approver: `approver-${i}` });

        // Emit an event
        mockOrchestrator.emit('approval:required', {
          approvalId: `cycle-${i}`,
          taskId: `cycle-task-${i}`,
          gateName: `cycle-gate-${i}`,
          gateType: 'cycle',
          description: `Cycle test ${i}`,
          timestamp: new Date(),
          minApprovals: 1,
        });

        // Dispose immediately
        tempSim.dispose();

        // Force garbage collection periodically
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      if (global.gc) {
        global.gc(); // Final cleanup
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      console.log(`Memory increase after ${CYCLE_COUNT} cycles: ${Math.round(memoryIncrease / 1024)}KB`);
    });

    it('should clean up all timeouts when disposed under load', async () => {
      const TIMEOUT_COUNT = 100;

      // Create many timeouts
      for (let i = 0; i < TIMEOUT_COUNT; i++) {
        simulator.simulateTimeout(`cleanup-timeout-${i}`, {
          timeoutMs: 10000, // Long timeout
          timeoutAction: 'reject'
        });
      }

      // Emit events to activate timeouts
      for (let i = 0; i < TIMEOUT_COUNT; i++) {
        mockOrchestrator.emit('approval:required', {
          approvalId: `cleanup-timeout-${i}`,
          taskId: `cleanup-task-${i}`,
          gateName: `cleanup-gate-${i}`,
          gateType: 'cleanup',
          description: `Cleanup test ${i}`,
          timestamp: new Date(),
          minApprovals: 1,
        });
      }

      // Give time for timeouts to be created
      await new Promise(resolve => setTimeout(resolve, 50));

      // Dispose should clean up all timeouts without waiting
      const disposeStart = Date.now();
      simulator.dispose();
      const disposeEnd = Date.now();

      // Dispose should be fast (not wait for timeouts)
      expect(disposeEnd - disposeStart).toBeLessThan(100);

      // Wait longer than timeouts would normally trigger
      await new Promise(resolve => setTimeout(resolve, 100));

      // No timeout responses should have occurred after dispose
      expect(mockOrchestrator.respondToApproval).not.toHaveBeenCalled();
    });

    it('should handle event listener edge cases', async () => {
      const eventCounts = {
        approval: 0,
        permission: 0,
        dangerous: 0,
      };

      // Count events processed
      const originalOn = mockOrchestrator.on.bind(mockOrchestrator);
      mockOrchestrator.on = vi.fn().mockImplementation((event, listener) => {
        return originalOn(event, (...args) => {
          if (event === 'approval:required') eventCounts.approval++;
          else if (event === 'permission:request') eventCounts.permission++;
          else if (event === 'dangerous:detected') eventCounts.dangerous++;

          try {
            listener(...args);
          } catch (error) {
            console.warn(`Event listener error for ${event}:`, error);
          }
        });
      });

      // Create multiple simulators listening to same orchestrator
      const simulators = Array.from({ length: 5 }, () =>
        new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator)
      );

      // Configure each with different patterns
      simulators[0].simulateUserApproval(/test-0/, { approver: 'sim-0' });
      simulators[1].simulateUserApproval(/test-1/, { approver: 'sim-1' });
      simulators[2].simulateUserApproval(/test-2/, { approver: 'sim-2' });
      simulators[3].simulateUserApproval(/test-3/, { approver: 'sim-3' });
      simulators[4].simulateUserApproval(/test-4/, { approver: 'sim-4' });

      // Emit events that match different patterns
      for (let i = 0; i < 5; i++) {
        mockOrchestrator.emit('approval:required', {
          approvalId: `test-${i}-match`,
          taskId: `multi-task-${i}`,
          gateName: `multi-gate-${i}`,
          gateType: 'multi',
          description: `Multi-simulator test ${i}`,
          timestamp: new Date(),
          minApprovals: 1,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      // Each event should have triggered multiple listeners
      expect(eventCounts.approval).toBeGreaterThan(5); // At least one per simulator

      // Clean up all simulators
      simulators.forEach(sim => sim.dispose());

      expect(mockOrchestrator.listenerCount('approval:required')).toBe(1); // Only our test listener remains
    });
  });

  describe('Complex Error Scenarios', () => {
    it('should handle circular event emissions', async () => {
      // Create a scenario where handling one event triggers another
      let circularCount = 0;
      const MAX_CIRCULAR = 5;

      simulator.simulateUserApproval(/circular-\d+/, {
        approver: 'circular-handler'
      });

      // Override respondToApproval to trigger more events
      mockOrchestrator.respondToApproval.mockImplementation(async (approvalId) => {
        circularCount++;

        // Trigger additional event if under limit
        if (circularCount < MAX_CIRCULAR) {
          setTimeout(() => {
            mockOrchestrator.emit('approval:required', {
              approvalId: `circular-${circularCount}`,
              taskId: `circular-task-${circularCount}`,
              gateName: `circular-gate-${circularCount}`,
              gateType: 'circular',
              description: `Circular test ${circularCount}`,
              timestamp: new Date(),
              minApprovals: 1,
            });
          }, 5);
        }

        return { success: true };
      });

      // Start the circular chain
      mockOrchestrator.emit('approval:required', {
        approvalId: 'circular-0',
        taskId: 'circular-task-0',
        gateName: 'circular-gate-0',
        gateType: 'circular',
        description: 'Start circular test',
        timestamp: new Date(),
        minApprovals: 1,
      });

      // Wait for chain to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledTimes(MAX_CIRCULAR);
      expect(circularCount).toBe(MAX_CIRCULAR);
    });

    it('should recover from async/await chain failures', async () => {
      let successCount = 0;
      let errorCount = 0;

      // Create a chain of async operations that might fail
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 20; i++) {
        const promise = (async () => {
          simulator.simulateUserApproval(`chain-${i}`, {
            approver: `chain-approver-${i}`
          });

          try {
            // Simulate async work with potential failure
            if (Math.random() < 0.3) { // 30% failure rate
              throw new Error(`Random failure ${i}`);
            }

            mockOrchestrator.emit('approval:required', {
              approvalId: `chain-${i}`,
              taskId: `chain-task-${i}`,
              gateName: `chain-gate-${i}`,
              gateType: 'chain',
              description: `Chain test ${i}`,
              timestamp: new Date(),
              minApprovals: 1,
            });

            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            successCount++;
          } catch (error) {
            errorCount++;
            // Error should not propagate
          }
        })();

        promises.push(promise);
      }

      // Wait for all promises to complete
      await Promise.allSettled(promises);

      expect(successCount + errorCount).toBe(20);
      expect(successCount).toBeGreaterThan(10); // Most should succeed

      console.log(`Chain test: ${successCount} successes, ${errorCount} errors`);
    });
  });
});

describe('ConfirmationSimulator Edge Cases', () => {
  let mockOrchestrator: EventEmitter;
  let simulator: ConfirmationSimulator;

  beforeEach(() => {
    mockOrchestrator = new EventEmitter();
    (mockOrchestrator as any).respondToApproval = vi.fn().mockResolvedValue({ success: true });
    simulator = new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);
  });

  afterEach(() => {
    simulator.dispose();
    vi.clearAllMocks();
  });

  describe('Boundary Conditions', () => {
    it('should handle zero-delay responses', async () => {
      simulator.simulateUserApproval('zero-delay', {
        approver: 'instant-approver',
        delayMs: 0
      });

      const startTime = Date.now();

      mockOrchestrator.emit('approval:required', {
        approvalId: 'zero-delay',
        taskId: 'zero-task',
        gateName: 'zero-gate',
        gateType: 'instant',
        description: 'Zero delay test',
        timestamp: new Date(),
        minApprovals: 1,
      });

      await new Promise(resolve => setTimeout(resolve, 20));

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(elapsed).toBeLessThan(30); // Should be very fast
      expect((mockOrchestrator as any).respondToApproval).toHaveBeenCalled();
    });

    it('should handle very long timeouts', async () => {
      const LONG_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

      simulator.simulateTimeout('very-long', {
        timeoutMs: LONG_TIMEOUT,
        timeoutAction: 'reject'
      });

      mockOrchestrator.emit('approval:required', {
        approvalId: 'very-long',
        taskId: 'long-task',
        gateName: 'long-gate',
        gateType: 'long',
        description: 'Very long timeout test',
        timestamp: new Date(),
        minApprovals: 1,
      });

      // Should not have triggered yet
      await new Promise(resolve => setTimeout(resolve, 100));
      expect((mockOrchestrator as any).respondToApproval).not.toHaveBeenCalled();

      // Reset should cancel the long timeout
      simulator.reset();

      // Wait a bit more to ensure it's canceled
      await new Promise(resolve => setTimeout(resolve, 50));
      expect((mockOrchestrator as any).respondToApproval).not.toHaveBeenCalled();
    });

    it('should handle extremely long pattern strings', async () => {
      const longPattern = 'a'.repeat(10000); // 10KB string

      simulator.simulateUserApproval(longPattern, {
        approver: 'long-pattern-approver'
      });

      mockOrchestrator.emit('approval:required', {
        approvalId: longPattern,
        taskId: 'long-pattern-task',
        gateName: 'long-pattern-gate',
        gateType: 'long-pattern',
        description: 'Long pattern test',
        timestamp: new Date(),
        minApprovals: 1,
      });

      await new Promise(resolve => setTimeout(resolve, 20));

      expect((mockOrchestrator as any).respondToApproval).toHaveBeenCalledWith(
        longPattern,
        expect.any(Object)
      );
    });

    it('should handle unicode and special characters in patterns', async () => {
      const unicodePatterns = [
        'approval-🚀-test',
        'منافقة-تَتَدَافَعُونَ',
        '测试-审批-流程',
        '日本語のパターン',
        'emoji-🎭🎪🎨-test',
        'special-chars-!@#$%^&*()_+-=[]{}|;:",./<>?',
      ];

      for (const pattern of unicodePatterns) {
        simulator.simulateUserApproval(pattern, {
          approver: 'unicode-approver'
        });

        mockOrchestrator.emit('approval:required', {
          approvalId: pattern,
          taskId: `unicode-task-${pattern}`,
          gateName: 'unicode-gate',
          gateType: 'unicode',
          description: 'Unicode pattern test',
          timestamp: new Date(),
          minApprovals: 1,
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        expect((mockOrchestrator as any).respondToApproval).toHaveBeenCalledWith(
          pattern,
          expect.any(Object)
        );
      }
    });
  });

  describe('Concurrency Edge Cases', () => {
    it('should handle simultaneous dispose and event emission', async () => {
      simulator.simulateUserApproval('concurrent-dispose', { approver: 'test' });

      // Start emitting an event and disposing at the same time
      const emitPromise = new Promise<void>(resolve => {
        mockOrchestrator.emit('approval:required', {
          approvalId: 'concurrent-dispose',
          taskId: 'concurrent-task',
          gateName: 'concurrent-gate',
          gateType: 'concurrent',
          description: 'Concurrent dispose test',
          timestamp: new Date(),
          minApprovals: 1,
        });
        resolve();
      });

      const disposePromise = new Promise<void>(resolve => {
        simulator.dispose();
        resolve();
      });

      // Both should complete without errors
      await Promise.all([emitPromise, disposePromise]);

      // No guarantees about whether the approval was processed,
      // but it shouldn't have thrown an error
    });

    it('should handle reset during active timeouts', async () => {
      // Set up multiple timeouts
      for (let i = 0; i < 10; i++) {
        simulator.simulateTimeout(`reset-during-${i}`, {
          timeoutMs: 100,
          timeoutAction: 'reject'
        });
      }

      // Emit events to start timeouts
      for (let i = 0; i < 10; i++) {
        mockOrchestrator.emit('approval:required', {
          approvalId: `reset-during-${i}`,
          taskId: `reset-task-${i}`,
          gateName: `reset-gate-${i}`,
          gateType: 'reset',
          description: `Reset test ${i}`,
          timestamp: new Date(),
          minApprovals: 1,
        });
      }

      // Reset while timeouts are active
      await new Promise(resolve => setTimeout(resolve, 50)); // Let timeouts start
      simulator.reset();

      // Wait past when timeouts would have fired
      await new Promise(resolve => setTimeout(resolve, 200));

      // No approvals should have been processed after reset
      expect((mockOrchestrator as any).respondToApproval).not.toHaveBeenCalled();
    });
  });

  describe('Null/Undefined Handling', () => {
    it('should handle null/undefined in event data gracefully', async () => {
      simulator.simulateUserApproval('null-test', { approver: 'null-handler' });

      const malformedEvents = [
        {
          approvalId: 'null-test',
          taskId: null as any,
          gateName: undefined as any,
          gateType: 'null-test',
          description: null as any,
          timestamp: new Date(),
          minApprovals: 1,
        },
        {
          approvalId: 'null-test',
          taskId: 'valid-task',
          gateName: 'valid-gate',
          gateType: undefined as any,
          description: '',
          timestamp: null as any,
          minApprovals: undefined as any,
        }
      ];

      for (const eventData of malformedEvents) {
        expect(() => {
          mockOrchestrator.emit('approval:required', eventData);
        }).not.toThrow();

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // At least some processing should have occurred
      expect((mockOrchestrator as any).respondToApproval).toHaveBeenCalled();
    });
  });
});