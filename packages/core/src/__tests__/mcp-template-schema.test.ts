import { describe, it, expect } from 'vitest';
import {
  MCPTemplateSchema,
  MCPTemplate,
  MCPServerConfigSchema,
  MCPEnvironmentVarSchema,
} from '../types.js';

/**
 * Comprehensive test suite for MCPTemplate schema
 * Tests validation, edge cases, and TypeScript type inference for MCP server templates
 *
 * MCPTemplate represents a reusable template for configuring MCP servers,
 * including environment variable requirements and capability declarations.
 */
describe('MCPTemplate Schema Tests', () => {
  describe('Valid configurations', () => {
    it('should accept minimal required configuration', () => {
      const minimalTemplate = {
        id: 'minimal-template',
        name: 'Minimal Template',
        description: 'A minimal test template',
        package: '@mcp/minimal-server',
        config: {},
      };

      const result = MCPTemplateSchema.parse(minimalTemplate);

      expect(result.id).toBe('minimal-template');
      expect(result.name).toBe('Minimal Template');
      expect(result.description).toBe('A minimal test template');
      expect(result.package).toBe('@mcp/minimal-server');
      expect(result.config).toEqual({});
      expect(result.envVars).toEqual([]); // Default value
      expect(result.capabilities).toEqual([]); // Default value
      expect(result.verified).toBe(false); // Default value
      expect(result.defaultEnabled).toBe(false); // Default value
      expect(result.tags).toEqual([]); // Default value
    });

    it('should accept complete template configuration', () => {
      const completeTemplate = {
        id: 'filesystem-server',
        name: 'Filesystem Server',
        description: 'MCP server for filesystem operations',
        package: '@modelcontextprotocol/server-filesystem',
        config: {
          name: 'filesystem',
          type: 'stdio' as const,
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
        capabilities: ['filesystem', 'read', 'write', 'search'],
        verified: true,
        defaultEnabled: true,
        category: 'filesystem',
        tags: ['filesystem', 'files', 'workspace'],
        minVersion: '1.0.0',
        documentationUrl: 'https://docs.example.com/filesystem-server',
        repositoryUrl: 'https://github.com/example/filesystem-server',
      };

      const result = MCPTemplateSchema.parse(completeTemplate);

      expect(result.id).toBe('filesystem-server');
      expect(result.name).toBe('Filesystem Server');
      expect(result.description).toBe('MCP server for filesystem operations');
      expect(result.package).toBe('@modelcontextprotocol/server-filesystem');
      expect(result.config.name).toBe('filesystem');
      expect(result.config.type).toBe('stdio');
      expect(result.envVars).toHaveLength(2);
      expect(result.envVars[0].name).toBe('WORKSPACE_ROOT');
      expect(result.capabilities).toEqual(['filesystem', 'read', 'write', 'search']);
      expect(result.verified).toBe(true);
      expect(result.defaultEnabled).toBe(true);
      expect(result.category).toBe('filesystem');
      expect(result.tags).toEqual(['filesystem', 'files', 'workspace']);
      expect(result.minVersion).toBe('1.0.0');
      expect(result.documentationUrl).toBe('https://docs.example.com/filesystem-server');
      expect(result.repositoryUrl).toBe('https://github.com/example/filesystem-server');
    });

    it('should handle various package name formats', () => {
      const packageFormats = [
        '@modelcontextprotocol/server-filesystem',
        '@mcp/github-server',
        'simple-mcp-server',
        '@scope/complex-mcp-server-with-long-name',
        'local-file-server',
      ];

      packageFormats.forEach(packageName => {
        const template = {
          id: `test-${packageName.replace(/[@/]/g, '-')}`,
          name: 'Test Template',
          description: 'Test template for package validation',
          package: packageName,
          config: {},
        };

        expect(() => MCPTemplateSchema.parse(template)).not.toThrow();
        const result = MCPTemplateSchema.parse(template);
        expect(result.package).toBe(packageName);
      });
    });

    it('should handle various template categories', () => {
      const categories = [
        'filesystem',
        'database',
        'api',
        'development',
        'communication',
        'productivity',
        'security',
        'analytics',
      ];

      categories.forEach(category => {
        const template = {
          id: `${category}-template`,
          name: `${category} Template`,
          description: `Template for ${category} operations`,
          package: `@mcp/${category}-server`,
          config: {},
          category,
        };

        expect(() => MCPTemplateSchema.parse(template)).not.toThrow();
        const result = MCPTemplateSchema.parse(template);
        expect(result.category).toBe(category);
      });
    });

    it('should handle various tag configurations', () => {
      const tagConfigurations = [
        [],
        ['filesystem'],
        ['api', 'database'],
        ['development', 'testing', 'ci-cd', 'automation'],
        ['productivity', 'communication', 'slack', 'messaging', 'notifications'],
      ];

      tagConfigurations.forEach((tags, index) => {
        const template = {
          id: `tags-test-${index}`,
          name: 'Tags Test Template',
          description: 'Template for testing tag validation',
          package: '@mcp/tags-test',
          config: {},
          tags,
        };

        expect(() => MCPTemplateSchema.parse(template)).not.toThrow();
        const result = MCPTemplateSchema.parse(template);
        expect(result.tags).toEqual(tags);
      });
    });

    it('should handle partial server configurations', () => {
      const partialConfigs = [
        {},
        { name: 'partial-server' },
        { type: 'http' as const },
        { command: 'node', args: ['server.js'] },
        { autoStart: true, capabilities: ['api'] },
      ];

      partialConfigs.forEach((config, index) => {
        const template = {
          id: `partial-config-${index}`,
          name: 'Partial Config Template',
          description: 'Template with partial server configuration',
          package: '@mcp/partial-test',
          config,
        };

        expect(() => MCPTemplateSchema.parse(template)).not.toThrow();
        const result = MCPTemplateSchema.parse(template);
        expect(result.config).toEqual(config);
      });
    });

    it('should handle complex environment variable configurations', () => {
      const complexEnvVars = [
        {
          name: 'API_KEY',
          description: 'API key for external service authentication',
          required: true,
          sensitive: true,
          source: 'user' as const,
        },
        {
          name: 'DATABASE_URL',
          description: 'Connection string for database',
          required: true,
          sensitive: true,
          pattern: '^postgresql://.*',
          source: 'env' as const,
        },
        {
          name: 'LOG_LEVEL',
          description: 'Logging verbosity level',
          required: false,
          sensitive: false,
          defaultValue: 'info',
          source: 'default' as const,
        },
        {
          name: 'WORKSPACE_PATH',
          description: 'Path to workspace directory',
          required: true,
          sensitive: false,
          defaultValue: '/workspace',
          source: 'config' as const,
        },
      ];

      const template = {
        id: 'complex-envvars',
        name: 'Complex Environment Variables Template',
        description: 'Template with complex environment variable setup',
        package: '@mcp/complex-envvars',
        config: {},
        envVars: complexEnvVars,
      };

      const result = MCPTemplateSchema.parse(template);

      expect(result.envVars).toHaveLength(4);
      expect(result.envVars[0].name).toBe('API_KEY');
      expect(result.envVars[0].sensitive).toBe(true);
      expect(result.envVars[1].pattern).toBe('^postgresql://.*');
      expect(result.envVars[2].defaultValue).toBe('info');
      expect(result.envVars[3].source).toBe('config');
    });

    it('should handle version specifications', () => {
      const versionFormats = [
        '1.0.0',
        '2.1.0',
        '0.5.0-beta.1',
        '^1.2.0',
        '~2.1.0',
        '>=1.0.0 <2.0.0',
      ];

      versionFormats.forEach(version => {
        const template = {
          id: 'version-test',
          name: 'Version Test Template',
          description: 'Template for version validation',
          package: '@mcp/version-test',
          config: {},
          minVersion: version,
        };

        expect(() => MCPTemplateSchema.parse(template)).not.toThrow();
        const result = MCPTemplateSchema.parse(template);
        expect(result.minVersion).toBe(version);
      });
    });

    it('should handle URL formats for documentation and repository', () => {
      const urlPairs = [
        {
          docs: 'https://docs.example.com/mcp-server',
          repo: 'https://github.com/example/mcp-server',
        },
        {
          docs: 'https://mcp-server.readthedocs.io/',
          repo: 'https://gitlab.com/example/mcp-server',
        },
        {
          docs: 'https://example.github.io/mcp-server/',
          repo: 'https://bitbucket.org/example/mcp-server',
        },
      ];

      urlPairs.forEach(({ docs, repo }, index) => {
        const template = {
          id: `url-test-${index}`,
          name: 'URL Test Template',
          description: 'Template for URL validation',
          package: '@mcp/url-test',
          config: {},
          documentationUrl: docs,
          repositoryUrl: repo,
        };

        expect(() => MCPTemplateSchema.parse(template)).not.toThrow();
        const result = MCPTemplateSchema.parse(template);
        expect(result.documentationUrl).toBe(docs);
        expect(result.repositoryUrl).toBe(repo);
      });
    });
  });

  describe('Validation errors', () => {
    it('should reject empty or invalid id', () => {
      const invalidIds = ['', '   ', '\t', '\n', null, undefined, 123, {}, [], true];

      invalidIds.forEach(id => {
        const template = {
          id,
          name: 'Test Template',
          description: 'Test description',
          package: '@mcp/test',
          config: {},
        };

        expect(() => MCPTemplateSchema.parse(template)).toThrow();
      });
    });

    it('should reject empty or invalid name', () => {
      const invalidNames = ['', '   ', '\t', '\n', null, undefined, 123, {}, [], true];

      invalidNames.forEach(name => {
        const template = {
          id: 'test-template',
          name,
          description: 'Test description',
          package: '@mcp/test',
          config: {},
        };

        expect(() => MCPTemplateSchema.parse(template)).toThrow();
      });
    });

    it('should reject empty or invalid description', () => {
      const invalidDescriptions = ['', '   ', '\t', '\n', null, undefined, 123, {}, [], true];

      invalidDescriptions.forEach(description => {
        const template = {
          id: 'test-template',
          name: 'Test Template',
          description,
          package: '@mcp/test',
          config: {},
        };

        expect(() => MCPTemplateSchema.parse(template)).toThrow();
      });
    });

    it('should reject empty or invalid package', () => {
      const invalidPackages = ['', '   ', '\t', '\n', null, undefined, 123, {}, [], true];

      invalidPackages.forEach(packageName => {
        const template = {
          id: 'test-template',
          name: 'Test Template',
          description: 'Test description',
          package: packageName,
          config: {},
        };

        expect(() => MCPTemplateSchema.parse(template)).toThrow();
      });
    });

    it('should reject invalid config values', () => {
      const invalidConfigs = ['string', 123, [], null, true, false];

      invalidConfigs.forEach(config => {
        const template = {
          id: 'test-template',
          name: 'Test Template',
          description: 'Test description',
          package: '@mcp/test',
          config,
        };

        expect(() => MCPTemplateSchema.parse(template)).toThrow();
      });
    });

    it('should reject invalid envVars configurations', () => {
      const invalidEnvVars = [
        'string-not-array',
        123,
        {},
        null,
        true,
        false,
        [{ /* missing name */ description: 'Invalid' }],
        [{ name: 'VALID' }, 'invalid-string-in-array'],
        [{ name: 'VALID' }, 123],
      ];

      invalidEnvVars.forEach(envVars => {
        const template = {
          id: 'test-template',
          name: 'Test Template',
          description: 'Test description',
          package: '@mcp/test',
          config: {},
          envVars,
        };

        expect(() => MCPTemplateSchema.parse(template)).toThrow();
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
        const template = {
          id: 'test-template',
          name: 'Test Template',
          description: 'Test description',
          package: '@mcp/test',
          config: {},
          capabilities,
        };

        expect(() => MCPTemplateSchema.parse(template)).toThrow();
      });
    });

    it('should reject invalid boolean values', () => {
      const invalidBooleans = ['true', 'false', 1, 0, 'yes', 'no', {}, [], null];

      ['verified', 'defaultEnabled'].forEach(field => {
        invalidBooleans.forEach(value => {
          const template = {
            id: 'test-template',
            name: 'Test Template',
            description: 'Test description',
            package: '@mcp/test',
            config: {},
            [field]: value,
          };

          expect(() => MCPTemplateSchema.parse(template)).toThrow();
        });
      });
    });

    it('should reject invalid tags values', () => {
      const invalidTags = [
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

      invalidTags.forEach(tags => {
        const template = {
          id: 'test-template',
          name: 'Test Template',
          description: 'Test description',
          package: '@mcp/test',
          config: {},
          tags,
        };

        expect(() => MCPTemplateSchema.parse(template)).toThrow();
      });
    });

    it('should reject missing required fields', () => {
      const requiredFields = ['id', 'name', 'description', 'package'];

      requiredFields.forEach(fieldToOmit => {
        const template = {
          id: 'test-template',
          name: 'Test Template',
          description: 'Test description',
          package: '@mcp/test',
          config: {},
        };

        delete template[fieldToOmit as keyof typeof template];

        expect(() => MCPTemplateSchema.parse(template)).toThrow();
      });
    });
  });

  describe('TypeScript type inference', () => {
    it('should provide correct TypeScript types', () => {
      const template = MCPTemplateSchema.parse({
        id: 'type-test-template',
        name: 'Type Test Template',
        description: 'Template for TypeScript type testing',
        package: '@mcp/type-test',
        config: {
          name: 'type-test-server',
          type: 'stdio',
          command: 'npx',
          autoStart: true,
        },
        envVars: [
          {
            name: 'TEST_VAR',
            description: 'Test variable',
            required: true,
            sensitive: false,
            source: 'config',
          },
        ],
        capabilities: ['test', 'development'],
        verified: true,
        defaultEnabled: false,
        category: 'development',
        tags: ['test', 'dev'],
        minVersion: '1.0.0',
        documentationUrl: 'https://docs.test.com',
        repositoryUrl: 'https://github.com/test/repo',
      });

      // Type assertions to ensure TypeScript compilation
      const id: string = template.id;
      const name: string = template.name;
      const description: string = template.description;
      const packageName: string = template.package;
      const config: any = template.config;
      const envVars: any[] = template.envVars;
      const capabilities: string[] = template.capabilities;
      const verified: boolean = template.verified;
      const defaultEnabled: boolean = template.defaultEnabled;
      const category: string | undefined = template.category;
      const tags: string[] = template.tags;
      const minVersion: string | undefined = template.minVersion;
      const documentationUrl: string | undefined = template.documentationUrl;
      const repositoryUrl: string | undefined = template.repositoryUrl;

      expect(typeof id).toBe('string');
      expect(typeof name).toBe('string');
      expect(typeof description).toBe('string');
      expect(typeof packageName).toBe('string');
      expect(typeof config).toBe('object');
      expect(Array.isArray(envVars)).toBe(true);
      expect(Array.isArray(capabilities)).toBe(true);
      expect(typeof verified).toBe('boolean');
      expect(typeof defaultEnabled).toBe('boolean');
      expect(typeof category).toBe('string');
      expect(Array.isArray(tags)).toBe(true);
      expect(typeof minVersion).toBe('string');
      expect(typeof documentationUrl).toBe('string');
      expect(typeof repositoryUrl).toBe('string');

      expect(id).toBe('type-test-template');
      expect(name).toBe('Type Test Template');
      expect(verified).toBe(true);
      expect(defaultEnabled).toBe(false);
    });

    it('should handle optional fields correctly in TypeScript', () => {
      const template: MCPTemplate = {
        id: 'minimal-typescript-test',
        name: 'Minimal TypeScript Test',
        description: 'Minimal template for TypeScript testing',
        package: '@mcp/minimal-ts-test',
        config: {},
        envVars: [],
        capabilities: [],
        verified: false,
        defaultEnabled: false,
        tags: [],
      };

      expect(template.id).toBe('minimal-typescript-test');
      expect(template.category).toBeUndefined();
      expect(template.minVersion).toBeUndefined();
      expect(template.documentationUrl).toBeUndefined();
      expect(template.repositoryUrl).toBeUndefined();
    });
  });

  describe('Real-world template scenarios', () => {
    it('should handle filesystem server template', () => {
      const filesystemTemplate = {
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'MCP server providing filesystem access and manipulation capabilities',
        package: '@modelcontextprotocol/server-filesystem',
        config: {
          name: 'filesystem',
          type: 'stdio' as const,
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
          autoStart: true,
        },
        envVars: [
          {
            name: 'ALLOWED_PATHS',
            description: 'Comma-separated list of allowed paths for filesystem operations',
            required: true,
            sensitive: false,
            defaultValue: '/workspace',
            source: 'config' as const,
          },
          {
            name: 'READ_ONLY',
            description: 'Enable read-only mode to prevent write operations',
            required: false,
            sensitive: false,
            defaultValue: 'false',
            source: 'config' as const,
          },
        ],
        capabilities: ['filesystem', 'read', 'write', 'search', 'directory'],
        verified: true,
        defaultEnabled: true,
        category: 'filesystem',
        tags: ['filesystem', 'files', 'workspace', 'io'],
        minVersion: '1.0.0',
        documentationUrl: 'https://modelcontextprotocol.io/servers/filesystem',
        repositoryUrl: 'https://github.com/modelcontextprotocol/servers',
      };

      const result = MCPTemplateSchema.parse(filesystemTemplate);

      expect(result.id).toBe('filesystem');
      expect(result.capabilities).toContain('filesystem');
      expect(result.envVars[0].name).toBe('ALLOWED_PATHS');
      expect(result.verified).toBe(true);
      expect(result.category).toBe('filesystem');
    });

    it('should handle GitHub integration template', () => {
      const githubTemplate = {
        id: 'github',
        name: 'GitHub Integration',
        description: 'MCP server for GitHub API integration and repository management',
        package: '@mcp/github-server',
        config: {
          name: 'github',
          type: 'http' as const,
          url: 'https://api.github.com',
          headers: {
            'User-Agent': 'MCP-GitHub-Client',
            'Accept': 'application/vnd.github.v3+json',
          },
          autoStart: true,
        },
        envVars: [
          {
            name: 'GITHUB_TOKEN',
            description: 'Personal access token for GitHub API authentication',
            required: true,
            sensitive: true,
            source: 'user' as const,
          },
          {
            name: 'GITHUB_ORG',
            description: 'Default GitHub organization name',
            required: false,
            sensitive: false,
            source: 'config' as const,
          },
          {
            name: 'RATE_LIMIT_REQUESTS',
            description: 'Maximum API requests per hour',
            required: false,
            sensitive: false,
            defaultValue: '5000',
            source: 'config' as const,
          },
        ],
        capabilities: ['api', 'github', 'repositories', 'issues', 'pull-requests'],
        verified: true,
        defaultEnabled: false,
        category: 'api',
        tags: ['github', 'git', 'api', 'repositories', 'ci-cd'],
        minVersion: '2.0.0',
        documentationUrl: 'https://docs.github-mcp.com',
        repositoryUrl: 'https://github.com/mcp/github-server',
      };

      const result = MCPTemplateSchema.parse(githubTemplate);

      expect(result.id).toBe('github');
      expect(result.config.type).toBe('http');
      expect(result.envVars[0].sensitive).toBe(true);
      expect(result.capabilities).toContain('github');
      expect(result.tags).toContain('api');
    });

    it('should handle database integration template', () => {
      const databaseTemplate = {
        id: 'postgresql',
        name: 'PostgreSQL Database',
        description: 'MCP server for PostgreSQL database operations and queries',
        package: '@mcp/postgresql-server',
        config: {
          name: 'postgresql',
          type: 'stdio' as const,
          command: 'node',
          args: ['dist/index.js'],
          autoStart: false,
        },
        envVars: [
          {
            name: 'DATABASE_URL',
            description: 'PostgreSQL connection string',
            required: true,
            sensitive: true,
            pattern: '^postgresql://.*',
            source: 'env' as const,
          },
          {
            name: 'MAX_CONNECTIONS',
            description: 'Maximum number of concurrent database connections',
            required: false,
            sensitive: false,
            defaultValue: '10',
            source: 'config' as const,
          },
          {
            name: 'QUERY_TIMEOUT',
            description: 'Query timeout in seconds',
            required: false,
            sensitive: false,
            defaultValue: '30',
            source: 'config' as const,
          },
        ],
        capabilities: ['database', 'sql', 'postgresql', 'queries', 'transactions'],
        verified: false,
        defaultEnabled: false,
        category: 'database',
        tags: ['database', 'postgresql', 'sql', 'queries'],
        minVersion: '1.5.0',
        documentationUrl: 'https://postgres-mcp.readthedocs.io',
        repositoryUrl: 'https://github.com/mcp/postgresql-server',
      };

      const result = MCPTemplateSchema.parse(databaseTemplate);

      expect(result.id).toBe('postgresql');
      expect(result.envVars[0].pattern).toBe('^postgresql://.*');
      expect(result.capabilities).toContain('database');
      expect(result.verified).toBe(false);
      expect(result.category).toBe('database');
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very long string values', () => {
      const longString = 'very-long-'.repeat(100);

      const template = {
        id: longString.substring(0, 200),
        name: longString,
        description: longString,
        package: `@mcp/${longString.substring(0, 100)}`,
        config: {},
        category: longString.substring(0, 50),
      };

      const result = MCPTemplateSchema.parse(template);
      expect(result.name).toBe(longString);
      expect(result.description).toBe(longString);
    });

    it('should handle special characters in template fields', () => {
      const specialTemplate = {
        id: 'special-chars-!@#$%^&*()_+-=[]{}|;:,.<>?',
        name: 'Special Characters Template !@#$%^&*()',
        description: 'Template with special characters in description !@#$%^&*()_+-=[]{}|;:,.<>?',
        package: '@mcp/special-chars-server',
        config: {
          name: 'special-chars-!@#$',
          env: {
            'SPECIAL_VAR_!@#$': 'value-with-special-chars-!@#$%^&*()',
          },
        },
        tags: ['special-!@#$', 'chars-&*()'],
      };

      const result = MCPTemplateSchema.parse(specialTemplate);
      expect(result.name).toContain('!@#$%^&*()');
      expect(result.tags).toContain('special-!@#$');
    });

    it('should handle Unicode characters', () => {
      const unicodeTemplate = {
        id: 'unicode-тест-서버-测试-🚀',
        name: 'Unicode Template тест-서버-测试-🚀',
        description: 'Template with Unicode characters тест-서버-测试-🚀',
        package: '@mcp/unicode-тест-server',
        config: {},
        category: 'unicode-тест',
        tags: ['unicode-тест', 'unicode-서버', 'unicode-测试🚀'],
      };

      const result = MCPTemplateSchema.parse(unicodeTemplate);
      expect(result.name).toContain('тест-서버-测试-🚀');
      expect(result.tags).toContain('unicode-тест');
    });

    it('should handle empty arrays and objects', () => {
      const emptyTemplate = {
        id: 'empty-template',
        name: 'Empty Template',
        description: 'Template with empty arrays and objects',
        package: '@mcp/empty-server',
        config: {},
        envVars: [],
        capabilities: [],
        tags: [],
      };

      const result = MCPTemplateSchema.parse(emptyTemplate);
      expect(result.envVars).toEqual([]);
      expect(result.capabilities).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.config).toEqual({});
    });

    it('should handle large arrays', () => {
      const largeCapabilities = Array.from({ length: 50 }, (_, i) => `capability-${i}`);
      const largeTags = Array.from({ length: 30 }, (_, i) => `tag-${i}`);

      const largeTemplate = {
        id: 'large-arrays-template',
        name: 'Large Arrays Template',
        description: 'Template with large arrays for testing',
        package: '@mcp/large-arrays-server',
        config: {},
        capabilities: largeCapabilities,
        tags: largeTags,
      };

      const result = MCPTemplateSchema.parse(largeTemplate);
      expect(result.capabilities).toHaveLength(50);
      expect(result.tags).toHaveLength(30);
      expect(result.capabilities[0]).toBe('capability-0');
      expect(result.tags[29]).toBe('tag-29');
    });
  });

  describe('Integration with nested schemas', () => {
    it('should properly validate nested config schema', () => {
      const template = {
        id: 'nested-config-test',
        name: 'Nested Config Test',
        description: 'Template for testing nested server config validation',
        package: '@mcp/nested-config',
        config: {
          name: 'nested-server',
          type: 'http' as const,
          url: 'https://api.example.com',
          headers: {
            'Authorization': 'Bearer token',
            'Content-Type': 'application/json',
          },
          autoStart: true,
          capabilities: ['api', 'network'],
          connection: {
            maxRetries: 5,
            timeoutMs: 30000,
            poolSize: 2,
          },
        },
      };

      const result = MCPTemplateSchema.parse(template);

      // Verify nested config is properly validated according to MCPServerConfigSchema
      expect(result.config.name).toBe('nested-server');
      expect(result.config.type).toBe('http');
      expect(result.config.url).toBe('https://api.example.com');
      expect(result.config.headers?.['Authorization']).toBe('Bearer token');
      expect(result.config.autoStart).toBe(true);
    });

    it('should properly validate nested environment variable schema', () => {
      const template = {
        id: 'nested-envvars-test',
        name: 'Nested EnvVars Test',
        description: 'Template for testing nested environment variable validation',
        package: '@mcp/nested-envvars',
        config: {},
        envVars: [
          {
            name: 'COMPLEX_VAR_1',
            description: 'First complex variable',
            required: true,
            sensitive: false,
            defaultValue: 'default1',
            pattern: '^[A-Z_]+$',
            source: 'config' as const,
          },
          {
            name: 'COMPLEX_VAR_2',
            description: 'Second complex variable',
            required: false,
            sensitive: true,
            source: 'user' as const,
          },
        ],
      };

      const result = MCPTemplateSchema.parse(template);

      // Verify envVars are properly validated according to MCPEnvironmentVarSchema
      expect(result.envVars).toHaveLength(2);
      expect(result.envVars[0].name).toBe('COMPLEX_VAR_1');
      expect(result.envVars[0].pattern).toBe('^[A-Z_]+$');
      expect(result.envVars[1].sensitive).toBe(true);
    });
  });
});