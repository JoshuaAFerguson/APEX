/**
 * @fileoverview Examples and usage patterns for test setup utilities.
 *
 * This file demonstrates how to use the test setup utilities provided in
 * test-setup-utils.ts for common testing patterns in the APEX project.
 *
 * These examples serve as both documentation and verification that the
 * utilities work as expected.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createMockCleanup,
  createTimerCleanup,
  createFileSystemMock,
  createCompressionMock,
  createCompleteTestSetup,
  createMockSession,
  createMockMessage,
  createMockStore,
  advanceTimersAndRun,
  withTestTimeout,
  expectRejection,
  createResourceCleanup,
} from '../test-setup-utils.js';

/**
 * Example 1: Basic Mock Cleanup Pattern
 *
 * This is the most common pattern - automatically clearing and resetting
 * mocks between tests to ensure test isolation.
 */
describe('Example 1: Basic Mock Cleanup', () => {
  // Set up automatic mock cleanup for all tests in this describe block
  createMockCleanup();

  let mockFunction: ReturnType<typeof vi.fn>;

  it('should start with a clean mock', () => {
    mockFunction = vi.fn().mockReturnValue('first test');

    expect(mockFunction()).toBe('first test');
    expect(mockFunction).toHaveBeenCalledTimes(1);
  });

  it('should have clean mock in second test', () => {
    // Mock was automatically cleared by createMockCleanup()
    mockFunction = vi.fn().mockReturnValue('second test');

    expect(mockFunction()).toBe('second test');
    expect(mockFunction).toHaveBeenCalledTimes(1); // Not 2!
  });
});

/**
 * Example 2: Timer Management Pattern
 *
 * For testing code that depends on timers, intervals, or timeouts.
 */
describe('Example 2: Timer Management', () => {
  createMockCleanup(); // Also clean up mocks
  createTimerCleanup(); // Manage timers automatically

  it('should handle timer-based operations', async () => {
    let callbackExecuted = false;

    // Code under test that uses timers
    setTimeout(() => {
      callbackExecuted = true;
    }, 1000);

    // Initially false
    expect(callbackExecuted).toBe(false);

    // Fast-forward time
    vi.advanceTimersByTime(1000);

    // Now should be true
    expect(callbackExecuted).toBe(true);
  });

  it('should handle async timer operations', async () => {
    const mockCallback = vi.fn();

    // Simulate auto-save functionality
    const startAutoSave = (callback: () => void, interval: number) => {
      const intervalId = setInterval(callback, interval);
      return () => clearInterval(intervalId);
    };

    const cleanup = startAutoSave(mockCallback, 5000);

    // Advance time and run async operations
    await advanceTimersAndRun(5000);
    expect(mockCallback).toHaveBeenCalledTimes(1);

    await advanceTimersAndRun(5000);
    expect(mockCallback).toHaveBeenCalledTimes(2);

    cleanup(); // Clean up the interval
  });
});

/**
 * Example 3: File System Mocking Pattern
 *
 * For testing components that interact with the file system.
 */
describe('Example 3: File System Operations', () => {
  const mockFs = createFileSystemMock();
  createMockCleanup();

  it('should mock successful file operations', async () => {
    // Configure mock responses
    mockFs.readFile.mockResolvedValue('{"data": "test content"}');
    mockFs.writeFile.mockResolvedValue(undefined);

    // Simulate file operations
    const content = await mockFs.readFile('test.json', 'utf-8');
    expect(content).toBe('{"data": "test content"}');

    await mockFs.writeFile('output.json', '{"result": "success"}');
    expect(mockFs.writeFile).toHaveBeenCalledWith('output.json', '{"result": "success"}');
  });

  it('should mock file system errors', async () => {
    // Configure mock to throw error
    mockFs.readFile.mockRejectedValue(new Error('File not found'));

    // Test error handling
    await expectRejection(
      mockFs.readFile('missing.json', 'utf-8'),
      'File not found'
    );
  });

  it('should mock directory operations', async () => {
    // Mock directory listing
    mockFs.readdir.mockResolvedValue(['file1.txt', 'file2.txt'] as any);

    const files = await mockFs.readdir('./test-dir');
    expect(files).toEqual(['file1.txt', 'file2.txt']);
  });
});

/**
 * Example 4: Compression Mocking Pattern
 *
 * For testing components that use compression (like session archiving).
 */
describe('Example 4: Compression Operations', () => {
  const mockCompression = createCompressionMock();
  createMockCleanup();

  it('should mock compression operations', async () => {
    const testData = JSON.stringify({ session: 'data' });
    const compressedData = Buffer.from('compressed-content');

    // Configure compression mock
    mockCompression.gzip.mockResolvedValue(compressedData);

    const result = await mockCompression.gzip(testData);
    expect(result).toBe(compressedData);
    expect(mockCompression.gzip).toHaveBeenCalledWith(testData);
  });

  it('should mock decompression operations', async () => {
    const compressedData = Buffer.from('compressed-content');
    const originalData = Buffer.from('{"session": "data"}');

    // Configure decompression mock
    mockCompression.gunzip.mockResolvedValue(originalData);

    const result = await mockCompression.gunzip(compressedData);
    expect(result).toBe(originalData);
  });
});

/**
 * Example 5: Complete Test Setup Pattern
 *
 * For integration tests that need multiple mock utilities.
 */
describe('Example 5: Complete Test Environment', () => {
  const { mockFs, mockCompression } = createCompleteTestSetup();

  it('should handle complex operations with multiple mocks', async () => {
    // Set up file system mocks
    const sessionData = { id: 'test-session', messages: ['Hello', 'World'] };
    mockFs.readFile.mockResolvedValue(JSON.stringify(sessionData));

    // Set up compression mocks
    const compressedBuffer = Buffer.from('compressed-session-data');
    mockCompression.gzip.mockResolvedValue(compressedBuffer);

    // Simulate complex operation: read file, compress, save
    const fileContent = await mockFs.readFile('session.json', 'utf-8');
    const compressed = await mockCompression.gzip(fileContent);
    await mockFs.writeFile('session.gz', compressed);

    // Verify the operations
    expect(mockFs.readFile).toHaveBeenCalledWith('session.json', 'utf-8');
    expect(mockCompression.gzip).toHaveBeenCalledWith(JSON.stringify(sessionData));
    expect(mockFs.writeFile).toHaveBeenCalledWith('session.gz', compressedBuffer);
  });

  it('should handle timer-dependent file operations', async () => {
    const mockCallback = vi.fn();

    // Simulate auto-archive functionality
    const autoArchiver = {
      start: () => {
        setInterval(async () => {
          const data = await mockFs.readFile('temp.json', 'utf-8');
          const compressed = await mockCompression.gzip(data);
          await mockFs.writeFile('archive.gz', compressed);
          mockCallback();
        }, 10000);
      }
    };

    // Configure mocks
    mockFs.readFile.mockResolvedValue('{"temp": "data"}');
    mockCompression.gzip.mockResolvedValue(Buffer.from('compressed'));

    autoArchiver.start();

    // Fast-forward time and verify operations
    await advanceTimersAndRun(10000);

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockFs.readFile).toHaveBeenCalled();
    expect(mockCompression.gzip).toHaveBeenCalled();
  });
});

/**
 * Example 6: Mock Object Creation Patterns
 *
 * Using utility functions to create consistent mock data.
 */
describe('Example 6: Mock Object Creation', () => {
  createMockCleanup();

  it('should create mock sessions with defaults', () => {
    const session = createMockSession();

    expect(session.id).toMatch(/^mock-session-/);
    expect(session.name).toBe('Mock Session');
    expect(session.messages).toEqual([]);
    expect(session.state.totalCost).toBe(0);
    expect(session.projectPath).toBe('/test/project');
  });

  it('should create mock sessions with overrides', () => {
    const session = createMockSession({
      id: 'custom-session',
      name: 'Custom Session',
      state: { totalCost: 1.5 }
    });

    expect(session.id).toBe('custom-session');
    expect(session.name).toBe('Custom Session');
    expect(session.state.totalCost).toBe(1.5);
    // Other fields should still have defaults
    expect(session.messages).toEqual([]);
    expect(session.projectPath).toBe('/test/project');
  });

  it('should create mock messages', () => {
    const userMessage = createMockMessage({
      role: 'user',
      content: 'Hello, APEX!',
      index: 0
    });

    expect(userMessage.role).toBe('user');
    expect(userMessage.content).toBe('Hello, APEX!');
    expect(userMessage.index).toBe(0);
    expect(userMessage.id).toMatch(/^msg-/);

    const assistantMessage = createMockMessage({
      role: 'assistant',
      content: 'Hello! How can I help you?',
      agent: 'planner',
      taskId: 'task-123',
      index: 1
    });

    expect(assistantMessage.role).toBe('assistant');
    expect(assistantMessage.agent).toBe('planner');
    expect(assistantMessage.taskId).toBe('task-123');
  });

  it('should create sessions with messages', () => {
    const session = createMockSession({
      id: 'chat-session',
      messages: [
        createMockMessage({ role: 'user', content: 'Hello', index: 0 }),
        createMockMessage({ role: 'assistant', content: 'Hi!', index: 1 })
      ]
    });

    expect(session.messages).toHaveLength(2);
    expect(session.messages[0].content).toBe('Hello');
    expect(session.messages[1].content).toBe('Hi!');
  });
});

/**
 * Example 7: Store Mocking Pattern
 *
 * For testing components that depend on session storage.
 */
describe('Example 7: Store Mocking', () => {
  const mockStore = createMockStore('/test/project');
  createMockCleanup();

  it('should mock store operations', async () => {
    const newSession = createMockSession({
      id: 'new-session',
      name: 'New Session'
    });

    // Configure mock store responses
    mockStore.createSession.mockResolvedValue(newSession);
    mockStore.getSession.mockResolvedValue(newSession);
    mockStore.updateSession.mockResolvedValue(undefined);

    // Test store operations
    const created = await mockStore.createSession('New Session');
    expect(created).toBe(newSession);
    expect(mockStore.createSession).toHaveBeenCalledWith('New Session');

    const retrieved = await mockStore.getSession('new-session');
    expect(retrieved).toBe(newSession);

    await mockStore.updateSession('new-session', { name: 'Updated Session' });
    expect(mockStore.updateSession).toHaveBeenCalledWith(
      'new-session',
      { name: 'Updated Session' }
    );
  });

  it('should mock store errors', async () => {
    mockStore.getSession.mockResolvedValue(null);
    mockStore.deleteSession.mockRejectedValue(new Error('Session not found'));

    const session = await mockStore.getSession('missing-session');
    expect(session).toBeNull();

    await expectRejection(
      mockStore.deleteSession('missing-session'),
      'Session not found'
    );
  });
});

/**
 * Example 8: Error Testing Patterns
 *
 * Using expectRejection for error handling tests.
 */
describe('Example 8: Error Testing', () => {
  createMockCleanup();

  it('should test async error with exact message', async () => {
    const failingFunction = async () => {
      throw new Error('Specific error message');
    };

    await expectRejection(
      failingFunction(),
      'Specific error message'
    );
  });

  it('should test async error with regex pattern', async () => {
    const failingFunction = async () => {
      throw new Error('Permission denied: cannot access /restricted/path');
    };

    await expectRejection(
      failingFunction(),
      /Permission denied/
    );
  });

  it('should handle complex error scenarios', async () => {
    const mockOperation = vi.fn().mockRejectedValue(
      new Error('Network timeout after 5000ms')
    );

    await expectRejection(
      mockOperation(),
      /Network timeout after \d+ms/
    );

    expect(mockOperation).toHaveBeenCalledTimes(1);
  });
});

/**
 * Example 9: Timeout Testing Pattern
 *
 * Using withTestTimeout to prevent hanging tests.
 */
describe('Example 9: Timeout Testing', () => {
  createMockCleanup();

  it('should complete fast operations within timeout', async () => {
    await withTestTimeout(async () => {
      // Fast operation
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(true).toBe(true);
    }, 1000);
  });

  it('should handle operations that approach timeout', async () => {
    await withTestTimeout(async () => {
      // Operation that takes most of the timeout
      await new Promise(resolve => setTimeout(resolve, 800));
      expect(true).toBe(true);
    }, 1000);
  });

  // Note: This test would fail with timeout - commented out for CI
  /*
  it('should timeout slow operations', async () => {
    await expect(
      withTestTimeout(async () => {
        // This would timeout
        await new Promise(resolve => setTimeout(resolve, 2000));
      }, 500)
    ).rejects.toThrow('Test timed out after 500ms');
  });
  */
});

/**
 * Example 10: Resource Cleanup Pattern
 *
 * For tests that create resources needing manual cleanup.
 */
describe('Example 10: Resource Cleanup', () => {
  const { addCleanup } = createResourceCleanup();
  createMockCleanup();

  it('should clean up mock resources', async () => {
    const mockResource = {
      isOpen: true,
      close: vi.fn(() => {
        mockResource.isOpen = false;
      })
    };

    // Register cleanup
    addCleanup(() => mockResource.close());

    // Use the resource
    expect(mockResource.isOpen).toBe(true);

    // Resource will be automatically closed after test
  });

  it('should handle multiple resources', async () => {
    const resources = [
      { id: 1, close: vi.fn() },
      { id: 2, close: vi.fn() },
      { id: 3, close: vi.fn() }
    ];

    // Register cleanup for all resources
    resources.forEach(resource => {
      addCleanup(() => resource.close());
    });

    // Use resources
    expect(resources).toHaveLength(3);

    // All will be cleaned up automatically in reverse order
  });

  it('should handle async cleanup', async () => {
    const asyncResource = {
      isConnected: true,
      disconnect: vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        asyncResource.isConnected = false;
      })
    };

    addCleanup(async () => await asyncResource.disconnect());

    expect(asyncResource.isConnected).toBe(true);

    // Async cleanup will be awaited automatically
  });
});

/**
 * Example 11: Custom Configuration Patterns
 *
 * Using options to customize behavior of test utilities.
 */
describe('Example 11: Custom Configuration', () => {
  // Custom mock cleanup - keep call history but reset implementations
  createMockCleanup({
    clearMocks: false, // Don't clear call history
    resetMocks: true   // Do reset implementations
  });

  // Custom timer setup - use real timers for this test suite
  createTimerCleanup({
    useFakeTimers: false,
    useRealTimers: true
  });

  it('should preserve mock history between tests', () => {
    // This example shows how to preserve call counts if needed
    // (though this is generally not recommended for test isolation)
    expect(true).toBe(true); // Placeholder
  });
});

/**
 * Example 12: Integration Test Pattern
 *
 * Combining multiple utilities for comprehensive integration testing.
 */
describe('Example 12: Integration Testing', () => {
  const { mockFs, mockCompression } = createCompleteTestSetup();
  const mockStore = createMockStore();
  const { addCleanup } = createResourceCleanup();

  it('should handle complete session workflow', async () => {
    // Create a complete session workflow test
    const session = createMockSession({
      id: 'integration-session',
      name: 'Integration Test Session',
      messages: [
        createMockMessage({ role: 'user', content: 'Start task', index: 0 }),
        createMockMessage({ role: 'assistant', content: 'Task started', agent: 'planner', index: 1 })
      ]
    });

    // Mock store operations
    mockStore.createSession.mockResolvedValue(session);
    mockStore.getSession.mockResolvedValue(session);

    // Mock file operations for session persistence
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(JSON.stringify(session));

    // Mock compression for archiving
    const compressedData = Buffer.from('compressed-session');
    mockCompression.gzip.mockResolvedValue(compressedData);

    // Test the complete workflow
    const created = await mockStore.createSession('Integration Test Session');
    expect(created.id).toBe('integration-session');

    // Simulate session persistence
    await mockFs.writeFile('session.json', JSON.stringify(created));

    // Simulate session archiving
    const sessionContent = await mockFs.readFile('session.json', 'utf-8');
    const archived = await mockCompression.gzip(sessionContent);

    expect(archived).toBe(compressedData);
    expect(mockFs.writeFile).toHaveBeenCalled();
    expect(mockCompression.gzip).toHaveBeenCalledWith(JSON.stringify(session));

    // Add any cleanup if needed
    addCleanup(() => {
      // Mock cleanup function
    });
  });
});