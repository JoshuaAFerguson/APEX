import { describe, it, expect } from 'vitest';
import {
  MCPConfigSchema,
  MCPServerConfigSchema,
  MCPTemplateSchema,
  MCPConnectionConfigSchema,
  MCPEnvironmentVarSchema,
  MCPMarketplaceSourceSchema,
  MCPConnectionInfoSchema,
  MCPToolSchema,
  MCPToolSchemaSchema,
  MCPInstallationSchema,
} from '../types.js';

/**
 * Integration test suite for MCP configuration types
 * Tests how different MCP schemas work together in real-world scenarios
 * and validates the complete MCP configuration ecosystem.
 */
describe('MCP Configuration Integration Tests', () => {
  describe('Complete MCP configuration workflow', () => {
    it('should handle full MCP setup with servers, templates, and marketplace', () => {
      // 1. Define MCP templates for common server types
      const filesystemTemplate = MCPTemplateSchema.parse({
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'Access and manipulate local filesystem',
        package: '@modelcontextprotocol/server-filesystem',
        config: {
          name: 'filesystem',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
          autoStart: true,
        },
        envVars: [
          {
            name: 'WORKSPACE_ROOT',
            description: 'Root directory for filesystem operations',
            required: true,
            sensitive: false,
            defaultValue: '/workspace',
            source: 'config',
          },
        ],
        capabilities: ['filesystem', 'read', 'write'],
        verified: true,
        defaultEnabled: true,
        category: 'filesystem',
        tags: ['filesystem', 'files'],
      });

      const githubTemplate = MCPTemplateSchema.parse({
        id: 'github',
        name: 'GitHub Integration',
        description: 'GitHub API integration and repository management',
        package: '@mcp/github-server',
        config: {
          name: 'github',
          type: 'http',
          url: 'https://api.github.com',
          autoStart: false,
        },
        envVars: [
          {
            name: 'GITHUB_TOKEN',
            description: 'Personal access token for GitHub API',
            required: true,
            sensitive: true,
            source: 'user',
          },
        ],
        capabilities: ['api', 'github', 'repositories'],
        verified: true,
        defaultEnabled: false,
        category: 'api',
        tags: ['github', 'api'],
      });

      // 2. Define global connection configuration
      const globalConnection = MCPConnectionConfigSchema.parse({
        maxRetries: 3,
        requestTimeoutMs: 30000,
        connectionTimeoutMs: 10000,
        poolSize: 1,
        healthCheckIntervalMs: 60000,
        heartbeatEnabled: true,
        heartbeatIntervalMs: 30000,
      });

      // 3. Define marketplace source configuration
      const marketplaceSource = MCPMarketplaceSourceSchema.parse({
        url: 'https://marketplace.modelcontextprotocol.io/api/servers',
        enabled: true,
        refreshIntervalMinutes: 1440, // Daily refresh
        allowUnverified: false,
      });

      // 4. Create server configurations based on templates
      const filesystemServer = MCPServerConfigSchema.parse({
        ...filesystemTemplate.config,
        envVars: filesystemTemplate.envVars,
        capabilities: filesystemTemplate.capabilities,
        connection: {
          maxRetries: 5, // Override global setting for filesystem
          requestTimeoutMs: 45000,
          poolSize: 1,
        },
      });

      const githubServer = MCPServerConfigSchema.parse({
        ...githubTemplate.config,
        envVars: githubTemplate.envVars,
        capabilities: githubTemplate.capabilities,
        // Use global connection settings
      });

      // 5. Create complete MCP configuration
      const mcpConfig = MCPConfigSchema.parse({
        enabled: true,
        servers: {
          filesystem: filesystemServer,
          github: githubServer,
        },
        marketplace: marketplaceSource,
        connection: globalConnection,
      });

      // Verify the complete configuration
      expect(mcpConfig.enabled).toBe(true);
      expect(Object.keys(mcpConfig.servers)).toHaveLength(2);
      expect(mcpConfig.servers.filesystem.name).toBe('filesystem');
      expect(mcpConfig.servers.github.name).toBe('github');
      expect(mcpConfig.marketplace?.url).toBe('https://marketplace.modelcontextprotocol.io/api/servers');
      expect(mcpConfig.connection?.maxRetries).toBe(3);

      // Verify server-specific overrides
      expect(mcpConfig.servers.filesystem.connection?.maxRetries).toBe(5);
      expect(mcpConfig.servers.github.connection).toBeUndefined();

      // Verify environment variables are properly structured
      expect(mcpConfig.servers.filesystem.envVars?.[0].name).toBe('WORKSPACE_ROOT');
      expect(mcpConfig.servers.github.envVars?.[0].sensitive).toBe(true);
    });

    it('should handle MCP server installation workflow', () => {
      // 1. Start with a template
      const template = MCPTemplateSchema.parse({
        id: 'postgres',
        name: 'PostgreSQL Database',
        description: 'PostgreSQL database operations',
        package: '@mcp/postgresql-server',
        config: {
          name: 'postgres',
          type: 'stdio',
          command: 'node',
          args: ['dist/index.js'],
        },
        envVars: [
          {
            name: 'DATABASE_URL',
            description: 'PostgreSQL connection string',
            required: true,
            sensitive: true,
            source: 'env',
          },
        ],
        capabilities: ['database', 'sql'],
        verified: true,
      });

      // 2. Create server configuration from template
      const serverConfig = MCPServerConfigSchema.parse({
        ...template.config,
        envVars: template.envVars,
        capabilities: template.capabilities,
        autoStart: true,
        env: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'info',
        },
      });

      // 3. Create installation record
      const installation = MCPInstallationSchema.parse({
        id: 'postgres-install-001',
        serverId: 'postgres',
        installedAt: new Date('2024-01-15T10:30:00Z'),
        status: 'installed',
        configPath: '/etc/mcp/servers/postgres.json',
      });

      // Verify the workflow
      expect(template.id).toBe('postgres');
      expect(serverConfig.name).toBe('postgres');
      expect(installation.serverId).toBe('postgres');
      expect(installation.status).toBe('installed');

      // Verify environment variables carried over
      expect(serverConfig.envVars?.[0].name).toBe('DATABASE_URL');
      expect(serverConfig.envVars?.[0].sensitive).toBe(true);

      // Verify capabilities carried over
      expect(serverConfig.capabilities).toContain('database');
      expect(serverConfig.capabilities).toContain('sql');
    });

    it('should handle MCP connection state and events workflow', () => {
      // 1. Create server configuration
      const serverConfig = MCPServerConfigSchema.parse({
        name: 'api-server',
        type: 'http',
        url: 'https://api.example.com/mcp',
        headers: {
          'Authorization': 'Bearer token',
        },
        autoStart: true,
        connection: {
          maxRetries: 5,
          requestTimeoutMs: 30000,
          healthCheckIntervalMs: 60000,
          heartbeatEnabled: true,
        },
      });

      // 2. Create connection info
      const connectionInfo = MCPConnectionInfoSchema.parse({
        serverId: 'api-server',
        serverName: 'API Server',
        config: serverConfig,
        state: 'connected',
        connectedAt: new Date('2024-01-15T10:00:00Z'),
        lastActivityAt: new Date('2024-01-15T10:30:00Z'),
        reconnectAttempts: 0,
        lastError: undefined,
        health: {
          healthy: true,
          lastCheckAt: new Date('2024-01-15T10:30:00Z'),
          latencyMs: 250,
        },
        metrics: {
          totalRequests: 45,
          successfulRequests: 45,
          failedRequests: 0,
          bytesSent: 12345,
          bytesReceived: 67890,
          uptimeMs: 1800000, // 30 minutes
        },
      });

      // Verify connection state
      expect(connectionInfo.serverId).toBe('api-server');
      expect(connectionInfo.state).toBe('connected');
      expect(connectionInfo.config.type).toBe('http');
      expect(connectionInfo.health?.healthy).toBe(true);
      expect(connectionInfo.metrics?.totalRequests).toBe(45);
      expect(connectionInfo.reconnectAttempts).toBe(0);
    });

    it('should handle MCP tool discovery and registration', () => {
      // 1. Create server configuration
      const serverConfig = MCPServerConfigSchema.parse({
        name: 'tool-server',
        type: 'stdio',
        command: 'npx',
        args: ['@mcp/tool-server'],
        capabilities: ['tools', 'filesystem', 'api'],
        autoStart: true,
      });

      // 2. Define tool schema
      const toolInputSchema = MCPToolSchemaSchema.parse({
        type: 'object',
        title: 'Read File Parameters',
        description: 'Parameters for reading a file',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read',
          },
          encoding: {
            type: 'string',
            description: 'File encoding',
            enum: ['utf8', 'ascii', 'base64'],
            default: 'utf8',
          },
        },
        required: ['path'],
        additionalProperties: false,
      });

      // 3. Create tool definition
      const tool = MCPToolSchema.parse({
        name: 'read_file',
        description: 'Read contents of a file',
        inputSchema: toolInputSchema,
        serverId: 'tool-server',
        serverName: 'Tool Server',
        capabilities: {
          streaming: false,
          cancellable: false,
          idempotent: true,
          hasSideEffects: false,
        },
        available: true,
        version: '1.0.0',
        tags: ['filesystem', 'read'],
      });

      // Verify tool registration
      expect(tool.name).toBe('read_file');
      expect(tool.serverId).toBe('tool-server');
      expect(tool.inputSchema.properties?.path?.type).toBe('string');
      expect(tool.capabilities?.idempotent).toBe(true);
      expect(tool.capabilities?.hasSideEffects).toBe(false);
      expect(tool.available).toBe(true);
    });
  });

  describe('Configuration inheritance and overrides', () => {
    it('should properly handle global vs server-specific connection settings', () => {
      // Global connection settings
      const globalConnection = MCPConnectionConfigSchema.parse({
        maxRetries: 3,
        requestTimeoutMs: 30000,
        poolSize: 1,
        healthCheckIntervalMs: 60000,
        heartbeatEnabled: false,
      });

      // Server with specific connection overrides
      const serverWithOverrides = MCPServerConfigSchema.parse({
        name: 'high-performance-server',
        type: 'stdio',
        command: 'node',
        connection: {
          maxRetries: 10, // Override global
          requestTimeoutMs: 5000, // Override global
          poolSize: 5, // Override global
          // healthCheckIntervalMs not specified - should inherit global
          heartbeatEnabled: true, // Override global
          heartbeatIntervalMs: 15000, // New setting
        },
      });

      // Server without connection overrides
      const serverWithoutOverrides = MCPServerConfigSchema.parse({
        name: 'standard-server',
        type: 'http',
        url: 'https://api.example.com',
        // No connection specified - should use global
      });

      // Create MCP config
      const mcpConfig = MCPConfigSchema.parse({
        enabled: true,
        servers: {
          'high-performance': serverWithOverrides,
          'standard': serverWithoutOverrides,
        },
        connection: globalConnection,
      });

      // Verify inheritance and overrides
      expect(mcpConfig.connection?.maxRetries).toBe(3); // Global setting
      expect(mcpConfig.servers['high-performance'].connection?.maxRetries).toBe(10); // Override
      expect(mcpConfig.servers['high-performance'].connection?.heartbeatEnabled).toBe(true); // Override
      expect(mcpConfig.servers['standard'].connection).toBeUndefined(); // Should inherit global
    });

    it('should handle environment variable inheritance from templates', () => {
      // Template with base environment variables
      const baseTemplate = MCPTemplateSchema.parse({
        id: 'web-server',
        name: 'Web Server',
        description: 'HTTP web server template',
        package: '@mcp/web-server',
        config: {
          name: 'web',
          type: 'http',
        },
        envVars: [
          {
            name: 'PORT',
            description: 'Server port number',
            required: false,
            sensitive: false,
            defaultValue: '3000',
            source: 'config',
          },
          {
            name: 'HOST',
            description: 'Server host address',
            required: false,
            sensitive: false,
            defaultValue: 'localhost',
            source: 'config',
          },
        ],
      });

      // Server config that extends template with additional env vars
      const extendedServerConfig = MCPServerConfigSchema.parse({
        ...baseTemplate.config,
        url: 'https://api.custom.com',
        envVars: [
          ...baseTemplate.envVars,
          {
            name: 'API_KEY',
            description: 'Custom API key',
            required: true,
            sensitive: true,
            source: 'user',
          },
        ],
        env: {
          NODE_ENV: 'production',
          DEBUG: 'false',
        },
      });

      // Verify environment variable inheritance and extension
      expect(extendedServerConfig.envVars).toHaveLength(3);
      expect(extendedServerConfig.envVars?.[0].name).toBe('PORT');
      expect(extendedServerConfig.envVars?.[1].name).toBe('HOST');
      expect(extendedServerConfig.envVars?.[2].name).toBe('API_KEY');
      expect(extendedServerConfig.envVars?.[2].sensitive).toBe(true);
      expect(extendedServerConfig.env?.NODE_ENV).toBe('production');
    });

    it('should handle capability aggregation across templates and servers', () => {
      // Template with base capabilities
      const storageTemplate = MCPTemplateSchema.parse({
        id: 'storage',
        name: 'Storage Server',
        description: 'File storage operations',
        package: '@mcp/storage-server',
        config: {
          name: 'storage',
          type: 'stdio',
        },
        capabilities: ['storage', 'read', 'write'],
      });

      // Server that extends template capabilities
      const enhancedServer = MCPServerConfigSchema.parse({
        ...storageTemplate.config,
        command: 'node',
        capabilities: [
          ...storageTemplate.capabilities,
          'compression',
          'encryption',
          'backup',
        ],
      });

      // Verify capability aggregation
      expect(enhancedServer.capabilities).toHaveLength(6);
      expect(enhancedServer.capabilities).toContain('storage');
      expect(enhancedServer.capabilities).toContain('read');
      expect(enhancedServer.capabilities).toContain('write');
      expect(enhancedServer.capabilities).toContain('compression');
      expect(enhancedServer.capabilities).toContain('encryption');
      expect(enhancedServer.capabilities).toContain('backup');
    });
  });

  describe('Error handling and validation across schemas', () => {
    it('should validate cross-schema consistency', () => {
      // Template with specific requirements
      const strictTemplate = MCPTemplateSchema.parse({
        id: 'strict-server',
        name: 'Strict Server',
        description: 'Server with strict requirements',
        package: '@mcp/strict-server',
        config: {
          name: 'strict',
          type: 'stdio',
        },
        envVars: [
          {
            name: 'REQUIRED_SECRET',
            description: 'Required secret key',
            required: true,
            sensitive: true,
            source: 'user',
          },
        ],
        verified: true,
        minVersion: '2.0.0',
      });

      // Server config that properly implements template requirements
      const validServerConfig = MCPServerConfigSchema.parse({
        ...strictTemplate.config,
        command: 'npx',
        args: ['@mcp/strict-server@^2.0.0'],
        envVars: strictTemplate.envVars,
        autoStart: false, // Manual start due to required secret
      });

      // Installation that references the server
      const validInstallation = MCPInstallationSchema.parse({
        id: 'strict-install-001',
        serverId: 'strict', // Matches server config name
        installedAt: new Date(),
        status: 'pending', // Pending until secret is provided
        configPath: '/etc/mcp/strict.json',
      });

      // Verify consistency
      expect(validServerConfig.name).toBe('strict');
      expect(validInstallation.serverId).toBe('strict');
      expect(validServerConfig.envVars?.[0].required).toBe(true);
      expect(validInstallation.status).toBe('pending');
    });

    it('should handle complex marketplace and server interactions', () => {
      // Marketplace configuration
      const marketplace = MCPMarketplaceSourceSchema.parse({
        url: 'https://marketplace.mcp.io/v1/servers',
        enabled: true,
        refreshIntervalMinutes: 60,
        allowUnverified: false,
      });

      // Template from marketplace (verified)
      const marketplaceTemplate = MCPTemplateSchema.parse({
        id: 'verified-server',
        name: 'Verified Server',
        description: 'A verified server from marketplace',
        package: '@verified/mcp-server',
        config: {
          name: 'verified',
          type: 'http',
          url: 'https://verified-api.com',
        },
        verified: true, // Matches marketplace allowUnverified: false
        defaultEnabled: false,
        category: 'productivity',
      });

      // MCP configuration using marketplace
      const mcpConfig = MCPConfigSchema.parse({
        enabled: true,
        servers: {
          verified: {
            ...marketplaceTemplate.config,
            autoStart: marketplaceTemplate.defaultEnabled,
          },
        },
        marketplace,
      });

      // Verify marketplace integration
      expect(marketplace.allowUnverified).toBe(false);
      expect(marketplaceTemplate.verified).toBe(true);
      expect(mcpConfig.servers.verified.autoStart).toBe(false);
      expect(mcpConfig.marketplace?.refreshIntervalMinutes).toBe(60);
    });
  });

  describe('Performance and scalability scenarios', () => {
    it('should handle large-scale MCP configurations', () => {
      // Create many server configurations
      const servers: Record<string, any> = {};

      for (let i = 0; i < 50; i++) {
        const serverConfig = MCPServerConfigSchema.parse({
          name: `server-${i}`,
          type: i % 2 === 0 ? 'stdio' : 'http',
          command: i % 2 === 0 ? 'node' : undefined,
          url: i % 2 === 1 ? `https://api-${i}.example.com` : undefined,
          autoStart: i < 10, // Only first 10 auto-start
          capabilities: [`capability-${i}`, `shared-capability`],
          connection: {
            maxRetries: Math.min(i + 1, 10),
            requestTimeoutMs: 30000 + (i * 1000),
            poolSize: Math.max(1, Math.floor(i / 10) + 1),
          },
        });

        servers[`server-${i}`] = serverConfig;
      }

      // Create large MCP configuration
      const largeMcpConfig = MCPConfigSchema.parse({
        enabled: true,
        servers,
        connection: {
          maxRetries: 3,
          requestTimeoutMs: 30000,
          poolSize: 1,
        },
      });

      // Verify large configuration handling
      expect(Object.keys(largeMcpConfig.servers)).toHaveLength(50);
      expect(largeMcpConfig.servers['server-0'].autoStart).toBe(true);
      expect(largeMcpConfig.servers['server-49'].autoStart).toBe(false);
      expect(largeMcpConfig.servers['server-25'].type).toBe('http');
      expect(largeMcpConfig.servers['server-24'].type).toBe('stdio');
    });

    it('should handle complex nested configurations', () => {
      // Complex server with all possible nested configurations
      const complexServer = MCPServerConfigSchema.parse({
        name: 'complex-enterprise-server',
        type: 'http',
        url: 'https://enterprise-api.company.com/mcp/v2',
        headers: {
          'Authorization': 'Bearer enterprise-token',
          'X-Client-ID': 'apex-mcp-client',
          'X-API-Version': 'v2',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'APEX-MCP-Client/1.0',
        },
        envVars: [
          {
            name: 'ENTERPRISE_LICENSE_KEY',
            description: 'Enterprise license key for advanced features',
            required: true,
            sensitive: true,
            source: 'user',
          },
          {
            name: 'CACHE_TTL_SECONDS',
            description: 'Cache time-to-live in seconds',
            required: false,
            sensitive: false,
            defaultValue: '3600',
            source: 'config',
          },
          {
            name: 'MAX_CONCURRENT_REQUESTS',
            description: 'Maximum concurrent API requests',
            required: false,
            sensitive: false,
            defaultValue: '10',
            pattern: '^[1-9][0-9]*$',
            source: 'config',
          },
        ],
        autoStart: false,
        capabilities: [
          'enterprise-api',
          'advanced-analytics',
          'custom-workflows',
          'audit-logging',
          'role-based-access',
          'multi-tenant',
        ],
        connection: {
          maxRetries: 5,
          requestTimeoutMs: 60000,
          connectionTimeoutMs: 15000,
          readTimeoutMs: 45000,
          writeTimeoutMs: 30000,
          idleTimeoutMs: 600000,
          poolSize: 3,
          healthCheckIntervalMs: 120000,
          healthCheckTimeoutMs: 10000,
          heartbeatEnabled: true,
          heartbeatIntervalMs: 60000,
          keepAliveIntervalMs: 30000,
        },
      });

      // Verify complex nested configuration
      expect(complexServer.name).toBe('complex-enterprise-server');
      expect(Object.keys(complexServer.headers || {})).toHaveLength(6);
      expect(complexServer.envVars).toHaveLength(3);
      expect(complexServer.capabilities).toHaveLength(6);
      expect(complexServer.connection?.maxRetries).toBe(5);
      expect(complexServer.connection?.poolSize).toBe(3);
      expect(complexServer.envVars?.[0].sensitive).toBe(true);
      expect(complexServer.envVars?.[2].pattern).toBe('^[1-9][0-9]*$');
    });
  });

  describe('Backwards compatibility and migration', () => {
    it('should handle legacy configuration formats', () => {
      // Minimal legacy-style configuration
      const legacyServer = MCPServerConfigSchema.parse({
        name: 'legacy-server',
        // type defaults to 'stdio'
        command: 'node',
        args: ['legacy-server.js'],
        env: {
          'OLD_CONFIG_PATH': '/etc/legacy/config',
        },
        // autoStart defaults to false
      });

      // Modern equivalent
      const modernServer = MCPServerConfigSchema.parse({
        name: 'modern-server',
        type: 'stdio',
        command: 'node',
        args: ['modern-server.js'],
        envVars: [
          {
            name: 'CONFIG_PATH',
            description: 'Path to configuration file',
            required: false,
            sensitive: false,
            defaultValue: '/etc/modern/config',
            source: 'config',
          },
        ],
        autoStart: false,
        capabilities: ['modern-features'],
        connection: {
          maxRetries: 3,
          requestTimeoutMs: 30000,
        },
      });

      // Both should be valid
      expect(legacyServer.name).toBe('legacy-server');
      expect(legacyServer.type).toBe('stdio'); // Default value
      expect(legacyServer.autoStart).toBe(false); // Default value
      expect(modernServer.envVars?.[0].name).toBe('CONFIG_PATH');
      expect(modernServer.capabilities).toContain('modern-features');
    });

    it('should handle template evolution and versioning', () => {
      // V1 template (simpler)
      const templateV1 = MCPTemplateSchema.parse({
        id: 'evolving-server',
        name: 'Evolving Server',
        description: 'A server that evolves over time',
        package: '@mcp/evolving-server',
        config: {
          name: 'evolving',
          type: 'stdio',
          command: 'node',
        },
        capabilities: ['basic-feature'],
        verified: false,
      });

      // V2 template (enhanced)
      const templateV2 = MCPTemplateSchema.parse({
        id: 'evolving-server',
        name: 'Evolving Server',
        description: 'A server that evolves over time - now with advanced features',
        package: '@mcp/evolving-server',
        config: {
          name: 'evolving',
          type: 'stdio',
          command: 'node',
          args: ['--enable-v2-features'],
        },
        envVars: [
          {
            name: 'ENABLE_ADVANCED_MODE',
            description: 'Enable advanced features in v2',
            required: false,
            sensitive: false,
            defaultValue: 'true',
            source: 'config',
          },
        ],
        capabilities: ['basic-feature', 'advanced-feature', 'v2-exclusive'],
        verified: true,
        defaultEnabled: false,
        category: 'enhanced',
        tags: ['v2', 'advanced'],
        minVersion: '2.0.0',
      });

      // Both versions should be valid
      expect(templateV1.capabilities).toHaveLength(1);
      expect(templateV2.capabilities).toHaveLength(3);
      expect(templateV2.capabilities).toContain('basic-feature'); // Backwards compatible
      expect(templateV2.envVars).toHaveLength(1);
      expect(templateV2.minVersion).toBe('2.0.0');
    });
  });
});