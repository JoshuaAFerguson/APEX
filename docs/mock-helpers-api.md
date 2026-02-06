# Mock Helpers API Reference

This document provides a comprehensive API reference for APEX's mock helper functions, which provide testing utilities for mocking various system components during test execution.

## Overview

The mock helpers are located in `packages/core/src/test-fixtures/mock-helpers.ts` and provide standardized mock implementations for:

- Orchestrator components
- Claude Agent SDK
- File system operations
- Network requests
- Task storage
- Event emitters
- Browser page interactions
- Console logging

## Import Statement

```typescript
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
} from '@apex/core/test-fixtures/mock-helpers.js';
```

## Mock Helper Functions

### 1. createOrchestratorMock

Creates a mock of the APEX orchestrator for testing task execution workflows.

#### TypeScript Signature

```typescript
function createOrchestratorMock(overrides: Record<string, any> = {}): {
  executeTask: MockFunction;
  createTask: MockFunction;
  getTask: MockFunction;
  getTasks: MockFunction;
  on: MockFunction;
  off: MockFunction;
  emit: MockFunction;
  addEventListener: MockFunction;
  removeEventListener: MockFunction;
  loadConfig: MockFunction;
  getAgents: MockFunction;
  getWorkflows: MockFunction;
  [key: string]: any;
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `overrides` | `Record<string, any>` | No | Custom implementations to merge with defaults |

#### Mock Object Methods

| Method | Default Return Value | Description |
|--------|---------------------|-------------|
| `executeTask()` | `{ success: true, taskId: 'mock-task-id', result: 'Task completed successfully' }` | Executes a task with given workflow and description |
| `createTask()` | `{ id: 'mock-task-id', status: 'pending', workflow: 'feature-development', createdAt: Date }` | Creates a new task |
| `getTask()` | `{ id: 'mock-task-id', status: 'running', workflow: 'feature-development' }` | Retrieves a task by ID |
| `getTasks()` | `[]` | Returns all tasks |
| `loadConfig()` | `{ autonomyLevel: 'supervised', agents: {}, workflows: {} }` | Loads project configuration |
| `getAgents()` | `[]` | Returns available agents |
| `getWorkflows()` | `[]` | Returns available workflows |
| `on()`, `off()`, `emit()` | Mock functions | Event emitter methods |
| `addEventListener()`, `removeEventListener()` | Mock functions | Event listener methods |

#### Usage Example

```typescript
import { createOrchestratorMock } from '@apex/core/test-fixtures/mock-helpers.js';

describe('Task Execution', () => {
  it('should execute task successfully', async () => {
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
});
```

---

### 2. createAgentSdkMock

Creates a mock of the Claude Agent SDK for testing AI agent interactions.

#### TypeScript Signature

```typescript
function createAgentSdkMock(overrides: Record<string, any> = {}): {
  query: MockFunction;
  createClient: MockFunction;
  [key: string]: any;
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `overrides` | `Record<string, any>` | No | Custom implementations to override defaults |

#### Mock Object Methods

| Method | Default Return Value | Description |
|--------|---------------------|-------------|
| `query()` | `{ text: 'Mock agent response', usage: { input_tokens: 100, output_tokens: 150 } }` | Queries the AI agent with a prompt |
| `createClient()` | Object with `messages.create()` method | Creates a client for direct API communication |

#### Usage Example

```typescript
import { createAgentSdkMock } from '@apex/core/test-fixtures/mock-helpers.js';

describe('Agent SDK Integration', () => {
  it('should query agent successfully', async () => {
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
  });

  it('should create client with message capability', async () => {
    const mock = createAgentSdkMock();
    const client = mock.createClient();

    const response = await client.messages.create({
      model: 'claude-3-sonnet-20240229',
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(response.content).toEqual([{ text: 'Mock response' }]);
  });
});
```

---

### 3. createFileSystemMock

Creates a mock file system for testing file operations without touching the real file system.

#### TypeScript Signature

```typescript
function createFileSystemMock(fileData: Record<string, string> = {}): {
  readFile: MockFunction;
  writeFile: MockFunction;
  mkdir: MockFunction;
  unlink: MockFunction;
  readdir: MockFunction;
  stat: MockFunction;
  access: MockFunction;
  [key: string]: any;
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileData` | `Record<string, string>` | No | Map of file paths to file contents |

#### Mock Object Methods

| Method | Behavior | Description |
|--------|----------|-------------|
| `readFile(path)` | Returns file content if exists, throws `ENOENT` error otherwise | Reads a file's contents |
| `writeFile(path, content)` | Resolves to `undefined` | Writes content to a file |
| `mkdir(path)` | Resolves to `undefined` | Creates a directory |
| `unlink(path)` | Resolves to `undefined` | Deletes a file |
| `readdir(path)` | Returns array of files/directories in the path | Lists directory contents |
| `stat(path)` | Returns stats object: `{ isFile(), isDirectory(), size, mtime, ctime, atime }` | Gets file/directory statistics |
| `access(path)` | Resolves if file exists, throws ENOENT if not | Checks file accessibility |

#### Usage Example

```typescript
import { createFileSystemMock } from '@apex/core/test-fixtures/mock-helpers.js';

describe('File System Operations', () => {
  it('should read and write files', async () => {
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
  });

  it('should handle directory operations', async () => {
    const mock = createFileSystemMock({
      '/src/index.ts': 'export default {}',
      '/src/utils.ts': 'export const utils = {}'
    });

    await mock.mkdir('/src/components');

    const files = await mock.readdir('/src');
    expect(files).toContain('index.ts');
    expect(files).toContain('utils.ts');
  });
});
```

---

### 4. createNetworkMock

Creates a mock network interface for testing HTTP requests without making real network calls.

#### TypeScript Signature

```typescript
function createNetworkMock(responses: Record<string, any> = {}): {
  fetch: MockFunction;
  addResponse: (url: string, response: any) => void;
  simulateNetworkError: (url: string) => void;
  [key: string]: any;
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `responses` | `Record<string, any>` | No | Map of URLs to response objects |

#### Mock Object Methods

| Method | Behavior | Description |
|--------|----------|-------------|
| `fetch(url)` | Returns Response object if URL is mocked, throws error if not | Performs HTTP requests |
| `addResponse(url, response)` | Adds or overrides URL response | Dynamically configure responses |
| `simulateNetworkError(url)` | Configures URL to throw network error | Simulate network failures |

#### Usage Example

```typescript
import { createNetworkMock } from '@apex/core/test-fixtures/mock-helpers.js';

describe('Network Operations', () => {
  it('should fetch mocked responses', async () => {
    const mock = createNetworkMock({
      'https://api.example.com/users': { users: [{ id: 1, name: 'John' }] },
      'https://api.example.com/status': 'OK'
    });

    const response = await mock.fetch('https://api.example.com/users');
    const data = await response.json();

    expect(data.users).toHaveLength(1);
    expect(data.users[0].name).toBe('John');
  });

  it('should handle dynamic responses', async () => {
    const mock = createNetworkMock();

    // Add response dynamically
    mock.addResponse('https://api.example.com/new', { id: 123, message: 'Created' });

    const response = await mock.fetch('https://api.example.com/new');
    const data = await response.json();

    expect(data.id).toBe(123);
  });

  it('should simulate network errors', async () => {
    const mock = createNetworkMock();

    mock.simulateNetworkError('https://api.example.com/error');

    await expect(mock.fetch('https://api.example.com/error')).rejects.toThrow('Network Error');
  });
});
```

---

### 5. createTaskStoreMock

Creates a mock task storage system for testing task persistence operations.

#### TypeScript Signature

```typescript
function createTaskStoreMock(initialTasks: any[] = []): {
  create: MockFunction;
  get: MockFunction;
  update: MockFunction;
  delete: MockFunction;
  list: MockFunction;
  _getTasks: () => any[];
  _clearTasks: () => void;
  _addTask: (task: any) => void;
  [key: string]: any;
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `initialTasks` | `any[]` | No | Array of initial task objects |

#### Mock Object Methods

| Method | Behavior | Description |
|--------|----------|-------------|
| `create(taskData)` | Creates task with generated ID and timestamps | Creates a new task |
| `get(id)` | Returns task or null | Retrieves a task by ID |
| `update(id, updates)` | Updates task, throws error if not found | Updates an existing task |
| `delete(id)` | Deletes task, returns boolean | Removes a task |
| `list()` | Returns all tasks as array | Lists all tasks |
| `_getTasks()` | Get all tasks (bypasses mock function) | Helper method for testing |
| `_clearTasks()` | Clear all tasks | Helper method for testing |
| `_addTask(task)` | Add task directly | Helper method for testing |

#### Usage Example

```typescript
import { createTaskStoreMock } from '@apex/core/test-fixtures/mock-helpers.js';

describe('Task Storage', () => {
  it('should handle full CRUD operations', async () => {
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
  });

  it('should use helper methods', () => {
    const mock = createTaskStoreMock();

    mock._addTask({ id: 'test', status: 'pending' });

    const tasks = mock._getTasks();
    expect(tasks).toHaveLength(1);

    mock._clearTasks();
    expect(mock._getTasks()).toHaveLength(0);
  });
});
```

---

### 6. createEventEmitterMock

Creates a mock event emitter for testing event-driven workflows.

#### TypeScript Signature

```typescript
function createEventEmitterMock(): {
  on: MockFunction;
  off: MockFunction;
  emit: MockFunction;
  once: MockFunction;
  _getListeners: (event?: string) => Function[] | Record<string, Function[]>;
  _clearListeners: (event?: string) => void;
  [key: string]: any;
}
```

#### Mock Object Methods

| Method | Behavior | Description |
|--------|----------|-------------|
| `on(event, listener)` | Register event listener | Adds persistent event listener |
| `off(event, listener)` | Remove event listener | Removes specific event listener |
| `emit(event, ...args)` | Emit event to all registered listeners | Triggers all listeners for an event |
| `once(event, listener)` | Register one-time listener | Adds listener that auto-removes after first call |
| `_getListeners(event?)` | Get listeners for specific event or all events | Helper method for testing |
| `_clearListeners(event?)` | Clear specific event listeners or all | Helper method for testing |

**Note**: The `once()` method has a known bug with `this` binding that's documented in the test suite.

#### Usage Example

```typescript
import { createEventEmitterMock } from '@apex/core/test-fixtures/mock-helpers.js';

describe('Event Emitter', () => {
  it('should handle event registration and emission', () => {
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
  });

  it('should handle error in listeners gracefully', () => {
    const mock = createEventEmitterMock();
    const errorListener = vi.fn(() => { throw new Error('Listener error'); });
    const goodListener = vi.fn();

    mock.on('test', errorListener);
    mock.on('test', goodListener);

    // Should not throw, but continue to other listeners
    expect(() => mock.emit('test')).not.toThrow();
    expect(goodListener).toHaveBeenCalled();
  });
});
```

---

### 7. createPageMock

Creates a mock browser page for testing Playwright-style browser automation.

#### TypeScript Signature

```typescript
function createPageMock(overrides: Record<string, any> = {}): {
  // Navigation
  goto: MockFunction;
  url: MockFunction;
  title: MockFunction;
  content: MockFunction;

  // Interaction
  click: MockFunction;
  type: MockFunction;
  fill: MockFunction;
  selectOption: MockFunction;

  // Waiting
  waitForSelector: MockFunction;
  waitForTimeout: MockFunction;
  waitForLoadState: MockFunction;

  // Screenshots and evaluation
  screenshot: MockFunction;
  evaluate: MockFunction;

  // Locators
  locator: MockFunction;

  // Events
  on: MockFunction;
  off: MockFunction;

  [key: string]: any;
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `overrides` | `Record<string, any>` | No | Custom method implementations to override defaults |

#### Mock Object Methods

| Category | Method | Default Return Value | Description |
|----------|--------|---------------------|-------------|
| **Navigation** | `goto(url)` | `undefined` | Navigate to URL |
| | `url()` | `'https://example.com'` | Get current URL |
| | `title()` | `'Test Page'` | Get page title |
| | `content()` | `'<html><body>Mock content</body></html>'` | Get page HTML content |
| **Interaction** | `click(selector)` | `undefined` | Click an element |
| | `type(selector, text)` | `undefined` | Type text into an element |
| | `fill(selector, value)` | `undefined` | Fill form field |
| | `selectOption(selector, value)` | `[]` | Select option from dropdown |
| **Waiting** | `waitForSelector(selector)` | `{}` | Wait for element to appear |
| | `waitForTimeout(ms)` | `undefined` | Wait for specified time |
| | `waitForLoadState(state)` | `undefined` | Wait for page load state |
| **Evaluation** | `screenshot()` | `Buffer.from('fake-screenshot')` | Take page screenshot |
| | `evaluate(fn, ...args)` | Result of calling `fn(...args)` | Execute JavaScript in page |
| **Locators** | `locator(selector)` | Locator object | Get element locator |
| **Events** | `on(event, handler)` | Mock function | Add event listener |
| | `off(event, handler)` | Mock function | Remove event listener |

#### Locator Object Methods

The `locator()` method returns an object with these methods:
- `click()`, `fill(value)`, `textContent()` → Returns `'Mock text'`
- `isVisible()` → Returns `true`
- `isHidden()` → Returns `false`
- `first()`, `last()` → Returns self for chaining

#### Usage Example

```typescript
import { createPageMock } from '@apex/core/test-fixtures/mock-helpers.js';

describe('Browser Automation', () => {
  it('should handle page navigation and interaction', async () => {
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
  });

  it('should evaluate JavaScript', async () => {
    const mock = createPageMock();

    const result = await mock.evaluate((a, b) => a + b, 5, 3);
    expect(result).toBe(8);

    const title = await mock.evaluate(() => document.title);
    expect(mock.evaluate).toHaveBeenCalledWith(expect.any(Function));
  });
});
```

---

### 8. createConsoleMock

Creates a mock console for testing console output without polluting the actual console.

#### TypeScript Signature

```typescript
function createConsoleMock(): {
  log: MockFunction;
  error: MockFunction;
  warn: MockFunction;
  info: MockFunction;
  _getMessages: () => Array<{
    level: string;
    message: string;
    timestamp: Date;
  }>;
  _clearMessages: () => void;
  _getMessagesByLevel: (level: string) => Array<{ level: string; message: string; timestamp: Date }>;
  [key: string]: any;
}
```

#### Mock Object Methods

| Method | Behavior | Description |
|--------|----------|-------------|
| `log(...args)` | Records message at 'log' level | Standard console.log |
| `error(...args)` | Records message at 'error' level | Error logging |
| `warn(...args)` | Records message at 'warn' level | Warning logging |
| `info(...args)` | Records message at 'info' level | Info logging |
| `_getMessages()` | Returns all recorded messages with metadata | Helper for test inspection |
| `_clearMessages()` | Clear all recorded messages | Helper for test cleanup |
| `_getMessagesByLevel(level)` | Get messages filtered by level | Helper for specific level testing |

#### Message Object Structure

```typescript
{
  level: string;      // 'log', 'error', 'warn', 'info'
  message: string;    // Joined string of all arguments
  timestamp: Date;    // When the message was logged
}
```

#### Usage Example

```typescript
import { createConsoleMock } from '@apex/core/test-fixtures/mock-helpers.js';

describe('Console Output', () => {
  it('should capture console messages', () => {
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
  });

  it('should work as console replacement', () => {
    const originalConsole = console;
    const mock = createConsoleMock();

    // Replace global console
    global.console = mock as any;

    console.log('This will be captured');
    console.error('Error captured too');

    const messages = mock._getMessages();
    expect(messages).toHaveLength(2);

    // Restore
    global.console = originalConsole;
  });
});
```

---

### 9. createMockEnvironment (Composite Function)

Creates a complete mock environment with multiple interconnected mocks for comprehensive testing scenarios.

#### TypeScript Signature

```typescript
function createMockEnvironment(options?: {
  includeOrchestrator?: boolean;
  includeFileSystem?: boolean;
  includeNetwork?: boolean;
  includeTaskStore?: boolean;
  fileData?: Record<string, string>;
  networkResponses?: Record<string, any>;
  initialTasks?: any[];
} = {}): {
  orchestrator?: ReturnType<typeof createOrchestratorMock>;
  fs?: ReturnType<typeof createFileSystemMock>;
  network?: ReturnType<typeof createNetworkMock>;
  taskStore?: ReturnType<typeof createTaskStoreMock>;
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `options.includeOrchestrator` | `boolean` | No | `true` | Include orchestrator mock |
| `options.includeFileSystem` | `boolean` | No | `true` | Include file system mock |
| `options.includeNetwork` | `boolean` | No | `true` | Include network mock |
| `options.includeTaskStore` | `boolean` | No | `true` | Include task store mock |
| `options.fileData` | `Record<string, string>` | No | `{}` | File data for file system mock |
| `options.networkResponses` | `Record<string, any>` | No | `{}` | Network responses for network mock |
| `options.initialTasks` | `any[]` | No | `[]` | Initial tasks for task store mock |

#### Returned Mock Environment Object

| Property | Type | Description |
|----------|------|-------------|
| `orchestrator?` | `OrchestratorMock` | Orchestrator mock (if included) |
| `fs?` | `FileSystemMock` | File system mock (if included) |
| `network?` | `NetworkMock` | Network mock (if included) |
| `taskStore?` | `TaskStoreMock` | Task store mock (if included) |

#### Usage Example

```typescript
import { createMockEnvironment } from '@apex/core/test-fixtures/mock-helpers.js';

describe('Complete Workflow Integration', () => {
  it('should handle end-to-end task execution', async () => {
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
  });

  it('should support selective mock inclusion', () => {
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
});
```

---

### 10. mockHelpers Collection Object

A convenience export that groups all individual mock helper functions.

#### Definition

```typescript
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
```

#### Usage Example

```typescript
import { mockHelpers } from '@apex/core/test-fixtures/mock-helpers.js';

describe('Using Mock Helpers Collection', () => {
  it('should provide access to all mock creators', () => {
    const orchestrator = mockHelpers.createOrchestratorMock();
    const fs = mockHelpers.createFileSystemMock({ '/test.txt': 'content' });
    const network = mockHelpers.createNetworkMock();

    expect(orchestrator.executeTask).toBeDefined();
    expect(fs.readFile).toBeDefined();
    expect(network.fetch).toBeDefined();
  });
});
```

---

## Advanced Usage Patterns

### Integration Testing

```typescript
describe('Full Workflow Integration', () => {
  it('should simulate complete development workflow', async () => {
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
});
```

### Event-Driven Workflows

```typescript
describe('Event-Driven Workflow', () => {
  it('should handle multi-stage workflow with events', async () => {
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
});
```

### Error Handling and Edge Cases

```typescript
describe('Error Handling', () => {
  it('should handle file system errors gracefully', async () => {
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
```

## Best Practices

1. **Use createMockEnvironment for integration tests** - It provides a complete, interconnected mock ecosystem
2. **Use individual mock helpers for unit tests** - More focused and faster execution
3. **Leverage helper methods** - Use `_getTasks()`, `_getMessages()`, etc. for test assertions
4. **Configure realistic data** - Use meaningful file contents, network responses, and task data
5. **Test error scenarios** - Use the built-in error simulation capabilities
6. **Clean up between tests** - Use `_clearMessages()`, `_clearTasks()` in `beforeEach` hooks
7. **Combine with Vitest features** - The mocks integrate seamlessly with `vi.fn()` and other Vitest utilities

## Known Issues

- **EventEmitter.once() bug**: The `once()` method has a `this` binding issue that's documented in the test suite
- **Console mock limitations**: Complex object logging may not be perfectly captured
- **Page mock scope**: Limited to common Playwright API methods; extend via overrides for specialized needs

## Testing the Mock Helpers

The mock helpers themselves are comprehensively tested in:
- `packages/core/src/test-fixtures/__tests__/mock-helpers-api-documentation.test.ts`
- `packages/core/src/test-fixtures/__tests__/mock-helpers-edge-cases.test.ts`
- `packages/core/src/test-fixtures/__tests__/mock-helpers-comprehensive-integration.test.ts`
- `packages/core/src/test-fixtures/__tests__/mock-helpers-page.test.ts`

These test files serve as additional examples and validate the behavior described in this documentation.

## Related Documentation

- [Browser Permission Test Utilities](./browser-permission-test-utilities.md) - Browser state fixtures (cleanState, loggedInPage, errorPage, loadingPage, offlinePage, permissionDeniedPage), browserHelpers methods, BrowserStateBuilder fluent API, permission assertion helpers, and mock data factories for comprehensive testing
- [Browser State Fixtures API](./browser-state-fixtures-api.md) - Detailed API documentation for browserFixtures factory functions, browserHelpers immutable state manipulation, and BrowserStateBuilder fluent interface
- [System APIs Reference](./system-apis-reference.md) - Type definitions for interfaces being mocked
- [Test Utilities](./test-utilities.md) - Cross-platform test utilities and helper functions
- [Browser Automation Guide](./browser-automation.md) - Browser operations and configuration patterns tested with these mocks