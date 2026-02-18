/**
 * Test suite for InstalledMCPServer schema and related types
 * Tests the complete workflow from server definition to installation tracking
 */

import { describe, it, expect } from 'vitest';
import {
  InstalledMCPServerSchema,
  MCPServerSchema,
  MCPServerConfigSchema,
  MCPInstallationStatusSchema,
  MCPEnvironmentVarSchema,
  type InstalledMCPServer,
  type MCPServer,
  type MCPServerConfig,
  type MCPInstallationStatus,
} from '../types.js';

describe('InstalledMCPServer Types', () => {
  describe('InstalledMCPServerSchema validation', () => {
    it('should validate complete installed server with all fields', () => {
      const installedServer = {
        id: 'installed-server-123',
        name: 'filesystem-server-prod',
        server: {
          name: 'filesystem-server',
          description: 'Provides filesystem access capabilities',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
          envVars: [
            {
              name: 'ROOT_PATH',
              description: 'Root directory for filesystem access',
              required: true,
            },
            {
              name: 'ALLOWED_EXTENSIONS',
              description: 'Comma-separated list of allowed file extensions',
              required: false,
              defaultValue: '.txt,.md,.json',
            },
          ],
          version: '1.2.0',
        },
        config: {
          name: 'filesystem-server-instance',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', '--root=/workspace'],
          envVars: [
            {
              name: 'ROOT_PATH',
              description: 'Root directory for filesystem access',
              required: true,
            },
          ],
          autoStart: true,
          connection: {
            retryAttempts: 5,
            retryDelayMs: 2000,
            timeoutMs: 30000,
            maxConcurrentConnections: 3,
          },
        },
        status: 'running' as const,
        installedAt: '2024-01-15T10:30:00Z',
        version: '1.2.0',
        tags: ['filesystem', 'development'],
        lastUsedAt: '2024-01-15T11:45:00Z',
        usageCount: 15,
        configOverrides: {
          autoStart: true,
          connection: {
            retryAttempts: 5,
          },
        },
      };

      const result = InstalledMCPServerSchema.parse(installedServer);

      expect(result.id).toBe('installed-server-123');
      expect(result.name).toBe('filesystem-server-prod');
      expect(result.server.name).toBe('filesystem-server');
      expect(result.config.name).toBe('filesystem-server-instance');
      expect(result.status).toBe('running');
      expect(result.installedAt).toBe('2024-01-15T10:30:00Z');
      expect(result.version).toBe('1.2.0');
      expect(result.tags).toEqual(['filesystem', 'development']);
      expect(result.usageCount).toBe(15);
    });

    it('should validate minimal installed server', () => {
      const minimalServer = {
        id: 'minimal-server',
        name: 'simple-server',
        server: {
          name: 'simple-mcp-server',
          description: 'Simple MCP server',
          command: 'node',
          version: '1.0.0',
        },
        config: {
          name: 'simple-server-instance',
          command: 'node',
        },
        status: 'installed' as const,
        installedAt: '2024-01-01T00:00:00Z',
      };

      const result = InstalledMCPServerSchema.parse(minimalServer);

      expect(result.id).toBe('minimal-server');
      expect(result.server.args).toEqual([]); // Default value
      expect(result.server.envVars).toEqual([]); // Default value
      expect(result.config.args).toEqual([]); // Default value
      expect(result.config.autoStart).toBe(true); // Default value
      expect(result.tags).toEqual([]); // Default value
      expect(result.usageCount).toBe(0); // Default value
      expect(result.configOverrides).toEqual({}); // Default value
    });

    it('should handle all valid installation statuses', () => {
      const statuses: MCPInstallationStatus[] = [
        'installing',
        'installed',
        'failed',
        'running',
        'stopped',
      ];

      statuses.forEach(status => {
        const server = {
          id: `server-${status}`,
          name: `test-server-${status}`,
          server: {
            name: 'test-server',
            description: 'Test server',
            command: 'node',
            version: '1.0.0',
          },
          config: {
            name: 'test-config',
            command: 'node',
          },
          status,
          installedAt: '2024-01-01T00:00:00Z',
        };

        const result = InstalledMCPServerSchema.parse(server);
        expect(result.status).toBe(status);
      });
    });

    it('should validate environment variables in both server and config', () => {
      const serverWithEnvVars = {
        id: 'env-test-server',
        name: 'environment-test-server',
        server: {
          name: 'env-server',
          description: 'Server with environment variables',
          command: 'node',
          envVars: [
            {
              name: 'SERVER_PORT',
              description: 'Port for the server',
              required: true,
            },
            {
              name: 'LOG_LEVEL',
              description: 'Logging level',
              required: false,
              defaultValue: 'info',
            },
          ],
          version: '1.0.0',
        },
        config: {
          name: 'env-config',
          command: 'node',
          envVars: [
            {
              name: 'SERVER_PORT',
              description: 'Port for the server',
              required: true,
            },
          ],
        },
        status: 'running' as const,
        installedAt: '2024-01-01T00:00:00Z',
      };

      const result = InstalledMCPServerSchema.parse(serverWithEnvVars);

      expect(result.server.envVars).toHaveLength(2);
      expect(result.server.envVars[0].name).toBe('SERVER_PORT');
      expect(result.server.envVars[1].defaultValue).toBe('info');
      expect(result.config.envVars).toHaveLength(1);
      expect(result.config.envVars![0].name).toBe('SERVER_PORT');
    });

    it('should validate connection configuration', () => {
      const serverWithConnection = {
        id: 'connection-test-server',
        name: 'connection-test',
        server: {
          name: 'test-server',
          description: 'Server with connection config',
          command: 'node',
          version: '1.0.0',
        },
        config: {
          name: 'test-config',
          command: 'node',
          connection: {
            retryAttempts: 10,
            retryDelayMs: 5000,
            timeoutMs: 60000,
            maxConcurrentConnections: 2,
          },
        },
        status: 'installed' as const,
        installedAt: '2024-01-01T00:00:00Z',
      };

      const result = InstalledMCPServerSchema.parse(serverWithConnection);

      expect(result.config.connection).toBeDefined();
      expect(result.config.connection!.retryAttempts).toBe(10);
      expect(result.config.connection!.retryDelayMs).toBe(5000);
      expect(result.config.connection!.timeoutMs).toBe(60000);
      expect(result.config.connection!.maxConcurrentConnections).toBe(2);
    });
  });

  describe('Validation errors', () => {
    it('should reject missing required fields', () => {
      const invalidServers = [
        {
          // Missing id
          name: 'test-server',
          server: { name: 'test', description: 'test', command: 'node', version: '1.0.0' },
          config: { name: 'test', command: 'node' },
          status: 'installed',
          installedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'test-id',
          // Missing name
          server: { name: 'test', description: 'test', command: 'node', version: '1.0.0' },
          config: { name: 'test', command: 'node' },
          status: 'installed',
          installedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'test-id',
          name: 'test-server',
          // Missing server
          config: { name: 'test', command: 'node' },
          status: 'installed',
          installedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'test-id',
          name: 'test-server',
          server: { name: 'test', description: 'test', command: 'node', version: '1.0.0' },
          // Missing config
          status: 'installed',
          installedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'test-id',
          name: 'test-server',
          server: { name: 'test', description: 'test', command: 'node', version: '1.0.0' },
          config: { name: 'test', command: 'node' },
          // Missing status
          installedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'test-id',
          name: 'test-server',
          server: { name: 'test', description: 'test', command: 'node', version: '1.0.0' },
          config: { name: 'test', command: 'node' },
          status: 'installed',
          // Missing installedAt
        },
      ];

      invalidServers.forEach(server => {
        expect(() => InstalledMCPServerSchema.parse(server)).toThrow();
      });
    });

    it('should reject invalid server definition', () => {
      const serverWithInvalidServerDef = {
        id: 'test-id',
        name: 'test-server',
        server: {
          name: '', // Empty name
          description: 'test',
          command: 'node',
          version: '1.0.0',
        },
        config: {
          name: 'test',
          command: 'node',
        },
        status: 'installed' as const,
        installedAt: '2024-01-01T00:00:00Z',
      };

      expect(() => InstalledMCPServerSchema.parse(serverWithInvalidServerDef)).toThrow();
    });

    it('should reject invalid config definition', () => {
      const serverWithInvalidConfig = {
        id: 'test-id',
        name: 'test-server',
        server: {
          name: 'test-server',
          description: 'test',
          command: 'node',
          version: '1.0.0',
        },
        config: {
          name: '', // Empty name
          command: 'node',
        },
        status: 'installed' as const,
        installedAt: '2024-01-01T00:00:00Z',
      };

      expect(() => InstalledMCPServerSchema.parse(serverWithInvalidConfig)).toThrow();
    });

    it('should reject invalid status', () => {
      const serverWithInvalidStatus = {
        id: 'test-id',
        name: 'test-server',
        server: {
          name: 'test-server',
          description: 'test',
          command: 'node',
          version: '1.0.0',
        },
        config: {
          name: 'test',
          command: 'node',
        },
        status: 'unknown-status',
        installedAt: '2024-01-01T00:00:00Z',
      };

      expect(() => InstalledMCPServerSchema.parse(serverWithInvalidStatus)).toThrow();
    });

    it('should reject invalid date formats', () => {
      const invalidDates = ['invalid-date', '2024-13-01', '2024/01/01', 1234567890];

      invalidDates.forEach(invalidDate => {
        const server = {
          id: 'test-id',
          name: 'test-server',
          server: {
            name: 'test-server',
            description: 'test',
            command: 'node',
            version: '1.0.0',
          },
          config: {
            name: 'test',
            command: 'node',
          },
          status: 'installed' as const,
          installedAt: invalidDate,
        };

        expect(() => InstalledMCPServerSchema.parse(server)).toThrow();
      });
    });

    it('should reject negative usage count', () => {
      const serverWithNegativeUsage = {
        id: 'test-id',
        name: 'test-server',
        server: {
          name: 'test-server',
          description: 'test',
          command: 'node',
          version: '1.0.0',
        },
        config: {
          name: 'test',
          command: 'node',
        },
        status: 'installed' as const,
        installedAt: '2024-01-01T00:00:00Z',
        usageCount: -5,
      };

      expect(() => InstalledMCPServerSchema.parse(serverWithNegativeUsage)).toThrow();
    });

    it('should reject invalid tags format', () => {
      const serverWithInvalidTags = {
        id: 'test-id',
        name: 'test-server',
        server: {
          name: 'test-server',
          description: 'test',
          command: 'node',
          version: '1.0.0',
        },
        config: {
          name: 'test',
          command: 'node',
        },
        status: 'installed' as const,
        installedAt: '2024-01-01T00:00:00Z',
        tags: 'not-an-array',
      };

      expect(() => InstalledMCPServerSchema.parse(serverWithInvalidTags)).toThrow();
    });
  });

  describe('Edge cases and complex scenarios', () => {
    it('should handle servers with complex environment variable configurations', () => {
      const complexEnvServer = {
        id: 'complex-env-server',
        name: 'complex-environment-server',
        server: {
          name: 'complex-server',
          description: 'Server with complex environment configuration',
          command: 'docker',
          args: ['run', '--rm', 'complex-server:latest'],
          envVars: [
            {
              name: 'DATABASE_URL',
              description: 'Database connection URL',
              required: true,
            },
            {
              name: 'REDIS_URL',
              description: 'Redis connection URL',
              required: true,
            },
            {
              name: 'LOG_LEVEL',
              description: 'Application log level',
              required: false,
              defaultValue: 'warn',
            },
            {
              name: 'FEATURE_FLAGS',
              description: 'Comma-separated feature flags',
              required: false,
              defaultValue: '',
            },
          ],
          version: '2.1.0',
        },
        config: {
          name: 'complex-instance',
          command: 'docker',
          args: ['run', '--rm', '--network=host', 'complex-server:latest'],
          envVars: [
            {
              name: 'DATABASE_URL',
              description: 'Database connection URL',
              required: true,
            },
            {
              name: 'REDIS_URL',
              description: 'Redis connection URL',
              required: true,
            },
            {
              name: 'LOG_LEVEL',
              description: 'Application log level',
              required: false,
              defaultValue: 'info',
            },
          ],
          autoStart: false,
          connection: {
            retryAttempts: 3,
            retryDelayMs: 1500,
            timeoutMs: 45000,
            maxConcurrentConnections: 1,
          },
        },
        status: 'stopped' as const,
        installedAt: '2024-01-10T08:00:00Z',
        version: '2.1.0',
        tags: ['database', 'redis', 'production'],
        lastUsedAt: '2024-01-14T16:30:00Z',
        usageCount: 42,
        configOverrides: {
          autoStart: false,
          envVars: [
            {
              name: 'LOG_LEVEL',
              description: 'Application log level',
              required: false,
              defaultValue: 'info', // Override from 'warn'
            },
          ],
        },
      };

      const result = InstalledMCPServerSchema.parse(complexEnvServer);

      expect(result.server.envVars).toHaveLength(4);
      expect(result.config.envVars).toHaveLength(3);
      expect(result.tags).toContain('database');
      expect(result.tags).toContain('redis');
      expect(result.tags).toContain('production');
      expect(result.configOverrides.autoStart).toBe(false);
      expect(result.configOverrides.envVars).toHaveLength(1);
    });

    it('should handle servers installed at different times with different versions', () => {
      const servers = [
        {
          id: 'old-server',
          name: 'legacy-filesystem',
          server: {
            name: 'filesystem-server',
            description: 'Legacy filesystem server',
            command: 'node',
            version: '0.9.0',
          },
          config: {
            name: 'legacy-filesystem',
            command: 'node',
          },
          status: 'stopped' as const,
          installedAt: '2023-06-01T10:00:00Z',
          version: '0.9.0',
          usageCount: 150,
        },
        {
          id: 'current-server',
          name: 'modern-filesystem',
          server: {
            name: 'filesystem-server',
            description: 'Modern filesystem server',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem'],
            version: '1.2.0',
          },
          config: {
            name: 'modern-filesystem',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem'],
            autoStart: true,
          },
          status: 'running' as const,
          installedAt: '2024-01-15T14:30:00Z',
          version: '1.2.0',
          tags: ['filesystem', 'current'],
          usageCount: 25,
        },
        {
          id: 'beta-server',
          name: 'beta-filesystem',
          server: {
            name: 'filesystem-server',
            description: 'Beta filesystem server',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem@beta'],
            version: '2.0.0-beta.1',
          },
          config: {
            name: 'beta-filesystem',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem@beta'],
            autoStart: false,
          },
          status: 'installed' as const,
          installedAt: '2024-01-20T09:15:00Z',
          version: '2.0.0-beta.1',
          tags: ['filesystem', 'beta', 'testing'],
          usageCount: 5,
        },
      ];

      servers.forEach(server => {
        const result = InstalledMCPServerSchema.parse(server);
        expect(result.server.name).toBe('filesystem-server');
        expect(result.version).toBe(server.version);
        expect(result.usageCount).toBe(server.usageCount);
      });
    });

    it('should handle unicode characters and special characters', () => {
      const unicodeServer = {
        id: 'unicode-тест-서버-测试',
        name: 'Unicode Server тест 서버 测试 🚀',
        server: {
          name: 'unicode-mcp-server',
          description: 'Server with Unicode support: тест 서버 测试 🌍',
          command: 'node',
          args: ['--title=测试服务器', '--emoji=🚀'],
          version: '1.0.0',
        },
        config: {
          name: 'unicode-instance-тест',
          command: 'node',
          args: ['--config=/path/unicode/тест/서버/测试🚀/config.json'],
        },
        status: 'running' as const,
        installedAt: '2024-01-01T00:00:00Z',
        tags: ['unicode', 'international', 'тест', '서버', '测试'],
      };

      const result = InstalledMCPServerSchema.parse(unicodeServer);

      expect(result.id).toContain('тест');
      expect(result.id).toContain('서버');
      expect(result.id).toContain('测试');
      expect(result.name).toContain('🚀');
      expect(result.server.description).toContain('🌍');
      expect(result.tags).toContain('тест');
      expect(result.tags).toContain('서버');
      expect(result.tags).toContain('测试');
    });

    it('should handle large numbers and boundary values', () => {
      const boundaryServer = {
        id: 'boundary-test-server',
        name: 'boundary-test',
        server: {
          name: 'boundary-server',
          description: 'Server for testing boundary values',
          command: 'node',
          version: '1.0.0',
        },
        config: {
          name: 'boundary-config',
          command: 'node',
          connection: {
            retryAttempts: 20, // Maximum allowed
            retryDelayMs: 10000,
            timeoutMs: 600000, // 10 minutes
            maxConcurrentConnections: 100, // Maximum allowed
          },
        },
        status: 'installed' as const,
        installedAt: '1970-01-01T00:00:00Z', // Unix epoch
        usageCount: 999999999, // Large number
      };

      const result = InstalledMCPServerSchema.parse(boundaryServer);

      expect(result.config.connection!.retryAttempts).toBe(20);
      expect(result.config.connection!.maxConcurrentConnections).toBe(100);
      expect(result.installedAt).toBe('1970-01-01T00:00:00Z');
      expect(result.usageCount).toBe(999999999);
    });
  });

  describe('TypeScript type inference and compatibility', () => {
    it('should provide correct TypeScript types', () => {
      const server = InstalledMCPServerSchema.parse({
        id: 'type-test-server',
        name: 'type-test',
        server: {
          name: 'test-server',
          description: 'Test server for type checking',
          command: 'node',
          args: ['test.js'],
          envVars: [
            {
              name: 'TEST_ENV',
              description: 'Test environment variable',
              required: false,
              defaultValue: 'test',
            },
          ],
          version: '1.0.0',
        },
        config: {
          name: 'type-test-config',
          command: 'node',
          args: ['test.js'],
          envVars: [
            {
              name: 'TEST_ENV',
              description: 'Test environment variable',
              required: false,
            },
          ],
          autoStart: true,
          connection: {
            retryAttempts: 3,
            retryDelayMs: 1000,
            timeoutMs: 30000,
            maxConcurrentConnections: 5,
          },
        },
        status: 'running',
        installedAt: '2024-01-01T00:00:00Z',
        version: '1.0.0',
        tags: ['test', 'typescript'],
        lastUsedAt: '2024-01-02T00:00:00Z',
        usageCount: 10,
        configOverrides: {
          autoStart: true,
        },
      });

      // Type assertions to ensure correct TypeScript types
      const id: string = server.id;
      const name: string = server.name;
      const serverDef: MCPServer = server.server;
      const config: MCPServerConfig = server.config;
      const status: MCPInstallationStatus = server.status;
      const installedAt: string = server.installedAt;

      expect(typeof id).toBe('string');
      expect(typeof name).toBe('string');
      expect(typeof serverDef).toBe('object');
      expect(typeof config).toBe('object');
      expect(typeof status).toBe('string');
      expect(typeof installedAt).toBe('string');

      // Verify nested type access
      expect(serverDef.name).toBe('test-server');
      expect(config.name).toBe('type-test-config');
      expect(status).toBe('running');
    });

    it('should be compatible with base MCPServer and MCPServerConfig types', () => {
      const baseServer: MCPServer = {
        name: 'compatibility-server',
        description: 'Server for compatibility testing',
        command: 'node',
        version: '1.0.0',
      };

      const baseConfig: MCPServerConfig = {
        name: 'compatibility-config',
        command: 'node',
      };

      const installedServer: InstalledMCPServer = {
        id: 'compatibility-test',
        name: 'compatibility-installed',
        server: baseServer,
        config: baseConfig,
        status: 'installed',
        installedAt: '2024-01-01T00:00:00Z',
      };

      const result = InstalledMCPServerSchema.parse(installedServer);

      expect(result.server).toEqual({
        ...baseServer,
        args: [], // Default value
        envVars: [], // Default value
      });
      expect(result.config).toEqual({
        ...baseConfig,
        args: [], // Default value
        autoStart: true, // Default value
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should support full server lifecycle workflow', () => {
      // Simulate a complete workflow from definition to installation to usage tracking

      // 1. Server definition
      const serverDefinition: MCPServer = {
        name: 'workflow-server',
        description: 'Server for testing complete workflow',
        command: 'npx',
        args: ['workflow-server', '--production'],
        envVars: [
          {
            name: 'API_TOKEN',
            description: 'API authentication token',
            required: true,
          },
        ],
        version: '1.0.0',
      };

      // 2. Installation configuration
      const installConfig: MCPServerConfig = {
        name: 'workflow-server-prod',
        command: 'npx',
        args: ['workflow-server', '--production', '--instance=prod'],
        envVars: [
          {
            name: 'API_TOKEN',
            description: 'API authentication token',
            required: true,
          },
        ],
        autoStart: true,
        connection: {
          retryAttempts: 5,
          retryDelayMs: 2000,
          timeoutMs: 30000,
          maxConcurrentConnections: 2,
        },
      };

      // 3. Initial installation
      const initialInstall: InstalledMCPServer = {
        id: 'workflow-install-001',
        name: 'workflow-server-production',
        server: serverDefinition,
        config: installConfig,
        status: 'installing',
        installedAt: '2024-01-15T10:00:00Z',
        version: '1.0.0',
        tags: ['production', 'workflow'],
        usageCount: 0,
      };

      // 4. Installation completed
      const installedState = {
        ...initialInstall,
        status: 'installed' as const,
      };

      // 5. Server running
      const runningState = {
        ...installedState,
        status: 'running' as const,
        lastUsedAt: '2024-01-15T10:30:00Z',
        usageCount: 1,
      };

      // 6. After some usage
      const usedState = {
        ...runningState,
        lastUsedAt: '2024-01-15T15:45:00Z',
        usageCount: 25,
      };

      // Validate each state
      const states = [initialInstall, installedState, runningState, usedState];
      states.forEach(state => {
        const result = InstalledMCPServerSchema.parse(state);
        expect(result.id).toBe('workflow-install-001');
        expect(result.server.name).toBe('workflow-server');
        expect(result.config.name).toBe('workflow-server-prod');
      });

      // Verify state transitions
      expect(installedState.status).toBe('installed');
      expect(runningState.status).toBe('running');
      expect(usedState.usageCount).toBe(25);
    });

    it('should handle server updates and version changes', () => {
      // Original server installation
      const originalServer: InstalledMCPServer = {
        id: 'update-test-server',
        name: 'updatable-server',
        server: {
          name: 'updatable-server',
          description: 'Server that can be updated',
          command: 'npx',
          args: ['updatable-server@1.0.0'],
          version: '1.0.0',
        },
        config: {
          name: 'updatable-config',
          command: 'npx',
          args: ['updatable-server@1.0.0'],
        },
        status: 'running',
        installedAt: '2024-01-01T00:00:00Z',
        version: '1.0.0',
        tags: ['updatable'],
        usageCount: 50,
        lastUsedAt: '2024-01-10T12:00:00Z',
      };

      // Updated server after version upgrade
      const updatedServer: InstalledMCPServer = {
        ...originalServer,
        server: {
          ...originalServer.server,
          args: ['updatable-server@2.0.0'],
          version: '2.0.0',
        },
        config: {
          ...originalServer.config,
          args: ['updatable-server@2.0.0'],
        },
        version: '2.0.0',
        // Usage count and last used should be preserved
        usageCount: 50,
        lastUsedAt: '2024-01-10T12:00:00Z',
        // But could be updated with new usage
        tags: ['updatable', 'v2'],
      };

      const originalResult = InstalledMCPServerSchema.parse(originalServer);
      const updatedResult = InstalledMCPServerSchema.parse(updatedServer);

      expect(originalResult.version).toBe('1.0.0');
      expect(updatedResult.version).toBe('2.0.0');
      expect(updatedResult.usageCount).toBe(50); // Preserved
      expect(updatedResult.tags).toContain('v2'); // Updated
    });
  });
});