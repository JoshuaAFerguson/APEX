/**
 * @fileoverview Mock Tool Types Usage Example
 *
 * This file demonstrates how to use the mock tool types for Claude Agent SDK testing.
 * It serves as both documentation and a validation that all types are properly
 * structured and can be used together.
 */

import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  MockToolExecutor,
  MockToolParametersSchema,
  MockToolContentBlock,
  ToolInvocationContext,
  MockToolCategory,
  MockToolExecutorFn
} from './mock-tool-types.js';

/**
 * Example: Creating a simple mock file read tool
 */
export const createMockReadTool = (): MockTool => {
  const parametersSchema: MockToolParametersSchema = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the file to read',
        minLength: 1
      },
      encoding: {
        type: 'string',
        description: 'File encoding',
        default: 'utf-8',
        enum: ['utf-8', 'ascii', 'base64']
      }
    },
    required: ['file_path'],
    additionalProperties: false
  };

  const executeFunction: MockToolExecutorFn = async (params, context) => {
    const filePath = params.file_path as string;
    const encoding = (params.encoding as string) || 'utf-8';

    // Simulate file reading
    if (filePath.includes('nonexistent')) {
      return {
        success: false,
        isError: true,
        content: [{
          type: 'error',
          message: `File not found: ${filePath}`,
          code: 'ENOENT'
        }],
        duration: 5,
        invokedAt: new Date(),
        completedAt: new Date()
      };
    }

    return {
      success: true,
      content: [{
        type: 'text',
        text: `Mock file content from ${filePath} (${encoding})`
      }],
      duration: 12,
      metadata: {
        fileSize: 1024,
        encoding,
        lastModified: '2024-01-01T00:00:00Z'
      },
      invokedAt: new Date(),
      completedAt: new Date()
    };
  };

  return {
    name: 'Read',
    description: 'Read file contents',
    category: 'filesystem',
    parameters: parametersSchema,
    dangerous: false,
    enabled: true,
    version: '1.0.0',
    execute: executeFunction,
    recordInvocations: true,
    maxInvocations: 0, // unlimited
    tags: ['filesystem', 'io'],
    metadata: {
      exampleTool: true,
      author: 'APEX Test Suite'
    }
  };
};

/**
 * Example: Creating a mock tool executor class for more complex behavior
 */
export class MockFileSystemExecutor implements MockToolExecutor {
  private files = new Map<string, string>();
  private invocationCount = 0;

  constructor() {
    // Pre-populate with some test files
    this.files.set('/test/file.txt', 'Hello, World!');
    this.files.set('/test/data.json', '{"key": "value"}');
  }

  async execute(parameters: Record<string, unknown>, context?: ToolInvocationContext): Promise<MockToolResponse> {
    this.invocationCount++;
    const startTime = Date.now();

    try {
      const filePath = parameters.file_path as string;

      if (!filePath) {
        return {
          success: false,
          isError: true,
          content: [{
            type: 'error',
            message: 'file_path parameter is required',
            code: 'MISSING_PARAMETER'
          }],
          duration: Date.now() - startTime
        };
      }

      const content = this.files.get(filePath);
      if (!content) {
        return {
          success: false,
          isError: true,
          content: [{
            type: 'error',
            message: `File not found: ${filePath}`,
            code: 'ENOENT'
          }],
          duration: Date.now() - startTime
        };
      }

      return {
        success: true,
        content: [{
          type: 'text',
          text: content
        }],
        duration: Date.now() - startTime,
        metadata: {
          filePath,
          invocationCount: this.invocationCount,
          taskId: context?.taskId,
          agentName: context?.agentName
        }
      };
    } catch (error) {
      return {
        success: false,
        isError: true,
        content: [{
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'EXECUTION_ERROR'
        }],
        duration: Date.now() - startTime
      };
    }
  }

  reset(): void {
    this.files.clear();
    this.invocationCount = 0;
  }

  // Helper methods for testing
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  getInvocationCount(): number {
    return this.invocationCount;
  }
}

/**
 * Example: Creating tool invocation records for testing
 */
export const createMockToolInvocation = (
  toolName: string = 'Read',
  parameters: Record<string, unknown> = { file_path: '/test/file.txt' },
  context?: Partial<ToolInvocationContext>
): ToolInvocation => {
  const now = new Date();

  return {
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    toolName,
    parameters,
    invokedAt: now,
    context: {
      taskId: `task_${Math.random().toString(36).substr(2, 9)}`,
      agentName: 'developer',
      stageName: 'implementation',
      workingDirectory: '/workspace',
      requestId: `req_${Math.random().toString(36).substr(2, 9)}`,
      ...context
    }
  };
};

/**
 * Example: Various content block types
 */
export const createMockContentBlocks = (): MockToolContentBlock[] => {
  return [
    // Text content
    {
      type: 'text',
      text: 'This is a text response from the tool'
    },

    // Image content
    {
      type: 'image',
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      mimeType: 'image/png'
    },

    // Resource content
    {
      type: 'resource',
      uri: 'file:///path/to/resource.json',
      mimeType: 'application/json',
      text: '{"status": "success"}',
      blob: 'eyJzdGF0dXMiOiAic3VjY2VzcyJ9'
    },

    // Error content
    {
      type: 'error',
      message: 'An error occurred during processing',
      code: 'PROCESSING_ERROR',
      details: {
        timestamp: new Date().toISOString(),
        severity: 'high',
        recoverable: true
      }
    }
  ];
};

/**
 * Example: Full mock tool with response sequence for testing multiple calls
 */
export const createMockToolWithSequence = (): MockTool => {
  const responses: MockToolResponse[] = [
    {
      success: true,
      content: [{ type: 'text', text: 'First call response' }],
      duration: 100
    },
    {
      success: true,
      content: [{ type: 'text', text: 'Second call response' }],
      duration: 150
    },
    {
      success: false,
      isError: true,
      content: [{ type: 'error', message: 'Third call fails', code: 'RATE_LIMIT' }],
      duration: 50
    }
  ];

  return {
    name: 'SequenceTool',
    description: 'Tool that returns different responses for successive calls',
    category: 'custom',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform'
        }
      },
      required: ['action']
    },
    execute: async () => responses[0], // Default response (will be overridden by sequence)
    responseSequence: responses,
    responseDelay: 10, // 10ms delay
    recordInvocations: true,
    maxInvocations: 3,
    tags: ['sequence', 'testing'],
    metadata: {
      testTool: true,
      callPattern: 'success,success,error'
    }
  };
};

/**
 * Type validation examples - these should all compile without errors
 */
export const validateTypes = () => {
  // All these assignments should be type-safe
  const category: MockToolCategory = 'filesystem';
  const tool: MockTool = createMockReadTool();
  const executor: MockToolExecutor = new MockFileSystemExecutor();
  const invocation: ToolInvocation = createMockToolInvocation();
  const contentBlocks: MockToolContentBlock[] = createMockContentBlocks();

  // This should be properly typed
  const response: MockToolResponse = {
    success: true,
    content: contentBlocks,
    duration: 123,
    metadata: { test: true }
  };

  // Context should be properly typed
  const context: ToolInvocationContext = {
    taskId: 'task_123',
    agentName: 'developer',
    stageName: 'implementation',
    workingDirectory: '/workspace',
    requestId: 'req_456'
  };

  return { category, tool, executor, invocation, response, context };
};