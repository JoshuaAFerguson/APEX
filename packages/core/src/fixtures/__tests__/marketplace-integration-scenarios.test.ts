/**
 * @fileoverview Integration Scenario Tests for Marketplace Fixtures
 *
 * Tests marketplace fixtures with realistic but safe data patterns,
 * focusing on integration scenarios and workflow testing.
 */

import { describe, expect, it } from 'vitest';
import {
  MCPMarketplaceEntrySchema,
  MCPMarketplaceSchema,
  MCPMarketplaceSourceSchema,
  type MCPMarketplaceEntry,
  type MCPMarketplace,
} from '../../types.js';
import {
  baseFilesystemMarketplaceEntry,
  baseMarketplace,
  createMarketplaceEntry,
  createServerConfig,
  createMarketplace,
  getVerifiedEntries,
  getEntriesByCapability,
} from '../marketplace.js';

// Safe test data without sensitive information
const TEST_MARKETPLACE_ENTRIES = {
  // File management server
  fileManagerServer: {
    name: 'file-manager-mcp-server',
    description: 'Advanced file management server with search, organization, and batch operations.',
    version: '1.4.0',
    author: 'FileManager Team',
    homepage: 'https://filemanager.example.com',
    repository: 'https://github.com/filemanager/mcp-server-files.git',
    installCommand: 'npm install -g file-manager-mcp-server',
    serverConfig: {
      name: 'file-manager-server',
      type: 'stdio' as const,
      command: 'npx',
      args: ['file-manager-mcp-server', '--config', './config.json'],
      env: {
        WORKSPACE_PATH: '/workspace',
        MAX_FILE_SIZE: '100MB',
        ALLOWED_EXTENSIONS: '.txt,.md,.json,.yaml,.js,.ts',
        BACKUP_ENABLED: 'true',
      },
      autoStart: true,
    },
    capabilities: ['tools', 'resources', 'files', 'search'],
    verified: true,
  },

  // Task management server
  taskManagerServer: {
    name: 'task-manager-mcp-server',
    description: 'Project and task management server with scheduling and progress tracking.',
    version: '2.0.1',
    author: 'TaskFlow Inc',
    homepage: 'https://taskflow.example.com',
    repository: 'https://github.com/taskflow/mcp-server-tasks.git',
    installCommand: 'npm install -g @taskflow/mcp-server',
    serverConfig: {
      name: 'task-manager-server',
      type: 'stdio' as const,
      command: 'node',
      args: ['./dist/server.js', '--port', '3000'],
      env: {
        DATA_DIRECTORY: './task-data',
        SYNC_INTERVAL: '300000',
        NOTIFICATION_ENABLED: 'false',
        MAX_TASKS_PER_PROJECT: '1000',
      },
      autoStart: false,
    },
    capabilities: ['tools', 'resources', 'tasks', 'scheduling'],
    verified: true,
  },

  // Development tools server
  devToolsServer: {
    name: 'dev-tools-mcp-server',
    description: 'Development utilities including code formatting, linting, and build tools.',
    version: '1.8.3',
    author: 'DevTools Collective',
    homepage: 'https://devtools-collective.example.com',
    repository: 'https://github.com/devtools/mcp-server-devtools.git',
    installCommand: 'npm install -g @devtools/mcp-server',
    serverConfig: {
      name: 'dev-tools-server',
      type: 'stdio' as const,
      command: 'dev-tools-mcp-server',
      args: ['--config-dir', './dev-config'],
      env: {
        NODE_VERSION: '18.0.0',
        FORMATTER: 'prettier',
        LINTER: 'eslint',
        BUILD_TOOL: 'webpack',
        WATCH_MODE: 'true',
      },
      autoStart: true,
    },
    capabilities: ['tools', 'development', 'formatting', 'linting'],
    verified: true,
  },

  // Testing framework server
  testFrameworkServer: {
    name: 'test-framework-mcp-server',
    description: 'Comprehensive testing framework with unit, integration, and e2e test support.',
    version: '3.1.0',
    author: 'TestForge',
    homepage: 'https://testforge.example.com',
    repository: 'https://github.com/testforge/mcp-server-testing.git',
    installCommand: 'npm install -g @testforge/mcp-server',
    serverConfig: {
      name: 'test-framework-server',
      type: 'stdio' as const,
      command: 'test-framework-server',
      args: ['--runner', 'jest', '--config', './test.config.js'],
      env: {
        TEST_TIMEOUT: '30000',
        COVERAGE_THRESHOLD: '80',
        PARALLEL_TESTS: 'true',
        REPORT_FORMAT: 'json',
      },
      autoStart: false,
    },
    capabilities: ['tools', 'testing', 'coverage', 'reporting'],
    verified: true,
  },

  // Community documentation server
  docsServer: {
    name: 'community-docs-mcp-server',
    description: 'Community-maintained documentation generator and server.',
    version: '0.9.2-beta',
    author: 'Docs Community',
    homepage: 'https://community-docs.example.com',
    repository: 'https://github.com/docs-community/mcp-server-docs.git',
    installCommand: 'npm install -g community-docs-mcp-server',
    serverConfig: {
      name: 'community-docs-server',
      type: 'stdio' as const,
      command: 'docs-server',
      args: ['--serve', '--port', '4000'],
      env: {
        DOCS_SOURCE: './docs',
        OUTPUT_FORMAT: 'html',
        THEME: 'default',
        AUTO_RELOAD: 'true',
      },
      autoStart: false,
    },
    capabilities: ['tools', 'documentation', 'community'],
    verified: false, // Community server
  },
};

// Safe marketplace source configurations
const TEST_MARKETPLACE_SOURCES = {
  production: {
    url: 'https://registry.example.com/v1/catalog.json',
    enabled: true,
    refreshIntervalMinutes: 1440,
    allowUnverified: false,
  },

  staging: {
    url: 'https://staging-registry.example.com/catalog.json',
    enabled: true,
    refreshIntervalMinutes: 240,
    allowUnverified: true,
  },

  development: {
    url: 'file:///opt/local-registry/dev-catalog.json',
    enabled: true,
    refreshIntervalMinutes: 15,
    allowUnverified: true,
  },
};

describe('Marketplace Integration Scenarios', () => {
  describe('Complete workflow testing', () => {
    it('should create a full development workflow marketplace', () => {
      const devWorkflowMarketplace = createMarketplace(baseMarketplace, {
        name: 'Development Workflow Registry',
        description: 'Complete development workflow with all necessary tools',
        version: '2.0.0',
        servers: [
          TEST_MARKETPLACE_ENTRIES.fileManagerServer,
          TEST_MARKETPLACE_ENTRIES.taskManagerServer,
          TEST_MARKETPLACE_ENTRIES.devToolsServer,
          TEST_MARKETPLACE_ENTRIES.testFrameworkServer,
          createMarketplaceEntry(TEST_MARKETPLACE_ENTRIES.docsServer, {
            verified: true, // Promote community docs for this workflow
          }),
        ],
        source: TEST_MARKETPLACE_SOURCES.development,
      });

      expect(() => MCPMarketplaceSchema.parse(devWorkflowMarketplace)).not.toThrow();

      const parsedMarketplace = MCPMarketplaceSchema.parse(devWorkflowMarketplace);
      expect(parsedMarketplace.servers).toHaveLength(5);
      expect(parsedMarketplace.name).toContain('Development Workflow');

      // Verify all workflow components are present
      const capabilities = new Set(
        parsedMarketplace.servers.flatMap(s => s.capabilities || [])
      );
      expect(capabilities).toContain('files');
      expect(capabilities).toContain('tasks');
      expect(capabilities).toContain('development');
      expect(capabilities).toContain('testing');
      expect(capabilities).toContain('documentation');
    });

    it('should create environment-specific server configurations', () => {
      // Development environment
      const devTaskServer = createMarketplaceEntry(TEST_MARKETPLACE_ENTRIES.taskManagerServer, {
        serverConfig: {
          env: {
            DATA_DIRECTORY: './dev-task-data',
            SYNC_INTERVAL: '60000', // Faster sync for dev
            NOTIFICATION_ENABLED: 'true', // Enable notifications in dev
            DEBUG_MODE: 'true',
          },
        },
      });

      // Production environment
      const prodTaskServer = createMarketplaceEntry(TEST_MARKETPLACE_ENTRIES.taskManagerServer, {
        serverConfig: {
          env: {
            DATA_DIRECTORY: '/var/lib/task-data',
            SYNC_INTERVAL: '600000', // Slower sync for prod
            NOTIFICATION_ENABLED: 'false', // Disable notifications in prod
            PERFORMANCE_MONITORING: 'true',
          },
        },
      });

      expect(() => MCPMarketplaceEntrySchema.parse(devTaskServer)).not.toThrow();
      expect(() => MCPMarketplaceEntrySchema.parse(prodTaskServer)).not.toThrow();

      expect(devTaskServer.serverConfig.env?.DEBUG_MODE).toBe('true');
      expect(prodTaskServer.serverConfig.env?.PERFORMANCE_MONITORING).toBe('true');
      expect(devTaskServer.serverConfig.env?.DATA_DIRECTORY).toContain('./dev-task-data');
      expect(prodTaskServer.serverConfig.env?.DATA_DIRECTORY).toContain('/var/lib/task-data');
    });

    it('should handle server dependency chains', () => {
      const dependentMarketplace = createMarketplace(baseMarketplace, {
        name: 'Dependent Services Marketplace',
        servers: [
          // Base file server
          createMarketplaceEntry(TEST_MARKETPLACE_ENTRIES.fileManagerServer, {
            name: 'shared-file-server',
            serverConfig: {
              env: {
                WORKSPACE_PATH: '/shared/workspace',
                SERVICE_PORT: '9001',
              },
            },
          }),

          // Task server that depends on file server
          createMarketplaceEntry(TEST_MARKETPLACE_ENTRIES.taskManagerServer, {
            name: 'dependent-task-server',
            serverConfig: {
              env: {
                FILE_SERVICE_URL: 'http://localhost:9001',
                SHARED_WORKSPACE: '/shared/workspace',
                DEPENDENCY_CHECK: 'true',
              },
            },
          }),

          // Test server that depends on both
          createMarketplaceEntry(TEST_MARKETPLACE_ENTRIES.testFrameworkServer, {
            name: 'integrated-test-server',
            serverConfig: {
              env: {
                FILE_SERVICE_URL: 'http://localhost:9001',
                TASK_SERVICE_URL: 'http://localhost:3000',
                TEST_DATA_PATH: '/shared/workspace/test-data',
              },
            },
          }),
        ],
      });

      expect(() => MCPMarketplaceSchema.parse(dependentMarketplace)).not.toThrow();

      const parsedMarketplace = MCPMarketplaceSchema.parse(dependentMarketplace);

      // Verify dependency configuration
      const taskServer = parsedMarketplace.servers.find(s => s.name === 'dependent-task-server');
      expect(taskServer?.serverConfig.env?.FILE_SERVICE_URL).toBe('http://localhost:9001');

      const testServer = parsedMarketplace.servers.find(s => s.name === 'integrated-test-server');
      expect(testServer?.serverConfig.env?.FILE_SERVICE_URL).toBe('http://localhost:9001');
      expect(testServer?.serverConfig.env?.TASK_SERVICE_URL).toBe('http://localhost:3000');
    });
  });

  describe('Multi-environment marketplace scenarios', () => {
    it('should create development environment marketplace', () => {
      const devMarketplace = createMarketplace(baseMarketplace, {
        name: 'Development Environment',
        description: 'Local development setup with debugging and hot reload',
        servers: Object.values(TEST_MARKETPLACE_ENTRIES).map(entry =>
          createMarketplaceEntry(entry, {
            serverConfig: {
              autoStart: true, // Auto-start all services in dev
              env: {
                ...entry.serverConfig.env,
                LOG_LEVEL: 'debug',
                HOT_RELOAD: 'true',
                DEV_MODE: 'true',
              },
            },
          })
        ),
        source: TEST_MARKETPLACE_SOURCES.development,
      });

      expect(() => MCPMarketplaceSchema.parse(devMarketplace)).not.toThrow();

      const parsedMarketplace = MCPMarketplaceSchema.parse(devMarketplace);

      // All servers should have auto-start enabled in dev
      expect(parsedMarketplace.servers.every(s => s.serverConfig.autoStart === true)).toBe(true);

      // All servers should have debug logging
      expect(parsedMarketplace.servers.every(s => s.serverConfig.env?.LOG_LEVEL === 'debug')).toBe(true);
    });

    it('should create production environment marketplace', () => {
      const prodMarketplace = createMarketplace(baseMarketplace, {
        name: 'Production Environment',
        description: 'Production-ready configuration with monitoring and security',
        servers: Object.values(TEST_MARKETPLACE_ENTRIES)
          .filter(entry => entry.verified) // Only verified servers in production
          .map(entry =>
            createMarketplaceEntry(entry, {
              serverConfig: {
                autoStart: false, // Manual start in production
                env: {
                  ...entry.serverConfig.env,
                  LOG_LEVEL: 'warn',
                  MONITORING_ENABLED: 'true',
                  SECURITY_MODE: 'strict',
                  PERFORMANCE_MONITORING: 'true',
                },
              },
            })
          ),
        source: TEST_MARKETPLACE_SOURCES.production,
      });

      expect(() => MCPMarketplaceSchema.parse(prodMarketplace)).not.toThrow();

      const parsedMarketplace = MCPMarketplaceSchema.parse(prodMarketplace);

      // Should only contain verified servers
      expect(parsedMarketplace.servers.every(s => s.verified === true)).toBe(true);

      // All servers should have production configuration
      expect(parsedMarketplace.servers.every(s => s.serverConfig.env?.LOG_LEVEL === 'warn')).toBe(true);
      expect(parsedMarketplace.servers.every(s => s.serverConfig.env?.SECURITY_MODE === 'strict')).toBe(true);
    });
  });

  describe('Filtering and discovery scenarios', () => {
    let testEntries: MCPMarketplaceEntry[];

    beforeEach(() => {
      testEntries = Object.values(TEST_MARKETPLACE_ENTRIES);
    });

    it('should filter development tools from marketplace', () => {
      const mockValues = () => testEntries;
      const originalValues = Object.values;
      Object.values = mockValues;

      try {
        const devTools = getEntriesByCapability('development');
        expect(devTools).toHaveLength(1);
        expect(devTools[0].name).toBe('dev-tools-mcp-server');
      } finally {
        Object.values = originalValues;
      }
    });

    it('should filter testing tools from marketplace', () => {
      const mockValues = () => testEntries;
      const originalValues = Object.values;
      Object.values = mockValues;

      try {
        const testingTools = getEntriesByCapability('testing');
        expect(testingTools).toHaveLength(1);
        expect(testingTools[0].name).toBe('test-framework-mcp-server');
      } finally {
        Object.values = originalValues;
      }
    });

    it('should identify community vs verified servers', () => {
      const mockValues = () => testEntries;
      const originalValues = Object.values;
      Object.values = mockValues;

      try {
        const verifiedServers = getVerifiedEntries();
        const totalServers = testEntries.length;
        const unverifiedCount = totalServers - verifiedServers.length;

        expect(verifiedServers.length).toBeGreaterThan(0);
        expect(unverifiedCount).toBe(1); // Should have one community server
        expect(verifiedServers.every(s => s.verified === true)).toBe(true);

        // Community server should be the docs server
        const communityServer = testEntries.find(s => !s.verified);
        expect(communityServer?.name).toBe('community-docs-mcp-server');
      } finally {
        Object.values = originalValues;
      }
    });

    it('should handle capability overlap and combinations', () => {
      const mockValues = () => testEntries;
      const originalValues = Object.values;
      Object.values = mockValues;

      try {
        const toolsServers = getEntriesByCapability('tools');
        const resourcesServers = getEntriesByCapability('resources');

        // Most servers should have 'tools' capability
        expect(toolsServers.length).toBeGreaterThan(3);

        // Some servers should have 'resources' capability
        expect(resourcesServers.length).toBeGreaterThan(1);

        // Check for servers with both capabilities
        const serversWithBoth = toolsServers.filter(server =>
          server.capabilities?.includes('resources')
        );
        expect(serversWithBoth.length).toBeGreaterThan(0);
      } finally {
        Object.values = originalValues;
      }
    });
  });

  describe('Configuration validation scenarios', () => {
    it('should validate complex environment configurations', () => {
      const complexConfigServer = createMarketplaceEntry(TEST_MARKETPLACE_ENTRIES.devToolsServer, {
        serverConfig: {
          env: {
            // JSON configuration
            TOOL_CONFIG: JSON.stringify({
              formatters: ['prettier', 'eslint --fix'],
              linters: ['eslint', 'tslint'],
              buildTools: ['webpack', 'rollup', 'vite'],
            }),

            // Multi-line script
            INIT_SCRIPT: [
              'echo "Setting up development environment..."',
              'npm install',
              'npm run build',
              'echo "Setup complete!"',
            ].join('\n'),

            // Path configuration
            TOOL_PATHS: [
              '/usr/local/bin/prettier',
              '/usr/local/bin/eslint',
              './node_modules/.bin/webpack',
            ].join(':'),

            // Feature flags
            FEATURES: 'hot-reload,auto-format,live-lint,build-watch',

            // Numeric configurations as strings
            MAX_WORKERS: '4',
            TIMEOUT: '30000',
            RETRY_ATTEMPTS: '3',
          },
        },
      });

      expect(() => MCPMarketplaceEntrySchema.parse(complexConfigServer)).not.toThrow();

      const parsedServer = MCPMarketplaceEntrySchema.parse(complexConfigServer);
      expect(parsedServer.serverConfig.env?.TOOL_CONFIG).toContain('prettier');
      expect(parsedServer.serverConfig.env?.INIT_SCRIPT).toContain('npm install');
      expect(parsedServer.serverConfig.env?.FEATURES).toContain('hot-reload');
    });

    it('should handle marketplace with mixed source types', () => {
      const mixedSourceMarketplace = createMarketplace(baseMarketplace, {
        name: 'Mixed Source Registry',
        description: 'Registry combining multiple source types',
        servers: testEntries.slice(0, 3), // Use first 3 test entries
        source: {
          url: 'https://mixed-registry.example.com/catalog.json',
          enabled: true,
          refreshIntervalMinutes: 120,
          allowUnverified: true,
        },
      });

      expect(() => MCPMarketplaceSchema.parse(mixedSourceMarketplace)).not.toThrow();

      const parsedMarketplace = MCPMarketplaceSchema.parse(mixedSourceMarketplace);
      expect(parsedMarketplace.source?.url).toContain('mixed-registry');
      expect(parsedMarketplace.source?.allowUnverified).toBe(true);
      expect(parsedMarketplace.servers).toHaveLength(3);
    });
  });

  describe('Error handling and recovery scenarios', () => {
    it('should handle marketplace with some invalid server configurations gracefully', () => {
      const mixedValidityEntries = [
        // Valid entry
        TEST_MARKETPLACE_ENTRIES.fileManagerServer,

        // Entry that would be invalid when parsed but valid to create
        createMarketplaceEntry(TEST_MARKETPLACE_ENTRIES.taskManagerServer, {
          serverConfig: {
            command: '', // This would fail validation
            env: null as any, // This would also fail
          },
        }),

        // Another valid entry
        TEST_MARKETPLACE_ENTRIES.devToolsServer,
      ];

      // Creating the marketplace should succeed
      const marketplace = createMarketplace(baseMarketplace, {
        name: 'Mixed Validity Marketplace',
        servers: mixedValidityEntries,
      });

      expect(marketplace.servers).toHaveLength(3);

      // But validation should fail due to invalid server config
      expect(() => MCPMarketplaceSchema.parse(marketplace)).toThrow();
    });

    it('should handle empty marketplace scenarios', () => {
      const emptyMarketplace = createMarketplace(baseMarketplace, {
        name: 'Empty Registry',
        description: 'Registry with no servers',
        servers: [],
      });

      expect(() => MCPMarketplaceSchema.parse(emptyMarketplace)).not.toThrow();

      const parsedMarketplace = MCPMarketplaceSchema.parse(emptyMarketplace);
      expect(parsedMarketplace.servers).toHaveLength(0);
      expect(parsedMarketplace.name).toBe('Empty Registry');
    });

    it('should handle marketplace with duplicate server names', () => {
      const duplicateNameMarketplace = createMarketplace(baseMarketplace, {
        name: 'Duplicate Names Registry',
        servers: [
          TEST_MARKETPLACE_ENTRIES.fileManagerServer,
          createMarketplaceEntry(TEST_MARKETPLACE_ENTRIES.taskManagerServer, {
            name: 'file-manager-mcp-server', // Same name as first server
          }),
        ],
      });

      expect(() => MCPMarketplaceSchema.parse(duplicateNameMarketplace)).not.toThrow();

      const parsedMarketplace = MCPMarketplaceSchema.parse(duplicateNameMarketplace);
      expect(parsedMarketplace.servers).toHaveLength(2);

      // Both servers should have the same name (schema doesn't prevent this)
      const serverNames = parsedMarketplace.servers.map(s => s.name);
      expect(serverNames.filter(name => name === 'file-manager-mcp-server')).toHaveLength(2);
    });
  });
});