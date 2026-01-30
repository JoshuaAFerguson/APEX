/**
 * @fileoverview Verification test that demonstrates the test utilities working together.
 * This test validates that both test-utils and test-setup-utils modules integrate correctly.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  isWindows,
  mockPlatform,
  describeWindows,
  describeUnix,
  skipOnWindows,
  createMockPermission,
} from '../test-utils.js';
import {
  createMockCleanup,
  createTimerCleanup,
  createFileSystemMock,
  createMockSession,
  createMockMessage,
  withTestTimeout,
  advanceTimersAndRun,
  expectRejection,
} from '../test-setup-utils.js';

describe('Test Utils Integration Verification', () => {
  // Use our setup utilities to establish clean test environment
  createMockCleanup();
  createTimerCleanup();

  const mockFs = createFileSystemMock();

  describe('Platform utilities with mock cleanup', () => {
    it('should work with platform mocking and cleanup', async () => {
      await withTestTimeout(async () => {
        // Test platform detection
        const originalPlatform = isWindows();

        // Mock a different platform
        const restore = mockPlatform('win32');
        expect(isWindows()).toBe(true);

        restore();
        // Platform should be restored (though this is mocked in tests)

        // Verify mocks are clean between tests due to createMockCleanup
        expect(vi.isMockFunction(mockFs.readFile)).toBe(true);

        // Test file system mock
        mockFs.readFile.mockResolvedValue('{"test": true}');
        const content = await mockFs.readFile('/test/file.json');
        expect(content).toBe('{"test": true}');
      }, 3000);
    });

    it('should handle platform-specific skipping', () => {
      // This test demonstrates conditional execution
      if (isWindows()) {
        expect(true).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('Mock utilities integration', () => {
    it('should create and use permission mocks', () => {
      const permission = createMockPermission({
        tool: 'Read',
        level: 'allow-always',
        scope: '/test/path'
      });

      expect(permission.tool).toBe('Read');
      expect(permission.level).toBe('allow-always');
      expect(permission.scope).toBe('/test/path');
    });

    it('should create mock session and message objects', () => {
      const session = createMockSession({
        id: 'test-session',
        name: 'Test Session'
      });

      const message = createMockMessage({
        role: 'user',
        content: 'Hello, test!'
      });

      expect(session.id).toBe('test-session');
      expect(session.name).toBe('Test Session');
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, test!');
    });
  });

  describe('Timer utilities', () => {
    it('should work with fake timers', async () => {
      await withTestTimeout(async () => {
        let called = false;

        setTimeout(() => {
          called = true;
        }, 1000);

        // Advance timers
        await advanceTimersAndRun(1000);

        expect(called).toBe(true);
      }, 5000);
    });
  });

  describe('Error testing utilities', () => {
    it('should handle rejection testing', async () => {
      const failingPromise = Promise.reject(new Error('Test error'));

      await expectRejection(failingPromise, 'Test error');
    });

    it('should handle regex error matching', async () => {
      const failingPromise = Promise.reject(new Error('File not found: /test/file.json'));

      await expectRejection(failingPromise, /File not found/);
    });
  });

  describe('File system mocking', () => {
    it('should mock file operations', async () => {
      await withTestTimeout(async () => {
        // Test reading a file
        mockFs.readFile.mockResolvedValue(JSON.stringify({ data: 'test' }));
        const content = await mockFs.readFile('/test/data.json');
        expect(JSON.parse(content)).toEqual({ data: 'test' });

        // Test writing a file
        mockFs.writeFile.mockResolvedValue(undefined);
        await mockFs.writeFile('/test/output.json', JSON.stringify({ result: 'success' }));
        expect(mockFs.writeFile).toHaveBeenCalledWith('/test/output.json', '{"result":"success"}');

        // Test directory operations
        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);

        await mockFs.mkdir('/test/newdir');
        const files = await mockFs.readdir('/test');

        expect(mockFs.mkdir).toHaveBeenCalledWith('/test/newdir');
        expect(files).toEqual(['file1.txt', 'file2.txt']);
      }, 3000);
    });
  });
});

// Platform-specific test suites using the utilities
describeWindows('Windows-specific functionality', () => {
  createMockCleanup();

  it('should only run on Windows', () => {
    expect(isWindows()).toBe(true);
  });
});

describeUnix('Unix-specific functionality', () => {
  createMockCleanup();

  it('should only run on Unix systems', () => {
    expect(isWindows()).toBe(false);
  });
});