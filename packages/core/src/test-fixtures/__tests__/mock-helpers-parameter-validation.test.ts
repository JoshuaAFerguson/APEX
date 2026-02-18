/**
 * @fileoverview Parameter Validation Tests for Mock Helpers
 *
 * This test file validates that all mock helper functions handle parameters
 * exactly as documented, including optional parameters, default values,
 * and parameter type validation.
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

describe('Mock Helpers Parameter Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrchestratorMock parameter validation', () => {
    it('should handle optional overrides parameter correctly', () => {
      // No parameters - should work (documented as optional)
      expect(() => createOrchestratorMock()).not.toThrow();

      // Empty object - should work
      expect(() => createOrchestratorMock({})).not.toThrow();

      // Partial overrides - should merge correctly
      const partialOverride = { executeTask: vi.fn().mockResolvedValue({ custom: true }) };
      const mock = createOrchestratorMock(partialOverride);

      expect(mock.executeTask).toBe(partialOverride.executeTask);
      expect(mock.createTask).toBeDefined(); // Default should still be present
      expect(mock.getTask).toBeDefined(); // Default should still be present
    });

    it('should validate Record<string, any> type for overrides parameter', () => {
      // Should accept various value types
      const validOverrides = {
        executeTask: vi.fn(),
        customString: 'string value',
        customNumber: 42,
        customBoolean: true,
        customObject: { nested: 'object' },
        customArray: [1, 2, 3],
        customNull: null,
        customUndefined: undefined
      };

      expect(() => createOrchestratorMock(validOverrides)).not.toThrow();
      const mock = createOrchestratorMock(validOverrides);

      // All custom properties should be present
      expect(mock.customString).toBe('string value');
      expect(mock.customNumber).toBe(42);
      expect(mock.customBoolean).toBe(true);
      expect(mock.customObject).toEqual({ nested: 'object' });
      expect(mock.customArray).toEqual([1, 2, 3]);
      expect(mock.customNull).toBe(null);
      expect(mock.customUndefined).toBe(undefined);
    });
  });

  describe('createAgentSdkMock parameter validation', () => {
    it('should handle optional overrides parameter with Record<string, any> type', () => {
      // No parameters
      expect(() => createAgentSdkMock()).not.toThrow();

      // Various override types
      const overrides = {
        query: vi.fn(),
        customProperty: 'custom value',
        nestedObject: { deep: { value: 'test' } }
      };

      const mock = createAgentSdkMock(overrides);
      expect(mock.query).toBe(overrides.query);
      expect(mock.customProperty).toBe('custom value');
      expect(mock.nestedObject).toEqual(overrides.nestedObject);
    });
  });

  describe('createFileSystemMock parameter validation', () => {
    it('should handle fileData parameter of type Record<string, string>', () => {
      // No parameters - should work with empty file data
      const emptyMock = createFileSystemMock();
      expect(emptyMock).toBeDefined();

      // Empty object
      const emptyObjectMock = createFileSystemMock({});
      expect(emptyObjectMock).toBeDefined();

      // Valid file data
      const validFileData = {
        '/path/to/file1.txt': 'content1',
        '/path/to/file2.json': '{"key": "value"}',
        '/empty/file.txt': '',
        '/special/chars/@#$.txt': 'special content',
        '': 'empty path content' // Edge case but should be supported
      };

      const mock = createFileSystemMock(validFileData);
      expect(mock).toBeDefined();
    });

    it('should validate string values in fileData Record<string, string>', async () => {
      const fileData = {
        '/text-file.txt': 'simple text',
        '/json-file.json': JSON.stringify({ complex: { object: 'as string' } }),
        '/large-file.txt': 'x'.repeat(10000),
        '/unicode-file.txt': '🚀 Unicode content 中文 العربية',
        '/newlines.txt': 'Line 1\nLine 2\nLine 3',
        '/tabs.txt': 'Column 1\tColumn 2\tColumn 3'
      };

      const mock = createFileSystemMock(fileData);

      // All files should be readable with their exact content
      for (const [path, expectedContent] of Object.entries(fileData)) {
        const actualContent = await mock.readFile(path);
        expect(actualContent).toBe(expectedContent);
      }
    });
  });

  describe('createNetworkMock parameter validation', () => {
    it('should handle responses parameter of type Record<string, any>', () => {
      // No parameters
      expect(() => createNetworkMock()).not.toThrow();

      // Empty object
      expect(() => createNetworkMock({})).not.toThrow();

      // Various response types (any type is allowed per documentation)
      const responses = {
        'https://api.example.com/string': 'string response',
        'https://api.example.com/number': 42,
        'https://api.example.com/boolean': true,
        'https://api.example.com/null': null,
        'https://api.example.com/object': { data: 'object response' },
        'https://api.example.com/array': [1, 2, 3],
        'https://api.example.com/complex': {
          nested: {
            deeply: {
              complex: 'object',
              with: ['arrays', 'and', { objects: true }]
            }
          }
        }
      };

      const mock = createNetworkMock(responses);
      expect(mock).toBeDefined();
    });

    it('should preserve exact response data types', async () => {
      const responses = {
        'https://string.com': 'plain string',
        'https://number.com': 12345,
        'https://boolean.com': false,
        'https://null.com': null,
        'https://object.com': { key: 'value', nested: { deep: true } }
      };

      const mock = createNetworkMock(responses);

      // Test each response type
      const stringResponse = await mock.fetch('https://string.com');
      const stringData = await stringResponse.json();
      expect(stringData).toBe('plain string');

      const numberResponse = await mock.fetch('https://number.com');
      const numberData = await numberResponse.json();
      expect(numberData).toBe(12345);

      const booleanResponse = await mock.fetch('https://boolean.com');
      const booleanData = await booleanResponse.json();
      expect(booleanData).toBe(false);

      const nullResponse = await mock.fetch('https://null.com');
      const nullData = await nullResponse.json();
      expect(nullData).toBe(null);

      const objectResponse = await mock.fetch('https://object.com');
      const objectData = await objectResponse.json();
      expect(objectData).toEqual({ key: 'value', nested: { deep: true } });
    });
  });

  describe('createTaskStoreMock parameter validation', () => {
    it('should handle initialTasks parameter of type any[]', () => {
      // No parameters
      expect(() => createTaskStoreMock()).not.toThrow();

      // Empty array
      expect(() => createTaskStoreMock([])).not.toThrow();

      // Array with various task objects
      const tasks = [
        { id: 'task1', status: 'pending', workflow: 'test' },
        { id: 'task2', status: 'completed', workflow: 'feature', description: 'Task 2' },
        { status: 'running', workflow: 'no-id' }, // Missing id should be handled
        {
          id: 'complex-task',
          status: 'pending',
          workflow: 'complex',
          metadata: {
            priority: 'high',
            tags: ['important', 'urgent'],
            assignedTo: 'developer',
            customData: { anything: 'goes here' }
          }
        }
      ];

      const mock = createTaskStoreMock(tasks);
      expect(mock).toBeDefined();

      // Should be able to retrieve initialized tasks
      const allTasks = mock._getTasks();
      expect(allTasks.length).toBeGreaterThan(0);
    });

    it('should preserve task object properties of any type', async () => {
      const complexTasks = [
        {
          id: 'typed-task',
          status: 'pending' as const,
          workflow: 'test',
          stringProp: 'string value',
          numberProp: 42,
          booleanProp: true,
          arrayProp: [1, 'two', { three: 3 }],
          objectProp: {
            nested: {
              deeply: {
                value: 'test'
              }
            }
          },
          nullProp: null,
          undefinedProp: undefined,
          dateProp: new Date('2024-01-01'),
          functionProp: () => 'function result'
        }
      ];

      const mock = createTaskStoreMock(complexTasks);
      const task = await mock.get('typed-task');

      expect(task?.stringProp).toBe('string value');
      expect(task?.numberProp).toBe(42);
      expect(task?.booleanProp).toBe(true);
      expect(task?.arrayProp).toEqual([1, 'two', { three: 3 }]);
      expect(task?.objectProp?.nested?.deeply?.value).toBe('test');
      expect(task?.nullProp).toBe(null);
      expect(task?.undefinedProp).toBe(undefined);
      expect(task?.dateProp).toBeInstanceOf(Date);
      expect(typeof task?.functionProp).toBe('function');
    });
  });

  describe('createEventEmitterMock parameter validation', () => {
    it('should not require any parameters (parameterless function)', () => {
      // Documentation shows no parameters for this function
      expect(() => createEventEmitterMock()).not.toThrow();

      // Should not accept any parameters according to docs
      const mock = createEventEmitterMock();
      expect(mock).toBeDefined();
    });
  });

  describe('createPageMock parameter validation', () => {
    it('should handle optional overrides parameter of type Record<string, any>', () => {
      // No parameters
      expect(() => createPageMock()).not.toThrow();

      // Empty overrides
      expect(() => createPageMock({})).not.toThrow();

      // Various override types
      const overrides = {
        title: vi.fn().mockResolvedValue('Custom Title'),
        url: vi.fn().mockReturnValue('https://custom.com'),
        customMethod: vi.fn(),
        customProperty: 'custom value',
        complexOverride: {
          nested: {
            function: () => 'nested result'
          }
        }
      };

      const mock = createPageMock(overrides);
      expect(mock.title).toBe(overrides.title);
      expect(mock.url).toBe(overrides.url);
      expect(mock.customMethod).toBe(overrides.customMethod);
      expect(mock.customProperty).toBe('custom value');
      expect(mock.complexOverride).toEqual(overrides.complexOverride);
    });

    it('should maintain default behavior for non-overridden methods', async () => {
      const overrides = {
        title: vi.fn().mockResolvedValue('Custom Title')
      };

      const mock = createPageMock(overrides);

      // Overridden method should use custom implementation
      const title = await mock.title();
      expect(title).toBe('Custom Title');

      // Non-overridden methods should use defaults
      expect(mock.url()).toBe('https://example.com'); // Default per docs
      await expect(mock.content()).resolves.toBe('<html><body>Mock content</body></html>'); // Default per docs
      await expect(mock.goto('https://test.com')).resolves.toBeUndefined(); // Default per docs
    });
  });

  describe('createConsoleMock parameter validation', () => {
    it('should not require any parameters (parameterless function)', () => {
      // Documentation shows no parameters for this function
      expect(() => createConsoleMock()).not.toThrow();

      const mock = createConsoleMock();
      expect(mock).toBeDefined();
    });
  });

  describe('createMockEnvironment parameter validation', () => {
    it('should handle complex options parameter with all documented properties', () => {
      // No parameters - should use defaults
      expect(() => createMockEnvironment()).not.toThrow();
      const defaultEnv = createMockEnvironment();
      expect(defaultEnv.orchestrator).toBeDefined(); // Default is true
      expect(defaultEnv.fs).toBeDefined(); // Default is true
      expect(defaultEnv.network).toBeDefined(); // Default is true
      expect(defaultEnv.taskStore).toBeDefined(); // Default is true

      // Empty options
      expect(() => createMockEnvironment({})).not.toThrow();

      // All documented options
      const fullOptions = {
        includeOrchestrator: true,
        includeFileSystem: false,
        includeNetwork: true,
        includeTaskStore: false,
        fileData: {
          '/test1.txt': 'content1',
          '/nested/path/file.json': '{"data": "test"}'
        },
        networkResponses: {
          'https://api1.com': { response: 'data1' },
          'https://api2.com/endpoint': { complex: { response: { object: true } } }
        },
        initialTasks: [
          { id: 'task1', status: 'pending', workflow: 'test1' },
          {
            id: 'task2',
            status: 'completed',
            workflow: 'test2',
            metadata: { complex: 'object' }
          }
        ]
      };

      const customEnv = createMockEnvironment(fullOptions);
      expect(customEnv.orchestrator).toBeDefined(); // includeOrchestrator: true
      expect(customEnv.fs).toBeUndefined(); // includeFileSystem: false
      expect(customEnv.network).toBeDefined(); // includeNetwork: true
      expect(customEnv.taskStore).toBeUndefined(); // includeTaskStore: false
    });

    it('should validate boolean parameters with correct default values', () => {
      // Test each boolean parameter individually with different combinations
      const testCases = [
        { includeOrchestrator: false, expectedOrchestrator: undefined },
        { includeOrchestrator: true, expectedOrchestrator: 'defined' },
        { includeFileSystem: false, expectedFs: undefined },
        { includeFileSystem: true, expectedFs: 'defined' },
        { includeNetwork: false, expectedNetwork: undefined },
        { includeNetwork: true, expectedNetwork: 'defined' },
        { includeTaskStore: false, expectedTaskStore: undefined },
        { includeTaskStore: true, expectedTaskStore: 'defined' }
      ];

      testCases.forEach(testCase => {
        const env = createMockEnvironment(testCase);

        if ('expectedOrchestrator' in testCase) {
          if (testCase.expectedOrchestrator === undefined) {
            expect(env.orchestrator).toBeUndefined();
          } else {
            expect(env.orchestrator).toBeDefined();
          }
        }

        if ('expectedFs' in testCase) {
          if (testCase.expectedFs === undefined) {
            expect(env.fs).toBeUndefined();
          } else {
            expect(env.fs).toBeDefined();
          }
        }

        if ('expectedNetwork' in testCase) {
          if (testCase.expectedNetwork === undefined) {
            expect(env.network).toBeUndefined();
          } else {
            expect(env.network).toBeDefined();
          }
        }

        if ('expectedTaskStore' in testCase) {
          if (testCase.expectedTaskStore === undefined) {
            expect(env.taskStore).toBeUndefined();
          } else {
            expect(env.taskStore).toBeDefined();
          }
        }
      });
    });

    it('should correctly pass configuration to sub-mocks', async () => {
      const options = {
        fileData: {
          '/config.yaml': 'test: configuration',
          '/app.json': '{"version": "1.0.0"}'
        },
        networkResponses: {
          'https://test.api.com/data': { id: 123, name: 'test' },
          'https://external.service.com/endpoint': 'plain text response'
        },
        initialTasks: [
          { id: 'init-task', status: 'completed', workflow: 'initialization' },
          { id: 'pending-task', status: 'pending', workflow: 'processing' }
        ]
      };

      const env = createMockEnvironment(options);

      // Test file system configuration
      const config = await env.fs!.readFile('/config.yaml');
      expect(config).toBe('test: configuration');

      const appData = await env.fs!.readFile('/app.json');
      expect(appData).toBe('{"version": "1.0.0"}');

      // Test network configuration
      const apiResponse = await env.network!.fetch('https://test.api.com/data');
      const apiData = await apiResponse.json();
      expect(apiData).toEqual({ id: 123, name: 'test' });

      const textResponse = await env.network!.fetch('https://external.service.com/endpoint');
      const textData = await textResponse.json();
      expect(textData).toBe('plain text response');

      // Test task store configuration
      const initTask = await env.taskStore!.get('init-task');
      expect(initTask?.status).toBe('completed');
      expect(initTask?.workflow).toBe('initialization');

      const pendingTask = await env.taskStore!.get('pending-task');
      expect(pendingTask?.status).toBe('pending');
      expect(pendingTask?.workflow).toBe('processing');

      // Verify all initialized tasks are present
      const allTasks = await env.taskStore!.list();
      expect(allTasks).toHaveLength(2);
    });
  });

  describe('Parameter default value validation', () => {
    it('should use correct default values as documented', () => {
      // createOrchestratorMock defaults to empty overrides
      const orch1 = createOrchestratorMock();
      const orch2 = createOrchestratorMock({});
      // Both should have same structure since default is {}

      expect(typeof orch1.executeTask).toBe('function');
      expect(typeof orch2.executeTask).toBe('function');

      // createAgentSdkMock defaults to empty overrides
      const agent1 = createAgentSdkMock();
      const agent2 = createAgentSdkMock({});

      expect(typeof agent1.query).toBe('function');
      expect(typeof agent2.query).toBe('function');

      // createFileSystemMock defaults to empty file data
      const fs1 = createFileSystemMock();
      const fs2 = createFileSystemMock({});

      expect(typeof fs1.readFile).toBe('function');
      expect(typeof fs2.readFile).toBe('function');

      // createNetworkMock defaults to empty responses
      const net1 = createNetworkMock();
      const net2 = createNetworkMock({});

      expect(typeof net1.fetch).toBe('function');
      expect(typeof net2.fetch).toBe('function');

      // createTaskStoreMock defaults to empty tasks array
      const task1 = createTaskStoreMock();
      const task2 = createTaskStoreMock([]);

      expect(task1._getTasks()).toEqual([]);
      expect(task2._getTasks()).toEqual([]);

      // createPageMock defaults to empty overrides
      const page1 = createPageMock();
      const page2 = createPageMock({});

      expect(typeof page1.goto).toBe('function');
      expect(typeof page2.goto).toBe('function');

      // createMockEnvironment defaults to including all mocks
      const env1 = createMockEnvironment();
      const env2 = createMockEnvironment({});

      expect(env1.orchestrator).toBeDefined();
      expect(env1.fs).toBeDefined();
      expect(env1.network).toBeDefined();
      expect(env1.taskStore).toBeDefined();

      expect(env2.orchestrator).toBeDefined();
      expect(env2.fs).toBeDefined();
      expect(env2.network).toBeDefined();
      expect(env2.taskStore).toBeDefined();
    });
  });
});