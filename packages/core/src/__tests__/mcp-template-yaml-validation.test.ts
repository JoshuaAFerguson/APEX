import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as YAML from 'yaml';
import { MCPTemplateSchema, MCPTemplate } from '../types.js';

/**
 * Comprehensive test suite for validating MCP template YAML files
 *
 * This test suite validates that all MCP server template YAML files in the templates/mcp directory:
 * - Are valid YAML syntax
 * - Conform to the MCPTemplate schema
 * - Have all required fields
 * - Have properly structured environment variables
 * - Have valid configuration objects
 * - Follow naming conventions
 */
describe('MCP Template YAML File Validation', () => {
  // Template directory path relative to the test file location
  const templatesDir = join(process.cwd(), 'packages/core/templates/mcp');

  // Expected template files
  const expectedTemplates = [
    'filesystem.yaml',
    'fetch.yaml',
    'memory.yaml',
    'github.yaml',
    'postgres.yaml',
    'brave-search.yaml'
  ];

  describe('Template file structure validation', () => {
    expectedTemplates.forEach(templateFile => {
      describe(`${templateFile}`, () => {
        let yamlContent: string;
        let parsedTemplate: any;
        let validatedTemplate: MCPTemplate;

        it('should exist and be readable', () => {
          const filePath = join(templatesDir, templateFile);
          expect(() => {
            yamlContent = readFileSync(filePath, 'utf-8');
          }).not.toThrow();
          expect(yamlContent).toBeDefined();
          expect(yamlContent.length).toBeGreaterThan(0);
        });

        it('should have valid YAML syntax', () => {
          expect(() => {
            parsedTemplate = YAML.parse(yamlContent);
          }).not.toThrow();
          expect(parsedTemplate).toBeDefined();
          expect(typeof parsedTemplate).toBe('object');
          expect(parsedTemplate).not.toBeNull();
        });

        it('should conform to MCPTemplate schema', () => {
          expect(() => {
            validatedTemplate = MCPTemplateSchema.parse(parsedTemplate);
          }).not.toThrow();
          expect(validatedTemplate).toBeDefined();
        });

        it('should have required core fields', () => {
          expect(validatedTemplate.id).toBeDefined();
          expect(validatedTemplate.id).toBeTruthy();
          expect(typeof validatedTemplate.id).toBe('string');
          expect(validatedTemplate.id.length).toBeGreaterThan(0);

          expect(validatedTemplate.name).toBeDefined();
          expect(validatedTemplate.name).toBeTruthy();
          expect(typeof validatedTemplate.name).toBe('string');
          expect(validatedTemplate.name.length).toBeGreaterThan(0);

          expect(validatedTemplate.description).toBeDefined();
          expect(validatedTemplate.description).toBeTruthy();
          expect(typeof validatedTemplate.description).toBe('string');
          expect(validatedTemplate.description.length).toBeGreaterThan(0);

          expect(validatedTemplate.package).toBeDefined();
          expect(validatedTemplate.package).toBeTruthy();
          expect(typeof validatedTemplate.package).toBe('string');
          expect(validatedTemplate.package.length).toBeGreaterThan(0);
        });

        it('should have valid config object', () => {
          expect(validatedTemplate.config).toBeDefined();
          expect(typeof validatedTemplate.config).toBe('object');
          expect(validatedTemplate.config).not.toBeNull();

          // Config should at least have a name that matches the template id
          if (validatedTemplate.config.name) {
            expect(validatedTemplate.config.name).toBe(validatedTemplate.id);
          }
        });

        it('should have properly structured envVars if present', () => {
          if (validatedTemplate.envVars && validatedTemplate.envVars.length > 0) {
            validatedTemplate.envVars.forEach((envVar, index) => {
              expect(envVar.name, `envVar[${index}].name`).toBeDefined();
              expect(envVar.name, `envVar[${index}].name`).toBeTruthy();
              expect(typeof envVar.name, `envVar[${index}].name type`).toBe('string');

              expect(envVar.description, `envVar[${index}].description`).toBeDefined();
              expect(envVar.description, `envVar[${index}].description`).toBeTruthy();
              expect(typeof envVar.description, `envVar[${index}].description type`).toBe('string');

              expect(typeof envVar.required, `envVar[${index}].required type`).toBe('boolean');
              expect(typeof envVar.sensitive, `envVar[${index}].sensitive type`).toBe('boolean');

              if (envVar.source) {
                expect(['config', 'env', 'user']).toContain(envVar.source);
              }

              if (envVar.defaultValue) {
                expect(typeof envVar.defaultValue).toBe('string');
              }
            });
          }
        });

        it('should have valid capabilities array', () => {
          expect(Array.isArray(validatedTemplate.capabilities)).toBe(true);
          if (validatedTemplate.capabilities.length > 0) {
            validatedTemplate.capabilities.forEach((capability, index) => {
              expect(typeof capability, `capability[${index}] type`).toBe('string');
              expect(capability, `capability[${index}] value`).toBeTruthy();
            });
          }
        });

        it('should have valid metadata fields', () => {
          if (validatedTemplate.verified !== undefined) {
            expect(typeof validatedTemplate.verified).toBe('boolean');
          }

          if (validatedTemplate.defaultEnabled !== undefined) {
            expect(typeof validatedTemplate.defaultEnabled).toBe('boolean');
          }

          if (validatedTemplate.category) {
            expect(typeof validatedTemplate.category).toBe('string');
            expect(validatedTemplate.category).toBeTruthy();
          }

          if (validatedTemplate.tags) {
            expect(Array.isArray(validatedTemplate.tags)).toBe(true);
            validatedTemplate.tags.forEach((tag, index) => {
              expect(typeof tag, `tag[${index}] type`).toBe('string');
              expect(tag, `tag[${index}] value`).toBeTruthy();
            });
          }

          if (validatedTemplate.minVersion) {
            expect(typeof validatedTemplate.minVersion).toBe('string');
            expect(validatedTemplate.minVersion).toBeTruthy();
            // Should look like a semver version
            expect(validatedTemplate.minVersion).toMatch(/^\d+\.\d+\.\d+/);
          }

          if (validatedTemplate.documentationUrl) {
            expect(typeof validatedTemplate.documentationUrl).toBe('string');
            expect(validatedTemplate.documentationUrl).toBeTruthy();
            // Should be a valid URL format
            expect(validatedTemplate.documentationUrl).toMatch(/^https?:\/\/.+/);
          }

          if (validatedTemplate.repositoryUrl) {
            expect(typeof validatedTemplate.repositoryUrl).toBe('string');
            expect(validatedTemplate.repositoryUrl).toBeTruthy();
            // Should be a valid URL format
            expect(validatedTemplate.repositoryUrl).toMatch(/^https?:\/\/.+/);
          }
        });

        it('should have consistent naming between id and filename', () => {
          const expectedId = templateFile.replace('.yaml', '');
          expect(validatedTemplate.id).toBe(expectedId);
        });
      });
    });
  });

  describe('Cross-template validation', () => {
    let allTemplates: MCPTemplate[] = [];

    beforeAll(() => {
      // Load all templates for cross-validation
      allTemplates = expectedTemplates.map(templateFile => {
        const filePath = join(templatesDir, templateFile);
        const yamlContent = readFileSync(filePath, 'utf-8');
        const parsedTemplate = YAML.parse(yamlContent);
        return MCPTemplateSchema.parse(parsedTemplate);
      });
    });

    it('should have unique template IDs across all templates', () => {
      const ids = allTemplates.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(allTemplates.length);
    });

    it('should have unique template names across all templates', () => {
      const names = allTemplates.map(t => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(allTemplates.length);
    });

    it('should have unique package names across all templates', () => {
      const packages = allTemplates.map(t => t.package);
      const uniquePackages = new Set(packages);
      expect(uniquePackages.size).toBe(allTemplates.length);
    });

    it('should have at least one verified template', () => {
      const verifiedTemplates = allTemplates.filter(t => t.verified === true);
      expect(verifiedTemplates.length).toBeGreaterThan(0);
    });

    it('should have diverse categories represented', () => {
      const categories = new Set(
        allTemplates
          .map(t => t.category)
          .filter(category => category !== undefined)
      );
      expect(categories.size).toBeGreaterThan(1);
    });

    it('should have templates with different capability sets', () => {
      const capabilitySets = allTemplates.map(t =>
        (t.capabilities || []).sort().join(',')
      );
      const uniqueCapabilitySets = new Set(capabilitySets);
      expect(uniqueCapabilitySets.size).toBeGreaterThan(1);
    });
  });

  describe('Template-specific validations', () => {
    it('filesystem template should have appropriate capabilities', () => {
      const filePath = join(templatesDir, 'filesystem.yaml');
      const yamlContent = readFileSync(filePath, 'utf-8');
      const template = MCPTemplateSchema.parse(YAML.parse(yamlContent));

      expect(template.capabilities).toContain('filesystem');
      expect(template.category).toBe('filesystem');
      expect(template.verified).toBe(true);
    });

    it('github template should require authentication', () => {
      const filePath = join(templatesDir, 'github.yaml');
      const yamlContent = readFileSync(filePath, 'utf-8');
      const template = MCPTemplateSchema.parse(YAML.parse(yamlContent));

      expect(template.capabilities).toContain('github');
      expect(template.category).toBe('api');

      // Should have auth-related environment variables
      const authEnvVar = template.envVars?.find(v =>
        v.name.toLowerCase().includes('token') || v.name.toLowerCase().includes('auth')
      );
      expect(authEnvVar).toBeDefined();
      expect(authEnvVar?.required).toBe(true);
      expect(authEnvVar?.sensitive).toBe(true);
    });

    it('postgres template should have database capabilities', () => {
      const filePath = join(templatesDir, 'postgres.yaml');
      const yamlContent = readFileSync(filePath, 'utf-8');
      const template = MCPTemplateSchema.parse(YAML.parse(yamlContent));

      expect(template.capabilities).toContain('database');
      expect(template.capabilities).toContain('postgresql');
      expect(template.category).toBe('database');

      // Should have connection string environment variable
      const connEnvVar = template.envVars?.find(v =>
        v.name.toLowerCase().includes('connection')
      );
      expect(connEnvVar).toBeDefined();
      expect(connEnvVar?.required).toBe(true);
      expect(connEnvVar?.sensitive).toBe(true);
    });

    it('memory template should have storage capabilities', () => {
      const filePath = join(templatesDir, 'memory.yaml');
      const yamlContent = readFileSync(filePath, 'utf-8');
      const template = MCPTemplateSchema.parse(YAML.parse(yamlContent));

      expect(template.capabilities).toContain('memory');
      expect(template.capabilities).toContain('storage');
    });

    it('fetch template should have web capabilities', () => {
      const filePath = join(templatesDir, 'fetch.yaml');
      const yamlContent = readFileSync(filePath, 'utf-8');
      const template = MCPTemplateSchema.parse(YAML.parse(yamlContent));

      expect(template.capabilities).toContain('web');
      expect(template.capabilities).toContain('http');
    });

    it('brave-search template should have search capabilities', () => {
      const filePath = join(templatesDir, 'brave-search.yaml');
      const yamlContent = readFileSync(filePath, 'utf-8');
      const template = MCPTemplateSchema.parse(YAML.parse(yamlContent));

      expect(template.capabilities).toContain('search');
      expect(template.capabilities).toContain('web');
    });
  });
});