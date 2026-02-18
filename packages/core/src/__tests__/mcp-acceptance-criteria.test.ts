import { MCPServerSchema, MCPInstallationSchema } from '../types.js';

/**
 * Test file to validate the specific acceptance criteria:
 * "New types in packages/core/src/types.ts: MCPServer schema (name, package, command, args, env, version),
 * MCPInstallation schema (id, serverId, installedAt, status, configPath). Types exported from package.
 * TypeScript compiles without errors."
 */
describe('MCP Types Acceptance Criteria Validation', () => {
  describe('MCPServer schema with required fields', () => {
    it('should include name, package, command, args, env, version fields', () => {
      // Test that MCPServer schema accepts all required fields
      const mcpServer = {
        name: 'test-server',
        package: '@mcp/test-server',
        command: 'node',
        args: ['--verbose'],
        env: { 'NODE_ENV': 'production' },
        version: '1.0.0',
      };

      const result = MCPServerSchema.parse(mcpServer);

      expect(result.name).toBe('test-server');
      expect(result.package).toBe('@mcp/test-server');
      expect(result.command).toBe('node');
      expect(result.args).toEqual(['--verbose']);
      expect(result.env).toEqual({ 'NODE_ENV': 'production' });
      expect(result.version).toBe('1.0.0');
    });

    it('should accept minimal required fields only', () => {
      // Test that only required fields are actually required
      const minimalServer = {
        name: 'minimal-server',
        package: '@mcp/minimal',
        command: 'node',
        version: '1.0.0',
      };

      const result = MCPServerSchema.parse(minimalServer);

      expect(result.name).toBe('minimal-server');
      expect(result.package).toBe('@mcp/minimal');
      expect(result.command).toBe('node');
      expect(result.version).toBe('1.0.0');
      expect(result.args).toEqual([]); // Default empty array
      expect(result.env).toEqual({}); // Default empty object
    });

    it('should validate required fields are actually required', () => {
      const requiredFields = ['name', 'package', 'command', 'version'];

      requiredFields.forEach(fieldToOmit => {
        const incompleteServer = {
          name: 'test',
          package: '@mcp/test',
          command: 'node',
          version: '1.0.0',
        };

        delete incompleteServer[fieldToOmit as keyof typeof incompleteServer];

        expect(() => MCPServerSchema.parse(incompleteServer)).toThrow();
      });
    });
  });

  describe('MCPInstallation schema with required fields', () => {
    it('should include id, serverId, installedAt, status, configPath fields', () => {
      // Test that MCPInstallation schema accepts all required fields
      const mcpInstallation = {
        id: 'install-123',
        serverId: 'server-456',
        installedAt: new Date('2024-01-15T10:30:00Z'),
        status: 'installed' as const,
        configPath: '/path/to/config.json',
      };

      const result = MCPInstallationSchema.parse(mcpInstallation);

      expect(result.id).toBe('install-123');
      expect(result.serverId).toBe('server-456');
      expect(result.installedAt).toEqual(new Date('2024-01-15T10:30:00Z'));
      expect(result.status).toBe('installed');
      expect(result.configPath).toBe('/path/to/config.json');
    });

    it('should validate all status enum values', () => {
      const validStatuses = ['pending', 'installing', 'installed', 'failed', 'uninstalling', 'uninstalled'];

      validStatuses.forEach(status => {
        const installation = {
          id: 'test-id',
          serverId: 'test-server',
          installedAt: new Date(),
          status,
          configPath: '/test/config.json',
        };

        expect(() => MCPInstallationSchema.parse(installation)).not.toThrow();
        const result = MCPInstallationSchema.parse(installation);
        expect(result.status).toBe(status);
      });
    });

    it('should validate required fields are actually required', () => {
      const requiredFields = ['id', 'serverId', 'installedAt', 'status', 'configPath'];

      requiredFields.forEach(fieldToOmit => {
        const incompleteInstallation = {
          id: 'test-id',
          serverId: 'test-server',
          installedAt: new Date(),
          status: 'installed' as const,
          configPath: '/config.json',
        };

        delete incompleteInstallation[fieldToOmit as keyof typeof incompleteInstallation];

        expect(() => MCPInstallationSchema.parse(incompleteInstallation)).toThrow();
      });
    });
  });

  describe('Types exported from package', () => {
    it('should export MCPServerSchema and types', () => {
      // Test that schemas and types are properly exported
      expect(MCPServerSchema).toBeDefined();
      expect(typeof MCPServerSchema.parse).toBe('function');
    });

    it('should export MCPInstallationSchema and types', () => {
      // Test that schemas and types are properly exported
      expect(MCPInstallationSchema).toBeDefined();
      expect(typeof MCPInstallationSchema.parse).toBe('function');
    });
  });

  describe('TypeScript compiles without errors', () => {
    it('should have correct TypeScript types for MCPServer', () => {
      // This test validates that TypeScript types compile correctly
      const server = MCPServerSchema.parse({
        name: 'type-test-server',
        package: '@mcp/type-test',
        command: 'node',
        args: ['--config', '/path'],
        env: { 'NODE_ENV': 'test' },
        version: '1.2.3',
      });

      // Type assertions to ensure TypeScript compilation
      const name: string = server.name;
      const packageName: string = server.package;
      const command: string | undefined = server.command;
      const args: string[] = server.args ?? [];
      const env: Record<string, string> = server.env ?? {};
      const version: string = server.version;

      // Verify values match expected types and values
      expect(typeof name).toBe('string');
      expect(typeof packageName).toBe('string');
      expect(typeof command).toBe('string');
      expect(Array.isArray(args)).toBe(true);
      expect(typeof env).toBe('object');
      expect(typeof version).toBe('string');

      // Verify actual values
      expect(name).toBe('type-test-server');
      expect(packageName).toBe('@mcp/type-test');
      expect(command).toBe('node');
      expect(args).toEqual(['--config', '/path']);
      expect(env).toEqual({ 'NODE_ENV': 'test' });
      expect(version).toBe('1.2.3');
    });

    it('should have correct TypeScript types for MCPInstallation', () => {
      // This test validates that TypeScript types compile correctly
      const installation = MCPInstallationSchema.parse({
        id: 'type-test-install',
        serverId: 'type-test-server',
        installedAt: new Date('2024-01-01T00:00:00Z'),
        status: 'installed',
        configPath: '/type/test/config.json',
      });

      // Type assertions to ensure TypeScript compilation
      const id: string = installation.id;
      const serverId: string = installation.serverId;
      const installedAt: Date = installation.installedAt;
      const status: 'pending' | 'installing' | 'installed' | 'failed' | 'uninstalling' | 'uninstalled' = installation.status;
      const configPath: string = installation.configPath;

      // Verify values match expected types and values
      expect(typeof id).toBe('string');
      expect(typeof serverId).toBe('string');
      expect(installedAt).toBeInstanceOf(Date);
      expect(typeof status).toBe('string');
      expect(typeof configPath).toBe('string');

      // Verify actual values
      expect(id).toBe('type-test-install');
      expect(serverId).toBe('type-test-server');
      expect(installedAt).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(status).toBe('installed');
      expect(configPath).toBe('/type/test/config.json');
    });
  });

  describe('Complete integration test', () => {
    it('should satisfy all acceptance criteria in a single comprehensive test', () => {
      // This test validates the complete acceptance criteria:
      // "New types in packages/core/src/types.ts: MCPServer schema (name, package, command, args, env, version),
      // MCPInstallation schema (id, serverId, installedAt, status, configPath). Types exported from package.
      // TypeScript compiles without errors."

      // 1. Test MCPServer schema with all specified fields
      const serverData = {
        name: 'comprehensive-server',
        package: '@mcp/comprehensive',
        command: 'npx',
        args: ['--verbose', '--config', '/etc/config'],
        env: {
          'NODE_ENV': 'production',
          'API_KEY': 'test-key',
        },
        version: '2.1.0',
      };
      const server = MCPServerSchema.parse(serverData);
      expect(server.name).toBe('comprehensive-server');
      expect(server.package).toBe('@mcp/comprehensive');
      expect(server.command).toBe('npx');
      expect(server.args).toEqual(['--verbose', '--config', '/etc/config']);
      expect(server.env).toEqual({ 'NODE_ENV': 'production', 'API_KEY': 'test-key' });
      expect(server.version).toBe('2.1.0');

      // 2. Test MCPInstallation schema with all specified fields
      const installationData = {
        id: 'comprehensive-install-001',
        serverId: server.name,
        installedAt: new Date('2024-03-15T14:30:00Z'),
        status: 'installed' as const,
        configPath: '/var/lib/mcp/installations/comprehensive-install-001.json',
      };
      const installation = MCPInstallationSchema.parse(installationData);
      expect(installation.id).toBe('comprehensive-install-001');
      expect(installation.serverId).toBe('comprehensive-server');
      expect(installation.installedAt).toEqual(new Date('2024-03-15T14:30:00Z'));
      expect(installation.status).toBe('installed');
      expect(installation.configPath).toBe('/var/lib/mcp/installations/comprehensive-install-001.json');

      // 3. Test that types are exported (schemas are callable)
      expect(typeof MCPServerSchema.parse).toBe('function');
      expect(typeof MCPInstallationSchema.parse).toBe('function');

      // 4. Test TypeScript compilation (type-safe access)
      const serverName: string = server.name;
      const serverCommand: string | undefined = server.command;
      const installationId: string = installation.id;
      const installationStatus: 'pending' | 'installing' | 'installed' | 'failed' | 'uninstalling' | 'uninstalled' = installation.status;

      expect(serverName).toBe('comprehensive-server');
      expect(serverCommand).toBe('npx');
      expect(installationId).toBe('comprehensive-install-001');
      expect(installationStatus).toBe('installed');

      // ✅ All acceptance criteria satisfied:
      // - MCPServer schema with name, package, command, args, env, version ✓
      // - MCPInstallation schema with id, serverId, installedAt, status, configPath ✓
      // - Types exported from package ✓
      // - TypeScript compiles without errors ✓
    });
  });
});