/**
 * Tool Integration Test Fixtures
 *
 * Provides comprehensive test utilities for testing APEX tool integrations including:
 * - Tool permission testing
 * - Mock tool implementations
 * - Tool execution scenarios
 * - Permission workflows
 */

import { vi } from 'vitest';
import type {
  AgentTool,
  AgentDefinition,
  Permission,
  PermissionLevel,
  ToolPermission,
  ToolCategory,
  DirectoryAccessConfig,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  BrowserToolConfig,
} from '@apexcli/core';

// ============================================================================
// Tool Mock Factories
// ============================================================================

/**
 * Creates a comprehensive mock for a specific tool with realistic behavior
 */
export function createToolMock(toolName: AgentTool, options: {
  shouldSucceed?: boolean;
  responseDelay?: number;
  responseData?: unknown;
  throwError?: Error;
  trackCalls?: boolean;
} = {}) {
  const {
    shouldSucceed = true,
    responseDelay = 0,
    responseData = null,
    throwError,
    trackCalls = true,
  } = options;

  const callHistory: Array<{
    args: unknown[];
    timestamp: Date;
    result?: unknown;
    error?: Error;
  }> = [];

  const mockImplementation = vi.fn(async (...args: unknown[]) => {
    const callRecord = {
      args,
      timestamp: new Date(),
    };

    if (responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, responseDelay));
    }

    try {
      if (throwError) {
        callRecord.error = throwError;
        throw throwError;
      }

      if (!shouldSucceed) {
        const error = new Error(`Tool ${toolName} execution failed`);
        callRecord.error = error;
        throw error;
      }

      const result = responseData || createDefaultToolResponse(toolName, args);
      callRecord.result = result;

      if (trackCalls) {
        callHistory.push(callRecord);
      }

      return result;
    } catch (error) {
      if (trackCalls) {
        callHistory.push(callRecord);
      }
      throw error;
    }
  });

  return {
    mock: mockImplementation,
    callHistory,
    getCallCount: () => callHistory.length,
    getLastCall: () => callHistory[callHistory.length - 1],
    reset: () => {
      mockImplementation.mockReset();
      callHistory.length = 0;
    },
  };
}

/**
 * Create default responses for different tool types
 */
function createDefaultToolResponse(toolName: AgentTool, args: unknown[]): unknown {
  switch (toolName) {
    case 'Read':
      return { content: 'mock file content', size: 100 };

    case 'Write':
      return { success: true, bytesWritten: 50 };

    case 'Edit':
      return { success: true, linesChanged: 3 };

    case 'Bash':
      return {
        stdout: 'mock command output',
        stderr: '',
        exitCode: 0,
        duration: 100,
      };

    case 'Grep':
      return {
        matches: [
          { file: 'test.txt', line: 1, content: 'mock match' }
        ],
        totalMatches: 1,
      };

    case 'Glob':
      return {
        files: ['file1.txt', 'file2.txt'],
        totalFiles: 2,
      };

    case 'WebFetch':
      return {
        content: '<html>mock web content</html>',
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
      };

    case 'WebSearch':
      return {
        results: [
          { title: 'Mock Result', url: 'https://example.com', snippet: 'Mock snippet' }
        ],
        totalResults: 1,
      };

    case 'Browser':
      return {
        success: true,
        screenshot: 'base64-encoded-image',
        pageTitle: 'Mock Page',
      };

    case 'TodoWrite':
      return { success: true, todosUpdated: 3 };

    default:
      return { success: true };
  }
}

/**
 * Creates a complete mock tool registry with all available tools
 */
export function createMockToolRegistry(overrides: Partial<Record<AgentTool, ReturnType<typeof createToolMock>>> = {}) {
  const tools: Record<AgentTool, ReturnType<typeof createToolMock>> = {
    Read: overrides.Read || createToolMock('Read'),
    Write: overrides.Write || createToolMock('Write'),
    Edit: overrides.Edit || createToolMock('Edit'),
    MultiEdit: overrides.MultiEdit || createToolMock('MultiEdit'),
    NotebookEdit: overrides.NotebookEdit || createToolMock('NotebookEdit'),
    Bash: overrides.Bash || createToolMock('Bash'),
    Grep: overrides.Grep || createToolMock('Grep'),
    Glob: overrides.Glob || createToolMock('Glob'),
    WebFetch: overrides.WebFetch || createToolMock('WebFetch'),
    WebSearch: overrides.WebSearch || createToolMock('WebSearch'),
    TodoWrite: overrides.TodoWrite || createToolMock('TodoWrite'),
    Browser: overrides.Browser || createToolMock('Browser'),
  };

  return {
    tools,
    getAllMocks: () => Object.values(tools).map(t => t.mock),
    resetAllMocks: () => Object.values(tools).forEach(t => t.reset()),
    getToolMock: (toolName: AgentTool) => tools[toolName],
    getCallHistory: () => Object.entries(tools).reduce((acc, [name, tool]) => {
      acc[name as AgentTool] = tool.callHistory;
      return acc;
    }, {} as Record<AgentTool, typeof tools[AgentTool]['callHistory']>),
  };
}

// ============================================================================
// Permission Test Fixtures
// ============================================================================

/**
 * Creates permission test fixtures for different scenarios
 */
export const permissionFixtures = {
  /**
   * Allow-always permission for filesystem tools
   */
  filesystemAllowAlways: (tool: AgentTool = 'Read', scope?: string): Permission => ({
    tool,
    scope,
    level: 'allow-always',
    createdAt: new Date(),
  }),

  /**
   * Allow-once permission for network tools
   */
  networkAllowOnce: (tool: AgentTool = 'WebFetch', scope?: string): Permission => ({
    tool,
    scope,
    level: 'allow-once',
    createdAt: new Date(),
  }),

  /**
   * Denied permission for shell tools
   */
  shellDenied: (tool: AgentTool = 'Bash', scope?: string): Permission => ({
    tool,
    scope: scope || '*',
    level: 'deny',
    createdAt: new Date(),
  }),

  /**
   * Temporary permission with expiry
   */
  temporaryPermission: (tool: AgentTool, expiryMs: number = 60000): Permission => ({
    tool,
    level: 'allow-always',
    expiry: new Date(Date.now() + expiryMs),
    createdAt: new Date(),
  }),

  /**
   * Scoped permission for specific file patterns
   */
  scopedFilePermission: (tool: AgentTool, filePattern: string): Permission => ({
    tool,
    scope: filePattern,
    level: 'allow-always',
    createdAt: new Date(),
  }),

  /**
   * Multiple permissions for complex scenarios
   */
  complexPermissions: (): Permission[] => [
    permissionFixtures.filesystemAllowAlways('Read', '/project/**/*.ts'),
    permissionFixtures.filesystemAllowAlways('Write', '/project/src/**'),
    permissionFixtures.networkAllowOnce('WebFetch', 'https://api.example.com/*'),
    permissionFixtures.shellDenied('Bash', 'rm *'),
    permissionFixtures.temporaryPermission('Browser', 30000),
  ],
};

/**
 * Mock permission store for testing
 */
export class MockPermissionStore {
  private permissions: Permission[] = [];

  constructor(initialPermissions: Permission[] = []) {
    this.permissions = [...initialPermissions];
  }

  async hasPermission(tool: string, scope?: string): Promise<boolean> {
    const permission = this.permissions.find(p =>
      p.tool === tool &&
      (!scope || !p.scope || this.matchesScope(scope, p.scope))
    );

    if (!permission) return false;
    if (permission.level === 'deny') return false;
    if (permission.expiry && permission.expiry < new Date()) return false;

    return true;
  }

  async addPermission(permission: Permission): Promise<void> {
    this.permissions.push(permission);
  }

  async removePermission(tool: string, scope?: string): Promise<boolean> {
    const index = this.permissions.findIndex(p =>
      p.tool === tool && p.scope === scope
    );

    if (index !== -1) {
      this.permissions.splice(index, 1);
      return true;
    }
    return false;
  }

  async getAllPermissions(): Promise<Permission[]> {
    return [...this.permissions];
  }

  async clearExpired(): Promise<number> {
    const now = new Date();
    const originalLength = this.permissions.length;
    this.permissions = this.permissions.filter(p =>
      !p.expiry || p.expiry > now
    );
    return originalLength - this.permissions.length;
  }

  private matchesScope(requestedScope: string, permissionScope: string): boolean {
    // Simple glob-like pattern matching for testing
    if (permissionScope === '*') return true;
    if (permissionScope.endsWith('*')) {
      const prefix = permissionScope.slice(0, -1);
      return requestedScope.startsWith(prefix);
    }
    return requestedScope === permissionScope;
  }

  // Test utilities
  reset() {
    this.permissions = [];
  }

  getPermissionCount(): number {
    return this.permissions.length;
  }
}

// ============================================================================
// Tool Configuration Test Fixtures
// ============================================================================

/**
 * Creates realistic tool configuration fixtures for testing
 */
export const toolConfigFixtures = {
  /**
   * Restrictive filesystem configuration
   */
  restrictiveFilesystem: (): FilesystemToolConfig => ({
    enabled: true,
    timeout: 5000,
    requireConfirmation: true,
    rateLimitPerMinute: 10,
    directoryAccess: {
      allowlist: ['/project/src/**', '/project/tests/**'],
      blocklist: ['/project/node_modules/**', '/project/.git/**'],
      defaultAllow: false,
      resolveSymlinks: true,
      maxDepth: 5,
    },
    maxFileSize: 1024 * 1024, // 1MB
    allowedExtensions: ['.ts', '.js', '.json', '.md'],
    blockedExtensions: ['.exe', '.bin'],
  }),

  /**
   * Permissive shell configuration
   */
  permissiveShell: (): ShellToolConfig => ({
    enabled: true,
    timeout: 30000,
    requireConfirmation: false,
    rateLimitPerMinute: 0,
    directoryAccess: {
      allowlist: [],
      blocklist: ['/system/**', '/root/**'],
      defaultAllow: true,
    },
    allowedCommands: ['npm', 'git', 'node', 'ls', 'cat'],
    blockedCommands: ['rm -rf', 'sudo', 'chmod 777'],
    maxExecutionTime: 60000,
    environmentVariables: {
      NODE_ENV: 'test',
      CI: 'true',
    },
  }),

  /**
   * Limited web configuration
   */
  limitedWeb: (): WebToolConfig => ({
    enabled: true,
    timeout: 10000,
    requireConfirmation: true,
    rateLimitPerMinute: 5,
    allowedDomains: ['api.example.com', 'docs.example.com'],
    blockedDomains: ['malicious.com'],
    maxResponseSize: 1024 * 1024, // 1MB
    followRedirects: true,
    maxRedirects: 3,
    userAgent: 'APEX-Agent/1.0',
  }),

  /**
   * Secure browser configuration
   */
  secureBrowser: (): BrowserToolConfig => ({
    enabled: true,
    timeout: 30000,
    requireConfirmation: true,
    rateLimitPerMinute: 3,
    allowedDomains: ['example.com', '*.example.com'],
    blockedDomains: ['malicious.com', 'tracking.com'],
    headless: true,
    maxPageLoadTime: 15000,
    screenshotOptions: {
      quality: 80,
      format: 'png',
      maxWidth: 1920,
      maxHeight: 1080,
    },
    allowDownloads: false,
    allowPopups: false,
  }),
};

// ============================================================================
// Tool Execution Test Scenarios
// ============================================================================

/**
 * Common tool execution scenarios for testing
 */
export const toolExecutionScenarios = {
  /**
   * Successful filesystem operation
   */
  successfulFileRead: {
    tool: 'Read' as AgentTool,
    args: { filePath: '/project/src/index.ts' },
    expectedResult: { content: 'export const main = () => {}', size: 28 },
    permissions: [permissionFixtures.filesystemAllowAlways('Read', '/project/**')],
  },

  /**
   * Permission denied scenario
   */
  permissionDenied: {
    tool: 'Bash' as AgentTool,
    args: { command: 'rm -rf /' },
    expectedError: new Error('Permission denied: Tool execution not allowed'),
    permissions: [permissionFixtures.shellDenied('Bash', 'rm *')],
  },

  /**
   * Rate limited scenario
   */
  rateLimited: {
    tool: 'WebFetch' as AgentTool,
    args: { url: 'https://api.example.com/data' },
    expectedError: new Error('Rate limit exceeded'),
    permissions: [permissionFixtures.networkAllowOnce('WebFetch')],
    config: { rateLimitPerMinute: 1 },
  },

  /**
   * Timeout scenario
   */
  timeout: {
    tool: 'Browser' as AgentTool,
    args: { url: 'https://slow-site.example.com' },
    expectedError: new Error('Tool execution timeout'),
    permissions: [permissionFixtures.filesystemAllowAlways('Browser')],
    config: { timeout: 1000 },
  },

  /**
   * Complex multi-tool workflow
   */
  multiToolWorkflow: [
    {
      tool: 'Glob' as AgentTool,
      args: { pattern: '**/*.test.ts' },
      expectedResult: { files: ['test1.test.ts', 'test2.test.ts'], totalFiles: 2 },
    },
    {
      tool: 'Read' as AgentTool,
      args: { filePath: 'test1.test.ts' },
      expectedResult: { content: 'describe("test", () => {})', size: 25 },
    },
    {
      tool: 'Bash' as AgentTool,
      args: { command: 'npm test' },
      expectedResult: { stdout: 'All tests passed', stderr: '', exitCode: 0, duration: 5000 },
    },
  ],
};

// ============================================================================
// Integration Test Helpers
// ============================================================================

/**
 * Creates a complete integration test environment for tool testing
 */
export async function createToolTestEnvironment(options: {
  tools?: AgentTool[];
  permissions?: Permission[];
  configs?: Record<string, unknown>;
  mockResponses?: Record<AgentTool, unknown>;
} = {}) {
  const {
    tools = ['Read', 'Write', 'Bash', 'WebFetch'],
    permissions = [],
    configs = {},
    mockResponses = {},
  } = options;

  // Create mock tool registry
  const mockOverrides = Object.entries(mockResponses).reduce((acc, [tool, response]) => {
    acc[tool as AgentTool] = createToolMock(tool as AgentTool, { responseData: response });
    return acc;
  }, {} as Partial<Record<AgentTool, ReturnType<typeof createToolMock>>>);

  const toolRegistry = createMockToolRegistry(mockOverrides);
  const permissionStore = new MockPermissionStore(permissions);

  // Add permissions for enabled tools
  for (const tool of tools) {
    if (!permissions.some(p => p.tool === tool)) {
      await permissionStore.addPermission(
        permissionFixtures.filesystemAllowAlways(tool)
      );
    }
  }

  return {
    toolRegistry,
    permissionStore,
    configs,
    cleanup: () => {
      toolRegistry.resetAllMocks();
      permissionStore.reset();
    },
    executeToolScenario: async (scenario: typeof toolExecutionScenarios[keyof typeof toolExecutionScenarios]) => {
      if (Array.isArray(scenario)) {
        // Multi-tool workflow
        const results = [];
        for (const step of scenario) {
          const toolMock = toolRegistry.getToolMock(step.tool);
          const result = await toolMock.mock(step.args);
          results.push(result);
        }
        return results;
      } else {
        // Single tool execution
        const toolMock = toolRegistry.getToolMock(scenario.tool);
        return await toolMock.mock(scenario.args);
      }
    },
  };
}

/**
 * Assertion helpers for tool testing
 */
export const toolAssertions = {
  /**
   * Assert that a tool was called with specific arguments
   */
  wasCalledWith: (toolMock: ReturnType<typeof createToolMock>, expectedArgs: unknown[]) => {
    const lastCall = toolMock.getLastCall();
    if (!lastCall) {
      throw new Error('Tool was never called');
    }

    expect(lastCall.args).toEqual(expectedArgs);
  },

  /**
   * Assert that a tool was called a specific number of times
   */
  wasCalledTimes: (toolMock: ReturnType<typeof createToolMock>, expectedCount: number) => {
    const actualCount = toolMock.getCallCount();
    if (actualCount !== expectedCount) {
      throw new Error(`Expected ${expectedCount} calls, but got ${actualCount}`);
    }
  },

  /**
   * Assert that permissions were checked properly
   */
  permissionChecked: (permissionStore: MockPermissionStore, tool: string, scope?: string) => {
    // This would be enhanced with actual permission check tracking
    // For now, we just verify the permission exists
    return permissionStore.hasPermission(tool, scope);
  },

  /**
   * Assert tool execution result matches expected format
   */
  resultMatches: (actual: unknown, expected: unknown) => {
    expect(actual).toMatchObject(expected);
  },
};

// Helper function to import expect from vitest
function expect(actual: unknown): any {
  return (global as any).expect(actual);
}