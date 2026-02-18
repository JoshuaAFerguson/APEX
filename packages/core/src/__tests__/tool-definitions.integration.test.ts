import { describe, it, expect } from 'vitest';
import {
  ToolDefinitionSchema,
  ToolInvocationSchema,
  ToolResultSchema,
  ToolRegistryEntrySchema,
  type ToolDefinition,
  type ToolInvocation,
  type ToolResult,
  type ToolRegistryEntry,
} from '../types.js';

describe('Tool Definition Integration Tests', () => {
  // Sample tool definitions representing common APEX tools
  const fileSystemTool: ToolDefinition = {
    name: 'ReadFile',
    description: 'Reads content from a file at the specified path',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute path to the file to read',
        },
        encoding: {
          type: 'string',
          description: 'File encoding to use',
          default: 'utf8',
          enum: ['utf8', 'ascii', 'base64'],
        },
        maxSize: {
          type: 'integer',
          description: 'Maximum file size to read in bytes',
          minimum: 1,
          maximum: 104857600, // 100MB
          default: 10485760, // 10MB
        },
      },
      required: ['filePath'],
    },
    category: 'filesystem',
    permissions: ['read'],
    dangerous: false,
    examples: [
      {
        name: 'Read text file',
        description: 'Read a simple text file',
        input: {
          filePath: '/path/to/document.txt',
          encoding: 'utf8',
        },
        output: {
          success: true,
          content: 'File content here...',
          size: 1024,
        },
      },
    ],
    version: '1.0.0',
    tags: ['io', 'files'],
  };

  const shellTool: ToolDefinition = {
    name: 'ExecuteCommand',
    description: 'Executes a shell command with specified timeout and environment',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
          minLength: 1,
        },
        timeout: {
          type: 'integer',
          description: 'Command timeout in milliseconds',
          minimum: 1000,
          maximum: 300000, // 5 minutes
          default: 30000,
        },
        environment: {
          type: 'object',
          description: 'Environment variables to set',
          properties: {},
          additionalProperties: true,
        },
        workingDirectory: {
          type: 'string',
          description: 'Working directory for command execution',
        },
      },
      required: ['command'],
    },
    category: 'shell',
    permissions: ['execute'],
    dangerous: true,
    examples: [
      {
        name: 'List files',
        description: 'List files in current directory',
        input: {
          command: 'ls -la',
          timeout: 5000,
        },
        output: {
          success: true,
          stdout: 'total 24\ndrwxr-xr-x  3 user user 4096...',
          stderr: '',
          exitCode: 0,
          duration: 245,
        },
      },
    ],
    version: '2.1.0',
    tags: ['shell', 'system'],
  };

  const webTool: ToolDefinition = {
    name: 'WebFetch',
    description: 'Fetches content from a web URL with configurable options',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch',
          pattern: '^https?://.+',
        },
        method: {
          type: 'string',
          description: 'HTTP method to use',
          enum: ['GET', 'POST', 'PUT', 'DELETE'],
          default: 'GET',
        },
        headers: {
          type: 'object',
          description: 'HTTP headers to send',
          properties: {},
          additionalProperties: { type: 'string' },
        },
        body: {
          type: 'string',
          description: 'Request body for POST/PUT requests',
        },
        timeout: {
          type: 'integer',
          description: 'Request timeout in milliseconds',
          minimum: 1000,
          maximum: 60000,
          default: 10000,
        },
      },
      required: ['url'],
    },
    category: 'web',
    permissions: ['network'],
    dangerous: false,
    version: '1.5.2',
    tags: ['http', 'api'],
  };

  describe('Real-world tool definitions validation', () => {
    it('should validate ReadFile tool definition', () => {
      const result = ToolDefinitionSchema.parse(fileSystemTool);
      expect(result.name).toBe('ReadFile');
      expect(result.category).toBe('filesystem');
      expect(result.permissions).toContain('read');
      expect(result.dangerous).toBe(false);
      expect(result.parameters.required).toContain('filePath');
    });

    it('should validate ExecuteCommand tool definition', () => {
      const result = ToolDefinitionSchema.parse(shellTool);
      expect(result.name).toBe('ExecuteCommand');
      expect(result.category).toBe('shell');
      expect(result.permissions).toContain('execute');
      expect(result.dangerous).toBe(true);
      expect(result.examples).toHaveLength(1);
    });

    it('should validate WebFetch tool definition', () => {
      const result = ToolDefinitionSchema.parse(webTool);
      expect(result.name).toBe('WebFetch');
      expect(result.category).toBe('web');
      expect(result.permissions).toContain('network');
      expect(result.parameters.properties.url.pattern).toBeDefined();
    });
  });

  describe('Tool invocation and results workflow', () => {
    it('should handle complete ReadFile workflow', () => {
      // Create tool invocation
      const invocation: ToolInvocation = {
        toolName: 'ReadFile',
        parameters: {
          filePath: '/Users/test/document.txt',
          encoding: 'utf8',
          maxSize: 5242880, // 5MB
        },
        timeout: 15000,
        requestId: 'read-req-001',
        context: {
          taskId: 'file-processing-task',
          agentName: 'fileProcessor',
          stageName: 'data-extraction',
        },
      };

      const parsedInvocation = ToolInvocationSchema.parse(invocation);
      expect(parsedInvocation.toolName).toBe('ReadFile');
      expect(parsedInvocation.parameters.filePath).toBe('/Users/test/document.txt');

      // Simulate successful result
      const successResult: ToolResult = {
        success: true,
        output: {
          content: 'This is the file content...',
          size: 1024,
          encoding: 'utf8',
        },
        duration: 125,
        metadata: {
          filePath: '/Users/test/document.txt',
          lastModified: '2023-01-01T12:00:00Z',
        },
        toolName: 'ReadFile',
        invokedAt: new Date('2023-01-01T10:00:00Z'),
        completedAt: new Date('2023-01-01T10:00:00.125Z'),
      };

      const parsedResult = ToolResultSchema.parse(successResult);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.output.size).toBe(1024);
    });

    it('should handle ExecuteCommand failure workflow', () => {
      // Create potentially dangerous invocation
      const invocation: ToolInvocation = {
        toolName: 'ExecuteCommand',
        parameters: {
          command: 'invalid-command --nonexistent-flag',
          timeout: 5000,
          workingDirectory: '/tmp',
        },
        context: {
          taskId: 'system-check',
          agentName: 'systemMonitor',
        },
      };

      const parsedInvocation = ToolInvocationSchema.parse(invocation);
      expect(parsedInvocation.toolName).toBe('ExecuteCommand');

      // Simulate failure result
      const failureResult: ToolResult = {
        success: false,
        error: 'Command not found: invalid-command',
        output: {
          stdout: '',
          stderr: 'bash: invalid-command: command not found',
          exitCode: 127,
        },
        duration: 50,
        toolName: 'ExecuteCommand',
        invokedAt: new Date('2023-01-01T10:00:00Z'),
        completedAt: new Date('2023-01-01T10:00:00.050Z'),
      };

      const parsedResult = ToolResultSchema.parse(failureResult);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain('Command not found');
    });

    it('should handle WebFetch with complex parameters', () => {
      const invocation: ToolInvocation = {
        toolName: 'WebFetch',
        parameters: {
          url: 'https://api.example.com/data',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token123',
            'User-Agent': 'APEX-Agent/1.0',
          },
          body: JSON.stringify({
            query: 'test data',
            options: { format: 'json', limit: 100 },
          }),
          timeout: 20000,
        },
        requestId: 'web-req-456',
      };

      const parsedInvocation = ToolInvocationSchema.parse(invocation);
      expect(parsedInvocation.parameters.method).toBe('POST');
      expect(parsedInvocation.parameters.headers['Content-Type']).toBe('application/json');

      const successResult: ToolResult = {
        success: true,
        output: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          data: { results: [{ id: 1, name: 'Test' }], count: 1 },
        },
        duration: 1250,
        metadata: {
          url: 'https://api.example.com/data',
          responseTime: 1250,
          contentLength: 85,
        },
      };

      const parsedResult = ToolResultSchema.parse(successResult);
      expect(parsedResult.output.status).toBe(200);
    });
  });

  describe('Tool registry management', () => {
    it('should manage tool registry entries with usage statistics', () => {
      const registryEntry: ToolRegistryEntry = {
        definition: fileSystemTool,
        available: true,
        lastInvoked: new Date('2023-01-01T15:30:00Z'),
        invocationCount: 45,
        successCount: 43,
        failureCount: 2,
      };

      const parsed = ToolRegistryEntrySchema.parse(registryEntry);
      expect(parsed.definition.name).toBe('ReadFile');
      expect(parsed.invocationCount).toBe(45);
      expect(parsed.successCount).toBe(43);
      expect(parsed.failureCount).toBe(2);

      // Calculate success rate
      const successRate = parsed.successCount / parsed.invocationCount;
      expect(successRate).toBeCloseTo(0.956, 3); // ~95.6%
    });

    it('should handle unavailable tool in registry', () => {
      const unavailableEntry: ToolRegistryEntry = {
        definition: shellTool,
        available: false,
        unavailableReason: 'Shell access disabled in container environment',
        lastInvoked: new Date('2023-01-01T10:00:00Z'),
        invocationCount: 120,
        successCount: 115,
        failureCount: 5,
      };

      const parsed = ToolRegistryEntrySchema.parse(unavailableEntry);
      expect(parsed.available).toBe(false);
      expect(parsed.unavailableReason).toBe('Shell access disabled in container environment');
    });

    it('should handle tool with no usage history', () => {
      const newEntry: ToolRegistryEntry = {
        definition: webTool,
        available: true,
      };

      const parsed = ToolRegistryEntrySchema.parse(newEntry);
      expect(parsed.invocationCount).toBe(0);
      expect(parsed.successCount).toBe(0);
      expect(parsed.failureCount).toBe(0);
      expect(parsed.lastInvoked).toBeUndefined();
    });
  });

  describe('Complex parameter validation scenarios', () => {
    it('should validate tool with deeply nested parameter structure', () => {
      const complexTool: ToolDefinition = {
        name: 'DataProcessor',
        description: 'Processes complex data structures with configurable transforms',
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'object',
              properties: {
                source: { type: 'string', enum: ['file', 'url', 'database'] },
                config: {
                  type: 'object',
                  properties: {
                    connection: {
                      type: 'object',
                      properties: {
                        host: { type: 'string' },
                        port: { type: 'integer', minimum: 1, maximum: 65535 },
                        credentials: {
                          type: 'object',
                          properties: {
                            username: { type: 'string' },
                            password: { type: 'string' },
                          },
                          required: ['username'],
                        },
                      },
                      required: ['host'],
                    },
                    options: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          value: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
              required: ['source'],
            },
            transforms: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['filter', 'map', 'reduce'] },
                  expression: { type: 'string' },
                  parameters: { type: 'object', additionalProperties: true },
                },
                required: ['type', 'expression'],
              },
            },
          },
          required: ['input'],
        },
        category: 'custom',
        permissions: ['read', 'write'],
        dangerous: false,
        version: '1.0.0',
      };

      const result = ToolDefinitionSchema.parse(complexTool);
      expect(result.name).toBe('DataProcessor');
      expect(result.parameters.properties.input.properties.source.enum).toContain('database');
    });

    it('should handle complex invocation matching complex tool', () => {
      const complexInvocation: ToolInvocation = {
        toolName: 'DataProcessor',
        parameters: {
          input: {
            source: 'database',
            config: {
              connection: {
                host: 'localhost',
                port: 5432,
                credentials: {
                  username: 'datauser',
                  password: 'secret123',
                },
              },
              options: [
                { name: 'timeout', value: '30000' },
                { name: 'pool_size', value: '10' },
              ],
            },
          },
          transforms: [
            {
              type: 'filter',
              expression: 'status == "active"',
              parameters: { case_sensitive: false },
            },
            {
              type: 'map',
              expression: 'user_id, name, email',
              parameters: { null_values: 'ignore' },
            },
          ],
        },
        timeout: 60000,
        context: {
          taskId: 'data-analysis-001',
          agentName: 'dataAnalyzer',
        },
      };

      const result = ToolInvocationSchema.parse(complexInvocation);
      expect(result.parameters.input.source).toBe('database');
      expect(result.parameters.transforms).toHaveLength(2);
      expect(result.parameters.transforms[0].type).toBe('filter');
    });
  });

  describe('Type compatibility and interoperability', () => {
    it('should ensure tool definitions can be used to create registry entries', () => {
      const tools = [fileSystemTool, shellTool, webTool];
      const registryEntries: ToolRegistryEntry[] = tools.map(tool => ({
        definition: tool,
        available: true,
        invocationCount: 0,
        successCount: 0,
        failureCount: 0,
      }));

      registryEntries.forEach(entry => {
        const parsed = ToolRegistryEntrySchema.parse(entry);
        expect(parsed.definition).toBeDefined();
        expect(parsed.available).toBe(true);
      });

      // Verify we can extract tools by category
      const filesystemTools = registryEntries.filter(
        entry => entry.definition.category === 'filesystem'
      );
      expect(filesystemTools).toHaveLength(1);
      expect(filesystemTools[0].definition.name).toBe('ReadFile');
    });

    it('should handle tool invocations that reference registry tools', () => {
      const toolNames = [fileSystemTool.name, shellTool.name, webTool.name];

      const invocations: ToolInvocation[] = [
        {
          toolName: toolNames[0],
          parameters: { filePath: '/test/file.txt' },
        },
        {
          toolName: toolNames[1],
          parameters: { command: 'echo "test"' },
        },
        {
          toolName: toolNames[2],
          parameters: { url: 'https://example.com' },
        },
      ];

      invocations.forEach((invocation, index) => {
        const parsed = ToolInvocationSchema.parse(invocation);
        expect(parsed.toolName).toBe(toolNames[index]);
      });
    });
  });
});