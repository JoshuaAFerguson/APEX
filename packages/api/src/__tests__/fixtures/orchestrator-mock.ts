/**
 * Shared mock orchestrator fixture for API tests
 *
 * This mock includes all required exports from @apexcli/orchestrator
 * including DaemonManager, HealthMonitor, and the ApexOrchestrator class
 * with tool event simulation methods.
 */

import { vi } from 'vitest';

// Store the current orchestrator instance for test access
export let currentOrchestratorInstance: MockOrchestrator | null = null;

const createMockTask = (overrides: Partial<MockTask> = {}): MockTask => ({
  id: `task_${Date.now()}`,
  description: 'Test task',
  workflow: 'feature',
  autonomy: 'full',
  status: 'pending',
  priority: 'normal',
  effort: 'medium',
  projectPath: '/test',
  branchName: 'apex/test',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
  logs: [],
  artifacts: [],
  trashedAt: undefined,
  archivedAt: undefined,
  ...overrides,
});

interface MockTask {
  id: string;
  description: string;
  workflow: string;
  autonomy: string;
  status: string;
  priority: string;
  effort: string;
  projectPath: string;
  branchName: string;
  retryCount: number;
  maxRetries: number;
  resumeAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number };
  logs: never[];
  artifacts: never[];
  trashedAt: Date | undefined;
  archivedAt: Date | undefined;
}

export class MockOrchestrator {
  private tasks: Map<string, MockTask> = new Map();
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    // Store instance for test access
    currentOrchestratorInstance = this;
  }

  async initialize() {}

  async createTask(options: { description: string }) {
    const task = createMockTask({ description: options.description });
    this.tasks.set(task.id, task);
    return task;
  }

  async executeTask() {}

  async getTask(taskId: string) {
    return this.tasks.get(taskId) || null;
  }

  async listTasks() {
    return Array.from(this.tasks.values());
  }

  async updateTaskStatus(taskId: string, status: string) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
    }
  }

  // Additional mock methods
  async cancelTask() {
    return true;
  }
  async resumePausedTask() {
    return true;
  }
  async hasPendingSubtasks() {
    return false;
  }
  async continuePendingSubtasks() {}
  async getAgents() {
    return {};
  }
  async getConfig() {
    return { project: { name: 'test' } };
  }
  async approveGate() {}
  async rejectGate() {}
  async getAllGates() {
    return [];
  }
  async listMcpServers() {
    return [];
  }
  async getMcpServerDetails() {
    return null;
  }
  async installMcpServer() {
    return {};
  }
  async close() {}

  /**
   * Simulate a failed tool complete event with timing data
   */
  simulateFailedToolComplete(
    taskId: string,
    toolName: string,
    callId: string,
    errorMessage: string,
    durationMs: number = 100
  ) {
    const startTime = new Date(Date.now() - durationMs);
    const endTime = new Date();
    const event = {
      taskId,
      toolName,
      callId,
      result: {
        success: false,
        error: errorMessage,
      },
      timing: {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      },
      timestamp: new Date(),
    };
    this.emit('tool:complete', event);
    return event;
  }

  /**
   * Simulate a tool start event
   */
  simulateToolStart(taskId: string, toolName: string, input: Record<string, unknown>, callId?: string) {
    const event = {
      taskId,
      toolName,
      input,
      timestamp: new Date(),
      callId: callId || `call_${Date.now()}`,
    };
    this.emit('tool:start', event);
    return event.callId;
  }

  /**
   * Simulate a tool progress event
   */
  simulateToolProgress(
    taskId: string,
    toolName: string,
    callId: string,
    progress: { message: string; percentage?: number }
  ) {
    const event = {
      taskId,
      toolName,
      callId,
      progress,
      timestamp: new Date(),
    };
    this.emit('tool:progress', event);
  }

  /**
   * Simulate a successful tool complete event
   */
  simulateToolComplete(
    taskId: string,
    toolName: string,
    callId: string,
    result: { success: boolean; output?: unknown; error?: string },
    durationMs: number = 1000
  ) {
    const startTime = new Date(Date.now() - durationMs);
    const endTime = new Date();
    const event = {
      taskId,
      toolName,
      callId,
      result,
      timing: {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      },
      timestamp: new Date(),
    };
    this.emit('tool:complete', event);
  }

  // Event emitter functionality
  on(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

/**
 * Mock DaemonManager for API tests
 */
export class MockDaemonManager {
  async getStatus() {
    return { running: false, uptime: 0 };
  }
  async start() {
    return true;
  }
  async stop() {
    return true;
  }
  async restart() {
    return true;
  }
}

/**
 * Mock HealthMonitor for API tests
 */
export class MockHealthMonitor {
  getMetrics() {
    return {
      uptime: 0,
      memoryUsage: process.memoryUsage(),
      taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
      lastHealthCheck: new Date(),
      healthChecksPassed: 0,
      healthChecksFailed: 0,
    };
  }
  checkHealth() {
    return { healthy: true };
  }
}

/**
 * Get the complete mock object for vi.mock('@apexcli/orchestrator')
 */
export function getOrchestratorMock() {
  return {
    ApexOrchestrator: MockOrchestrator,
    DaemonManager: MockDaemonManager,
    HealthMonitor: MockHealthMonitor,
    ToolCallStartEvent: class {},
    ToolCallProgressEvent: class {},
    ToolCallCompleteEvent: class {},
  };
}

/**
 * Reset the current orchestrator instance (call in afterEach)
 */
export function resetOrchestratorMock() {
  currentOrchestratorInstance = null;
}

/**
 * Get the current mock orchestrator instance
 */
export function getCurrentOrchestrator(): MockOrchestrator | null {
  return currentOrchestratorInstance;
}
