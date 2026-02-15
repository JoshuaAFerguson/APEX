/**
 * Tri-System Integration Test Utilities
 *
 * Comprehensive test infrastructure for end-to-end testing of three integrated systems:
 * 1. Tool System - Core tool infrastructure including Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch, and Browser tools
 * 2. Permission System - Access control, authorization, and permission enforcement across all tool operations
 * 3. Browser Automation - Web automation capabilities (navigate, click, type, screenshot, etc.)
 *
 * Provides unified testing API with mock factories, assertion helpers, and event capture
 * specifically designed for tri-system integration scenarios.
 *
 * @example
 * ```typescript
 * import { createTriSystemTestEnvironment } from './test-utils';
 *
 * const env = await createTriSystemTestEnvironment({
 *   permissionConfig: { preset: 'denyAll' },
 *   browserConfig: { headless: true },
 *   eventConfig: { captureAll: true }
 * });
 *
 * try {
 *   // Test tri-system integration
 *   const result = await env.toolSystem.executor.execute('Browser', {
 *     operation: 'navigate',
 *     params: { url: 'https://example.com' }
 *   });
 *
 *   assertPermissionEnforced(result, 'denied');
 *   assertTriSystemEventSequence(env.systemEvents.getAllEvents(), [
 *     'permission:requested',
 *     'permission:denied',
 *     'tool:execution:failed'
 *   ]);
 * } finally {
 *   await env.cleanup();
 * }
 * ```
 */

import { vi, expect, type MockedFunction } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Import core types
import type {
  Task,
  TaskUsage,
  AgentDefinition,
  WorkflowDefinition,
  ApexConfig,
  Permission,
  PermissionLevel,
  ToolPermissionResult,
  AgentTool,
  TaskStatus,
  TaskPriority,
  AutonomyLevel,
  AgentModel
} from '@apexcli/core';

// Import orchestrator components
import { ApexOrchestrator, TaskStore } from '@apexcli/orchestrator';

// Import mock factories
import {
  createMockTask,
  createMockAgentDefinition,
  createMockWorkflowDefinition,
  createMockApexConfig
} from '@apexcli/core/src/test-fixtures/mock-factories';

// For now, create minimal mock implementations for missing dependencies
// These can be replaced with actual implementations when they become available

interface MockPermissionManagerConfig {
  denyOperations?: string[];
  blockedDomains?: string[];
  defaultPermissionLevel?: string;
  simulateFailures?: boolean;
}

interface MockPermissionManager {
  checkToolPermission: (tool: string, options: { scope: string }) => Promise<any>;
  grantPermission: (tool: string, level: string, scope?: string) => Promise<void>;
  denyPermission: (tool: string, scope?: string) => Promise<void>;
  clearPermissions?: () => void;
}

interface MockTrackedBrowser {
  browser: any;
  page: any;
  context: any;
  close: () => Promise<void>;
  markOperationStart: () => void;
  markOperationEnd: () => void;
}

// Basic mock implementations
function createMockPermissionManager(config: MockPermissionManagerConfig = {}): MockPermissionManager {
  const {
    denyOperations = [],
    blockedDomains = [],
    defaultPermissionLevel = 'allow-always',
    simulateFailures = false
  } = config;

  // Track granted permissions for allow-once behavior
  const grantedPermissions = new Map<string, { level: string; uses: number }>();
  const allowAlwaysPermissions = new Set<string>();

  return {
    checkToolPermission: vi.fn(async (tool: string, options: { scope: string }) => {
      const { scope = 'default' } = options;
      const permissionKey = `${tool}:${scope}`;

      // Check if this specific domain is blocked
      if (blockedDomains.length > 0) {
        const isBlocked = blockedDomains.some(domain => {
          if (scope.includes('://')) {
            try {
              const url = new URL(scope);
              return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
            } catch {
              return scope.includes(domain);
            }
          }
          return scope.includes(domain);
        });

        if (isBlocked) {
          return {
            allowed: false,
            level: null,
            denialReason: `Domain ${scope} is blocked`
          };
        }
      }

      // Check if tool is explicitly denied
      if (denyOperations.includes('*') || denyOperations.includes(tool)) {
        return {
          allowed: false,
          level: null,
          denialReason: `Tool ${tool} is denied`
        };
      }

      // Check for allow-always permissions
      if (allowAlwaysPermissions.has(tool) || allowAlwaysPermissions.has(permissionKey)) {
        return {
          allowed: true,
          level: 'allow-always',
          denialReason: null
        };
      }

      // Check for allow-once permissions
      const granted = grantedPermissions.get(permissionKey);
      if (granted) {
        if (granted.level === 'allow-once' && granted.uses > 0) {
          // Consume the permission
          granted.uses--;
          if (granted.uses <= 0) {
            grantedPermissions.delete(permissionKey);
          }
          return {
            allowed: true,
            level: 'allow-once',
            denialReason: null
          };
        } else if (granted.level === 'allow-always') {
          return {
            allowed: true,
            level: 'allow-always',
            denialReason: null
          };
        }
      }

      // Default behavior based on configuration
      if (defaultPermissionLevel === 'deny' || denyOperations.includes('*')) {
        return {
          allowed: false,
          level: null,
          denialReason: 'Default permission denied'
        };
      }

      return {
        allowed: true,
        level: defaultPermissionLevel,
        denialReason: null
      };
    }),

    grantPermission: vi.fn(async (tool: string, level: string, scope?: string) => {
      const permissionKey = scope ? `${tool}:${scope}` : tool;

      if (level === 'allow-always') {
        allowAlwaysPermissions.add(permissionKey);
        grantedPermissions.set(permissionKey, { level: 'allow-always', uses: Infinity });
      } else if (level === 'allow-once') {
        grantedPermissions.set(permissionKey, { level: 'allow-once', uses: 1 });
      }
    }),

    denyPermission: vi.fn(async (tool: string, scope?: string) => {
      const permissionKey = scope ? `${tool}:${scope}` : tool;
      allowAlwaysPermissions.delete(permissionKey);
      grantedPermissions.delete(permissionKey);
      denyOperations.push(tool);
    }),

    clearPermissions: vi.fn(() => {
      grantedPermissions.clear();
      allowAlwaysPermissions.clear();
      denyOperations.length = 0;
    })
  };
}

function createTrackedMockBrowser(): MockTrackedBrowser {
  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    title: vi.fn().mockResolvedValue('Example Page'),
    goto: vi.fn().mockResolvedValue({ status: () => 200 }),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
    evaluate: vi.fn().mockResolvedValue('mock-result'),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    getAttribute: vi.fn().mockResolvedValue('mock-attribute'),
    textContent: vi.fn().mockResolvedValue('mock-text'),
    close: vi.fn().mockResolvedValue(undefined)
  };

  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage)
  };

  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined)
  };

  return {
    browser: mockBrowser,
    page: mockPage,
    context: mockContext,
    close: vi.fn().mockResolvedValue(undefined),
    markOperationStart: vi.fn(),
    markOperationEnd: vi.fn()
  };
}

// Re-export mock factories
export {
  createMockTask,
  createMockAgentDefinition,
  createMockWorkflowDefinition,
  createMockApexConfig,
  type MockPermissionManagerConfig,
  type MockPermissionManager,
  type MockTrackedBrowser,
  createMockPermissionManager,
  createTrackedMockBrowser
};

// ============================================================================
// Core Types and Interfaces
// ============================================================================

/**
 * Core tri-system test environment containing all three integrated systems
 */
export interface TriSystemTestEnvironment {
  // Core Components
  testDir: string;
  orchestrator: ApexOrchestrator;
  taskStore: TaskStore;
  eventEmitter: EventEmitter;

  // System Components
  toolSystem: ToolSystemContext;
  permissionSystem: PermissionSystemContext;
  browserSystem: BrowserSystemContext;

  // Cross-System Event Tracking
  systemEvents: TriSystemEventCapture;

  // Cleanup
  cleanup: () => Promise<void>;
}

/**
 * Tool system context within the tri-system environment
 */
export interface ToolSystemContext {
  registry: ToolRegistry;
  executor: ToolExecutor;
  mocks: ToolMockCollection;
}

/**
 * Permission system context within the tri-system environment
 */
export interface PermissionSystemContext {
  manager: MockPermissionManager;
  store: PermissionStore;
  config: PermissionConfig;
}

/**
 * Browser system context within the tri-system environment
 */
export interface BrowserSystemContext {
  tool: BrowserTool;
  mockPage: MockPage;
  mockBrowser: MockBrowser;
  session: BrowserSession | null;
}

/**
 * Configuration options for creating tri-system test environment
 */
export interface TriSystemTestOptions {
  /** Tool system configuration */
  toolConfig?: {
    enabledTools?: AgentTool[];
    mockAll?: boolean;
    realTools?: AgentTool[];
  };

  /** Permission system configuration */
  permissionConfig?: {
    preset?: 'allowAll' | 'denyAll' | 'selective';
    defaultLevel?: PermissionLevel;
    deniedOperations?: string[];
    blockedDomains?: string[];
    simulateFailures?: boolean;
  };

  /** Browser system configuration */
  browserConfig?: {
    backend?: 'playwright' | 'mock';
    headless?: boolean;
    mockLevel?: 'full' | 'partial' | 'none';
    allowedDomains?: string[];
  };

  /** Event capture configuration */
  eventConfig?: {
    captureAll?: boolean;
    filterTypes?: string[];
    maxEvents?: number;
    enableCorrelation?: boolean;
  };

  /** Isolation configuration */
  isolation?: {
    filesystem?: boolean;
    network?: boolean;
    environment?: boolean;
  };
}

/**
 * Tool registry for managing available tools and their implementations
 */
export interface ToolRegistry {
  tools: Map<AgentTool, any>;
  registerTool: (name: AgentTool, implementation: any) => void;
  getTool: (name: AgentTool) => any;
  isRegistered: (name: AgentTool) => boolean;
  listTools: () => AgentTool[];
}

/**
 * Tool executor for executing tools with permission integration
 */
export interface ToolExecutor {
  execute: (toolName: AgentTool, params: any) => Promise<ToolExecutionResult>;
  executeWithPermissionCheck: (toolName: AgentTool, operation: string, params: any) => Promise<ToolExecutionResult>;
}

/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  permissionDenied?: boolean;
  metadata?: {
    tool: AgentTool;
    operation?: string;
    timestamp: string;
    executionTime?: number;
    permissionLevel?: PermissionLevel;
  };
}

/**
 * Collection of mock tools for testing
 */
export interface ToolMockCollection {
  read: MockedFunction<any>;
  write: MockedFunction<any>;
  edit: MockedFunction<any>;
  bash: MockedFunction<any>;
  grep: MockedFunction<any>;
  glob: MockedFunction<any>;
  webFetch: MockedFunction<any>;
  webSearch: MockedFunction<any>;
  browser: MockedFunction<any>;
  resetAll: () => void;
  getCallHistory: () => Record<AgentTool, any[]>;
}

/**
 * Permission store interface
 */
export interface PermissionStore {
  checkPermission: (tool: AgentTool, scope?: string) => Promise<ToolPermissionResult>;
  grantPermission: (tool: AgentTool, level: PermissionLevel, scope?: string) => Promise<void>;
  denyPermission: (tool: AgentTool, scope?: string) => Promise<void>;
  clearPermissions: () => Promise<void>;
}

/**
 * Permission configuration
 */
export interface PermissionConfig {
  defaultLevel: PermissionLevel;
  strictMode: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  deniedOperations: string[];
}

/**
 * Browser tool interface
 */
export interface BrowserTool {
  execute: (params: BrowserOperationParams) => Promise<ToolExecutionResult>;
  createSession: () => Promise<BrowserSession>;
  closeSession: (sessionId: string) => Promise<void>;
  cleanup: () => Promise<void>;
}

/**
 * Browser operation parameters
 */
export interface BrowserOperationParams {
  operation: BrowserOperation;
  params: {
    url?: string;
    selector?: string;
    text?: string;
    script?: string;
    fullPage?: boolean;
    timeout?: number;
  };
  sessionId?: string;
}

/**
 * Browser operation types
 */
export type BrowserOperation =
  | 'navigate'
  | 'click'
  | 'type'
  | 'screenshot'
  | 'evaluate'
  | 'waitForSelector'
  | 'getAttribute'
  | 'getText'
  | 'submit';

/**
 * Mock page interface
 */
export interface MockPage {
  url: MockedFunction<() => string>;
  title: MockedFunction<() => Promise<string>>;
  goto: MockedFunction<(url: string) => Promise<{ status: () => number }>>;
  click: MockedFunction<(selector: string) => Promise<void>>;
  type: MockedFunction<(selector: string, text: string) => Promise<void>>;
  screenshot: MockedFunction<(options?: any) => Promise<Buffer>>;
  evaluate: MockedFunction<(script: string) => Promise<any>>;
  waitForSelector: MockedFunction<(selector: string, timeout?: number) => Promise<void>>;
  getAttribute: MockedFunction<(selector: string, name: string) => Promise<string | null>>;
  textContent: MockedFunction<(selector: string) => Promise<string | null>>;
  close: MockedFunction<() => Promise<void>>;
}

/**
 * Mock browser interface
 */
export interface MockBrowser {
  newContext: MockedFunction<() => Promise<any>>;
  close: MockedFunction<() => Promise<void>>;
}

/**
 * Browser session interface
 */
export interface BrowserSession {
  id: string;
  context: any;
  page: any;
  createdAt: Date;
  lastActivity: Date;
}

// ============================================================================
// Event System Types
// ============================================================================

/**
 * System event with correlation support
 */
export interface SystemEvent {
  id: string;
  type: string;
  system: SystemType;
  data: any;
  timestamp: Date;
  correlationId?: string;
  parentEventId?: string;
}

/**
 * System types for event correlation
 */
export type SystemType = 'tool' | 'permission' | 'browser';

/**
 * Correlated event group for cross-system tracking
 */
export interface CorrelatedEventGroup {
  correlationId: string;
  events: SystemEvent[];
  systems: Set<SystemType>;
  startTime: Date;
  endTime: Date;
  complete: boolean;
}

/**
 * Event expectation for assertion helpers
 */
export interface EventExpectation {
  type: string;
  system?: SystemType;
  data?: any;
  timeoutMs?: number;
}

/**
 * Tri-system event capture with correlation support
 */
export interface TriSystemEventCapture {
  // Event storage by system
  toolEvents: SystemEvent[];
  permissionEvents: SystemEvent[];
  browserEvents: SystemEvent[];

  // Cross-system correlation
  correlatedEvents: CorrelatedEventGroup[];

  // Methods
  start(): void;
  stop(): void;
  getAllEvents(): SystemEvent[];
  getEventsBySystem(system: SystemType): SystemEvent[];
  getEventsByType(type: string): SystemEvent[];
  getCorrelatedEvents(correlationId: string): CorrelatedEventGroup | undefined;
  expectEventSequence(sequence: EventExpectation[]): Promise<void>;
  expectCrossSystemEvent(source: SystemType, target: SystemType): Promise<void>;

  // Cleanup
  cleanup(): void;
}

// ============================================================================
// Primary Factory Functions
// ============================================================================

/**
 * Creates a complete tri-system test environment with all three systems integrated
 */
export async function createTriSystemTestEnvironment(
  options: TriSystemTestOptions = {}
): Promise<TriSystemTestEnvironment> {
  const {
    toolConfig = {},
    permissionConfig = {},
    browserConfig = {},
    eventConfig = {},
    isolation = { filesystem: true, network: true, environment: true }
  } = options;

  // Create temporary test directory
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), `apex-tri-system-${Date.now()}-`));

  // Create core event emitter
  const eventEmitter = new EventEmitter();

  // Create system components
  const toolSystem = await createToolSystemContext(toolConfig, eventEmitter);
  const permissionSystem = await createPermissionSystemContext(permissionConfig, eventEmitter);
  const browserSystem = await createBrowserSystemContext(browserConfig, eventEmitter);

  // Create orchestrator and task store
  const taskStore = new TaskStore(testDir);
  await taskStore.initialize();

  const orchestrator = new ApexOrchestrator({
    projectPath: testDir,
    taskStore,
    permissionManager: permissionSystem.manager as any,
    eventEmitter
  });

  await orchestrator.initialize();

  // Now properly integrate the permission system with the tool executor
  const originalExecuteWithPermissionCheck = toolSystem.executor.executeWithPermissionCheck;
  toolSystem.executor.executeWithPermissionCheck = async (
    toolName: AgentTool,
    operation: string,
    params: any
  ): Promise<ToolExecutionResult> => {
    const startTime = Date.now();

    // First, check permissions
    eventEmitter.emit('permission:requested', {
      tool: toolName,
      operation,
      scope: params.params?.url || params.params?.selector || 'default',
      timestamp: new Date()
    });

    // Check permission using the permission system
    const permissionResult = await permissionSystem.manager.checkToolPermission(toolName, {
      scope: params.params?.url || 'default'
    });

    if (!permissionResult.allowed) {
      eventEmitter.emit('permission:denied', {
        tool: toolName,
        operation,
        denialReason: permissionResult.denialReason,
        timestamp: new Date()
      });

      const result: ToolExecutionResult = {
        success: false,
        error: permissionResult.denialReason || 'Permission denied',
        permissionDenied: true,
        metadata: {
          tool: toolName,
          operation,
          timestamp: new Date().toISOString(),
          executionTime: Date.now() - startTime,
          permissionLevel: permissionResult.level
        }
      };

      eventEmitter.emit('tool:execution:error', {
        tool: toolName,
        operation,
        error: result.error,
        result,
        timestamp: new Date()
      });

      return result;
    }

    eventEmitter.emit('permission:granted', {
      tool: toolName,
      operation,
      level: permissionResult.level,
      timestamp: new Date()
    });

    // If permission is granted, proceed with execution
    const result = await toolSystem.executor.execute(toolName, params);

    // Update metadata with permission level
    if (result.metadata) {
      result.metadata.permissionLevel = permissionResult.level as PermissionLevel;
    }

    return result;
  };

  // Set up cross-system event capture
  const systemEvents = createTriSystemEventCapture(eventEmitter, eventConfig);

  // Apply isolation settings
  if (isolation.filesystem) {
    await setupFilesystemIsolation(testDir);
  }
  if (isolation.environment) {
    setupEnvironmentIsolation();
  }

  const environment: TriSystemTestEnvironment = {
    testDir,
    orchestrator,
    taskStore,
    eventEmitter,
    toolSystem,
    permissionSystem,
    browserSystem,
    systemEvents,

    cleanup: async () => {
      // Stop event capture
      systemEvents.stop();

      // Cleanup browser system
      await browserSystem.tool.cleanup();

      // Cleanup permission system
      permissionSystem.manager.clearPermissions?.();

      // Cleanup tool system
      toolSystem.mocks.resetAll();

      // Cleanup orchestrator
      await orchestrator.cleanup?.();

      // Close task store
      taskStore.close();

      // Cleanup events
      systemEvents.cleanup();

      // Remove test directory
      await fs.rm(testDir, { recursive: true, force: true });

      // Reset all mocks
      vi.clearAllMocks();
    }
  };

  // Start event capture
  systemEvents.start();

  return environment;
}

// ============================================================================
// System Context Factories
// ============================================================================

/**
 * Create tool system context with registry, executor, and mocks
 */
async function createToolSystemContext(
  config: NonNullable<TriSystemTestOptions['toolConfig']>,
  eventEmitter: EventEmitter
): Promise<ToolSystemContext> {
  const {
    enabledTools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Browser'],
    mockAll = true,
    realTools = []
  } = config;

  // Create tool registry
  const tools = new Map<AgentTool, any>();

  const registry: ToolRegistry = {
    tools,
    registerTool: (name: AgentTool, implementation: any) => tools.set(name, implementation),
    getTool: (name: AgentTool) => tools.get(name),
    isRegistered: (name: AgentTool) => tools.has(name),
    listTools: () => Array.from(tools.keys())
  };

  // Create tool mocks
  const mocks: ToolMockCollection = {
    read: vi.fn().mockResolvedValue({ success: true, data: { content: 'mock file content' } }),
    write: vi.fn().mockResolvedValue({ success: true, data: { bytesWritten: 100 } }),
    edit: vi.fn().mockResolvedValue({ success: true, data: { linesChanged: 1 } }),
    bash: vi.fn().mockResolvedValue({ success: true, data: { exitCode: 0, stdout: 'mock output' } }),
    grep: vi.fn().mockResolvedValue({ success: true, data: { matches: ['line 1: match'] } }),
    glob: vi.fn().mockResolvedValue({ success: true, data: { files: ['/path/to/file.txt'] } }),
    webFetch: vi.fn().mockResolvedValue({ success: true, data: { content: 'web content' } }),
    webSearch: vi.fn().mockResolvedValue({ success: true, data: { results: [] } }),
    browser: vi.fn().mockResolvedValue({ success: true, data: { url: 'https://example.com' } }),

    resetAll: () => {
      Object.values(mocks).forEach(mock => {
        if (typeof mock === 'function' && mock.mockReset) {
          mock.mockReset();
        }
      });
    },

    getCallHistory: () => {
      const history: Record<AgentTool, any[]> = {} as any;
      const toolMockMap: Record<AgentTool, MockedFunction<any>> = {
        'Read': mocks.read,
        'Write': mocks.write,
        'Edit': mocks.edit,
        'Bash': mocks.bash,
        'Grep': mocks.grep,
        'Glob': mocks.glob,
        'WebFetch': mocks.webFetch,
        'WebSearch': mocks.webSearch,
        'Browser': mocks.browser
      };

      for (const [tool, mock] of Object.entries(toolMockMap)) {
        history[tool as AgentTool] = mock.mock.calls;
      }
      return history;
    }
  };

  // Register tools in registry
  if (mockAll) {
    const toolMockMap: Record<AgentTool, MockedFunction<any>> = {
      'Read': mocks.read,
      'Write': mocks.write,
      'Edit': mocks.edit,
      'Bash': mocks.bash,
      'Grep': mocks.grep,
      'Glob': mocks.glob,
      'WebFetch': mocks.webFetch,
      'WebSearch': mocks.webSearch,
      'Browser': mocks.browser
    };

    for (const tool of enabledTools) {
      if (toolMockMap[tool]) {
        registry.registerTool(tool, toolMockMap[tool]);
      }
    }
  }

  // Create tool executor (will be updated after environment creation)
  const executor: ToolExecutor = {
    execute: async (toolName: AgentTool, params: any): Promise<ToolExecutionResult> => {
      const startTime = Date.now();

      eventEmitter.emit('tool:execution:start', {
        tool: toolName,
        params,
        timestamp: new Date()
      });

      try {
        const tool = registry.getTool(toolName);
        if (!tool) {
          throw new Error(`Tool ${toolName} not registered`);
        }

        const result = await tool(params);
        const executionTime = Date.now() - startTime;

        const toolResult: ToolExecutionResult = {
          success: true,
          data: result.data,
          metadata: {
            tool: toolName,
            timestamp: new Date().toISOString(),
            executionTime
          }
        };

        eventEmitter.emit('tool:execution:complete', {
          tool: toolName,
          result: toolResult,
          timestamp: new Date()
        });

        return toolResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const executionTime = Date.now() - startTime;

        const toolResult: ToolExecutionResult = {
          success: false,
          error: errorMessage,
          metadata: {
            tool: toolName,
            timestamp: new Date().toISOString(),
            executionTime
          }
        };

        eventEmitter.emit('tool:execution:error', {
          tool: toolName,
          error: errorMessage,
          result: toolResult,
          timestamp: new Date()
        });

        return toolResult;
      }
    },

    executeWithPermissionCheck: async (
      toolName: AgentTool,
      operation: string,
      params: any
    ): Promise<ToolExecutionResult> => {
      // This will be properly implemented when the environment is created
      return executor.execute(toolName, params);
    }
  };

  return {
    registry,
    executor,
    mocks
  };
}

/**
 * Create permission system context with manager, store, and config
 */
async function createPermissionSystemContext(
  config: NonNullable<TriSystemTestOptions['permissionConfig']>,
  eventEmitter: EventEmitter
): Promise<PermissionSystemContext> {
  const {
    preset = 'selective',
    defaultLevel = 'full',
    deniedOperations = [],
    blockedDomains = [],
    simulateFailures = false
  } = config;

  // Create mock permission manager using existing utility
  const mockPermissionManagerConfig: MockPermissionManagerConfig = {
    denyOperations: preset === 'denyAll' ? ['*'] : deniedOperations,
    blockedDomains,
    defaultPermissionLevel: defaultLevel,
    simulateFailures
  };

  const manager = createMockPermissionManager(mockPermissionManagerConfig);

  // Create permission store
  const store: PermissionStore = {
    checkPermission: manager.checkToolPermission,
    grantPermission: manager.grantPermission,
    denyPermission: manager.denyPermission,
    clearPermissions: async () => {
      // Reset to initial state
      deniedOperations.length = 0;
      blockedDomains.length = 0;
    }
  };

  // Create permission config
  const permissionConfig: PermissionConfig = {
    defaultLevel,
    strictMode: preset === 'denyAll',
    allowedDomains: [],
    blockedDomains: [...blockedDomains],
    deniedOperations: [...deniedOperations]
  };

  // Set up event emission for permission events
  const originalCheckPermission = manager.checkToolPermission;
  manager.checkToolPermission = vi.fn(async (tool: string, options: { scope: string }) => {
    eventEmitter.emit('permission:requested', {
      tool,
      scope: options.scope,
      timestamp: new Date()
    });

    const result = await originalCheckPermission.call(manager, tool, options);

    if (result.allowed) {
      eventEmitter.emit('permission:granted', {
        tool,
        scope: options.scope,
        level: result.level,
        timestamp: new Date()
      });
    } else {
      eventEmitter.emit('permission:denied', {
        tool,
        scope: options.scope,
        denialReason: result.denialReason,
        timestamp: new Date()
      });
    }

    return result;
  });

  return {
    manager,
    store,
    config: permissionConfig
  };
}

/**
 * Create browser system context with tool, mocks, and session management
 */
async function createBrowserSystemContext(
  config: NonNullable<TriSystemTestOptions['browserConfig']>,
  eventEmitter: EventEmitter
): Promise<BrowserSystemContext> {
  const {
    backend = 'mock',
    headless = true,
    mockLevel = 'full',
    allowedDomains = ['example.com', 'test.local']
  } = config;

  // Create tracked mock browser
  const mockBrowser = createTrackedMockBrowser();

  // Create browser tool implementation
  const browserTool: BrowserTool = {
    execute: async (params: BrowserOperationParams): Promise<ToolExecutionResult> => {
      const { operation, params: operationParams } = params;
      const startTime = Date.now();

      eventEmitter.emit('browser:operation:start', {
        operation,
        params: operationParams,
        timestamp: new Date()
      });

      try {
        mockBrowser.markOperationStart();

        let result: any;
        switch (operation) {
          case 'navigate':
            if (operationParams.url) {
              await mockBrowser.page.goto(operationParams.url);
              result = { url: operationParams.url };
            }
            break;
          case 'click':
            if (operationParams.selector) {
              await mockBrowser.page.click(operationParams.selector);
              result = { clicked: true };
            }
            break;
          case 'type':
            if (operationParams.selector && operationParams.text) {
              await mockBrowser.page.type(operationParams.selector, operationParams.text);
              result = { typed: true };
            }
            break;
          case 'screenshot':
            const buffer = await mockBrowser.page.screenshot(operationParams);
            result = { screenshot: buffer };
            break;
          case 'evaluate':
            if (operationParams.script) {
              const evalResult = await mockBrowser.page.evaluate(operationParams.script);
              result = { result: evalResult };
            }
            break;
          default:
            result = { completed: true };
        }

        const executionTime = Date.now() - startTime;
        const toolResult: ToolExecutionResult = {
          success: true,
          data: result,
          metadata: {
            tool: 'Browser',
            operation,
            timestamp: new Date().toISOString(),
            executionTime
          }
        };

        eventEmitter.emit('browser:operation:complete', {
          operation,
          result: toolResult,
          timestamp: new Date()
        });

        return toolResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const executionTime = Date.now() - startTime;

        const toolResult: ToolExecutionResult = {
          success: false,
          error: errorMessage,
          metadata: {
            tool: 'Browser',
            operation,
            timestamp: new Date().toISOString(),
            executionTime
          }
        };

        eventEmitter.emit('browser:operation:error', {
          operation,
          error: errorMessage,
          timestamp: new Date()
        });

        return toolResult;
      } finally {
        mockBrowser.markOperationEnd();
      }
    },

    createSession: async (): Promise<BrowserSession> => {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const context = await mockBrowser.browser.newContext();
      const page = await context.newPage();

      const session: BrowserSession = {
        id: sessionId,
        context,
        page,
        createdAt: new Date(),
        lastActivity: new Date()
      };

      eventEmitter.emit('browser:session:created', {
        sessionId,
        timestamp: new Date()
      });

      return session;
    },

    closeSession: async (sessionId: string): Promise<void> => {
      eventEmitter.emit('browser:session:closed', {
        sessionId,
        timestamp: new Date()
      });
    },

    cleanup: async (): Promise<void> => {
      await mockBrowser.close();
    }
  };

  return {
    tool: browserTool,
    mockPage: mockBrowser.page,
    mockBrowser: mockBrowser.browser,
    session: null
  };
}

/**
 * Create tri-system event capture with correlation support
 */
function createTriSystemEventCapture(
  eventEmitter: EventEmitter,
  config: NonNullable<TriSystemTestOptions['eventConfig']>
): TriSystemEventCapture {
  const {
    captureAll = true,
    filterTypes = [],
    maxEvents = 1000,
    enableCorrelation = true
  } = config;

  const toolEvents: SystemEvent[] = [];
  const permissionEvents: SystemEvent[] = [];
  const browserEvents: SystemEvent[] = [];
  const correlatedEvents: CorrelatedEventGroup[] = [];

  let isCapturing = false;
  let eventCounter = 0;

  const correlationMap = new Map<string, CorrelatedEventGroup>();

  const captureEvent = (type: string, system: SystemType, data: any) => {
    if (!isCapturing) return;

    const event: SystemEvent = {
      id: `${system}_${eventCounter++}`,
      type,
      system,
      data,
      timestamp: new Date(),
      correlationId: enableCorrelation ? generateCorrelationId(type, data) : undefined
    };

    // Store in system-specific arrays
    switch (system) {
      case 'tool':
        toolEvents.push(event);
        break;
      case 'permission':
        permissionEvents.push(event);
        break;
      case 'browser':
        browserEvents.push(event);
        break;
    }

    // Handle correlation
    if (enableCorrelation && event.correlationId) {
      handleEventCorrelation(event);
    }

    // Enforce max events limit
    if (toolEvents.length + permissionEvents.length + browserEvents.length > maxEvents) {
      removeOldestEvent();
    }
  };

  const generateCorrelationId = (type: string, data: any): string | undefined => {
    // Generate correlation IDs for related events across systems
    if (data?.tool || data?.operation) {
      return `${data.tool || 'browser'}_${Date.now()}`;
    }
    return undefined;
  };

  const handleEventCorrelation = (event: SystemEvent) => {
    if (!event.correlationId) return;

    let group = correlationMap.get(event.correlationId);
    if (!group) {
      group = {
        correlationId: event.correlationId,
        events: [],
        systems: new Set(),
        startTime: event.timestamp,
        endTime: event.timestamp,
        complete: false
      };
      correlationMap.set(event.correlationId, group);
      correlatedEvents.push(group);
    }

    group.events.push(event);
    group.systems.add(event.system);
    group.endTime = event.timestamp;
  };

  const removeOldestEvent = () => {
    // Remove oldest event from the largest array
    const sizes = {
      tool: toolEvents.length,
      permission: permissionEvents.length,
      browser: browserEvents.length
    };

    const largestSystem = Object.keys(sizes).reduce((a, b) =>
      sizes[a as keyof typeof sizes] > sizes[b as keyof typeof sizes] ? a : b
    ) as keyof typeof sizes;

    switch (largestSystem) {
      case 'tool':
        toolEvents.shift();
        break;
      case 'permission':
        permissionEvents.shift();
        break;
      case 'browser':
        browserEvents.shift();
        break;
    }
  };

  // Set up event listeners
  const listeners: Array<{ event: string, handler: (...args: any[]) => void }> = [];

  const setupEventListeners = () => {
    // Tool system events
    const toolEventTypes = ['tool:execution:start', 'tool:execution:complete', 'tool:execution:error'];
    toolEventTypes.forEach(eventType => {
      const handler = (data: any) => captureEvent(eventType, 'tool', data);
      eventEmitter.on(eventType, handler);
      listeners.push({ event: eventType, handler });
    });

    // Permission system events
    const permissionEventTypes = ['permission:requested', 'permission:granted', 'permission:denied'];
    permissionEventTypes.forEach(eventType => {
      const handler = (data: any) => captureEvent(eventType, 'permission', data);
      eventEmitter.on(eventType, handler);
      listeners.push({ event: eventType, handler });
    });

    // Browser system events
    const browserEventTypes = [
      'browser:operation:start',
      'browser:operation:complete',
      'browser:operation:error',
      'browser:session:created',
      'browser:session:closed'
    ];
    browserEventTypes.forEach(eventType => {
      const handler = (data: any) => captureEvent(eventType, 'browser', data);
      eventEmitter.on(eventType, handler);
      listeners.push({ event: eventType, handler });
    });
  };

  const cleanupListeners = () => {
    listeners.forEach(({ event, handler }) => {
      eventEmitter.off(event, handler);
    });
    listeners.length = 0;
  };

  const triSystemEventCapture: TriSystemEventCapture = {
    toolEvents,
    permissionEvents,
    browserEvents,
    correlatedEvents,

    start: () => {
      if (isCapturing) return;
      isCapturing = true;
      setupEventListeners();
    },

    stop: () => {
      if (!isCapturing) return;
      isCapturing = false;
      cleanupListeners();
    },

    getAllEvents: () => [
      ...toolEvents,
      ...permissionEvents,
      ...browserEvents
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),

    getEventsBySystem: (system: SystemType) => {
      switch (system) {
        case 'tool': return [...toolEvents];
        case 'permission': return [...permissionEvents];
        case 'browser': return [...browserEvents];
      }
    },

    getEventsByType: (type: string) => {
      return triSystemEventCapture.getAllEvents().filter(event => event.type === type);
    },

    getCorrelatedEvents: (correlationId: string) => {
      return correlationMap.get(correlationId);
    },

    expectEventSequence: async (sequence: EventExpectation[]) => {
      // Implementation for event sequence expectations
      return new Promise<void>((resolve, reject) => {
        const timeout = Math.max(...sequence.map(e => e.timeoutMs || 5000));
        let sequenceIndex = 0;

        const checkSequence = () => {
          const allEvents = triSystemEventCapture.getAllEvents();
          let eventIndex = 0;

          while (eventIndex < allEvents.length && sequenceIndex < sequence.length) {
            const event = allEvents[eventIndex];
            const expected = sequence[sequenceIndex];

            if (event.type === expected.type &&
                (!expected.system || event.system === expected.system)) {
              sequenceIndex++;
            }
            eventIndex++;
          }

          if (sequenceIndex === sequence.length) {
            resolve();
          }
        };

        // Check immediately
        checkSequence();

        // Set up interval to check periodically
        const intervalId = setInterval(checkSequence, 100);

        // Set timeout
        setTimeout(() => {
          clearInterval(intervalId);
          if (sequenceIndex < sequence.length) {
            reject(new Error(`Event sequence timeout: expected ${sequence.length} events, got ${sequenceIndex}`));
          }
        }, timeout);
      });
    },

    expectCrossSystemEvent: async (source: SystemType, target: SystemType) => {
      // Implementation for cross-system event expectations
      return new Promise<void>((resolve, reject) => {
        const timeout = 5000;
        let found = false;

        const checkCrossSystem = () => {
          for (const group of correlatedEvents) {
            if (group.systems.has(source) && group.systems.has(target)) {
              found = true;
              resolve();
              return;
            }
          }
        };

        // Check immediately
        checkCrossSystem();

        // Set up interval to check periodically
        const intervalId = setInterval(checkCrossSystem, 100);

        // Set timeout
        setTimeout(() => {
          clearInterval(intervalId);
          if (!found) {
            reject(new Error(`Cross-system event not found: ${source} -> ${target}`));
          }
        }, timeout);
      });
    },

    cleanup: () => {
      cleanupListeners();
      toolEvents.length = 0;
      permissionEvents.length = 0;
      browserEvents.length = 0;
      correlatedEvents.length = 0;
      correlationMap.clear();
    }
  };

  return triSystemEventCapture;
}

// ============================================================================
// Mock Factory Functions
// ============================================================================

/**
 * Creates a complete mock tool system with all tools configured
 */
export function createMockToolSystem(options: {
  enabledTools?: AgentTool[];
  defaultResponses?: Record<AgentTool, any>;
} = {}): ToolSystemContext {
  const {
    enabledTools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Browser'],
    defaultResponses = {}
  } = options;

  const eventEmitter = new EventEmitter();

  // This is a simplified version for external use
  return {
    registry: {
      tools: new Map(),
      registerTool: vi.fn(),
      getTool: vi.fn(),
      isRegistered: vi.fn(),
      listTools: vi.fn(() => enabledTools)
    },
    executor: {
      execute: vi.fn().mockResolvedValue({ success: true }),
      executeWithPermissionCheck: vi.fn().mockResolvedValue({ success: true })
    },
    mocks: {
      read: vi.fn().mockResolvedValue(defaultResponses['Read'] || { success: true }),
      write: vi.fn().mockResolvedValue(defaultResponses['Write'] || { success: true }),
      edit: vi.fn().mockResolvedValue(defaultResponses['Edit'] || { success: true }),
      bash: vi.fn().mockResolvedValue(defaultResponses['Bash'] || { success: true }),
      grep: vi.fn().mockResolvedValue(defaultResponses['Grep'] || { success: true }),
      glob: vi.fn().mockResolvedValue(defaultResponses['Glob'] || { success: true }),
      webFetch: vi.fn().mockResolvedValue(defaultResponses['WebFetch'] || { success: true }),
      webSearch: vi.fn().mockResolvedValue(defaultResponses['WebSearch'] || { success: true }),
      browser: vi.fn().mockResolvedValue(defaultResponses['Browser'] || { success: true }),
      resetAll: vi.fn(),
      getCallHistory: vi.fn(() => ({}))
    }
  };
}

/**
 * Creates a mock permission system with configurable behaviors
 */
export function createMockPermissionSystem(options: MockPermissionManagerConfig = {}): PermissionSystemContext {
  const manager = createMockPermissionManager(options);

  return {
    manager,
    store: {
      checkPermission: manager.checkToolPermission,
      grantPermission: manager.grantPermission,
      denyPermission: manager.denyPermission,
      clearPermissions: vi.fn()
    },
    config: {
      defaultLevel: options.defaultPermissionLevel || 'full',
      strictMode: false,
      allowedDomains: [],
      blockedDomains: options.blockedDomains || [],
      deniedOperations: options.denyOperations || []
    }
  };
}

/**
 * Creates a mock browser system with configurable behaviors
 */
export function createMockBrowserSystem(options: {
  headless?: boolean;
  allowedDomains?: string[];
  defaultResponses?: Record<BrowserOperation, any>;
} = {}): BrowserSystemContext {
  const mockBrowser = createTrackedMockBrowser();

  return {
    tool: {
      execute: vi.fn().mockResolvedValue({ success: true }),
      createSession: vi.fn().mockResolvedValue({
        id: 'mock-session',
        context: mockBrowser.context,
        page: mockBrowser.page,
        createdAt: new Date(),
        lastActivity: new Date()
      }),
      closeSession: vi.fn(),
      cleanup: vi.fn()
    },
    mockPage: mockBrowser.page,
    mockBrowser: mockBrowser.browser,
    session: null
  };
}

/**
 * Creates a mock task designed for tri-system testing
 */
export function createMockTriSystemTask(overrides: Partial<Task> = {}): Task {
  return createMockTask({
    description: 'Tri-system integration test task',
    workflow: 'tri-system-test',
    autonomy: 'supervised',
    ...overrides
  });
}

// ============================================================================
// Scenario Factory Functions
// ============================================================================

/**
 * Creates a permission denied scenario for testing
 */
export async function createPermissionDeniedScenario(options: {
  deniedTools?: AgentTool[];
  deniedOperations?: string[];
  blockedDomains?: string[];
} = {}): Promise<TriSystemTestEnvironment> {
  const {
    deniedTools = ['Browser'],
    deniedOperations = [],
    blockedDomains = ['dangerous.com']
  } = options;

  const denyOperations = [
    ...deniedTools,
    ...deniedOperations
  ];

  return createTriSystemTestEnvironment({
    permissionConfig: {
      preset: 'denyAll',
      deniedOperations: denyOperations,
      blockedDomains
    }
  });
}

/**
 * Creates a browser-tool integration scenario
 */
export async function createBrowserToolIntegrationScenario(): Promise<TriSystemTestEnvironment> {
  return createTriSystemTestEnvironment({
    toolConfig: {
      enabledTools: ['Browser', 'Read', 'Write']
    },
    permissionConfig: {
      preset: 'selective',
      defaultLevel: 'allow-always'
    },
    browserConfig: {
      backend: 'mock',
      headless: true
    }
  });
}

/**
 * Creates a full autonomy scenario for testing
 */
export async function createFullAutonomyScenario(): Promise<TriSystemTestEnvironment> {
  return createTriSystemTestEnvironment({
    permissionConfig: {
      preset: 'allowAll',
      defaultLevel: 'allow-always'
    },
    eventConfig: {
      captureAll: true,
      enableCorrelation: true
    }
  });
}

/**
 * Creates a supervised mode scenario with approvals
 */
export async function createSupervisedModeScenario(): Promise<TriSystemTestEnvironment> {
  return createTriSystemTestEnvironment({
    permissionConfig: {
      preset: 'selective',
      defaultLevel: 'allow-once'
    },
    eventConfig: {
      captureAll: true,
      enableCorrelation: true
    }
  });
}

// ============================================================================
// Assertion Helper Functions
// ============================================================================

/**
 * Verify event flow across all three systems
 */
export function assertTriSystemEventSequence(
  events: SystemEvent[],
  expectedSequence: Array<{
    type: string;
    system?: SystemType;
    data?: any;
  }>
): void {
  let sequenceIndex = 0;

  for (const event of events) {
    if (sequenceIndex >= expectedSequence.length) break;

    const expected = expectedSequence[sequenceIndex];
    if (event.type === expected.type &&
        (!expected.system || event.system === expected.system)) {

      if (expected.data) {
        for (const [key, value] of Object.entries(expected.data)) {
          expect(event.data).toHaveProperty(key, value);
        }
      }

      sequenceIndex++;
    }
  }

  expect(sequenceIndex).toBe(expectedSequence.length);
}

/**
 * Verify permission enforcement on tool operations
 */
export function assertPermissionEnforced(
  result: ToolExecutionResult,
  expectedPermission: 'granted' | 'denied'
): void {
  if (expectedPermission === 'denied') {
    expect(result.success).toBe(false);
    expect(result.permissionDenied).toBe(true);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');
  } else {
    expect(result.success).toBe(true);
    expect(result.permissionDenied).not.toBe(true);
  }
}

/**
 * Verify browser operation respected permissions
 */
export function assertBrowserPermissionRespected(
  result: ToolExecutionResult,
  operation: BrowserOperation
): void {
  expect(result).toBeDefined();
  expect(result.metadata).toBeDefined();
  expect(result.metadata?.tool).toBe('Browser');
  expect(result.metadata?.operation).toBe(operation);

  if (!result.success) {
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');
  }
}

/**
 * Verify all systems are properly initialized
 */
export function assertTriSystemReady(env: TriSystemTestEnvironment): void {
  expect(env.toolSystem).toBeDefined();
  expect(env.permissionSystem).toBeDefined();
  expect(env.browserSystem).toBeDefined();
  expect(env.systemEvents).toBeDefined();
  expect(env.orchestrator).toBeDefined();
  expect(env.taskStore).toBeDefined();
  expect(env.eventEmitter).toBeDefined();

  // Check tool system readiness
  expect(env.toolSystem.registry.listTools().length).toBeGreaterThan(0);

  // Check permission system readiness
  expect(env.permissionSystem.manager).toBeDefined();
  expect(env.permissionSystem.store).toBeDefined();

  // Check browser system readiness
  expect(env.browserSystem.tool).toBeDefined();
  expect(env.browserSystem.mockPage).toBeDefined();
  expect(env.browserSystem.mockBrowser).toBeDefined();
}

/**
 * Verify clean shutdown without resource leaks
 */
export function assertCleanShutdown(env: TriSystemTestEnvironment): void {
  // Check that browser resources are cleaned up
  if (env.browserSystem.mockPage) {
    expect(env.browserSystem.mockPage.close).toHaveBeenCalled();
  }

  // Check that event listeners are cleaned up
  expect(env.systemEvents.getAllEvents).toBeDefined();

  // Check that no active operations remain
  const allEvents = env.systemEvents.getAllEvents();
  const startEvents = allEvents.filter(e => e.type.endsWith(':start'));
  const completeEvents = allEvents.filter(e => e.type.endsWith(':complete') || e.type.endsWith(':error'));

  // All started operations should be completed or failed
  expect(completeEvents.length).toBeGreaterThanOrEqual(startEvents.length);
}

/**
 * Verify event propagation between systems
 */
export function assertCrossSystemEventPropagation(
  env: TriSystemTestEnvironment,
  source: SystemType,
  target: SystemType,
  eventType: string
): void {
  const correlatedGroups = env.systemEvents.correlatedEvents;

  const relevantGroup = correlatedGroups.find(group =>
    group.systems.has(source) &&
    group.systems.has(target) &&
    group.events.some(event => event.type === eventType)
  );

  expect(relevantGroup).toBeDefined();

  if (relevantGroup) {
    expect(relevantGroup.systems.has(source)).toBe(true);
    expect(relevantGroup.systems.has(target)).toBe(true);
    expect(relevantGroup.events.length).toBeGreaterThan(0);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Set up filesystem isolation for test environment
 */
async function setupFilesystemIsolation(testDir: string): Promise<void> {
  process.chdir(testDir);
}

/**
 * Set up environment isolation
 */
function setupEnvironmentIsolation(): () => void {
  const originalEnv = { ...process.env };

  process.env.NODE_ENV = 'test';
  process.env.CI = 'true';

  return () => {
    process.env = originalEnv;
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Primary factory function
  createTriSystemTestEnvironment,

  // Mock factories
  createMockToolSystem,
  createMockPermissionSystem,
  createMockBrowserSystem,
  createMockTriSystemTask,

  // Scenario factories
  createPermissionDeniedScenario,
  createBrowserToolIntegrationScenario,
  createFullAutonomyScenario,
  createSupervisedModeScenario,

  // Assertion helpers
  assertTriSystemEventSequence,
  assertPermissionEnforced,
  assertBrowserPermissionRespected,
  assertTriSystemReady,
  assertCleanShutdown,
  assertCrossSystemEventPropagation,

  // Note: Types are exported separately above and can be imported as needed
};