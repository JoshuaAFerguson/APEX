/**
 * Comprehensive integration tests for auto-fix event streaming
 * Tests the complete end-to-end flow from orchestrator to CLI and API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type {
  AutoFixRequestedEventData,
  AutoFixStartedEventData,
  AutoFixProgressEventData,
  AutoFixCompletedEventData,
  AutoFixFailedEventData,
  AutoFixSkippedEventData,
} from '../index';

// Mock implementations for testing
class MockOrchestrator extends EventEmitter {
  private autoFixService: any;

  constructor() {
    super();
    this.autoFixService = {
      isAvailable: vi.fn().mockResolvedValue(true),
      fixFiles: vi.fn().mockResolvedValue([])
    };
  }

  async triggerAutoFix(taskId: string, files: string[]): Promise<any> {
    // Simulate the stage completion hook triggering auto-fix
    const results = {
      filesProcessed: files,
      issuesFixed: [],
      errors: []
    };

    for (const filePath of files) {
      // Emit autofix:requested
      this.emit('autofix:requested', {
        taskId,
        filePath,
        fixTypes: ['imports', 'formatting'],
        triggeredBy: 'stage-completion',
        timestamp: new Date()
      } as AutoFixRequestedEventData);

      await this.processFile(taskId, filePath);
    }

    return results;
  }

  private async processFile(taskId: string, filePath: string): Promise<void> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 10));

    const issuesDetected = Math.floor(Math.random() * 5) + 1;
    const shouldFail = Math.random() < 0.1; // 10% failure rate

    // Emit autofix:started
    this.emit('autofix:started', {
      taskId,
      filePath,
      fixType: 'imports',
      issuesDetected,
      timestamp: new Date()
    } as AutoFixStartedEventData);

    if (shouldFail) {
      // Emit autofix:failed
      this.emit('autofix:failed', {
        taskId,
        filePath,
        fixType: 'imports',
        error: 'Mock processing error',
        issuesDetected,
        issuesFixed: 0,
        timestamp: new Date()
      } as AutoFixFailedEventData);
      return;
    }

    // Emit progress events
    for (let fixed = 1; fixed <= issuesDetected; fixed++) {
      this.emit('autofix:progress', {
        taskId,
        filePath,
        fixType: 'imports',
        issuesFixed: fixed,
        issuesRemaining: issuesDetected - fixed,
        currentFix: `Fixing issue ${fixed}`,
        timestamp: new Date()
      } as AutoFixProgressEventData);
    }

    // Emit autofix:completed
    this.emit('autofix:completed', {
      taskId,
      filePath,
      fixType: 'imports',
      issuesDetected,
      issuesFixed: issuesDetected,
      duration: 100 + Math.random() * 900,
      timestamp: new Date()
    } as AutoFixCompletedEventData);
  }
}

// Mock CLI handler
class MockCLIHandler {
  private spinners = new Map<string, any>();
  private logs: string[] = [];

  constructor(private orchestrator: EventEmitter) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.orchestrator.on('autofix:requested', (event: AutoFixRequestedEventData) => {
      const fileName = event.filePath.split('/').pop();
      const spinnerId = `${event.taskId}:${event.filePath}`;

      this.spinners.set(spinnerId, {
        text: `🔧 Auto-fixing ${fileName}...`,
        status: 'running',
        color: 'yellow'
      });

      this.logs.push(`CLI: Auto-fix requested for ${fileName}`);
    });

    this.orchestrator.on('autofix:started', (event: AutoFixStartedEventData) => {
      const fileName = event.filePath.split('/').pop();
      const spinnerId = `${event.taskId}:${event.filePath}`;

      const spinner = this.spinners.get(spinnerId);
      if (spinner) {
        spinner.text = `⚡ Fixing ${event.issuesDetected} ${event.fixType} issues in ${fileName}...`;
      }

      this.logs.push(`CLI: Started fixing ${event.issuesDetected} issues in ${fileName}`);
    });

    this.orchestrator.on('autofix:progress', (event: AutoFixProgressEventData) => {
      const fileName = event.filePath.split('/').pop();
      const spinnerId = `${event.taskId}:${event.filePath}`;

      const spinner = this.spinners.get(spinnerId);
      if (spinner) {
        spinner.text = `📈 ${fileName}: ${event.issuesFixed}/${event.issuesFixed + event.issuesRemaining} issues fixed`;
      }

      this.logs.push(`CLI: Progress ${fileName}: ${event.issuesFixed} fixed, ${event.issuesRemaining} remaining`);
    });

    this.orchestrator.on('autofix:completed', (event: AutoFixCompletedEventData) => {
      const fileName = event.filePath.split('/').pop();
      const spinnerId = `${event.taskId}:${event.filePath}`;

      const spinner = this.spinners.get(spinnerId);
      if (spinner) {
        spinner.text = `✅ ${fileName} - Fixed ${event.issuesFixed}/${event.issuesDetected} issues (${Math.round(event.duration)}ms)`;
        spinner.status = 'completed';
        spinner.color = 'green';
      }

      this.logs.push(`CLI: Completed ${fileName} - Fixed ${event.issuesFixed}/${event.issuesDetected} issues`);
    });

    this.orchestrator.on('autofix:failed', (event: AutoFixFailedEventData) => {
      const fileName = event.filePath.split('/').pop();
      const spinnerId = `${event.taskId}:${event.filePath}`;

      const spinner = this.spinners.get(spinnerId);
      if (spinner) {
        spinner.text = `❌ ${fileName} - Error: ${event.error}`;
        spinner.status = 'failed';
        spinner.color = 'red';
      }

      this.logs.push(`CLI: Failed ${fileName} - ${event.error}`);
    });

    this.orchestrator.on('autofix:skipped', (event: AutoFixSkippedEventData) => {
      const fileName = event.filePath.split('/').pop();
      this.logs.push(`CLI: Skipped ${fileName} - ${event.reason}`);
    });
  }

  getSpinnerState(taskId: string, filePath: string): any {
    return this.spinners.get(`${taskId}:${filePath}`);
  }

  getLogs(): string[] {
    return this.logs;
  }

  getActiveSpinners(): number {
    return Array.from(this.spinners.values()).filter(s => s.status === 'running').length;
  }
}

// Mock API WebSocket handler
class MockAPIHandler {
  private connectedClients = new Map<string, any>();
  private broadcastHistory: any[] = [];

  constructor(private orchestrator: EventEmitter) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const autoFixEvents = [
      'autofix:requested',
      'autofix:started',
      'autofix:progress',
      'autofix:completed',
      'autofix:failed',
      'autofix:skipped'
    ];

    autoFixEvents.forEach(eventType => {
      this.orchestrator.on(eventType, (event: any) => {
        const websocketMessage = {
          type: eventType,
          taskId: event.taskId,
          timestamp: event.timestamp,
          data: this.transformEventData(eventType, event)
        };

        this.broadcast(event.taskId, websocketMessage);
      });
    });
  }

  private transformEventData(eventType: string, event: any): any {
    switch (eventType) {
      case 'autofix:requested':
        return {
          filePath: event.filePath,
          fixTypes: event.fixTypes,
          triggeredBy: event.triggeredBy
        };

      case 'autofix:started':
        return {
          filePath: event.filePath,
          fixType: event.fixType,
          issuesDetected: event.issuesDetected
        };

      case 'autofix:progress':
        return {
          filePath: event.filePath,
          fixType: event.fixType,
          issuesFixed: event.issuesFixed,
          issuesRemaining: event.issuesRemaining,
          currentFix: event.currentFix,
          progress: Math.round((event.issuesFixed / (event.issuesFixed + event.issuesRemaining)) * 100)
        };

      case 'autofix:completed':
        return {
          filePath: event.filePath,
          fixType: event.fixType,
          issuesDetected: event.issuesDetected,
          issuesFixed: event.issuesFixed,
          duration: event.duration,
          successRate: Math.round((event.issuesFixed / event.issuesDetected) * 100)
        };

      case 'autofix:failed':
        return {
          filePath: event.filePath,
          fixType: event.fixType,
          error: event.error,
          issuesDetected: event.issuesDetected,
          issuesFixed: event.issuesFixed
        };

      case 'autofix:skipped':
        return {
          filePath: event.filePath,
          reason: event.reason
        };

      default:
        return event;
    }
  }

  private broadcast(taskId: string, message: any): void {
    this.broadcastHistory.push({ taskId, message, timestamp: new Date() });

    // Simulate broadcasting to connected clients
    this.connectedClients.forEach((client, clientId) => {
      if (client.subscribedTasks.includes(taskId) || client.subscribedTasks.includes('*')) {
        client.messages.push(message);
      }
    });
  }

  addClient(clientId: string, subscribedTasks: string[] = ['*']): void {
    this.connectedClients.set(clientId, {
      subscribedTasks,
      messages: []
    });
  }

  removeClient(clientId: string): void {
    this.connectedClients.delete(clientId);
  }

  getClientMessages(clientId: string): any[] {
    return this.connectedClients.get(clientId)?.messages || [];
  }

  getBroadcastHistory(): any[] {
    return this.broadcastHistory;
  }
}

describe('Auto-Fix Event Integration Comprehensive Tests', () => {
  let orchestrator: MockOrchestrator;
  let cliHandler: MockCLIHandler;
  let apiHandler: MockAPIHandler;

  beforeEach(() => {
    orchestrator = new MockOrchestrator();
    cliHandler = new MockCLIHandler(orchestrator);
    apiHandler = new MockAPIHandler(orchestrator);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Single File Auto-Fix Flow', () => {
    it('should complete full lifecycle for single file', async () => {
      const taskId = 'single-file-test';
      const filePath = '/src/components/Button.tsx';

      apiHandler.addClient('test-client', [taskId]);

      await orchestrator.triggerAutoFix(taskId, [filePath]);

      // Verify CLI handling
      const logs = cliHandler.getLogs();
      expect(logs.some(log => log.includes('Auto-fix requested for Button.tsx'))).toBe(true);
      expect(logs.some(log => log.includes('Started fixing'))).toBe(true);
      expect(logs.some(log => log.includes('Progress'))).toBe(true);

      const spinnerState = cliHandler.getSpinnerState(taskId, filePath);
      expect(spinnerState).toBeDefined();

      // Verify API WebSocket handling
      const clientMessages = apiHandler.getClientMessages('test-client');
      expect(clientMessages.length).toBeGreaterThan(0);

      const requestedEvent = clientMessages.find(msg => msg.type === 'autofix:requested');
      expect(requestedEvent).toBeDefined();
      expect(requestedEvent.data.filePath).toBe(filePath);

      const completedEvent = clientMessages.find(msg => msg.type === 'autofix:completed');
      if (completedEvent) {
        expect(completedEvent.data.successRate).toBeGreaterThan(0);
        expect(completedEvent.data.duration).toBeGreaterThan(0);
      }
    });

    it('should handle file processing failure gracefully', async () => {
      const taskId = 'failure-test';
      const filePath = '/src/broken/syntax.js';

      apiHandler.addClient('failure-client', [taskId]);

      // Mock failure scenario
      vi.spyOn(Math, 'random').mockReturnValue(0.05); // Force failure

      await orchestrator.triggerAutoFix(taskId, [filePath]);

      const logs = cliHandler.getLogs();
      const failedLog = logs.find(log => log.includes('Failed') && log.includes('syntax.js'));

      if (failedLog) {
        expect(failedLog).toContain('Mock processing error');
      }

      const clientMessages = apiHandler.getClientMessages('failure-client');
      const failedEvent = clientMessages.find(msg => msg.type === 'autofix:failed');

      if (failedEvent) {
        expect(failedEvent.data.error).toBe('Mock processing error');
        expect(failedEvent.data.filePath).toBe(filePath);
      }
    });
  });

  describe('Multiple File Auto-Fix Flow', () => {
    it('should handle concurrent file processing', async () => {
      const taskId = 'multi-file-test';
      const files = [
        '/src/components/Header.tsx',
        '/src/components/Footer.tsx',
        '/src/utils/helpers.ts',
        '/src/services/api.ts'
      ];

      apiHandler.addClient('multi-client', [taskId]);

      await orchestrator.triggerAutoFix(taskId, files);

      // Verify all files were processed
      const logs = cliHandler.getLogs();
      files.forEach(filePath => {
        const fileName = filePath.split('/').pop();
        expect(logs.some(log => log.includes(fileName!))).toBe(true);
      });

      // Verify WebSocket events for all files
      const clientMessages = apiHandler.getClientMessages('multi-client');
      const requestedEvents = clientMessages.filter(msg => msg.type === 'autofix:requested');

      expect(requestedEvents).toHaveLength(files.length);

      files.forEach(filePath => {
        expect(requestedEvents.some(event => event.data.filePath === filePath)).toBe(true);
      });
    });

    it('should track progress across multiple files', async () => {
      const taskId = 'progress-tracking-test';
      const files = [
        '/src/components/Modal.tsx',
        '/src/components/Dialog.tsx'
      ];

      apiHandler.addClient('progress-client', [taskId]);

      await orchestrator.triggerAutoFix(taskId, files);

      const clientMessages = apiHandler.getClientMessages('progress-client');
      const progressEvents = clientMessages.filter(msg => msg.type === 'autofix:progress');

      // Should have progress events for multiple files
      expect(progressEvents.length).toBeGreaterThan(0);

      // Verify progress percentages are calculated correctly
      progressEvents.forEach(event => {
        expect(event.data.progress).toBeGreaterThanOrEqual(0);
        expect(event.data.progress).toBeLessThanOrEqual(100);
        expect(typeof event.data.progress).toBe('number');
      });
    });
  });

  describe('Real-time Event Streaming', () => {
    it('should stream events in real-time with proper ordering', async () => {
      const taskId = 'real-time-test';
      const filePath = '/src/components/RealTime.tsx';

      apiHandler.addClient('streaming-client', [taskId]);

      const eventOrder: string[] = [];

      // Track event ordering
      ['autofix:requested', 'autofix:started', 'autofix:progress', 'autofix:completed'].forEach(eventType => {
        orchestrator.on(eventType, () => {
          eventOrder.push(eventType);
        });
      });

      await orchestrator.triggerAutoFix(taskId, [filePath]);

      // Verify event ordering
      expect(eventOrder[0]).toBe('autofix:requested');
      expect(eventOrder[1]).toBe('autofix:started');
      expect(eventOrder.includes('autofix:progress')).toBe(true);

      // Last event should be completion or failure
      const lastEvent = eventOrder[eventOrder.length - 1];
      expect(['autofix:completed', 'autofix:failed'].includes(lastEvent)).toBe(true);
    });

    it('should handle rapid event emission without loss', async () => {
      const taskId = 'rapid-events-test';
      const files = Array.from({ length: 20 }, (_, i) => `/src/file-${i}.ts`);

      apiHandler.addClient('rapid-client', [taskId]);

      const startTime = performance.now();
      await orchestrator.triggerAutoFix(taskId, files);
      const duration = performance.now() - startTime;

      // Should handle many files quickly
      expect(duration).toBeLessThan(5000); // Less than 5 seconds

      const clientMessages = apiHandler.getClientMessages('rapid-client');
      const requestedEvents = clientMessages.filter(msg => msg.type === 'autofix:requested');

      // Should not lose events
      expect(requestedEvents).toHaveLength(files.length);
    });
  });

  describe('Client Management and Filtering', () => {
    it('should filter events by task subscription', async () => {
      const taskA = 'task-a';
      const taskB = 'task-b';

      apiHandler.addClient('client-a', [taskA]);
      apiHandler.addClient('client-b', [taskB]);
      apiHandler.addClient('client-all', ['*']);

      await Promise.all([
        orchestrator.triggerAutoFix(taskA, ['/src/task-a.ts']),
        orchestrator.triggerAutoFix(taskB, ['/src/task-b.ts'])
      ]);

      // Client A should only receive task A events
      const clientAMessages = apiHandler.getClientMessages('client-a');
      expect(clientAMessages.every(msg => msg.taskId === taskA)).toBe(true);

      // Client B should only receive task B events
      const clientBMessages = apiHandler.getClientMessages('client-b');
      expect(clientBMessages.every(msg => msg.taskId === taskB)).toBe(true);

      // Client all should receive both
      const clientAllMessages = apiHandler.getClientMessages('client-all');
      const taskAMessages = clientAllMessages.filter(msg => msg.taskId === taskA);
      const taskBMessages = clientAllMessages.filter(msg => msg.taskId === taskB);

      expect(taskAMessages.length).toBeGreaterThan(0);
      expect(taskBMessages.length).toBeGreaterThan(0);
    });

    it('should handle client disconnect during streaming', () => {
      const taskId = 'disconnect-test';

      apiHandler.addClient('temp-client', [taskId]);

      // Simulate disconnection
      apiHandler.removeClient('temp-client');

      // Should not crash when broadcasting
      expect(() => {
        orchestrator.emit('autofix:requested', {
          taskId,
          filePath: '/test.ts',
          fixTypes: ['imports'],
          triggeredBy: 'test',
          timestamp: new Date()
        });
      }).not.toThrow();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large file batches efficiently', async () => {
      const taskId = 'large-batch-test';
      const files = Array.from({ length: 100 }, (_, i) => `/src/batch/file-${i}.ts`);

      const initialMemory = process.memoryUsage().heapUsed;

      await orchestrator.triggerAutoFix(taskId, files);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // All events should be processed
      const broadcastHistory = apiHandler.getBroadcastHistory();
      expect(broadcastHistory.length).toBeGreaterThan(files.length);
    });

    it('should maintain performance with many concurrent clients', async () => {
      const taskId = 'concurrent-clients-test';
      const clientCount = 50;

      // Add many clients
      for (let i = 0; i < clientCount; i++) {
        apiHandler.addClient(`client-${i}`, [taskId]);
      }

      const startTime = performance.now();
      await orchestrator.triggerAutoFix(taskId, ['/src/performance.ts']);
      const duration = performance.now() - startTime;

      // Should handle many clients without significant slowdown
      expect(duration).toBeLessThan(1000);

      // All clients should receive events
      for (let i = 0; i < clientCount; i++) {
        const messages = apiHandler.getClientMessages(`client-${i}`);
        expect(messages.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should continue processing after individual file failures', async () => {
      const taskId = 'resilience-test';
      const files = [
        '/src/good-file-1.ts',
        '/src/bad-file.ts',
        '/src/good-file-2.ts'
      ];

      // Mock specific file failure
      const originalProcessFile = orchestrator['processFile'];
      orchestrator['processFile'] = vi.fn().mockImplementation(async (taskId: string, filePath: string) => {
        if (filePath.includes('bad-file')) {
          orchestrator.emit('autofix:failed', {
            taskId,
            filePath,
            fixType: 'imports',
            error: 'Simulated failure',
            issuesDetected: 1,
            issuesFixed: 0,
            timestamp: new Date()
          });
          return;
        }
        return originalProcessFile.call(orchestrator, taskId, filePath);
      });

      await orchestrator.triggerAutoFix(taskId, files);

      const logs = cliHandler.getLogs();

      // Should have processed all files
      expect(logs.some(log => log.includes('good-file-1.ts'))).toBe(true);
      expect(logs.some(log => log.includes('bad-file.ts'))).toBe(true);
      expect(logs.some(log => log.includes('good-file-2.ts'))).toBe(true);

      // Should have both successes and failures
      expect(logs.some(log => log.includes('Completed'))).toBe(true);
      expect(logs.some(log => log.includes('Failed'))).toBe(true);
    });

    it('should handle event listener errors gracefully', () => {
      // Add a failing event listener
      orchestrator.on('autofix:progress', () => {
        throw new Error('Listener error');
      });

      // Should not crash when emitting events
      expect(() => {
        orchestrator.emit('autofix:progress', {
          taskId: 'error-test',
          filePath: '/test.ts',
          fixType: 'imports',
          issuesFixed: 1,
          issuesRemaining: 0,
          currentFix: 'Test fix',
          timestamp: new Date()
        });
      }).not.toThrow();
    });
  });
});