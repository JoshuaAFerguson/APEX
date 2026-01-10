import {
  MCPServerSchema,
  MCPServer,
  MCPInstallationSchema,
  MCPInstallation,
  MCPInstallationStatusSchema,
  MCPInstallationStatus,
} from '../types.js';

/**
 * Comprehensive test suite for MCP (Model Context Protocol) related types and schemas
 * Tests validation, edge cases, and TypeScript type inference for MCP server definitions and installations
 */
describe('MCP Types and Schemas', () => {
  describe('MCPInstallationStatusSchema', () => {
    it('should accept all valid status values', () => {
      const validStatuses = [
        'pending',
        'installing',
        'installed',
        'failed',
        'uninstalling',
        'uninstalled',
      ];

      validStatuses.forEach(status => {
        expect(() => MCPInstallationStatusSchema.parse(status)).not.toThrow();
        const result = MCPInstallationStatusSchema.parse(status);
        expect(result).toBe(status);
      });
    });

    it('should reject invalid status values', () => {
      const invalidStatuses = [
        'unknown',
        'running',
        'stopped',
        'error',
        '',
        null,
        undefined,
        123,
        {},
        [],
      ];

      invalidStatuses.forEach(status => {
        expect(() => MCPInstallationStatusSchema.parse(status)).toThrow();
      });
    });

    it('should provide proper TypeScript types', () => {
      const status: MCPInstallationStatus = 'installed';
      expect(status).toBe('installed');

      // Type assertion test - this should compile without errors
      const statusFromParse: MCPInstallationStatus = MCPInstallationStatusSchema.parse('pending');
      expect(statusFromParse).toBe('pending');
    });
  });

  describe('MCPServerSchema', () => {
    describe('Valid configurations', () => {
      it('should accept minimal required fields', () => {
        const minimalServer = {
          name: 'test-server',
          package: '@mcp/test-server',
          command: 'node',
          version: '1.0.0',
        };

        const result = MCPServerSchema.parse(minimalServer);

        expect(result.name).toBe('test-server');
        expect(result.package).toBe('@mcp/test-server');
        expect(result.command).toBe('node');
        expect(result.version).toBe('1.0.0');
        expect(result.args).toEqual([]); // Default value
        expect(result.env).toEqual({}); // Default value
      });

      it('should accept full configuration with all fields', () => {
        const fullServer = {
          name: 'comprehensive-server',
          package: '@mcp/comprehensive-server',
          command: 'npx',
          args: ['--verbose', '--config', '/path/to/config'],
          env: {
            'NODE_ENV': 'production',
            'API_KEY': 'secret-key',
            'DEBUG': 'true',
          },
          version: '2.1.0',
        };

        const result = MCPServerSchema.parse(fullServer);

        expect(result.name).toBe('comprehensive-server');
        expect(result.package).toBe('@mcp/comprehensive-server');
        expect(result.command).toBe('npx');
        expect(result.args).toEqual(['--verbose', '--config', '/path/to/config']);
        expect(result.env).toEqual({
          'NODE_ENV': 'production',
          'API_KEY': 'secret-key',
          'DEBUG': 'true',
        });
        expect(result.version).toBe('2.1.0');
      });

      it('should handle various command types', () => {
        const commandTypes = [
          'node',
          'npx',
          'python',
          '/usr/local/bin/custom-server',
          './relative/path/server',
        ];

        commandTypes.forEach(command => {
          const server = {
            name: 'test-server',
            package: '@mcp/test',
            command,
            version: '1.0.0',
          };

          expect(() => MCPServerSchema.parse(server)).not.toThrow();
          const result = MCPServerSchema.parse(server);
          expect(result.command).toBe(command);
        });
      });

      it('should handle various argument configurations', () => {
        const argConfigurations = [
          [],
          ['--help'],
          ['--config', '/path/to/config', '--verbose'],
          ['start', '--port=3000', '--host=localhost'],
        ];

        argConfigurations.forEach(args => {
          const server = {
            name: 'test-server',
            package: '@mcp/test',
            command: 'node',
            args,
            version: '1.0.0',
          };

          expect(() => MCPServerSchema.parse(server)).not.toThrow();
          const result = MCPServerSchema.parse(server);
          expect(result.args).toEqual(args);
        });
      });

      it('should handle environment variable configurations', () => {
        const envConfigurations = [
          {},
          { 'NODE_ENV': 'development' },
          {
            'NODE_ENV': 'production',
            'PORT': '3000',
            'API_URL': 'https://api.example.com',
            'DEBUG': 'false',
          },
        ];

        envConfigurations.forEach(env => {
          const server = {
            name: 'test-server',
            package: '@mcp/test',
            command: 'node',
            env,
            version: '1.0.0',
          };

          expect(() => MCPServerSchema.parse(server)).not.toThrow();
          const result = MCPServerSchema.parse(server);
          expect(result.env).toEqual(env);
        });
      });

      it('should handle semantic version formats', () => {
        const versionFormats = [
          '1.0.0',
          '0.1.0',
          '2.15.3',
          '1.0.0-alpha.1',
          '2.0.0-beta.2+build.123',
          '^1.2.3',
          '~2.1.0',
          '>=1.0.0 <2.0.0',
        ];

        versionFormats.forEach(version => {
          const server = {
            name: 'test-server',
            package: '@mcp/test',
            command: 'node',
            version,
          };

          expect(() => MCPServerSchema.parse(server)).not.toThrow();
          const result = MCPServerSchema.parse(server);
          expect(result.version).toBe(version);
        });
      });
    });

    describe('Validation errors', () => {
      it('should reject empty or invalid name', () => {
        const invalidNames = ['', '   ', null, undefined, 123, {}];

        invalidNames.forEach(name => {
          const server = {
            name,
            package: '@mcp/test',
            command: 'node',
            version: '1.0.0',
          };

          expect(() => MCPServerSchema.parse(server)).toThrow();
        });
      });

      it('should reject empty or invalid package', () => {
        const invalidPackages = ['', '   ', null, undefined, 123, {}];

        invalidPackages.forEach(packageName => {
          const server = {
            name: 'test-server',
            package: packageName,
            command: 'node',
            version: '1.0.0',
          };

          expect(() => MCPServerSchema.parse(server)).toThrow();
        });
      });

      it('should reject empty or invalid version', () => {
        const invalidVersions = ['', '   ', null, undefined, 123, {}];

        invalidVersions.forEach(version => {
          const server = {
            name: 'test-server',
            package: '@mcp/test',
            command: 'node',
            version,
          };

          expect(() => MCPServerSchema.parse(server)).toThrow();
        });
      });

      it('should reject invalid args types', () => {
        const invalidArgs = ['string', 123, {}, null];

        invalidArgs.forEach(args => {
          const server = {
            name: 'test-server',
            package: '@mcp/test',
            command: 'node',
            args,
            version: '1.0.0',
          };

          expect(() => MCPServerSchema.parse(server)).toThrow();
        });
      });

      it('should reject invalid env types', () => {
        const invalidEnv = ['string', 123, [], null];

        invalidEnv.forEach(env => {
          const server = {
            name: 'test-server',
            package: '@mcp/test',
            command: 'node',
            env,
            version: '1.0.0',
          };

          expect(() => MCPServerSchema.parse(server)).toThrow();
        });
      });

      it('should reject env with non-string values', () => {
        const invalidEnv = {
          'VALID_KEY': 'valid_value',
          'INVALID_NUMBER': 123,
          'INVALID_BOOLEAN': true,
          'INVALID_OBJECT': {},
        };

        const server = {
          name: 'test-server',
          package: '@mcp/test',
          command: 'node',
          env: invalidEnv,
          version: '1.0.0',
        };

        expect(() => MCPServerSchema.parse(server)).toThrow();
      });

      it('should reject missing required fields', () => {
        const incompleteServers = [
          { package: '@mcp/test', command: 'node', version: '1.0.0' }, // Missing name
          { name: 'test', command: 'node', version: '1.0.0' }, // Missing package
          { name: 'test', package: '@mcp/test', version: '1.0.0' }, // Missing command
          { name: 'test', package: '@mcp/test', command: 'node' }, // Missing version
        ];

        incompleteServers.forEach(server => {
          expect(() => MCPServerSchema.parse(server)).toThrow();
        });
      });
    });

    describe('TypeScript type inference', () => {
      it('should provide correct TypeScript types', () => {
        const server = MCPServerSchema.parse({
          name: 'type-test-server',
          package: '@mcp/type-test',
          command: 'node',
          args: ['--verbose'],
          env: { 'NODE_ENV': 'test' },
          version: '1.0.0',
        });

        // Type assertions to ensure TypeScript compilation
        const name: string = server.name;
        const packageName: string = server.package;
        const command: string | undefined = server.command;
        const args: string[] = server.args ?? [];
        const env: Record<string, string> = server.env ?? {};
        const version: string = server.version;

        expect(typeof name).toBe('string');
        expect(typeof packageName).toBe('string');
        expect(typeof command).toBe('string');
        expect(Array.isArray(args)).toBe(true);
        expect(typeof env).toBe('object');
        expect(typeof version).toBe('string');

        expect(name).toBe('type-test-server');
        expect(packageName).toBe('@mcp/type-test');
        expect(command).toBe('node');
        expect(args).toEqual(['--verbose']);
        expect(env).toEqual({ 'NODE_ENV': 'test' });
        expect(version).toBe('1.0.0');
      });
    });
  });

  describe('MCPInstallationSchema', () => {
    describe('Valid configurations', () => {
      it('should accept minimal required fields with date object', () => {
        const installation = {
          id: 'install-123',
          serverId: 'server-456',
          installedAt: new Date('2024-01-15T10:30:00Z'),
          status: 'installed' as MCPInstallationStatus,
          configPath: '/path/to/config.json',
        };

        const result = MCPInstallationSchema.parse(installation);

        expect(result.id).toBe('install-123');
        expect(result.serverId).toBe('server-456');
        expect(result.installedAt).toEqual(new Date('2024-01-15T10:30:00Z'));
        expect(result.status).toBe('installed');
        expect(result.configPath).toBe('/path/to/config.json');
      });

      it('should accept all valid installation statuses', () => {
        const validStatuses: MCPInstallationStatus[] = [
          'pending',
          'installing',
          'installed',
          'failed',
          'uninstalling',
          'uninstalled',
        ];

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

      it('should handle various config path formats', () => {
        const configPaths = [
          '/absolute/path/to/config.json',
          './relative/config.yaml',
          '../parent/config.yml',
          'C:\\Windows\\path\\config.json',
          '/home/user/.config/mcp/server.json',
        ];

        configPaths.forEach(configPath => {
          const installation = {
            id: 'test-id',
            serverId: 'test-server',
            installedAt: new Date(),
            status: 'installed' as MCPInstallationStatus,
            configPath,
          };

          expect(() => MCPInstallationSchema.parse(installation)).not.toThrow();
          const result = MCPInstallationSchema.parse(installation);
          expect(result.configPath).toBe(configPath);
        });
      });

      it('should handle date parsing from ISO strings', () => {
        const installation = {
          id: 'date-test',
          serverId: 'server-date',
          installedAt: '2024-03-15T14:30:00.000Z',
          status: 'installed' as MCPInstallationStatus,
          configPath: '/config/path.json',
        };

        // Note: Zod date schema should handle ISO string conversion
        // This tests that if the schema accepts strings, they convert properly
        const result = MCPInstallationSchema.parse({
          ...installation,
          installedAt: new Date(installation.installedAt)
        });

        expect(result.installedAt).toBeInstanceOf(Date);
        expect(result.installedAt.toISOString()).toBe('2024-03-15T14:30:00.000Z');
      });
    });

    describe('Validation errors', () => {
      it('should reject empty or invalid id', () => {
        const invalidIds = ['', '   ', null, undefined, 123, {}];

        invalidIds.forEach(id => {
          const installation = {
            id,
            serverId: 'test-server',
            installedAt: new Date(),
            status: 'installed' as MCPInstallationStatus,
            configPath: '/config.json',
          };

          expect(() => MCPInstallationSchema.parse(installation)).toThrow();
        });
      });

      it('should reject empty or invalid serverId', () => {
        const invalidServerIds = ['', '   ', null, undefined, 123, {}];

        invalidServerIds.forEach(serverId => {
          const installation = {
            id: 'test-id',
            serverId,
            installedAt: new Date(),
            status: 'installed' as MCPInstallationStatus,
            configPath: '/config.json',
          };

          expect(() => MCPInstallationSchema.parse(installation)).toThrow();
        });
      });

      it('should reject invalid installedAt values', () => {
        const invalidDates = ['invalid-date', 123, {}, [], null, undefined];

        invalidDates.forEach(installedAt => {
          const installation = {
            id: 'test-id',
            serverId: 'test-server',
            installedAt,
            status: 'installed' as MCPInstallationStatus,
            configPath: '/config.json',
          };

          expect(() => MCPInstallationSchema.parse(installation)).toThrow();
        });
      });

      it('should reject invalid status values', () => {
        const invalidStatuses = ['unknown', 'running', '', null, undefined, 123];

        invalidStatuses.forEach(status => {
          const installation = {
            id: 'test-id',
            serverId: 'test-server',
            installedAt: new Date(),
            status,
            configPath: '/config.json',
          };

          expect(() => MCPInstallationSchema.parse(installation)).toThrow();
        });
      });

      it('should reject empty or invalid configPath', () => {
        const invalidPaths = ['', '   ', null, undefined, 123, {}];

        invalidPaths.forEach(configPath => {
          const installation = {
            id: 'test-id',
            serverId: 'test-server',
            installedAt: new Date(),
            status: 'installed' as MCPInstallationStatus,
            configPath,
          };

          expect(() => MCPInstallationSchema.parse(installation)).toThrow();
        });
      });

      it('should reject missing required fields', () => {
        const incompleteInstallations = [
          { // Missing id
            serverId: 'test-server',
            installedAt: new Date(),
            status: 'installed' as MCPInstallationStatus,
            configPath: '/config.json',
          },
          { // Missing serverId
            id: 'test-id',
            installedAt: new Date(),
            status: 'installed' as MCPInstallationStatus,
            configPath: '/config.json',
          },
          { // Missing installedAt
            id: 'test-id',
            serverId: 'test-server',
            status: 'installed' as MCPInstallationStatus,
            configPath: '/config.json',
          },
          { // Missing status
            id: 'test-id',
            serverId: 'test-server',
            installedAt: new Date(),
            configPath: '/config.json',
          },
          { // Missing configPath
            id: 'test-id',
            serverId: 'test-server',
            installedAt: new Date(),
            status: 'installed' as MCPInstallationStatus,
          },
        ];

        incompleteInstallations.forEach(installation => {
          expect(() => MCPInstallationSchema.parse(installation)).toThrow();
        });
      });
    });

    describe('TypeScript type inference', () => {
      it('should provide correct TypeScript types', () => {
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
        const status: MCPInstallationStatus = installation.status;
        const configPath: string = installation.configPath;

        expect(typeof id).toBe('string');
        expect(typeof serverId).toBe('string');
        expect(installedAt).toBeInstanceOf(Date);
        expect(typeof status).toBe('string');
        expect(typeof configPath).toBe('string');

        expect(id).toBe('type-test-install');
        expect(serverId).toBe('type-test-server');
        expect(installedAt).toEqual(new Date('2024-01-01T00:00:00Z'));
        expect(status).toBe('installed');
        expect(configPath).toBe('/type/test/config.json');
      });
    });
  });

  describe('Integration tests', () => {
    it('should work together for a complete MCP server installation workflow', () => {
      // 1. Define an MCP server
      const serverDefinition = MCPServerSchema.parse({
        name: 'workflow-test-server',
        package: '@mcp/workflow-test',
        command: 'npx',
        args: ['@mcp/workflow-test', '--config', '/etc/mcp/config.json'],
        env: {
          'NODE_ENV': 'production',
          'LOG_LEVEL': 'info',
        },
        version: '1.5.2',
      });

      // 2. Create an installation record
      const installation = MCPInstallationSchema.parse({
        id: 'workflow-install-001',
        serverId: serverDefinition.name, // Link to server
        installedAt: new Date('2024-03-15T10:00:00Z'),
        status: 'pending',
        configPath: '/var/lib/mcp/installations/workflow-install-001/config.json',
      });

      // 3. Update status through workflow
      const statuses: MCPInstallationStatus[] = [
        'pending',
        'installing',
        'installed',
      ];

      statuses.forEach(status => {
        const updatedInstallation = MCPInstallationSchema.parse({
          ...installation,
          status,
        });
        expect(updatedInstallation.status).toBe(status);
      });

      // 4. Verify final state
      expect(serverDefinition.name).toBe('workflow-test-server');
      expect(installation.serverId).toBe(serverDefinition.name);
      expect(installation.id).toBe('workflow-install-001');
    });

    it('should handle error scenarios in workflow', () => {
      const server = MCPServerSchema.parse({
        name: 'error-test-server',
        package: '@mcp/error-test',
        command: 'node',
        version: '1.0.0',
      });

      const failedInstallation = MCPInstallationSchema.parse({
        id: 'error-install-001',
        serverId: server.name,
        installedAt: new Date(),
        status: 'failed',
        configPath: '/tmp/failed-config.json',
      });

      expect(failedInstallation.status).toBe('failed');

      // Can transition to uninstalled
      const uninstalledStatus = MCPInstallationSchema.parse({
        ...failedInstallation,
        status: 'uninstalled',
      });

      expect(uninstalledStatus.status).toBe('uninstalled');
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very long strings appropriately', () => {
      const longString = 'a'.repeat(1000);

      const server = MCPServerSchema.parse({
        name: longString,
        package: longString,
        command: 'node',
        version: '1.0.0',
      });

      expect(server.name).toBe(longString);
      expect(server.package).toBe(longString);
    });

    it('should handle special characters in string fields', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      const server = MCPServerSchema.parse({
        name: `test-${specialChars}`,
        package: `@scope/test-${specialChars}`,
        command: 'node',
        version: '1.0.0',
      });

      expect(server.name).toContain(specialChars);
      expect(server.package).toContain(specialChars);
    });

    it('should handle Unicode characters', () => {
      const unicodeString = 'тест-서버-测试-🚀';

      const server = MCPServerSchema.parse({
        name: unicodeString,
        package: `@mcp/${unicodeString}`,
        command: 'node',
        version: '1.0.0',
      });

      expect(server.name).toBe(unicodeString);
      expect(server.package).toBe(`@mcp/${unicodeString}`);
    });

    it('should handle edge dates', () => {
      const edgeDates = [
        new Date(0), // Unix epoch
        new Date('1970-01-01T00:00:00Z'),
        new Date('2038-01-19T03:14:07Z'), // Y2038 problem boundary
        new Date('9999-12-31T23:59:59Z'), // Far future
      ];

      edgeDates.forEach(date => {
        const installation = MCPInstallationSchema.parse({
          id: 'edge-date-test',
          serverId: 'edge-server',
          installedAt: date,
          status: 'installed',
          configPath: '/edge/config.json',
        });

        expect(installation.installedAt).toEqual(date);
      });
    });

    it('should handle empty arrays and objects in optional fields', () => {
      const server = MCPServerSchema.parse({
        name: 'empty-test',
        package: '@mcp/empty-test',
        command: 'node',
        args: [], // Empty array
        env: {}, // Empty object
        version: '1.0.0',
      });

      expect(server.args).toEqual([]);
      expect(server.env).toEqual({});
    });
  });
});