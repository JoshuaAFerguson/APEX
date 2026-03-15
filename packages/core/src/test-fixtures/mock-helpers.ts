/**
 * @fileoverview Mock Helper Utilities
 *
 * This module provides utilities for creating and managing mocks in tests.
 * It includes helpers for common mocking patterns used across APEX tests.
 *
 * @example
 * ```typescript
 * import { mockHelpers } from '@apex/core/test-fixtures';
 *
 * const mockOrchestrator = mockHelpers.createOrchestratorMock({
 *   executeTask: vi.fn().mockResolvedValue({ success: true })
 * });
 * ```
 */

import { vi } from 'vitest';
import type { MockFunction } from './types.js';

/**
 * Creates a mock for the APEX Orchestrator
 */
export function createOrchestratorMock(overrides: Record<string, any> = {}) {
  return {
    // Core orchestrator methods
    executeTask: vi.fn().mockResolvedValue({
      success: true,
      taskId: 'mock-task-id',
      result: 'Task completed successfully'
    }),
    createTask: vi.fn().mockResolvedValue({
      id: 'mock-task-id',
      status: 'pending',
      workflow: 'feature-development',
      createdAt: new Date(),
    }),
    getTask: vi.fn().mockResolvedValue({
      id: 'mock-task-id',
      status: 'running',
      workflow: 'feature-development',
    }),
    getTasks: vi.fn().mockResolvedValue([]),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),

    // Mock event emitter functionality
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),

    // Configuration methods
    loadConfig: vi.fn().mockResolvedValue({
      autonomyLevel: 'supervised',
      agents: {},
      workflows: {},
    }),

    // Agent management
    getAgents: vi.fn().mockReturnValue([]),
    getWorkflows: vi.fn().mockReturnValue([]),

    // Override with custom implementations
    ...overrides,
  };
}

/**
 * Creates a mock for the Claude Agent SDK
 */
export function createAgentSdkMock(overrides: Record<string, any> = {}) {
  return {
    query: vi.fn().mockResolvedValue({
      text: 'Mock agent response',
      usage: {
        input_tokens: 100,
        output_tokens: 150,
      },
    }),
    createClient: vi.fn().mockReturnValue({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ text: 'Mock response' }],
          usage: { input_tokens: 100, output_tokens: 150 },
        }),
      },
    }),
    ...overrides,
  };
}

/**
 * Creates a mock for file system operations
 */
export function createFileSystemMock(fileData: Record<string, string> = {}) {
  return {
    readFile: vi.fn().mockImplementation(async (path: string) => {
      if (fileData[path]) {
        return fileData[path];
      }
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockImplementation(async (path: string) => {
      return Object.keys(fileData)
        .filter(file => file.startsWith(path))
        .map(file => file.replace(path + '/', '').split('/')[0])
        .filter((name, index, arr) => arr.indexOf(name) === index);
    }),
    stat: vi.fn().mockImplementation(async (path: string) => {
      if (fileData[path]) {
        return {
          isFile: () => true,
          isDirectory: () => false,
          size: fileData[path].length,
          mtime: new Date(),
          ctime: new Date(),
          atime: new Date(),
        };
      }
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }),
    access: vi.fn().mockImplementation(async (path: string) => {
      if (!fileData[path]) {
        throw new Error(`ENOENT: no such file or directory, access '${path}'`);
      }
    }),
  };
}

/**
 * Creates a mock for network requests
 */
export function createNetworkMock(responses: Record<string, any> = {}) {
  const fetchMock = vi.fn().mockImplementation(async (url: string | Request) => {
    const urlString = typeof url === 'string' ? url : url.url;

    if (responses[urlString]) {
      const response = responses[urlString];
      return new Response(
        typeof response === 'string' ? response : JSON.stringify(response),
        {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    throw new Error(`Network request to ${urlString} was not mocked`);
  });

  return {
    fetch: fetchMock,
    // Helper to add more responses during test
    addResponse: (url: string, response: any) => {
      responses[url] = response;
    },
    // Helper to simulate network error
    simulateNetworkError: (url: string) => {
      responses[url] = () => {
        throw new Error('Network Error');
      };
    },
  };
}

/**
 * Creates a mock for the task store
 */
export function createTaskStoreMock(initialTasks: any[] = []) {
  const tasks = new Map(initialTasks.map(task => [task.id, task]));

  return {
    create: vi.fn().mockImplementation(async (taskData: any) => {
      const task = {
        id: `task-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending',
        ...taskData,
      };
      tasks.set(task.id, task);
      return task;
    }),

    get: vi.fn().mockImplementation(async (id: string) => {
      return tasks.get(id) || null;
    }),

    update: vi.fn().mockImplementation(async (id: string, updates: any) => {
      const existing = tasks.get(id);
      if (!existing) {
        throw new Error(`Task ${id} not found`);
      }
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };
      tasks.set(id, updated);
      return updated;
    }),

    delete: vi.fn().mockImplementation(async (id: string) => {
      return tasks.delete(id);
    }),

    list: vi.fn().mockImplementation(async () => {
      return Array.from(tasks.values());
    }),

    // Helper methods for testing
    _getTasks: () => Array.from(tasks.values()),
    _clearTasks: () => tasks.clear(),
    _addTask: (task: any) => tasks.set(task.id, task),
  };
}

/**
 * Creates a mock for event emitters
 */
export function createEventEmitterMock() {
  const listeners = new Map<string, Set<Function>>();

  const addListener = (event: string, listener: Function) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(listener);
  };

  const removeListener = (event: string, listener: Function) => {
    if (listeners.has(event)) {
      listeners.get(event)!.delete(listener);
    }
  };

  return {
    on: vi.fn().mockImplementation(addListener),

    off: vi.fn().mockImplementation(removeListener),

    emit: vi.fn().mockImplementation((event: string, ...args: any[]) => {
      if (listeners.has(event)) {
        listeners.get(event)!.forEach(listener => {
          try {
            listener(...args);
          } catch (error) {
            console.error('Error in event listener:', error);
          }
        });
      }
    }),

    once: vi.fn().mockImplementation((event: string, listener: Function) => {
      const onceListener = (...args: any[]) => {
        listener(...args);
        removeListener(event, onceListener);
      };
      addListener(event, onceListener);
    }),

    // Helper methods for testing
    _getListeners: (event?: string) => {
      if (event) {
        return Array.from(listeners.get(event) || []);
      }
      return Object.fromEntries(
        Array.from(listeners.entries()).map(([key, value]) => [key, Array.from(value)])
      );
    },
    _clearListeners: (event?: string) => {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
    },
  };
}

/**
 * Creates a mock for browser/playwright page objects
 */
export function createPageMock(overrides: Record<string, any> = {}) {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('https://example.com'),
    title: vi.fn().mockResolvedValue('Test Page'),
    content: vi.fn().mockResolvedValue('<html><body>Mock content</body></html>'),

    // Element interaction
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue([]),

    // Waiting and timing
    waitForSelector: vi.fn().mockResolvedValue({}),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),

    // Screenshots and evaluation
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
    evaluate: vi.fn().mockImplementation(async (fn: Function) => fn()),

    // Locators
    locator: vi.fn().mockReturnValue({
      click: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      textContent: vi.fn().mockResolvedValue('Mock text'),
      isVisible: vi.fn().mockResolvedValue(true),
      isHidden: vi.fn().mockResolvedValue(false),
      first: vi.fn().mockReturnThis(),
      last: vi.fn().mockReturnThis(),
    }),

    // Event handling
    on: vi.fn(),
    off: vi.fn(),

    ...overrides,
  };
}

/**
 * Creates a mock for console messages
 */
export function createConsoleMock() {
  const messages: Array<{
    level: string;
    message: string;
    timestamp: Date;
  }> = [];

  return {
    log: vi.fn().mockImplementation((...args: any[]) => {
      messages.push({
        level: 'log',
        message: args.join(' '),
        timestamp: new Date(),
      });
    }),
    error: vi.fn().mockImplementation((...args: any[]) => {
      messages.push({
        level: 'error',
        message: args.join(' '),
        timestamp: new Date(),
      });
    }),
    warn: vi.fn().mockImplementation((...args: any[]) => {
      messages.push({
        level: 'warn',
        message: args.join(' '),
        timestamp: new Date(),
      });
    }),
    info: vi.fn().mockImplementation((...args: any[]) => {
      messages.push({
        level: 'info',
        message: args.join(' '),
        timestamp: new Date(),
      });
    }),

    // Helper methods for testing
    _getMessages: () => [...messages],
    _clearMessages: () => messages.splice(0, messages.length),
    _getMessagesByLevel: (level: string) =>
      messages.filter(msg => msg.level === level),
  };
}

/**
 * Collection of all mock helpers
 */
export const mockHelpers = {
  createOrchestratorMock,
  createAgentSdkMock,
  createFileSystemMock,
  createNetworkMock,
  createTaskStoreMock,
  createEventEmitterMock,
  createPageMock,
  createConsoleMock,
};

/**
 * Helper to create a complete mock environment
 */
export function createMockEnvironment(options: {
  includeOrchestrator?: boolean;
  includeFileSystem?: boolean;
  includeNetwork?: boolean;
  includeTaskStore?: boolean;
  fileData?: Record<string, string>;
  networkResponses?: Record<string, any>;
  initialTasks?: any[];
} = {}) {
  const {
    includeOrchestrator = true,
    includeFileSystem = true,
    includeNetwork = true,
    includeTaskStore = true,
    fileData = {},
    networkResponses = {},
    initialTasks = [],
  } = options;

  const environment: any = {};

  if (includeOrchestrator) {
    environment.orchestrator = createOrchestratorMock();
  }

  if (includeFileSystem) {
    environment.fs = createFileSystemMock(fileData);
  }

  if (includeNetwork) {
    environment.network = createNetworkMock(networkResponses);
  }

  if (includeTaskStore) {
    environment.taskStore = createTaskStoreMock(initialTasks);
  }

  return environment;
}