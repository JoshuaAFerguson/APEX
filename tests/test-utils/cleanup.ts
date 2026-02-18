/**
 * Cleanup utilities for testing
 * Provides utilities for cleaning up test resources, files, processes, and state
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { vi } from 'vitest';

/**
 * Interface for cleanup strategies
 */
export interface CleanupStrategy {
  cleanup(): Promise<void> | void;
  description?: string;
}

/**
 * Registry for managing cleanup operations
 */
export class CleanupRegistry {
  private strategies: CleanupStrategy[] = [];
  private isCleanedUp = false;

  /**
   * Register a cleanup strategy
   */
  register(strategy: CleanupStrategy): void {
    if (this.isCleanedUp) {
      console.warn('Attempting to register cleanup after cleanup has already been performed');
      return;
    }
    this.strategies.push(strategy);
  }

  /**
   * Register a simple cleanup function
   */
  add(cleanup: () => void | Promise<void>, description?: string): void {
    this.register({
      cleanup,
      description,
    });
  }

  /**
   * Execute all registered cleanup strategies
   */
  async cleanup(): Promise<void> {
    if (this.isCleanedUp) {
      return;
    }

    const errors: Error[] = [];

    // Execute cleanup strategies in reverse order (LIFO)
    for (let i = this.strategies.length - 1; i >= 0; i--) {
      const strategy = this.strategies[i];
      try {
        await strategy.cleanup();
      } catch (error) {
        const errorMessage = `Cleanup failed${strategy.description ? ` for ${strategy.description}` : ''}: ${error}`;
        errors.push(new Error(errorMessage));
      }
    }

    this.isCleanedUp = true;
    this.strategies.length = 0;

    if (errors.length > 0) {
      const combinedMessage = errors.map(e => e.message).join('\n');
      throw new Error(`Multiple cleanup errors:\n${combinedMessage}`);
    }
  }

  /**
   * Get the number of registered cleanup strategies
   */
  get count(): number {
    return this.strategies.length;
  }

  /**
   * Check if cleanup has been performed
   */
  get cleanedUp(): boolean {
    return this.isCleanedUp;
  }
}

/**
 * File system cleanup utilities
 */
export class FileSystemCleanup {
  private pathsToClean: string[] = [];

  /**
   * Track a file or directory for cleanup
   */
  track(filePath: string): void {
    this.pathsToClean.push(filePath);
  }

  /**
   * Clean up all tracked files and directories
   */
  async cleanup(): Promise<void> {
    const errors: Error[] = [];

    for (const filePath of this.pathsToClean) {
      try {
        await this.cleanupPath(filePath);
      } catch (error) {
        errors.push(new Error(`Failed to cleanup ${filePath}: ${error}`));
      }
    }

    this.pathsToClean.length = 0;

    if (errors.length > 0) {
      throw new Error(`File cleanup errors: ${errors.map(e => e.message).join('; ')}`);
    }
  }

  /**
   * Clean up a specific path
   */
  private async cleanupPath(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // Path doesn't exist, no need to clean up
    }
  }

  /**
   * Create a temporary directory and track it for cleanup
   */
  async createTempDir(prefix: string = 'test'): Promise<string> {
    const os = await import('os');
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
    this.track(tempDir);
    return tempDir;
  }

  /**
   * Create a temporary file and track it for cleanup
   */
  async createTempFile(fileName: string, content: string = '', dir?: string): Promise<string> {
    const fileDir = dir || (await this.createTempDir('test-file'));
    const filePath = path.join(fileDir, fileName);
    await fs.writeFile(filePath, content);
    this.track(filePath);
    return filePath;
  }
}

/**
 * Process cleanup utilities
 */
export class ProcessCleanup {
  private processes: Array<{ kill: () => void; description: string }> = [];

  /**
   * Track a process for cleanup
   */
  track(process: { kill: () => void }, description: string): void {
    this.processes.push({ kill: process.kill.bind(process), description });
  }

  /**
   * Clean up all tracked processes
   */
  cleanup(): void {
    for (const process of this.processes) {
      try {
        process.kill();
      } catch (error) {
        console.warn(`Failed to kill process ${process.description}:`, error);
      }
    }
    this.processes.length = 0;
  }
}

/**
 * Environment cleanup utilities
 */
export class EnvironmentCleanup {
  private originalEnv: Record<string, string | undefined> = {};
  private envKeysToDelete: string[] = [];

  /**
   * Set an environment variable and track it for cleanup
   */
  setEnv(key: string, value: string): void {
    if (!(key in this.originalEnv)) {
      this.originalEnv[key] = process.env[key];
    }
    process.env[key] = value;
  }

  /**
   * Delete an environment variable and track it for cleanup
   */
  deleteEnv(key: string): void {
    if (!(key in this.originalEnv)) {
      this.originalEnv[key] = process.env[key];
    }
    delete process.env[key];
    this.envKeysToDelete.push(key);
  }

  /**
   * Restore all environment variables to their original state
   */
  cleanup(): void {
    for (const [key, originalValue] of Object.entries(this.originalEnv)) {
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }

    this.originalEnv = {};
    this.envKeysToDelete.length = 0;
  }
}

/**
 * Mock cleanup utilities
 */
export class MockCleanup {
  private mocks: Array<{ restore: () => void; description: string }> = [];

  /**
   * Track a mock for cleanup
   */
  track(mock: { mockRestore?: () => void; mockClear?: () => void }, description: string): void {
    const restore = () => {
      if (mock.mockRestore) {
        mock.mockRestore();
      } else if (mock.mockClear) {
        mock.mockClear();
      }
    };
    this.mocks.push({ restore, description });
  }

  /**
   * Track a vitest spy for cleanup
   */
  trackSpy(spy: ReturnType<typeof vi.spyOn>, description: string): void {
    this.mocks.push({
      restore: () => spy.mockRestore(),
      description,
    });
  }

  /**
   * Clean up all tracked mocks
   */
  cleanup(): void {
    for (const mock of this.mocks) {
      try {
        mock.restore();
      } catch (error) {
        console.warn(`Failed to restore mock ${mock.description}:`, error);
      }
    }
    this.mocks.length = 0;
    vi.clearAllMocks();
  }
}

/**
 * Timer cleanup utilities
 */
export class TimerCleanup {
  private timers: Array<{ clear: () => void; type: string; id: any }> = [];

  /**
   * Track a setTimeout for cleanup
   */
  trackTimeout(timerId: NodeJS.Timeout): void {
    this.timers.push({
      clear: () => clearTimeout(timerId),
      type: 'timeout',
      id: timerId,
    });
  }

  /**
   * Track a setInterval for cleanup
   */
  trackInterval(timerId: NodeJS.Timeout): void {
    this.timers.push({
      clear: () => clearInterval(timerId),
      type: 'interval',
      id: timerId,
    });
  }

  /**
   * Clean up all tracked timers
   */
  cleanup(): void {
    for (const timer of this.timers) {
      try {
        timer.clear();
      } catch (error) {
        console.warn(`Failed to clear ${timer.type} timer:`, error);
      }
    }
    this.timers.length = 0;
  }
}

/**
 * Comprehensive cleanup manager that combines all cleanup strategies
 */
export class CleanupManager {
  public readonly registry = new CleanupRegistry();
  public readonly fileSystem = new FileSystemCleanup();
  public readonly processes = new ProcessCleanup();
  public readonly environment = new EnvironmentCleanup();
  public readonly mocks = new MockCleanup();
  public readonly timers = new TimerCleanup();

  constructor() {
    // Register all cleanup strategies
    this.registry.add(() => this.fileSystem.cleanup(), 'FileSystem');
    this.registry.add(() => this.processes.cleanup(), 'Processes');
    this.registry.add(() => this.environment.cleanup(), 'Environment');
    this.registry.add(() => this.mocks.cleanup(), 'Mocks');
    this.registry.add(() => this.timers.cleanup(), 'Timers');
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    await this.registry.cleanup();
  }

  /**
   * Add a custom cleanup function
   */
  add(cleanup: () => void | Promise<void>, description?: string): void {
    this.registry.add(cleanup, description);
  }
}

/**
 * Create a cleanup manager for a test
 */
export function createCleanupManager(): CleanupManager {
  return new CleanupManager();
}

/**
 * Global cleanup registry for test files
 */
let globalCleanupRegistry: CleanupRegistry | null = null;

/**
 * Get or create the global cleanup registry
 */
export function getGlobalCleanupRegistry(): CleanupRegistry {
  if (!globalCleanupRegistry) {
    globalCleanupRegistry = new CleanupRegistry();
  }
  return globalCleanupRegistry;
}

/**
 * Register a cleanup function globally
 */
export function registerGlobalCleanup(
  cleanup: () => void | Promise<void>,
  description?: string
): void {
  getGlobalCleanupRegistry().add(cleanup, description);
}

/**
 * Clean up all global resources
 */
export async function cleanupGlobal(): Promise<void> {
  if (globalCleanupRegistry) {
    await globalCleanupRegistry.cleanup();
    globalCleanupRegistry = null;
  }
}

/**
 * Utility to ensure cleanup happens even if tests fail
 */
export async function withCleanup<T>(
  operation: (cleanup: CleanupManager) => Promise<T>
): Promise<T> {
  const cleanupManager = createCleanupManager();

  try {
    return await operation(cleanupManager);
  } finally {
    try {
      await cleanupManager.cleanup();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
}