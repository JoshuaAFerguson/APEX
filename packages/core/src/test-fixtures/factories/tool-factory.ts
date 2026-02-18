/**
 * @fileoverview Tool fixture factories
 *
 * Provides factory functions for creating tool-related fixtures including
 * tool results, executions, and invocations.
 */

import type {
  ToolResult,
  ToolExecution,
  ToolInvocation,
  ToolDefinition,
  ToolCategory,
  ToolPermission
} from '../../types.js';
import type { ToolResponseOptions, ToolRequestOptions, FixtureFactory } from '../types.js';

/**
 * Creates a basic ToolResult fixture
 *
 * @param toolName - Name of the tool that was executed
 * @param output - Output data from the tool
 * @param options - Additional configuration options
 * @returns A fully-typed ToolResult object
 *
 * @example
 * ```typescript
 * const result = createToolResult('Read', {
 *   content: 'Hello World',
 *   path: '/test/file.txt'
 * });
 * expect(result.success).toBe(true);
 * expect(result.toolName).toBe('Read');
 * ```
 */
export const createToolResult: FixtureFactory<ToolResult, ToolResponseOptions> = (
  toolName: string,
  output: unknown,
  options: ToolResponseOptions = {}
): ToolResult => {
  const now = new Date();
  const duration = options.duration ?? Math.floor(Math.random() * 1000) + 100;

  return {
    success: options.success ?? true,
    output,
    toolName,
    duration,
    invokedAt: options.timestamps?.invokedAt ?? new Date(now.getTime() - duration),
    completedAt: options.timestamps?.completedAt ?? now,
    metadata: options.metadata,
    error: options.success === false ? 'Tool execution failed' : undefined,
  };
};

/**
 * Creates a successful tool result
 */
export const createSuccessResult: FixtureFactory<ToolResult> = (
  toolName: string,
  output: unknown,
  options: ToolResponseOptions = {}
) => createToolResult(toolName, output, { ...options, success: true });

/**
 * Creates a failed tool result
 */
export const createFailureResult: FixtureFactory<ToolResult> = (
  toolName: string,
  error: string,
  options: ToolResponseOptions = {}
) => createToolResult(toolName, null, {
  ...options,
  success: false,
  metadata: { error, ...options.metadata },
});

/**
 * Creates a ToolExecution fixture
 *
 * @param toolName - Name of the tool being executed
 * @param input - Input parameters for the tool
 * @param options - Additional execution options
 * @returns A ToolExecution object
 */
export const createToolExecution: FixtureFactory<ToolExecution> = (
  toolName: string,
  input: Record<string, unknown> = {},
  overrides: Partial<ToolExecution> = {}
): ToolExecution => {
  const now = new Date();
  const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const duration = Math.floor(Math.random() * 1000) + 100;

  return {
    callId,
    toolName,
    input,
    taskId: `task-${Date.now()}`,
    agentName: 'test-agent',
    stageName: 'test-stage',
    startTime: new Date(now.getTime() - duration),
    endTime: now,
    duration,
    status: 'completed',
    result: {
      success: true,
      output: { message: 'Tool executed successfully' },
    },
    ...overrides,
  };
};

/**
 * Creates a running tool execution
 */
export const createRunningExecution: FixtureFactory<ToolExecution> = (
  toolName: string,
  input: Record<string, unknown> = {}
) => createToolExecution(toolName, input, {
  status: 'running',
  endTime: undefined,
  duration: undefined,
  result: undefined,
});

/**
 * Creates a failed tool execution
 */
export const createFailedExecution: FixtureFactory<ToolExecution> = (
  toolName: string,
  input: Record<string, unknown> = {},
  error: string = 'Tool execution failed'
) => createToolExecution(toolName, input, {
  status: 'failed',
  error,
  result: {
    success: false,
    error,
  },
});

/**
 * Creates a ToolInvocation fixture
 *
 * @param toolName - Name of the tool to invoke
 * @param parameters - Parameters for the tool invocation
 * @param options - Additional request options
 * @returns A ToolInvocation object
 */
export const createToolInvocation: FixtureFactory<ToolInvocation, ToolRequestOptions> = (
  toolName: string,
  parameters: Record<string, unknown> = {},
  options: ToolRequestOptions = {}
): ToolInvocation => ({
  toolName,
  parameters,
  timeout: options.timeout,
  requestId: options.requestId ?? `req-${Date.now()}`,
  context: options.context,
});

/**
 * Creates a ToolDefinition fixture
 */
export const createToolDefinition: FixtureFactory<ToolDefinition> = (
  overrides: Partial<ToolDefinition> = {}
): ToolDefinition => ({
  name: 'TestTool',
  description: 'A test tool for testing purposes',
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input parameter',
      },
    },
    required: ['input'],
    additionalProperties: false,
  },
  dangerous: false,
  permissions: [],
  category: 'custom' as ToolCategory,
  enabled: true,
  version: '1.0.0',
  ...overrides,
});

// ============================================================================
// Preset Collections for Common Tool Scenarios
// ============================================================================

/**
 * File system tool responses
 */
export const FileSystemToolResponses = {
  read: {
    success: () => createSuccessResult('Read', {
      content: 'File content here',
      encoding: 'utf-8',
      size: 17,
    }),
    fileNotFound: () => createFailureResult('Read', 'ENOENT: no such file or directory'),
    permissionDenied: () => createFailureResult('Read', 'EACCES: permission denied'),
    isDirectory: () => createFailureResult('Read', 'EISDIR: illegal operation on a directory'),
  },

  write: {
    success: () => createSuccessResult('Write', {
      written: true,
      path: '/test/file.txt',
      size: 1024,
    }),
    pathTraversal: () => createFailureResult('Write', 'Path traversal detected'),
    diskFull: () => createFailureResult('Write', 'ENOSPC: no space left on device'),
    readOnly: () => createFailureResult('Write', 'EROFS: read-only file system'),
  },

  edit: {
    success: () => createSuccessResult('Edit', {
      edited: true,
      changes: 1,
      linesAdded: 5,
      linesRemoved: 2,
    }),
    stringNotFound: () => createFailureResult('Edit', 'String not found in file'),
    ambiguousReplacement: () => createFailureResult('Edit', 'Multiple matches found, replacement ambiguous'),
    identicalStrings: () => createFailureResult('Edit', 'Old and new strings are identical'),
  },

  glob: {
    success: () => createSuccessResult('Glob', {
      matches: [
        '/test/src/file1.js',
        '/test/src/file2.js',
        '/test/src/utils/helper.js',
      ],
      pattern: '**/*.js',
    }),
    noMatches: () => createSuccessResult('Glob', {
      matches: [],
      pattern: '**/*.nonexistent',
    }),
    invalidPattern: () => createFailureResult('Glob', 'Invalid glob pattern'),
  },

  grep: {
    success: () => createSuccessResult('Grep', {
      matches: [
        { file: '/test/src/app.js', line: 42, content: 'console.log("debug");' },
        { file: '/test/src/utils.js', line: 15, content: '  console.log(result);' },
      ],
      pattern: 'console\\.log',
    }),
    noMatches: () => createSuccessResult('Grep', {
      matches: [],
      pattern: 'nonexistent',
    }),
    invalidRegex: () => createFailureResult('Grep', 'Invalid regular expression'),
  },
} as const;

/**
 * Shell tool responses
 */
export const ShellToolResponses = {
  bash: {
    success: () => createSuccessResult('Bash', {
      stdout: 'Command executed successfully\n',
      stderr: '',
      exitCode: 0,
      command: 'echo "Hello World"',
    }),
    commandNotFound: () => createFailureResult('Bash', 'Command not found: nonexistentcmd'),
    permissionDenied: () => createFailureResult('Bash', 'Permission denied'),
    timeout: () => createFailureResult('Bash', 'Command timed out after 30 seconds'),
    nonZeroExit: () => createSuccessResult('Bash', {
      stdout: '',
      stderr: 'Error: something went wrong\n',
      exitCode: 1,
      command: 'false',
    }),
  },
} as const;

/**
 * Web tool responses
 */
export const WebToolResponses = {
  webFetch: {
    success: () => createSuccessResult('WebFetch', {
      content: '<html><head><title>Test Page</title></head><body><h1>Hello World</h1></body></html>',
      statusCode: 200,
      contentType: 'text/html',
      url: 'https://example.com',
    }),
    notFound: () => createFailureResult('WebFetch', 'HTTP 404: Page not found'),
    timeout: () => createFailureResult('WebFetch', 'Request timeout'),
    networkError: () => createFailureResult('WebFetch', 'Network error: ECONNREFUSED'),
  },

  webSearch: {
    success: () => createSuccessResult('WebSearch', {
      results: [
        {
          title: 'Example Result 1',
          url: 'https://example.com/1',
          snippet: 'This is an example search result...',
        },
        {
          title: 'Example Result 2',
          url: 'https://example.com/2',
          snippet: 'Another example search result...',
        },
      ],
      query: 'test query',
      totalResults: 2,
    }),
    noResults: () => createSuccessResult('WebSearch', {
      results: [],
      query: 'very specific nonexistent query',
      totalResults: 0,
    }),
    quotaExceeded: () => createFailureResult('WebSearch', 'API quota exceeded'),
  },
} as const;

/**
 * All tool response presets combined
 */
export const ToolResponsePresets = {
  filesystem: FileSystemToolResponses,
  shell: ShellToolResponses,
  web: WebToolResponses,
} as const;

/**
 * Tool execution presets for different scenarios
 */
export const ToolExecutionPresets = {
  successful: {
    read: () => createToolExecution('Read', { file_path: '/test/file.txt' }),
    write: () => createToolExecution('Write', { file_path: '/test/output.txt', content: 'test' }),
    bash: () => createToolExecution('Bash', { command: 'ls -la' }),
  },

  failed: {
    read: () => createFailedExecution('Read', { file_path: '/nonexistent' }, 'File not found'),
    write: () => createFailedExecution('Write', { file_path: '/readonly' }, 'Permission denied'),
    bash: () => createFailedExecution('Bash', { command: 'nonexistentcmd' }, 'Command not found'),
  },

  running: {
    read: () => createRunningExecution('Read', { file_path: '/large-file.txt' }),
    write: () => createRunningExecution('Write', { file_path: '/slow-disk/file.txt' }),
    bash: () => createRunningExecution('Bash', { command: 'sleep 10' }),
  },
} as const;

/**
 * Tool invocation presets
 */
export const ToolInvocationPresets = {
  read: () => createToolInvocation('Read', { file_path: '/test/file.txt' }),
  write: () => createToolInvocation('Write', { file_path: '/test/output.txt', content: 'Hello' }),
  edit: () => createToolInvocation('Edit', {
    file_path: '/test/file.txt',
    old_string: 'old text',
    new_string: 'new text',
  }),
  bash: () => createToolInvocation('Bash', { command: 'ls -la' }),
  glob: () => createToolInvocation('Glob', { pattern: '**/*.js' }),
  grep: () => createToolInvocation('Grep', { pattern: 'console\\.log' }),
  webFetch: () => createToolInvocation('WebFetch', { url: 'https://example.com' }),
  webSearch: () => createToolInvocation('WebSearch', { query: 'test search' }),
} as const;