/**
 * Parallel Test Coordination Utilities
 *
 * Provides mutex, semaphore, and other coordination primitives for parallel test execution.
 * These utilities help prevent race conditions and coordinate access to shared resources
 * during parallel test runs.
 *
 * @module tests/test-utils/parallel-coordination
 */

/**
 * Async mutex implementation for test coordination
 *
 * Provides mutual exclusion to ensure only one test can access
 * a critical section at a time.
 */
export class AsyncMutex {
  private locked = false;
  private waiting: Array<() => void> = [];

  /**
   * Check if the mutex is currently locked
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get the number of operations waiting for the lock
   */
  getWaitingCount(): number {
    return this.waiting.length;
  }

  /**
   * Acquire the mutex lock
   *
   * @returns Promise that resolves when the lock is acquired
   */
  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  /**
   * Release the mutex lock
   *
   * Allows the next waiting operation to proceed.
   */
  release(): void {
    if (!this.locked) {
      throw new Error('Mutex is not locked');
    }

    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }

  /**
   * Run a function exclusively with the mutex
   *
   * @param fn - Function to run with exclusive access
   * @returns Promise resolving to the function's return value
   */
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Try to acquire the lock without waiting
   *
   * @returns true if lock was acquired, false if already locked
   */
  tryAcquire(): boolean {
    if (this.locked) {
      return false;
    }
    this.locked = true;
    return true;
  }

  /**
   * Acquire the lock with a timeout
   *
   * @param timeoutMs - Timeout in milliseconds
   * @returns Promise resolving to true if acquired, false if timed out
   */
  async acquireWithTimeout(timeoutMs: number): Promise<boolean> {
    return Promise.race([
      this.acquire().then(() => true),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  }
}

/**
 * Semaphore implementation for controlling concurrent access
 *
 * Allows a specified number of operations to run concurrently.
 */
export class Semaphore {
  private permits: number;
  private readonly maxPermits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    if (permits < 0) {
      throw new Error('Permits must be non-negative');
    }
    this.permits = permits;
    this.maxPermits = permits;
  }

  /**
   * Get the current number of available permits
   */
  getAvailablePermits(): number {
    return this.permits;
  }

  /**
   * Get the maximum number of permits
   */
  getLimit(): number {
    return this.maxPermits;
  }

  /**
   * Get the number of operations waiting for permits
   */
  getWaitingCount(): number {
    return this.waiting.length;
  }

  /**
   * Acquire a permit
   *
   * @returns Promise that resolves when a permit is available
   */
  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  /**
   * Release a permit
   *
   * Allows the next waiting operation to proceed.
   */
  release(): void {
    if (this.permits >= this.maxPermits) {
      throw new Error('Cannot release more permits than the maximum');
    }

    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    } else {
      this.permits++;
    }
  }

  /**
   * Try to acquire a permit without waiting
   *
   * @returns true if permit was acquired, false if none available
   */
  tryAcquire(): boolean {
    if (this.permits > 0) {
      this.permits--;
      return true;
    }
    return false;
  }

  /**
   * Acquire a permit with a timeout
   *
   * @param timeoutMs - Timeout in milliseconds
   * @returns Promise resolving to true if acquired, false if timed out
   */
  async acquireWithTimeout(timeoutMs: number): Promise<boolean> {
    return Promise.race([
      this.acquire().then(() => true),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  }

  /**
   * Acquire multiple permits at once
   *
   * @param count - Number of permits to acquire
   */
  async acquireMultiple(count: number): Promise<void> {
    if (count < 1) {
      throw new Error('Must acquire at least 1 permit');
    }
    if (count > this.maxPermits) {
      throw new Error('Cannot acquire more permits than the maximum');
    }

    for (let i = 0; i < count; i++) {
      await this.acquire();
    }
  }

  /**
   * Release multiple permits at once
   *
   * @param count - Number of permits to release
   */
  releaseMultiple(count: number): void {
    if (count < 1) {
      throw new Error('Must release at least 1 permit');
    }

    for (let i = 0; i < count; i++) {
      this.release();
    }
  }
}

/**
 * Read-Write lock implementation
 *
 * Allows multiple concurrent readers but exclusive writers.
 */
export class ReadWriteLock {
  private readers = 0;
  private writer = false;
  private readWaiting: Array<() => void> = [];
  private writeWaiting: Array<() => void> = [];

  /**
   * Get current lock state
   */
  getState(): { readers: number; writer: boolean; readWaiting: number; writeWaiting: number } {
    return {
      readers: this.readers,
      writer: this.writer,
      readWaiting: this.readWaiting.length,
      writeWaiting: this.writeWaiting.length,
    };
  }

  /**
   * Acquire a read lock
   */
  async acquireRead(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.writer && this.writeWaiting.length === 0) {
        this.readers++;
        resolve();
      } else {
        this.readWaiting.push(resolve);
      }
    });
  }

  /**
   * Release a read lock
   */
  releaseRead(): void {
    if (this.readers === 0) {
      throw new Error('No read locks to release');
    }

    this.readers--;
    if (this.readers === 0 && this.writeWaiting.length > 0) {
      const next = this.writeWaiting.shift()!;
      this.writer = true;
      next();
    }
  }

  /**
   * Acquire a write lock
   */
  async acquireWrite(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.writer && this.readers === 0) {
        this.writer = true;
        resolve();
      } else {
        this.writeWaiting.push(resolve);
      }
    });
  }

  /**
   * Release a write lock
   */
  releaseWrite(): void {
    if (!this.writer) {
      throw new Error('No write lock to release');
    }

    this.writer = false;

    // Prioritize waiting writers over readers
    if (this.writeWaiting.length > 0) {
      const next = this.writeWaiting.shift()!;
      this.writer = true;
      next();
    } else if (this.readWaiting.length > 0) {
      // Allow all waiting readers to proceed
      while (this.readWaiting.length > 0) {
        const next = this.readWaiting.shift()!;
        this.readers++;
        next();
      }
    }
  }

  /**
   * Run a function with a read lock
   */
  async runWithReadLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireRead();
    try {
      return await fn();
    } finally {
      this.releaseRead();
    }
  }

  /**
   * Run a function with a write lock
   */
  async runWithWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireWrite();
    try {
      return await fn();
    } finally {
      this.releaseWrite();
    }
  }
}

/**
 * Coordination barrier for synchronizing multiple workers
 *
 * Allows multiple workers to wait until all reach a synchronization point.
 */
export class Barrier {
  private readonly parties: number;
  private arrived = 0;
  private waiting: Array<() => void> = [];

  constructor(parties: number) {
    if (parties < 1) {
      throw new Error('Barrier must have at least 1 party');
    }
    this.parties = parties;
  }

  /**
   * Get the number of parties required for the barrier
   */
  getParties(): number {
    return this.parties;
  }

  /**
   * Get the number of parties that have arrived
   */
  getArrivedCount(): number {
    return this.arrived;
  }

  /**
   * Get the number of parties still waiting
   */
  getWaitingCount(): number {
    return this.waiting.length;
  }

  /**
   * Wait at the barrier until all parties arrive
   */
  async wait(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.arrived++;
      this.waiting.push(resolve);

      if (this.arrived === this.parties) {
        // All parties have arrived, release everyone
        const allWaiting = [...this.waiting];
        this.waiting = [];
        this.arrived = 0;

        for (const waiter of allWaiting) {
          waiter();
        }
      }
    });
  }

  /**
   * Reset the barrier (useful for reusing the same barrier)
   */
  reset(): void {
    this.arrived = 0;
    // Note: This doesn't notify waiting parties - they'll continue waiting
    // Use with caution or create a new barrier instead
  }
}

/**
 * Utility functions for common coordination patterns
 */
export const coordination = {
  /**
   * Create a mutex for resource coordination
   */
  createMutex: () => new AsyncMutex(),

  /**
   * Create a semaphore with specified capacity
   */
  createSemaphore: (permits: number) => new Semaphore(permits),

  /**
   * Create a read-write lock
   */
  createReadWriteLock: () => new ReadWriteLock(),

  /**
   * Create a barrier for the specified number of parties
   */
  createBarrier: (parties: number) => new Barrier(parties),

  /**
   * Sleep for a specified number of milliseconds
   */
  sleep: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Wait for a condition to become true
   */
  waitFor: async (
    condition: () => boolean | Promise<boolean>,
    timeoutMs = 5000,
    intervalMs = 100
  ): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await condition()) {
        return true;
      }
      await coordination.sleep(intervalMs);
    }
    return false;
  },

  /**
   * Retry an operation with exponential backoff
   */
  retry: async <T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    initialDelayMs = 100,
    backoffMultiplier = 2
  ): Promise<T> => {
    let lastError: Error | undefined;
    let delay = initialDelayMs;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt <= maxRetries) {
          await coordination.sleep(delay);
          delay *= backoffMultiplier;
        }
      }
    }

    throw new Error(`Operation failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  },
};

/**
 * Default export for convenience
 */
export default {
  AsyncMutex,
  Semaphore,
  ReadWriteLock,
  Barrier,
  coordination,
};