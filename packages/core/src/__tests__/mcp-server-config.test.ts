import { describe, it, expect } from 'vitest';
import {
  MCPServerConfigSchema,
  MCPServerConfig,
  MCPEnvironmentVarSchema,
  MCPConnectionConfigSchema,
} from '../types.js';

/**
 * Comprehensive test suite for MCPServerConfig schema
 * Tests validation, edge cases, and TypeScript type inference for MCP server configuration
 *
 * MCPServerConfig defines how to connect to and configure an individual MCP server,
 * including connection types, commands, environment variables, and connection settings.
 */
describe('MCPServerConfig Schema Tests', () => {
  describe('Valid configurations', () => {
    it('should accept minimal required configuration with defaults', () => {
      const minimalConfig = {
        name: 'minimal-server',
      };

      const result = MCPServerConfigSchema.parse(minimalConfig);

      expect(result.name).toBe('minimal-server');
      expect(result.type).toBe('stdio'); // Default value
      expect(result.command).toBeUndefined();
      expect(result.args).toBeUndefined();
      expect(result.env).toBeUndefined();
      expect(result.envVars).toBeUndefined();
      expect(result.url).toBeUndefined();
      expect(result.headers).toBeUndefined();
      expect(result.autoStart).toBe(false); // Default value
      expect(result.capabilities).toBeUndefined();
      expect(result.connection).toBeUndefined();
    });

    it('should accept complete stdio server configuration', () => {
      const stdioConfig = {
        name: 'complete-stdio-server',
        type: 'stdio' as const,
        command: 'npx',
        args: ['@mcp/filesystem-server', '--verbose', '--config', '/path/to/config.json'],
        env: {
          'NODE_ENV': 'production',
          'LOG_LEVEL': 'info',
          'WORKSPACE_PATH': '/workspace',
        },
        envVars: [
          {
            name: 'API_KEY',
            description: 'API key for external service',
            required: true,
            sensitive: true,
            source: 'user' as const,
          },
          {
            name: 'PORT',
            description: 'Server port number',
            required: false,
            sensitive: false,
            defaultValue: '3000',
            source: 'default' as const,
          },
        ],
        autoStart: true,
        capabilities: ['filesystem', 'search', 'edit'],
        connection: {
          maxRetries: 5,
          timeoutMs: 45000,
          poolSize: 2,
          healthCheckIntervalMs: 60000,
        },
      };

      const result = MCPServerConfigSchema.parse(stdioConfig);

      expect(result.name).toBe('complete-stdio-server');
      expect(result.type).toBe('stdio');
      expect(result.command).toBe('npx');
      expect(result.args).toEqual(['@mcp/filesystem-server', '--verbose', '--config', '/path/to/config.json']);
      expect(result.env).toEqual({
        'NODE_ENV': 'production',
        'LOG_LEVEL': 'info',
        'WORKSPACE_PATH': '/workspace',
      });
      expect(result.envVars).toHaveLength(2);
      expect(result.envVars![0].name).toBe('API_KEY');
      expect(result.envVars![1].name).toBe('PORT');
      expect(result.autoStart).toBe(true);
      expect(result.capabilities).toEqual(['filesystem', 'search', 'edit']);
      expect(result.connection?.maxRetries).toBe(5);
    });

    it('should accept complete http server configuration', () => {
      const httpConfig = {
        name: 'complete-http-server',
        type: 'http' as const,
        url: 'https://api.example.com/mcp',
        headers: {
          'Authorization': 'Bearer secret-token',
          'Content-Type': 'application/json',
          'X-API-Version': 'v2',
          'User-Agent': 'APEX-MCP-Client/1.0',
        },
        envVars: [
          {
            name: 'AUTH_TOKEN',
            description: 'Authentication token for API',
            required: true,
            sensitive: true,
            source: 'env' as const,
          },
        ],
        autoStart: true,
        capabilities: ['api', 'network', 'data'],
        connection: {
          maxRetries: 3,
          timeoutMs: 30000,
          poolSize: 1,
        },
      };

      const result = MCPServerConfigSchema.parse(httpConfig);

      expect(result.name).toBe('complete-http-server');
      expect(result.type).toBe('http');
      expect(result.url).toBe('https://api.example.com/mcp');
      expect(result.headers).toEqual({
        'Authorization': 'Bearer secret-token',
        'Content-Type': 'application/json',
        'X-API-Version': 'v2',
        'User-Agent': 'APEX-MCP-Client/1.0',
      });
      expect(result.envVars).toHaveLength(1);
      expect(result.autoStart).toBe(true);
      expect(result.capabilities).toEqual(['api', 'network', 'data']);
    });

    it('should accept complete sse server configuration', () => {
      const sseConfig = {
        name: 'complete-sse-server',
        type: 'sse' as const,
        url: 'https://events.example.com/mcp/stream',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Stream-ID': 'mcp-stream-001',
        },
        autoStart: false,
        capabilities: ['events', 'realtime', 'streaming'],
        connection: {
          maxRetries: 10,
          timeoutMs: 120000,
          poolSize: 1,
          healthCheckIntervalMs: 30000,
          heartbeatEnabled: true,
        },
      };

      const result = MCPServerConfigSchema.parse(sseConfig);

      expect(result.name).toBe('complete-sse-server');
      expect(result.type).toBe('sse');
      expect(result.url).toBe('https://events.example.com/mcp/stream');
      expect(result.headers!['Accept']).toBe('text/event-stream');
      expect(result.autoStart).toBe(false);
      expect(result.capabilities).toEqual(['events', 'realtime', 'streaming']);
      expect(result.connection?.heartbeatEnabled).toBe(true);
    });

    it('should accept complete sdk server configuration', () => {
      const sdkConfig = {
        name: 'complete-sdk-server',
        type: 'sdk' as const,
        envVars: [
          {
            name: 'SDK_CONFIG_PATH',
            description: 'Path to SDK configuration file',
            required: true,
            sensitive: false,
            defaultValue: '/etc/mcp/sdk.json',
            source: 'config' as const,
          },
        ],
        autoStart: true,
        capabilities: ['direct', 'sdk', 'embedded'],
        connection: {
          maxRetries: 0, // No retries for direct SDK
          timeoutMs: 5000,
          poolSize: 1,
        },
      };

      const result = MCPServerConfigSchema.parse(sdkConfig);

      expect(result.name).toBe('complete-sdk-server');
      expect(result.type).toBe('sdk');
      expect(result.envVars).toHaveLength(1);
      expect(result.autoStart).toBe(true);
      expect(result.capabilities).toEqual(['direct', 'sdk', 'embedded']);
      expect(result.connection?.maxRetries).toBe(0);
    });

    it('should handle all valid server types', () => {
      const serverTypes = ['stdio', 'http', 'sse', 'sdk'] as const;

      serverTypes.forEach(type => {
        const config = {
          name: `${type}-test-server`,
          type,
          autoStart: false,
        };

        expect(() => MCPServerConfigSchema.parse(config)).not.toThrow();
        const result = MCPServerConfigSchema.parse(config);
        expect(result.type).toBe(type);
      });
    });

    it('should handle various command and args combinations for stdio servers', () => {
      const commandConfigs = [
        {
          command: 'node',
          args: undefined,
        },
        {
          command: 'node',
          args: [],
        },
        {
          command: 'node',
          args: ['server.js'],
        },
        {
          command: 'npx',
          args: ['@mcp/test-server', '--config', '/path/config.json', '--verbose'],
        },
        {
          command: 'python3',
          args: ['-m', 'mcp_server', '--port', '8080'],
        },
        {
          command: '/usr/local/bin/custom-mcp-server',
          args: ['--workspace', '/workspace', '--log-level', 'debug'],
        },
      ];

      commandConfigs.forEach((cmdConfig, index) => {
        const config = {
          name: `command-test-${index}`,
          type: 'stdio' as const,
          command: cmdConfig.command,
          args: cmdConfig.args,
          autoStart: false,
        };

        expect(() => MCPServerConfigSchema.parse(config)).not.toThrow();
        const result = MCPServerConfigSchema.parse(config);
        expect(result.command).toBe(cmdConfig.command);
        expect(result.args).toEqual(cmdConfig.args);
      });
    });

    it('should handle various URL formats for http/sse servers', () => {
      const urlFormats = [
        'http://localhost:3000',
        'https://api.example.com',
        'http://192.168.1.100:8080/mcp',
        'https://secure.api.company.com/v2/mcp',
        'http://mcp-server.local:5000/endpoint',
        'https://events.service.org/stream?format=mcp',
      ];

      urlFormats.forEach(url => {
        const config = {
          name: 'url-test-server',
          type: 'http' as const,
          url,
          autoStart: false,
        };

        expect(() => MCPServerConfigSchema.parse(config)).not.toThrow();
        const result = MCPServerConfigSchema.parse(config);
        expect(result.url).toBe(url);
      });
    });

    it('should handle various environment variable configurations', () => {
      const envConfigs = [
        {},
        { 'NODE_ENV': 'development' },
        {
          'NODE_ENV': 'production',
          'PORT': '3000',
          'LOG_LEVEL': 'info',
        },
        {
          'API_KEY': 'secret-key-value',
          'DATABASE_URL': 'postgresql://localhost:5432/mydb',
          'REDIS_URL': 'redis://localhost:6379',
          'WORKSPACE_DIR': '/workspace',
          'CONFIG_FILE': '/etc/app/config.json',
        },
      ];

      envConfigs.forEach((env, index) => {
        const config = {
          name: `env-test-${index}`,
          type: 'stdio' as const,
          command: 'node',
          env,
          autoStart: false,
        };

        expect(() => MCPServerConfigSchema.parse(config)).not.toThrow();
        const result = MCPServerConfigSchema.parse(config);
        expect(result.env).toEqual(env);
      });
    });

    it('should handle various header configurations for http/sse servers', () => {
      const headerConfigs = [
        {},
        { 'Authorization': 'Bearer token' },
        {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        {
          'Authorization': 'Bearer secret-token',
          'X-API-Key': 'api-key-value',
          'X-Client-Version': '1.0.0',
          'User-Agent': 'APEX-MCP-Client',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      ];

      headerConfigs.forEach((headers, index) => {
        const config = {
          name: `header-test-${index}`,
          type: 'http' as const,
          url: 'https://api.example.com',
          headers,
          autoStart: false,
        };

        expect(() => MCPServerConfigSchema.parse(config)).not.toThrow();
        const result = MCPServerConfigSchema.parse(config);
        expect(result.headers).toEqual(headers);
      });
    });

    it('should handle various capability configurations', () => {
      const capabilityConfigs = [
        [],
        ['filesystem'],
        ['api', 'network'],
        ['filesystem', 'search', 'edit', 'create', 'delete'],
        ['api', 'network', 'database', 'cache', 'messaging', 'auth'],
      ];

      capabilityConfigs.forEach((capabilities, index) => {
        const config = {
          name: `capability-test-${index}`,
          type: 'stdio' as const,
          command: 'node',
          capabilities,
          autoStart: false,
        };

        expect(() => MCPServerConfigSchema.parse(config)).not.toThrow();
        const result = MCPServerConfigSchema.parse(config);
        expect(result.capabilities).toEqual(capabilities);
      });
    });
  });

  describe('Validation errors', () => {
    it('should reject empty or invalid name', () => {
      const invalidNames = [
        '',
        '   ',
        '\t',
        '\n',
        null,
        undefined,
        123,
        {},
        [],
        true,
        false,
      ];

      invalidNames.forEach(name => {
        const config = { name };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid server types', () => {
      const invalidTypes = [
        'tcp',
        'websocket',
        'grpc',
        'invalid',
        '',
        123,
        {},
        [],
        null,
        undefined,
        true,
        false,
      ];

      invalidTypes.forEach(type => {
        const config = {
          name: 'test-server',
          type,
          autoStart: false,
        };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid command values', () => {
      const invalidCommands = [
        '',
        '   ',
        123,
        {},
        [],
        null,
        true,
        false,
      ];

      invalidCommands.forEach(command => {
        const config = {
          name: 'test-server',
          type: 'stdio' as const,
          command,
          autoStart: false,
        };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid args values', () => {
      const invalidArgs = [
        'string-not-array',
        123,
        {},
        null,
        true,
        false,
        ['valid', 123, 'invalid'], // Mixed types
        [{}], // Objects in array
        [null], // Null in array
      ];

      invalidArgs.forEach(args => {
        const config = {
          name: 'test-server',
          type: 'stdio' as const,
          command: 'node',
          args,
          autoStart: false,
        };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid env values', () => {
      const invalidEnvs = [
        'string-not-object',
        123,
        [],
        null,
        true,
        false,
        { 'VALID_KEY': 'valid', 'INVALID_KEY': 123 }, // Non-string value
        { 'VALID_KEY': 'valid', 'INVALID_KEY': {} }, // Object value
      ];

      invalidEnvs.forEach(env => {
        const config = {
          name: 'test-server',
          type: 'stdio' as const,
          command: 'node',
          env,
          autoStart: false,
        };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid envVars values', () => {
      const invalidEnvVars = [
        'string-not-array',
        123,
        {},
        null,
        true,
        false,
        [{ name: 'VALID' }, { /* missing name */ description: 'Invalid' }], // Invalid envVar object
        [123], // Non-object in array
      ];

      invalidEnvVars.forEach(envVars => {
        const config = {
          name: 'test-server',
          type: 'stdio' as const,
          command: 'node',
          envVars,
          autoStart: false,
        };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid URL values', () => {
      const invalidUrls = [
        '',
        '   ',
        123,
        {},
        [],
        null,
        true,
        false,
      ];

      invalidUrls.forEach(url => {
        const config = {
          name: 'test-server',
          type: 'http' as const,
          url,
          autoStart: false,
        };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid headers values', () => {
      const invalidHeaders = [
        'string-not-object',
        123,
        [],
        null,
        true,
        false,
        { 'Valid-Header': 'valid', 'Invalid-Header': 123 }, // Non-string value
        { 'Valid-Header': 'valid', 'Invalid-Header': {} }, // Object value
      ];

      invalidHeaders.forEach(headers => {
        const config = {
          name: 'test-server',
          type: 'http' as const,
          url: 'https://api.example.com',
          headers,
          autoStart: false,
        };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid autoStart values', () => {
      const invalidAutoStarts = [
        'true',
        'false',
        1,
        0,
        {},
        [],
        null,
        'yes',
        'no',
      ];

      invalidAutoStarts.forEach(autoStart => {
        const config = {
          name: 'test-server',
          type: 'stdio' as const,
          command: 'node',
          autoStart,
        };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid capabilities values', () => {
      const invalidCapabilities = [
        'string-not-array',
        123,
        {},
        null,
        true,
        false,
        ['valid', 123, 'invalid'], // Mixed types
        [{}], // Objects in array
        [null], // Null in array
      ];

      invalidCapabilities.forEach(capabilities => {
        const config = {
          name: 'test-server',
          type: 'stdio' as const,
          command: 'node',
          capabilities,
          autoStart: false,
        };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });

    it('should reject invalid connection configurations', () => {
      const invalidConnections = [
        'string-not-object',
        123,
        [],
        null,
        true,
        false,
        { maxRetries: -1 }, // Invalid connection config
        { timeoutMs: -5000 }, // Invalid connection config
        { poolSize: 0 }, // Invalid connection config
      ];

      invalidConnections.forEach(connection => {
        const config = {
          name: 'test-server',
          type: 'stdio' as const,
          command: 'node',
          connection,
          autoStart: false,
        };
        expect(() => MCPServerConfigSchema.parse(config)).toThrow();
      });
    });
  });

  describe('TypeScript type inference', () => {
    it('should provide correct TypeScript types', () => {
      const config = MCPServerConfigSchema.parse({
        name: 'type-test-server',
        type: 'stdio',
        command: 'npx',
        args: ['test-server', '--verbose'],
        env: { 'NODE_ENV': 'test' },
        envVars: [
          {
            name: 'TEST_VAR',
            description: 'Test variable',
            required: true,
            sensitive: false,
            defaultValue: 'test-value',
            source: 'config',
          },
        ],
        url: undefined,
        headers: undefined,
        autoStart: true,
        capabilities: ['test', 'development'],
        connection: {
          maxRetries: 3,
          timeoutMs: 30000,
          poolSize: 1,
        },
      });

      // Type assertions to ensure TypeScript compilation
      const name: string = config.name;
      const type: 'stdio' | 'http' | 'sse' | 'sdk' = config.type;
      const command: string | undefined = config.command;
      const args: string[] | undefined = config.args;
      const env: Record<string, string> | undefined = config.env;
      const envVars: any[] | undefined = config.envVars;
      const url: string | undefined = config.url;
      const headers: Record<string, string> | undefined = config.headers;
      const autoStart: boolean = config.autoStart;
      const capabilities: string[] | undefined = config.capabilities;
      const connection: any | undefined = config.connection;

      expect(typeof name).toBe('string');
      expect(typeof type).toBe('string');
      expect(typeof command).toBe('string');
      expect(Array.isArray(args)).toBe(true);
      expect(typeof env).toBe('object');
      expect(Array.isArray(envVars)).toBe(true);
      expect(url).toBeUndefined();
      expect(headers).toBeUndefined();
      expect(typeof autoStart).toBe('boolean');
      expect(Array.isArray(capabilities)).toBe(true);
      expect(typeof connection).toBe('object');

      expect(name).toBe('type-test-server');
      expect(type).toBe('stdio');
      expect(command).toBe('npx');
      expect(args).toEqual(['test-server', '--verbose']);
      expect(autoStart).toBe(true);
      expect(capabilities).toEqual(['test', 'development']);
    });

    it('should handle optional fields correctly in TypeScript', () => {
      const config: MCPServerConfig = {
        name: 'minimal-config',
        type: 'stdio',
        autoStart: false,
      };

      expect(config.name).toBe('minimal-config');
      expect(config.type).toBe('stdio');
      expect(config.autoStart).toBe(false);
      expect(config.command).toBeUndefined();
      expect(config.args).toBeUndefined();
      expect(config.env).toBeUndefined();
      expect(config.url).toBeUndefined();
      expect(config.headers).toBeUndefined();
      expect(config.capabilities).toBeUndefined();
      expect(config.connection).toBeUndefined();
    });
  });

  describe('Real-world server configuration scenarios', () => {
    it('should handle filesystem MCP server configuration', () => {
      const filesystemConfig = {
        name: 'filesystem-server',
        type: 'stdio' as const,
        command: 'npx',
        args: ['@mcp/filesystem-server'],
        envVars: [
          {
            name: 'WORKSPACE_ROOT',
            description: 'Root directory for filesystem operations',
            required: true,
            sensitive: false,
            defaultValue: '/workspace',
            source: 'config' as const,
          },
          {
            name: 'READ_ONLY',
            description: 'Enable read-only mode',
            required: false,
            sensitive: false,
            defaultValue: 'false',
            source: 'default' as const,
          },
        ],
        autoStart: true,
        capabilities: ['filesystem', 'read', 'write', 'search'],
        connection: {
          maxRetries: 3,
          timeoutMs: 30000,
          poolSize: 1,
        },
      };

      const result = MCPServerConfigSchema.parse(filesystemConfig);

      expect(result.name).toBe('filesystem-server');
      expect(result.args).toEqual(['@mcp/filesystem-server']);
      expect(result.envVars).toHaveLength(2);
      expect(result.capabilities).toContain('filesystem');
    });

    it('should handle API integration server configuration', () => {
      const apiConfig = {
        name: 'api-integration-server',
        type: 'http' as const,
        url: 'https://api.service.com/mcp/v1',
        headers: {
          'Authorization': 'Bearer integration-token',
          'Content-Type': 'application/json',
          'X-Integration-Version': '1.0',
        },
        envVars: [
          {
            name: 'API_TOKEN',
            description: 'Authentication token for API access',
            required: true,
            sensitive: true,
            source: 'user' as const,
          },
          {
            name: 'API_TIMEOUT',
            description: 'API request timeout in seconds',
            required: false,
            sensitive: false,
            defaultValue: '30',
            source: 'config' as const,
          },
        ],
        autoStart: true,
        capabilities: ['api', 'data-retrieval', 'webhooks'],
        connection: {
          maxRetries: 5,
          timeoutMs: 45000,
          poolSize: 2,
          healthCheckIntervalMs: 60000,
        },
      };

      const result = MCPServerConfigSchema.parse(apiConfig);

      expect(result.type).toBe('http');
      expect(result.url).toBe('https://api.service.com/mcp/v1');
      expect(result.headers!['Authorization']).toBe('Bearer integration-token');
      expect(result.envVars![0].sensitive).toBe(true);
      expect(result.capabilities).toContain('api');
    });

    it('should handle development environment server configuration', () => {
      const devConfig = {
        name: 'development-server',
        type: 'stdio' as const,
        command: 'npm',
        args: ['run', 'dev', '--', '--watch', '--debug'],
        env: {
          'NODE_ENV': 'development',
          'DEBUG': '*',
          'LOG_LEVEL': 'debug',
          'HOT_RELOAD': 'true',
        },
        envVars: [
          {
            name: 'DEV_PORT',
            description: 'Development server port',
            required: false,
            sensitive: false,
            defaultValue: '3000',
            source: 'env' as const,
          },
        ],
        autoStart: true,
        capabilities: ['development', 'hot-reload', 'debugging'],
        connection: {
          maxRetries: 10,
          timeoutMs: 5000,
          poolSize: 1,
          heartbeatEnabled: false,
        },
      };

      const result = MCPServerConfigSchema.parse(devConfig);

      expect(result.env!['NODE_ENV']).toBe('development');
      expect(result.env!['DEBUG']).toBe('*');
      expect(result.capabilities).toContain('development');
      expect(result.connection?.maxRetries).toBe(10);
    });

    it('should handle event streaming server configuration', () => {
      const sseConfig = {
        name: 'event-streaming-server',
        type: 'sse' as const,
        url: 'https://events.platform.com/stream/mcp',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Stream-Type': 'mcp-events',
        },
        envVars: [
          {
            name: 'STREAM_TOKEN',
            description: 'Authentication token for event stream',
            required: true,
            sensitive: true,
            source: 'user' as const,
          },
          {
            name: 'RECONNECT_DELAY',
            description: 'Delay between reconnection attempts in ms',
            required: false,
            sensitive: false,
            defaultValue: '5000',
            source: 'config' as const,
          },
        ],
        autoStart: false,
        capabilities: ['events', 'realtime', 'notifications'],
        connection: {
          maxRetries: 100,
          timeoutMs: 300000, // 5 minutes for long-running streams
          poolSize: 1,
          healthCheckIntervalMs: 30000,
          heartbeatEnabled: true,
          heartbeatIntervalMs: 60000,
        },
      };

      const result = MCPServerConfigSchema.parse(sseConfig);

      expect(result.type).toBe('sse');
      expect(result.headers!['Accept']).toBe('text/event-stream');
      expect(result.autoStart).toBe(false);
      expect(result.connection?.maxRetries).toBe(100);
      expect(result.connection?.heartbeatEnabled).toBe(true);
    });

    it('should handle SDK embedded server configuration', () => {
      const sdkConfig = {
        name: 'embedded-sdk-server',
        type: 'sdk' as const,
        envVars: [
          {
            name: 'SDK_LIBRARY_PATH',
            description: 'Path to SDK library files',
            required: true,
            sensitive: false,
            defaultValue: '/opt/mcp/lib',
            source: 'config' as const,
          },
          {
            name: 'SDK_LICENSE_KEY',
            description: 'License key for SDK usage',
            required: true,
            sensitive: true,
            source: 'user' as const,
          },
        ],
        autoStart: true,
        capabilities: ['embedded', 'native', 'high-performance'],
        connection: {
          maxRetries: 0, // No retries for embedded SDK
          timeoutMs: 1000,
          poolSize: 1,
        },
      };

      const result = MCPServerConfigSchema.parse(sdkConfig);

      expect(result.type).toBe('sdk');
      expect(result.envVars).toHaveLength(2);
      expect(result.envVars![1].sensitive).toBe(true);
      expect(result.capabilities).toContain('embedded');
      expect(result.connection?.maxRetries).toBe(0);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very long server names', () => {
      const longName = 'very-long-server-name-that-exceeds-normal-length-'.repeat(10);

      const config = {
        name: longName,
        type: 'stdio' as const,
        command: 'node',
        autoStart: false,
      };

      const result = MCPServerConfigSchema.parse(config);
      expect(result.name).toBe(longName);
    });

    it('should handle special characters in configuration values', () => {
      const specialConfig = {
        name: 'special-chars-server-!@#$%^&*()_+-=[]{}|;:,.<>?',
        type: 'stdio' as const,
        command: 'node',
        args: ['--config', '/path/with spaces/config.json', '--special-arg=!@#$%'],
        env: {
          'SPECIAL_VAR_!@#$': 'value-with-special-chars-!@#$%^&*()',
          'PATH_WITH_SPACES': '/path with spaces/to/resource',
        },
        autoStart: false,
      };

      const result = MCPServerConfigSchema.parse(specialConfig);
      expect(result.name).toContain('!@#$%^&*()_+-=[]{}|;:,.<>?');
      expect(result.env!['SPECIAL_VAR_!@#$']).toContain('!@#$%^&*()');
    });

    it('should handle Unicode characters in configuration', () => {
      const unicodeConfig = {
        name: 'unicode-server-тест-서버-测试-🚀',
        type: 'http' as const,
        url: 'https://api.тест.com/서버/测试🚀',
        headers: {
          'X-Unicode-Header': 'тест-서버-测试-🚀',
        },
        capabilities: ['unicode-тест', 'unicode-서버', 'unicode-测试🚀'],
        autoStart: false,
      };

      const result = MCPServerConfigSchema.parse(unicodeConfig);
      expect(result.name).toContain('тест-서버-测试-🚀');
      expect(result.url).toContain('тест.com/서버/测试🚀');
      expect(result.capabilities).toContain('unicode-тест');
    });

    it('should handle empty arrays and objects', () => {
      const emptyConfig = {
        name: 'empty-config-server',
        type: 'stdio' as const,
        command: 'node',
        args: [],
        env: {},
        envVars: [],
        capabilities: [],
        autoStart: false,
      };

      const result = MCPServerConfigSchema.parse(emptyConfig);
      expect(result.args).toEqual([]);
      expect(result.env).toEqual({});
      expect(result.envVars).toEqual([]);
      expect(result.capabilities).toEqual([]);
    });

    it('should handle very large arrays and objects', () => {
      const largeArgs = Array.from({ length: 100 }, (_, i) => `arg-${i}`);
      const largeEnv = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`VAR_${i}`, `value-${i}`])
      );
      const largeCapabilities = Array.from({ length: 25 }, (_, i) => `capability-${i}`);

      const largeConfig = {
        name: 'large-config-server',
        type: 'stdio' as const,
        command: 'node',
        args: largeArgs,
        env: largeEnv,
        capabilities: largeCapabilities,
        autoStart: false,
      };

      const result = MCPServerConfigSchema.parse(largeConfig);
      expect(result.args).toHaveLength(100);
      expect(Object.keys(result.env!)).toHaveLength(50);
      expect(result.capabilities).toHaveLength(25);
    });
  });

  describe('Integration with nested schemas', () => {
    it('should properly validate nested envVars schema', () => {
      const config = {
        name: 'nested-envvars-test',
        type: 'stdio' as const,
        command: 'node',
        envVars: [
          {
            name: 'VALID_VAR_1',
            description: 'First valid variable',
            required: true,
            sensitive: false,
            defaultValue: 'default1',
            source: 'config' as const,
          },
          {
            name: 'VALID_VAR_2',
            description: 'Second valid variable',
            required: false,
            sensitive: true,
            source: 'user' as const,
          },
        ],
        autoStart: false,
      };

      const result = MCPServerConfigSchema.parse(config);

      // Verify envVars are properly parsed according to MCPEnvironmentVarSchema
      expect(result.envVars).toHaveLength(2);
      expect(result.envVars![0].name).toBe('VALID_VAR_1');
      expect(result.envVars![0].required).toBe(true);
      expect(result.envVars![0].sensitive).toBe(false);
      expect(result.envVars![1].name).toBe('VALID_VAR_2');
      expect(result.envVars![1].required).toBe(false);
      expect(result.envVars![1].sensitive).toBe(true);
    });

    it('should properly validate nested connection schema', () => {
      const config = {
        name: 'nested-connection-test',
        type: 'http' as const,
        url: 'https://api.example.com',
        connection: {
          maxRetries: 5,
          timeoutMs: 45000,
          connectTimeoutMs: 10000,
          readTimeoutMs: 120000,
          writeTimeoutMs: 60000,
          idleTimeoutMs: 300000,
          poolSize: 2,
          healthCheckIntervalMs: 60000,
          healthCheckTimeoutMs: 5000,
          heartbeatEnabled: true,
          heartbeatIntervalMs: 30000,
          keepAliveIntervalMs: 15000,
        },
        autoStart: false,
      };

      const result = MCPServerConfigSchema.parse(config);

      // Verify connection is properly parsed according to MCPConnectionConfigSchema
      expect(result.connection?.maxRetries).toBe(5);
      expect(result.connection?.timeoutMs).toBe(45000);
      expect(result.connection?.poolSize).toBe(2);
      expect(result.connection?.heartbeatEnabled).toBe(true);
    });

    it('should maintain consistency across multiple parsing cycles', () => {
      const originalConfig = {
        name: 'consistency-test-server',
        type: 'stdio' as const,
        command: 'npx',
        args: ['consistency-test'],
        env: { 'TEST_ENV': 'consistency' },
        envVars: [
          {
            name: 'CONSISTENCY_VAR',
            description: 'Testing consistency',
            required: true,
            sensitive: false,
            source: 'config' as const,
          },
        ],
        autoStart: true,
        capabilities: ['consistency', 'test'],
        connection: {
          maxRetries: 3,
          timeoutMs: 30000,
        },
      };

      // Parse multiple times to ensure consistency
      let currentConfig = originalConfig;
      for (let i = 0; i < 5; i++) {
        const parsed = MCPServerConfigSchema.parse(currentConfig);
        expect(parsed.name).toBe('consistency-test-server');
        expect(parsed.args).toEqual(['consistency-test']);
        expect(parsed.envVars![0].name).toBe('CONSISTENCY_VAR');
        expect(parsed.connection?.maxRetries).toBe(3);
        currentConfig = parsed;
      }
    });
  });
});