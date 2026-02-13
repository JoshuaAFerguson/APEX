/**
 * Test Worker Coordination Utilities
 *
 * Utilities for coordinating multiple test workers during parallel execution.
 * Provides mechanisms for synchronization, communication, and resource sharing
 * between test workers without interference.
 *
 * @module tests/test-utils/worker-coordination
 */

import { EventEmitter } from 'events';
import { AsyncMutex, Semaphore, Barrier, coordination } from './parallel-coordination';

/**
 * Options for creating a worker coordinator
 */
export interface WorkerCoordinatorOptions {
  /** Maximum number of workers to coordinate */
  maxWorkers?: number;
  /** Timeout for coordination operations in milliseconds */
  timeout?: number;
  /** Worker identification strategy */
  workerIdStrategy?: 'process' | 'thread' | 'random' | 'custom';
  /** Custom worker ID (when using 'custom' strategy) */
  customWorkerId?: string;
}

/**
 * Worker information
 */
export interface WorkerInfo {
  /** Unique worker identifier */
  id: string;
  /** Process ID */
  processId: number;
  /** Thread/worker ID from test runner */
  threadId: string;
  /** Start time */
  startTime: Date;
  /** Current status */
  status: 'active' | 'waiting' | 'completed' | 'error';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Message between workers
 */
export interface WorkerMessage {
  /** Source worker ID */
  fromWorkerId: string;
  /** Target worker ID (or 'broadcast' for all) */
  toWorkerId: string;
  /** Message type */
  type: string;
  /** Message payload */
  payload?: unknown;
  /** Timestamp */
  timestamp: Date;
  /** Message ID for tracking */
  messageId: string;
}

/**
 * Worker coordination events
 */
export interface WorkerCoordinatorEvents {
  'worker-joined': (worker: WorkerInfo) => void;
  'worker-left': (workerId: string) => void;
  'message': (message: WorkerMessage) => void;
  'broadcast': (message: WorkerMessage) => void;
  'barrier-reached': (barrierId: string, workerId: string) => void;
  'resource-acquired': (resourceId: string, workerId: string) => void;
  'resource-released': (resourceId: string, workerId: string) => void;
}

/**
 * Central coordinator for multiple test workers
 */
export class WorkerCoordinator extends EventEmitter {
  private static instance: WorkerCoordinator | null = null;
  private workers = new Map<string, WorkerInfo>();
  private messages: WorkerMessage[] = [];
  private barriers = new Map<string, Barrier>();
  private mutexes = new Map<string, AsyncMutex>();
  private semaphores = new Map<string, Semaphore>();
  private readonly options: Required<WorkerCoordinatorOptions>;
  private readonly workerId: string;
  private globalMutex = new AsyncMutex();

  constructor(options: WorkerCoordinatorOptions = {}) {
    super();
    this.options = {
      maxWorkers: options.maxWorkers ?? 10,
      timeout: options.timeout ?? 30000,
      workerIdStrategy: options.workerIdStrategy ?? 'process',
      customWorkerId: options.customWorkerId ?? '',
    };

    this.workerId = this.generateWorkerId();
    this.setMaxListeners(100); // Allow many listeners for coordination
  }

  /**
   * Get the global worker coordinator instance (singleton)
   */
  static getInstance(options?: WorkerCoordinatorOptions): WorkerCoordinator {
    if (!WorkerCoordinator.instance) {
      WorkerCoordinator.instance = new WorkerCoordinator(options);
    }
    return WorkerCoordinator.instance;
  }

  /**
   * Reset the global instance (for testing)
   */
  static resetInstance(): void {
    if (WorkerCoordinator.instance) {
      WorkerCoordinator.instance.cleanup();
      WorkerCoordinator.instance = null;
    }
  }

  /**
   * Get the current worker ID
   */
  getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Join the coordination as a worker
   */
  async joinAsWorker(metadata?: Record<string, unknown>): Promise<void> {
    return this.globalMutex.runExclusive(async () => {
      if (this.workers.size >= this.options.maxWorkers) {
        throw new Error(`Maximum workers (${this.options.maxWorkers}) already joined`);
      }

      const worker: WorkerInfo = {
        id: this.workerId,
        processId: process.pid,
        threadId: process.env.VITEST_WORKER_ID || '0',
        startTime: new Date(),
        status: 'active',
        metadata,
      };

      this.workers.set(this.workerId, worker);
      this.emit('worker-joined', worker);
    });
  }

  /**
   * Leave the coordination
   */
  async leaveAsWorker(): Promise<void> {
    return this.globalMutex.runExclusive(async () => {
      if (this.workers.has(this.workerId)) {
        this.workers.delete(this.workerId);
        this.emit('worker-left', this.workerId);
      }
    });
  }

  /**
   * Get information about all active workers
   */
  async getWorkers(): Promise<WorkerInfo[]> {
    return this.globalMutex.runExclusive(async () => {
      return Array.from(this.workers.values());
    });
  }

  /**
   * Get information about a specific worker
   */
  async getWorker(workerId: string): Promise<WorkerInfo | undefined> {
    return this.globalMutex.runExclusive(async () => {
      return this.workers.get(workerId);
    });
  }

  /**
   * Send a message to another worker
   */
  async sendMessage(
    toWorkerId: string,
    type: string,
    payload?: unknown
  ): Promise<void> {
    const message: WorkerMessage = {
      fromWorkerId: this.workerId,
      toWorkerId,
      type,
      payload,
      timestamp: new Date(),
      messageId: this.generateMessageId(),
    };

    return this.globalMutex.runExclusive(async () => {
      this.messages.push(message);
      if (toWorkerId === 'broadcast') {
        this.emit('broadcast', message);
      } else {
        this.emit('message', message);
      }
    });
  }

  /**
   * Broadcast a message to all workers
   */
  async broadcastMessage(type: string, payload?: unknown): Promise<void> {
    return this.sendMessage('broadcast', type, payload);
  }

  /**
   * Get messages for this worker
   */
  async getMessages(type?: string): Promise<WorkerMessage[]> {
    return this.globalMutex.runExclusive(async () => {
      return this.messages.filter(msg =>
        (msg.toWorkerId === this.workerId || msg.toWorkerId === 'broadcast') &&
        (!type || msg.type === type)
      );
    });
  }

  /**
   * Wait for a message of a specific type
   */
  async waitForMessage(
    type: string,
    fromWorkerId?: string,
    timeoutMs?: number
  ): Promise<WorkerMessage> {
    const timeout = timeoutMs ?? this.options.timeout;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeListener('message', messageHandler);
        this.removeListener('broadcast', messageHandler);
        reject(new Error(`Timeout waiting for message of type '${type}'`));
      }, timeout);

      const messageHandler = (message: WorkerMessage) => {
        if (message.type === type &&
            (message.toWorkerId === this.workerId || message.toWorkerId === 'broadcast') &&
            (!fromWorkerId || message.fromWorkerId === fromWorkerId)) {
          clearTimeout(timeoutId);
          this.removeListener('message', messageHandler);
          this.removeListener('broadcast', messageHandler);
          resolve(message);
        }
      };

      this.on('message', messageHandler);
      this.on('broadcast', messageHandler);
    });
  }

  /**
   * Create or get a barrier for worker synchronization
   */
  async createBarrier(barrierId: string, parties: number): Promise<Barrier> {
    return this.globalMutex.runExclusive(async () => {
      if (!this.barriers.has(barrierId)) {
        this.barriers.set(barrierId, new Barrier(parties));
      }
      return this.barriers.get(barrierId)!;
    });
  }

  /**
   * Wait at a barrier until all workers arrive
   */
  async waitAtBarrier(barrierId: string, parties?: number): Promise<void> {
    const barrier = await this.createBarrier(barrierId, parties ?? this.workers.size);
    this.emit('barrier-reached', barrierId, this.workerId);
    await barrier.wait();
  }

  /**
   * Create or get a mutex for resource coordination
   */
  async createMutex(mutexId: string): Promise<AsyncMutex> {
    return this.globalMutex.runExclusive(async () => {
      if (!this.mutexes.has(mutexId)) {
        this.mutexes.set(mutexId, new AsyncMutex());
      }
      return this.mutexes.get(mutexId)!;
    });
  }

  /**
   * Acquire exclusive access to a resource
   */
  async acquireResource(resourceId: string): Promise<void> {
    const mutex = await this.createMutex(resourceId);
    await mutex.acquire();
    this.emit('resource-acquired', resourceId, this.workerId);
  }

  /**
   * Release exclusive access to a resource
   */
  async releaseResource(resourceId: string): Promise<void> {
    const mutex = this.mutexes.get(resourceId);
    if (!mutex) {
      throw new Error(`Resource '${resourceId}' was not acquired`);
    }
    mutex.release();
    this.emit('resource-released', resourceId, this.workerId);
  }

  /**
   * Use a resource exclusively
   */
  async useResource<T>(
    resourceId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    await this.acquireResource(resourceId);
    try {
      return await fn();
    } finally {
      await this.releaseResource(resourceId);
    }
  }

  /**
   * Create or get a semaphore for limited resource access
   */
  async createSemaphore(semaphoreId: string, permits: number): Promise<Semaphore> {
    return this.globalMutex.runExclusive(async () => {
      if (!this.semaphores.has(semaphoreId)) {
        this.semaphores.set(semaphoreId, new Semaphore(permits));
      }
      return this.semaphores.get(semaphoreId)!;
    });
  }

  /**
   * Acquire limited resource access
   */
  async acquireLimitedResource(resourceId: string, permits = 1): Promise<void> {
    const semaphore = this.semaphores.get(resourceId);
    if (!semaphore) {
      throw new Error(`Semaphore '${resourceId}' does not exist`);
    }
    await semaphore.acquire();
  }

  /**
   * Release limited resource access
   */
  async releaseLimitedResource(resourceId: string): Promise<void> {
    const semaphore = this.semaphores.get(resourceId);
    if (!semaphore) {
      throw new Error(`Semaphore '${resourceId}' does not exist`);
    }
    semaphore.release();
  }

  /**
   * Update worker status
   */
  async updateStatus(status: WorkerInfo['status']): Promise<void> {
    return this.globalMutex.runExclusive(async () => {
      const worker = this.workers.get(this.workerId);
      if (worker) {
        worker.status = status;
      }
    });
  }

  /**
   * Clean up all coordination resources
   */
  cleanup(): void {
    this.workers.clear();
    this.messages = [];
    this.barriers.clear();
    this.mutexes.clear();
    this.semaphores.clear();
    this.removeAllListeners();
  }

  /**
   * Generate a unique worker ID based on strategy
   */
  private generateWorkerId(): string {
    switch (this.options.workerIdStrategy) {
      case 'process':
        return `worker_${process.pid}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      case 'thread':
        return `worker_${process.env.VITEST_WORKER_ID || '0'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      case 'custom':
        return this.options.customWorkerId || `worker_custom_${Date.now()}`;
      case 'random':
      default:
        return `worker_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Utility functions for worker coordination
 */
export const workerUtils = {
  /**
   * Get the global worker coordinator
   */
  getCoordinator: (options?: WorkerCoordinatorOptions) =>
    WorkerCoordinator.getInstance(options),

  /**
   * Create a scoped coordination context for a test
   */
  createScopedCoordination: async (testId: string) => {
    const coordinator = WorkerCoordinator.getInstance();

    return {
      coordinator,
      testId,
      sendMessage: (toWorkerId: string, type: string, payload?: unknown) =>
        coordinator.sendMessage(toWorkerId, `${testId}:${type}`, payload),
      broadcastMessage: (type: string, payload?: unknown) =>
        coordinator.broadcastMessage(`${testId}:${type}`, payload),
      waitForMessage: (type: string, fromWorkerId?: string, timeoutMs?: number) =>
        coordinator.waitForMessage(`${testId}:${type}`, fromWorkerId, timeoutMs),
      waitAtBarrier: (barrierId: string, parties?: number) =>
        coordinator.waitAtBarrier(`${testId}:${barrierId}`, parties),
      useResource: <T>(resourceId: string, fn: () => Promise<T>) =>
        coordinator.useResource(`${testId}:${resourceId}`, fn),
    };
  },

  /**
   * Wait for all workers to reach a synchronization point
   */
  synchronizeWorkers: async (syncId: string, expectedWorkers?: number) => {
    const coordinator = WorkerCoordinator.getInstance();
    const workers = await coordinator.getWorkers();
    const workerCount = expectedWorkers ?? workers.length;
    await coordinator.waitAtBarrier(syncId, workerCount);
  },

  /**
   * Coordinate a test phase across all workers
   */
  coordinateTestPhase: async (
    phase: string,
    phaseFn: () => Promise<void>,
    expectedWorkers?: number
  ) => {
    const coordinator = WorkerCoordinator.getInstance();

    // Signal phase start
    await coordinator.broadcastMessage(`phase:${phase}:start`);

    // Wait for all workers to be ready
    await workerUtils.synchronizeWorkers(`phase:${phase}:ready`, expectedWorkers);

    // Execute the phase
    try {
      await phaseFn();
      await coordinator.broadcastMessage(`phase:${phase}:success`);
    } catch (error) {
      await coordinator.broadcastMessage(`phase:${phase}:error`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    // Wait for all workers to complete
    await workerUtils.synchronizeWorkers(`phase:${phase}:complete`, expectedWorkers);
  },
};

/**
 * Default export for convenience
 */
export default {
  WorkerCoordinator,
  workerUtils,
};