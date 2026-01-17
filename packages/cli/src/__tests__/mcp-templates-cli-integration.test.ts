/**
 * CLI integration tests for MCP templates loading
 * Tests the interaction between CLI command and core MCP template functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    blue: (str: string) => str,
  },
}));

describe('MCP Templates CLI Integration', () => {
  let tempDir: string;
  let templatesDir: string;
  let mcpTemplatesDir: string;

  beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = await import('fs/promises').then(fs =>
      fs.mkdtemp(join(tmpdir(), 'mcp-cli-integration-test-'))
    );
    templatesDir = join(tempDir, 'templates');
    mcpTemplatesDir = join(templatesDir, 'mcp');
    await mkdir(mcpTemplatesDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Core function integration', () => {
    it('should load templates using core loadMCPTemplates function', async () => {
      // Create test template
      await writeFile(
        join(mcpTemplatesDir, 'test.yaml'),
        `id: test
name: "Test Template"
description: "A test template for integration testing"
package: "@test/template"
config:
  name: test
  type: stdio
  command: npx
  args: ["-y", "@test/template"]
  autoStart: false
capabilities: ["test"]
verified: true
defaultEnabled: false`
      );

      // Import and test the actual loadMCPTemplates function
      const { loadMCPTemplates } = await import('@apexcli/core');

      const templates = await loadMCPTemplates(templatesDir);

      expect(templates).toHaveProperty('test');
      expect(templates.test.name).toBe('Test Template');
      expect(templates.test.description).toBe('A test template for integration testing');
      expect(templates.test.package).toBe('@test/template');
      expect(templates.test.verified).toBe(true);
      expect(templates.test.capabilities).toEqual(['test']);
    });

    it('should handle templates with environment variables', async () => {
      await writeFile(
        join(mcpTemplatesDir, 'env-test.yml'),
        `id: env-test
name: "Environment Test Template"
description: "Template with environment variables"
package: "@test/env-template"
config:
  name: env-test
  type: stdio
  command: node
  args: ["server.js"]
envVars:
  - name: API_KEY
    description: "API key for authentication"
    required: true
  - name: DEBUG_MODE
    description: "Enable debug logging"
    required: false
    default: "false"
capabilities: ["api", "auth"]
verified: false
defaultEnabled: false`
      );

      const { loadMCPTemplates } = await import('@apexcli/core');

      const templates = await loadMCPTemplates(templatesDir);

      expect(templates).toHaveProperty('env-test');
      expect(templates['env-test'].envVars).toHaveLength(2);
      expect(templates['env-test'].envVars?.[0].name).toBe('API_KEY');
      expect(templates['env-test'].envVars?.[0].required).toBe(true);
      expect(templates['env-test'].envVars?.[1].name).toBe('DEBUG_MODE');
      expect(templates['env-test'].envVars?.[1].required).toBe(false);
      expect(templates['env-test'].envVars?.[1].default).toBe('false');
    });

    it('should validate template schema correctly', async () => {
      // Create template with missing required fields
      await writeFile(
        join(mcpTemplatesDir, 'invalid.yaml'),
        `id: ""
name: ""
description: ""
package: ""`
      );

      const { loadMCPTemplates } = await import('@apexcli/core');

      await expect(loadMCPTemplates(templatesDir)).rejects.toThrow(
        expect.stringMatching(/Failed to parse MCP template.*invalid\.yaml/)
      );
    });

    it('should handle multiple template files', async () => {
      // Create multiple templates
      const templates = [
        {
          filename: 'first.yaml',
          content: `id: first
name: "First Template"
description: "First test template"
package: "@test/first"
config: {}
capabilities: ["first"]
verified: true
defaultEnabled: false`
        },
        {
          filename: 'second.yml',
          content: `id: second
name: "Second Template"
description: "Second test template"
package: "@test/second"
config: {}
capabilities: ["second"]
verified: false
defaultEnabled: true`
        },
        {
          filename: 'third.yaml',
          content: `id: third
name: "Third Template"
description: "Third test template"
package: "@test/third"
config: {}
capabilities: ["third"]
verified: true
defaultEnabled: false`
        },
      ];

      for (const template of templates) {
        await writeFile(join(mcpTemplatesDir, template.filename), template.content);
      }

      const { loadMCPTemplates } = await import('@apexcli/core');

      const loadedTemplates = await loadMCPTemplates(templatesDir);

      expect(Object.keys(loadedTemplates)).toHaveLength(3);
      expect(loadedTemplates).toHaveProperty('first');
      expect(loadedTemplates).toHaveProperty('second');
      expect(loadedTemplates).toHaveProperty('third');

      expect(loadedTemplates.first.verified).toBe(true);
      expect(loadedTemplates.second.verified).toBe(false);
      expect(loadedTemplates.second.defaultEnabled).toBe(true);
    });

    it('should handle complex template configurations', async () => {
      await writeFile(
        join(mcpTemplatesDir, 'complex.yaml'),
        `id: complex
name: "Complex Template"
description: "A template with complex configuration"
package: "@test/complex"
config:
  name: complex
  type: stdio
  command: docker
  args:
    - "run"
    - "--rm"
    - "-it"
    - "complex-server:latest"
  autoStart: true
  env:
    NODE_ENV: production
    LOG_LEVEL: info
    PORT: "3000"
envVars:
  - name: DATABASE_URL
    description: "Database connection string"
    required: true
  - name: REDIS_URL
    description: "Redis connection string"
    required: false
    default: "redis://localhost:6379"
  - name: JWT_SECRET
    description: "JWT signing secret"
    required: true
capabilities:
  - "database"
  - "cache"
  - "auth"
  - "api"
verified: true
defaultEnabled: false
category: "backend"
version: "2.1.0"
author: "Test Author <test@example.com>"
license: "MIT"
homepage: "https://complex.example.com"
documentationUrl: "https://docs.complex.example.com"
repositoryUrl: "https://github.com/test/complex"`
      );

      const { loadMCPTemplates } = await import('@apexcli/core');

      const templates = await loadMCPTemplates(templatesDir);

      expect(templates).toHaveProperty('complex');
      const complex = templates.complex;

      expect(complex.config?.command).toBe('docker');
      expect(complex.config?.args).toEqual(['run', '--rm', '-it', 'complex-server:latest']);
      expect(complex.config?.autoStart).toBe(true);
      expect(complex.config?.env).toEqual({
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        PORT: '3000',
      });

      expect(complex.envVars).toHaveLength(3);
      expect(complex.capabilities).toEqual(['database', 'cache', 'auth', 'api']);
      expect(complex.category).toBe('backend');
      expect(complex.version).toBe('2.1.0');
      expect(complex.author).toBe('Test Author <test@example.com>');
      expect(complex.license).toBe('MIT');
      expect(complex.homepage).toBe('https://complex.example.com');
      expect(complex.documentationUrl).toBe('https://docs.complex.example.com');
      expect(complex.repositoryUrl).toBe('https://github.com/test/complex');
    });

    it('should handle empty templates directory', async () => {
      const { loadMCPTemplates } = await import('@apexcli/core');

      const templates = await loadMCPTemplates(templatesDir);

      expect(templates).toEqual({});
    });

    it('should skip non-YAML files correctly', async () => {
      // Create mixed files
      await writeFile(
        join(mcpTemplatesDir, 'valid.yaml'),
        `id: valid
name: "Valid Template"
description: "A valid YAML template"
package: "@test/valid"
config: {}
capabilities: []
verified: true
defaultEnabled: false`
      );

      await writeFile(join(mcpTemplatesDir, 'readme.txt'), 'This is not YAML');
      await writeFile(join(mcpTemplatesDir, 'config.json'), '{"not": "yaml"}');
      await writeFile(join(mcpTemplatesDir, 'script.sh'), '#!/bin/bash\necho "not yaml"');

      const { loadMCPTemplates } = await import('@apexcli/core');

      const templates = await loadMCPTemplates(templatesDir);

      expect(Object.keys(templates)).toHaveLength(1);
      expect(templates).toHaveProperty('valid');
      expect(templates.valid.name).toBe('Valid Template');
    });
  });

  describe('Error handling integration', () => {
    it('should provide detailed error messages for schema validation failures', async () => {
      await writeFile(
        join(mcpTemplatesDir, 'schema-error.yaml'),
        `id: schema-error
name: 123
description: true
package: null`
      );

      const { loadMCPTemplates } = await import('@apexcli/core');

      await expect(loadMCPTemplates(templatesDir)).rejects.toThrow(
        expect.stringMatching(/Failed to parse MCP template.*schema-error\.yaml/)
      );
    });

    it('should handle YAML syntax errors gracefully', async () => {
      await writeFile(
        join(mcpTemplatesDir, 'syntax-error.yaml'),
        'invalid: yaml: content: [}'
      );

      const { loadMCPTemplates } = await import('@apexcli/core');

      await expect(loadMCPTemplates(templatesDir)).rejects.toThrow(
        expect.stringMatching(/Failed to parse MCP template.*syntax-error\.yaml/)
      );
    });

    it('should handle missing required fields', async () => {
      await writeFile(
        join(mcpTemplatesDir, 'missing-fields.yaml'),
        `id: missing
name: "Missing Fields"
# description is required but missing
package: "@test/missing"`
      );

      const { loadMCPTemplates } = await import('@apexcli/core');

      await expect(loadMCPTemplates(templatesDir)).rejects.toThrow(
        expect.stringMatching(/Failed to parse MCP template.*missing-fields\.yaml/)
      );
    });
  });

  describe('Performance integration', () => {
    it('should handle many templates efficiently', async () => {
      // Create many templates
      const templatePromises = Array(50).fill(0).map(async (_, i) => {
        const content = `id: perf-test-${i}
name: "Performance Test Template ${i}"
description: "Template ${i} for performance testing"
package: "@test/perf-${i}"
config:
  name: "perf-test-${i}"
  type: stdio
  command: npx
  args: ["-y", "@test/perf-${i}"]
capabilities: ["perf", "test-${i}"]
verified: ${i % 2 === 0}
defaultEnabled: ${i % 5 === 0}`;

        await writeFile(join(mcpTemplatesDir, `perf-test-${i}.yaml`), content);
      });

      await Promise.all(templatePromises);

      const { loadMCPTemplates } = await import('@apexcli/core');

      const start = performance.now();
      const templates = await loadMCPTemplates(templatesDir);
      const end = performance.now();

      expect(Object.keys(templates)).toHaveLength(50);
      expect(end - start).toBeLessThan(2000); // Should load 50 templates in under 2 seconds

      // Verify some templates loaded correctly
      expect(templates).toHaveProperty('perf-test-0');
      expect(templates).toHaveProperty('perf-test-25');
      expect(templates).toHaveProperty('perf-test-49');
    });

    it('should handle large template files efficiently', async () => {
      // Create a template with large arrays
      const largeCapabilities = Array(100).fill(0).map((_, i) => `capability-${i}`);
      const largeEnvVars = Array(50).fill(0).map((_, i) => ({
        name: `ENV_VAR_${i}`,
        description: `Environment variable ${i} for large template configuration`,
        required: i % 3 === 0,
        default: `default-value-${i}`,
      }));

      const content = `id: large-template
name: "Large Template"
description: "A template with extensive configuration for performance testing"
package: "@test/large"
config:
  name: large-template
  type: stdio
  command: npx
  args: ${JSON.stringify(Array(30).fill(0).map((_, i) => `--option-${i}`))}
  env: ${JSON.stringify(Object.fromEntries(Array(40).fill(0).map((_, i) => [`KEY_${i}`, `value-${i}`])))}
envVars: ${JSON.stringify(largeEnvVars, null, 2)}
capabilities: ${JSON.stringify(largeCapabilities)}
verified: true
defaultEnabled: false`;

      await writeFile(join(mcpTemplatesDir, 'large.yaml'), content);

      const { loadMCPTemplates } = await import('@apexcli/core');

      const start = performance.now();
      const templates = await loadMCPTemplates(templatesDir);
      const end = performance.now();

      expect(templates).toHaveProperty('large-template');
      expect(templates['large-template'].capabilities).toHaveLength(100);
      expect(templates['large-template'].envVars).toHaveLength(50);
      expect(end - start).toBeLessThan(1000); // Should handle large files quickly
    });
  });

  describe('Template validation integration', () => {
    it('should validate all template fields correctly', async () => {
      // Test boundary values and edge cases
      await writeFile(
        join(mcpTemplatesDir, 'validation.yaml'),
        `id: validation-test
name: "Validation Test Template"
description: "Template for testing validation edge cases"
package: "@scope/package-name-123"
config:
  name: validation-test
  type: stdio
  command: "/usr/bin/node"
  args: []
  autoStart: false
  env: {}
envVars: []
capabilities: []
verified: false
defaultEnabled: false
category: ""
version: "0.0.1-alpha.1"
author: ""
license: ""
homepage: ""
documentationUrl: ""
repositoryUrl: ""`
      );

      const { loadMCPTemplates } = await import('@apexcli/core');

      const templates = await loadMCPTemplates(templatesDir);

      expect(templates).toHaveProperty('validation-test');
      const template = templates['validation-test'];

      expect(template.id).toBe('validation-test');
      expect(template.config?.args).toEqual([]);
      expect(template.envVars).toEqual([]);
      expect(template.capabilities).toEqual([]);
      expect(template.verified).toBe(false);
      expect(template.defaultEnabled).toBe(false);
    });

    it('should handle unicode in template content', async () => {
      await writeFile(
        join(mcpTemplatesDir, 'unicode.yaml'),
        `id: unicode-test
name: "Unicode Template 测试 🚀"
description: "Template with émojis and ñon-ASCII characters for ìnternationalization"
package: "@tëst/ünicode-template"
config:
  name: unicode-test
capabilities: ["unicode", "测试", "🌍"]
verified: true
defaultEnabled: false`
      );

      const { loadMCPTemplates } = await import('@apexcli/core');

      const templates = await loadMCPTemplates(templatesDir);

      expect(templates).toHaveProperty('unicode-test');
      expect(templates['unicode-test'].name).toBe('Unicode Template 测试 🚀');
      expect(templates['unicode-test'].description).toContain('émojis and ñon-ASCII');
      expect(templates['unicode-test'].package).toBe('@tëst/ünicode-template');
      expect(templates['unicode-test'].capabilities).toEqual(['unicode', '测试', '🌍']);
    });
  });
});