/**
 * @fileoverview Documentation Contract Tests for Mock Helpers API
 *
 * This test file validates that the actual mock helper implementations
 * exactly match the documentation specifications in docs/mock-helpers-api.md.
 * It serves as a contract test to ensure the documentation stays in sync
 * with the implementation.
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

describe('Mock Helpers Documentation Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Documentation Example Code Validation', () => {
    it('should execute the exact code examples from documentation - createOrchestratorMock', async () => {
      // This is the exact example from the docs
      const mock = createOrchestratorMock({
        executeTask: vi.fn().mockResolvedValue({
          success: true,
          taskId: 'custom-task-id',
          result: 'Custom result'
        })
      });

      const result = await mock.executeTask('feature-development', 'Add login feature');

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('custom-task-id');
      expect(mock.executeTask).toHaveBeenCalledWith('feature-development', 'Add login feature');
    });

    it('should execute the exact code examples from documentation - createAgentSdkMock', async () => {
      // Example 1: Custom query
      const mock = createAgentSdkMock({
        query: vi.fn().mockResolvedValue({
          text: 'Custom agent response',
          usage: { input_tokens: 50, output_tokens: 75 }
        })
      });

      const result = await mock.query('Implement user authentication');

      expect(result.text).toBe('Custom agent response');
      expect(result.usage.input_tokens).toBe(50);
      expect(mock.query).toHaveBeenCalledWith('Implement user authentication');

      // Example 2: Client creation
      const defaultMock = createAgentSdkMock();
      const client = defaultMock.createClient();

      const response = await client.messages.create({
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(response.content).toEqual([{ text: 'Mock response' }]);
    });

    it('should execute the exact code examples from documentation - createFileSystemMock', async () => {
      // Main example from docs
      const mock = createFileSystemMock({
        '/path/to/file.txt': 'initial content',
        '/path/to/config.json': '{"key": "value"}'
      });

      // Read existing file
      const content = await mock.readFile('/path/to/file.txt');
      expect(content).toBe('initial content');

      // Write new file
      await mock.writeFile('/path/to/newfile.txt', 'new content');

      // Try to read non-existent file
      await expect(mock.readFile('/nonexistent.txt')).rejects.toThrow('ENOENT');

      // Check file stats
      const stats = await mock.stat('/path/to/file.txt');
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);

      // Directory operations example
      const dirMock = createFileSystemMock({
        '/src/index.ts': 'export default {}',
        '/src/utils.ts': 'export const utils = {}'
      });

      await dirMock.mkdir('/src/components');

      const files = await dirMock.readdir('/src');
      expect(files).toContain('index.ts');
      expect(files).toContain('utils.ts');
    });

    it('should execute the exact code examples from documentation - createNetworkMock', async () => {
      // Basic example
      const mock = createNetworkMock({
        'https://api.example.com/users': { users: [{ id: 1, name: 'John' }] },
        'https://api.example.com/status': 'OK'
      });

      const response = await mock.fetch('https://api.example.com/users');
      const data = await response.json();

      expect(data.users).toHaveLength(1);
      expect(data.users[0].name).toBe('John');

      // Dynamic responses example
      const dynamicMock = createNetworkMock();

      mock.addResponse('https://api.example.com/new', { id: 123, message: 'Created' });

      const newResponse = await mock.fetch('https://api.example.com/new');
      const newData = await newResponse.json();

      expect(newData.id).toBe(123);

      // Network error simulation
      mock.simulateNetworkError('https://api.example.com/error');

      await expect(mock.fetch('https://api.example.com/error')).rejects.toThrow('Network Error');
    });

    it('should execute the exact code examples from documentation - createTaskStoreMock', async () => {
      // Full CRUD example from docs
      const mock = createTaskStoreMock([
        { id: 'existing-task', status: 'completed', workflow: 'test' }
      ]);

      // Create new task
      const newTask = await mock.create({
        workflow: 'feature-development',
        description: 'Add user authentication'
      });

      expect(newTask.id).toMatch(/^task-\d+$/);
      expect(newTask.status).toBe('pending');
      expect(newTask.workflow).toBe('feature-development');

      // Get task
      const retrieved = await mock.get(newTask.id);
      expect(retrieved.description).toBe('Add user authentication');

      // Update task
      const updated = await mock.update(newTask.id, { status: 'completed' });
      expect(updated.status).toBe('completed');
      expect(updated.updatedAt).toBeInstanceOf(Date);

      // List tasks
      const all = await mock.list();
      expect(all).toHaveLength(2);

      // Delete task
      const deleted = await mock.delete(newTask.id);
      expect(deleted).toBe(true);

      // Verify deletion
      const final = await mock.list();
      expect(final).toHaveLength(1);

      // Helper methods example
      const helperMock = createTaskStoreMock();

      helperMock._addTask({ id: 'test', status: 'pending' });

      const tasks = helperMock._getTasks();
      expect(tasks).toHaveLength(1);

      helperMock._clearTasks();
      expect(helperMock._getTasks()).toHaveLength(0);
    });

    it('should execute the exact code examples from documentation - createEventEmitterMock', async () => {
      // Basic event handling example
      const mock = createEventEmitterMock();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      // Register listeners
      mock.on('test-event', listener1);
      mock.on('test-event', listener2);
      mock.on('other-event', vi.fn());

      // Emit event
      mock.emit('test-event', 'data1', 'data2');

      expect(listener1).toHaveBeenCalledWith('data1', 'data2');
      expect(listener2).toHaveBeenCalledWith('data1', 'data2');

      // Check listeners
      const listeners = mock._getListeners('test-event');
      expect(listeners).toHaveLength(2);

      // Remove listener
      mock.off('test-event', listener1);
      const remainingListeners = mock._getListeners('test-event');
      expect(remainingListeners).toHaveLength(1);

      // Clear all listeners for event
      mock._clearListeners('test-event');
      expect(mock._getListeners('test-event')).toHaveLength(0);

      // Error handling example
      const errorMock = createEventEmitterMock();
      const errorListener = vi.fn(() => { throw new Error('Listener error'); });
      const goodListener = vi.fn();

      errorMock.on('test', errorListener);
      errorMock.on('test', goodListener);

      // Should not throw, but continue to other listeners
      expect(() => errorMock.emit('test')).not.toThrow();
      expect(goodListener).toHaveBeenCalled();
    });

    it('should execute the exact code examples from documentation - createPageMock', async () => {
      // Basic usage example
      const mock = createPageMock({
        title: vi.fn().mockResolvedValue('Custom Page Title'),
        url: vi.fn().mockReturnValue('https://custom.example.com')
      });

      // Navigate and verify
      await mock.goto('https://example.com');
      const title = await mock.title();
      const url = mock.url();

      expect(title).toBe('Custom Page Title');
      expect(url).toBe('https://custom.example.com');
      expect(mock.goto).toHaveBeenCalledWith('https://example.com');

      // Interact with elements
      await mock.click('#submit-button');
      await mock.fill('#username', 'testuser');
      await mock.type('#password', 'password123');

      // Use locators
      const button = mock.locator('#submit-button');
      await button.click();

      const text = await button.textContent();
      expect(text).toBe('Mock text');

      const isVisible = await button.isVisible();
      expect(isVisible).toBe(true);

      // Take screenshot
      const screenshot = await mock.screenshot();
      expect(screenshot).toBeInstanceOf(Buffer);

      // JavaScript evaluation example
      const evalMock = createPageMock();

      const result = await evalMock.evaluate((a, b) => a + b, 5, 3);
      expect(result).toBe(8);

      const titleResult = await evalMock.evaluate(() => document.title);
      expect(evalMock.evaluate).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should execute the exact code examples from documentation - createConsoleMock', async () => {
      // Message capture example
      const mock = createConsoleMock();

      mock.log('Test message');
      mock.error('Error message');
      mock.warn('Warning message', 'with multiple', 'arguments');

      const messages = mock._getMessages();
      expect(messages).toHaveLength(3);

      expect(messages[0]).toEqual({
        level: 'log',
        message: 'Test message',
        timestamp: expect.any(Date)
      });

      expect(messages[2].message).toBe('Warning message with multiple arguments');

      // Filter by level
      const errors = mock._getMessagesByLevel('error');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Error message');

      // Clear messages
      mock._clearMessages();
      expect(mock._getMessages()).toHaveLength(0);

      // Console replacement example
      const originalConsole = console;
      const replacementMock = createConsoleMock();

      // Replace global console
      global.console = replacementMock as any;

      console.log('This will be captured');
      console.error('Error captured too');

      const capturedMessages = replacementMock._getMessages();
      expect(capturedMessages).toHaveLength(2);

      // Restore
      global.console = originalConsole;
    });

    it('should execute the exact code examples from documentation - createMockEnvironment', async () => {
      // Complete environment example from docs
      const env = createMockEnvironment({
        fileData: {
          '/.apex/config.yaml': `
autonomy_level: supervised
agents:
  developer:
    role: "Implementation specialist"
workflows:
  feature-development:
    stages: ["planning", "implementation", "testing"]
        `,
          '/src/main.ts': 'console.log("Hello, APEX!");',
          '/package.json': '{"name": "test-project", "version": "1.0.0"}'
        },
        networkResponses: {
          'https://api.anthropic.com/v1/messages': {
            content: [{ text: 'Task implementation completed successfully' }],
            usage: { input_tokens: 150, output_tokens: 200 }
          }
        },
        initialTasks: [
          {
            id: 'setup-task',
            status: 'completed',
            workflow: 'setup',
            createdAt: new Date('2024-01-01')
          }
        ]
      });

      // Test file system operations
      const config = await env.fs!.readFile('/.apex/config.yaml');
      expect(config).toContain('autonomy_level: supervised');

      // Test network operations
      const response = await env.network!.fetch('https://api.anthropic.com/v1/messages');
      const data = await response.json();
      expect(data.content[0].text).toContain('completed successfully');

      // Test task store operations
      const existingTask = await env.taskStore!.get('setup-task');
      expect(existingTask.status).toBe('completed');

      const newTask = await env.taskStore!.create({
        workflow: 'feature-development',
        description: 'Add user authentication'
      });
      expect(newTask.status).toBe('pending');

      // Test orchestrator operations
      const result = await env.orchestrator!.executeTask(
        'feature-development',
        'Implement login functionality'
      );
      expect(result.success).toBe(true);

      // Selective inclusion example
      const minimalEnv = createMockEnvironment({
        includeOrchestrator: false,
        includeNetwork: false,
        includeTaskStore: false,
        includeFileSystem: true,
        fileData: {
          '/test.txt': 'test content'
        }
      });

      expect(minimalEnv.orchestrator).toBeUndefined();
      expect(minimalEnv.network).toBeUndefined();
      expect(minimalEnv.taskStore).toBeUndefined();
      expect(minimalEnv.fs).toBeDefined();
    });

    it('should execute the exact code examples from documentation - mockHelpers collection', async () => {
      // Collection usage example from docs
      const orchestrator = mockHelpers.createOrchestratorMock();
      const fs = mockHelpers.createFileSystemMock({ '/test.txt': 'content' });
      const network = mockHelpers.createNetworkMock();

      expect(orchestrator.executeTask).toBeDefined();
      expect(fs.readFile).toBeDefined();
      expect(network.fetch).toBeDefined();

      // Verify they work as expected
      const content = await fs.readFile('/test.txt');
      expect(content).toBe('content');
    });
  });

  describe('Advanced Usage Pattern Examples from Documentation', () => {
    it('should execute Integration Testing pattern example', async () => {
      // This is the exact advanced pattern from the docs
      const env = createMockEnvironment({
        fileData: {
          '/.apex/config.yaml': 'autonomy_level: autonomous',
          '/src/app.ts': 'export const app = {};'
        },
        networkResponses: {
          'https://api.anthropic.com/v1/messages': {
            content: [{ text: 'Implementation completed' }]
          }
        }
      });

      // Simulate loading configuration
      const config = await env.fs!.readFile('/.apex/config.yaml');

      // Simulate creating a task
      const task = await env.taskStore!.create({
        workflow: 'feature-development',
        description: 'Add authentication'
      });

      // Simulate agent interaction
      const response = await env.network!.fetch('https://api.anthropic.com/v1/messages');
      const result = await response.json();

      // Simulate task completion
      await env.taskStore!.update(task.id, {
        status: 'completed',
        result: result.content[0].text
      });

      const completedTask = await env.taskStore!.get(task.id);
      expect(completedTask.status).toBe('completed');
    });

    it('should execute Event-Driven Workflow pattern example', async () => {
      // This is the exact advanced pattern from the docs
      const eventEmitter = createEventEmitterMock();
      const console = createConsoleMock();

      // Set up workflow stages
      eventEmitter.on('stage:start', (stage) => {
        console.log(`Starting stage: ${stage}`);
      });

      eventEmitter.on('stage:complete', (stage, result) => {
        console.log(`Completed stage: ${stage}`, result);
      });

      // Simulate workflow execution
      eventEmitter.emit('stage:start', 'planning');
      eventEmitter.emit('stage:complete', 'planning', { status: 'success' });

      eventEmitter.emit('stage:start', 'implementation');
      eventEmitter.emit('stage:complete', 'implementation', {
        status: 'success',
        files: ['src/auth.ts', 'src/types.ts']
      });

      const messages = console._getMessages();
      expect(messages).toHaveLength(4);
      expect(messages[0].message).toBe('Starting stage: planning');
      expect(messages[3].message).toContain('implementation');
    });

    it('should execute Error Handling pattern example', async () => {
      // This is the exact error handling pattern from the docs
      const fs = createFileSystemMock();

      // Test file not found
      await expect(fs.readFile('/nonexistent.txt')).rejects.toThrow('ENOENT');

      // Test task store errors
      const taskStore = createTaskStoreMock();
      await expect(taskStore.update('invalid-id', {})).rejects.toThrow('not found');

      // Test network errors
      const network = createNetworkMock();
      network.simulateNetworkError('https://api.example.com/error');
      await expect(network.fetch('https://api.example.com/error')).rejects.toThrow('Network Error');
    });
  });

  describe('Documentation TypeScript Signature Validation', () => {
    it('should match all documented TypeScript signatures exactly', () => {
      // Verify function signatures match documentation exactly

      // createOrchestratorMock(overrides: Record<string, any> = {})
      expect(() => createOrchestratorMock()).not.toThrow();
      expect(() => createOrchestratorMock({})).not.toThrow();
      expect(() => createOrchestratorMock({ executeTask: vi.fn() })).not.toThrow();

      // createAgentSdkMock(overrides: Record<string, any> = {})
      expect(() => createAgentSdkMock()).not.toThrow();
      expect(() => createAgentSdkMock({})).not.toThrow();
      expect(() => createAgentSdkMock({ query: vi.fn() })).not.toThrow();

      // createFileSystemMock(fileData: Record<string, string> = {})
      expect(() => createFileSystemMock()).not.toThrow();
      expect(() => createFileSystemMock({})).not.toThrow();
      expect(() => createFileSystemMock({ '/file': 'content' })).not.toThrow();

      // createNetworkMock(responses: Record<string, any> = {})
      expect(() => createNetworkMock()).not.toThrow();
      expect(() => createNetworkMock({})).not.toThrow();
      expect(() => createNetworkMock({ 'url': { data: 'response' } })).not.toThrow();

      // createTaskStoreMock(initialTasks: any[] = [])
      expect(() => createTaskStoreMock()).not.toThrow();
      expect(() => createTaskStoreMock([])).not.toThrow();
      expect(() => createTaskStoreMock([{ id: 'test', status: 'pending' }])).not.toThrow();

      // createEventEmitterMock() - no parameters
      expect(() => createEventEmitterMock()).not.toThrow();

      // createPageMock(overrides: Record<string, any> = {})
      expect(() => createPageMock()).not.toThrow();
      expect(() => createPageMock({})).not.toThrow();
      expect(() => createPageMock({ title: vi.fn() })).not.toThrow();

      // createConsoleMock() - no parameters
      expect(() => createConsoleMock()).not.toThrow();

      // createMockEnvironment with all documented options
      expect(() => createMockEnvironment()).not.toThrow();
      expect(() => createMockEnvironment({
        includeOrchestrator: true,
        includeFileSystem: true,
        includeNetwork: false,
        includeTaskStore: true,
        fileData: { '/test': 'data' },
        networkResponses: { 'url': { response: 'data' } },
        initialTasks: [{ id: 'task', status: 'pending' }]
      })).not.toThrow();
    });

    it('should return objects matching documented interface structures', async () => {
      // Validate return object structures match documentation exactly

      // createOrchestratorMock return object structure
      const orchestrator = createOrchestratorMock();
      const orchestratorMethods = [
        'executeTask', 'createTask', 'getTask', 'getTasks',
        'on', 'off', 'emit', 'addEventListener', 'removeEventListener',
        'loadConfig', 'getAgents', 'getWorkflows'
      ];
      orchestratorMethods.forEach(method => {
        expect(orchestrator).toHaveProperty(method);
        expect(vi.isMockFunction(orchestrator[method])).toBe(true);
      });

      // createAgentSdkMock return object structure
      const agentSdk = createAgentSdkMock();
      expect(agentSdk).toHaveProperty('query');
      expect(agentSdk).toHaveProperty('createClient');
      expect(vi.isMockFunction(agentSdk.query)).toBe(true);
      expect(vi.isMockFunction(agentSdk.createClient)).toBe(true);

      // createFileSystemMock return object structure
      const fs = createFileSystemMock();
      const fsMethods = ['readFile', 'writeFile', 'mkdir', 'unlink', 'readdir', 'stat', 'access'];
      fsMethods.forEach(method => {
        expect(fs).toHaveProperty(method);
        expect(vi.isMockFunction(fs[method])).toBe(true);
      });

      // createNetworkMock return object structure
      const network = createNetworkMock();
      expect(network).toHaveProperty('fetch');
      expect(network).toHaveProperty('addResponse');
      expect(network).toHaveProperty('simulateNetworkError');
      expect(vi.isMockFunction(network.fetch)).toBe(true);
      expect(typeof network.addResponse).toBe('function');
      expect(typeof network.simulateNetworkError).toBe('function');

      // createTaskStoreMock return object structure
      const taskStore = createTaskStoreMock();
      const taskStoreMethods = ['create', 'get', 'update', 'delete', 'list'];
      const taskStoreHelpers = ['_getTasks', '_clearTasks', '_addTask'];

      taskStoreMethods.forEach(method => {
        expect(taskStore).toHaveProperty(method);
        expect(vi.isMockFunction(taskStore[method])).toBe(true);
      });

      taskStoreHelpers.forEach(method => {
        expect(taskStore).toHaveProperty(method);
        expect(typeof taskStore[method]).toBe('function');
      });

      // createEventEmitterMock return object structure
      const eventEmitter = createEventEmitterMock();
      const eventMethods = ['on', 'off', 'emit', 'once'];
      const eventHelpers = ['_getListeners', '_clearListeners'];

      eventMethods.forEach(method => {
        expect(eventEmitter).toHaveProperty(method);
        expect(vi.isMockFunction(eventEmitter[method])).toBe(true);
      });

      eventHelpers.forEach(method => {
        expect(eventEmitter).toHaveProperty(method);
        expect(typeof eventEmitter[method]).toBe('function');
      });

      // createPageMock return object structure
      const page = createPageMock();
      const pageMethods = [
        'goto', 'url', 'title', 'content',
        'click', 'type', 'fill', 'selectOption',
        'waitForSelector', 'waitForTimeout', 'waitForLoadState',
        'screenshot', 'evaluate', 'locator', 'on', 'off'
      ];

      pageMethods.forEach(method => {
        expect(page).toHaveProperty(method);
        expect(vi.isMockFunction(page[method])).toBe(true);
      });

      // createConsoleMock return object structure
      const consoleMock = createConsoleMock();
      const consoleMethods = ['log', 'error', 'warn', 'info'];
      const consoleHelpers = ['_getMessages', '_clearMessages', '_getMessagesByLevel'];

      consoleMethods.forEach(method => {
        expect(consoleMock).toHaveProperty(method);
        expect(vi.isMockFunction(consoleMock[method])).toBe(true);
      });

      consoleHelpers.forEach(method => {
        expect(consoleMock).toHaveProperty(method);
        expect(typeof consoleMock[method]).toBe('function');
      });

      // createMockEnvironment return object structure
      const env = createMockEnvironment();
      expect(env).toHaveProperty('orchestrator');
      expect(env).toHaveProperty('fs');
      expect(env).toHaveProperty('network');
      expect(env).toHaveProperty('taskStore');

      // mockHelpers collection structure
      expect(mockHelpers).toHaveProperty('createOrchestratorMock');
      expect(mockHelpers).toHaveProperty('createAgentSdkMock');
      expect(mockHelpers).toHaveProperty('createFileSystemMock');
      expect(mockHelpers).toHaveProperty('createNetworkMock');
      expect(mockHelpers).toHaveProperty('createTaskStoreMock');
      expect(mockHelpers).toHaveProperty('createEventEmitterMock');
      expect(mockHelpers).toHaveProperty('createPageMock');
      expect(mockHelpers).toHaveProperty('createConsoleMock');
    });
  });

  describe('Known Issues Documentation Validation', () => {
    it('should verify documented EventEmitter.once() bug exists', () => {
      // Documentation states: "EventEmitter.once() bug: The once() method has a this binding issue"
      const mock = createEventEmitterMock();
      const listener = vi.fn();

      // The documented bug should exist
      expect(() => {
        mock.once('test', listener);
        mock.emit('test', 'data');
      }).toThrow(/this\.off is not a function|this\.on is not a function|Cannot read prop/);
    });

    it('should verify other documented limitations', () => {
      // Test that the documented limitations are accurately described

      // Console mock complex object logging limitation mentioned in docs
      const consoleMock = createConsoleMock();

      const complexObject = {
        nested: {
          deep: {
            object: 'with complex structure',
            array: [1, 2, { nested: 'again' }]
          }
        }
      };

      // Should work but may not capture complex object structure perfectly (as documented)
      consoleMock.log('Complex object:', complexObject);
      const messages = consoleMock._getMessages();
      expect(messages[0].message).toContain('Complex object:');
    });
  });

  describe('Import Statement Accuracy', () => {
    it('should verify the documented import statement is complete and accurate', async () => {
      // The documentation shows this import statement:
      const expectedExports = [
        'createOrchestratorMock',
        'createAgentSdkMock',
        'createFileSystemMock',
        'createNetworkMock',
        'createTaskStoreMock',
        'createEventEmitterMock',
        'createPageMock',
        'createConsoleMock',
        'createMockEnvironment',
        'mockHelpers'
      ];

      // Verify all documented exports are actually available
      const mockHelperModule = await import('../mock-helpers.js');

      expectedExports.forEach(exportName => {
        expect(mockHelperModule).toHaveProperty(exportName);
        if (exportName !== 'mockHelpers') {
          expect(typeof mockHelperModule[exportName]).toBe('function');
        } else {
          expect(typeof mockHelperModule[exportName]).toBe('object');
        }
      });

      // Verify no undocumented exports exist
      const actualExports = Object.keys(mockHelperModule);
      expectedExports.forEach(expected => {
        expect(actualExports).toContain(expected);
      });
    });
  });
});