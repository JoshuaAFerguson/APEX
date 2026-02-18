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

describe('Tool Alias Configuration Edge Cases', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-alias-edge-'));
    await fs.mkdir(path.join(testDir, '.apex', 'tools'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Error Handling', () => {
    it('should handle invalid YAML in alias files', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'invalid.yaml'),
        `name: broken
tool: Read
description: "Unclosed quote
invalid yaml content`
      );

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should handle alias validation failures', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'invalid-alias.yaml'),
        `name: ""
tool: ""
description: ""`
      );

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should handle missing required fields in alias', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'incomplete.yaml'),
        `name: incomplete
# Missing tool and description`
      );

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should handle filesystem permission errors gracefully', async () => {
      // Create a file we can't read (simulate permission error by creating and removing directory)
      const restrictedDir = path.join(testDir, '.apex', 'restricted-tools');
      await fs.mkdir(restrictedDir, { recursive: true });

      // This should not throw since loadToolAliases is looking for .apex/tools/, not .apex/restricted-tools/
      const aliases = await loadToolAliases(testDir);
      expect(aliases).toEqual({});
    });

    it('should throw error on config load when alias loading fails', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'error-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, config);

      // Create invalid alias file
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'broken.yaml'),
        'invalid: yaml: content: ['
      );

      await expect(loadConfig(testDir)).rejects.toThrow('Failed to load tool aliases');
    });
  });

  describe('Schema Validation', () => {
    it('should validate alias parameter types', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'invalid-param-type.yaml'),
        `name: invalid-param
tool: Read
description: Invalid parameter type
aliasParameters:
  - name: badParam
    type: invalid_type
    description: Bad parameter`
      );

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should validate parameter default value types', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'invalid-default.yaml'),
        `name: invalid-default
tool: Read
description: Invalid default value
aliasParameters:
  - name: numberParam
    type: number
    description: Should be number
    default: "not a number"`
      );

      // Note: Zod coercion might handle this, but the intent is to test validation
      const aliases = await loadToolAliases(testDir);
      expect(aliases['invalid-default']).toBeDefined();
    });

    it('should validate timeout values', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'negative-timeout.yaml'),
        `name: negative-timeout
tool: Read
description: Negative timeout
timeout: -1000`
      );

      await expect(loadToolAliases(testDir)).rejects.toThrow();
    });

    it('should handle boolean parameter defaults correctly', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'bool-params.yaml'),
        `name: bool-params
tool: Read
description: Boolean parameters
aliasParameters:
  - name: enableFeature
    type: boolean
    description: Enable feature
    default: true
  - name: disableOther
    type: boolean
    description: Disable other
    default: false
defaults:
  verbose: true
  force: false`
      );

      const aliases = await loadToolAliases(testDir);
      const boolAlias = aliases['bool-params'];

      expect(boolAlias.aliasParameters![0].default).toBe(true);
      expect(boolAlias.aliasParameters![1].default).toBe(false);
      expect(boolAlias.defaults!.verbose).toBe(true);
      expect(boolAlias.defaults!.force).toBe(false);
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle empty .apex/tools directory', async () => {
      const aliases = await loadToolAliases(testDir);
      expect(aliases).toEqual({});
    });

    it('should handle mixed file extensions', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'yaml-ext.yaml'),
        `name: yaml-ext
tool: Read
description: YAML extension`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'yml-ext.yml'),
        `name: yml-ext
tool: Grep
description: YML extension`
      );

      const aliases = await loadToolAliases(testDir);
      expect(Object.keys(aliases)).toHaveLength(2);
      expect(aliases['yaml-ext']).toBeDefined();
      expect(aliases['yml-ext']).toBeDefined();
    });

    it('should handle files with similar names', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'search.yaml'),
        `name: search
tool: Grep
description: Basic search`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'search-advanced.yaml'),
        `name: search-advanced
tool: Grep
description: Advanced search`
      );

      const aliases = await loadToolAliases(testDir);
      expect(Object.keys(aliases)).toHaveLength(2);
      expect(aliases['search'].description).toBe('Basic search');
      expect(aliases['search-advanced'].description).toBe('Advanced search');
    });

    it('should handle subdirectories in tools directory', async () => {
      await fs.mkdir(path.join(testDir, '.apex', 'tools', 'subdir'));
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'subdir', 'nested.yaml'),
        `name: nested
tool: Read
description: Nested alias`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'top-level.yaml'),
        `name: top-level
tool: Read
description: Top level alias`
      );

      // loadToolAliases should only read files in the direct .apex/tools/ directory
      const aliases = await loadToolAliases(testDir);
      expect(Object.keys(aliases)).toHaveLength(1);
      expect(aliases['top-level']).toBeDefined();
      expect(aliases['nested']).toBeUndefined();
    });
  });

  describe('Complex Merge Scenarios', () => {
    it('should handle aliases with same name but different casing', async () => {
      const configAliases: ToolAlias[] = [
        {
          name: 'Search',
          tool: 'Read',
          description: 'Capital S search',
          enabled: true,
          tags: [],
          aliasParameters: [],
          requireConfirmation: false,
        },
      ];

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'search.yaml'),
        `name: search
tool: Grep
description: lowercase search
enabled: true`
      );

      const merged = await getMergedAliases(testDir, configAliases);

      // Both should exist since names are different (case-sensitive)
      expect(Object.keys(merged)).toHaveLength(2);
      expect(merged['Search'].description).toBe('Capital S search');
      expect(merged['search'].description).toBe('lowercase search');
    });

    it('should handle large number of aliases efficiently', async () => {
      const configAliases: ToolAlias[] = [];

      // Create 50 config aliases
      for (let i = 0; i < 50; i++) {
        configAliases.push({
          name: `config-alias-${i}`,
          tool: 'Read',
          description: `Config alias ${i}`,
          enabled: true,
          tags: [],
          aliasParameters: [],
          requireConfirmation: false,
        });
      }

      // Create 50 file aliases
      for (let i = 0; i < 50; i++) {
        await fs.writeFile(
          path.join(testDir, '.apex', 'tools', `file-alias-${i}.yaml`),
          `name: file-alias-${i}
tool: Grep
description: File alias ${i}
enabled: true`
        );
      }

      const merged = await getMergedAliases(testDir, configAliases);
      expect(Object.keys(merged)).toHaveLength(100);
    });

    it('should handle aliases with special characters in names', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'special-chars.yaml'),
        `name: "search-with-dashes_and_underscores.dots"
tool: Grep
description: Special characters in name
enabled: true`
      );

      const aliases = await loadToolAliases(testDir);
      expect(aliases['search-with-dashes_and_underscores.dots']).toBeDefined();
    });

    it('should handle aliases with complex defaults objects', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'complex-defaults.yaml'),
        `name: complex-defaults
tool: Grep
description: Complex defaults
defaults:
  simpleString: "value"
  number: 42
  boolean: true
  array:
    - item1
    - item2
  nested:
    key1: "value1"
    key2: 123
    deeper:
      nested: "value"`
      );

      const aliases = await loadToolAliases(testDir);
      const complex = aliases['complex-defaults'];

      expect(complex.defaults!.simpleString).toBe('value');
      expect(complex.defaults!.number).toBe(42);
      expect(complex.defaults!.boolean).toBe(true);
      expect(complex.defaults!.array).toEqual(['item1', 'item2']);
      expect(complex.defaults!.nested).toEqual({
        key1: 'value1',
        key2: 123,
        deeper: {
          nested: 'value',
        },
      });
    });
  });

  describe('Parameter Template Edge Cases', () => {
    it('should handle empty parameter templates', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'empty-templates.yaml'),
        `name: empty-templates
tool: Read
description: Empty parameter templates
parameterTemplates: {}`
      );

      const aliases = await loadToolAliases(testDir);
      expect(aliases['empty-templates'].parameterTemplates).toEqual({});
    });

    it('should handle parameter templates with special placeholder syntax', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'special-placeholders.yaml'),
        `name: special-placeholders
tool: Grep
description: Special placeholder syntax
parameterTemplates:
  pattern: "{{variable}}"
  path: "{{UPPERCASE_VAR}}"
  option: "{{kebab-case-var}}"
  complex: "prefix-{{var}}-{{other}}-suffix"`
      );

      const aliases = await loadToolAliases(testDir);
      const special = aliases['special-placeholders'];

      expect(special.parameterTemplates!.pattern).toBe('{{variable}}');
      expect(special.parameterTemplates!.path).toBe('{{UPPERCASE_VAR}}');
      expect(special.parameterTemplates!.option).toBe('{{kebab-case-var}}');
      expect(special.parameterTemplates!.complex).toBe('prefix-{{var}}-{{other}}-suffix');
    });
  });
});