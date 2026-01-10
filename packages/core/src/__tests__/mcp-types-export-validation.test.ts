import {
  MCPServerSchema,
  MCPServer,
  MCPInstallationSchema,
  MCPInstallation,
  MCPInstallationStatusSchema,
  MCPInstallationStatus,
} from '../types.js';

/**
 * Test file to verify that MCP types are properly exported and accessible
 * This validates the "Types exported from package" acceptance criteria
 */
describe('MCP Types Export Validation', () => {
  describe('MCPServer exports', () => {
    it('should export MCPServerSchema', () => {
      expect(MCPServerSchema).toBeDefined();
      expect(typeof MCPServerSchema).toBe('object');
      expect(typeof MCPServerSchema.parse).toBe('function');
      expect(typeof MCPServerSchema.safeParse).toBe('function');
    });

    it('should have working MCPServer type (compile-time verification)', () => {
      // This function tests that the MCPServer type is properly exported
      // and usable at compile time - if this compiles, the type is working
      const createServer = (server: MCPServer): MCPServer => server;

      const testServer: MCPServer = {
        name: 'export-test-server',
        package: '@mcp/export-test',
        command: 'node',
        args: ['--test'],
        env: { 'TEST': 'true' },
        version: '1.0.0',
      };

      const result = createServer(testServer);
      expect(result.name).toBe('export-test-server');
    });
  });

  describe('MCPInstallation exports', () => {
    it('should export MCPInstallationSchema', () => {
      expect(MCPInstallationSchema).toBeDefined();
      expect(typeof MCPInstallationSchema).toBe('object');
      expect(typeof MCPInstallationSchema.parse).toBe('function');
      expect(typeof MCPInstallationSchema.safeParse).toBe('function');
    });

    it('should have working MCPInstallation type (compile-time verification)', () => {
      // This function tests that the MCPInstallation type is properly exported
      // and usable at compile time - if this compiles, the type is working
      const createInstallation = (installation: MCPInstallation): MCPInstallation => installation;

      const testInstallation: MCPInstallation = {
        id: 'export-test-install',
        serverId: 'export-test-server',
        installedAt: new Date(),
        status: 'installed',
        configPath: '/export/test/config.json',
      };

      const result = createInstallation(testInstallation);
      expect(result.id).toBe('export-test-install');
    });
  });

  describe('MCPInstallationStatus exports', () => {
    it('should export MCPInstallationStatusSchema', () => {
      expect(MCPInstallationStatusSchema).toBeDefined();
      expect(typeof MCPInstallationStatusSchema).toBe('object');
      expect(typeof MCPInstallationStatusSchema.parse).toBe('function');
      expect(typeof MCPInstallationStatusSchema.safeParse).toBe('function');
    });

    it('should have working MCPInstallationStatus type (compile-time verification)', () => {
      // This function tests that the MCPInstallationStatus type is properly exported
      // and usable at compile time - if this compiles, the type is working
      const processStatus = (status: MCPInstallationStatus): string => `Status: ${status}`;

      const testStatus: MCPInstallationStatus = 'installed';
      const result = processStatus(testStatus);
      expect(result).toBe('Status: installed');

      // Test all valid status values
      const allStatuses: MCPInstallationStatus[] = [
        'pending',
        'installing',
        'installed',
        'failed',
        'uninstalling',
        'uninstalled',
      ];

      allStatuses.forEach(status => {
        const statusResult = processStatus(status);
        expect(statusResult).toBe(`Status: ${status}`);
      });
    });
  });

  describe('Schema interoperability', () => {
    it('should use consistent types between schema and type definitions', () => {
      // Test that parsing with schema produces correct TypeScript types
      const serverData = {
        name: 'interop-server',
        package: '@mcp/interop',
        command: 'node',
        version: '1.0.0',
      };

      const parsedServer = MCPServerSchema.parse(serverData);

      // The parsed result should be assignable to the MCPServer type
      const typedServer: MCPServer = parsedServer;
      expect(typedServer.name).toBe('interop-server');

      const installationData = {
        id: 'interop-install',
        serverId: parsedServer.name,
        installedAt: new Date(),
        status: 'installed' as const,
        configPath: '/interop/config.json',
      };

      const parsedInstallation = MCPInstallationSchema.parse(installationData);

      // The parsed result should be assignable to the MCPInstallation type
      const typedInstallation: MCPInstallation = parsedInstallation;
      expect(typedInstallation.id).toBe('interop-install');
      expect(typedInstallation.serverId).toBe(typedServer.name);
    });

    it('should maintain type safety in function parameters', () => {
      // Test functions that accept the typed parameters
      const validateServer = (server: MCPServer): boolean => {
        return server.name.length > 0 && server.version.length > 0;
      };

      const validateInstallation = (installation: MCPInstallation): boolean => {
        return installation.id.length > 0 && installation.serverId.length > 0;
      };

      const server = MCPServerSchema.parse({
        name: 'function-test-server',
        package: '@mcp/function-test',
        command: 'node',
        version: '2.0.0',
      });

      const installation = MCPInstallationSchema.parse({
        id: 'function-test-install',
        serverId: server.name,
        installedAt: new Date(),
        status: 'installed',
        configPath: '/function/test/config.json',
      });

      // These should compile and work correctly
      expect(validateServer(server)).toBe(true);
      expect(validateInstallation(installation)).toBe(true);
    });
  });

  describe('Runtime validation', () => {
    it('should provide meaningful error messages for invalid data', () => {
      // Test that schemas provide helpful validation errors
      const invalidServer = {
        name: '', // Invalid: empty name
        package: '@mcp/test',
        command: 'node',
        version: '1.0.0',
      };

      expect(() => MCPServerSchema.parse(invalidServer)).toThrow();

      const result = MCPServerSchema.safeParse(invalidServer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        expect(result.error.issues[0].message).toContain('name');
      }
    });

    it('should validate status enum strictly', () => {
      const invalidInstallation = {
        id: 'test-install',
        serverId: 'test-server',
        installedAt: new Date(),
        status: 'invalid-status', // Invalid status
        configPath: '/test/config.json',
      };

      expect(() => MCPInstallationSchema.parse(invalidInstallation)).toThrow();

      const result = MCPInstallationSchema.safeParse(invalidInstallation);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('status'))).toBe(true);
      }
    });
  });
});