import { describe, it, expect } from 'vitest';
import {
  // New v0.5.0 MCP Types
  MCPServerV050Schema,
  type MCPServerV050,
  MCPInstallationV050Schema,
  type MCPInstallationV050,
  MCPInstallProgressV050Schema,
  type MCPInstallProgressV050,

  // Core MCP Types for validation
  MCPConnectionConfigSchema,
  type MCPConnectionConfig,
  MCPEnvironmentVarSchema,
  type MCPEnvironmentVar,
  MCPServerConfigSchema,
  type MCPServerConfig,
  MCPConfigSchema,
  type MCPConfig,

  // Tool Types
  MCPToolSchemaSchema,
  type MCPToolSchema,
  MCPToolSchema as MCPToolDefinitionSchema,
  type MCPTool,
  MCPToolInvocationRequestSchema,
  type MCPToolInvocationRequest,
  MCPToolInvocationResponseSchema,
  type MCPToolInvocationResponse,

  // Connection Management
  MCPConnectionInfoSchema,
  type MCPConnectionInfo,
  MCPConnectionEventSchema,
  type MCPConnectionEvent,

  // Registry Types
  MCPRegistryServerSchema,
  type MCPRegistryServer,
  MCPInstallStageSchema,
  type MCPInstallStage,
  MCPInstallProgressSchema,
  type MCPInstallProgress,
} from '../types';

/**
 * Comprehensive test suite for v0.5.0 MCP types and schemas
 * Validates new types work correctly and maintain compatibility with existing infrastructure
 */
describe('MCP v0.5.0 Comprehensive Type Validation', () => {
  describe('MCPServerV050Schema', () => {
    it('should validate minimal required fields', () => {
      const minimalServer: MCPServerV050 = {
        id: 'test-server-v050',
        name: 'Test Server v0.5.0',
        description: 'A test server for v0.5.0 validation',
        version: '0.5.0',
        author: 'Test Author',
        tools: [],
      };

      const result = MCPServerV050Schema.parse(minimalServer);
      expect(result).toEqual(minimalServer);
      expect(result.categories).toEqual([]); // Default empty array
    });

    it('should validate full server configuration with all fields', () => {
      const fullServer: MCPServerV050 = {
        id: 'comprehensive-server-v050',
        name: 'Comprehensive Server v0.5.0',
        description: 'A comprehensive server with all features for v0.5.0',
        version: '0.5.0',
        author: 'Comprehensive Author',
        license: 'MIT',
        homepage: 'https://example.com',
        repository: 'https://github.com/example/server',
        keywords: ['mcp', 'server', 'test'],
        tools: ['file-operations', 'database-queries'],
        categories: ['development', 'productivity'],
        readme: 'This is a comprehensive test server for v0.5.0',
        changelog: 'v0.5.0: Initial release',
      };

      const result = MCPServerV050Schema.parse(fullServer);
      expect(result).toEqual(fullServer);
    });

    it('should validate with valid categories', () => {
      const validCategories = [
        'development',
        'productivity',
        'communication',
        'database',
        'filesystem',
        'web',
        'ai-ml',
        'security',
        'monitoring',
        'other',
      ];

      validCategories.forEach(category => {
        const server = {
          id: `test-${category}`,
          name: `Test ${category} Server`,
          description: `Server for ${category}`,
          version: '0.5.0',
          author: 'Test',
          tools: [],
          categories: [category],
        };

        expect(() => MCPServerV050Schema.parse(server)).not.toThrow();
      });
    });

    it('should reject invalid data', () => {
      const invalidServers = [
        { // Missing required fields
          id: 'test',
        },
        { // Invalid category
          id: 'test',
          name: 'Test',
          description: 'Test',
          version: '1.0.0',
          author: 'Test',
          tools: [],
          categories: ['invalid-category'],
        },
        { // Empty required strings
          id: '',
          name: 'Test',
          description: 'Test',
          version: '1.0.0',
          author: 'Test',
          tools: [],
        },
      ];

      invalidServers.forEach(server => {
        expect(() => MCPServerV050Schema.parse(server)).toThrow();
      });
    });
  });

  describe('MCPInstallationV050Schema', () => {
    it('should validate minimal installation data', () => {
      const minimalInstallation: MCPInstallationV050 = {
        serverId: 'test-server',
        installedAt: new Date('2024-01-15T10:00:00Z'),
        config: {
          name: 'test-server',
          command: 'node',
          args: ['server.js'],
        },
        status: 'installed',
      };

      const result = MCPInstallationV050Schema.parse(minimalInstallation);
      expect(result.serverId).toBe('test-server');
      expect(result.status).toBe('installed');
      expect(result.config.name).toBe('test-server');
    });

    it('should validate all installation statuses', () => {
      const validStatuses = ['pending', 'installing', 'installed', 'failed', 'uninstalling', 'uninstalled'];

      validStatuses.forEach(status => {
        const installation = {
          serverId: 'test-server',
          installedAt: new Date(),
          config: {
            name: 'test-server',
            command: 'node',
            args: ['server.js'],
          },
          status,
        };

        const result = MCPInstallationV050Schema.parse(installation);
        expect(result.status).toBe(status);
      });
    });

    it('should reject invalid installation data', () => {
      const invalidInstallations = [
        { // Missing required fields
          serverId: 'test',
        },
        { // Invalid status
          serverId: 'test',
          installedAt: new Date(),
          config: { name: 'test', command: 'node' },
          status: 'invalid-status',
        },
      ];

      invalidInstallations.forEach(installation => {
        expect(() => MCPInstallationV050Schema.parse(installation)).toThrow();
      });
    });
  });

  describe('MCPInstallProgressV050Schema', () => {
    it('should validate progress data', () => {
      const progressData: MCPInstallProgressV050 = {
        serverId: 'test-server',
        stage: 'downloading',
        progress: 50,
        message: 'Downloading server package...',
      };

      const result = MCPInstallProgressV050Schema.parse(progressData);
      expect(result.serverId).toBe('test-server');
      expect(result.stage).toBe('downloading');
      expect(result.progress).toBe(50);
    });

    it('should validate all install stages', () => {
      const validStages = ['preparing', 'downloading', 'extracting', 'installing', 'configuring', 'testing', 'complete'];

      validStages.forEach(stage => {
        const progress = {
          serverId: 'test-server',
          stage,
          progress: 25,
          message: `Stage: ${stage}`,
        };

        const result = MCPInstallProgressV050Schema.parse(progress);
        expect(result.stage).toBe(stage);
      });
    });

    it('should handle optional fields correctly', () => {
      const minimalProgress = {
        serverId: 'test-server',
        stage: 'preparing' as const,
      };

      const result = MCPInstallProgressV050Schema.parse(minimalProgress);
      expect(result.serverId).toBe('test-server');
      expect(result.stage).toBe('preparing');
      expect(result.progress).toBeUndefined();
      expect(result.message).toBeUndefined();
    });
  });

  describe('Integration with existing MCP infrastructure', () => {
    it('should work with MCPConnectionConfig', () => {
      const connectionConfig: MCPConnectionConfig = {
        maxRetries: 5,
        retryDelayMs: 2000,
        timeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        maxBufferSize: 1048576,
      };

      const result = MCPConnectionConfigSchema.parse(connectionConfig);
      expect(result.maxRetries).toBe(5);
      expect(result.retryDelayMs).toBe(2000);
    });

    it('should work with MCPEnvironmentVar', () => {
      const envVar: MCPEnvironmentVar = {
        name: 'MCP_SERVER_PORT',
        value: '3000',
        description: 'Port for MCP server',
        required: true,
        sensitive: false,
        defaultValue: '8080',
      };

      const result = MCPEnvironmentVarSchema.parse(envVar);
      expect(result.name).toBe('MCP_SERVER_PORT');
      expect(result.required).toBe(true);
    });

    it('should integrate with MCPServerConfig', () => {
      const serverConfig: MCPServerConfig = {
        name: 'test-server-v050',
        command: 'npx',
        args: ['@test/mcp-server-v050', '--port', '3000'],
        env: { NODE_ENV: 'production' },
        cwd: '/app',
        envVars: [
          {
            name: 'API_KEY',
            value: 'secret',
            description: 'API key for external service',
            sensitive: true,
          },
        ],
        connection: {
          maxRetries: 3,
          retryDelayMs: 1000,
          timeoutMs: 30000,
        },
      };

      const result = MCPServerConfigSchema.parse(serverConfig);
      expect(result.name).toBe('test-server-v050');
      expect(result.envVars).toHaveLength(1);
      expect(result.connection?.maxRetries).toBe(3);
    });
  });

  describe('Tool integration tests', () => {
    it('should validate MCP tool schemas', () => {
      const toolSchema: MCPToolSchema = {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file to read',
          },
          encoding: {
            type: 'string',
            enum: ['utf8', 'base64'],
            default: 'utf8',
          },
        },
        required: ['file_path'],
        additionalProperties: false,
      };

      const result = MCPToolSchemaSchema.parse(toolSchema);
      expect(result.type).toBe('object');
      expect(result.properties?.file_path).toBeDefined();
    });

    it('should validate MCP tool definitions', () => {
      const toolDefinition: MCPTool = {
        name: 'read_file',
        description: 'Read contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
        serverId: 'filesystem-server',
        serverName: 'Filesystem Server',
        outputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
          },
        },
        capabilities: {
          streaming: false,
          cancellable: true,
        },
      };

      const result = MCPToolDefinitionSchema.parse(toolDefinition);
      expect(result.name).toBe('read_file');
      expect(result.serverId).toBe('filesystem-server');
    });

    it('should handle tool invocation flow', () => {
      const invocationRequest: MCPToolInvocationRequest = {
        id: 'req-123',
        toolName: 'read_file',
        serverId: 'filesystem-server',
        arguments: {
          path: '/home/user/document.txt',
          encoding: 'utf8',
        },
        metadata: {
          requestId: 'client-req-456',
          timestamp: '2024-01-15T10:00:00Z',
        },
      };

      const parsedRequest = MCPToolInvocationRequestSchema.parse(invocationRequest);
      expect(parsedRequest.toolName).toBe('read_file');

      const invocationResponse: MCPToolInvocationResponse = {
        id: 'resp-123',
        success: true,
        toolName: 'read_file',
        serverId: 'filesystem-server',
        content: [
          {
            type: 'text',
            text: 'File contents here...',
          },
        ],
        metadata: {
          executionTimeMs: 15,
          resourceUsage: { memory: 1024, cpu: 0.1 },
        },
      };

      const parsedResponse = MCPToolInvocationResponseSchema.parse(invocationResponse);
      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.content).toHaveLength(1);
    });
  });

  describe('Connection management integration', () => {
    it('should integrate with connection info tracking', () => {
      const connectionInfo: MCPConnectionInfo = {
        id: 'conn-v050-test',
        serverId: 'test-server-v050',
        config: {
          name: 'test-server-v050',
          command: 'node',
          args: ['server.js'],
        },
        state: 'connected',
        connectedAt: new Date('2024-01-15T10:00:00Z'),
        lastHeartbeat: new Date('2024-01-15T10:05:00Z'),
        capabilities: {
          tools: ['read_file', 'write_file'],
          resources: ['file://'],
          prompts: [],
        },
        metadata: {
          version: '0.5.0',
          serverInfo: { name: 'test-server-v050', version: '1.0.0' },
        },
      };

      const result = MCPConnectionInfoSchema.parse(connectionInfo);
      expect(result.serverId).toBe('test-server-v050');
      expect(result.state).toBe('connected');
    });

    it('should handle connection events', () => {
      const connectionEvent: MCPConnectionEvent = {
        type: 'connected',
        serverId: 'test-server-v050',
        previousState: 'connecting',
        newState: 'connected',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        metadata: {
          connectionId: 'conn-123',
          attemptNumber: 1,
        },
      };

      const result = MCPConnectionEventSchema.parse(connectionEvent);
      expect(result.type).toBe('connected');
      expect(result.newState).toBe('connected');
    });
  });

  describe('Registry integration tests', () => {
    it('should integrate with registry server definitions', () => {
      const registryServer: MCPRegistryServer = {
        id: 'filesystem-v050',
        name: 'Filesystem Server v0.5.0',
        description: 'Enhanced filesystem operations for v0.5.0',
        package: '@modelcontextprotocol/server-filesystem',
        version: '0.5.0',
        author: 'ModelContext Protocol Team',
        license: 'MIT',
        homepage: 'https://github.com/modelcontextprotocol/servers/filesystem',
        keywords: ['filesystem', 'files', 'mcp'],
        tools: ['read_file', 'write_file', 'list_directory'],
        categories: ['filesystem', 'development'],
        installConfig: {
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        },
        documentation: {
          readme: 'Filesystem server documentation...',
          examples: ['Basic file operations', 'Directory listing'],
        },
      };

      const result = MCPRegistryServerSchema.parse(registryServer);
      expect(result.id).toBe('filesystem-v050');
      expect(result.version).toBe('0.5.0');
      expect(result.tools).toContain('read_file');
    });

    it('should validate install progress tracking', () => {
      const installProgress: MCPInstallProgress = {
        serverId: 'filesystem-v050',
        stage: 'downloading',
        progress: 75,
        message: 'Downloading @modelcontextprotocol/server-filesystem@0.5.0',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        metadata: {
          packageSize: 1048576,
          downloadSpeed: 102400,
        },
      };

      const result = MCPInstallProgressSchema.parse(installProgress);
      expect(result.serverId).toBe('filesystem-v050');
      expect(result.progress).toBe(75);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty arrays gracefully', () => {
      const serverWithEmptyArrays = {
        id: 'empty-arrays-test',
        name: 'Empty Arrays Test',
        description: 'Testing empty arrays',
        version: '1.0.0',
        author: 'Test',
        tools: [], // Empty tools array
        categories: [], // Empty categories array
        keywords: [], // Empty keywords array
      };

      const result = MCPServerV050Schema.parse(serverWithEmptyArrays);
      expect(result.tools).toEqual([]);
      expect(result.categories).toEqual([]);
      expect(result.keywords).toEqual([]);
    });

    it('should handle special characters in string fields', () => {
      const serverWithSpecialChars = {
        id: 'special-chars-test',
        name: 'Test Server with émojis 🚀 and spéçial chars!',
        description: 'Testing spëcial characters: àáâãäåæçèéêë & symbols @#$%',
        version: '1.0.0',
        author: 'Tëst Authör 👤',
        tools: [],
      };

      const result = MCPServerV050Schema.parse(serverWithSpecialChars);
      expect(result.name).toContain('émojis 🚀');
      expect(result.description).toContain('spëcial');
    });

    it('should validate progress bounds', () => {
      const validProgressValues = [0, 25, 50, 75, 100];
      const invalidProgressValues = [-1, 101, 150, -50];

      // Valid progress values should work
      validProgressValues.forEach(progress => {
        const progressData = {
          serverId: 'test',
          stage: 'downloading' as const,
          progress,
        };
        expect(() => MCPInstallProgressV050Schema.parse(progressData)).not.toThrow();
      });

      // Invalid progress values should be rejected
      invalidProgressValues.forEach(progress => {
        const progressData = {
          serverId: 'test',
          stage: 'downloading' as const,
          progress,
        };
        expect(() => MCPInstallProgressV050Schema.parse(progressData)).toThrow();
      });
    });

    it('should validate date handling in different formats', () => {
      const testDates = [
        new Date(), // Current date
        new Date('2024-01-15T10:00:00Z'), // ISO string
        new Date(0), // Unix epoch
        new Date('2024-12-31T23:59:59Z'), // Year end
      ];

      testDates.forEach(date => {
        const installation = {
          serverId: 'date-test',
          installedAt: date,
          config: {
            name: 'test',
            command: 'node',
          },
          status: 'installed' as const,
        };

        const result = MCPInstallationV050Schema.parse(installation);
        expect(result.installedAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('Type safety and TypeScript integration', () => {
    it('should provide proper TypeScript type inference', () => {
      const server = MCPServerV050Schema.parse({
        id: 'type-test',
        name: 'Type Test Server',
        description: 'Testing TypeScript types',
        version: '1.0.0',
        author: 'Test Author',
        tools: ['test-tool'],
        categories: ['development'],
      });

      // These should compile without TypeScript errors
      const id: string = server.id;
      const name: string = server.name;
      const tools: string[] = server.tools;
      const categories: ('development' | 'productivity' | 'communication' | 'database' | 'filesystem' | 'web' | 'ai-ml' | 'security' | 'monitoring' | 'other')[] = server.categories;

      expect(typeof id).toBe('string');
      expect(typeof name).toBe('string');
      expect(Array.isArray(tools)).toBe(true);
      expect(Array.isArray(categories)).toBe(true);
    });

    it('should maintain type compatibility across schemas', () => {
      // Create a server
      const serverData = {
        id: 'compatibility-test',
        name: 'Compatibility Test',
        description: 'Testing cross-schema compatibility',
        version: '1.0.0',
        author: 'Test',
        tools: [],
      };
      const server = MCPServerV050Schema.parse(serverData);

      // Create an installation that references the server
      const installationData = {
        serverId: server.id, // Should be type-compatible
        installedAt: new Date(),
        config: {
          name: server.name,
          command: 'node',
        },
        status: 'installed' as const,
      };
      const installation = MCPInstallationV050Schema.parse(installationData);

      expect(installation.serverId).toBe(server.id);
      expect(installation.config.name).toBe(server.name);
    });
  });
});