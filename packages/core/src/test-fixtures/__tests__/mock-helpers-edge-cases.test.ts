/**
 * @fileoverview Edge Cases and Error Scenarios for Mock Helpers
 *
 * This test file covers edge cases, error scenarios, and boundary conditions
 * for all mock helper functions to ensure robust behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createOrchestratorMock,
  createAgentSdkMock,
  createFileSystemMock,
  createNetworkMock,
  createTaskStoreMock,
  createEventEmitterMock,
  createPageMock,
  createConsoleMock,
  createMockEnvironment,
} from '../mock-helpers.js';

describe('Mock Helpers Edge Cases and Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrchestratorMock edge cases', () => {
    it('should handle null and undefined overrides gracefully', () => {
      expect(() => createOrchestratorMock(null as any)).not.toThrow();
      expect(() => createOrchestratorMock(undefined)).not.toThrow();
    });

    it('should handle invalid override values', () => {
      const mock = createOrchestratorMock({
        executeTask: 'not a function' as any,
        invalidProperty: () => 'should be merged'
      });

      expect(mock.executeTask).toBe('not a function');
      expect((mock as any).invalidProperty()).toBe('should be merged');
    });

    it('should handle deep object overrides', () => {
      const complexOverride = {
        loadConfig: vi.fn().mockResolvedValue({
          nested: {
            deeply: {
              value: 'deep override'
            }
          }
        })
      };

      const mock = createOrchestratorMock(complexOverride);
      expect(mock.loadConfig).toBe(complexOverride.loadConfig);
    });
  });

  describe('createFileSystemMock edge cases', () => {
    it('should handle empty file data gracefully', async () => {
      const mock = createFileSystemMock({});

      await expect(mock.readFile('/any/path')).rejects.toThrow('ENOENT');
      expect(await mock.readdir('/any/path')).toEqual([]);
    });

    it('should handle file data with special characters', async () => {
      const specialPaths = {
        '/path with spaces/file.txt': 'content with spaces',
        '/path/with/unicode/文件.txt': 'unicode content',
        '/path/with/symbols/@#$%.txt': 'symbol content',
        '': 'empty path'
      };

      const mock = createFileSystemMock(specialPaths);

      expect(await mock.readFile('/path with spaces/file.txt')).toBe('content with spaces');
      expect(await mock.readFile('/path/with/unicode/文件.txt')).toBe('unicode content');
      expect(await mock.readFile('/path/with/symbols/@#$%.txt')).toBe('symbol content');
      expect(await mock.readFile('')).toBe('empty path');
    });

    it('should handle very large file content', async () => {
      const largeContent = 'x'.repeat(100000);
      const mock = createFileSystemMock({
        '/large-file.txt': largeContent
      });

      const content = await mock.readFile('/large-file.txt');
      expect(content).toBe(largeContent);
      expect(content.length).toBe(100000);

      const stats = await mock.stat('/large-file.txt');
      expect(stats.size).toBe(100000);
    });

    it('should handle readdir with nested paths', async () => {
      const fileData = {
        '/root/file1.txt': 'content1',
        '/root/subdir/file2.txt': 'content2',
        '/root/subdir/deeper/file3.txt': 'content3',
        '/root/another/file4.txt': 'content4'
      };

      const mock = createFileSystemMock(fileData);

      const rootContents = await mock.readdir('/root');
      expect(rootContents).toContain('file1.txt');
      expect(rootContents).toContain('subdir');
      expect(rootContents).toContain('another');

      const subdirContents = await mock.readdir('/root/subdir');
      expect(subdirContents).toContain('file2.txt');
      expect(subdirContents).toContain('deeper');
    });

    it('should handle concurrent file operations', async () => {
      const mock = createFileSystemMock({
        '/file1.txt': 'content1',
        '/file2.txt': 'content2',
        '/file3.txt': 'content3'
      });

      const promises = [
        mock.readFile('/file1.txt'),
        mock.readFile('/file2.txt'),
        mock.readFile('/file3.txt'),
        mock.stat('/file1.txt'),
        mock.access('/file2.txt')
      ];

      const results = await Promise.all(promises);
      expect(results[0]).toBe('content1');
      expect(results[1]).toBe('content2');
      expect(results[2]).toBe('content3');
      expect(results[3].size).toBe('content1'.length);
    });
  });

  describe('createNetworkMock edge cases', () => {
    it('should handle URL objects and strings consistently', async () => {
      const mock = createNetworkMock({
        'https://example.com/test': { data: 'test' }
      });

      const urlObject = new URL('https://example.com/test');
      const response = await mock.fetch(urlObject);
      const data = await response.json();
      expect(data.data).toBe('test');
    });

    it('should handle complex response objects', async () => {
      const complexResponse = {
        nested: {
          data: [1, 2, 3],
          meta: {
            count: 3,
            hasMore: false
          }
        },
        headers: {
          'X-Custom': 'value'
        }
      };

      const mock = createNetworkMock({
        'https://api.example.com/complex': complexResponse
      });

      const response = await mock.fetch('https://api.example.com/complex');
      const data = await response.json();
      expect(data).toEqual(complexResponse);
    });

    it('should handle binary and non-JSON responses', async () => {
      const mock = createNetworkMock({
        'https://api.example.com/text': 'plain text response',
        'https://api.example.com/number': 42,
        'https://api.example.com/boolean': false
      });

      const textResponse = await mock.fetch('https://api.example.com/text');
      expect(await textResponse.json()).toBe('plain text response');

      const numberResponse = await mock.fetch('https://api.example.com/number');
      expect(await numberResponse.json()).toBe(42);

      const boolResponse = await mock.fetch('https://api.example.com/boolean');
      expect(await boolResponse.json()).toBe(false);
    });

    it('should handle multiple response additions and removals', () => {
      const mock = createNetworkMock();

      // Add multiple responses
      mock.addResponse('https://api1.com', { id: 1 });
      mock.addResponse('https://api2.com', { id: 2 });
      mock.addResponse('https://api3.com', { id: 3 });

      // Override existing response
      mock.addResponse('https://api1.com', { id: 'updated' });

      // Add error simulation
      mock.simulateNetworkError('https://error.com');
    });

    it('should handle concurrent network requests', async () => {
      const mock = createNetworkMock({
        'https://api.example.com/1': { id: 1 },
        'https://api.example.com/2': { id: 2 },
        'https://api.example.com/3': { id: 3 },
        'https://api.example.com/4': { id: 4 },
        'https://api.example.com/5': { id: 5 }
      });

      const promises = [
        mock.fetch('https://api.example.com/1'),
        mock.fetch('https://api.example.com/2'),
        mock.fetch('https://api.example.com/3'),
        mock.fetch('https://api.example.com/4'),
        mock.fetch('https://api.example.com/5')
      ];

      const responses = await Promise.all(promises);
      const data = await Promise.all(responses.map(r => r.json()));

      expect(data).toEqual([
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }
      ]);
    });
  });

  describe('createTaskStoreMock edge cases', () => {
    it('should handle tasks with missing IDs in initial data', () => {
      const tasksWithoutIds = [
        { status: 'pending', workflow: 'test1' },
        { status: 'running', workflow: 'test2' }
      ];

      const mock = createTaskStoreMock(tasksWithoutIds as any);
      const tasks = mock._getTasks();

      // Tasks without IDs should still be stored
      expect(tasks).toHaveLength(2);
    });

    it('should handle duplicate task IDs in initial data', () => {
      const duplicateIdTasks = [
        { id: 'duplicate', status: 'pending', workflow: 'test1' },
        { id: 'duplicate', status: 'running', workflow: 'test2' }
      ];

      const mock = createTaskStoreMock(duplicateIdTasks);
      const tasks = mock._getTasks();

      // Map should handle duplicates by overwriting
      expect(tasks).toHaveLength(1);
      expect(tasks[0].workflow).toBe('test2'); // Last one wins
    });

    it('should handle very large numbers of tasks', async () => {
      const largeTasks = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        status: 'pending' as const,
        workflow: `workflow-${i % 10}`
      }));

      const mock = createTaskStoreMock(largeTasks);

      expect(mock._getTasks()).toHaveLength(1000);

      const task = await mock.get('task-500');
      expect(task?.id).toBe('task-500');
      expect(task?.workflow).toBe('workflow-0');
    });

    it('should handle concurrent task operations', async () => {
      const mock = createTaskStoreMock();

      const createPromises = Array.from({ length: 10 }, (_, i) =>
        mock.create({ workflow: `workflow-${i}`, description: `Task ${i}` })
      );

      const createdTasks = await Promise.all(createPromises);
      expect(createdTasks).toHaveLength(10);

      // All tasks should have unique IDs
      const ids = createdTasks.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should handle task updates with invalid data', async () => {
      const mock = createTaskStoreMock();

      const task = await mock.create({ workflow: 'test' });

      // Should handle null/undefined updates gracefully
      const updated1 = await mock.update(task.id, null as any);
      expect(updated1.id).toBe(task.id);

      const updated2 = await mock.update(task.id, undefined as any);
      expect(updated2.id).toBe(task.id);
    });
  });

  describe('createEventEmitterMock edge cases', () => {
    it('should handle events with special characters', () => {
      const mock = createEventEmitterMock();
      const listener = vi.fn();

      const specialEvents = [
        'event with spaces',
        'event:with:colons',
        'event.with.dots',
        'event/with/slashes',
        'event@with@symbols',
        ''
      ];

      specialEvents.forEach(eventName => {
        mock.on(eventName, listener);
        mock.emit(eventName, 'data');
      });

      expect(listener).toHaveBeenCalledTimes(specialEvents.length);
    });

    it('should handle very large numbers of listeners', () => {
      const mock = createEventEmitterMock();
      const listeners = Array.from({ length: 100 }, () => vi.fn());

      listeners.forEach(listener => {
        mock.on('test-event', listener);
      });

      mock.emit('test-event', 'data');

      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledWith('data');
      });

      expect(mock._getListeners('test-event')).toHaveLength(100);
    });

    it('should handle listener removal edge cases', () => {
      const mock = createEventEmitterMock();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      mock.on('event', listener1);
      mock.on('event', listener2);

      // Remove non-existent listener
      mock.off('event', vi.fn());
      expect(mock._getListeners('event')).toHaveLength(2);

      // Remove from non-existent event
      mock.off('nonexistent', listener1);
      expect(mock._getListeners('event')).toHaveLength(2);

      // Remove existing listener
      mock.off('event', listener1);
      expect(mock._getListeners('event')).toHaveLength(1);
    });

    it('should handle listeners that throw errors', () => {
      const mock = createEventEmitterMock();
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      mock.on('event', errorListener);
      mock.on('event', normalListener);

      // Should not throw, should continue with other listeners
      expect(() => mock.emit('event', 'data')).not.toThrow();
      expect(normalListener).toHaveBeenCalledWith('data');
    });

    it('should handle emit with various argument types', () => {
      const mock = createEventEmitterMock();
      const listener = vi.fn();

      mock.on('event', listener);

      // Different argument combinations
      mock.emit('event');
      mock.emit('event', 'string');
      mock.emit('event', 123);
      mock.emit('event', null);
      mock.emit('event', undefined);
      mock.emit('event', { object: true });
      mock.emit('event', [1, 2, 3]);
      mock.emit('event', 'multiple', 'arguments', 123);

      expect(listener).toHaveBeenCalledTimes(8);
    });
  });

  describe('createPageMock edge cases', () => {
    it('should handle malformed selectors', async () => {
      const mock = createPageMock();

      // Should not throw for unusual selectors
      await expect(mock.click('')).resolves.toBeUndefined();
      await expect(mock.click('invalid>>selector')).resolves.toBeUndefined();
      await expect(mock.waitForSelector('###invalid')).resolves.toEqual({});
    });

    it('should handle very long text input', async () => {
      const mock = createPageMock();
      const veryLongText = 'x'.repeat(10000);

      await expect(mock.type('input', veryLongText)).resolves.toBeUndefined();
      await expect(mock.fill('textarea', veryLongText)).resolves.toBeUndefined();
    });

    it('should handle evaluate with complex functions', async () => {
      const mock = createPageMock();

      // Complex function with closure
      const complexFunction = (base: number) => {
        return (multiplier: number) => base * multiplier;
      };

      const result = await mock.evaluate(complexFunction, 5);
      expect(typeof result).toBe('function');
    });

    it('should handle concurrent page operations', async () => {
      const mock = createPageMock();

      const operations = [
        mock.goto('https://example.com'),
        mock.click('button'),
        mock.type('input', 'text'),
        mock.fill('textarea', 'content'),
        mock.waitForSelector('.element'),
        mock.screenshot(),
        mock.title(),
        mock.content()
      ];

      // All operations should complete without interference
      const results = await Promise.all(operations);
      expect(results).toHaveLength(8);
    });

    it('should handle locator chaining edge cases', () => {
      const mock = createPageMock();

      const locator = mock.locator('selector');

      // Chaining methods should return the same object
      expect(locator.first()).toBe(locator);
      expect(locator.last()).toBe(locator);
      expect(locator.first().last()).toBe(locator);
    });
  });

  describe('createConsoleMock edge cases', () => {
    it('should handle very large numbers of messages', () => {
      const mock = createConsoleMock();

      // Add many messages
      for (let i = 0; i < 1000; i++) {
        mock.log(`Message ${i}`);
      }

      const messages = mock._getMessages();
      expect(messages).toHaveLength(1000);
      expect(messages[0].message).toBe('Message 0');
      expect(messages[999].message).toBe('Message 999');
    });

    it('should handle messages with special objects', () => {
      const mock = createConsoleMock();

      const specialObjects = [
        null,
        undefined,
        {},
        [],
        new Date(),
        new Error('test'),
        /regex/,
        Symbol('test'),
        new Map([['key', 'value']]),
        new Set([1, 2, 3])
      ];

      specialObjects.forEach((obj, index) => {
        mock.log('Object', index, obj);
      });

      const messages = mock._getMessages();
      expect(messages).toHaveLength(specialObjects.length);
    });

    it('should handle message filtering edge cases', () => {
      const mock = createConsoleMock();

      mock.log('log message');
      mock.error('error message');
      mock.warn('warn message');
      mock.info('info message');

      // Filter by non-existent level
      const nonExistent = mock._getMessagesByLevel('debug' as any);
      expect(nonExistent).toEqual([]);

      // Filter by empty string
      const empty = mock._getMessagesByLevel('');
      expect(empty).toEqual([]);
    });

    it('should handle concurrent message logging', () => {
      const mock = createConsoleMock();

      const promises = Array.from({ length: 100 }, (_, i) => {
        return Promise.resolve().then(() => {
          mock.log(`Concurrent message ${i}`);
        });
      });

      return Promise.all(promises).then(() => {
        const messages = mock._getMessages();
        expect(messages).toHaveLength(100);
      });
    });
  });

  describe('createMockEnvironment edge cases', () => {
    it('should handle invalid option types gracefully', () => {
      expect(() => createMockEnvironment(null as any)).not.toThrow();
      expect(() => createMockEnvironment('string' as any)).not.toThrow();
      expect(() => createMockEnvironment(123 as any)).not.toThrow();
    });

    it('should handle complex nested configuration', () => {
      const complexConfig = {
        includeOrchestrator: true,
        includeFileSystem: true,
        includeNetwork: true,
        includeTaskStore: true,
        fileData: {
          '/complex/path/file1.txt': 'content1',
          '/complex/path/file2.json': JSON.stringify({ complex: { nested: 'data' } })
        },
        networkResponses: {
          'https://api1.com/endpoint': {
            complex: {
              response: {
                with: {
                  deeply: {
                    nested: 'data'
                  }
                }
              }
            }
          }
        },
        initialTasks: Array.from({ length: 10 }, (_, i) => ({
          id: `complex-task-${i}`,
          status: 'pending' as const,
          workflow: `complex-workflow-${i}`,
          metadata: {
            complex: {
              nested: {
                data: i
              }
            }
          }
        }))
      };

      const env = createMockEnvironment(complexConfig);

      expect(env.orchestrator).toBeDefined();
      expect(env.fs).toBeDefined();
      expect(env.network).toBeDefined();
      expect(env.taskStore).toBeDefined();
    });

    it('should handle selective inclusion edge cases', () => {
      // All false
      const env1 = createMockEnvironment({
        includeOrchestrator: false,
        includeFileSystem: false,
        includeNetwork: false,
        includeTaskStore: false
      });

      expect(env1.orchestrator).toBeUndefined();
      expect(env1.fs).toBeUndefined();
      expect(env1.network).toBeUndefined();
      expect(env1.taskStore).toBeUndefined();

      // Partial inclusion
      const env2 = createMockEnvironment({
        includeOrchestrator: true,
        includeFileSystem: false,
        includeNetwork: true,
        includeTaskStore: false
      });

      expect(env2.orchestrator).toBeDefined();
      expect(env2.fs).toBeUndefined();
      expect(env2.network).toBeDefined();
      expect(env2.taskStore).toBeUndefined();
    });

    it('should handle empty arrays and objects in configuration', () => {
      const env = createMockEnvironment({
        fileData: {},
        networkResponses: {},
        initialTasks: []
      });

      expect(env.orchestrator).toBeDefined();
      expect(env.fs).toBeDefined();
      expect(env.network).toBeDefined();
      expect(env.taskStore).toBeDefined();
    });
  });

  describe('Mock function reset behavior', () => {
    it('should maintain mock implementations after vi.clearAllMocks()', async () => {
      const customImpl = vi.fn().mockResolvedValue('custom result');
      const mock = createOrchestratorMock({
        executeTask: customImpl
      });

      await mock.executeTask('test');
      expect(customImpl).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // Mock should still work but call count should be reset
      const result = await mock.executeTask('test2');
      expect(result).toBe('custom result');
      expect(customImpl).toHaveBeenCalledTimes(1); // Reset to 1
    });

    it('should handle mock spies correctly', () => {
      const originalFunction = () => 'original';
      const spy = vi.fn(originalFunction);

      const mock = createPageMock({
        title: spy
      });

      mock.title();
      expect(spy).toHaveBeenCalled();
    });
  });
});