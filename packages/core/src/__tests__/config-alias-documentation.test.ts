import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  saveConfig,
  loadToolAliases,
  getMergedAliases,
} from '../config';
import { ApexConfig, ToolAlias } from '../types';

/**
 * Documentation test cases for tool alias functionality
 * These tests serve as living documentation and examples of how to use the alias system
 */
describe('Tool Alias Configuration - Documentation Examples', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-alias-docs-'));
    await fs.mkdir(path.join(testDir, '.apex', 'tools'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Usage Examples', () => {
    it('should demonstrate basic alias definition in config.yaml', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'basic-example',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: [
          {
            name: 'quick-read',
            tool: 'Read',
            description: 'Quickly read a file',
            enabled: true,
            tags: ['file-ops'],
            aliasParameters: [],
            requireConfirmation: false,
          },
        ],
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.aliases).toHaveLength(1);
      expect(loaded.aliases![0]).toMatchObject({
        name: 'quick-read',
        tool: 'Read',
        description: 'Quickly read a file',
        enabled: true,
      });
    });

    it('should demonstrate basic file-based alias definition', async () => {
      const basicConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'file-example',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, basicConfig);

      // Create a simple file-based alias
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'search-logs.yaml'),
        `name: search-logs
tool: Grep
description: Search through log files
defaults:
  pattern: "ERROR|WARN"
  output_mode: "content"
  glob: "**/*.log"
enabled: true
tags:
  - logging
  - debugging`
      );

      const loaded = await loadConfig(testDir);

      expect(loaded.aliases).toHaveLength(1);
      expect(loaded.aliases![0]).toMatchObject({
        name: 'search-logs',
        tool: 'Grep',
        description: 'Search through log files',
        enabled: true,
        tags: ['logging', 'debugging'],
      });
    });
  });

  describe('Advanced Usage Examples', () => {
    it('should demonstrate parameterized alias with templates', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'find-function.yaml'),
        `name: find-function
tool: Grep
description: Find function definitions
defaults:
  output_mode: "content"
  glob: "**/*.{js,ts}"
parameterTemplates:
  pattern: "function\\\\s+{{functionName}}\\\\s*\\\\("
aliasParameters:
  - name: functionName
    type: string
    description: Name of the function to find
    required: true
  - name: fileType
    type: string
    description: File type to search
    values: ["js", "ts", "both"]
    default: "both"
enabled: true
tags:
  - search
  - functions`
      );

      const basicConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'advanced-example',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, basicConfig);
      const loaded = await loadConfig(testDir);

      const findFunction = loaded.aliases![0];
      expect(findFunction.name).toBe('find-function');
      expect(findFunction.parameterTemplates).toEqual({
        pattern: 'function\\\\s+{{functionName}}\\\\s*\\\\(',
      });
      expect(findFunction.aliasParameters).toHaveLength(2);
      expect(findFunction.aliasParameters![0]).toMatchObject({
        name: 'functionName',
        type: 'string',
        required: true,
      });
      expect(findFunction.aliasParameters![1]).toMatchObject({
        name: 'fileType',
        type: 'string',
        values: ['js', 'ts', 'both'],
        default: 'both',
        required: false,
      });
    });

    it('should demonstrate complex alias with multiple parameter types', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'test-runner.yaml'),
        `name: test-runner
tool: Bash
description: Advanced test runner with options
defaults:
  timeout: 30000
parameterTemplates:
  command: "npm test -- {{testPattern}} {{coverage}} {{watch}}"
aliasParameters:
  - name: testPattern
    type: string
    description: Test file pattern to run
    default: "**/*.test.ts"
  - name: coverage
    type: boolean
    description: Run with coverage
    default: false
  - name: watch
    type: boolean
    description: Run in watch mode
    default: false
requireConfirmation: false
enabled: true
tags:
  - testing
  - development`
      );

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-example',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      const testRunner = loaded.aliases![0];
      expect(testRunner.aliasParameters).toHaveLength(3);
      expect(testRunner.aliasParameters![1].type).toBe('boolean');
      expect(testRunner.aliasParameters![1].default).toBe(false);
      expect(testRunner.parameterTemplates!.command).toContain('{{coverage}}');
    });
  });

  describe('Priority and Merging Examples', () => {
    it('should demonstrate config vs file priority', async () => {
      // Start with config-based alias
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'priority-example',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: [
          {
            name: 'build-check',
            tool: 'Bash',
            description: 'Basic build check from config',
            defaults: {
              command: 'npm run build',
            },
            enabled: true,
            tags: ['build'],
            aliasParameters: [],
            requireConfirmation: false,
          },
        ],
      };

      await saveConfig(testDir, config);

      // Override with file-based alias
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'build-check.yaml'),
        `name: build-check
tool: Bash
description: Enhanced build check from file
defaults:
  command: "npm run build -- --verbose"
timeout: 60000
enabled: true
tags:
  - build
  - enhanced
requireConfirmation: true`
      );

      const loaded = await loadConfig(testDir);

      expect(loaded.aliases).toHaveLength(1);
      const buildCheck = loaded.aliases![0];

      // File-based alias should override config-based one
      expect(buildCheck.description).toBe('Enhanced build check from file');
      expect(buildCheck.defaults!.command).toBe('npm run build -- --verbose');
      expect(buildCheck.timeout).toBe(60000);
      expect(buildCheck.tags).toEqual(['build', 'enhanced']);
      expect(buildCheck.requireConfirmation).toBe(true);
    });

    it('should demonstrate merging config and file aliases', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'merge-example',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: [
          {
            name: 'config-only',
            tool: 'Read',
            description: 'Only in config',
            enabled: true,
            tags: ['config'],
            aliasParameters: [],
            requireConfirmation: false,
          },
        ],
      };

      await saveConfig(testDir, config);

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'file-only.yaml'),
        `name: file-only
tool: Grep
description: Only in file
enabled: true
tags:
  - file`
      );

      const loaded = await loadConfig(testDir);

      expect(loaded.aliases).toHaveLength(2);

      const configAlias = loaded.aliases!.find(a => a.name === 'config-only');
      const fileAlias = loaded.aliases!.find(a => a.name === 'file-only');

      expect(configAlias).toMatchObject({
        name: 'config-only',
        tool: 'Read',
        description: 'Only in config',
        tags: ['config'],
      });

      expect(fileAlias).toMatchObject({
        name: 'file-only',
        tool: 'Grep',
        description: 'Only in file',
        tags: ['file'],
      });
    });
  });

  describe('Real-World Workflow Examples', () => {
    it('should demonstrate development workflow aliases', async () => {
      const devConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'dev-workflow',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: [
          {
            name: 'dev-setup',
            tool: 'Bash',
            description: 'Setup development environment',
            defaults: {
              command: 'npm install && npm run build',
            },
            requireConfirmation: true,
            enabled: true,
            tags: ['setup', 'development'],
            aliasParameters: [],
          },
        ],
      };

      await saveConfig(testDir, devConfig);

      // Developer adds personal productivity aliases
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'find-component.yaml'),
        `name: find-component
tool: Grep
description: Find React component files
defaults:
  pattern: "export\\\\s+(default\\\\s+)?(function|class|const)\\\\s+{{componentName}}"
  output_mode: "files_with_matches"
  glob: "src/**/*.{tsx,jsx}"
aliasParameters:
  - name: componentName
    type: string
    description: Component name to search for
    required: true
enabled: true
tags:
  - react
  - components
  - search`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'test-component.yaml'),
        `name: test-component
tool: Bash
description: Run tests for a specific component
parameterTemplates:
  command: "npm test -- {{componentName}}.test.{ts,tsx} {{watch}}"
aliasParameters:
  - name: componentName
    type: string
    description: Component name to test
    required: true
  - name: watch
    type: boolean
    description: Run in watch mode
    default: false
timeout: 30000
enabled: true
tags:
  - testing
  - components`
      );

      const loaded = await loadConfig(testDir);

      expect(loaded.aliases).toHaveLength(3);

      const setupAlias = loaded.aliases!.find(a => a.name === 'dev-setup');
      const findComponent = loaded.aliases!.find(a => a.name === 'find-component');
      const testComponent = loaded.aliases!.find(a => a.name === 'test-component');

      expect(setupAlias!.requireConfirmation).toBe(true);
      expect(findComponent!.tags).toEqual(['react', 'components', 'search']);
      expect(testComponent!.timeout).toBe(30000);
    });
  });

  describe('Error Prevention Examples', () => {
    it('should demonstrate proper alias validation', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'validation-example',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: [
          {
            name: 'well-formed-alias',
            tool: 'Read',
            description: 'Properly formed alias with all required fields',
            enabled: true,
            tags: ['example', 'validation'],
            aliasParameters: [
              {
                name: 'file-path',
                type: 'string',
                description: 'Path to file to read',
                required: true,
              },
            ],
            requireConfirmation: false,
          },
        ],
      };

      await saveConfig(testDir, config);

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'well-formed-file-alias.yaml'),
        `name: well-formed-file-alias
tool: Grep
description: Properly formed file-based alias
defaults:
  output_mode: "content"
parameterTemplates:
  pattern: "{{searchTerm}}"
  path: "{{searchPath}}"
aliasParameters:
  - name: searchTerm
    type: string
    description: Term to search for
    required: true
  - name: searchPath
    type: string
    description: Path to search in
    default: "."
    required: false
enabled: true
tags:
  - search
  - well-formed`
      );

      const loaded = await loadConfig(testDir);

      expect(loaded.aliases).toHaveLength(2);
      // Both aliases should load successfully due to proper validation
      expect(loaded.aliases!.every(a => a.name && a.tool && a.description)).toBe(true);
    });
  });
});