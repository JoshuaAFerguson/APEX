/**
 * Templates Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { BUILTIN_TEMPLATES } from './templates.js';

describe('BUILTIN_TEMPLATES', () => {
  it('should have at least one template', () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('should include common MCP servers', () => {
    const templateIds = BUILTIN_TEMPLATES.map(t => t.id);
    expect(templateIds).toContain('filesystem');
    expect(templateIds).toContain('git');
    expect(templateIds).toContain('github');
  });

  describe('Template Structure', () => {
    BUILTIN_TEMPLATES.forEach((template) => {
      describe(`Template: ${template.id}`, () => {
        it('should have required fields', () => {
          expect(template.id).toBeDefined();
          expect(typeof template.id).toBe('string');
          expect(template.name).toBeDefined();
          expect(typeof template.name).toBe('string');
          expect(template.description).toBeDefined();
          expect(typeof template.description).toBe('string');
          expect(template.package).toBeDefined();
          expect(typeof template.package).toBe('string');
          expect(template.config).toBeDefined();
          expect(typeof template.config).toBe('object');
          expect(template.capabilities).toBeDefined();
          expect(Array.isArray(template.capabilities)).toBe(true);
          expect(typeof template.verified).toBe('boolean');
        });

        it('should have valid config structure', () => {
          expect(template.config.name).toBeDefined();
          expect(typeof template.config.name).toBe('string');
          expect(template.config.type).toBeDefined();
          expect(['stdio', 'http', 'sse', 'sdk'].includes(template.config.type || 'stdio')).toBe(true);
        });

        it('should have stdio type with command for most templates', () => {
          if (template.config.type === 'stdio' || !template.config.type) {
            expect(template.config.command).toBeDefined();
            expect(typeof template.config.command).toBe('string');
          }
        });

        it('should have valid environment variables structure', () => {
          expect(Array.isArray(template.envVars)).toBe(true);

          template.envVars.forEach((envVar, index) => {
            expect(envVar.name).toBeDefined();
            expect(typeof envVar.name).toBe('string');
            expect(typeof envVar.required).toBe('boolean');
            expect(typeof envVar.sensitive).toBe('boolean');

            if (envVar.pattern) {
              expect(() => new RegExp(envVar.pattern)).not.toThrow();
            }
          });
        });

        it('should have capabilities array with valid strings', () => {
          expect(template.capabilities.length).toBeGreaterThan(0);
          template.capabilities.forEach(capability => {
            expect(typeof capability).toBe('string');
            expect(capability.trim()).toBe(capability);
            expect(capability.length).toBeGreaterThan(0);
          });
        });
      });
    });
  });

  describe('Template Categories', () => {
    it('should have filesystem templates', () => {
      const filesystemTemplates = BUILTIN_TEMPLATES.filter(t =>
        t.capabilities.includes('filesystem')
      );
      expect(filesystemTemplates.length).toBeGreaterThan(0);
    });

    it('should have git templates', () => {
      const gitTemplates = BUILTIN_TEMPLATES.filter(t =>
        t.capabilities.includes('git')
      );
      expect(gitTemplates.length).toBeGreaterThan(0);
    });

    it('should have verified templates', () => {
      const verifiedTemplates = BUILTIN_TEMPLATES.filter(t => t.verified);
      expect(verifiedTemplates.length).toBeGreaterThan(0);
    });

    it('should have some default enabled templates', () => {
      const defaultEnabledTemplates = BUILTIN_TEMPLATES.filter(t => t.defaultEnabled);
      expect(defaultEnabledTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('Template Validation', () => {
    it('should have unique template IDs', () => {
      const ids = BUILTIN_TEMPLATES.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique template names', () => {
      const names = BUILTIN_TEMPLATES.map(t => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should use valid NPM package names', () => {
      BUILTIN_TEMPLATES.forEach(template => {
        // Basic NPM package name validation
        expect(template.package).toMatch(/^[@a-z0-9][@a-z0-9\-_\/]*$/);
      });
    });

    it('should have valid placeholder usage in args', () => {
      BUILTIN_TEMPLATES.forEach(template => {
        if (template.config.args) {
          template.config.args.forEach(arg => {
            // Check for valid placeholder format
            const placeholders = arg.match(/\{\{[^}]+\}\}/g);
            if (placeholders) {
              placeholders.forEach(placeholder => {
                expect(['{{PROJECT_PATH}}'].includes(placeholder)).toBe(true);
              });
            }
          });
        }
      });
    });
  });

  describe('Specific Templates', () => {
    it('filesystem template should have correct configuration', () => {
      const fsTemplate = BUILTIN_TEMPLATES.find(t => t.id === 'filesystem');
      expect(fsTemplate).toBeDefined();
      expect(fsTemplate?.package).toBe('@modelcontextprotocol/server-filesystem');
      expect(fsTemplate?.config.type).toBe('stdio');
      expect(fsTemplate?.config.command).toBe('npx');
      expect(fsTemplate?.verified).toBe(true);
      expect(fsTemplate?.capabilities).toContain('filesystem');
    });

    it('git template should have correct configuration', () => {
      const gitTemplate = BUILTIN_TEMPLATES.find(t => t.id === 'git');
      expect(gitTemplate).toBeDefined();
      expect(gitTemplate?.package).toBe('@modelcontextprotocol/server-git');
      expect(gitTemplate?.config.type).toBe('stdio');
      expect(gitTemplate?.capabilities).toContain('git');
      expect(gitTemplate?.capabilities).toContain('vcs');
    });

    it('github template should require authentication', () => {
      const githubTemplate = BUILTIN_TEMPLATES.find(t => t.id === 'github');
      expect(githubTemplate).toBeDefined();
      expect(githubTemplate?.envVars.length).toBeGreaterThan(0);

      const authVar = githubTemplate?.envVars.find(v => v.required && v.sensitive);
      expect(authVar).toBeDefined();
      expect(authVar?.pattern).toBeDefined();
    });
  });
});