/**
 * Parallel Test Execution Utilities
 *
 * Utilities to prevent test interference during parallel execution including:
 * - Unique database paths per test worker
 * - Isolated event emitter instances
 * - No shared mutable state
 * - Mutex/locking helpers for shared resources
 *
 * These utilities ensure tests can run safely in parallel without interfering
 * with each other's state or resources.
 *
 * @module tests/test-utils/parallel-execution
 */

import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { AsyncMutex, Semaphore } from './parallel-coordination';

/**
 * Options for creating worker-isolated resources
 */
export interface WorkerIsolationOptions {
  /** Worker ID or test name prefix */
  workerId?: string;
  /** Base directory for isolated resources */
  baseDir?: string;
  /** Whether to include timestamp in path */
  includeTimestamp?: boolean;
  /** Custom suffix for resource names */
  suffix?: string;
}

/**
 * Result of creating worker-isolated database path
 */
export interface WorkerDatabasePath {
  /** Full path to the isolated database file */
  path: string;
  /** Worker-specific directory */
  directory: string;
  /** Unique identifier used */
  workerId: string;
  /** Cleanup function to remove the database and directory */
  cleanup: () => Promise<void>;
}

/**
 * Isolated event emitter for test workers
 */
export class WorkerIsolatedEventEmitter extends EventEmitter {
  private readonly workerId: string;
  private readonly createdAt: Date;
  private listeners: Set<string> = new Set();

  constructor(workerId: string) {
    super();
    this.workerId = workerId;
    this.createdAt = new Date();
    this.setMaxListeners(100); // Increase default max listeners for tests
  }

  /**
   * Get the worker ID for this emitter
   */
  getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Get creation timestamp
   */
  getCreatedAt(): Date {
    return this.createdAt;
  }

  /**
   * Override on to track listeners for cleanup
   */
  override on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.listeners.add(String(eventName));
    return super.on(eventName, listener);
  }

  /**
   * Override addListener to track listeners for cleanup
   */
  override addListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.listeners.add(String(eventName));
    return super.addListener(eventName, listener);
  }

  /**
   * Get all tracked event names
   */
  getTrackedEvents(): string[] {
    return Array.from(this.listeners);
  }

  /**
   * Clean up all listeners and reset state
   */
  cleanupAll(): void {
    this.removeAllListeners();
    this.listeners.clear();
  }
}

/**
 * Global state manager for preventing shared mutable state
 */
class GlobalStateManager {
  private static instance: GlobalStateManager;
  private workerStates = new Map<string, Map<string, unknown>>();
  private mutex = new AsyncMutex();

  static getInstance(): GlobalStateManager {
    if (!GlobalStateManager.instance) {
      GlobalStateManager.instance = new GlobalStateManager();
    }
    return GlobalStateManager.instance;
  }

  /**
   * Get isolated state for a specific worker
   */
  async getWorkerState(workerId: string): Promise<Map<string, unknown>> {
    return this.mutex.runExclusive(async () => {
      if (!this.workerStates.has(workerId)) {
        this.workerStates.set(workerId, new Map<string, unknown>());
      }
      return this.workerStates.get(workerId)!;
    });
  }

  /**
   * Set state value for a worker
   */
  async setWorkerState(workerId: string, key: string, value: unknown): Promise<void> {
    return this.mutex.runExclusive(async () => {
      const state = await this.getWorkerState(workerId);
      state.set(key, value);
    });
  }

  /**
   * Get state value for a worker
   */
  async getWorkerStateValue(workerId: string, key: string): Promise<unknown> {
    return this.mutex.runExclusive(async () => {
      const state = await this.getWorkerState(workerId);
      return state.get(key);
    });
  }

  /**
   * Clear all state for a worker
   */
  async clearWorkerState(workerId: string): Promise<void> {
    return this.mutex.runExclusive(async () => {
      this.workerStates.delete(workerId);
    });
  }

  /**
   * Clear all state (for testing)
   */
  async clearAllState(): Promise<void> {
    return this.mutex.runExclusive(async () => {
      this.workerStates.clear();
    });
  }
}

/**
 * Generate a unique worker ID
 */
export function generateWorkerId(prefix = 'worker'): string {
  const processId = process.pid;
  const threadId = process.env.VITEST_WORKER_ID || '0';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${processId}_${threadId}_${timestamp}_${random}`;
}

/**
 * Create a unique database path for a test worker
 *
 * This ensures each test worker gets its own isolated database file,
 * preventing conflicts during parallel test execution.
 */
export async function createWorkerDatabasePath(
  options: WorkerIsolationOptions = {}
): Promise<WorkerDatabasePath> {
  const workerId = options.workerId || generateWorkerId();
  const baseDir = options.baseDir || path.join(os.tmpdir(), 'apex-test-dbs');
  const timestamp = options.includeTimestamp ? `_${Date.now()}` : '';
  const suffix = options.suffix ? `_${options.suffix}` : '';

  // Create worker-specific directory
  const workerDir = path.join(baseDir, `${workerId}${timestamp}${suffix}`);

  // Ensure directory exists
  const fs = await import('fs/promises');
  await fs.mkdir(workerDir, { recursive: true });

  // Create database file path
  const dbPath = path.join(workerDir, 'test.db');

  return {
    path: dbPath,
    directory: workerDir,
    workerId,
    cleanup: async () => {
      try {
        await fs.rm(workerDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors in tests
        console.warn(`Failed to cleanup worker database directory: ${error}`);
      }
    },
  };
}

/**
 * Create an isolated event emitter for a test worker
 *
 * This prevents event listener conflicts between parallel tests.
 */
export function createWorkerEventEmitter(workerId?: string): WorkerIsolatedEventEmitter {
  const id = workerId || generateWorkerId('emitter');
  return new WorkerIsolatedEventEmitter(id);
}

/**
 * Get isolated state manager for preventing shared mutable state
 */
export function getWorkerStateManager(): GlobalStateManager {
  return GlobalStateManager.getInstance();
}

/**
 * Create isolated state for a worker
 *
 * Returns functions to get/set state that is isolated to this worker.
 */
export async function createWorkerState(workerId?: string) {
  const id = workerId || generateWorkerId('state');
  const manager = getWorkerStateManager();

  return {
    workerId: id,
    get: async (key: string) => manager.getWorkerStateValue(id, key),
    set: async (key: string, value: unknown) => manager.setWorkerState(id, key, value),
    clear: async () => manager.clearWorkerState(id),
    getAll: async () => manager.getWorkerState(id),
  };
}

/**
 * Resource pool for managing shared resources with concurrency limits
 */
export class ResourcePool<T> {
  private resources: T[] = [];
  private semaphore: Semaphore;
  private createResource: () => Promise<T>;
  private destroyResource?: (resource: T) => Promise<void>;
  private inUse = new Set<T>();

  constructor(
    createResource: () => Promise<T>,
    maxConcurrent: number,
    destroyResource?: (resource: T) => Promise<void>
  ) {
    this.createResource = createResource;
    this.destroyResource = destroyResource;
    this.semaphore = new Semaphore(maxConcurrent);
  }

  /**
   * Acquire a resource from the pool
   */
  async acquire(): Promise<T> {
    await this.semaphore.acquire();

    let resource: T;
    if (this.resources.length > 0) {
      resource = this.resources.pop()!;
    } else {
      resource = await this.createResource();
    }

    this.inUse.add(resource);
    return resource;
  }

  /**
   * Release a resource back to the pool
   */
  async release(resource: T): Promise<void> {
    if (!this.inUse.has(resource)) {
      throw new Error('Resource was not acquired from this pool');
    }

    this.inUse.delete(resource);
    this.resources.push(resource);
    this.semaphore.release();
  }

  /**
   * Use a resource for a specific operation
   */
  async use<R>(fn: (resource: T) => Promise<R>): Promise<R> {
    const resource = await this.acquire();
    try {
      return await fn(resource);
    } finally {
      await this.release(resource);
    }
  }

  /**
   * Destroy all resources and clean up
   */
  async destroy(): Promise<void> {
    // Wait for all resources to be released
    for (let i = 0; i < this.semaphore.getLimit(); i++) {
      await this.semaphore.acquire();
    }

    // Destroy all resources
    const allResources = [...this.resources, ...this.inUse];
    if (this.destroyResource) {
      await Promise.all(allResources.map(r => this.destroyResource!(r)));
    }

    this.resources = [];
    this.inUse.clear();
  }

  /**
   * Get current pool statistics
   */
  getStats(): { available: number; inUse: number; total: number } {
    return {
      available: this.resources.length,
      inUse: this.inUse.size,
      total: this.resources.length + this.inUse.size,
    };
  }
}

/**
 * Create a resource pool for database connections
 */
export function createDatabasePool(
  createConnection: () => Promise<any>,
  maxConnections: number = 5,
  closeConnection?: (conn: any) => Promise<void>
): ResourcePool<any> {
  return new ResourcePool(createConnection, maxConnections, closeConnection);
}

/**
 * Parallel test utilities container
 */
export const parallelTestUtils = {
  generateWorkerId,
  createWorkerDatabasePath,
  createWorkerEventEmitter,
  createWorkerState,
  getWorkerStateManager,
  createDatabasePool,
  ResourcePool,
  WorkerIsolatedEventEmitter,
};

/**
 * Default export for convenience
 */
export default parallelTestUtils;