/**
 * AliasResolver Config Reload Tests
 *
 * Tests for config reloading and dynamic alias updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { AliasResolver } from '../alias-resolver';
import { TaskStore } from '../store';
import { ToolAlias } from '@apexcli/core';

describe('AliasResolver Config Reload', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;

  const writeConfig = async (aliases: ToolAlias[]) => {
    const configContent = `
aliases:
${aliases.map(alias => `  - name: "${alias.name}"
    description: "${alias.description}"
    tool: "${alias.tool}"
    enabled: ${alias.enabled}
    parameters:
${Object.entries(alias.parameters).map(([k, v]) => `      ${k}: ${JSON.stringify(v)}`).join('\n')}
    aliasParameters:
${alias.aliasParameters?.map(param => `      - name: "${param.name}"
        description: "${param.description}"
        type: "${param.type}"
        required: ${param.required}${param.default !== undefined ? `\n        default: ${JSON.stringify(param.default)}` : ''}`).join('\n') || ''}`).join('\n')}

agents:
  planner:
    enabled: true
    model: "haiku"
    maxTokens: 4000

workflows:
  feature:
    stages:
      - name: "planning"
        agent: "planner"
        description: "Plan the implementation"
`;

    await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configContent);
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-config-reload-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    store?.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Config Initialization and Reload', () => {
    it('should initialize with aliases from config', async () => {
      const initialAliases: ToolAlias[] = [
        {
          name: 'initial-alias',
          description: 'Initial test alias',
          tool: 'Read',
          parameters: { file_path: '{{file}}' },
          enabled: true,
          aliasParameters: [
            { name: 'file', description: 'File to read', type: 'string', required: true }
          ]
        }
      ];

      await writeConfig(initialAliases);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      expect(orchestrator.aliasResolver.getAvailableAliases()).toEqual(['initial-alias']);
      expect(orchestrator.aliasResolver.hasAlias('initial-alias')).toBe(true);
    });

    it('should update aliases when config is reloaded', async () => {
      // Initial config
      const initialAliases: ToolAlias[] = [
        {
          name: 'old-alias',
          description: 'Old alias',
          tool: 'Bash',
          parameters: { command: 'echo "old"' },
          enabled: true,
          aliasParameters: []
        }
      ];

      await writeConfig(initialAliases);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      expect(orchestrator.aliasResolver.getAvailableAliases()).toEqual(['old-alias']);

      // Update config with new aliases
      const newAliases: ToolAlias[] = [
        {
          name: 'new-alias-1',
          description: 'New alias 1',
          tool: 'Grep',
          parameters: { pattern: '{{pattern}}' },
          enabled: true,
          aliasParameters: [
            { name: 'pattern', description: 'Search pattern', type: 'string', required: true }
          ]
        },
        {
          name: 'new-alias-2',
          description: 'New alias 2',
          tool: 'Glob',
          parameters: { pattern: '{{glob}}' },
          enabled: true,
          aliasParameters: [
            { name: 'glob', description: 'Glob pattern', type: 'string', required: true }
          ]
        }
      ];

      await writeConfig(newAliases);

      // Reinitialize to reload config
      await orchestrator.initialize();

      const availableAliases = orchestrator.aliasResolver.getAvailableAliases();
      expect(availableAliases).toEqual(['new-alias-1', 'new-alias-2']);
      expect(orchestrator.aliasResolver.hasAlias('old-alias')).toBe(false);
      expect(orchestrator.aliasResolver.hasAlias('new-alias-1')).toBe(true);
      expect(orchestrator.aliasResolver.hasAlias('new-alias-2')).toBe(true);
    });

    it('should handle empty aliases in config', async () => {
      await writeConfig([]);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      expect(orchestrator.aliasResolver.getAvailableAliases()).toEqual([]);
    });

    it('should handle config with no aliases section', async () => {
      const configContent = `
agents:
  planner:
    enabled: true
    model: "haiku"
    maxTokens: 4000

workflows:
  feature:
    stages:
      - name: "planning"
        agent: "planner"
        description: "Plan the implementation"
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configContent);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      expect(orchestrator.aliasResolver.getAvailableAliases()).toEqual([]);
    });

    it('should preserve alias functionality after config reload', async () => {
      const workingAlias: ToolAlias = {
        name: 'test-search',
        description: 'Test search alias',
        tool: 'Grep',
        parameters: {
          pattern: '{{query}}',
          output_mode: 'files_with_matches',
          path: '{{searchPath}}'
        },
        enabled: true,
        aliasParameters: [
          { name: 'query', description: 'Search query', type: 'string', required: true },
          { name: 'searchPath', description: 'Search path', type: 'string', required: false, default: '.' }
        ]
      };

      await writeConfig([workingAlias]);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      // Test alias resolution before reload
      const result1 = orchestrator.aliasResolver.resolve('test-search', {
        query: 'function'
      });

      expect(result1).toEqual({
        aliasName: 'test-search',
        tool: 'Grep',
        parameters: {
          pattern: 'function',
          output_mode: 'files_with_matches',
          path: '.'
        },
        alias: workingAlias
      });

      // Reload with same config
      await orchestrator.initialize();

      // Test alias resolution after reload
      const result2 = orchestrator.aliasResolver.resolve('test-search', {
        query: 'class',
        searchPath: 'src/'
      });

      expect(result2).toEqual({
        aliasName: 'test-search',
        tool: 'Grep',
        parameters: {
          pattern: 'class',
          output_mode: 'files_with_matches',
          path: 'src/'
        },
        alias: expect.objectContaining({
          name: 'test-search',
          tool: 'Grep'
        })
      });
    });

    it('should handle alias modifications between reloads', async () => {
      // Initial alias
      const originalAlias: ToolAlias = {
        name: 'search-tool',
        description: 'Search tool',
        tool: 'Bash',
        parameters: { command: 'grep {{term}} {{file}}' },
        enabled: true,
        aliasParameters: [
          { name: 'term', description: 'Search term', type: 'string', required: true },
          { name: 'file', description: 'File to search', type: 'string', required: true }
        ]
      };

      await writeConfig([originalAlias]);
      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      // Test original alias
      const result1 = orchestrator.aliasResolver.resolve('search-tool', {
        term: 'TODO',
        file: 'main.js'
      });

      expect(result1.tool).toBe('Bash');
      expect(result1.parameters.command).toBe('grep TODO main.js');

      // Update the alias to use a different tool
      const modifiedAlias: ToolAlias = {
        name: 'search-tool', // Same name
        description: 'Updated search tool',
        tool: 'Grep', // Different tool
        parameters: {
          pattern: '{{term}}',
          path: '{{file}}',
          output_mode: 'content'
        },
        enabled: true,
        aliasParameters: [
          { name: 'term', description: 'Search term', type: 'string', required: true },
          { name: 'file', description: 'File to search', type: 'string', required: true }
        ]
      };

      await writeConfig([modifiedAlias]);
      await orchestrator.initialize();

      // Test modified alias
      const result2 = orchestrator.aliasResolver.resolve('search-tool', {
        term: 'FIXME',
        file: 'utils.js'
      });

      expect(result2.tool).toBe('Grep');
      expect(result2.parameters).toEqual({
        pattern: 'FIXME',
        path: 'utils.js',
        output_mode: 'content'
      });
    });

    it('should handle disabled aliases after reload', async () => {
      const enabledAlias: ToolAlias = {
        name: 'test-alias',
        description: 'Test alias',
        tool: 'Read',
        parameters: { file_path: '{{file}}' },
        enabled: true,
        aliasParameters: [
          { name: 'file', description: 'File to read', type: 'string', required: true }
        ]
      };

      await writeConfig([enabledAlias]);
      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      expect(orchestrator.aliasResolver.hasAlias('test-alias')).toBe(true);

      // Disable the alias
      const disabledAlias: ToolAlias = {
        ...enabledAlias,
        enabled: false
      };

      await writeConfig([disabledAlias]);
      await orchestrator.initialize();

      expect(orchestrator.aliasResolver.getAvailableAliases()).toEqual(['test-alias']);
      expect(orchestrator.aliasResolver.hasAlias('test-alias')).toBe(true);

      // The resolver should still include disabled aliases for completeness
      // but the enabled flag should be preserved
      const alias = orchestrator.aliasResolver.getAlias('test-alias');
      expect(alias?.enabled).toBe(false);
    });
  });

  describe('Concurrent Config Changes', () => {
    it('should handle rapid config reloads gracefully', async () => {
      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      // Start with empty config
      await writeConfig([]);
      await orchestrator.initialize();

      // Rapidly update config multiple times
      for (let i = 0; i < 5; i++) {
        const alias: ToolAlias = {
          name: `rapid-alias-${i}`,
          description: `Rapid alias ${i}`,
          tool: 'Bash',
          parameters: { command: `echo "iteration ${i}"` },
          enabled: true,
          aliasParameters: []
        };

        await writeConfig([alias]);
        await orchestrator.initialize();

        expect(orchestrator.aliasResolver.hasAlias(`rapid-alias-${i}`)).toBe(true);
      }
    });

    it('should maintain consistency during config transitions', async () => {
      const baseAlias: ToolAlias = {
        name: 'stable-alias',
        description: 'Stable alias',
        tool: 'Read',
        parameters: { file_path: '{{file}}' },
        enabled: true,
        aliasParameters: [
          { name: 'file', description: 'File to read', type: 'string', required: true }
        ]
      };

      await writeConfig([baseAlias]);
      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      // Continuously test resolution while config is being updated
      const testPromises: Promise<any>[] = [];

      // Add more aliases
      for (let i = 1; i <= 3; i++) {
        const newAlias: ToolAlias = {
          name: `additional-alias-${i}`,
          description: `Additional alias ${i}`,
          tool: 'Grep',
          parameters: { pattern: `{{pattern${i}}}` },
          enabled: true,
          aliasParameters: [
            { name: `pattern${i}`, description: `Pattern ${i}`, type: 'string', required: true }
          ]
        };

        testPromises.push(
          (async () => {
            await writeConfig([baseAlias, newAlias]);
            await orchestrator.initialize();

            // Verify the stable alias still works
            const result = orchestrator.aliasResolver.resolve('stable-alias', {
              file: 'test.js'
            });
            expect(result.tool).toBe('Read');

            // Verify the new alias works
            const newResult = orchestrator.aliasResolver.resolve(`additional-alias-${i}`, {
              [`pattern${i}`]: 'test'
            });
            expect(newResult.tool).toBe('Grep');
          })()
        );
      }

      await Promise.all(testPromises);
    });
  });

  describe('Error Handling During Config Reload', () => {
    it('should handle malformed config gracefully', async () => {
      // Write invalid YAML
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        'invalid: yaml: content: [unmatched brackets'
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      // Should not throw, but handle gracefully
      await expect(orchestrator.initialize()).rejects.toThrow();
    });

    it('should handle missing config file', async () => {
      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      // Should not throw when config doesn't exist
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Should have empty aliases
      expect(orchestrator.aliasResolver.getAvailableAliases()).toEqual([]);
    });

    it('should validate alias definitions during reload', async () => {
      // Create config with invalid alias (missing required fields)
      const configContent = `
aliases:
  - name: "invalid-alias"
    # Missing tool field
    parameters:
      some_param: "value"

agents:
  planner:
    enabled: true
    model: "haiku"
    maxTokens: 4000

workflows:
  feature:
    stages:
      - name: "planning"
        agent: "planner"
        description: "Plan the implementation"
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configContent);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });

      // Should handle validation errors gracefully
      await expect(orchestrator.initialize()).rejects.toThrow();
    });
  });
});