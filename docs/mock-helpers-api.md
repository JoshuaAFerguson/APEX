# Mock Helpers API Reference

The APEX Mock Helpers provide utilities for creating comprehensive mocks in tests. This module includes individual mock creators for specific components and a composite environment creator for complete test setups.

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
  mockHelpers
} from '@apex/core/test-fixtures/mock-helpers';
```

## Individual Mock Functions

### createOrchestratorMock

Creates a mock for the APEX Orchestrator with all core functionality.

**Signature:**
```typescript
function createOrchestratorMock(overrides: Record<string, any> = {}): OrchestratorMock
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `overrides` | `Record<string, any>` | No | `{}` | Object to override default mock implementations |

**Returns:** Mock object with the following methods:
- `executeTask: MockFunction` - Returns `{ success: true, taskId: 'mock-task-id', result: 'Task completed successfully' }`
- `createTask: MockFunction` - Returns `{ id: 'mock-task-id', status: 'pending', workflow: 'feature-development', createdAt: Date }`
- `getTask: MockFunction` - Returns `{ id: 'mock-task-id', status: 'running', workflow: 'feature-development' }`
- `getTasks: MockFunction` - Returns `[]`
- `on: MockFunction` - Event listener registration
- `off: MockFunction` - Event listener removal
- `emit: MockFunction` - Event emission
- `addEventListener: MockFunction` - Alternative event listener registration
- `removeEventListener: MockFunction` - Alternative event listener removal
- `loadConfig: MockFunction` - Returns `{ autonomyLevel: 'supervised', agents: {}, workflows: {} }`
- `getAgents: MockFunction` - Returns `[]`
- `getWorkflows: MockFunction` - Returns `[]`

**Usage Example:**
```typescript
const mockOrchestrator = createOrchestratorMock({
  executeTask: vi.fn().mockResolvedValue({
    success: true,
    taskId: 'custom-task-id',
    result: 'Custom result'
  })
});

await mockOrchestrator.executeTask('test-workflow', 'Test description');
expect(mockOrchestrator.executeTask).toHaveBeenCalledWith('test-workflow', 'Test description');
```

---

### createAgentSdkMock

Creates a mock for the Claude Agent SDK interface.

**Signature:**
```typescript
function createAgentSdkMock(overrides: Record<string, any> = {}): AgentSdkMock
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `overrides` | `Record<string, any>` | No | `{}` | Object to override default mock implementations |

**Returns:** Mock object with the following methods:
- `query: MockFunction` - Returns `{ text: 'Mock agent response', usage: { input_tokens: 100, output_tokens: 150 } }`
- `createClient: MockFunction` - Returns mock client with messages.create method

**Usage Example:**
```typescript
const mockAgentSdk = createAgentSdkMock({
  query: vi.fn().mockResolvedValue({
    text: 'Custom agent response',
    usage: { input_tokens: 50, output_tokens: 75 }
  })
});

const result = await mockAgentSdk.query('test prompt');
expect(result.text).toBe('Custom agent response');
```

---

### createFileSystemMock

Creates a mock for file system operations with configurable file data.

**Signature:**
```typescript
function createFileSystemMock(fileData: Record<string, string> = {}): FileSystemMock
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fileData` | `Record<string, string>` | No | `{}` | Map of file paths to their content |

**Returns:** Mock object with the following methods:
- `readFile: MockFunction` - Reads from `fileData` or throws ENOENT error
- `writeFile: MockFunction` - Returns `undefined`
- `mkdir: MockFunction` - Returns `undefined`
- `unlink: MockFunction` - Returns `undefined`
- `readdir: MockFunction` - Returns directory contents based on `fileData`
- `stat: MockFunction` - Returns file stats or throws ENOENT error
- `access: MockFunction` - Checks file existence or throws ENOENT error

**Usage Example:**
```typescript
const mockFs = createFileSystemMock({
  '/path/to/file.txt': 'file content',
  '/path/to/config.json': '{"key": "value"}'
});

const content = await mockFs.readFile('/path/to/file.txt');
expect(content).toBe('file content');

// This will throw ENOENT error
await expect(mockFs.readFile('/nonexistent.txt')).rejects.toThrow('ENOENT');
```

---

### createNetworkMock

Creates a mock for network requests with configurable responses.

**Signature:**
```typescript
function createNetworkMock(responses: Record<string, any> = {}): NetworkMock
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `responses` | `Record<string, any>` | No | `{}` | Map of URLs to their response data |

**Returns:** Mock object with the following methods:
- `fetch: MockFunction` - Returns configured responses or throws error for unmocked URLs
- `addResponse: Function` - Adds a response for a specific URL
- `simulateNetworkError: Function` - Configures a URL to throw network errors

**Usage Example:**
```typescript
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
```

---

### createTaskStoreMock

Creates a mock task store with in-memory task management.

**Signature:**
```typescript
function createTaskStoreMock(initialTasks: any[] = []): TaskStoreMock
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `initialTasks` | `any[]` | No | `[]` | Array of initial tasks to populate the store |

**Returns:** Mock object with the following methods:
- `create: MockFunction` - Creates a new task with auto-generated ID and timestamps
- `get: MockFunction` - Retrieves a task by ID
- `update: MockFunction` - Updates an existing task
- `delete: MockFunction` - Deletes a task
- `list: MockFunction` - Returns all tasks
- `_getTasks: Function` - Helper to get all tasks (for testing)
- `_clearTasks: Function` - Helper to clear all tasks (for testing)
- `_addTask: Function` - Helper to add a task directly (for testing)

**Usage Example:**
```typescript
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
expect(retrieved.workflow).toBe('feature-development');
```

---

### createEventEmitterMock

Creates a mock event emitter with functional event handling.

**Signature:**
```typescript
function createEventEmitterMock(): EventEmitterMock
```

**Parameters:** None

**Returns:** Mock object with the following methods:
- `on: MockFunction` - Registers event listeners
- `off: MockFunction` - Removes event listeners
- `emit: MockFunction` - Emits events to registered listeners
- `once: MockFunction` - Registers one-time event listeners ⚠️ **(Known Bug: incorrect `this` binding)**
- `_getListeners: Function` - Helper to get listeners for testing
- `_clearListeners: Function` - Helper to clear listeners for testing

**Usage Example:**
```typescript
const mockEmitter = createEventEmitterMock();

const listener = vi.fn();
mockEmitter.on('test-event', listener);

mockEmitter.emit('test-event', 'data1', 'data2');
expect(listener).toHaveBeenCalledWith('data1', 'data2');

// Check listeners (for testing)
const listeners = mockEmitter._getListeners('test-event');
expect(listeners).toHaveLength(1);
```

**Known Issues:**
- The `once` method has a bug where `this.off` and `this.on` are undefined due to incorrect context binding
- For reliable one-time listeners, manually remove listeners after first invocation

---

### createPageMock

Creates a mock for browser/Playwright page objects.

**Signature:**
```typescript
function createPageMock(overrides: Record<string, any> = {}): PageMock
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `overrides` | `Record<string, any>` | No | `{}` | Object to override default mock implementations |

**Returns:** Mock object with the following methods:
- `goto: MockFunction` - Navigation method
- `url: MockFunction` - Returns `'https://example.com'`
- `title: MockFunction` - Returns `'Test Page'`
- `content: MockFunction` - Returns HTML content
- `click: MockFunction` - Element interaction
- `type: MockFunction` - Text input
- `fill: MockFunction` - Form filling
- `selectOption: MockFunction` - Option selection
- `waitForSelector: MockFunction` - Element waiting
- `waitForTimeout: MockFunction` - Timeout waiting
- `waitForLoadState: MockFunction` - Load state waiting
- `screenshot: MockFunction` - Returns fake screenshot buffer
- `evaluate: MockFunction` - JavaScript evaluation
- `locator: MockFunction` - Returns mock locator object
- `on: MockFunction` - Event handling
- `off: MockFunction` - Event removal

**Usage Example:**
```typescript
const mockPage = createPageMock({
  title: vi.fn().mockResolvedValue('Custom Page Title')
});

await mockPage.goto('https://example.com');
await mockPage.click('#button');
const title = await mockPage.title();
expect(title).toBe('Custom Page Title');

const locator = mockPage.locator('#element');
await locator.click();
expect(locator.click).toHaveBeenCalled();
```

---

### createConsoleMock

Creates a mock console with message tracking.

**Signature:**
```typescript
function createConsoleMock(): ConsoleMock
```

**Parameters:** None

**Returns:** Mock object with the following methods:
- `log: MockFunction` - Logs messages and stores them
- `error: MockFunction` - Logs error messages and stores them
- `warn: MockFunction` - Logs warning messages and stores them
- `info: MockFunction` - Logs info messages and stores them
- `_getMessages: Function` - Returns all logged messages
- `_clearMessages: Function` - Clears all logged messages
- `_getMessagesByLevel: Function` - Returns messages filtered by level

**Usage Example:**
```typescript
const mockConsole = createConsoleMock();

mockConsole.log('Test message');
mockConsole.error('Error message');
mockConsole.warn('Warning message');

const messages = mockConsole._getMessages();
expect(messages).toHaveLength(3);

const errors = mockConsole._getMessagesByLevel('error');
expect(errors).toHaveLength(1);
expect(errors[0].message).toBe('Error message');
```

---

## Composite Mock Function

### createMockEnvironment

Creates a complete mock environment with multiple mocks configured together.

**Signature:**
```typescript
function createMockEnvironment(options: {
  includeOrchestrator?: boolean;
  includeFileSystem?: boolean;
  includeNetwork?: boolean;
  includeTaskStore?: boolean;
  fileData?: Record<string, string>;
  networkResponses?: Record<string, any>;
  initialTasks?: any[];
} = {}): MockEnvironment
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `options` | `object` | No | `{}` | Configuration options for the environment |
| `options.includeOrchestrator` | `boolean` | No | `true` | Whether to include orchestrator mock |
| `options.includeFileSystem` | `boolean` | No | `true` | Whether to include file system mock |
| `options.includeNetwork` | `boolean` | No | `true` | Whether to include network mock |
| `options.includeTaskStore` | `boolean` | No | `true` | Whether to include task store mock |
| `options.fileData` | `Record<string, string>` | No | `{}` | File data for file system mock |
| `options.networkResponses` | `Record<string, any>` | No | `{}` | Network responses for network mock |
| `options.initialTasks` | `any[]` | No | `[]` | Initial tasks for task store mock |

**Returns:** Environment object containing selected mocks:
- `orchestrator?` - Orchestrator mock (if included)
- `fs?` - File system mock (if included)
- `network?` - Network mock (if included)
- `taskStore?` - Task store mock (if included)

**Usage Example:**
```typescript
const env = createMockEnvironment({
  includeOrchestrator: true,
  includeFileSystem: true,
  includeNetwork: false,
  includeTaskStore: true,
  fileData: {
    '/config.yaml': 'key: value',
    '/data.json': '{"test": true}'
  },
  initialTasks: [
    { id: 'task-1', status: 'pending', workflow: 'test' }
  ]
});

// Use the mocks
const config = await env.fs.readFile('/config.yaml');
const task = await env.taskStore.get('task-1');
const result = await env.orchestrator.executeTask('workflow', 'description');
```

**Complete Environment Setup:**
```typescript
// Create a full test environment
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

// All mocks are ready to use
expect(fullEnv.orchestrator).toBeDefined();
expect(fullEnv.fs).toBeDefined();
expect(fullEnv.network).toBeDefined();
expect(fullEnv.taskStore).toBeDefined();
```

## Mock Helpers Collection

The `mockHelpers` object provides access to all individual mock creators:

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

// Usage
const orchestratorMock = mockHelpers.createOrchestratorMock();
const fsMock = mockHelpers.createFileSystemMock({ '/test.txt': 'content' });
```

## TypeScript Types

All mock functions use Vitest mock functions (`vi.fn()`) and support TypeScript. Import the types from the test fixtures module:

```typescript
import type { MockFunction } from '@apex/core/test-fixtures/types';

// Mock functions have proper typing
const mockFn: MockFunction<(arg: string) => Promise<string>> = vi.fn();
```

## Testing Best Practices

1. **Use specific overrides** for test scenarios:
   ```typescript
   const mockOrchestrator = createOrchestratorMock({
     executeTask: vi.fn().mockRejectedValue(new Error('Task failed'))
   });
   ```

2. **Leverage composite environment** for integration tests:
   ```typescript
   const env = createMockEnvironment({
     fileData: { '/config.yaml': 'test: true' },
     networkResponses: { 'https://api.test.com': { success: true } }
   });
   ```

3. **Use helper methods** for test utilities:
   ```typescript
   const mockStore = createTaskStoreMock();
   mockStore._addTask({ id: 'test', status: 'running' });

   const tasks = mockStore._getTasks();
   expect(tasks).toHaveLength(1);
   ```

4. **Clean up between tests**:
   ```typescript
   afterEach(() => {
     mockConsole._clearMessages();
     mockEmitter._clearListeners();
     mockTaskStore._clearTasks();
   });
   ```