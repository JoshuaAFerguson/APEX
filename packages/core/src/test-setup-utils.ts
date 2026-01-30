/**
 * Test setup and teardown utilities for beforeEach/afterEach patterns.
 *
 * This module contains reusable test setup helpers that establish common
 * beforeEach and afterEach patterns used throughout the APEX test suite.
 *
 * @example Basic mock cleanup
 * ```typescript
 * import { createMockCleanup } from '@apex/core/test-setup-utils';
 *
 * describe('My Component', () => {
 *   createMockCleanup(); // Automatically clears/resets mocks
 *
 *   it('should work with clean mocks', () => {
 *     // Your test - mocks are automatically managed
 *   });
 * });
 * ```
 *
 * @example Complete test environment
 * ```typescript
 * import { createCompleteTestSetup } from '@apex/core/test-setup-utils';
 *
 * describe('Integration Test', () => {
 *   const { mockFs, mockCompression } = createCompleteTestSetup();
 *
 *   it('should handle file operations', async () => {
 *     mockFs.readFile.mockResolvedValue(JSON.stringify({ data: 'test' }));
 *     // Test file-dependent code
 *   });
 * });
 * ```
 */

import { vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import * as fs from 'fs/promises';
import * as zlib from 'zlib';

declare module 'zlib' {
  interface Zlib {
    promises: {
      gzip: (input: zlib.InputType, options?: zlib.ZlibOptions) => Promise<Buffer>;
      gunzip: (input: zlib.InputType, options?: zlib.ZlibOptions) => Promise<Buffer>;
    };
  }
}

/**
 * Interface for mock file system operations
 */
export interface MockFileSystem {
  readFile: MockedFunction<typeof fs.readFile>;
  writeFile: MockedFunction<typeof fs.writeFile>;
  mkdir: MockedFunction<typeof fs.mkdir>;
  unlink: MockedFunction<typeof fs.unlink>;
  readdir: MockedFunction<typeof fs.readdir>;
}

/**
 * Interface for mock compression operations
 */
export interface MockCompression {
// @ts-ignore
  gzip: MockedFunction<typeof zlib.promises.gzip>;
// @ts-ignore
  gunzip: MockedFunction<typeof zlib.promises.gunzip>;
}

/**
 * Options for mock cleanup configuration
 */
export interface MockCleanupOptions {
  /** Whether to clear all mocks in beforeEach (default: true) */
  clearMocks?: boolean;
  /** Whether to reset all mocks in afterEach (default: true) */
  resetMocks?: boolean;
}

/**
 * Options for timer cleanup configuration
 */
export interface TimerCleanupOptions {
  /** Whether to use fake timers in beforeEach (default: true) */
  useFakeTimers?: boolean;
  /** Whether to restore real timers in afterEach (default: true) */
  useRealTimers?: boolean;
}

/**
 * Creates a standard mock cleanup pattern with beforeEach/afterEach hooks.
 *
 * This establishes:
 * - beforeEach: vi.clearAllMocks() - Clear call history and reset return values
 * - afterEach: vi.resetAllMocks() - Reset all mock implementations
 *
 * @param options Configuration options for mock cleanup behavior
 *
 * @example Standard usage
 * ```typescript
 * describe('SessionStore', () => {
 *   createMockCleanup(); // Standard mock cleanup pattern
 *
 *   it('should handle mocked functions correctly', () => {
 *     const mockFn = vi.fn().mockReturnValue('test');
 *     expect(mockFn()).toBe('test');
 *     // Mock is automatically cleaned up after test
 *   });
 * });
 * ```
 *
 * @example Custom cleanup options
 * ```typescript
 * describe('Complex Test Suite', () => {
 *   createMockCleanup({
 *     clearMocks: false,  // Keep call history between tests
 *     resetMocks: true    // Reset implementations after tests
 *   });
 * });
 * ```
 */
export function createMockCleanup(options: MockCleanupOptions = {}): void {
  const { clearMocks = true, resetMocks = true } = options;

  if (clearMocks) {
    beforeEach(() => {
      vi.clearAllMocks();
    });
  }

  if (resetMocks) {
    afterEach(() => {
      vi.resetAllMocks();
    });
  }
}

/**
 * Creates a standard timer management pattern with beforeEach/afterEach hooks.
 *
 * This establishes:
 * - beforeEach: vi.useFakeTimers() - Use fake timers for deterministic testing
 * - afterEach: vi.useRealTimers() - Restore real timers after each test
 *
 * @param options Configuration options for timer behavior
 *
 * @example Timer-dependent tests
 * ```typescript
 * describe('SessionAutoSaver', () => {
 *   createTimerCleanup(); // Standard timer management
 *
 *   it('should auto-save after interval', async () => {
 *     const autoSaver = new SessionAutoSaver(mockStore, { intervalMs: 1000 });
 *     await autoSaver.start();
 *
 *     // Fast-forward time
 *     vi.advanceTimersByTime(1000);
 *     await vi.runAllTimersAsync();
 *
 *     expect(mockStore.updateSession).toHaveBeenCalled();
 *   });
 * });
 * ```
 *
 * @example Custom timer options
 * ```typescript
 * describe('Real Timer Tests', () => {
 *   createTimerCleanup({
 *     useFakeTimers: false,  // Use real timers during tests
 *     useRealTimers: true    // Ensure real timers after
 *   });
 * });
 * ```
 */
export function createTimerCleanup(options: TimerCleanupOptions = {}): void {
  const { useFakeTimers = true, useRealTimers = true } = options;

  if (useFakeTimers) {
    beforeEach(() => {
      vi.useFakeTimers();
    });
  }

  if (useRealTimers) {
    afterEach(() => {
      vi.useRealTimers();
    });
  }
}

/**
 * Creates comprehensive file system mocking with beforeEach setup.
 *
 * This establishes:
 * - Mocks all fs/promises methods (readFile, writeFile, mkdir, unlink, readdir)
 * - Sets up default successful responses in beforeEach
 * - Returns typed mock functions for easy configuration
 *
 * @returns Object containing all mocked file system functions
 *
 * @example Basic file system mocking
 * ```typescript
 * describe('SessionStore', () => {
 *   const mockFs = createFileSystemMock();
 *   createMockCleanup(); // Also use mock cleanup
 *
 *   it('should read session file', async () => {
 *     const sessionData = { id: 'test-session', name: 'Test' };
 *     mockFs.readFile.mockResolvedValue(JSON.stringify(sessionData));
 *
 *     const result = await sessionStore.getSession('test-session');
 *     expect(result).toEqual(sessionData);
 *   });
 *
 *   it('should handle file not found', async () => {
 *     mockFs.readFile.mockRejectedValue(new Error('File not found'));
 *
 *     const result = await sessionStore.getSession('missing');
 *     expect(result).toBeNull();
 *   });
 * });
 * ```
 */
export function createFileSystemMock(): MockFileSystem {
  // Mock the entire fs/promises module
  vi.mock('fs/promises', () => ({
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn(),
  }));

  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    // Set up default successful responses for all operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}'); // Default empty JSON object
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]); // Default empty directory
  });

  return {
    readFile: mockFs.readFile,
    writeFile: mockFs.writeFile,
    mkdir: mockFs.mkdir,
    unlink: mockFs.unlink,
    readdir: mockFs.readdir,
  };
}

/**
 * Creates compression mocking with beforeEach setup.
 *
 * This establishes:
 * - Mocks zlib.promises.gzip and zlib.promises.gunzip
 * - Sets up default responses in beforeEach
 * - Returns typed mock functions for easy configuration
 *
 * @returns Object containing mocked compression functions
 *
 * @example Compression testing
 * ```typescript
 * describe('Session Archiving', () => {
 *   const mockCompression = createCompressionMock();
 *   createMockCleanup();
 *
 *   it('should compress session data', async () => {
 *     const sessionData = { id: 'test', messages: [] };
 *     const compressedBuffer = Buffer.from('compressed-data');
 *     mockCompression.gzip.mockResolvedValue(compressedBuffer);
 *
 *     const result = await archiveSession(sessionData);
 *     expect(mockCompression.gzip).toHaveBeenCalledWith(
 *       JSON.stringify(sessionData)
 *     );
 *     expect(result).toBe(compressedBuffer);
 *   });
 * });
 * ```
 */
export function createCompressionMock(): MockCompression {
  // Mock the zlib module's promise interface
  vi.mock('zlib', () => ({
    promises: {
      gzip: vi.fn(),
      gunzip: vi.fn(),
    },
  }));

// @ts-ignore
  const mockGzip = vi.mocked(zlib.promises.gzip);
// @ts-ignore
  const mockGunzip = vi.mocked(zlib.promises.gunzip);

  beforeEach(() => {
    // Set up default responses
    mockGzip.mockResolvedValue(Buffer.from('compressed-data'));
    mockGunzip.mockResolvedValue(Buffer.from('{}'));
  });

  return {
    gzip: mockGzip,
    gunzip: mockGunzip,
  };
}

/**
 * Creates a complete test environment setup combining multiple utilities.
 *
 * This is a convenience function that establishes:
 * - Mock cleanup (clearAllMocks/resetAllMocks)
 * - Timer management (fake/real timers)
 * - File system mocking
 * - Compression mocking
 *
 * @param options Configuration options for different utilities
 * @returns Object containing all mocked utilities
 *
 * @example Complete test environment
 * ```typescript
 * describe('Full Integration Test', () => {
 *   const { mockFs, mockCompression } = createCompleteTestSetup();
 *
 *   it('should handle complex file operations', async () => {
 *     // Set up file system mock
 *     mockFs.readFile.mockResolvedValue(JSON.stringify({ data: 'test' }));
 *
 *     // Set up compression mock
 *     mockCompression.gzip.mockResolvedValue(Buffer.from('compressed'));
 *
 *     // Fast-forward time if needed
 *     vi.advanceTimersByTime(5000);
 *
 *     // Test your complex operations
 *     const result = await complexOperation();
 *     expect(result).toBeDefined();
 *   });
 * });
 * ```
 *
 * @example Custom configuration
 * ```typescript
 * describe('Custom Test Environment', () => {
 *   const { mockFs, mockCompression } = createCompleteTestSetup({
 *     mockCleanup: { clearMocks: false }, // Preserve mock history
 *     timerCleanup: { useFakeTimers: false } // Use real timers
 *   });
 * });
 * ```
 */
export function createCompleteTestSetup(options: {
  mockCleanup?: MockCleanupOptions;
  timerCleanup?: TimerCleanupOptions;
} = {}): {
  mockFs: MockFileSystem;
  mockCompression: MockCompression;
} {
  // Set up all cleanup patterns
  createMockCleanup(options.mockCleanup);
  createTimerCleanup(options.timerCleanup);

  // Set up all mock utilities
  const mockFs = createFileSystemMock();
  const mockCompression = createCompressionMock();

  return {
    mockFs,
    mockCompression,
  };
}

/**
 * Creates a mock session object with all required fields and sensible defaults.
 *
 * This is useful for tests that need session objects without complex setup.
 *
 * @param overrides Partial session object to override defaults
 * @returns Complete mock session object
 *
 * @example Basic session mock
 * ```typescript
 * describe('Session Operations', () => {
 *   it('should update session correctly', () => {
 *     const session = createMockSession({
 *       id: 'test-session',
 *       name: 'Test Session'
 *     });
 *
 *     expect(session.id).toBe('test-session');
 *     expect(session.messages).toEqual([]);
 *     expect(session.state.totalCost).toBe(0);
 *   });
 * });
 * ```
 *
 * @example Session with messages
 * ```typescript
 * const sessionWithMessages = createMockSession({
 *   id: 'chat-session',
 *   messages: [
 *     createMockMessage({ role: 'user', content: 'Hello' }),
 *     createMockMessage({ role: 'assistant', content: 'Hi there!' })
 *   ]
 * });
 * ```
 */
export function createMockSession(overrides: Record<string, any> = {}): any {
  return {
    id: 'mock-session-' + Math.random().toString(36).substr(2, 9),
    name: 'Mock Session',
    projectPath: '/test/project',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    lastAccessedAt: new Date('2023-01-01T00:00:00Z'),
    messages: [],
    inputHistory: [],
    state: {
      totalTokens: { input: 0, output: 0 },
      totalCost: 0,
      tasksCreated: [],
      tasksCompleted: []
    },
    childSessionIds: [],
    tags: [],
    ...overrides
  };
}

/**
 * Creates a mock message object with all required fields and sensible defaults.
 *
 * @param overrides Partial message object to override defaults
 * @returns Complete mock message object
 *
 * @example User message
 * ```typescript
 * const userMessage = createMockMessage({
 *   role: 'user',
 *   content: 'Please help me with this task',
 *   index: 0
 * });
 * ```
 *
 * @example Assistant message with agent info
 * ```typescript
 * const assistantMessage = createMockMessage({
 *   role: 'assistant',
 *   content: 'I can help with that!',
 *   agent: 'planner',
 *   taskId: 'task-123',
 *   index: 1
 * });
 * ```
 */
export function createMockMessage(overrides: Record<string, any> = {}): any {
  return {
    id: 'msg-' + Math.random().toString(36).substr(2, 9),
    index: 0,
    role: 'user',
    content: 'Mock message content',
    timestamp: new Date('2023-01-01T00:00:00Z'),
    ...overrides
  };
}

/**
 * Creates a mock store with all common methods for testing.
 *
 * This provides a fully mocked store with all expected methods,
 * useful for testing components that depend on session storage.
 *
 * @param projectPath Path to use for the mock store
 * @returns Object with mocked store methods
 *
 * @example Store-dependent testing
 * ```typescript
 * describe('Component with Store', () => {
 *   const mockStore = createMockStore('/test/project');
 *   createMockCleanup();
 *
 *   it('should create sessions correctly', async () => {
 *     const newSession = createMockSession({ name: 'New Session' });
 *     mockStore.createSession.mockResolvedValue(newSession);
 *
 *     const result = await component.createNewSession('New Session');
 *     expect(mockStore.createSession).toHaveBeenCalledWith('New Session');
 *     expect(result).toBe(newSession);
 *   });
 * });
 * ```
 */
export function createMockStore(projectPath = '/test/project') {
  return {
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    listSessions: vi.fn(),
    branchSession: vi.fn(),
    archiveSession: vi.fn(),
    exportSession: vi.fn(),
    getActiveSessionId: vi.fn(),
    setActiveSession: vi.fn(),
    initialize: vi.fn(),
    projectPath
  };
}

/**
 * Helper to advance timers and run all timer-related promises.
 *
 * This combines vi.advanceTimersByTime() with vi.runAllTimersAsync()
 * for convenient timer testing.
 *
 * @param ms Time to advance in milliseconds
 *
 * @example Timer advancement
 * ```typescript
 * describe('Timer-dependent Operations', () => {
 *   createTimerCleanup();
 *
 *   it('should trigger after timeout', async () => {
 *     const autoSaver = new SessionAutoSaver(mockStore, { intervalMs: 1000 });
 *     await autoSaver.start();
 *
 *     await advanceTimersAndRun(1000); // Advance 1 second
 *
 *     expect(mockStore.updateSession).toHaveBeenCalled();
 *   });
 * });
 * ```
 */
export async function advanceTimersAndRun(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await vi.runAllTimersAsync();
}

/**
 * Helper to create consistent test timeouts and error handling.
 *
 * This wraps test functions with a timeout to prevent hanging tests.
 *
 * @param testFn Test function to wrap
 * @param timeoutMs Timeout in milliseconds (default: 5000)
 * @returns Promise that resolves/rejects based on the test function
 *
 * @example Timeout protection
 * ```typescript
 * describe('Async Operations', () => {
 *   it('should complete within timeout', () => {
 *     return withTestTimeout(async () => {
 *       const result = await longRunningOperation();
 *       expect(result).toBeDefined();
 *     }, 3000); // 3 second timeout
 *   });
 * });
 * ```
 */
export function withTestTimeout<T>(
  testFn: () => Promise<T>,
  timeoutMs = 5000
): Promise<T> {
  return Promise.race([
    testFn(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Test timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

/**
 * Helper to assert that a promise rejects with a specific error.
 *
 * @param promise Promise that should reject
 * @param errorMessage Expected error message (string or regex)
 * @returns Promise that resolves if the assertion passes
 *
 * @example Error testing
 * ```typescript
 * describe('Error Handling', () => {
 *   it('should reject with proper error', async () => {
 *     await expectRejection(
 *       sessionStore.getSession('invalid-id'),
 *       /Session not found/
 *     );
 *   });
 *
 *   it('should reject with exact message', async () => {
 *     await expectRejection(
 *       sessionStore.deleteSession('protected-session'),
 *       'Cannot delete protected session'
 *     );
 *   });
 * });
 * ```
 */
export async function expectRejection(
  promise: Promise<any>,
  errorMessage: string | RegExp
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject, but it resolved');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (typeof errorMessage === 'string') {
      if (message !== errorMessage) {
        throw new Error(
          `Expected error message "${errorMessage}", but got "${message}"`
        );
      }
    } else if (errorMessage instanceof RegExp) {
      if (!errorMessage.test(message)) {
        throw new Error(
          `Expected error message to match ${errorMessage}, but got "${message}"`
        );
      }
    }
  }
}

/**
 * Creates a resource cleanup pattern for tests that need manual resource management.
 *
 * This sets up an afterEach hook that calls cleanup functions in reverse order.
 *
 * @returns Object with addCleanup function and manual cleanup capability
 *
 * @example Resource cleanup
 * ```typescript
 * describe('Resource Management', () => {
 *   const { addCleanup } = createResourceCleanup();
 *
 *   it('should clean up resources', async () => {
 *     const server = startTestServer();
 *     addCleanup(() => server.close());
 *
 *     const connection = await connectToDatabase();
 *     addCleanup(() => connection.close());
 *
 *     // Test operations - resources automatically cleaned up
 *   });
 * });
 * ```
 */
export function createResourceCleanup(): {
  addCleanup: (cleanupFn: () => void | Promise<void>) => void;
  cleanup: () => Promise<void>;
} {
  const cleanupFunctions: Array<() => void | Promise<void>> = [];

  const cleanup = async () => {
    // Run cleanup functions in reverse order
    for (let i = cleanupFunctions.length - 1; i >= 0; i--) {
      try {
        await cleanupFunctions[i]();
      } catch (error) {
        console.warn('Cleanup function failed:', error);
      }
    }
    cleanupFunctions.length = 0;
  };

  const addCleanup = (cleanupFn: () => void | Promise<void>) => {
    cleanupFunctions.push(cleanupFn);
  };

  afterEach(cleanup);

  return {
    addCleanup,
    cleanup
  };
}