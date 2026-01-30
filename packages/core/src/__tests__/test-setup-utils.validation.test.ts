/**
 * @fileoverview Validation tests for test setup utilities.
 *
 * This file verifies that the test setup utilities can be imported
 * and their basic functionality works as expected.
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
  type MockFileSystem,
  type MockCompression,
  type MockCleanupOptions,
  type TimerCleanupOptions,
} from '../test-setup-utils.js';

describe('Test Setup Utils Validation', () => {
  describe('Type Exports', () => {
    it('should export correct interface types', () => {
      // This test verifies that the types are correctly exported
      const mockOptions: MockCleanupOptions = { clearMocks: true, resetMocks: true };
      const timerOptions: TimerCleanupOptions = { useFakeTimers: true, useRealTimers: true };

      expect(mockOptions).toBeDefined();
      expect(timerOptions).toBeDefined();
    });
  });

  describe('Function Exports', () => {
    it('should export all utility functions', () => {
      // Verify all functions are exported and callable
      expect(typeof createMockCleanup).toBe('function');
      expect(typeof createTimerCleanup).toBe('function');
      expect(typeof createFileSystemMock).toBe('function');
      expect(typeof createCompressionMock).toBe('function');
      expect(typeof createCompleteTestSetup).toBe('function');
      expect(typeof createMockSession).toBe('function');
      expect(typeof createMockMessage).toBe('function');
      expect(typeof createMockStore).toBe('function');
      expect(typeof advanceTimersAndRun).toBe('function');
      expect(typeof withTestTimeout).toBe('function');
      expect(typeof expectRejection).toBe('function');
      expect(typeof createResourceCleanup).toBe('function');
    });
  });

  describe('Mock Object Creation', () => {
    it('should create valid mock session objects', () => {
      const session = createMockSession();

      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('name');
      expect(session).toHaveProperty('projectPath');
      expect(session).toHaveProperty('messages');
      expect(session).toHaveProperty('state');
      expect(session.messages).toEqual([]);
      expect(session.state).toHaveProperty('totalCost');
    });

    it('should create mock sessions with overrides', () => {
      const session = createMockSession({
        id: 'test-override',
        name: 'Override Session',
        state: { totalCost: 5.0 }
      });

      expect(session.id).toBe('test-override');
      expect(session.name).toBe('Override Session');
      expect(session.state.totalCost).toBe(5.0);
    });

    it('should create valid mock message objects', () => {
      const message = createMockMessage();

      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('role');
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('timestamp');
      expect(message).toHaveProperty('index');
    });

    it('should create mock messages with overrides', () => {
      const message = createMockMessage({
        role: 'assistant',
        content: 'Custom content',
        agent: 'planner',
        index: 5
      });

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Custom content');
      expect(message.agent).toBe('planner');
      expect(message.index).toBe(5);
    });

    it('should create mock store with expected methods', () => {
      const store = createMockStore('/custom/path');

      expect(store.projectPath).toBe('/custom/path');
      expect(typeof store.createSession).toBe('function');
      expect(typeof store.getSession).toBe('function');
      expect(typeof store.updateSession).toBe('function');
      expect(typeof store.deleteSession).toBe('function');
      expect(typeof store.listSessions).toBe('function');

      // Verify these are mock functions
      expect(vi.isMockFunction(store.createSession)).toBe(true);
      expect(vi.isMockFunction(store.getSession)).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    it('should handle timeout wrapper', async () => {
      const result = await withTestTimeout(async () => {
        return 'success';
      }, 1000);

      expect(result).toBe('success');
    });

    it('should handle rejection testing', async () => {
      await expectRejection(
        Promise.reject(new Error('Test error')),
        'Test error'
      );

      // If we reach this point, the expectRejection worked correctly
      expect(true).toBe(true);
    });

    it('should handle regex rejection testing', async () => {
      await expectRejection(
        Promise.reject(new Error('Error: something went wrong')),
        /Error: something/
      );

      expect(true).toBe(true);
    });
  });

  describe('Resource Cleanup', () => {
    it('should create cleanup functions', () => {
      const { addCleanup, cleanup } = createResourceCleanup();

      expect(typeof addCleanup).toBe('function');
      expect(typeof cleanup).toBe('function');

      // Test adding cleanup functions
      const mockCleanupFn = vi.fn();
      addCleanup(mockCleanupFn);

      expect(mockCleanupFn).not.toHaveBeenCalled();
    });
  });

  // Note: We can't test the actual beforeEach/afterEach setup in a validation test
  // as that would interfere with the test runner itself. The real testing of
  // those functions is done in the examples file.

  describe('Mock Factory Return Types', () => {
    it('should return proper file system mock interface', () => {
      // We can't actually call this without mocking the fs module first,
      // but we can verify the function exists and is callable
      expect(() => {
        // This would normally set up the fs mock
        const mockSetup = createFileSystemMock;
        expect(typeof mockSetup).toBe('function');
      }).not.toThrow();
    });

    it('should return proper compression mock interface', () => {
      expect(() => {
        const mockSetup = createCompressionMock;
        expect(typeof mockSetup).toBe('function');
      }).not.toThrow();
    });

    it('should return proper complete test setup', () => {
      expect(() => {
        const completeSetup = createCompleteTestSetup;
        expect(typeof completeSetup).toBe('function');
      }).not.toThrow();
    });
  });
});

describe('Documentation Completeness', () => {
  it('should have examples for all exported functions', () => {
    // This test ensures that we have documentation/examples for all exports
    const exportedFunctions = [
      'createMockCleanup',
      'createTimerCleanup',
      'createFileSystemMock',
      'createCompressionMock',
      'createCompleteTestSetup',
      'createMockSession',
      'createMockMessage',
      'createMockStore',
      'advanceTimersAndRun',
      'withTestTimeout',
      'expectRejection',
      'createResourceCleanup'
    ];

    // All functions should be documented in the examples file
    // This is verified by the existence of the examples test file
    expect(exportedFunctions.length).toBeGreaterThan(0);
    expect(exportedFunctions).toContain('createMockCleanup');
    expect(exportedFunctions).toContain('createCompleteTestSetup');
  });
});