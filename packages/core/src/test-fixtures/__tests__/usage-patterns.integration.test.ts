/**
 * @fileoverview Integration Tests for Test Setup Usage Patterns
 *
 * This test suite validates the documented usage patterns and examples
 * from the setup-teardown module, ensuring that the documented APIs
 * work as expected in realistic test scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import {
  createTestSuite,
  setupTestMocks,
  getTestEnvironment,
  setTestData,
  getTestData,
  addCleanupTask,
  createMockFunction,
  flushTimers,
  advanceTimers,
  createTempDir,
} from '../setup-teardown.js';
import type { TestSuiteConfig } from '../types.js';

describe('Test Setup Usage Patterns (Integration)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Usage Pattern', () => {
    it('should support the basic documented usage pattern', async () => {
      // This replicates the basic example from the documentation
      const suite = createTestSuite({
        setupMocks: true,
        cleanupAfterEach: true
      });

      beforeEach(async () => {
        await suite.beforeEach();
      });

      afterEach(async () => {
        await suite.afterEach();
      });

      // Simulate a test running with proper setup and teardown
      await suite.beforeEach();

      const env = getTestEnvironment();
      expect(env).not.toBeNull();
      expect(env!.projectPath).toBe('/test/project');

      await suite.afterEach();

      expect(getTestEnvironment()).toBeNull();
    });
  });

  describe('CLI Package Test Pattern', () => {
    it('should support CLI package testing with file system mocks', async () => {
      // Replicates the CLI package example from documentation
      const suite = createTestSuite({
        setupMocks: true,
        mockConfig: {
          mockFs: true,
          mockData: {
            fileSystemData: {
              '/test/sessions/session1.json': '{"id": "session1", "name": "Test Session"}',
              '/test/sessions/session2.json': '{"id": "session2", "name": "Another Session"}',
              '/test/config.yaml': 'version: 1\nsetting: value'
            }
          }
        }
      });

      await suite.beforeEach();

      // Test that fs.readFile returns mocked data
      const session1 = await fs.readFile('/test/sessions/session1.json', 'utf-8');
      const sessionData = JSON.parse(session1);
      expect(sessionData).toEqual({ id: 'session1', name: 'Test Session' });

      const config = await fs.readFile('/test/config.yaml', 'utf-8');
      expect(config).toBe('version: 1\nsetting: value');

      await suite.afterEach();
    });
  });

  describe('Orchestrator Package Test Pattern', () => {
    it('should support orchestrator package testing with database and agent mocks', async () => {
      // Replicates the orchestrator package example from documentation
      const customSetupCalled = vi.fn();
      const mockClaudeAgent = vi.fn().mockResolvedValue('agent response');
      const mockTaskStore = vi.fn().mockReturnValue({
        save: vi.fn(),
        load: vi.fn()
      });

      const suite = createTestSuite({
        setupMocks: true,
        timeout: 60000,
        mockConfig: {
          customMocks: {
            claudeAgent: mockClaudeAgent,
            taskStore: mockTaskStore
          }
        },
        customSetup: async () => {
          customSetupCalled();
          // Simulate database initialization
          setTestData('testDb', { initialized: true, tables: ['tasks', 'sessions'] });
          addCleanupTask(() => {
            // Simulate database cleanup
            setTestData('testDb', null);
          });
        }
      });

      await suite.beforeEach();

      expect(customSetupCalled).toHaveBeenCalled();

      const env = getTestEnvironment();
      expect(env!.activeMocks.has('claudeAgent')).toBe(true);
      expect(env!.activeMocks.has('taskStore')).toBe(true);

      const testDb = getTestData('testDb');
      expect(testDb).toEqual({ initialized: true, tables: ['tasks', 'sessions'] });

      // Test using the mocked agent
      const claudeAgent = env!.activeMocks.get('claudeAgent');
      const result = await claudeAgent('test prompt');
      expect(result).toBe('agent response');

      await suite.afterEach();

      // After teardown, test data should be cleaned up
      expect(getTestData('testDb')).toBeUndefined();
    });
  });

  describe('Custom Setup/Teardown Pattern', () => {
    it('should support custom setup and teardown hooks', async () => {
      const setupOrder: string[] = [];
      const teardownOrder: string[] = [];

      const suite = createTestSuite({
        customSetup: async () => {
          setupOrder.push('custom-setup');
          setTestData('resource', { id: 'resource-1', active: true });
        },
        customTeardown: async () => {
          teardownOrder.push('custom-teardown');
          const resource = getTestData('resource');
          if (resource) {
            // Simulate resource cleanup
            setTestData('resource', { ...resource, active: false });
          }
        }
      });

      await suite.beforeEach();

      expect(setupOrder).toEqual(['custom-setup']);

      const resource = getTestData('resource');
      expect(resource).toEqual({ id: 'resource-1', active: true });

      await suite.afterEach();

      expect(teardownOrder).toEqual(['custom-teardown']);
    });
  });

  describe('Timer-based Test Pattern', () => {
    it('should support timer-based tests with fake timers', async () => {
      const suite = createTestSuite({ useFakeTimers: true });

      await suite.beforeEach();

      // Test delayed operations
      const callback = vi.fn();
      setTimeout(callback, 5000);

      // With fake timers, callback hasn't been called yet
      expect(callback).not.toHaveBeenCalled();

      // Advance timers by 5 seconds
      await advanceTimers(5000);
      expect(callback).toHaveBeenCalledOnce();

      // Test multiple timers
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      setTimeout(callback1, 1000);
      setTimeout(callback2, 3000);

      await advanceTimers(2000);
      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      await advanceTimers(2000); // Total 4000ms
      expect(callback2).toHaveBeenCalled();

      await suite.afterEach();
    });

    it('should support flushing all timers at once', async () => {
      const suite = createTestSuite({ useFakeTimers: true });

      await suite.beforeEach();

      const callbacks = [vi.fn(), vi.fn(), vi.fn()];
      setTimeout(callbacks[0], 1000);
      setTimeout(callbacks[1], 5000);
      setTimeout(callbacks[2], 10000);

      expect(callbacks.every(cb => !cb.mock.calls.length)).toBe(true);

      await flushTimers();

      expect(callbacks.every(cb => cb.mock.calls.length > 0)).toBe(true);

      await suite.afterEach();
    });
  });

  describe('Resource Management Pattern', () => {
    it('should support automatic resource cleanup', async () => {
      const resourceCleanupOrder: string[] = [];

      const suite = createTestSuite({
        customSetup: async () => {
          // Simulate opening multiple resources
          setTestData('database', { connected: true });
          setTestData('fileHandle', { open: true });
          setTestData('networkConnection', { active: true });

          // Register cleanup for each resource
          addCleanupTask(() => {
            resourceCleanupOrder.push('database-cleanup');
            setTestData('database', null);
          });

          addCleanupTask(() => {
            resourceCleanupOrder.push('file-cleanup');
            setTestData('fileHandle', null);
          });

          addCleanupTask(() => {
            resourceCleanupOrder.push('network-cleanup');
            setTestData('networkConnection', null);
          });
        }
      });

      await suite.beforeEach();

      // Verify resources are set up
      expect(getTestData('database')).toEqual({ connected: true });
      expect(getTestData('fileHandle')).toEqual({ open: true });
      expect(getTestData('networkConnection')).toEqual({ active: true });

      await suite.afterEach();

      // Verify cleanup order (should match registration order)
      expect(resourceCleanupOrder).toEqual([
        'database-cleanup',
        'file-cleanup',
        'network-cleanup'
      ]);

      // Verify resources were cleaned up
      expect(getTestData('database')).toBeUndefined();
      expect(getTestData('fileHandle')).toBeUndefined();
      expect(getTestData('networkConnection')).toBeUndefined();
    });
  });

  describe('Temporary File Management Pattern', () => {
    it('should support temporary directory creation and cleanup', async () => {
      const suite = createTestSuite({
        customSetup: async () => {
          const tempDir = await createTempDir();
          setTestData('workingDir', tempDir);
        }
      });

      await suite.beforeEach();

      const workingDir = getTestData('workingDir');
      expect(workingDir).toBeDefined();
      expect(typeof workingDir).toBe('string');
      expect(workingDir.includes('apex-test-')).toBe(true);

      const env = getTestEnvironment();
      expect(env!.tempDir).toBe(workingDir);

      await suite.afterEach();

      // Test environment should be cleaned up
      expect(getTestEnvironment()).toBeNull();
    });
  });

  describe('Mock Function Pattern', () => {
    it('should support creating and tracking named mock functions', async () => {
      const suite = createTestSuite();

      await suite.beforeEach();

      // Create named mock functions
      const mockLogger = createMockFunction('logger', (message: string) => {
        return `logged: ${message}`;
      });

      const mockValidator = createMockFunction('validator');

      // Test mock functionality
      expect(mockLogger('test message')).toBe('logged: test message');
      expect(mockLogger).toHaveBeenCalledWith('test message');

      mockValidator.mockReturnValue(true);
      expect(mockValidator()).toBe(true);

      // Verify mocks are registered
      const env = getTestEnvironment();
      expect(env!.activeMocks.has('logger')).toBe(true);
      expect(env!.activeMocks.has('validator')).toBe(true);
      expect(env!.activeMocks.get('logger')).toBe(mockLogger);
      expect(env!.activeMocks.get('validator')).toBe(mockValidator);

      await suite.afterEach();

      // Environment should be cleared
      expect(getTestEnvironment()).toBeNull();
    });
  });

  describe('Complex Integration Pattern', () => {
    it('should support complex test scenarios with multiple features', async () => {
      const integrationLog: string[] = [];

      const suite = createTestSuite({
        setupMocks: true,
        useFakeTimers: true,
        timeout: 30000,
        mockConfig: {
          mockFs: true,
          mockNetwork: true,
          mockData: {
            fileSystemData: {
              '/app/config.json': JSON.stringify({ apiUrl: 'https://api.example.com' })
            },
            apiResponses: {
              'https://api.example.com/data': { items: [1, 2, 3] }
            },
            envVars: {
              NODE_ENV: 'test',
              LOG_LEVEL: 'debug'
            }
          },
          customMocks: {
            eventBus: createMockFunction('eventBus')
          }
        },
        customSetup: async () => {
          integrationLog.push('custom-setup-start');

          // Create temp workspace
          const workspace = await createTempDir();
          setTestData('workspace', workspace);

          // Register cleanup
          addCleanupTask(() => {
            integrationLog.push('workspace-cleanup');
          });

          integrationLog.push('custom-setup-complete');
        },
        customTeardown: async () => {
          integrationLog.push('custom-teardown');
        }
      });

      await suite.beforeEach();

      // Verify all setup components work together
      expect(integrationLog).toContain('custom-setup-start');
      expect(integrationLog).toContain('custom-setup-complete');

      // Test file system mock
      const configContent = await fs.readFile('/app/config.json', 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.apiUrl).toBe('https://api.example.com');

      // Test network mock
      const response = await global.fetch('https://api.example.com/data');
      const data = await response.json();
      expect(data.items).toEqual([1, 2, 3]);

      // Test environment variables
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.LOG_LEVEL).toBe('debug');

      // Test custom mocks
      const env = getTestEnvironment();
      const eventBus = env!.activeMocks.get('eventBus');
      expect(eventBus).toBeDefined();

      // Test fake timers
      const delayedCallback = vi.fn();
      setTimeout(delayedCallback, 2000);

      await advanceTimers(2000);
      expect(delayedCallback).toHaveBeenCalled();

      // Test temp directory
      const workspace = getTestData('workspace');
      expect(workspace).toBeDefined();
      expect(env!.tempDir).toBe(workspace);

      await suite.afterEach();

      // Verify teardown sequence
      expect(integrationLog).toContain('custom-teardown');
      expect(integrationLog).toContain('workspace-cleanup');

      // Environment should be completely cleaned up
      expect(getTestEnvironment()).toBeNull();
    });
  });

  describe('State Isolation Pattern', () => {
    it('should ensure complete state isolation between test runs', async () => {
      const suite = createTestSuite({
        setupMocks: true,
        mockConfig: {
          customMocks: {
            sharedService: vi.fn()
          }
        }
      });

      // First test run
      await suite.beforeEach();

      setTestData('counter', 1);
      setTestData('userState', { loggedIn: true, userId: 123 });

      const env1 = getTestEnvironment();
      const sharedService1 = env1!.activeMocks.get('sharedService');
      sharedService1();

      expect(getTestData('counter')).toBe(1);
      expect(sharedService1).toHaveBeenCalledTimes(1);

      await suite.afterEach();

      // Second test run
      await suite.beforeEach();

      const env2 = getTestEnvironment();
      const sharedService2 = env2!.activeMocks.get('sharedService');

      // State should be completely isolated
      expect(getTestData('counter')).toBeUndefined();
      expect(getTestData('userState')).toBeUndefined();
      expect(sharedService2).not.toHaveBeenCalled();

      // Should be able to set new state without interference
      setTestData('counter', 99);
      expect(getTestData('counter')).toBe(99);

      await suite.afterEach();

      // Third test run
      await suite.beforeEach();

      expect(getTestData('counter')).toBeUndefined();

      await suite.afterEach();
    });
  });
});