/**
 * @fileoverview MCPRegistry Unit Tests - listServers() and Filtering
 *
 * Comprehensive test suite for MCPRegistry's listServers() method and filtering capabilities.
 * Tests all filtering scenarios as specified in the acceptance criteria:
 * - listServers() without filters
 * - filtering by category
 * - filtering by verified status
 * - filtering by capabilities
 * - text search by name/description
 * - combined filters
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import {
  MCPRegistry,
  type MCPCatalog,
  type MCPFilterOptions,
} from '../mcp/mcp-registry.js';
import type { MCPMarketplaceEntry } from '../types.js';

// Mock fs to control file system operations
vi.mock('fs', () => {
  const readFileSyncMock = vi.fn();
  return {
    readFileSync: readFileSyncMock,
    default: { readFileSync: readFileSyncMock },
  };
});
const mockReadFileSync = vi.mocked(readFileSync);

describe('MCPRegistry - listServers() and Filtering', () => {
  // Comprehensive test catalog with diverse servers for thorough filtering tests
  const testCatalog: MCPCatalog = {
    version: '1.0.0',
    updated: '2024-01-01T00:00:00Z',
    description: 'Test catalog for filtering',
    categories: {
      filesystem: { name: 'File System', description: 'File operations' },
      web: { name: 'Web & HTTP', description: 'Web requests' },
      development: { name: 'Development', description: 'Dev tools' },
      database: { name: 'Database', description: 'Database operations' },
      system: { name: 'System', description: 'System operations' },
      search: { name: 'Search', description: 'Search operations' },
      ai: { name: 'AI & ML', description: 'AI and machine learning' },
    },
    servers: [
      // Filesystem servers
      {
        name: 'filesystem',
        description: 'File system operations and management',
        version: '1.0.0',
        author: 'Test Author',
        verified: true,
        category: 'filesystem',
        capabilities: ['file:read', 'file:write', 'directory:list', 'directory:create'],
        serverConfig: {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          env: {},
        },
      },
      {
        name: 'file-manager',
        description: 'Advanced file management operations',
        version: '2.1.0',
        author: 'FileTeam',
        verified: false,
        category: 'filesystem',
        capabilities: ['file:read', 'file:delete', 'file:move', 'directory:watch'],
        serverConfig: {
          name: 'file-manager',
          command: 'file-manager-server',
          args: [],
          env: { FILE_WATCH_ENABLED: 'true' },
        },
      },

      // Web/HTTP servers
      {
        name: 'fetch',
        description: 'HTTP client for web requests and API calls',
        version: '1.0.0',
        author: 'Web Team',
        verified: true,
        category: 'web',
        capabilities: ['http:get', 'http:post', 'http:put', 'web:request'],
        serverConfig: {
          name: 'fetch',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-fetch'],
          env: {},
        },
      },
      {
        name: 'browser-automation',
        description: 'Browser automation and web scraping',
        version: '1.5.0',
        author: 'BrowserTeam',
        verified: false,
        category: 'web',
        capabilities: ['browser:navigate', 'browser:click', 'web:scrape'],
        serverConfig: {
          name: 'browser-automation',
          command: 'browser-server',
          args: ['--headless'],
          env: { BROWSER_TYPE: 'chrome' },
        },
      },

      // Database servers
      {
        name: 'postgres',
        description: 'PostgreSQL database operations and queries',
        version: '1.0.0',
        author: 'DB Team',
        verified: true,
        category: 'database',
        capabilities: ['db:query', 'sql:execute', 'db:transaction'],
        serverConfig: {
          name: 'postgres',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres'],
          env: { POSTGRES_CONNECTION_STRING: 'required' },
        },
      },
      {
        name: 'mysql',
        description: 'MySQL database server connector',
        version: '2.0.0',
        author: 'MySQL Team',
        verified: true,
        category: 'database',
        capabilities: ['db:query', 'sql:execute', 'db:backup'],
        serverConfig: {
          name: 'mysql',
          command: 'mysql-mcp-server',
          args: [],
          env: { MYSQL_HOST: 'localhost' },
        },
      },

      // Development tools
      {
        name: 'git-manager',
        description: 'Git version control operations',
        version: '1.3.0',
        author: 'DevTools Inc',
        verified: true,
        category: 'development',
        capabilities: ['git:commit', 'git:push', 'git:branch', 'git:merge'],
        serverConfig: {
          name: 'git-manager',
          command: 'git-mcp-server',
          args: [],
          env: {},
        },
      },

      // Search servers
      {
        name: 'elasticsearch',
        description: 'Elasticsearch search and indexing',
        version: '1.0.0',
        author: 'Search Corp',
        verified: false,
        category: 'search',
        capabilities: ['search:index', 'search:query', 'search:aggregate'],
        serverConfig: {
          name: 'elasticsearch',
          command: 'elasticsearch-mcp',
          args: ['--port', '9200'],
          env: { ES_CLUSTER: 'local' },
        },
      },

      // AI/ML servers
      {
        name: 'openai-gpt',
        description: 'OpenAI GPT model integration',
        version: '3.0.0',
        author: 'AI Team',
        verified: true,
        category: 'ai',
        capabilities: ['ai:text-generation', 'ai:completion', 'ai:chat'],
        serverConfig: {
          name: 'openai-gpt',
          command: 'openai-mcp-server',
          args: [],
          env: { OPENAI_API_KEY: 'required' },
        },
      },

      // System servers
      {
        name: 'docker-manager',
        description: 'Docker container management',
        version: '1.2.0',
        author: 'Container Co',
        verified: false,
        category: 'system',
        capabilities: ['docker:run', 'docker:build', 'system:monitor'],
        serverConfig: {
          name: 'docker-manager',
          command: 'docker-mcp-server',
          args: [],
          env: { DOCKER_HOST: 'unix:///var/run/docker.sock' },
        },
      },

      // Mixed capabilities server (intentionally uncategorized)
      {
        name: 'multi-tool',
        description: 'Multi-purpose server with various capabilities',
        version: '1.0.0',
        author: 'Multi Corp',
        verified: true,
        capabilities: ['file:read', 'http:get', 'search:query'],
        serverConfig: {
          name: 'multi-tool',
          command: 'multi-tool-server',
          args: [],
          env: {},
        },
      },
    ],
  };

  beforeEach(() => {
    // Reset singleton instance before each test
    MCPRegistry.resetInstance();

    // Mock successful file read by default
    mockReadFileSync.mockReturnValue(JSON.stringify(testCatalog));

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset singleton instance after each test
    MCPRegistry.resetInstance();
  });

  describe('listServers() - No Filters', () => {
    it('should return all servers when no filter is provided', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers();

      expect(servers).toHaveLength(testCatalog.servers.length);
      expect(servers.length).toBe(11); // Verify we have all 11 test servers

      // Check that all expected servers are present
      const serverNames = servers.map(s => s.name).sort();
      const expectedNames = [
        'browser-automation',
        'docker-manager',
        'elasticsearch',
        'fetch',
        'file-manager',
        'filesystem',
        'git-manager',
        'multi-tool',
        'mysql',
        'openai-gpt',
        'postgres'
      ];
      expect(serverNames).toEqual(expectedNames);
    });

    it('should return servers with all their properties intact', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers();

      servers.forEach(server => {
        expect(server).toHaveProperty('name');
        expect(server).toHaveProperty('description');
        expect(server).toHaveProperty('version');
        expect(server).toHaveProperty('verified');
        expect(server).toHaveProperty('capabilities');
        expect(server).toHaveProperty('serverConfig');
        expect(typeof server.verified).toBe('boolean');
        expect(Array.isArray(server.capabilities)).toBe(true);
      });
    });

    it('should return servers in the same order as the catalog', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers();

      expect(servers[0].name).toBe('filesystem');
      expect(servers[1].name).toBe('file-manager');
      expect(servers[2].name).toBe('fetch');
      expect(servers[3].name).toBe('browser-automation');
    });
  });

  describe('Filtering by Category', () => {
    it('should filter servers by filesystem category', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers({ category: 'filesystem' });

      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name).sort()).toEqual(['file-manager', 'filesystem']);
    });

    it('should filter servers by web category', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers({ category: 'web' });

      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name).sort()).toEqual(['browser-automation', 'fetch']);
    });

    it('should filter servers by database category', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers({ category: 'database' });

      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name).sort()).toEqual(['mysql', 'postgres']);
    });

    it('should filter servers by development category', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers({ category: 'development' });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('git-manager');
    });

    it('should filter servers by search category', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers({ category: 'search' });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('elasticsearch');
    });

    it('should filter servers by system category', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers({ category: 'system' });

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('docker-manager');
    });

    it('should return empty array for non-existent category', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers({ category: 'nonexistent-category' });

      expect(servers).toHaveLength(0);
    });

    it('should return servers for uncategorized category', () => {
      const registry = MCPRegistry.getInstance();
      const servers = registry.listServers({ category: 'uncategorized' });

      // multi-tool should be in uncategorized due to lack of explicit category
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('multi-tool');
    });
  });

  describe('Filtering by Verified Status', () => {
    it('should filter for verified servers only', () => {
      const registry = MCPRegistry.getInstance();
      const verifiedServers = registry.listServers({ verified: true });

      expect(verifiedServers).toHaveLength(7);
      const verifiedNames = verifiedServers.map(s => s.name).sort();
      expect(verifiedNames).toEqual([
        'fetch',
        'filesystem',
        'git-manager',
        'multi-tool',
        'mysql',
        'openai-gpt',
        'postgres'
      ]);

      // Verify all returned servers are verified
      verifiedServers.forEach(server => {
        expect(server.verified).toBe(true);
      });
    });

    it('should filter for unverified servers only', () => {
      const registry = MCPRegistry.getInstance();
      const unverifiedServers = registry.listServers({ verified: false });

      expect(unverifiedServers).toHaveLength(4);
      const unverifiedNames = unverifiedServers.map(s => s.name).sort();
      expect(unverifiedNames).toEqual([
        'browser-automation',
        'docker-manager',
        'elasticsearch',
        'file-manager'
      ]);

      // Verify all returned servers are unverified
      unverifiedServers.forEach(server => {
        expect(server.verified).toBe(false);
      });
    });

    it('should return all servers when verified filter is undefined', () => {
      const registry = MCPRegistry.getInstance();
      const allServers = registry.listServers({ verified: undefined });
      const noFilterServers = registry.listServers();

      expect(allServers).toHaveLength(noFilterServers.length);
      expect(allServers).toEqual(noFilterServers);
    });
  });

  describe('Filtering by Capabilities', () => {
    it('should filter servers with single capability', () => {
      const registry = MCPRegistry.getInstance();

      const fileReadServers = registry.listServers({ capabilities: ['file:read'] });
      expect(fileReadServers).toHaveLength(3);
      expect(fileReadServers.map(s => s.name).sort()).toEqual(['file-manager', 'filesystem', 'multi-tool']);

      const httpGetServers = registry.listServers({ capabilities: ['http:get'] });
      expect(httpGetServers).toHaveLength(2);
      expect(httpGetServers.map(s => s.name).sort()).toEqual(['fetch', 'multi-tool']);
    });

    it('should filter servers with multiple capabilities (all must be present)', () => {
      const registry = MCPRegistry.getInstance();

      const fileWriteAndReadServers = registry.listServers({
        capabilities: ['file:read', 'file:write']
      });
      expect(fileWriteAndReadServers).toHaveLength(1);
      expect(fileWriteAndReadServers[0].name).toBe('filesystem');

      const httpGetAndPostServers = registry.listServers({
        capabilities: ['http:get', 'http:post']
      });
      expect(httpGetAndPostServers).toHaveLength(1);
      expect(httpGetAndPostServers[0].name).toBe('fetch');
    });

    it('should filter servers with database capabilities', () => {
      const registry = MCPRegistry.getInstance();

      const dbQueryServers = registry.listServers({ capabilities: ['db:query'] });
      expect(dbQueryServers).toHaveLength(2);
      expect(dbQueryServers.map(s => s.name).sort()).toEqual(['mysql', 'postgres']);

      const sqlExecuteServers = registry.listServers({ capabilities: ['sql:execute'] });
      expect(sqlExecuteServers).toHaveLength(2);
      expect(sqlExecuteServers.map(s => s.name).sort()).toEqual(['mysql', 'postgres']);
    });

    it('should filter servers with git capabilities', () => {
      const registry = MCPRegistry.getInstance();

      const gitCommitServers = registry.listServers({ capabilities: ['git:commit'] });
      expect(gitCommitServers).toHaveLength(1);
      expect(gitCommitServers[0].name).toBe('git-manager');

      const gitPushServers = registry.listServers({ capabilities: ['git:push'] });
      expect(gitPushServers).toHaveLength(1);
      expect(gitPushServers[0].name).toBe('git-manager');
    });

    it('should filter servers with AI capabilities', () => {
      const registry = MCPRegistry.getInstance();

      const aiTextGenServers = registry.listServers({ capabilities: ['ai:text-generation'] });
      expect(aiTextGenServers).toHaveLength(1);
      expect(aiTextGenServers[0].name).toBe('openai-gpt');
    });

    it('should return empty array for non-existent capabilities', () => {
      const registry = MCPRegistry.getInstance();

      const nonexistentServers = registry.listServers({
        capabilities: ['nonexistent:capability']
      });
      expect(nonexistentServers).toHaveLength(0);
    });

    it('should return empty array when not all capabilities are present', () => {
      const registry = MCPRegistry.getInstance();

      const impossibleServers = registry.listServers({
        capabilities: ['file:read', 'ai:text-generation']
      });
      expect(impossibleServers).toHaveLength(0);
    });

    it('should handle empty capabilities array', () => {
      const registry = MCPRegistry.getInstance();

      const allServers = registry.listServers({ capabilities: [] });
      const noFilterServers = registry.listServers();

      expect(allServers).toEqual(noFilterServers);
    });
  });

  describe('Text Search by Name and Description', () => {
    it('should search by server name (case insensitive)', () => {
      const registry = MCPRegistry.getInstance();

      const postgresServers = registry.listServers({ search: 'postgres' });
      expect(postgresServers).toHaveLength(1);
      expect(postgresServers[0].name).toBe('postgres');

      const fetchServers = registry.listServers({ search: 'FETCH' });
      expect(fetchServers).toHaveLength(1);
      expect(fetchServers[0].name).toBe('fetch');
    });

    it('should search by partial name matches', () => {
      const registry = MCPRegistry.getInstance();

      const fileServers = registry.listServers({ search: 'file' });
      expect(fileServers).toHaveLength(2);
      expect(fileServers.map(s => s.name).sort()).toEqual(['file-manager', 'filesystem']);

      const managerServers = registry.listServers({ search: 'manager' });
      expect(managerServers).toHaveLength(3);
      expect(managerServers.map(s => s.name).sort()).toEqual(['docker-manager', 'file-manager', 'git-manager']);
    });

    it('should search by description text (case insensitive)', () => {
      const registry = MCPRegistry.getInstance();

      const httpServers = registry.listServers({ search: 'HTTP' });
      expect(httpServers).toHaveLength(1);
      expect(httpServers[0].name).toBe('fetch');

      const databaseServers = registry.listServers({ search: 'database' });
      expect(databaseServers).toHaveLength(2);
      expect(databaseServers.map(s => s.name).sort()).toEqual(['mysql', 'postgres']);
    });

    it('should search by partial description matches', () => {
      const registry = MCPRegistry.getInstance();

      const operationsServers = registry.listServers({ search: 'operations' });
      expect(operationsServers.length).toBeGreaterThan(0);

      const managementServers = registry.listServers({ search: 'management' });
      expect(managementServers.length).toBeGreaterThan(0);
    });

    it('should search across both name and description', () => {
      const registry = MCPRegistry.getInstance();

      const gitServers = registry.listServers({ search: 'git' });
      expect(gitServers).toHaveLength(1);
      expect(gitServers[0].name).toBe('git-manager');

      const dockerServers = registry.listServers({ search: 'docker' });
      expect(dockerServers).toHaveLength(1);
      expect(dockerServers[0].name).toBe('docker-manager');
    });

    it('should return empty array for non-matching search text', () => {
      const registry = MCPRegistry.getInstance();

      const noMatchServers = registry.listServers({ search: 'xyz-nonexistent' });
      expect(noMatchServers).toHaveLength(0);
    });

    it('should handle special characters in search', () => {
      const registry = MCPRegistry.getInstance();

      const specialCharServers = registry.listServers({ search: 'multi-tool' });
      expect(specialCharServers).toHaveLength(1);
      expect(specialCharServers[0].name).toBe('multi-tool');
    });
  });

  describe('Combined Filters', () => {
    it('should apply category and verified filters together', () => {
      const registry = MCPRegistry.getInstance();

      const verifiedDatabaseServers = registry.listServers({
        category: 'database',
        verified: true
      });
      expect(verifiedDatabaseServers).toHaveLength(2);
      expect(verifiedDatabaseServers.map(s => s.name).sort()).toEqual(['mysql', 'postgres']);

      const unverifiedWebServers = registry.listServers({
        category: 'web',
        verified: false
      });
      expect(unverifiedWebServers).toHaveLength(1);
      expect(unverifiedWebServers[0].name).toBe('browser-automation');
    });

    it('should apply category and capabilities filters together', () => {
      const registry = MCPRegistry.getInstance();

      const filesystemWithReadServers = registry.listServers({
        category: 'filesystem',
        capabilities: ['file:read']
      });
      expect(filesystemWithReadServers).toHaveLength(2);
      expect(filesystemWithReadServers.map(s => s.name).sort()).toEqual(['file-manager', 'filesystem']);

      const webWithHttpGetServers = registry.listServers({
        category: 'web',
        capabilities: ['http:get']
      });
      expect(webWithHttpGetServers).toHaveLength(1);
      expect(webWithHttpGetServers[0].name).toBe('fetch');
    });

    it('should apply verified and capabilities filters together', () => {
      const registry = MCPRegistry.getInstance();

      const verifiedFileServers = registry.listServers({
        verified: true,
        capabilities: ['file:read']
      });
      expect(verifiedFileServers).toHaveLength(2);
      expect(verifiedFileServers.map(s => s.name).sort()).toEqual(['filesystem', 'multi-tool']);

      const verifiedDatabaseServers = registry.listServers({
        verified: true,
        capabilities: ['db:query']
      });
      expect(verifiedDatabaseServers).toHaveLength(2);
      expect(verifiedDatabaseServers.map(s => s.name).sort()).toEqual(['mysql', 'postgres']);
    });

    it('should apply search and verified filters together', () => {
      const registry = MCPRegistry.getInstance();

      const verifiedManagerServers = registry.listServers({
        search: 'manager',
        verified: true
      });
      expect(verifiedManagerServers).toHaveLength(1);
      expect(verifiedManagerServers[0].name).toBe('git-manager');

      const unverifiedDatabaseServers = registry.listServers({
        search: 'database',
        verified: false
      });
      expect(unverifiedDatabaseServers).toHaveLength(0); // Both database servers are verified
    });

    it('should apply search and capabilities filters together', () => {
      const registry = MCPRegistry.getInstance();

      const httpFileServers = registry.listServers({
        search: 'file',
        capabilities: ['file:read']
      });
      expect(httpFileServers).toHaveLength(2);
      expect(httpFileServers.map(s => s.name).sort()).toEqual(['file-manager', 'filesystem']);
    });

    it('should apply all four filters together', () => {
      const registry = MCPRegistry.getInstance();

      const complexFilterServers = registry.listServers({
        category: 'filesystem',
        verified: true,
        capabilities: ['file:read', 'file:write'],
        search: 'file'
      });
      expect(complexFilterServers).toHaveLength(1);
      expect(complexFilterServers[0].name).toBe('filesystem');

      const noMatchServers = registry.listServers({
        category: 'web',
        verified: true,
        capabilities: ['ai:text-generation'], // AI capability not in web category
        search: 'browser'
      });
      expect(noMatchServers).toHaveLength(0);
    });

    it('should return empty array when no servers match combined criteria', () => {
      const registry = MCPRegistry.getInstance();

      const impossibleServers = registry.listServers({
        category: 'filesystem',
        verified: true,
        capabilities: ['ai:text-generation'],
        search: 'impossible'
      });
      expect(impossibleServers).toHaveLength(0);
    });

    it('should handle partial matches across multiple filters', () => {
      const registry = MCPRegistry.getInstance();

      const partialMatchServers = registry.listServers({
        verified: true,
        capabilities: ['file:read'],
        search: 'multi'
      });
      expect(partialMatchServers).toHaveLength(1);
      expect(partialMatchServers[0].name).toBe('multi-tool');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle servers with no capabilities gracefully', () => {
      // Test scenario where a server has no capabilities array
      const catalogWithNoCapabilities: MCPCatalog = {
        ...testCatalog,
        servers: [
          {
            name: 'no-capabilities-server',
            description: 'Server with no capabilities',
            version: '1.0.0',
            author: 'Test',
            verified: true,
            capabilities: [],
            serverConfig: {
              name: 'no-capabilities-server',
              command: 'test',
              args: [],
              env: {},
            },
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithNoCapabilities));
      MCPRegistry.resetInstance();

      const registry = MCPRegistry.getInstance();

      const allServers = registry.listServers();
      expect(allServers).toHaveLength(1);

      const capabilityFilteredServers = registry.listServers({ capabilities: ['any:capability'] });
      expect(capabilityFilteredServers).toHaveLength(0);

      const emptyCapabilityFilteredServers = registry.listServers({ capabilities: [] });
      expect(emptyCapabilityFilteredServers).toEqual(allServers);
    });

    it('should handle undefined capabilities gracefully', () => {
      // Test scenario where a server has undefined capabilities
      const catalogWithUndefinedCapabilities: MCPCatalog = {
        ...testCatalog,
        servers: [
          {
            name: 'undefined-capabilities-server',
            description: 'Server with undefined capabilities',
            version: '1.0.0',
            author: 'Test',
            verified: true,
            capabilities: undefined as any,
            serverConfig: {
              name: 'undefined-capabilities-server',
              command: 'test',
              args: [],
              env: {},
            },
          }
        ]
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(catalogWithUndefinedCapabilities));
      MCPRegistry.resetInstance();

      const registry = MCPRegistry.getInstance();

      const allServers = registry.listServers();
      expect(allServers).toHaveLength(1);

      const capabilityFilteredServers = registry.listServers({ capabilities: ['any:capability'] });
      expect(capabilityFilteredServers).toHaveLength(0);
    });

    it('should handle empty search strings', () => {
      const registry = MCPRegistry.getInstance();

      const emptySearchServers = registry.listServers({ search: '' });
      const allServers = registry.listServers();

      expect(emptySearchServers).toEqual(allServers);
    });

    it('should handle whitespace-only search strings', () => {
      const registry = MCPRegistry.getInstance();

      const whitespaceSearchServers = registry.listServers({ search: '   ' });
      expect(whitespaceSearchServers).toHaveLength(0);
    });

    it('should handle case-sensitive capability matching', () => {
      const registry = MCPRegistry.getInstance();

      const upperCaseServers = registry.listServers({ capabilities: ['FILE:READ'] });
      expect(upperCaseServers).toHaveLength(0); // Capabilities are case-sensitive

      const correctCaseServers = registry.listServers({ capabilities: ['file:read'] });
      expect(correctCaseServers).toHaveLength(3);
    });
  });
});