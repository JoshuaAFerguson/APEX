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

describe('Tool Alias Configuration Loading', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-alias-test-'));
    await fs.mkdir(path.join(testDir, '.apex', 'tools'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('loadToolAliases', () => {
    it('should load tool aliases from .apex/tools/ directory', async () => {
      const alias1: ToolAlias = {
        name: 'test-search',
        tool: 'Grep',
        description: 'Search for test files',
        defaults: {
          pattern: '*.test.ts',
          output_mode: 'files_with_matches',
        },
        enabled: true,
        tags: ['testing'],
      };

      const alias2: ToolAlias = {
        name: 'quick-read',
        tool: 'Read',
        description: 'Quick file reading',
        timeout: 5000,
        requireConfirmation: false,
        enabled: true,
        tags: ['file'],
      };

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'test-search.yaml'),
        `name: test-search
tool: Grep
description: Search for test files
defaults:
  pattern: "*.test.ts"
  output_mode: files_with_matches
enabled: true
tags:
  - testing`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'quick-read.yml'),
        `name: quick-read
tool: Read
description: Quick file reading
timeout: 5000
requireConfirmation: false
enabled: true
tags:
  - file`
      );

      const aliases = await loadToolAliases(testDir);

      expect(Object.keys(aliases)).toHaveLength(2);
      expect(aliases['test-search']).toEqual(alias1);
      expect(aliases['quick-read']).toEqual(alias2);
    });

    it('should return empty object if tools directory does not exist', async () => {
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-no-tools-'));
      await fs.mkdir(path.join(emptyDir, '.apex'), { recursive: true });

      const aliases = await loadToolAliases(emptyDir);
      expect(Object.keys(aliases)).toHaveLength(0);

      await fs.rm(emptyDir, { recursive: true, force: true });
    });

    it('should skip non-yaml files', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'readme.txt'),
        'This is not a YAML file'
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'valid-alias.yaml'),
        `name: valid
tool: Read
description: Valid alias`
      );

      const aliases = await loadToolAliases(testDir);
      expect(Object.keys(aliases)).toHaveLength(1);
      expect(aliases['valid']).toBeDefined();
    });

    it('should parse aliases with complex parameter templates', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'templated-grep.yaml'),
        `name: templated-grep
tool: Grep
description: Templated grep search
parameterTemplates:
  pattern: "{{searchTerm}}"
  path: "{{searchPath}}"
  output_mode: "{{format}}"
aliasParameters:
  - name: searchTerm
    type: string
    description: Term to search for
    required: true
  - name: searchPath
    type: string
    description: Path to search in
    default: "."
  - name: format
    type: string
    description: Output format
    values: ["content", "files_with_matches", "count"]
    default: "content"
defaults:
  glob: "*.{js,ts}"
enabled: true`
      );

      const aliases = await loadToolAliases(testDir);
      const templatedGrep = aliases['templated-grep'];

      expect(templatedGrep.parameterTemplates).toEqual({
        pattern: '{{searchTerm}}',
        path: '{{searchPath}}',
        output_mode: '{{format}}',
      });

      expect(templatedGrep.aliasParameters).toHaveLength(3);
      expect(templatedGrep.aliasParameters![0]).toEqual({
        name: 'searchTerm',
        type: 'string',
        description: 'Term to search for',
        required: true,
      });
      expect(templatedGrep.aliasParameters![1]).toEqual({
        name: 'searchPath',
        type: 'string',
        description: 'Path to search in',
        default: '.',
        required: false,
      });
      expect(templatedGrep.aliasParameters![2]).toEqual({
        name: 'format',
        type: 'string',
        description: 'Output format',
        values: ['content', 'files_with_matches', 'count'],
        default: 'content',
        required: false,
      });
    });

    it('should handle aliases with disabled state', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'disabled-alias.yaml'),
        `name: disabled-alias
tool: Read
description: This alias is disabled
enabled: false`
      );

      const aliases = await loadToolAliases(testDir);
      expect(aliases['disabled-alias'].enabled).toBe(false);
    });

    it('should apply defaults to alias schema fields', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'minimal-alias.yaml'),
        `name: minimal
tool: Read
description: Minimal alias`
      );

      const aliases = await loadToolAliases(testDir);
      const minimal = aliases['minimal'];

      expect(minimal.requireConfirmation).toBe(false);
      expect(minimal.enabled).toBe(true);
      expect(minimal.tags).toEqual([]);
      expect(minimal.aliasParameters).toEqual([]);
    });
  });

  describe('getMergedAliases', () => {
    it('should merge aliases from config.yaml and .apex/tools/ directory', async () => {
      // Config aliases
      const configAliases: ToolAlias[] = [
        {
          name: 'config-alias',
          tool: 'Read',
          description: 'From config file',
          enabled: true,
          tags: [],
          aliasParameters: [],
          requireConfirmation: false,
        },
        {
          name: 'shared-alias',
          tool: 'Read',
          description: 'Will be overridden',
          enabled: true,
          tags: [],
          aliasParameters: [],
          requireConfirmation: false,
        },
      ];

      // File-based aliases
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'file-alias.yaml'),
        `name: file-alias
tool: Grep
description: From file
enabled: true`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'shared-alias.yaml'),
        `name: shared-alias
tool: Grep
description: File overrides config
enabled: false`
      );

      const merged = await getMergedAliases(testDir, configAliases);

      expect(Object.keys(merged)).toHaveLength(3);
      expect(merged['config-alias'].description).toBe('From config file');
      expect(merged['file-alias'].description).toBe('From file');
      expect(merged['shared-alias'].description).toBe('File overrides config');
      expect(merged['shared-alias'].tool).toBe('Grep');
      expect(merged['shared-alias'].enabled).toBe(false);
    });

    it('should handle empty config aliases', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'only-file.yaml'),
        `name: only-file
tool: Read
description: Only from file
enabled: true`
      );

      const merged = await getMergedAliases(testDir, []);

      expect(Object.keys(merged)).toHaveLength(1);
      expect(merged['only-file'].description).toBe('Only from file');
    });

    it('should handle no file aliases', async () => {
      const configAliases: ToolAlias[] = [
        {
          name: 'only-config',
          tool: 'Read',
          description: 'Only from config',
          enabled: true,
          tags: [],
          aliasParameters: [],
          requireConfirmation: false,
        },
      ];

      const merged = await getMergedAliases(testDir, configAliases);

      expect(Object.keys(merged)).toHaveLength(1);
      expect(merged['only-config'].description).toBe('Only from config');
    });

    it('should prioritize file-based aliases over config aliases', async () => {
      const configAliases: ToolAlias[] = [
        {
          name: 'priority-test',
          tool: 'Read',
          description: 'Config version',
          enabled: true,
          timeout: 1000,
          tags: ['config'],
          aliasParameters: [],
          requireConfirmation: false,
        },
      ];

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'priority-test.yaml'),
        `name: priority-test
tool: Grep
description: File version
enabled: false
timeout: 5000
tags:
  - file
  - overridden`
      );

      const merged = await getMergedAliases(testDir, configAliases);

      expect(merged['priority-test'].tool).toBe('Grep');
      expect(merged['priority-test'].description).toBe('File version');
      expect(merged['priority-test'].enabled).toBe(false);
      expect(merged['priority-test'].timeout).toBe(5000);
      expect(merged['priority-test'].tags).toEqual(['file', 'overridden']);
    });
  });

  describe('Config Integration', () => {
    it('should load aliases in config.yaml and merge with file aliases', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'alias-test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: [
          {
            name: 'config-search',
            tool: 'Grep',
            description: 'Search from config',
            enabled: true,
            tags: [],
            aliasParameters: [],
            requireConfirmation: false,
          },
        ],
      };

      await saveConfig(testDir, config);

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'file-search.yaml'),
        `name: file-search
tool: Read
description: Read from file
enabled: true`
      );

      const loaded = await loadConfig(testDir);

      expect(loaded.aliases).toHaveLength(2);

      const configAlias = loaded.aliases!.find(a => a.name === 'config-search');
      const fileAlias = loaded.aliases!.find(a => a.name === 'file-search');

      expect(configAlias).toBeDefined();
      expect(fileAlias).toBeDefined();
      expect(configAlias!.tool).toBe('Grep');
      expect(fileAlias!.tool).toBe('Read');
    });

    it('should handle config with no aliases section and only file aliases', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'no-aliases-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, config);

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'file-only.yaml'),
        `name: file-only
tool: Read
description: Only from file
enabled: true`
      );

      const loaded = await loadConfig(testDir);

      expect(loaded.aliases).toHaveLength(1);
      expect(loaded.aliases![0].name).toBe('file-only');
      expect(loaded.aliases![0].tool).toBe('Read');
    });

    it('should convert merged aliases back to array format in config', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'conversion-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: [
          {
            name: 'first',
            tool: 'Read',
            description: 'First alias',
            enabled: true,
            tags: [],
            aliasParameters: [],
            requireConfirmation: false,
          },
        ],
      };

      await saveConfig(testDir, config);

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'second.yaml'),
        `name: second
tool: Grep
description: Second alias
enabled: true`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'third.yaml'),
        `name: third
tool: Write
description: Third alias
enabled: true`
      );

      const loaded = await loadConfig(testDir);

      expect(Array.isArray(loaded.aliases)).toBe(true);
      expect(loaded.aliases).toHaveLength(3);

      const names = loaded.aliases!.map(a => a.name).sort();
      expect(names).toEqual(['first', 'second', 'third']);
    });
  });
});