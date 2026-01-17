/**
 * Integration tests for MCP command
 * Tests the complete flow from command parsing to template loading and display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import type { CliContext } from '../index.js';
import type { MCPTemplate } from '@apexcli/core';

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

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('MCP Command Integration Tests', () => {
  let mockContext: CliContext;
  let tempDir: string;
  let templatesDir: string;
  let mcpTemplatesDir: string;

  beforeEach(async () => {
    mockContext = {
      cwd: '/test/project',
      initialized: true,
      config: {
        project: {
          name: 'Test Project',
          description: 'Test project',
        },
        agents: {},
        workflows: {},
        limits: {
          maxTokens: 100000,
          maxCost: 10.0,
          timeoutMs: 300000,
        },
        autonomy: {
          level: 'medium',
          autoApprove: false,
        },
      },
    };

    // Create temporary directories for testing
    tempDir = await import('fs/promises').then(fs =>
      fs.mkdtemp(join(tmpdir(), 'mcp-integration-test-'))
    );
    templatesDir = join(tempDir, 'templates');
    mcpTemplatesDir = join(templatesDir, 'mcp');
    await mkdir(mcpTemplatesDir, { recursive: true });

    mockConsoleLog.mockClear();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real filesystem integration', () => {
    it('should load and display actual template files', async () => {
      // Create real template files
      const filesystemTemplate = {
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
      };

      const githubTemplate = {
        id: 'github',
        name: 'GitHub Server',
        description: 'MCP server for GitHub repository integration',
        package: '@modelcontextprotocol/server-github',
        config: {
          name: 'github',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          autoStart: false,
        },
        envVars: [
          {
            name: 'GITHUB_TOKEN',
            description: 'GitHub personal access token',
            required: true,
          },
        ],
        capabilities: ['git', 'api'],
        verified: true,
        defaultEnabled: false,
      };

      // Write template files
      await writeFile(
        join(mcpTemplatesDir, 'filesystem.yaml'),
        `id: filesystem
name: "Filesystem Server"
description: "MCP server providing secure filesystem access"
package: "@modelcontextprotocol/server-filesystem"
config:
  name: filesystem
  type: stdio
  command: npx
  args:
    - "-y"
    - "@modelcontextprotocol/server-filesystem"
  autoStart: true
capabilities:
  - filesystem
  - read
  - write
verified: true
defaultEnabled: true`
      );

      await writeFile(
        join(mcpTemplatesDir, 'github.yml'),
        `id: github
name: "GitHub Server"
description: "MCP server for GitHub repository integration"
package: "@modelcontextprotocol/server-github"
config:
  name: github
  type: stdio
  command: npx
  args:
    - "-y"
    - "@modelcontextprotocol/server-github"
  autoStart: false
envVars:
  - name: GITHUB_TOKEN
    description: "GitHub personal access token"
    required: true
capabilities:
  - git
  - api
verified: true
defaultEnabled: false`
      );

      // Mock loadMCPTemplates to use our temp directory
      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            // Use the actual loadMCPTemplates implementation but with our temp directory
            const { loadMCPTemplates: realLoadMCPTemplates } = await vi.importActual('@apexcli/core') as any;
            return await realLoadMCPTemplates(templatesDir);
          },
        };
      });

      // Import and test the command
      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      // Verify output
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Available MCP Server Templates:')
      );

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(allOutput).toContain('Filesystem Server');
      expect(allOutput).toContain('GitHub Server');
    });

    it('should handle missing templates directory gracefully', async () => {
      // Remove the templates directory
      await rm(tempDir, { recursive: true, force: true });

      // Mock loadMCPTemplates to use non-existent directory
      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            const { loadMCPTemplates: realLoadMCPTemplates } = await vi.importActual('@apexcli/core') as any;
            return await realLoadMCPTemplates('/nonexistent/path');
          },
        };
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates')
      );
    });

    it('should handle invalid YAML files gracefully', async () => {
      // Create invalid YAML file
      await writeFile(
        join(mcpTemplatesDir, 'invalid.yaml'),
        'invalid: yaml: content: [}'
      );

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            const { loadMCPTemplates: realLoadMCPTemplates } = await vi.importActual('@apexcli/core') as any;
            return await realLoadMCPTemplates(templatesDir);
          },
        };
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates')
      );
    });

    it('should skip non-YAML files', async () => {
      // Create mix of files
      await writeFile(
        join(mcpTemplatesDir, 'valid.yaml'),
        `id: valid
name: "Valid Template"
description: "A valid template"
package: "@test/valid"
config: {}
capabilities: []
verified: true
defaultEnabled: false`
      );

      await writeFile(join(mcpTemplatesDir, 'readme.txt'), 'This is not a YAML file');
      await writeFile(join(mcpTemplatesDir, 'config.json'), '{"not": "yaml"}');

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            const { loadMCPTemplates: realLoadMCPTemplates } = await vi.importActual('@apexcli/core') as any;
            return await realLoadMCPTemplates(templatesDir);
          },
        };
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      // Should only process the YAML file
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(allOutput).toContain('Valid Template');
      expect(allOutput).not.toContain('readme.txt');
      expect(allOutput).not.toContain('config.json');
    });

    it('should handle templates with minimal required fields', async () => {
      // Create minimal template
      await writeFile(
        join(mcpTemplatesDir, 'minimal.yaml'),
        `id: minimal
name: "Minimal Template"
description: "A minimal template with required fields only"
package: "@test/minimal"`
      );

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            const { loadMCPTemplates: realLoadMCPTemplates } = await vi.importActual('@apexcli/core') as any;
            return await realLoadMCPTemplates(templatesDir);
          },
        };
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(allOutput).toContain('Minimal Template');
      expect(allOutput).toContain('@test/minimal');
    });

    it('should handle templates with complex configurations', async () => {
      // Create complex template with all fields
      await writeFile(
        join(mcpTemplatesDir, 'complex.yaml'),
        `id: complex
name: "Complex Template"
description: "A template with all possible fields"
package: "@test/complex"
config:
  name: complex
  type: stdio
  command: npx
  args:
    - "-y"
    - "@test/complex"
  autoStart: true
  env:
    NODE_ENV: production
    DEBUG: "true"
envVars:
  - name: API_KEY
    description: "API key for authentication"
    required: true
    default: "test-key"
  - name: API_URL
    description: "API endpoint URL"
    required: false
    default: "https://api.example.com"
capabilities:
  - api
  - auth
  - database
verified: true
defaultEnabled: false
category: "api"
version: "1.0.0"
author: "Test Author"
license: "MIT"
homepage: "https://example.com"
documentationUrl: "https://docs.example.com"
repositoryUrl: "https://github.com/test/complex"`
      );

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            const { loadMCPTemplates: realLoadMCPTemplates } = await vi.importActual('@apexcli/core') as any;
            return await realLoadMCPTemplates(templatesDir);
          },
        };
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(allOutput).toContain('Complex Template');
      expect(allOutput).toContain('api, auth, database');
      expect(allOutput).toContain('Env: API_KEY');
    });
  });

  describe('Error recovery and edge cases', () => {
    it('should handle permission denied errors', async () => {
      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            const error = new Error('Permission denied') as NodeJS.ErrnoException;
            error.code = 'EACCES';
            throw error;
          },
        };
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied')
      );
    });

    it('should handle network timeout errors', async () => {
      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            const error = new Error('Network timeout') as NodeJS.ErrnoException;
            error.code = 'ETIMEDOUT';
            throw error;
          },
        };
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      await mcpCommand?.handler(mockContext, ['list']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error loading MCP templates')
      );
    });

    it('should handle concurrent command execution', async () => {
      // Create template file
      await writeFile(
        join(mcpTemplatesDir, 'concurrent.yaml'),
        `id: concurrent
name: "Concurrent Template"
description: "Template for concurrency testing"
package: "@test/concurrent"
config: {}
capabilities: []
verified: true
defaultEnabled: false`
      );

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            const { loadMCPTemplates: realLoadMCPTemplates } = await vi.importActual('@apexcli/core') as any;
            return await realLoadMCPTemplates(templatesDir);
          },
        };
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      // Execute multiple commands concurrently
      const promises = Array(5).fill(0).map(() =>
        mcpCommand?.handler(mockContext, ['list'])
      );

      await Promise.all(promises);

      // All should complete successfully
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Performance with real templates', () => {
    it('should handle large template files efficiently', async () => {
      // Create a large template file (simulating real-world complexity)
      const largeTemplate = {
        id: 'large',
        name: 'Large Template',
        description: 'A template with extensive configuration and documentation',
        package: '@test/large',
        config: {
          name: 'large',
          type: 'stdio',
          command: 'npx',
          args: Array(50).fill(0).map((_, i) => `--arg${i}`),
          autoStart: true,
          env: Object.fromEntries(
            Array(20).fill(0).map((_, i) => [`ENV_VAR_${i}`, `value${i}`])
          ),
        },
        envVars: Array(30).fill(0).map((_, i) => ({
          name: `ENV_VAR_${i}`,
          description: `Environment variable ${i} for configuration`,
          required: i % 2 === 0,
          default: `default${i}`,
        })),
        capabilities: Array(25).fill(0).map((_, i) => `capability${i}`),
        verified: true,
        defaultEnabled: false,
        category: 'large',
        version: '1.0.0',
        author: 'Test Author',
        license: 'MIT',
      };

      // Convert to YAML manually for large content
      const yamlContent = `id: large
name: "Large Template"
description: "A template with extensive configuration and documentation"
package: "@test/large"
config:
  name: large
  type: stdio
  command: npx
  args: ${JSON.stringify(largeTemplate.config.args).replace(/"/g, '"')}
  autoStart: true
  env: ${JSON.stringify(largeTemplate.config.env, null, 4)}
envVars: ${JSON.stringify(largeTemplate.envVars, null, 2)}
capabilities: ${JSON.stringify(largeTemplate.capabilities)}
verified: true
defaultEnabled: false
category: "large"
version: "1.0.0"
author: "Test Author"
license: "MIT"`.replace(/"/g, '"');

      await writeFile(join(mcpTemplatesDir, 'large.yaml'), yamlContent);

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            const { loadMCPTemplates: realLoadMCPTemplates } = await vi.importActual('@apexcli/core') as any;
            return await realLoadMCPTemplates(templatesDir);
          },
        };
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const start = performance.now();
      await mcpCommand?.handler(mockContext, ['list']);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should handle large files reasonably quickly

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(allOutput).toContain('Large Template');
    });

    it('should handle many template files efficiently', async () => {
      // Create many small template files
      const templatePromises = Array(20).fill(0).map(async (_, i) => {
        const content = `id: template${i}
name: "Template ${i}"
description: "Auto-generated template ${i}"
package: "@test/template${i}"
config: {}
capabilities: ["cap${i}"]
verified: ${i % 2 === 0}
defaultEnabled: false`;

        await writeFile(join(mcpTemplatesDir, `template${i}.yaml`), content);
      });

      await Promise.all(templatePromises);

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core');
        return {
          ...actual,
          loadMCPTemplates: async () => {
            const { loadMCPTemplates: realLoadMCPTemplates } = await vi.importActual('@apexcli/core') as any;
            return await realLoadMCPTemplates(templatesDir);
          },
        };
      });

      const { commands } = await import('../index.js');
      const mcpCommand = commands.find(cmd => cmd.name === 'mcp');

      const start = performance.now();
      await mcpCommand?.handler(mockContext, ['list']);
      const end = performance.now();

      expect(end - start).toBeLessThan(2000); // Should handle many files efficiently

      // Should display all templates
      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      for (let i = 0; i < 20; i++) {
        expect(allOutput).toContain(`Template ${i}`);
      }
    });
  });
});