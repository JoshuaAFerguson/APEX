/**
 * @fileoverview Tests for Mock Helpers API Documentation Accuracy
 *
 * This test file validates that all mock helper functions work exactly as documented
 * in docs/mock-helpers-api.md. It serves as both a test suite and a verification
 * that the API documentation is accurate and complete.
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
  mockHelpers,
} from '../mock-helpers.js';

describe('Mock Helpers API Documentation Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrchestratorMock', () => {
    it('should have correct default implementations as documented', async () => {
      const mock = createOrchestratorMock();

      // Test executeTask default return value
      const executeResult = await mock.executeTask('test-workflow', 'Test description');
      expect(executeResult).toEqual({
        success: true,
        taskId: 'mock-task-id',
        result: 'Task completed successfully'
      });

      // Test createTask default return value
      const createResult = await mock.createTask({ workflow: 'test' });
      expect(createResult).toEqual({
        id: 'mock-task-id',
        status: 'pending',
        workflow: 'feature-development',
        createdAt: expect.any(Date)
      });

      // Test getTask default return value
      const getResult = await mock.getTask('test-id');
      expect(getResult).toEqual({
        id: 'mock-task-id',
        status: 'running',
        workflow: 'feature-development'
      });

      // Test getTasks default return value
      const getTasksResult = await mock.getTasks();
      expect(getTasksResult).toEqual([]);

      // Test loadConfig default return value
      const configResult = await mock.loadConfig();
      expect(configResult).toEqual({
        autonomyLevel: 'supervised',
        agents: {},
        workflows: {}
      });

      // Test getAgents default return value
      const agentsResult = mock.getAgents();
      expect(agentsResult).toEqual([]);

      // Test getWorkflows default return value
      const workflowsResult = mock.getWorkflows();
      expect(workflowsResult).toEqual([]);
    });

    it('should support overrides as documented', async () => {
      const customExecuteTask = vi.fn().mockResolvedValue({
        success: true,
        taskId: 'custom-task-id',
        result: 'Custom result'
      });

      const mock = createOrchestratorMock({
        executeTask: customExecuteTask
      });

      const result = await mock.executeTask('test-workflow', 'Test description');
      expect(result).toEqual({
        success: true,
        taskId: 'custom-task-id',
        result: 'Custom result'
      });
      expect(customExecuteTask).toHaveBeenCalledWith('test-workflow', 'Test description');
    });

    it('should have all documented methods', () => {
      const mock = createOrchestratorMock();

      // Core orchestrator methods
      expect(vi.isMockFunction(mock.executeTask)).toBe(true);
      expect(vi.isMockFunction(mock.createTask)).toBe(true);
      expect(vi.isMockFunction(mock.getTask)).toBe(true);
      expect(vi.isMockFunction(mock.getTasks)).toBe(true);

      // Event methods
      expect(vi.isMockFunction(mock.on)).toBe(true);
      expect(vi.isMockFunction(mock.off)).toBe(true);
      expect(vi.isMockFunction(mock.emit)).toBe(true);
      expect(vi.isMockFunction(mock.addEventListener)).toBe(true);
      expect(vi.isMockFunction(mock.removeEventListener)).toBe(true);

      // Configuration methods
      expect(vi.isMockFunction(mock.loadConfig)).toBe(true);
      expect(vi.isMockFunction(mock.getAgents)).toBe(true);
      expect(vi.isMockFunction(mock.getWorkflows)).toBe(true);
    });
  });

  describe('createAgentSdkMock', () => {
    it('should have correct default implementations as documented', async () => {
      const mock = createAgentSdkMock();

      // Test query default return value
      const queryResult = await mock.query('test prompt');
      expect(queryResult).toEqual({
        text: 'Mock agent response',
        usage: {
          input_tokens: 100,
          output_tokens: 150
        }
      });

      // Test createClient default return value
      const client = mock.createClient();
      expect(client).toBeDefined();
      expect(client.messages).toBeDefined();
      expect(vi.isMockFunction(client.messages.create)).toBe(true);

      const createResult = await client.messages.create();
      expect(createResult).toEqual({
        content: [{ text: 'Mock response' }],
        usage: { input_tokens: 100, output_tokens: 150 }
      });
    });

    it('should support overrides as documented', async () => {
      const customQuery = vi.fn().mockResolvedValue({
        text: 'Custom agent response',
        usage: { input_tokens: 50, output_tokens: 75 }
      });

      const mock = createAgentSdkMock({
        query: customQuery
      });

      const result = await mock.query('test prompt');
      expect(result.text).toBe('Custom agent response');
      expect(result.usage).toEqual({ input_tokens: 50, output_tokens: 75 });
    });

    it('should have all documented methods', () => {
      const mock = createAgentSdkMock();

      expect(vi.isMockFunction(mock.query)).toBe(true);
      expect(vi.isMockFunction(mock.createClient)).toBe(true);
    });
  });

  describe('createFileSystemMock', () => {
    it('should work with configured file data as documented', async () => {
      const mock = createFileSystemMock({
        '/path/to/file.txt': 'file content',
        '/path/to/config.json': '{"key": "value"}'
      });

      // Test readFile with existing file
      const content = await mock.readFile('/path/to/file.txt');
      expect(content).toBe('file content');

      // Test readFile with another file
      const configContent = await mock.readFile('/path/to/config.json');
      expect(configContent).toBe('{"key": "value"}');
    });

    it('should throw ENOENT for missing files as documented', async () => {
      const mock = createFileSystemMock({
        '/path/to/file.txt': 'file content'
      });

      await expect(mock.readFile('/nonexistent.txt'))
        .rejects
        .toThrow("ENOENT: no such file or directory, open '/nonexistent.txt'");
    });

    it('should handle all documented methods', async () => {
      const mock = createFileSystemMock({
        '/test.txt': 'content'
      });

      // Test writeFile
      await expect(mock.writeFile('/new.txt', 'content')).resolves.toBeUndefined();

      // Test mkdir
      await expect(mock.mkdir('/dir')).resolves.toBeUndefined();

      // Test unlink
      await expect(mock.unlink('/test.txt')).resolves.toBeUndefined();

      // Test stat for existing file
      const stats = await mock.stat('/test.txt');
      expect(stats.isFile()).toBe(true);
      expect(stats.isDirectory()).toBe(false);
      expect(stats.size).toBe('content'.length);

      // Test stat for missing file
      await expect(mock.stat('/missing.txt'))
        .rejects
        .toThrow("ENOENT: no such file or directory, stat '/missing.txt'");

      // Test access for existing file
      await expect(mock.access('/test.txt')).resolves.toBeUndefined();

      // Test access for missing file
      await expect(mock.access('/missing.txt'))
        .rejects
        .toThrow("ENOENT: no such file or directory, access '/missing.txt'");
    });

    it('should have all documented methods', () => {
      const mock = createFileSystemMock();

      expect(vi.isMockFunction(mock.readFile)).toBe(true);
      expect(vi.isMockFunction(mock.writeFile)).toBe(true);
      expect(vi.isMockFunction(mock.mkdir)).toBe(true);
      expect(vi.isMockFunction(mock.unlink)).toBe(true);
      expect(vi.isMockFunction(mock.readdir)).toBe(true);
      expect(vi.isMockFunction(mock.stat)).toBe(true);
      expect(vi.isMockFunction(mock.access)).toBe(true);
    });
  });

  describe('createNetworkMock', () => {
    it('should work with configured responses as documented', async () => {
      const mock = createNetworkMock({
        'https://api.example.com/data': { success: true, data: [] },
        'https://api.example.com/user': 'user response string'
      });

      // Test JSON response
      const response = await mock.fetch('https://api.example.com/data');
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);

      // Test string response
      const userResponse = await mock.fetch('https://api.example.com/user');
      const userData = await userResponse.json();
      expect(userData).toBe('user response string');
    });

    it('should throw for unmocked URLs as documented', async () => {
      const mock = createNetworkMock();

      await expect(mock.fetch('https://unmocked.com'))
        .rejects
        .toThrow('Network request to https://unmocked.com was not mocked');
    });

    it('should support dynamic response addition as documented', async () => {
      const mock = createNetworkMock({
        'https://api.example.com/data': { success: true, data: [] }
      });

      // Add response dynamically
      mock.addResponse('https://api.example.com/new', { id: 123 });

      const response = await mock.fetch('https://api.example.com/new');
      const data = await response.json();
      expect(data.id).toBe(123);
    });

    it('should support network error simulation as documented', async () => {
      const mock = createNetworkMock();

      // Simulate network error
      mock.simulateNetworkError('https://api.example.com/error');

      await expect(mock.fetch('https://api.example.com/error'))
        .rejects
        .toThrow('Network Error');
    });

    it('should have all documented methods', () => {
      const mock = createNetworkMock();

      expect(vi.isMockFunction(mock.fetch)).toBe(true);
      expect(typeof mock.addResponse).toBe('function');
      expect(typeof mock.simulateNetworkError).toBe('function');
    });
  });

  describe('createTaskStoreMock', () => {
    it('should work with initial tasks as documented', async () => {
      const mock = createTaskStoreMock([
        { id: 'existing-task', status: 'completed', workflow: 'test' }
      ]);

      const retrieved = await mock.get('existing-task');
      expect(retrieved).toEqual({
        id: 'existing-task',
        status: 'completed',
        workflow: 'test'
      });
    });

    it('should handle task creation as documented', async () => {
      const mock = createTaskStoreMock();

      const newTask = await mock.create({
        workflow: 'feature-development',
        description: 'Test task'
      });

      expect(newTask.id).toBeDefined();
      expect(newTask.status).toBe('pending');
      expect(newTask.workflow).toBe('feature-development');
      expect(newTask.description).toBe('Test task');
      expect(newTask.createdAt).toBeInstanceOf(Date);
      expect(newTask.updatedAt).toBeInstanceOf(Date);
    });

    it('should support all CRUD operations as documented', async () => {
      const mock = createTaskStoreMock();

      // Create
      const task = await mock.create({
        workflow: 'test',
        description: 'Test'
      });

      // Read
      const retrieved = await mock.get(task.id);
      expect(retrieved?.id).toBe(task.id);

      // Update
      const updated = await mock.update(task.id, { status: 'completed' });
      expect(updated.status).toBe('completed');
      expect(updated.updatedAt).toBeInstanceOf(Date);

      // List
      const tasks = await mock.list();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(task.id);

      // Delete
      const deleted = await mock.delete(task.id);
      expect(deleted).toBe(true);

      const empty = await mock.list();
      expect(empty).toHaveLength(0);
    });

    it('should provide helper methods as documented', async () => {
      const mock = createTaskStoreMock();

      // Add task using helper
      mock._addTask({ id: 'helper-task', status: 'running' });

      // Get tasks using helper
      const tasks = mock._getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('helper-task');

      // Clear tasks using helper
      mock._clearTasks();
      const emptyTasks = mock._getTasks();
      expect(emptyTasks).toHaveLength(0);
    });

    it('should handle update errors as documented', async () => {
      const mock = createTaskStoreMock();

      await expect(mock.update('nonexistent', { status: 'completed' }))
        .rejects
        .toThrow('Task nonexistent not found');
    });

    it('should have all documented methods', () => {
      const mock = createTaskStoreMock();

      expect(vi.isMockFunction(mock.create)).toBe(true);
      expect(vi.isMockFunction(mock.get)).toBe(true);
      expect(vi.isMockFunction(mock.update)).toBe(true);
      expect(vi.isMockFunction(mock.delete)).toBe(true);
      expect(vi.isMockFunction(mock.list)).toBe(true);
      expect(typeof mock._getTasks).toBe('function');
      expect(typeof mock._clearTasks).toBe('function');
      expect(typeof mock._addTask).toBe('function');
    });
  });

  describe('createEventEmitterMock', () => {
    it('should handle event registration and emission as documented', () => {
      const mock = createEventEmitterMock();

      const listener = vi.fn();
      mock.on('test-event', listener);

      mock.emit('test-event', 'data1', 'data2');
      expect(listener).toHaveBeenCalledWith('data1', 'data2');

      // Check listeners helper
      const listeners = mock._getListeners('test-event');
      expect(listeners).toHaveLength(1);
    });

    it('should handle event removal as documented', () => {
      const mock = createEventEmitterMock();

      const listener = vi.fn();
      mock.on('test-event', listener);
      mock.off('test-event', listener);

      mock.emit('test-event', 'data');
      expect(listener).not.toHaveBeenCalled();

      const listeners = mock._getListeners('test-event');
      expect(listeners).toHaveLength(0);
    });

    it('should provide helper methods as documented', () => {
      const mock = createEventEmitterMock();

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      mock.on('event1', listener1);
      mock.on('event2', listener2);

      // Check all listeners
      const allListeners = mock._getListeners();
      expect(allListeners.event1).toHaveLength(1);
      expect(allListeners.event2).toHaveLength(1);

      // Clear specific event
      mock._clearListeners('event1');
      const afterClear = mock._getListeners();
      expect(afterClear.event1).toBeUndefined();
      expect(afterClear.event2).toHaveLength(1);

      // Clear all
      mock._clearListeners();
      const empty = mock._getListeners();
      expect(Object.keys(empty)).toHaveLength(0);
    });

    it('should have the documented bug in once method', () => {
      const mock = createEventEmitterMock();

      // The documentation mentions that once() has a bug with this binding
      // This test verifies the bug exists as documented by showing that
      // the once method implementation has incorrect `this` binding
      const listener = vi.fn();

      // When trying to use once(), it should fail because the mock implementation
      // references `this.off` and `this.on` which are undefined in the arrow function context
      expect(() => {
        mock.once('test', listener);
        mock.emit('test', 'data');
      }).toThrow(/this\.off is not a function|this\.on is not a function|Cannot read prop/);
    });

    it('should have all documented methods', () => {
      const mock = createEventEmitterMock();

      expect(vi.isMockFunction(mock.on)).toBe(true);
      expect(vi.isMockFunction(mock.off)).toBe(true);
      expect(vi.isMockFunction(mock.emit)).toBe(true);
      expect(vi.isMockFunction(mock.once)).toBe(true);
      expect(typeof mock._getListeners).toBe('function');
      expect(typeof mock._clearListeners).toBe('function');
    });
  });

  describe('createPageMock', () => {
    it('should have correct default return values as documented', async () => {
      const mock = createPageMock();

      // Test default values
      expect(mock.url()).toBe('https://example.com');
      await expect(mock.title()).resolves.toBe('Test Page');
      await expect(mock.content()).resolves.toBe('<html><body>Mock content</body></html>');

      // Test interaction methods
      await expect(mock.goto('https://test.com')).resolves.toBeUndefined();
      await expect(mock.click('#button')).resolves.toBeUndefined();
      await expect(mock.type('input', 'text')).resolves.toBeUndefined();
      await expect(mock.fill('input', 'value')).resolves.toBeUndefined();
      await expect(mock.selectOption('select', 'option')).resolves.toEqual([]);

      // Test waiting methods
      await expect(mock.waitForSelector('selector')).resolves.toEqual({});
      await expect(mock.waitForTimeout(1000)).resolves.toBeUndefined();
      await expect(mock.waitForLoadState('networkidle')).resolves.toBeUndefined();

      // Test screenshot
      const screenshot = await mock.screenshot();
      expect(Buffer.isBuffer(screenshot)).toBe(true);
      expect(screenshot.toString()).toBe('fake-screenshot');

      // Test evaluation
      const result = await mock.evaluate(() => 'test result');
      expect(result).toBe('test result');
    });

    it('should support overrides as documented', async () => {
      const mock = createPageMock({
        title: vi.fn().mockResolvedValue('Custom Page Title')
      });

      await mock.goto('https://example.com');
      await mock.click('#button');
      const title = await mock.title();
      expect(title).toBe('Custom Page Title');
    });

    it('should have working locator as documented', async () => {
      const mock = createPageMock();

      const locator = mock.locator('#element');
      await locator.click();
      expect(locator.click).toHaveBeenCalled();

      await expect(locator.textContent()).resolves.toBe('Mock text');
      await expect(locator.isVisible()).resolves.toBe(true);
      await expect(locator.isHidden()).resolves.toBe(false);
    });

    it('should have all documented methods', () => {
      const mock = createPageMock();

      // Navigation
      expect(vi.isMockFunction(mock.goto)).toBe(true);
      expect(vi.isMockFunction(mock.url)).toBe(true);
      expect(vi.isMockFunction(mock.title)).toBe(true);
      expect(vi.isMockFunction(mock.content)).toBe(true);

      // Interaction
      expect(vi.isMockFunction(mock.click)).toBe(true);
      expect(vi.isMockFunction(mock.type)).toBe(true);
      expect(vi.isMockFunction(mock.fill)).toBe(true);
      expect(vi.isMockFunction(mock.selectOption)).toBe(true);

      // Waiting
      expect(vi.isMockFunction(mock.waitForSelector)).toBe(true);
      expect(vi.isMockFunction(mock.waitForTimeout)).toBe(true);
      expect(vi.isMockFunction(mock.waitForLoadState)).toBe(true);

      // Screenshots and evaluation
      expect(vi.isMockFunction(mock.screenshot)).toBe(true);
      expect(vi.isMockFunction(mock.evaluate)).toBe(true);

      // Locators
      expect(vi.isMockFunction(mock.locator)).toBe(true);

      // Events
      expect(vi.isMockFunction(mock.on)).toBe(true);
      expect(vi.isMockFunction(mock.off)).toBe(true);
    });
  });

  describe('createConsoleMock', () => {
    it('should track messages as documented', () => {
      const mock = createConsoleMock();

      mock.log('Test message');
      mock.error('Error message');
      mock.warn('Warning message');

      const messages = mock._getMessages();
      expect(messages).toHaveLength(3);

      expect(messages[0]).toEqual({
        level: 'log',
        message: 'Test message',
        timestamp: expect.any(Date)
      });

      expect(messages[1]).toEqual({
        level: 'error',
        message: 'Error message',
        timestamp: expect.any(Date)
      });

      expect(messages[2]).toEqual({
        level: 'warn',
        message: 'Warning message',
        timestamp: expect.any(Date)
      });
    });

    it('should filter messages by level as documented', () => {
      const mock = createConsoleMock();

      mock.log('Log message');
      mock.error('Error message 1');
      mock.error('Error message 2');
      mock.warn('Warning message');
      mock.info('Info message');

      const errors = mock._getMessagesByLevel('error');
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe('Error message 1');
      expect(errors[1].message).toBe('Error message 2');

      const warnings = mock._getMessagesByLevel('warn');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toBe('Warning message');
    });

    it('should clear messages as documented', () => {
      const mock = createConsoleMock();

      mock.log('Test message');
      mock.error('Error message');

      expect(mock._getMessages()).toHaveLength(2);

      mock._clearMessages();
      expect(mock._getMessages()).toHaveLength(0);
    });

    it('should have all documented methods', () => {
      const mock = createConsoleMock();

      expect(vi.isMockFunction(mock.log)).toBe(true);
      expect(vi.isMockFunction(mock.error)).toBe(true);
      expect(vi.isMockFunction(mock.warn)).toBe(true);
      expect(vi.isMockFunction(mock.info)).toBe(true);
      expect(typeof mock._getMessages).toBe('function');
      expect(typeof mock._clearMessages).toBe('function');
      expect(typeof mock._getMessagesByLevel).toBe('function');
    });
  });

  describe('createMockEnvironment', () => {
    it('should create full environment by default as documented', () => {
      const env = createMockEnvironment();

      expect(env.orchestrator).toBeDefined();
      expect(env.fs).toBeDefined();
      expect(env.network).toBeDefined();
      expect(env.taskStore).toBeDefined();
    });

    it('should support selective inclusion as documented', () => {
      const env = createMockEnvironment({
        includeOrchestrator: true,
        includeFileSystem: true,
        includeNetwork: false,
        includeTaskStore: true
      });

      expect(env.orchestrator).toBeDefined();
      expect(env.fs).toBeDefined();
      expect(env.network).toBeUndefined();
      expect(env.taskStore).toBeDefined();
    });

    it('should configure sub-mocks as documented', async () => {
      const env = createMockEnvironment({
        fileData: {
          '/config.yaml': 'key: value',
          '/data.json': '{"test": true}'
        },
        networkResponses: {
          'https://api.test.com': { success: true }
        },
        initialTasks: [
          { id: 'task-1', status: 'pending', workflow: 'test' }
        ]
      });

      // Test file system configuration
      const config = await env.fs!.readFile('/config.yaml');
      expect(config).toBe('key: value');

      // Test network configuration
      const response = await env.network!.fetch('https://api.test.com');
      const data = await response.json();
      expect(data.success).toBe(true);

      // Test task store configuration
      const task = await env.taskStore!.get('task-1');
      expect(task?.status).toBe('pending');
    });

    it('should work with the complete environment example from documentation', async () => {
      const fullEnv = createMockEnvironment({
        fileData: {
          '/.apex/config.yaml': 'autonomy_level: supervised',
          '/src/main.ts': 'console.log("Hello");'
        },
        networkResponses: {
          'https://api.anthropic.com/v1/messages': {
            content: [{ text: 'AI response' }],
            usage: { input_tokens: 10, output_tokens: 20 }
          }
        },
        initialTasks: [
          { id: 'setup-task', status: 'completed', workflow: 'setup' }
        ]
      });

      // All mocks should be ready to use
      expect(fullEnv.orchestrator).toBeDefined();
      expect(fullEnv.fs).toBeDefined();
      expect(fullEnv.network).toBeDefined();
      expect(fullEnv.taskStore).toBeDefined();

      // Test the configured data works
      const config = await fullEnv.fs!.readFile('/.apex/config.yaml');
      expect(config).toBe('autonomy_level: supervised');

      const response = await fullEnv.network!.fetch('https://api.anthropic.com/v1/messages');
      const data = await response.json();
      expect(data.usage.input_tokens).toBe(10);

      const setupTask = await fullEnv.taskStore!.get('setup-task');
      expect(setupTask?.workflow).toBe('setup');
    });
  });

  describe('mockHelpers collection', () => {
    it('should provide access to all individual mock creators as documented', () => {
      expect(typeof mockHelpers.createOrchestratorMock).toBe('function');
      expect(typeof mockHelpers.createAgentSdkMock).toBe('function');
      expect(typeof mockHelpers.createFileSystemMock).toBe('function');
      expect(typeof mockHelpers.createNetworkMock).toBe('function');
      expect(typeof mockHelpers.createTaskStoreMock).toBe('function');
      expect(typeof mockHelpers.createEventEmitterMock).toBe('function');
      expect(typeof mockHelpers.createPageMock).toBe('function');
      expect(typeof mockHelpers.createConsoleMock).toBe('function');
    });

    it('should work as documented in usage example', async () => {
      const orchestratorMock = mockHelpers.createOrchestratorMock();
      const fsMock = mockHelpers.createFileSystemMock({ '/test.txt': 'content' });

      expect(orchestratorMock.executeTask).toBeDefined();
      expect(fsMock.readFile).toBeDefined();

      const content = await fsMock.readFile('/test.txt');
      expect(content).toBe('content');
    });
  });

  describe('Import statement validation', () => {
    it('should export all functions mentioned in the documentation import statement', async () => {
      const mockHelperModule = await import('../mock-helpers.js');

      // Check that all functions from the documented import statement are available
      expect(typeof mockHelperModule.createOrchestratorMock).toBe('function');
      expect(typeof mockHelperModule.createAgentSdkMock).toBe('function');
      expect(typeof mockHelperModule.createFileSystemMock).toBe('function');
      expect(typeof mockHelperModule.createNetworkMock).toBe('function');
      expect(typeof mockHelperModule.createTaskStoreMock).toBe('function');
      expect(typeof mockHelperModule.createEventEmitterMock).toBe('function');
      expect(typeof mockHelperModule.createPageMock).toBe('function');
      expect(typeof mockHelperModule.createConsoleMock).toBe('function');
      expect(typeof mockHelperModule.createMockEnvironment).toBe('function');
      expect(typeof mockHelperModule.mockHelpers).toBe('object');
    });
  });

  describe('TypeScript signature validation', () => {
    it('should accept the documented parameter types', () => {
      // Test that TypeScript signatures work as documented

      // createOrchestratorMock(overrides: Record<string, any> = {})
      expect(() => createOrchestratorMock()).not.toThrow();
      expect(() => createOrchestratorMock({})).not.toThrow();
      expect(() => createOrchestratorMock({ executeTask: vi.fn() })).not.toThrow();

      // createAgentSdkMock(overrides: Record<string, any> = {})
      expect(() => createAgentSdkMock()).not.toThrow();
      expect(() => createAgentSdkMock({})).not.toThrow();

      // createFileSystemMock(fileData: Record<string, string> = {})
      expect(() => createFileSystemMock()).not.toThrow();
      expect(() => createFileSystemMock({})).not.toThrow();
      expect(() => createFileSystemMock({ '/file': 'content' })).not.toThrow();

      // createNetworkMock(responses: Record<string, any> = {})
      expect(() => createNetworkMock()).not.toThrow();
      expect(() => createNetworkMock({})).not.toThrow();
      expect(() => createNetworkMock({ 'url': 'response' })).not.toThrow();

      // createTaskStoreMock(initialTasks: any[] = [])
      expect(() => createTaskStoreMock()).not.toThrow();
      expect(() => createTaskStoreMock([])).not.toThrow();
      expect(() => createTaskStoreMock([{ id: 'test' }])).not.toThrow();

      // createEventEmitterMock() - no parameters
      expect(() => createEventEmitterMock()).not.toThrow();

      // createPageMock(overrides: Record<string, any> = {})
      expect(() => createPageMock()).not.toThrow();
      expect(() => createPageMock({})).not.toThrow();

      // createConsoleMock() - no parameters
      expect(() => createConsoleMock()).not.toThrow();

      // createMockEnvironment with complex options object
      expect(() => createMockEnvironment()).not.toThrow();
      expect(() => createMockEnvironment({})).not.toThrow();
      expect(() => createMockEnvironment({
        includeOrchestrator: false,
        includeFileSystem: true,
        fileData: { '/test': 'data' },
        networkResponses: { 'url': 'response' },
        initialTasks: []
      })).not.toThrow();
    });
  });

  describe('Documentation examples validation', () => {
    it('should work exactly like the examples in the documentation', async () => {
      // Example from createOrchestratorMock section
      const mockOrchestrator = createOrchestratorMock({
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          taskId: 'custom-task-id',
          result: 'Custom result'
        })
      });

      await mockOrchestrator.executeTask('test-workflow', 'Test description');
      expect(mockOrchestrator.executeTask).toHaveBeenCalledWith('test-workflow', 'Test description');

      // Example from createAgentSdkMock section
      const mockAgentSdk = createAgentSdkMock({
        query: vi.fn().mockResolvedValue({
          text: 'Custom agent response',
          usage: { input_tokens: 50, output_tokens: 75 }
        })
      });

      const result = await mockAgentSdk.query('test prompt');
      expect(result.text).toBe('Custom agent response');

      // Example from createFileSystemMock section
      const mockFs = createFileSystemMock({
        '/path/to/file.txt': 'file content',
        '/path/to/config.json': '{"key": "value"}'
      });

      const content = await mockFs.readFile('/path/to/file.txt');
      expect(content).toBe('file content');

      // This should throw ENOENT error as documented
      await expect(mockFs.readFile('/nonexistent.txt')).rejects.toThrow('ENOENT');

      // Example from createNetworkMock section
      const mockNetwork = createNetworkMock({
        'https://api.example.com/data': { success: true, data: [] },
        'https://api.example.com/user': 'user response string'
      });

      const response = await mockNetwork.fetch('https://api.example.com/data');
      const data = await response.json();
      expect(data.success).toBe(true);

      // Add response dynamically
      mockNetwork.addResponse('https://api.example.com/new', { id: 123 });

      // Simulate network error
      mockNetwork.simulateNetworkError('https://api.example.com/error');

      // Example from createTaskStoreMock section
      const mockTaskStore = createTaskStoreMock([
        { id: 'existing-task', status: 'completed', workflow: 'test' }
      ]);

      const newTask = await mockTaskStore.create({
        workflow: 'feature-development',
        description: 'Test task'
      });
      expect(newTask.id).toBeDefined();
      expect(newTask.status).toBe('pending');

      const retrieved = await mockTaskStore.get(newTask.id);
      expect(retrieved?.workflow).toBe('feature-development');
    });
  });
});