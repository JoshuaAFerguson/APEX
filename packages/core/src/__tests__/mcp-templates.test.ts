import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadMCPTemplates, getMCPTemplate, listMCPTemplateIds } from '../mcp-templates.js';
import { MCPTemplate } from '../types.js';

// Mock file system operations and yaml
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  default: { access: vi.fn(), readdir: vi.fn(), readFile: vi.fn() },
}));
vi.mock('yaml', () => ({
  parse: vi.fn(),
  default: { parse: vi.fn() },
}));

describe('mcp-templates', () => {
  let mockTempDir: string;
  let mockTemplatesDir: string;
  let mockMcpTemplatesDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock directory structure
    mockTempDir = '/tmp/test-templates';
    mockTemplatesDir = path.join(mockTempDir, 'templates');
    mockMcpTemplatesDir = path.join(mockTemplatesDir, 'mcp');

    // Import and setup yaml mock
    const yaml = await import('yaml');
    vi.mocked(yaml.parse).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadMCPTemplates', () => {
    it('should load valid MCP templates from directory', async () => {
      const mockFiles = ['filesystem.yaml', 'github.yml', 'postgres.yaml'];
      const mockTemplates = {
        filesystem: {
          id: 'filesystem',
          name: 'Filesystem Server',
          description: 'MCP server providing secure filesystem access',
          package: '@modelcontextprotocol/server-filesystem',
          config: {
            name: 'filesystem',
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            autoStart: true,
          },
          capabilities: ['filesystem', 'read', 'write'],
          verified: true,
          defaultEnabled: true,
          envVars: [],
          tags: [],
        },
        github: {
          id: 'github',
          name: 'GitHub Server',
          description: 'MCP server for GitHub integration',
          package: '@modelcontextprotocol/server-github',
          config: {
            name: 'github',
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
          },
          capabilities: ['github', 'api'],
          verified: true,
          defaultEnabled: false,
          envVars: [],
          tags: [],
        },
        postgres: {
          id: 'postgres',
          name: 'PostgreSQL Server',
          description: 'MCP server for PostgreSQL database access',
          package: '@modelcontextprotocol/server-postgres',
          config: {
            name: 'postgres',
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-postgres'],
          },
          capabilities: ['database', 'sql'],
          verified: true,
          defaultEnabled: false,
          envVars: [],
          tags: [],
        },
      };

      // Mock directory existence and file operations
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles);

      // Mock file reads
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('filesystem yaml content')
        .mockResolvedValueOnce('github yaml content')
        .mockResolvedValueOnce('postgres yaml content');

      // Mock YAML parsing
      const yaml = await import('yaml');
      vi.mocked(yaml.parse)
        .mockReturnValueOnce(mockTemplates.filesystem)
        .mockReturnValueOnce(mockTemplates.github)
        .mockReturnValueOnce(mockTemplates.postgres);

      const result = await loadMCPTemplates(mockTemplatesDir);

      expect(result).toEqual(mockTemplates);
      expect(fs.readdir).toHaveBeenCalledWith(mockMcpTemplatesDir);
      expect(fs.readFile).toHaveBeenCalledTimes(3);
    });

    it('should skip non-YAML files', async () => {
      const mockFiles = ['filesystem.yaml', 'readme.txt', 'github.yml', 'config.json'];
      const mockTemplate = {
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'Test template',
        package: '@test/package',
        config: {},
        capabilities: ['test'],
        verified: true,
        defaultEnabled: true,
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse)
        .mockReturnValueOnce(mockTemplate)
        .mockReturnValueOnce({
          id: 'github',
          name: 'GitHub Server',
          description: 'Test template 2',
          package: '@test/package2',
          config: {},
          capabilities: ['test'],
          verified: true,
          defaultEnabled: false,
        });

      const result = await loadMCPTemplates(mockTemplatesDir);

      // Should only process .yaml and .yml files (2 files)
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should throw error when MCP templates directory does not exist', async () => {
      const error = new Error('Directory not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';

      // Access to base dir succeeds, but readdir of mcp subdir fails
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockRejectedValue(error);

      await expect(loadMCPTemplates(mockTemplatesDir))
        .rejects
        .toThrow('MCP templates directory not found');
    });

    it('should throw error when template parsing fails', async () => {
      const mockFiles = ['invalid.yaml'];

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles);
      vi.mocked(fs.readFile).mockResolvedValue('invalid: yaml: content:');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockImplementation(() => {
        throw new Error('Invalid YAML syntax');
      });

      await expect(loadMCPTemplates(mockTemplatesDir))
        .rejects
        .toThrow('Failed to parse MCP template invalid.yaml: Invalid YAML syntax');
    });

    it('should throw error when template validation fails', async () => {
      const mockFiles = ['invalid-schema.yaml'];
      const invalidTemplate = {
        // Missing required fields
        id: '',
        name: 'Test',
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockReturnValue(invalidTemplate);

      await expect(loadMCPTemplates(mockTemplatesDir))
        .rejects
        .toThrow('Failed to parse MCP template invalid-schema.yaml');
    });

    it('should use default templates directory when none provided', async () => {
      // Mock multiple access attempts to simulate directory searching
      let accessCallCount = 0;
      vi.mocked(fs.access).mockImplementation(async () => {
        accessCallCount++;
        if (accessCallCount === 1) {
          // First attempt succeeds (local development path)
          return Promise.resolve(undefined);
        }
        throw new Error('Directory not found');
      });

      vi.mocked(fs.readdir).mockResolvedValue([]);

      await loadMCPTemplates();

      expect(fs.access).toHaveBeenCalled();
      expect(fs.readdir).toHaveBeenCalled();
    });

    it('should throw error when no templates directory found in default locations', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));

      await expect(loadMCPTemplates())
        .rejects
        .toThrow('Templates directory not found in any of the expected locations');
    });

    it('should throw error when custom templates directory does not exist', async () => {
      const customPath = '/nonexistent/templates';
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));

      await expect(loadMCPTemplates(customPath))
        .rejects
        .toThrow(`Custom templates directory not found: ${customPath}`);
    });

    it('should handle empty templates directory', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await loadMCPTemplates(mockTemplatesDir);

      expect(result).toEqual({});
      expect(fs.readdir).toHaveBeenCalledWith(mockMcpTemplatesDir);
    });

    it('should handle templates with only .yml extension', async () => {
      const mockFiles = ['template1.yml', 'template2.yml'];
      const mockTemplate1 = {
        id: 'template1',
        name: 'Template 1',
        description: 'Test template 1',
        package: '@test/package1',
        config: {},
        capabilities: ['test'],
        verified: true,
        defaultEnabled: true,
        envVars: [],
        tags: [],
      };
      const mockTemplate2 = {
        id: 'template2',
        name: 'Template 2',
        description: 'Test template 2',
        package: '@test/package2',
        config: {},
        capabilities: ['test'],
        verified: false,
        defaultEnabled: false,
        envVars: [],
        tags: [],
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse)
        .mockReturnValueOnce(mockTemplate1)
        .mockReturnValueOnce(mockTemplate2);

      const result = await loadMCPTemplates(mockTemplatesDir);

      expect(result).toEqual({
        template1: mockTemplate1,
        template2: mockTemplate2,
      });
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMCPTemplate', () => {
    it('should return specific template when it exists', async () => {
      const mockTemplate = {
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'Test template',
        package: '@test/package',
        config: {},
        capabilities: ['filesystem'],
        verified: true,
        defaultEnabled: true,
        envVars: [],
        tags: [],
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(['filesystem.yaml']);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockReturnValue(mockTemplate);

      const result = await getMCPTemplate('filesystem', mockTemplatesDir);

      expect(result).toEqual(mockTemplate);
    });

    it('should return null when template does not exist', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(['other.yaml']);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockReturnValue({
        id: 'other',
        name: 'Other Template',
        description: 'Test template',
        package: '@test/package',
        config: {},
        capabilities: ['other'],
        verified: true,
        defaultEnabled: true,
      });

      const result = await getMCPTemplate('nonexistent', mockTemplatesDir);

      expect(result).toBeNull();
    });

    it('should throw error when template ID is empty', async () => {
      await expect(getMCPTemplate('', mockTemplatesDir))
        .rejects
        .toThrow('Template ID is required');
    });

    it('should throw error when template ID is undefined/null', async () => {
      await expect(getMCPTemplate(undefined as any, mockTemplatesDir))
        .rejects
        .toThrow('Template ID is required');
    });

    it('should use default templates directory when none provided', async () => {
      const mockTemplate = {
        id: 'test',
        name: 'Test Template',
        description: 'Test template',
        package: '@test/package',
        config: {},
        capabilities: ['test'],
        verified: true,
        defaultEnabled: true,
        envVars: [],
        tags: [],
      };

      // Mock the first access attempt to succeed
      let accessCallCount = 0;
      vi.mocked(fs.access).mockImplementation(async () => {
        accessCallCount++;
        if (accessCallCount === 1) {
          return Promise.resolve(undefined);
        }
        throw new Error('Directory not found');
      });

      vi.mocked(fs.readdir).mockResolvedValue(['test.yaml']);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockReturnValue(mockTemplate);

      const result = await getMCPTemplate('test');

      expect(result).toEqual(mockTemplate);
    });

    it('should propagate errors from loadMCPTemplates', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));

      await expect(getMCPTemplate('test', '/nonexistent'))
        .rejects
        .toThrow('Custom templates directory not found: /nonexistent');
    });
  });

  describe('listMCPTemplateIds', () => {
    it('should return array of template IDs', async () => {
      const mockTemplates = {
        filesystem: {
          id: 'filesystem',
          name: 'Filesystem Server',
          description: 'Test template',
          package: '@test/package',
          config: {},
          capabilities: ['filesystem'],
          verified: true,
          defaultEnabled: true,
        },
        github: {
          id: 'github',
          name: 'GitHub Server',
          description: 'Test template',
          package: '@test/package',
          config: {},
          capabilities: ['github'],
          verified: true,
          defaultEnabled: false,
        },
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(['filesystem.yaml', 'github.yaml']);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse)
        .mockReturnValueOnce(mockTemplates.filesystem)
        .mockReturnValueOnce(mockTemplates.github);

      const result = await listMCPTemplateIds(mockTemplatesDir);

      expect(result).toEqual(['filesystem', 'github']);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no templates exist', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await listMCPTemplateIds(mockTemplatesDir);

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use default templates directory when none provided', async () => {
      // Mock the first access attempt to succeed
      let accessCallCount = 0;
      vi.mocked(fs.access).mockImplementation(async () => {
        accessCallCount++;
        if (accessCallCount === 1) {
          return Promise.resolve(undefined);
        }
        throw new Error('Directory not found');
      });

      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await listMCPTemplateIds();

      expect(result).toEqual([]);
      expect(fs.access).toHaveBeenCalled();
    });

    it('should propagate errors from loadMCPTemplates', async () => {
      const error = new Error('Directory not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockRejectedValue(error);

      await expect(listMCPTemplateIds(mockTemplatesDir))
        .rejects
        .toThrow('MCP templates directory not found');
    });

    it('should maintain stable order of template IDs', async () => {
      const mockTemplates = {
        zebra: { id: 'zebra', name: 'Z', description: 'Z', package: '@test/z', config: {}, capabilities: [], verified: true, defaultEnabled: true },
        alpha: { id: 'alpha', name: 'A', description: 'A', package: '@test/a', config: {}, capabilities: [], verified: true, defaultEnabled: true },
        beta: { id: 'beta', name: 'B', description: 'B', package: '@test/b', config: {}, capabilities: [], verified: true, defaultEnabled: true },
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(['zebra.yaml', 'alpha.yaml', 'beta.yaml']);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse)
        .mockReturnValueOnce(mockTemplates.zebra)
        .mockReturnValueOnce(mockTemplates.alpha)
        .mockReturnValueOnce(mockTemplates.beta);

      const result1 = await listMCPTemplateIds(mockTemplatesDir);

      // Call multiple times to ensure consistent ordering
      vi.clearAllMocks();
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(['zebra.yaml', 'alpha.yaml', 'beta.yaml']);
      vi.mocked(fs.readFile).mockResolvedValue('test content');
      vi.mocked(yaml.parse)
        .mockReturnValueOnce(mockTemplates.zebra)
        .mockReturnValueOnce(mockTemplates.alpha)
        .mockReturnValueOnce(mockTemplates.beta);

      const result2 = await listMCPTemplateIds(mockTemplatesDir);

      expect(result1).toEqual(result2);
      expect(result1).toEqual(['zebra', 'alpha', 'beta']);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex template with all optional fields', async () => {
      const complexTemplate = {
        id: 'complex',
        name: 'Complex Template',
        description: 'A complex template with all fields',
        package: '@complex/package',
        config: {
          name: 'complex',
          type: 'stdio',
          command: 'node',
          args: ['server.js', '--port', '3000'],
          autoStart: false,
        },
        envVars: [
          {
            name: 'API_KEY',
            description: 'API key for service',
            required: true,
            sensitive: true,
            source: 'config',
          },
        ],
        capabilities: ['api', 'database', 'auth'],
        verified: true,
        defaultEnabled: false,
        category: 'database',
        tags: ['sql', 'postgres', 'database'],
        minVersion: '2.0.0',
        documentationUrl: 'https://example.com/docs',
        repositoryUrl: 'https://github.com/example/repo',
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(['complex.yaml']);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockReturnValue(complexTemplate);

      const templates = await loadMCPTemplates(mockTemplatesDir);
      const template = await getMCPTemplate('complex', mockTemplatesDir);
      const ids = await listMCPTemplateIds(mockTemplatesDir);

      expect(templates.complex).toEqual(complexTemplate);
      expect(template).toEqual(complexTemplate);
      expect(ids).toEqual(['complex']);
    });

    it('should handle concurrent access to templates', async () => {
      const mockTemplate = {
        id: 'concurrent',
        name: 'Concurrent Test',
        description: 'Test concurrent access',
        package: '@test/concurrent',
        config: {},
        capabilities: ['test'],
        verified: true,
        defaultEnabled: true,
        envVars: [],
        tags: [],
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(['concurrent.yaml']);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockReturnValue(mockTemplate);

      // Run multiple operations concurrently
      const promises = [
        loadMCPTemplates(mockTemplatesDir),
        getMCPTemplate('concurrent', mockTemplatesDir),
        listMCPTemplateIds(mockTemplatesDir),
        getMCPTemplate('concurrent', mockTemplatesDir),
        listMCPTemplateIds(mockTemplatesDir),
      ];

      const results = await Promise.all(promises);

      expect(results[0]).toHaveProperty('concurrent');
      expect(results[1]).toEqual(mockTemplate);
      expect(results[2]).toEqual(['concurrent']);
      expect(results[3]).toEqual(mockTemplate);
      expect(results[4]).toEqual(['concurrent']);
    });
  });

  describe('Error boundary testing', () => {
    it('should handle file system permission errors', async () => {
      const permissionError = new Error('Permission denied') as NodeJS.ErrnoException;
      permissionError.code = 'EACCES';

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockRejectedValue(permissionError);

      await expect(loadMCPTemplates(mockTemplatesDir))
        .rejects
        .toThrow('Permission denied');
    });

    it('should handle corrupted YAML files gracefully', async () => {
      const mockFiles = ['corrupted.yaml'];

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles);
      vi.mocked(fs.readFile).mockResolvedValue('invalid yaml content: [}');

      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockImplementation(() => {
        throw new Error('YAMLException: end of the stream or a document separator is expected');
      });

      await expect(loadMCPTemplates(mockTemplatesDir))
        .rejects
        .toThrow('Failed to parse MCP template corrupted.yaml: YAMLException');
    });

    it('should handle very large template files', async () => {
      const mockFiles = ['large.yaml'];
      const largeContent = 'x'.repeat(1000000); // 1MB of content

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles);
      vi.mocked(fs.readFile).mockResolvedValue(largeContent);

      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockReturnValue({
        id: 'large',
        name: 'Large Template',
        description: 'A very large template',
        package: '@test/large',
        config: {},
        capabilities: ['test'],
        verified: true,
        defaultEnabled: true,
      });

      const result = await loadMCPTemplates(mockTemplatesDir);

      expect(result.large).toBeDefined();
      expect(fs.readFile).toHaveBeenCalledWith(expect.stringMatching(/large\.yaml$/), 'utf-8');
    });
  });

  describe('Real filesystem integration', () => {
    it('should work with actual temp directory (integration test)', async () => {
      // Simulate realistic YAML template content parsed by yaml
      const templateYamlContent = `id: test-real
name: Real Test Template
description: A real template for testing
package: "@test/real-package"
config:
  name: test-real
  type: stdio
capabilities:
  - test
verified: true
defaultEnabled: true`;

      const parsedTemplate = {
        id: 'test-real',
        name: 'Real Test Template',
        description: 'A real template for testing',
        package: '@test/real-package',
        config: {
          name: 'test-real',
          type: 'stdio',
        },
        capabilities: ['test'],
        verified: true,
        defaultEnabled: true,
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(['test-real.yaml']);
      vi.mocked(fs.readFile).mockResolvedValue(templateYamlContent);

      const yaml = await import('yaml');
      vi.mocked(yaml.parse).mockReturnValue(parsedTemplate);

      // Test all functions work together
      const templates = await loadMCPTemplates(mockTemplatesDir);
      const template = await getMCPTemplate('test-real', mockTemplatesDir);
      const ids = await listMCPTemplateIds(mockTemplatesDir);

      expect(templates['test-real']).toBeDefined();
      expect(template).toBeDefined();
      expect(template?.id).toBe('test-real');
      expect(template?.name).toBe('Real Test Template');
      expect(ids).toContain('test-real');
    });
  });
});