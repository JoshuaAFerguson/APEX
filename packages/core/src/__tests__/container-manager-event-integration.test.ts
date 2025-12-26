import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { EventEmitter } from 'eventemitter3';
import {
  ContainerManager,
  type ContainerOperationResult,
  type CreateContainerOptions,
  type ContainerEvent,
  type ContainerOperationEvent,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import { ContainerConfig } from '../types';

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

const mockExec = vi.mocked(exec);

// Mock ContainerRuntime
vi.mock('../container-runtime');
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

// Helper to create a mock exec callback
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
    }
    return {} as any;
  });
}

describe('ContainerManager Event Integration Tests', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('event-driven container management', () => {
    it('should support event-driven workflow orchestration', async () => {
      const containerId = 'workflow-container';
      const taskId = 'workflow-task';
      const workflowEvents: Array<{ operation: string; success: boolean; timestamp: Date }> = [];

      // Set up event-driven workflow handler
      manager.on('container:lifecycle', (event: ContainerEvent, operation: string) => {
        workflowEvents.push({
          operation,
          success: (event as ContainerOperationEvent).success,
          timestamp: event.timestamp,
        });
      });

      // Mock all operations
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // create
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // start
      mockExec.mockImplementationOnce(mockExecCallback('abc123|test|node:20|running|2023-01-01T10:00:00Z|2023-01-01T10:00:01Z|<no value>|<no value>')); // inspect
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // stop
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // remove

      // Execute workflow
      await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId,
        autoStart: false,
      });

      await manager.startContainer(containerId);
      await manager.stopContainer(containerId);
      await manager.removeContainer(containerId);

      // Verify workflow completion
      expect(workflowEvents).toHaveLength(4);
      expect(workflowEvents.map(e => e.operation)).toEqual(['created', 'started', 'stopped', 'removed']);
      expect(workflowEvents.every(e => e.success)).toBe(true);

      // Verify timestamps are in order
      for (let i = 1; i < workflowEvents.length; i++) {
        expect(workflowEvents[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          workflowEvents[i - 1].timestamp.getTime()
        );
      }
    });

    it('should handle partial workflow failures with proper events', async () => {
      const containerId = 'failure-container';
      const taskId = 'failure-task';
      const allEvents: ContainerOperationEvent[] = [];

      // Listen to all events
      ['created', 'started', 'stopped', 'removed'].forEach(operation => {
        manager.on(`container:${operation}` as any, (event: ContainerOperationEvent) => {
          allEvents.push({ ...event, _operation: operation });
        });
      });

      // Mock: successful create, failed start
      mockExec.mockImplementationOnce(mockExecCallback(containerId));
      mockExec.mockImplementationOnce(mockExecCallback('', 'Start failed'));

      // Execute partial workflow
      await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId,
        autoStart: false,
      });

      await manager.startContainer(containerId);

      expect(allEvents).toHaveLength(2);
      expect(allEvents[0].success).toBe(true); // create succeeded
      expect(allEvents[1].success).toBe(false); // start failed
      expect(allEvents[1].error).toContain('Container start failed');
    });

    it('should support event-based monitoring and alerting', async () => {
      const containerId = 'monitoring-container';
      const alerts: Array<{ level: string; message: string; containerId: string }> = [];

      // Set up monitoring system
      const monitoringHandler = (event: ContainerOperationEvent) => {
        if (!event.success) {
          alerts.push({
            level: 'ERROR',
            message: `Container operation failed: ${event.error}`,
            containerId: event.containerId,
          });
        } else {
          alerts.push({
            level: 'INFO',
            message: `Container operation succeeded`,
            containerId: event.containerId,
          });
        }
      };

      // Attach monitoring to all operations
      manager.on('container:created', monitoringHandler);
      manager.on('container:started', monitoringHandler);
      manager.on('container:stopped', monitoringHandler);
      manager.on('container:removed', monitoringHandler);

      // Mock mixed success/failure scenario
      mockExec.mockImplementationOnce(mockExecCallback(containerId)); // create success
      mockExec.mockImplementationOnce(mockExecCallback('', 'Runtime error')); // start failure

      await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'monitoring-test',
      });

      await manager.startContainer(containerId);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].level).toBe('INFO'); // create success
      expect(alerts[1].level).toBe('ERROR'); // start failure
      expect(alerts[1].message).toContain('Container operation failed');
    });

    it('should support concurrent container operations with isolated events', async () => {
      const container1Events: ContainerOperationEvent[] = [];
      const container2Events: ContainerOperationEvent[] = [];

      // Set up isolated event tracking
      manager.on('container:created', (event: ContainerOperationEvent) => {
        if (event.taskId === 'task-1') {
          container1Events.push(event);
        } else if (event.taskId === 'task-2') {
          container2Events.push(event);
        }
      });

      // Mock concurrent operations
      mockExec.mockImplementationOnce(mockExecCallback('container-1'));
      mockExec.mockImplementationOnce(mockExecCallback('container-2'));

      // Execute concurrent operations
      await Promise.all([
        manager.createContainer({
          config: { image: 'node:20-alpine' },
          taskId: 'task-1',
        }),
        manager.createContainer({
          config: { image: 'python:3.11' },
          taskId: 'task-2',
        }),
      ]);

      expect(container1Events).toHaveLength(1);
      expect(container2Events).toHaveLength(1);
      expect(container1Events[0].containerId).toBe('container-1');
      expect(container2Events[0].containerId).toBe('container-2');
      expect(container1Events[0].taskId).toBe('task-1');
      expect(container2Events[0].taskId).toBe('task-2');
    });

    it('should maintain event order consistency under high load', async () => {
      const receivedEvents: Array<{ operation: string; containerId: string; timestamp: number }> = [];

      manager.on('container:lifecycle', (event: ContainerEvent, operation: string) => {
        receivedEvents.push({
          operation,
          containerId: event.containerId,
          timestamp: Date.now(),
        });
      });

      // Mock rapid operations
      const containerIds = ['rapid-1', 'rapid-2', 'rapid-3'];
      containerIds.forEach(id => {
        mockExec.mockImplementationOnce(mockExecCallback(id));
      });

      // Execute rapid operations
      const operations = containerIds.map(id =>
        manager.createContainer({
          config: { image: 'alpine:latest' },
          taskId: `rapid-${id}`,
        })
      );

      await Promise.all(operations);

      expect(receivedEvents).toHaveLength(3);

      // Verify all containers were processed
      const processedContainers = receivedEvents.map(e => e.containerId);
      containerIds.forEach(id => {
        expect(processedContainers).toContain(id);
      });
    });

    it('should provide comprehensive event metadata for debugging', async () => {
      const containerId = 'debug-container';
      let capturedEvent: ContainerOperationEvent | null = null;

      manager.on('container:created', (event: ContainerOperationEvent) => {
        capturedEvent = event;
      });

      mockExec.mockImplementationOnce(mockExecCallback(containerId));

      await manager.createContainer({
        config: {
          image: 'ubuntu:22.04',
          environment: { DEBUG: 'true' },
          volumes: { '/host': '/container' },
        },
        taskId: 'debug-task',
      });

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.containerId).toBe(containerId);
      expect(capturedEvent!.taskId).toBe('debug-task');
      expect(capturedEvent!.command).toContain('ubuntu:22.04');
      expect(capturedEvent!.command).toContain('DEBUG=true');
      expect(capturedEvent!.command).toContain('/host:/container');
      expect(capturedEvent!.timestamp).toBeInstanceOf(Date);
      expect(capturedEvent!.success).toBe(true);
    });

    it('should support custom event aggregation patterns', async () => {
      const eventAggregator = {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        operationTypes: new Map<string, number>(),
      };

      // Aggregate all lifecycle events
      manager.on('container:lifecycle', (event: ContainerEvent, operation: string) => {
        eventAggregator.totalOperations++;

        const opEvent = event as ContainerOperationEvent;
        if (opEvent.success) {
          eventAggregator.successfulOperations++;
        } else {
          eventAggregator.failedOperations++;
        }

        const currentCount = eventAggregator.operationTypes.get(operation) || 0;
        eventAggregator.operationTypes.set(operation, currentCount + 1);
      });

      // Mock operations with mixed results
      mockExec.mockImplementationOnce(mockExecCallback('test-1')); // create success
      mockExec.mockImplementationOnce(mockExecCallback('test-1')); // start success
      mockExec.mockImplementationOnce(mockExecCallback('test-1')); // inspect
      mockExec.mockImplementationOnce(mockExecCallback('', 'Stop failed')); // stop failure

      await manager.createContainer({
        config: { image: 'node:20' },
        taskId: 'aggregation-test',
        autoStart: false,
      });

      await manager.startContainer('test-1');
      await manager.stopContainer('test-1');

      expect(eventAggregator.totalOperations).toBe(3);
      expect(eventAggregator.successfulOperations).toBe(2);
      expect(eventAggregator.failedOperations).toBe(1);
      expect(eventAggregator.operationTypes.get('created')).toBe(1);
      expect(eventAggregator.operationTypes.get('started')).toBe(1);
      expect(eventAggregator.operationTypes.get('stopped')).toBe(1);
    });
  });

  describe('EventEmitter3 feature validation', () => {
    it('should support EventEmitter3 once() method', async () => {
      let eventCount = 0;

      // Use once() to listen for only the first event
      manager.once('container:created', () => {
        eventCount++;
      });

      mockExec.mockImplementationOnce(mockExecCallback('once-test-1'));
      mockExec.mockImplementationOnce(mockExecCallback('once-test-2'));

      // Create two containers
      await manager.createContainer({
        config: { image: 'alpine' },
        taskId: 'once-test-1',
      });

      await manager.createContainer({
        config: { image: 'alpine' },
        taskId: 'once-test-2',
      });

      // Should only receive one event
      expect(eventCount).toBe(1);
    });

    it('should support EventEmitter3 removeListener() method', async () => {
      let eventCount = 0;

      const eventHandler = () => {
        eventCount++;
      };

      manager.on('container:created', eventHandler);

      mockExec.mockImplementationOnce(mockExecCallback('remove-test-1'));
      await manager.createContainer({
        config: { image: 'alpine' },
        taskId: 'remove-test-1',
      });

      expect(eventCount).toBe(1);

      // Remove listener
      manager.removeListener('container:created', eventHandler);

      mockExec.mockImplementationOnce(mockExecCallback('remove-test-2'));
      await manager.createContainer({
        config: { image: 'alpine' },
        taskId: 'remove-test-2',
      });

      // Should still be 1
      expect(eventCount).toBe(1);
    });

    it('should support EventEmitter3 listenerCount() method', () => {
      expect(manager.listenerCount('container:created')).toBe(0);

      const handler1 = () => {};
      const handler2 = () => {};

      manager.on('container:created', handler1);
      expect(manager.listenerCount('container:created')).toBe(1);

      manager.on('container:created', handler2);
      expect(manager.listenerCount('container:created')).toBe(2);

      manager.removeListener('container:created', handler1);
      expect(manager.listenerCount('container:created')).toBe(1);
    });
  });
});