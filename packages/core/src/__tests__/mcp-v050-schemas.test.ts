import {
  MCPServerV050Schema,
  MCPInstallationV050Schema,
  MCPInstallProgressV050Schema,
  MCPServerV050,
  MCPInstallationV050,
  MCPInstallProgressV050,
  MCPServerCategorySchema,
  MCPInstallationStatusSchema,
  MCPInstallStageSchema,
  MCPServerConfigSchema,
} from '../types.js';
import { ZodError } from 'zod';

/**
 * Comprehensive tests for MCP v0.5.0 schemas
 * Tests all new schemas: MCPServerV050, MCPInstallationV050, and MCPInstallProgressV050
 */

describe('MCP v0.5.0 Schemas', () => {
  describe('MCPServerV050Schema', () => {
    describe('Valid data validation', () => {
      it('should validate minimal required fields', () => {
        const minimalServer = {
          id: 'test-server',
          name: 'Test Server',
          description: 'A test server',
          version: '1.0.0',
        };

        const result = MCPServerV050Schema.parse(minimalServer);
        expect(result.id).toBe('test-server');
        expect(result.name).toBe('Test Server');
        expect(result.description).toBe('A test server');
        expect(result.version).toBe('1.0.0');
        expect(result.author).toBeUndefined();
        expect(result.repository).toBeUndefined();
        expect(result.tools).toEqual([]);
        expect(result.categories).toEqual([]);
        expect(result.installCount).toBe(0);
        expect(result.verified).toBe(false);
      });

      it('should validate complete server with all fields', () => {
        const completeServer = {
          id: 'complete-server',
          name: 'Complete Server',
          description: 'A complete server with all fields',
          version: '2.1.0',
          author: 'Test Author',
          repository: 'https://github.com/test/repo',
          tools: ['tool1', 'tool2', 'tool3'],
          categories: ['development', 'productivity'],
          installCount: 150,
          verified: true,
        };

        const result = MCPServerV050Schema.parse(completeServer);
        expect(result.id).toBe('complete-server');
        expect(result.name).toBe('Complete Server');
        expect(result.description).toBe('A complete server with all fields');
        expect(result.version).toBe('2.1.0');
        expect(result.author).toBe('Test Author');
        expect(result.repository).toBe('https://github.com/test/repo');
        expect(result.tools).toEqual(['tool1', 'tool2', 'tool3']);
        expect(result.categories).toEqual(['development', 'productivity']);
        expect(result.installCount).toBe(150);
        expect(result.verified).toBe(true);
      });

      it('should apply default values correctly', () => {
        const serverWithDefaults = {
          id: 'default-test',
          name: 'Default Test',
          description: 'Testing defaults',
          version: '1.0.0',
          author: 'Test Author',
        };

        const result = MCPServerV050Schema.parse(serverWithDefaults);
        expect(result.tools).toEqual([]); // default empty array
        expect(result.categories).toEqual([]); // default empty array
        expect(result.installCount).toBe(0); // default 0
        expect(result.verified).toBe(false); // default false
      });

      it('should validate all valid categories', () => {
        const validCategories = [
          'productivity',
          'development',
          'communication',
          'data',
          'ai',
          'automation',
          'security',
          'monitoring',
          'integration',
          'utility',
          'other'
        ];

        validCategories.forEach(category => {
          const server = {
            id: `test-${category}`,
            name: 'Test',
            description: 'Test',
            version: '1.0.0',
            categories: [category],
          };

          expect(() => MCPServerV050Schema.parse(server)).not.toThrow();
        });
      });

      it('should validate valid repository URLs', () => {
        const validUrls = [
          'https://github.com/user/repo',
          'https://gitlab.com/user/repo',
          'https://bitbucket.org/user/repo',
          'http://example.com/repo',
        ];

        validUrls.forEach(url => {
          const server = {
            id: 'test',
            name: 'Test',
            description: 'Test',
            version: '1.0.0',
            repository: url,
          };

          expect(() => MCPServerV050Schema.parse(server)).not.toThrow();
        });
      });
    });

    describe('Invalid data validation', () => {
      it('should reject empty or missing required fields', () => {
        const invalidCases = [
          { id: '', name: 'Test', description: 'Test', version: '1.0.0' }, // empty id
          { id: 'test', name: '', description: 'Test', version: '1.0.0' }, // empty name
          { id: 'test', name: 'Test', description: '', version: '1.0.0' }, // empty description
          { id: 'test', name: 'Test', description: 'Test', version: '' }, // empty version
          { name: 'Test', description: 'Test', version: '1.0.0' }, // missing id
          { id: 'test', description: 'Test', version: '1.0.0' }, // missing name
          { id: 'test', name: 'Test', version: '1.0.0' }, // missing description
          { id: 'test', name: 'Test', description: 'Test' }, // missing version
        ];

        invalidCases.forEach((invalidCase, index) => {
          expect(() => MCPServerV050Schema.parse(invalidCase))
            .toThrow(ZodError);
        });
      });

      it('should reject invalid repository URLs', () => {
        const invalidUrls = [
          'not-a-url',
          'ftp://invalid.com',
          'file:///path/to/file',
          'javascript:alert("xss")',
          '',
          'www.example.com', // missing protocol
        ];

        invalidUrls.forEach(url => {
          const server = {
            id: 'test',
            name: 'Test',
            description: 'Test',
            version: '1.0.0',
            repository: url,
          };

          expect(() => MCPServerV050Schema.parse(server)).toThrow();
        });
      });

      it('should reject invalid categories', () => {
        const server = {
          id: 'test',
          name: 'Test',
          description: 'Test',
          version: '1.0.0',
          categories: ['invalid-category'],
        };

        expect(() => MCPServerV050Schema.parse(server)).toThrow();
      });

      it('should reject negative installCount', () => {
        const server = {
          id: 'test',
          name: 'Test',
          description: 'Test',
          version: '1.0.0',
          installCount: -1,
        };

        expect(() => MCPServerV050Schema.parse(server)).toThrow();
      });

      it('should reject non-integer installCount', () => {
        const server = {
          id: 'test',
          name: 'Test',
          description: 'Test',
          version: '1.0.0',
          installCount: 1.5,
        };

        expect(() => MCPServerV050Schema.parse(server)).toThrow();
      });
    });

    describe('Type inference', () => {
      it('should infer correct TypeScript types', () => {
        const server: MCPServerV050 = {
          id: 'type-test',
          name: 'Type Test',
          description: 'Testing TypeScript types',
          version: '1.0.0',
          author: 'Author',
          repository: 'https://github.com/test/repo',
          tools: ['tool1'],
          categories: ['development'],
          installCount: 42,
          verified: true,
        };

        // Type assertions to ensure proper typing
        expect(typeof server.id).toBe('string');
        expect(typeof server.name).toBe('string');
        expect(typeof server.description).toBe('string');
        expect(typeof server.version).toBe('string');
        expect(typeof server.author).toBe('string');
        expect(typeof server.repository).toBe('string');
        expect(Array.isArray(server.tools)).toBe(true);
        expect(Array.isArray(server.categories)).toBe(true);
        expect(typeof server.installCount).toBe('number');
        expect(typeof server.verified).toBe('boolean');
      });
    });
  });

  describe('MCPInstallationV050Schema', () => {
    describe('Valid data validation', () => {
      it('should validate complete installation', () => {
        const validInstallation = {
          serverId: 'server-123',
          installedAt: new Date('2024-01-15T10:30:00Z'),
          config: {
            name: 'Test Server Config',
            type: 'stdio' as const,
            command: 'node',
            args: ['server.js'],
          },
          status: 'installed' as const,
        };

        const result = MCPInstallationV050Schema.parse(validInstallation);
        expect(result.serverId).toBe('server-123');
        expect(result.installedAt).toEqual(new Date('2024-01-15T10:30:00Z'));
        expect(result.config.name).toBe('Test Server Config');
        expect(result.config.type).toBe('stdio');
        expect(result.status).toBe('installed');
      });

      it('should validate all valid installation statuses', () => {
        const validStatuses = ['pending', 'installing', 'installed', 'failed', 'uninstalling', 'uninstalled'];

        validStatuses.forEach(status => {
          const installation = {
            serverId: 'test-server',
            installedAt: new Date(),
            config: {
              name: 'Test',
              type: 'stdio' as const,
              command: 'node',
              args: ['server.js'],
            },
            status: status as any,
          };

          expect(() => MCPInstallationV050Schema.parse(installation)).not.toThrow();
        });
      });

      it('should work with different connection types', () => {
        const connectionTypes = ['stdio', 'http', 'sse', 'sdk'] as const;

        connectionTypes.forEach(connectionType => {
          const baseConfig = {
            name: 'Test',
            type: connectionType,
          };

          const config = connectionType === 'stdio' ? {
            ...baseConfig,
            command: 'node',
            args: ['server.js'],
          } : connectionType === 'http' ? {
            ...baseConfig,
            url: 'http://localhost:3000',
          } : baseConfig;

          const installation = {
            serverId: 'test-server',
            installedAt: new Date(),
            config,
            status: 'installed' as const,
          };

          expect(() => MCPInstallationV050Schema.parse(installation)).not.toThrow();
        });
      });
    });

    describe('Invalid data validation', () => {
      it('should reject empty serverId', () => {
        const installation = {
          serverId: '',
          installedAt: new Date(),
          config: {
            name: 'Test',
            type: 'stdio' as const,
            command: 'node',
            args: ['server.js'],
          },
          status: 'installed' as const,
        };

        expect(() => MCPInstallationV050Schema.parse(installation)).toThrow();
      });

      it('should reject missing required fields', () => {
        const baseInstallation = {
          serverId: 'test-server',
          installedAt: new Date(),
          config: {
            name: 'Test',
            type: 'stdio' as const,
            command: 'node',
            args: ['server.js'],
          },
          status: 'installed' as const,
        };

        // Test missing each required field
        const requiredFields = ['serverId', 'installedAt', 'config', 'status'];
        requiredFields.forEach(field => {
          const incompleteInstallation = { ...baseInstallation };
          delete (incompleteInstallation as any)[field];

          expect(() => MCPInstallationV050Schema.parse(incompleteInstallation)).toThrow();
        });
      });

      it('should reject invalid status values', () => {
        const installation = {
          serverId: 'test-server',
          installedAt: new Date(),
          config: {
            name: 'Test',
            type: 'stdio' as const,
            command: 'node',
            args: ['server.js'],
          },
          status: 'invalid-status',
        };

        expect(() => MCPInstallationV050Schema.parse(installation)).toThrow();
      });

      it('should reject invalid date types', () => {
        const installation = {
          serverId: 'test-server',
          installedAt: 'not-a-date',
          config: {
            name: 'Test',
            type: 'stdio' as const,
            command: 'node',
            args: ['server.js'],
          },
          status: 'installed' as const,
        };

        expect(() => MCPInstallationV050Schema.parse(installation)).toThrow();
      });
    });

    describe('Type inference', () => {
      it('should infer correct TypeScript types', () => {
        const installation: MCPInstallationV050 = {
          serverId: 'type-test',
          installedAt: new Date(),
          config: {
            name: 'Test Config',
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
          },
          status: 'installed',
        };

        // Type assertions
        expect(typeof installation.serverId).toBe('string');
        expect(installation.installedAt).toBeInstanceOf(Date);
        expect(typeof installation.config).toBe('object');
        expect(typeof installation.status).toBe('string');
      });
    });
  });

  describe('MCPInstallProgressV050Schema', () => {
    describe('Valid data validation', () => {
      it('should validate complete progress report', () => {
        const validProgress = {
          serverId: 'server-123',
          stage: 'installing' as const,
          progress: 50,
          message: 'Installing dependencies...',
        };

        const result = MCPInstallProgressV050Schema.parse(validProgress);
        expect(result.serverId).toBe('server-123');
        expect(result.stage).toBe('installing');
        expect(result.progress).toBe(50);
        expect(result.message).toBe('Installing dependencies...');
      });

      it('should validate all valid installation stages', () => {
        const validStages = [
          'initializing',
          'downloading',
          'extracting',
          'installing',
          'configuring',
          'verifying',
          'completing',
          'completed',
          'failed'
        ];

        validStages.forEach(stage => {
          const progress = {
            serverId: 'test-server',
            stage: stage as any,
            progress: 25,
            message: `Stage: ${stage}`,
          };

          expect(() => MCPInstallProgressV050Schema.parse(progress)).not.toThrow();
        });
      });

      it('should validate progress bounds (0-100)', () => {
        const progressValues = [0, 25, 50, 75, 100];

        progressValues.forEach(progressValue => {
          const progress = {
            serverId: 'test-server',
            stage: 'installing' as const,
            progress: progressValue,
            message: `Progress: ${progressValue}%`,
          };

          expect(() => MCPInstallProgressV050Schema.parse(progress)).not.toThrow();
        });
      });

      it('should allow empty message', () => {
        const progress = {
          serverId: 'test-server',
          stage: 'completed' as const,
          progress: 100,
          message: '',
        };

        expect(() => MCPInstallProgressV050Schema.parse(progress)).not.toThrow();
      });
    });

    describe('Invalid data validation', () => {
      it('should reject empty serverId', () => {
        const progress = {
          serverId: '',
          stage: 'installing' as const,
          progress: 50,
          message: 'Installing...',
        };

        expect(() => MCPInstallProgressV050Schema.parse(progress)).toThrow();
      });

      it('should reject missing required fields', () => {
        const baseProgress = {
          serverId: 'test-server',
          stage: 'installing' as const,
          progress: 50,
          message: 'Installing...',
        };

        const requiredFields = ['serverId', 'stage', 'progress', 'message'];
        requiredFields.forEach(field => {
          const incompleteProgress = { ...baseProgress };
          delete (incompleteProgress as any)[field];

          expect(() => MCPInstallProgressV050Schema.parse(incompleteProgress)).toThrow();
        });
      });

      it('should reject invalid stage values', () => {
        const progress = {
          serverId: 'test-server',
          stage: 'invalid-stage',
          progress: 50,
          message: 'Installing...',
        };

        expect(() => MCPInstallProgressV050Schema.parse(progress)).toThrow();
      });

      it('should reject progress values outside bounds', () => {
        const invalidProgressValues = [-1, 101, 150, -50];

        invalidProgressValues.forEach(progressValue => {
          const progress = {
            serverId: 'test-server',
            stage: 'installing' as const,
            progress: progressValue,
            message: 'Installing...',
          };

          expect(() => MCPInstallProgressV050Schema.parse(progress)).toThrow();
        });
      });

      it('should reject non-number progress values', () => {
        const progress = {
          serverId: 'test-server',
          stage: 'installing' as const,
          progress: '50', // string instead of number
          message: 'Installing...',
        };

        expect(() => MCPInstallProgressV050Schema.parse(progress)).toThrow();
      });
    });

    describe('Type inference', () => {
      it('should infer correct TypeScript types', () => {
        const progress: MCPInstallProgressV050 = {
          serverId: 'type-test',
          stage: 'installing',
          progress: 75,
          message: 'Almost done...',
        };

        // Type assertions
        expect(typeof progress.serverId).toBe('string');
        expect(typeof progress.stage).toBe('string');
        expect(typeof progress.progress).toBe('number');
        expect(typeof progress.message).toBe('string');
      });
    });
  });

  describe('Integration tests', () => {
    it('should work together in realistic workflow scenarios', () => {
      // Create a server
      const server = MCPServerV050Schema.parse({
        id: 'workflow-server',
        name: 'Workflow Server',
        description: 'A server for testing workflows',
        version: '1.0.0',
        author: 'Test Author',
        tools: ['file-tool', 'data-tool'],
        categories: ['development', 'utility'],
      });

      // Create an installation
      const installation = MCPInstallationV050Schema.parse({
        serverId: server.id,
        installedAt: new Date(),
        config: {
          name: server.name,
          type: 'stdio',
          command: 'node',
          args: ['dist/index.js'],
        },
        status: 'installing',
      });

      // Create progress updates
      const progressUpdates = [
        { stage: 'initializing', progress: 0, message: 'Starting installation...' },
        { stage: 'downloading', progress: 25, message: 'Downloading package...' },
        { stage: 'installing', progress: 75, message: 'Installing dependencies...' },
        { stage: 'completed', progress: 100, message: 'Installation complete!' },
      ].map(update => MCPInstallProgressV050Schema.parse({
        serverId: server.id,
        ...update,
      }));

      // Verify all data is properly structured
      expect(server.id).toBe('workflow-server');
      expect(installation.serverId).toBe(server.id);
      expect(progressUpdates).toHaveLength(4);
      expect(progressUpdates[0].stage).toBe('initializing');
      expect(progressUpdates[3].stage).toBe('completed');
      expect(progressUpdates[3].progress).toBe(100);
    });

    it('should handle edge case data combinations', () => {
      // Test with minimal server, minimal installation, and progress at boundaries
      const minimalServer = MCPServerV050Schema.parse({
        id: 'minimal',
        name: 'Minimal',
        description: 'Minimal server',
        version: '0.0.1',
      });

      const minimalInstallation = MCPInstallationV050Schema.parse({
        serverId: minimalServer.id,
        installedAt: new Date(),
        config: {
          name: 'Minimal Config',
          type: 'sdk',
        },
        status: 'pending',
      });

      const boundaryProgress = MCPInstallProgressV050Schema.parse({
        serverId: minimalServer.id,
        stage: 'failed',
        progress: 0,
        message: '',
      });

      expect(minimalServer.tools).toEqual([]);
      expect(minimalServer.verified).toBe(false);
      expect(minimalInstallation.status).toBe('pending');
      expect(boundaryProgress.progress).toBe(0);
    });
  });

  describe('Acceptance criteria validation', () => {
    it('should satisfy all acceptance criteria requirements', () => {
      // Test that all required types exist and have the correct structure

      // MCPServer type with all required fields
      const mcpServer: MCPServerV050 = {
        id: 'acceptance-test-server',
        name: 'Acceptance Test Server',
        description: 'Testing acceptance criteria',
        version: '1.0.0',
        author: 'Test Author',
        repository: 'https://github.com/test/acceptance',
        tools: ['tool1', 'tool2'],
        categories: ['development'],
        installCount: 100,
        verified: true,
      };

      // MCPInstallation type with all required fields
      const mcpInstallation: MCPInstallationV050 = {
        serverId: mcpServer.id,
        installedAt: new Date(),
        config: {
          name: 'Test Config',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
        status: 'installed',
      };

      // MCPInstallProgress type with all required fields
      const mcpProgress: MCPInstallProgressV050 = {
        serverId: mcpServer.id,
        stage: 'completed',
        progress: 100,
        message: 'Installation completed successfully',
      };

      // Validate all schemas parse correctly
      expect(() => MCPServerV050Schema.parse(mcpServer)).not.toThrow();
      expect(() => MCPInstallationV050Schema.parse(mcpInstallation)).not.toThrow();
      expect(() => MCPInstallProgressV050Schema.parse(mcpProgress)).not.toThrow();

      // Verify all required fields are present and correct types
      expect(typeof mcpServer.id).toBe('string');
      expect(typeof mcpServer.name).toBe('string');
      expect(typeof mcpServer.description).toBe('string');
      expect(typeof mcpServer.version).toBe('string');
      expect(typeof mcpServer.author).toBe('string');
      expect(typeof mcpServer.repository).toBe('string');
      expect(Array.isArray(mcpServer.tools)).toBe(true);
      expect(Array.isArray(mcpServer.categories)).toBe(true);
      expect(typeof mcpServer.installCount).toBe('number');
      expect(typeof mcpServer.verified).toBe('boolean');

      expect(typeof mcpInstallation.serverId).toBe('string');
      expect(mcpInstallation.installedAt).toBeInstanceOf(Date);
      expect(typeof mcpInstallation.config).toBe('object');
      expect(typeof mcpInstallation.status).toBe('string');

      expect(typeof mcpProgress.serverId).toBe('string');
      expect(typeof mcpProgress.stage).toBe('string');
      expect(typeof mcpProgress.progress).toBe('number');
      expect(typeof mcpProgress.message).toBe('string');
    });
  });
});