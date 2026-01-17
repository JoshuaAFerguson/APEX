import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import * as YAML from 'yaml';
import { MCPTemplateSchema, MCPTemplate } from '../types.js';

/**
 * Integration test suite for MCP template loading functionality
 *
 * Tests the complete pipeline of loading MCP templates from YAML files:
 * - Directory scanning and file discovery
 * - YAML parsing and error handling
 * - Schema validation and type safety
 * - Template metadata processing
 * - Error scenarios and edge cases
 */
describe('MCP Template Loading Integration', () => {
  const templatesDir = join(process.cwd(), 'packages/core/templates/mcp');

  describe('Template discovery and loading', () => {
    it('should successfully discover all YAML template files', () => {
      const files = readdirSync(templatesDir);
      const yamlFiles = files.filter(file => extname(file) === '.yaml' || extname(file) === '.yml');

      expect(yamlFiles.length).toBeGreaterThan(0);
      expect(yamlFiles).toContain('filesystem.yaml');
      expect(yamlFiles).toContain('fetch.yaml');
      expect(yamlFiles).toContain('memory.yaml');
      expect(yamlFiles).toContain('github.yaml');
      expect(yamlFiles).toContain('postgres.yaml');
      expect(yamlFiles).toContain('brave-search.yaml');
    });

    it('should load and validate all templates without errors', () => {
      const files = readdirSync(templatesDir);
      const yamlFiles = files.filter(file => extname(file) === '.yaml' || extname(file) === '.yml');
      const loadedTemplates: MCPTemplate[] = [];

      yamlFiles.forEach(file => {
        const filePath = join(templatesDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const parsed = YAML.parse(content);
        const validated = MCPTemplateSchema.parse(parsed);
        loadedTemplates.push(validated);
      });

      expect(loadedTemplates.length).toBe(yamlFiles.length);
      expect(loadedTemplates.length).toBeGreaterThanOrEqual(6);
    });

    it('should handle template loading with proper error context', () => {
      const files = readdirSync(templatesDir);
      const yamlFiles = files.filter(file => extname(file) === '.yaml');

      yamlFiles.forEach(file => {
        const filePath = join(templatesDir, file);

        try {
          const content = readFileSync(filePath, 'utf-8');
          const parsed = YAML.parse(content);
          const validated = MCPTemplateSchema.parse(parsed);

          // If we get here, the template is valid
          expect(validated).toBeDefined();
          expect(validated.id).toBeTruthy();
          expect(validated.name).toBeTruthy();
        } catch (error) {
          // If there's an error, it should be informative
          fail(`Failed to load template ${file}: ${error}`);
        }
      });
    });
  });

  describe('Template registry simulation', () => {
    let templateRegistry: Map<string, MCPTemplate>;

    beforeAll(() => {
      templateRegistry = new Map();
      const files = readdirSync(templatesDir);
      const yamlFiles = files.filter(file => extname(file) === '.yaml');

      yamlFiles.forEach(file => {
        const filePath = join(templatesDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const parsed = YAML.parse(content);
        const template = MCPTemplateSchema.parse(parsed);
        templateRegistry.set(template.id, template);
      });
    });

    it('should create a functional template registry', () => {
      expect(templateRegistry.size).toBeGreaterThanOrEqual(6);
      expect(templateRegistry.has('filesystem')).toBe(true);
      expect(templateRegistry.has('github')).toBe(true);
      expect(templateRegistry.has('postgres')).toBe(true);
      expect(templateRegistry.has('memory')).toBe(true);
      expect(templateRegistry.has('fetch')).toBe(true);
      expect(templateRegistry.has('brave-search')).toBe(true);
    });

    it('should support template lookups by id', () => {
      const filesystemTemplate = templateRegistry.get('filesystem');
      expect(filesystemTemplate).toBeDefined();
      expect(filesystemTemplate?.name).toBe('Filesystem Server');
      expect(filesystemTemplate?.package).toBe('@modelcontextprotocol/server-filesystem');
    });

    it('should support filtering templates by category', () => {
      const templates = Array.from(templateRegistry.values());

      const filesystemTemplates = templates.filter(t => t.category === 'filesystem');
      const apiTemplates = templates.filter(t => t.category === 'api');
      const databaseTemplates = templates.filter(t => t.category === 'database');

      expect(filesystemTemplates.length).toBeGreaterThan(0);
      expect(apiTemplates.length).toBeGreaterThan(0);
      expect(databaseTemplates.length).toBeGreaterThan(0);
    });

    it('should support filtering templates by capabilities', () => {
      const templates = Array.from(templateRegistry.values());

      const webCapableTemplates = templates.filter(t =>
        t.capabilities?.includes('web')
      );
      const dbCapableTemplates = templates.filter(t =>
        t.capabilities?.includes('database')
      );
      const fsCapableTemplates = templates.filter(t =>
        t.capabilities?.includes('filesystem')
      );

      expect(webCapableTemplates.length).toBeGreaterThan(0);
      expect(dbCapableTemplates.length).toBeGreaterThan(0);
      expect(fsCapableTemplates.length).toBeGreaterThan(0);
    });

    it('should support searching templates by tags', () => {
      const templates = Array.from(templateRegistry.values());

      const gitTemplates = templates.filter(t =>
        t.tags?.includes('git') || t.tags?.includes('github')
      );
      const sqlTemplates = templates.filter(t =>
        t.tags?.includes('sql') || t.tags?.includes('database')
      );

      expect(gitTemplates.length).toBeGreaterThan(0);
      expect(sqlTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('Template configuration generation', () => {
    it('should generate valid MCP server configs from templates', () => {
      const files = readdirSync(templatesDir);
      const yamlFiles = files.filter(file => extname(file) === '.yaml');

      yamlFiles.forEach(file => {
        const filePath = join(templatesDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const template = MCPTemplateSchema.parse(YAML.parse(content));

        // Simulate generating a server config from the template
        const serverConfig = {
          name: template.config.name || template.id,
          type: template.config.type || 'stdio',
          command: template.config.command,
          args: template.config.args || [],
          env: {},
          autoStart: template.config.autoStart ?? false
        };

        expect(serverConfig.name).toBeTruthy();
        expect(['stdio', 'sse', 'websocket'].includes(serverConfig.type || 'stdio')).toBe(true);
        if (serverConfig.command) {
          expect(typeof serverConfig.command).toBe('string');
          expect(serverConfig.command.length).toBeGreaterThan(0);
        }
        expect(Array.isArray(serverConfig.args)).toBe(true);
        expect(typeof serverConfig.autoStart).toBe('boolean');
      });
    });

    it('should handle environment variable configuration', () => {
      const filesystemPath = join(templatesDir, 'filesystem.yaml');
      const githubPath = join(templatesDir, 'github.yaml');

      const filesystemTemplate = MCPTemplateSchema.parse(
        YAML.parse(readFileSync(filesystemPath, 'utf-8'))
      );
      const githubTemplate = MCPTemplateSchema.parse(
        YAML.parse(readFileSync(githubPath, 'utf-8'))
      );

      // Test filesystem template env vars
      const fsEnvVars = filesystemTemplate.envVars || [];
      const allowedPathsVar = fsEnvVars.find(v => v.name === 'ALLOWED_PATHS');
      expect(allowedPathsVar).toBeDefined();
      expect(allowedPathsVar?.defaultValue).toBeDefined();

      // Test github template env vars
      const githubEnvVars = githubTemplate.envVars || [];
      const tokenVar = githubEnvVars.find(v => v.name === 'GITHUB_PERSONAL_ACCESS_TOKEN');
      expect(tokenVar).toBeDefined();
      expect(tokenVar?.required).toBe(true);
      expect(tokenVar?.sensitive).toBe(true);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed YAML gracefully', () => {
      const malformedYaml = `
id: test
name: "Test Template
description: Missing closing quote
package: test-package
config: {}
`;

      expect(() => {
        YAML.parse(malformedYaml);
      }).toThrow();
    });

    it('should handle invalid template schema gracefully', () => {
      const invalidTemplate = {
        // Missing required fields
        id: 'test',
        // name: missing
        // description: missing
        // package: missing
        config: {}
      };

      expect(() => {
        MCPTemplateSchema.parse(invalidTemplate);
      }).toThrow();
    });

    it('should handle empty template files', () => {
      const emptyContent = '';

      expect(() => {
        const parsed = YAML.parse(emptyContent);
        MCPTemplateSchema.parse(parsed);
      }).toThrow();
    });

    it('should validate environment variable schemas', () => {
      const templateWithInvalidEnvVar = {
        id: 'test',
        name: 'Test',
        description: 'Test template',
        package: 'test-package',
        config: {},
        envVars: [
          {
            // Missing required fields
            name: 'TEST_VAR'
            // description: missing
            // required: missing
            // sensitive: missing
          }
        ]
      };

      expect(() => {
        MCPTemplateSchema.parse(templateWithInvalidEnvVar);
      }).toThrow();
    });
  });

  describe('Performance and scalability', () => {
    it('should load templates efficiently', () => {
      const startTime = Date.now();

      const files = readdirSync(templatesDir);
      const yamlFiles = files.filter(file => extname(file) === '.yaml');
      const templates: MCPTemplate[] = [];

      yamlFiles.forEach(file => {
        const filePath = join(templatesDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const parsed = YAML.parse(content);
        const template = MCPTemplateSchema.parse(parsed);
        templates.push(template);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(templates.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should load in under 1 second
    });

    it('should handle batch template processing', () => {
      const files = readdirSync(templatesDir);
      const yamlFiles = files.filter(file => extname(file) === '.yaml');

      // Simulate processing multiple templates in batch
      const results = yamlFiles.map(file => {
        try {
          const filePath = join(templatesDir, file);
          const content = readFileSync(filePath, 'utf-8');
          const parsed = YAML.parse(content);
          const template = MCPTemplateSchema.parse(parsed);
          return { file, template, error: null };
        } catch (error) {
          return { file, template: null, error: error as Error };
        }
      });

      const successful = results.filter(r => r.template !== null);
      const failed = results.filter(r => r.error !== null);

      expect(successful.length).toBe(yamlFiles.length);
      expect(failed.length).toBe(0);

      // Verify all successful templates have unique IDs
      const ids = successful.map(r => r.template!.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(successful.length);
    });
  });
});