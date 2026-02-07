/**
 * @fileoverview Type definitions for TestContext
 *
 * This module defines the TypeScript interfaces for the TestContext factory,
 * providing unique test isolation and namespace management.
 */

/**
 * Options for creating a TestContext
 */
export interface TestContextOptions {
  /**
   * Custom prefix for the test namespace.
   * Defaults to 'test'.
   */
  namespacePrefix?: string;

  /**
   * Custom seed for ID generation (useful for reproducible tests).
   * If not provided, uses a combination of timestamp and random values.
   */
  seed?: string;

  /**
   * Base path for temporary directories.
   * Defaults to system temp directory.
   */
  tempBasePath?: string;

  /**
   * Whether to automatically create a temp directory on context creation.
   * Defaults to false (lazy creation).
   */
  createTempDirOnInit?: boolean;

  /**
   * Custom metadata to attach to the context.
   */
  metadata?: Record<string, unknown>;

  /**
   * Test suite name for logging and debugging.
   */
  suiteName?: string;

  /**
   * Test name for logging and debugging.
   */
  testName?: string;
}

/**
 * Unique identifier generators provided by TestContext
 */
export interface TestContextIdGenerators {
  /**
   * Generate a unique ID with optional prefix.
   * @param prefix - Optional prefix for the ID
   * @returns A unique, test-scoped identifier
   */
  uniqueId(prefix?: string): string;

  /**
   * Generate a unique task ID following APEX conventions.
   * @returns A unique task identifier (e.g., 'task_<testId>_<sequence>')
   */
  uniqueTaskId(): string;

  /**
   * Generate a unique session ID following APEX conventions.
   * @returns A unique session identifier (e.g., 'sess_<testId>_<sequence>')
   */
  uniqueSessionId(): string;

  /**
   * Generate a unique agent ID following APEX conventions.
   * @returns A unique agent identifier (e.g., 'agent_<testId>_<sequence>')
   */
  uniqueAgentId(): string;

  /**
   * Generate a unique workflow ID following APEX conventions.
   * @returns A unique workflow identifier (e.g., 'wf_<testId>_<sequence>')
   */
  uniqueWorkflowId(): string;

  /**
   * Generate a unique checkpoint ID.
   * @returns A unique checkpoint identifier
   */
  uniqueCheckpointId(): string;
}

/**
 * Namespace utilities provided by TestContext
 */
export interface TestContextNamespace {
  /**
   * Create a namespaced file path.
   * @param basePath - The base path to namespace
   * @returns A path prefixed with the test namespace
   */
  namespacedPath(basePath: string): string;

  /**
   * Create a namespaced key for use in maps, caches, or databases.
   * @param key - The key to namespace
   * @returns A key prefixed with the test namespace
   */
  namespacedKey(key: string): string;

  /**
   * Create a namespaced table name for database isolation.
   * @param tableName - The base table name
   * @returns A table name prefixed with the test namespace
   */
  namespacedTable(tableName: string): string;

  /**
   * Create a namespaced environment variable key.
   * @param envKey - The base environment variable key
   * @returns An env key prefixed with the test namespace (uppercase)
   */
  namespacedEnv(envKey: string): string;
}

/**
 * Test-scoped data storage
 */
export interface TestContextDataStore {
  /**
   * Get data stored in the test context.
   * @param key - The key to retrieve
   * @returns The stored value or undefined
   */
  getData<T>(key: string): T | undefined;

  /**
   * Set data in the test context.
   * @param key - The key to store under
   * @param value - The value to store
   */
  setData<T>(key: string, value: T): void;

  /**
   * Check if a key exists in the test context.
   * @param key - The key to check
   * @returns True if the key exists
   */
  hasData(key: string): boolean;

  /**
   * Delete data from the test context.
   * @param key - The key to delete
   * @returns True if the key was deleted
   */
  deleteData(key: string): boolean;

  /**
   * Clear all stored data.
   */
  clearData(): void;
}

/**
 * Resource lifecycle management
 */
export interface TestContextLifecycle {
  /**
   * Add a cleanup task to run when the context is destroyed.
   * Tasks are run in LIFO order (last added, first run).
   * @param task - The cleanup function to run
   */
  addCleanupTask(task: () => Promise<void> | void): void;

  /**
   * Run all cleanup tasks and reset the context.
   * Should be called in afterEach.
   */
  cleanup(): Promise<void>;

  /**
   * Check if the context has been cleaned up.
   */
  isCleanedUp(): boolean;
}

/**
 * Temporary directory management
 */
export interface TestContextDirectories {
  /**
   * Create a temporary directory for this test.
   * The directory will be automatically cleaned up.
   * @returns The path to the created directory
   */
  createTempDir(): Promise<string>;

  /**
   * Get the temp directory if one has been created.
   * @returns The temp directory path or undefined
   */
  getTempDir(): string | undefined;

  /**
   * Create a subdirectory within the temp directory.
   * @param subPath - Relative path within the temp dir
   * @returns The absolute path to the created subdirectory
   */
  createSubDir(subPath: string): Promise<string>;

  /**
   * Write a file within the temp directory.
   * @param relativePath - Path relative to temp dir
   * @param content - File content
   * @returns The absolute path to the written file
   */
  writeFile(relativePath: string, content: string): Promise<string>;
}

/**
 * The complete TestContext interface combining all capabilities
 */
export interface TestContext
  extends TestContextIdGenerators,
    TestContextNamespace,
    TestContextDataStore,
    TestContextLifecycle,
    TestContextDirectories {
  /**
   * Unique identifier for this test context instance.
   * Format: '<prefix>_<timestamp>_<random>'
   */
  readonly testId: string;

  /**
   * The namespace prefix used for all namespaced operations.
   */
  readonly namespace: string;

  /**
   * Timestamp when this context was created.
   */
  readonly createdAt: Date;

  /**
   * Options used to create this context.
   */
  readonly options: Readonly<TestContextOptions>;

  /**
   * Counter for tracking how many IDs have been generated.
   */
  readonly idSequence: number;
}

/**
 * Factory function type for creating TestContext instances
 */
export type TestContextFactory = (options?: TestContextOptions) => TestContext;

/**
 * Hook-based TestContext for use with describe/it blocks
 */
export interface UseTestContextResult {
  /**
   * The test context instance.
   * Note: Only valid after beforeEach has run.
   */
  context: TestContext;

  /**
   * Setup function to call in beforeEach.
   */
  setup: () => void;

  /**
   * Teardown function to call in afterEach.
   */
  teardown: () => Promise<void>;
}
