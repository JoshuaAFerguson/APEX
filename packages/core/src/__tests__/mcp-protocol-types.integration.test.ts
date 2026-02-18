import { describe, it, expect } from 'vitest';
import {
  // JSON-RPC base types
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  JsonRpcSuccessResponseSchema,
  JsonRpcErrorResponseSchema,
  type JsonRpcRequest,
  type JsonRpcResponse,

  // MCP protocol types
  MCPInitializeParamsSchema,
  MCPInitializeResultSchema,
  MCPInitializedNotificationParamsSchema,
  MCPToolsListResultSchema,
  MCPToolsCallParamsSchema,
  MCPToolsCallResultSchema,
  MCPResourcesListResultSchema,
  MCPResourcesReadParamsSchema,
  MCPResourcesReadResultSchema,
  MCPPromptsListResultSchema,
  MCPPromptsGetParamsSchema,
  MCPPromptsGetResultSchema,
  MCPLogMessageNotificationParamsSchema,
  MCPCompletionCompleteParamsSchema,
  MCPCompletionCompleteResultSchema,

  // Constants
  MCPProtocolMethod,
  MCPErrorCode,

  // Types
  type MCPInitializeParams,
  type MCPInitializeResult,
  type MCPToolsListResult,
  type MCPToolsCallParams,
  type MCPToolsCallResult,
} from '../mcp/protocol-types.js';

describe('MCP Protocol Types - Integration Scenarios', () => {
  describe('Complete Initialization Handshake', () => {
    it('simulates complete client-server initialization', () => {
      // 1. Client sends initialize request
      const initializeRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'init-1',
        method: MCPProtocolMethod.Initialize,
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
            sampling: {},
          },
          clientInfo: {
            name: 'apex-mcp-client',
            version: '1.0.0',
          },
        },
      };

      expect(() => JsonRpcRequestSchema.parse(initializeRequest)).not.toThrow();
      expect(() => MCPInitializeParamsSchema.parse(initializeRequest.params)).not.toThrow();

      // 2. Server responds with initialize result
      const initializeResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'init-1',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true, listChanged: false },
            prompts: { listChanged: false },
            logging: {},
          },
          serverInfo: {
            name: 'test-mcp-server',
            version: '2.1.0',
          },
          instructions: 'This server provides file system access and code analysis tools.',
        },
      };

      expect(() => JsonRpcResponseSchema.parse(initializeResponse)).not.toThrow();
      if ('result' in initializeResponse) {
        expect(() => MCPInitializeResultSchema.parse(initializeResponse.result)).not.toThrow();
      }

      // 3. Client sends initialized notification
      const initializedNotification = {
        jsonrpc: '2.0',
        method: MCPProtocolMethod.Initialized,
        params: {},
      };

      expect(() => MCPInitializedNotificationParamsSchema.parse(initializedNotification.params)).not.toThrow();
    });
  });

  describe('Complete Tool Discovery and Execution', () => {
    it('simulates tool listing and execution workflow', () => {
      // 1. Client requests tools list
      const toolsListRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'tools-list-1',
        method: MCPProtocolMethod.ToolsList,
        params: { cursor: undefined },
      };

      expect(() => JsonRpcRequestSchema.parse(toolsListRequest)).not.toThrow();

      // 2. Server responds with available tools
      const toolsListResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'tools-list-1',
        result: {
          tools: [
            {
              name: 'file_search',
              description: 'Search for files in the workspace',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' },
                  path: { type: 'string', description: 'Directory to search in' },
                  recursive: { type: 'boolean', description: 'Search recursively' },
                },
                required: ['query'],
              },
            },
            {
              name: 'code_analysis',
              description: 'Analyze code for patterns and issues',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string' },
                  analysis_type: { type: 'string', enum: ['syntax', 'complexity', 'security'] },
                },
                required: ['file_path', 'analysis_type'],
              },
            },
          ],
        },
      };

      expect(() => JsonRpcResponseSchema.parse(toolsListResponse)).not.toThrow();
      if ('result' in toolsListResponse) {
        expect(() => MCPToolsListResultSchema.parse(toolsListResponse.result)).not.toThrow();
      }

      // 3. Client calls a tool
      const toolCallRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'tool-call-1',
        method: MCPProtocolMethod.ToolsCall,
        params: {
          name: 'file_search',
          arguments: {
            query: '*.ts',
            path: '/workspace/src',
            recursive: true,
          },
        },
      };

      expect(() => JsonRpcRequestSchema.parse(toolCallRequest)).not.toThrow();
      expect(() => MCPToolsCallParamsSchema.parse(toolCallRequest.params)).not.toThrow();

      // 4. Server responds with tool results
      const toolCallResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'tool-call-1',
        result: {
          content: [
            {
              type: 'text',
              text: 'Found 42 TypeScript files',
            },
            {
              type: 'resource',
              resource: {
                uri: 'file:///workspace/src/results.json',
                mimeType: 'application/json',
                text: JSON.stringify({
                  files: ['index.ts', 'types.ts', 'utils.ts'],
                  count: 42,
                }),
              },
            },
          ],
          isError: false,
        },
      };

      expect(() => JsonRpcResponseSchema.parse(toolCallResponse)).not.toThrow();
      if ('result' in toolCallResponse) {
        expect(() => MCPToolsCallResultSchema.parse(toolCallResponse.result)).not.toThrow();
      }
    });
  });

  describe('Resource Discovery and Access Workflow', () => {
    it('simulates complete resource access workflow', () => {
      // 1. List available resources
      const resourcesListRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'resources-list-1',
        method: MCPProtocolMethod.ResourcesList,
      };

      const resourcesListResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'resources-list-1',
        result: {
          resources: [
            {
              uri: 'file:///workspace/README.md',
              name: 'Project README',
              description: 'Project documentation',
              mimeType: 'text/markdown',
            },
            {
              uri: 'file:///workspace/package.json',
              name: 'Package Configuration',
              description: 'NPM package configuration',
              mimeType: 'application/json',
            },
          ],
          resourceTemplates: [
            {
              uriTemplate: 'file:///workspace/logs/{date}.log',
              name: 'Daily Logs',
              description: 'Daily application logs',
              mimeType: 'text/plain',
            },
          ],
        },
      };

      expect(() => MCPResourcesListResultSchema.parse(resourcesListResponse.result)).not.toThrow();

      // 2. Read a specific resource
      const resourceReadRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'resource-read-1',
        method: MCPProtocolMethod.ResourcesRead,
        params: {
          uri: 'file:///workspace/package.json',
        },
      };

      expect(() => MCPResourcesReadParamsSchema.parse(resourceReadRequest.params)).not.toThrow();

      const resourceReadResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'resource-read-1',
        result: {
          contents: [
            {
              uri: 'file:///workspace/package.json',
              mimeType: 'application/json',
              text: JSON.stringify({
                name: 'test-project',
                version: '1.0.0',
                dependencies: {
                  '@anthropic-ai/claude-agent-sdk': '^1.0.0',
                },
              }),
            },
          ],
        },
      };

      expect(() => MCPResourcesReadResultSchema.parse(resourceReadResponse.result)).not.toThrow();
    });
  });

  describe('Prompt Discovery and Execution Workflow', () => {
    it('simulates prompt listing and execution', () => {
      // 1. List available prompts
      const promptsListRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'prompts-list-1',
        method: MCPProtocolMethod.PromptsList,
      };

      const promptsListResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'prompts-list-1',
        result: {
          prompts: [
            {
              name: 'code_review',
              description: 'Generate a code review for the given code',
              arguments: [
                {
                  name: 'code',
                  description: 'The code to review',
                  required: true,
                },
                {
                  name: 'language',
                  description: 'Programming language',
                  required: false,
                },
              ],
            },
            {
              name: 'documentation_generator',
              description: 'Generate documentation for code',
              arguments: [
                {
                  name: 'code',
                  description: 'Code to document',
                  required: true,
                },
              ],
            },
          ],
        },
      };

      expect(() => MCPPromptsListResultSchema.parse(promptsListResponse.result)).not.toThrow();

      // 2. Get a prompt with arguments
      const promptGetRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'prompt-get-1',
        method: MCPProtocolMethod.PromptsGet,
        params: {
          name: 'code_review',
          arguments: {
            code: 'function add(a, b) { return a + b; }',
            language: 'javascript',
          },
        },
      };

      expect(() => MCPPromptsGetParamsSchema.parse(promptGetRequest.params)).not.toThrow();

      const promptGetResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'prompt-get-1',
        result: {
          description: 'Code review for JavaScript function',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'Please review this JavaScript code:\n\nfunction add(a, b) { return a + b; }',
              },
            },
          ],
        },
      };

      expect(() => MCPPromptsGetResultSchema.parse(promptGetResponse.result)).not.toThrow();
    });
  });

  describe('Error Handling Scenarios', () => {
    it('handles tool not found error properly', () => {
      const toolCallRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'tool-call-error-1',
        method: MCPProtocolMethod.ToolsCall,
        params: {
          name: 'nonexistent_tool',
        },
      };

      const toolCallErrorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'tool-call-error-1',
        error: {
          code: MCPErrorCode.ToolNotFound,
          message: 'Tool "nonexistent_tool" not found',
          data: {
            toolName: 'nonexistent_tool',
            availableTools: ['file_search', 'code_analysis'],
          },
        },
      };

      expect(() => JsonRpcResponseSchema.parse(toolCallErrorResponse)).not.toThrow();
    });

    it('handles resource not found error', () => {
      const resourceReadRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'resource-read-error-1',
        method: MCPProtocolMethod.ResourcesRead,
        params: {
          uri: 'file:///nonexistent/file.txt',
        },
      };

      const resourceReadErrorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'resource-read-error-1',
        error: {
          code: MCPErrorCode.ResourceNotFound,
          message: 'Resource not found: file:///nonexistent/file.txt',
          data: {
            uri: 'file:///nonexistent/file.txt',
            reason: 'File does not exist',
          },
        },
      };

      expect(() => JsonRpcResponseSchema.parse(resourceReadErrorResponse)).not.toThrow();
    });

    it('handles tool execution error', () => {
      const toolCallErrorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'tool-execution-error-1',
        error: {
          code: MCPErrorCode.ToolExecutionError,
          message: 'Tool execution failed: Permission denied',
          data: {
            toolName: 'file_search',
            stderr: 'Permission denied: /restricted/directory',
            exitCode: 1,
          },
        },
      };

      expect(() => JsonRpcResponseSchema.parse(toolCallErrorResponse)).not.toThrow();
    });
  });

  describe('Logging and Notifications', () => {
    it('handles server log notifications', () => {
      const logNotifications = [
        {
          jsonrpc: '2.0',
          method: MCPProtocolMethod.NotificationMessage,
          params: {
            level: 'info',
            logger: 'mcp-server',
            data: 'Server started successfully',
          },
        },
        {
          jsonrpc: '2.0',
          method: MCPProtocolMethod.NotificationMessage,
          params: {
            level: 'warning',
            logger: 'file-watcher',
            data: {
              message: 'Large file detected',
              file: '/workspace/large-file.bin',
              size: 1024000000,
            },
          },
        },
        {
          jsonrpc: '2.0',
          method: MCPProtocolMethod.NotificationMessage,
          params: {
            level: 'error',
            data: 'Critical error occurred',
          },
        },
      ];

      logNotifications.forEach(notification => {
        expect(() => MCPLogMessageNotificationParamsSchema.parse(notification.params)).not.toThrow();
      });
    });

    it('handles list change notifications', () => {
      const changeNotifications = [
        {
          jsonrpc: '2.0',
          method: MCPProtocolMethod.NotificationToolsListChanged,
        },
        {
          jsonrpc: '2.0',
          method: MCPProtocolMethod.NotificationResourcesListChanged,
        },
        {
          jsonrpc: '2.0',
          method: MCPProtocolMethod.NotificationPromptsListChanged,
        },
      ];

      // These notifications typically have no params
      changeNotifications.forEach(notification => {
        expect(notification.method).toMatch(/notifications\//);
      });
    });
  });

  describe('Completion Scenarios', () => {
    it('handles prompt argument completion', () => {
      const completionRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'completion-1',
        method: MCPProtocolMethod.CompletionComplete,
        params: {
          ref: {
            type: 'ref/prompt',
            name: 'code_review',
          },
          argument: {
            name: 'language',
            value: 'java',
          },
        },
      };

      expect(() => MCPCompletionCompleteParamsSchema.parse(completionRequest.params)).not.toThrow();

      const completionResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'completion-1',
        result: {
          completion: {
            values: ['javascript', 'java', 'python', 'typescript'],
            total: 10,
            hasMore: true,
          },
        },
      };

      expect(() => MCPCompletionCompleteResultSchema.parse(completionResponse.result)).not.toThrow();
    });

    it('handles resource URI completion', () => {
      const completionRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'completion-2',
        method: MCPProtocolMethod.CompletionComplete,
        params: {
          ref: {
            type: 'ref/resource',
            uri: 'file:///workspace/logs/{date}.log',
          },
          argument: {
            name: 'date',
            value: '2024-',
          },
        },
      };

      expect(() => MCPCompletionCompleteParamsSchema.parse(completionRequest.params)).not.toThrow();

      const completionResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'completion-2',
        result: {
          completion: {
            values: ['2024-01-15', '2024-01-16', '2024-01-17'],
            total: 3,
            hasMore: false,
          },
        },
      };

      expect(() => MCPCompletionCompleteResultSchema.parse(completionResponse.result)).not.toThrow();
    });
  });

  describe('Multi-modal Content Scenarios', () => {
    it('handles tool calls with mixed content types', () => {
      const toolCallResult: MCPToolsCallResult = {
        content: [
          {
            type: 'text',
            text: 'Image analysis complete. Found 3 objects:',
          },
          {
            type: 'image',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            mimeType: 'image/png',
          },
          {
            type: 'resource',
            resource: {
              uri: 'file:///analysis/results.json',
              mimeType: 'application/json',
              text: JSON.stringify({
                objects: [
                  { type: 'person', confidence: 0.95, bbox: [10, 20, 100, 200] },
                  { type: 'car', confidence: 0.87, bbox: [150, 50, 300, 180] },
                  { type: 'tree', confidence: 0.92, bbox: [350, 0, 400, 250] },
                ],
              }),
            },
          },
        ],
        isError: false,
      };

      expect(() => MCPToolsCallResultSchema.parse(toolCallResult)).not.toThrow();
    });

    it('handles prompts with multi-modal messages', () => {
      const promptResult = {
        description: 'Multi-modal conversation for image analysis',
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: 'Please analyze this image:',
            },
          },
          {
            role: 'user' as const,
            content: {
              type: 'image' as const,
              data: 'base64encodedimagedata',
              mimeType: 'image/jpeg',
            },
          },
          {
            role: 'assistant' as const,
            content: {
              type: 'text' as const,
              text: 'I can see a landscape with mountains and a lake. The composition follows the rule of thirds...',
            },
          },
          {
            role: 'user' as const,
            content: {
              type: 'resource' as const,
              resource: {
                uri: 'file:///reference/style-guide.pdf',
                mimeType: 'application/pdf',
                text: 'Photography style guide content...',
              },
            },
          },
        ],
      };

      expect(() => MCPPromptsGetResultSchema.parse(promptResult)).not.toThrow();
    });
  });

  describe('Real-world Integration Patterns', () => {
    it('simulates file system server integration', () => {
      // Initialize with file system capabilities
      const fsServerCapabilities = {
        resources: { subscribe: true, listChanged: true },
        tools: { listChanged: false },
      };

      const initResult: MCPInitializeResult = {
        protocolVersion: '2024-11-05',
        capabilities: fsServerCapabilities,
        serverInfo: {
          name: 'filesystem-mcp-server',
          version: '1.2.0',
        },
        instructions: 'Provides read/write access to local filesystem. Use resources for reading, tools for writing.',
      };

      expect(() => MCPInitializeResultSchema.parse(initResult)).not.toThrow();

      // List file resources
      const fileResources = {
        resources: [
          { uri: 'file:///project/src/index.ts', name: 'Main Entry Point' },
          { uri: 'file:///project/package.json', name: 'Package Config' },
          { uri: 'file:///project/README.md', name: 'Documentation' },
        ],
        resourceTemplates: [
          {
            uriTemplate: 'file:///project/{path}',
            name: 'Project Files',
            description: 'Access any file in the project',
          },
        ],
      };

      expect(() => MCPResourcesListResultSchema.parse(fileResources)).not.toThrow();

      // Tool for file operations
      const fileTools: MCPToolsListResult = {
        tools: [
          {
            name: 'write_file',
            description: 'Write content to a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' },
                create_dirs: { type: 'boolean' },
              },
              required: ['path', 'content'],
            },
          },
          {
            name: 'create_directory',
            description: 'Create a directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                recursive: { type: 'boolean' },
              },
              required: ['path'],
            },
          },
        ],
      };

      expect(() => MCPToolsListResultSchema.parse(fileTools)).not.toThrow();
    });

    it('simulates database server integration', () => {
      const dbServerInit: MCPInitializeResult = {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false },
          prompts: { listChanged: true },
          logging: {},
        },
        serverInfo: {
          name: 'database-mcp-server',
          version: '2.0.0',
        },
      };

      const dbTools: MCPToolsListResult = {
        tools: [
          {
            name: 'sql_query',
            description: 'Execute SQL query',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                database: { type: 'string' },
                limit: { type: 'number' },
              },
              required: ['query'],
            },
          },
          {
            name: 'describe_table',
            description: 'Get table schema',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: { type: 'string' },
                database: { type: 'string' },
              },
              required: ['table_name'],
            },
          },
        ],
      };

      expect(() => MCPToolsListResultSchema.parse(dbTools)).not.toThrow();
    });
  });
});