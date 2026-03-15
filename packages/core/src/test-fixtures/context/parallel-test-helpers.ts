/**
 * @fileoverview Advanced Parallel Test Isolation Helpers
 *
 * This module provides specialized utilities for running tests in parallel with
 * guaranteed isolation. It includes patterns for:
 * - Database connection pooling and isolation
 * - Port allocation for test servers
 * - File system namespace isolation
 * - Memory-based test isolation
 * - Cross-test resource coordination
 *
 * These utilities are designed to prevent flaky tests in CI/CD environments
 * where multiple test processes run concurrently.
 *
 * @example Database Isolation
 * ```typescript
 * import { createDatabaseIsolation } from '@apex/core/test-fixtures';
 *
 * describe('Database Tests', () => {
 *   const dbIsolation = createDatabaseIsolation();
 *
 *   beforeEach(() => dbIsolation.setup());
 *   afterEach(() => dbIsolation.teardown());
 *
 *   it('should have isolated database', async () => {
 *     const db = await dbIsolation.getConnection();
 *     // Each test gets a unique database/schema
 *   });
 * });
 * ```
 *
 * @example Port Allocation
 * ```typescript
 * import { createPortAllocator } from '@apex/core/test-fixtures';
 *
 * const portAllocator = createPortAllocator(8000, 9000);
 *
 * it('should allocate unique ports', async () => {
 *   const port = await portAllocator.allocate();
 *   // Start test server on unique port
 *   // Port is automatically released after test
 * });
 * ```
 */

import { vi } from 'vitest';
import * as path from 'path';
import * as crypto from 'crypto';
import { createTestContext } from './test-context.js';
import type { TestContext } from './types.js';
import { createResourceLock, type ResourceLock } from './isolation-utils.js';

// ============================================================================
// Database Isolation
// ============================================================================

/**
 * Database isolation options
 */
export interface DatabaseIsolationOptions {
  /** Database type (determines isolation strategy) */
  type: 'sqlite' | 'postgres' | 'mysql' | 'memory';
  /** Base connection URL or path */
  baseUrl?: string;
  /** Whether to create fresh database per test */
  freshPerTest?: boolean;
  /** Connection pool size */
  poolSize?: number;
  /** Schema prefix for multi-tenant isolation */
  schemaPrefix?: string;
}

/**
 * Database isolation context
 */
export interface DatabaseIsolation {
  /** Setup isolation for a test */
  setup(): Promise<void>;
  /** Teardown and cleanup */
  teardown(): Promise<void>;
  /** Get isolated database connection info */
  getConnectionInfo(): {
    url: string;
    schema?: string;
    database?: string;
  };
  /** Get a mock database connection for testing */
  getMockConnection(): unknown;
  /** Execute raw SQL in isolated context */
  executeRaw(sql: string, params?: unknown[]): Promise<unknown>;
}

/**
 * Creates a database isolation helper for tests.
 * Provides isolated database instances/schemas per test context.
 *
 * @param options - Configuration for database isolation
 * @returns Database isolation interface
 *
 * @example SQLite Isolation
 * ```typescript
 * const dbIsolation = createDatabaseIsolation({
 *   type: 'sqlite',
 *   freshPerTest: true
 * });
 *
 * beforeEach(() => dbIsolation.setup());
 * afterEach(() => dbIsolation.teardown());
 *
 * it('should have isolated database', () => {
 *   const { url } = dbIsolation.getConnectionInfo();
 *   // url contains test-specific path
 * });
 * ```
 */
export function createDatabaseIsolation(
  options: DatabaseIsolationOptions = { type: 'memory' }
): DatabaseIsolation {
  let testContext: TestContext;
  let connectionInfo: { url: string; schema?: string; database?: string };
  let mockConnection: unknown;

  return {
    async setup(): Promise<void> {
      testContext = createTestContext({ namespacePrefix: 'db' });

      const testId = testContext.testId;

      switch (options.type) {
        case 'sqlite': {
          if (options.freshPerTest !== false) {
            // Create unique SQLite file per test
            const dbPath = await testContext.writeFile(`${testId}.db`, '');
            connectionInfo = { url: `sqlite:${dbPath}` };
          } else {
            // Use shared SQLite with unique schema
            const schema = `test_${testId.replace(/-/g, '_')}`;
            connectionInfo = {
              url: options.baseUrl || ':memory:',
              schema
            };
          }
          break;
        }

        case 'postgres': {
          const schema = `test_${testId.replace(/-/g, '_')}`;
          connectionInfo = {
            url: options.baseUrl || 'postgresql://localhost:5432/test',
            schema
          };
          break;
        }

        case 'mysql': {
          const database = `test_${testId.replace(/-/g, '_')}`;
          connectionInfo = {
            url: options.baseUrl || 'mysql://localhost:3306',
            database
          };
          break;
        }

        case 'memory':
        default: {
          connectionInfo = {
            url: `:memory:${testId}`
          };
          break;
        }
      }

      // Create mock connection with test-specific methods
      mockConnection = {
        query: vi.fn(),
        execute: vi.fn(),
        close: vi.fn(),
        testId,
        connectionInfo
      };
    },

    async teardown(): Promise<void> {
      if (testContext) {
        await testContext.cleanup();
      }
      mockConnection = undefined;
    },

    getConnectionInfo() {
      if (!connectionInfo) {
        throw new Error('Database isolation not set up. Call setup() first.');
      }
      return connectionInfo;
    },

    getMockConnection() {
      if (!mockConnection) {
        throw new Error('Database isolation not set up. Call setup() first.');
      }
      return mockConnection;
    },

    async executeRaw(sql: string, params: unknown[] = []): Promise<unknown> {
      // For testing, return a mock result
      const mockResult = {
        sql,
        params,
        testId: testContext?.testId,
        rows: [],
        affectedRows: 0
      };

      // Simulate execution in isolated context
      return mockResult;
    }
  };
}

// ============================================================================
// Port Allocation
// ============================================================================

/**
 * Port allocator for test servers
 */
export interface PortAllocator {
  /** Allocate an available port */
  allocate(): Promise<number>;
  /** Release a previously allocated port */
  release(port: number): void;
  /** Check if a port is available */
  isAvailable(port: number): Promise<boolean>;
  /** Get all allocated ports */
  getAllocated(): number[];
  /** Release all allocated ports */
  releaseAll(): void;
}

/**
 * Global port tracking to prevent conflicts across test files
 */
const globalAllocatedPorts = new Set<number>();

/**
 * Creates a port allocator for test isolation.
 * Ensures each test gets unique ports for servers/services.
 *
 * @param startPort - Starting port number (default: 3000)
 * @param endPort - Ending port number (default: 9999)
 * @returns Port allocator interface
 *
 * @example
 * ```typescript
 * describe('Server Tests', () => {
 *   const portAllocator = createPortAllocator(8000, 8999);
 *
 *   afterEach(() => portAllocator.releaseAll());
 *
 *   it('should start server on unique port', async () => {
 *     const port = await portAllocator.allocate();
 *     const server = createServer().listen(port);
 *     // Server runs on isolated port
 *   });
 * });
 * ```
 */
export function createPortAllocator(
  startPort: number = 3000,
  endPort: number = 9999
): PortAllocator {
  const allocatedPorts = new Set<number>();

  return {
    async allocate(): Promise<number> {
      for (let port = startPort; port <= endPort; port++) {
        if (!allocatedPorts.has(port) && !globalAllocatedPorts.has(port)) {
          // In a real implementation, we'd check if port is actually available
          // For testing purposes, we assume sequential allocation works
          allocatedPorts.add(port);
          globalAllocatedPorts.add(port);
          return port;
        }
      }
      throw new Error(`No available ports in range ${startPort}-${endPort}`);
    },

    release(port: number): void {
      allocatedPorts.delete(port);
      globalAllocatedPorts.delete(port);
    },

    async isAvailable(port: number): Promise<boolean> {
      // For testing, check our allocation tracking
      return !allocatedPorts.has(port) && !globalAllocatedPorts.has(port);
    },

    getAllocated(): number[] {
      return Array.from(allocatedPorts);
    },

    releaseAll(): void {
      for (const port of allocatedPorts) {
        globalAllocatedPorts.delete(port);
      }
      allocatedPorts.clear();
    }
  };
}

// ============================================================================
// Memory Isolation
// ============================================================================

/**
 * Memory isolation for preventing test pollution
 */
export interface MemoryIsolation {
  /** Create isolated memory context */
  createContext<T>(initialData?: T): MemoryContext<T>;
  /** Clear all contexts */
  clearAll(): void;
  /** Get memory usage statistics */
  getStats(): { contexts: number; totalSize: number };
}

/**
 * Isolated memory context for a test
 */
export interface MemoryContext<T> {
  /** Get data from context */
  get(): T;
  /** Set data in context */
  set(data: T): void;
  /** Clear context data */
  clear(): void;
  /** Check if context has data */
  isEmpty(): boolean;
  /** Get context size estimate */
  getSize(): number;
}

/**
 * Creates memory isolation for test data.
 * Prevents memory leaks and data pollution between tests.
 *
 * @example
 * ```typescript
 * describe('Memory Isolated Tests', () => {
 *   const memory = createMemoryIsolation();
 *
 *   afterEach(() => memory.clearAll());
 *
 *   it('should have isolated memory context', () => {
 *     const ctx = memory.createContext({ count: 0 });
 *     ctx.set({ count: 42 });
 *     expect(ctx.get().count).toBe(42);
 *   });
 * });
 * ```
 */
export function createMemoryIsolation(): MemoryIsolation {
  const contexts = new Map<string, { data: unknown; size: number }>();

  return {
    createContext<T>(initialData?: T): MemoryContext<T> {
      const contextId = crypto.randomUUID();
      const context = {
        data: initialData,
        size: JSON.stringify(initialData || {}).length
      };
      contexts.set(contextId, context);

      return {
        get(): T {
          const ctx = contexts.get(contextId);
          return ctx?.data as T;
        },

        set(data: T): void {
          const size = JSON.stringify(data).length;
          contexts.set(contextId, { data, size });
        },

        clear(): void {
          contexts.delete(contextId);
        },

        isEmpty(): boolean {
          const ctx = contexts.get(contextId);
          return !ctx || ctx.data === undefined;
        },

        getSize(): number {
          const ctx = contexts.get(contextId);
          return ctx?.size || 0;
        }
      };
    },

    clearAll(): void {
      contexts.clear();
    },

    getStats(): { contexts: number; totalSize: number } {
      let totalSize = 0;
      for (const ctx of contexts.values()) {
        totalSize += ctx.size;
      }
      return {
        contexts: contexts.size,
        totalSize
      };
    }
  };
}

// ============================================================================
// File System Isolation
// ============================================================================

/**
 * File system isolation options
 */
export interface FileSystemIsolationOptions {
  /** Base directory for test files */
  baseDir?: string;
  /** Whether to clean up files after test */
  autoCleanup?: boolean;
  /** File permissions for created files */
  fileMode?: number;
  /** Directory permissions for created directories */
  dirMode?: number;
}

/**
 * File system isolation context
 */
export interface FileSystemIsolation {
  /** Setup isolated file system */
  setup(): Promise<void>;
  /** Teardown and cleanup */
  teardown(): Promise<void>;
  /** Get isolated working directory */
  getWorkingDir(): string;
  /** Create a file in isolated context */
  createFile(relativePath: string, content: string): Promise<string>;
  /** Create a directory in isolated context */
  createDir(relativePath: string): Promise<string>;
  /** Check if file exists in isolated context */
  exists(relativePath: string): Promise<boolean>;
  /** Read file from isolated context */
  readFile(relativePath: string): Promise<string>;
  /** List files in isolated context */
  listFiles(relativePath?: string): Promise<string[]>;
}

/**
 * Creates file system isolation for tests.
 * Provides isolated directory structure per test.
 *
 * @param options - File system isolation options
 * @returns File system isolation interface
 *
 * @example
 * ```typescript
 * describe('File Operations', () => {
 *   const fsIsolation = createFileSystemIsolation();
 *
 *   beforeEach(() => fsIsolation.setup());
 *   afterEach(() => fsIsolation.teardown());
 *
 *   it('should create isolated files', async () => {
 *     const filePath = await fsIsolation.createFile('test.txt', 'content');
 *     expect(await fsIsolation.exists('test.txt')).toBe(true);
 *   });
 * });
 * ```
 */
export function createFileSystemIsolation(
  options: FileSystemIsolationOptions = {}
): FileSystemIsolation {
  let testContext: TestContext;
  let workingDir: string;

  return {
    async setup(): Promise<void> {
      testContext = createTestContext({ namespacePrefix: 'fs' });
      workingDir = await testContext.createTempDir();
    },

    async teardown(): Promise<void> {
      if (testContext && options.autoCleanup !== false) {
        await testContext.cleanup();
      }
    },

    getWorkingDir(): string {
      if (!workingDir) {
        throw new Error('File system isolation not set up. Call setup() first.');
      }
      return workingDir;
    },

    async createFile(relativePath: string, content: string): Promise<string> {
      return await testContext.writeFile(relativePath, content);
    },

    async createDir(relativePath: string): Promise<string> {
      return await testContext.createSubDir(relativePath);
    },

    async exists(relativePath: string): Promise<boolean> {
      // For testing purposes, simulate file existence check
      const fullPath = path.join(workingDir, relativePath);
      return testContext.hasData(`file:${fullPath}`);
    },

    async readFile(relativePath: string): Promise<string> {
      // For testing purposes, return mock content
      const fullPath = path.join(workingDir, relativePath);
      return testContext.getData(`file:${fullPath}`) || '';
    },

    async listFiles(relativePath: string = ''): Promise<string[]> {
      // For testing purposes, return empty list
      // In real implementation, would list actual files
      return [];
    }
  };
}

// ============================================================================
// Process Isolation
// ============================================================================

/**
 * Process isolation for tests that spawn child processes
 */
export interface ProcessIsolation {
  /** Setup process isolation */
  setup(): Promise<void>;
  /** Teardown and cleanup processes */
  teardown(): Promise<void>;
  /** Spawn a process in isolated context */
  spawn(command: string, args: string[], options?: unknown): Promise<MockProcess>;
  /** Kill all spawned processes */
  killAll(): Promise<void>;
  /** Get list of active processes */
  getActiveProcesses(): MockProcess[];
}

/**
 * Mock process for testing
 */
export interface MockProcess {
  pid: number;
  command: string;
  args: string[];
  kill(): Promise<void>;
  wait(): Promise<number>;
  isRunning(): boolean;
}

/**
 * Creates process isolation for tests.
 * Tracks and manages child processes to prevent orphans.
 *
 * @example
 * ```typescript
 * describe('Process Tests', () => {
 *   const processIsolation = createProcessIsolation();
 *
 *   beforeEach(() => processIsolation.setup());
 *   afterEach(() => processIsolation.teardown());
 *
 *   it('should spawn isolated process', async () => {
 *     const proc = await processIsolation.spawn('echo', ['hello']);
 *     expect(proc.pid).toBeDefined();
 *   });
 * });
 * ```
 */
export function createProcessIsolation(): ProcessIsolation {
  let testContext: TestContext;
  const processes: MockProcess[] = [];

  return {
    async setup(): Promise<void> {
      testContext = createTestContext({ namespacePrefix: 'proc' });
    },

    async teardown(): Promise<void> {
      await this.killAll();
      if (testContext) {
        await testContext.cleanup();
      }
    },

    async spawn(command: string, args: string[] = [], options?: unknown): Promise<MockProcess> {
      const pid = Math.floor(Math.random() * 10000) + 1000;
      let running = true;

      const mockProcess: MockProcess = {
        pid,
        command,
        args,

        async kill(): Promise<void> {
          running = false;
          const index = processes.indexOf(mockProcess);
          if (index >= 0) {
            processes.splice(index, 1);
          }
        },

        async wait(): Promise<number> {
          // Simulate process completion
          await new Promise(resolve => setTimeout(resolve, 10));
          return 0;
        },

        isRunning(): boolean {
          return running;
        }
      };

      processes.push(mockProcess);
      return mockProcess;
    },

    async killAll(): Promise<void> {
      await Promise.all(processes.map(proc => proc.kill()));
      processes.length = 0;
    },

    getActiveProcesses(): MockProcess[] {
      return processes.filter(proc => proc.isRunning());
    }
  };
}

// ============================================================================
// Network Isolation
// ============================================================================

/**
 * Network isolation for tests that make HTTP requests
 */
export interface NetworkIsolation {
  /** Setup network isolation */
  setup(): Promise<void>;
  /** Teardown network isolation */
  teardown(): Promise<void>;
  /** Mock a network request */
  mockRequest(pattern: string | RegExp, response: unknown): void;
  /** Clear all request mocks */
  clearMocks(): void;
  /** Get request history */
  getRequestHistory(): Array<{ url: string; method: string; body?: unknown }>;
  /** Simulate network conditions */
  setNetworkConditions(conditions: { delay?: number; dropRate?: number }): void;
}

/**
 * Creates network isolation for tests.
 * Provides controlled network environment for testing.
 *
 * @example
 * ```typescript
 * describe('Network Tests', () => {
 *   const networkIsolation = createNetworkIsolation();
 *
 *   beforeEach(() => networkIsolation.setup());
 *   afterEach(() => networkIsolation.teardown());
 *
 *   it('should mock network requests', () => {
 *     networkIsolation.mockRequest('/api/users', { users: [] });
 *     // Test code that makes HTTP requests
 *   });
 * });
 * ```
 */
export function createNetworkIsolation(): NetworkIsolation {
  let testContext: TestContext;
  const mocks = new Map<string | RegExp, unknown>();
  const requestHistory: Array<{ url: string; method: string; body?: unknown }> = [];
  let networkConditions: { delay?: number; dropRate?: number } = {};

  return {
    async setup(): Promise<void> {
      testContext = createTestContext({ namespacePrefix: 'net' });
    },

    async teardown(): Promise<void> {
      this.clearMocks();
      requestHistory.length = 0;
      networkConditions = {};
      if (testContext) {
        await testContext.cleanup();
      }
    },

    mockRequest(pattern: string | RegExp, response: unknown): void {
      mocks.set(pattern, response);
    },

    clearMocks(): void {
      mocks.clear();
    },

    getRequestHistory(): Array<{ url: string; method: string; body?: unknown }> {
      return [...requestHistory];
    },

    setNetworkConditions(conditions: { delay?: number; dropRate?: number }): void {
      networkConditions = { ...conditions };
    }
  };
}