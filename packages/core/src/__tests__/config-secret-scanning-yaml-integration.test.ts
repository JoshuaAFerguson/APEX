import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { loadConfig, saveConfig, initializeApex } from '../config';
import { ApexConfig } from '../types';

describe('SecretScanning YAML Configuration Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-yaml-integration-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('YAML Format Validation', () => {
    it('should parse YAML config with all enforcement modes correctly', async () => {
      const modes = ['warn', 'block', 'audit'] as const;

      for (const mode of modes) {
        const yamlContent = `version: '1.0'
project:
  name: test-${mode}-project
secretScanning:
  enabled: true
  enforcementMode: ${mode}
  customPatterns: []
  includeBuiltInPatterns: true
  excludePaths:
    - "*.test.ts"
    - "fixtures/**"`;

        await fs.writeFile(
          path.join(testDir, '.apex', 'config.yaml'),
          yamlContent
        );

        const loadedConfig = await loadConfig(testDir);
        expect(loadedConfig.secretScanning?.enforcementMode).toBe(mode);

        // Verify the config can be saved back correctly
        await saveConfig(testDir, loadedConfig);

        const savedContent = await fs.readFile(
          path.join(testDir, '.apex', 'config.yaml'),
          'utf-8'
        );
        const parsedSaved = yaml.parse(savedContent);
        expect(parsedSaved.secretScanning.enforcementMode).toBe(mode);
      }
    });

    it('should handle YAML configs without secretScanning section', async () => {
      const yamlConfig = `version: '1.0'
project:
  name: test-no-secret-scanning
  language: typescript
git:
  branchPrefix: 'feature/'
  autoPush: false`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        yamlConfig
      );

      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.secretScanning).toBeUndefined();
    });

    it('should handle YAML with secretScanning but no enforcementMode', async () => {
      const yamlConfig = `version: '1.0'
project:
  name: test-no-enforcement-mode
secretScanning:
  enabled: true
  customPatterns: []`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        yamlConfig
      );

      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.secretScanning?.enabled).toBe(true);
      expect(loadedConfig.secretScanning?.enforcementMode).toBeUndefined();
      expect(loadedConfig.secretScanning?.customPatterns).toEqual([]);
    });

    it('should handle complex nested YAML structure with secretScanning', async () => {
      const complexYaml = `version: '1.0'
project:
  name: complex-project
  language: typescript
  framework: react
autonomy:
  level: review-before-commit
models:
  planning: opus
  implementation: sonnet
  review: haiku
git:
  branchPrefix: 'feature/'
  commitFormat: conventional
  autoPush: true
secretScanning:
  enabled: true
  enforcementMode: block
  customPatterns: []
  includeBuiltInPatterns: true
  excludePaths:
    - "node_modules/**"
    - ".git/**"
    - "coverage/**"
    - "dist/**"
limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 25.0
permissions:
  preset: review-all
policy:
  enforcement: warn
  enabled: true`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        complexYaml
      );

      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.secretScanning?.enabled).toBe(true);
      expect(loadedConfig.secretScanning?.enforcementMode).toBe('block');
      expect(loadedConfig.secretScanning?.customPatterns).toEqual([]);
      expect(loadedConfig.secretScanning?.includeBuiltInPatterns).toBe(true);
      expect(loadedConfig.secretScanning?.excludePaths).toHaveLength(4);

      // Verify other config sections are preserved
      expect(loadedConfig.project.language).toBe('typescript');
      expect(loadedConfig.models?.planning).toBe('opus');
      expect(loadedConfig.git?.branchPrefix).toBe('feature/');
    });
  });

  describe('YAML Serialization Consistency', () => {
    it('should maintain config consistency through save/load cycles', async () => {
      const originalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'consistency-test',
          language: 'typescript'
        },
        secretScanning: {
          enabled: true,
          enforcementMode: 'audit',
          customPatterns: [],
          includeBuiltInPatterns: false,
          excludePaths: ['**/*.test.ts', 'fixtures/**']
        },
        git: {
          branchPrefix: 'test/',
          autoPush: false
        }
      };

      // Save original config
      await saveConfig(testDir, originalConfig);

      // Load it back
      const loadedConfig = await loadConfig(testDir);

      // Save again
      await saveConfig(testDir, loadedConfig);

      // Load again
      const reloadedConfig = await loadConfig(testDir);

      // Verify secretScanning section remains intact
      expect(reloadedConfig.secretScanning?.enabled).toBe(true);
      expect(reloadedConfig.secretScanning?.enforcementMode).toBe('audit');
      expect(reloadedConfig.secretScanning?.customPatterns).toEqual([]);
      expect(reloadedConfig.secretScanning?.includeBuiltInPatterns).toBe(false);
      expect(reloadedConfig.secretScanning?.excludePaths).toEqual(['**/*.test.ts', 'fixtures/**']);
    });

    it('should preserve YAML formatting for human readability', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'format-test' },
        secretScanning: {
          enabled: true,
          enforcementMode: 'warn',
          customPatterns: [],
          includeBuiltInPatterns: true,
          excludePaths: []
        }
      };

      await saveConfig(testDir, config);

      const yamlContent = await fs.readFile(
        path.join(testDir, '.apex', 'config.yaml'),
        'utf-8'
      );

      // Check that YAML structure is readable
      expect(yamlContent).toContain('secretScanning:');
      expect(yamlContent).toContain('enabled: true');
      expect(yamlContent).toContain('enforcementMode: warn');

      // Should be properly indented
      const lines = yamlContent.split('\n');
      const secretScanningLine = lines.findIndex(line => line.includes('secretScanning:'));
      const enabledLine = lines.findIndex(line => line.includes('enabled: true'));

      expect(secretScanningLine).toBeGreaterThan(-1);
      expect(enabledLine).toBeGreaterThan(secretScanningLine);
    });
  });

  describe('Default Initialization Integration', () => {
    it('should create proper secretScanning defaults during initialization', async () => {
      await initializeApex(testDir, {
        projectName: 'init-test',
        language: 'typescript',
        framework: 'react'
      });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      expect(await fs.access(configPath).then(() => true).catch(() => false)).toBe(true);

      const yamlContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(yamlContent);

      // Verify secretScanning section was created with proper defaults
      expect(config.secretScanning).toBeDefined();
      expect(config.secretScanning.enabled).toBe(true);
      expect(config.secretScanning.enforcementMode).toBe('warn');
      expect(config.secretScanning.customPatterns).toEqual([]);
      expect(config.secretScanning.includeBuiltInPatterns).toBe(true);
      expect(config.secretScanning.excludePaths).toEqual([]);

      // Verify it can be loaded properly
      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.secretScanning?.enforcementMode).toBe('warn');
    });

    it('should preserve existing config when loading after initialization', async () => {
      // Initialize with defaults
      await initializeApex(testDir, { projectName: 'preserve-test' });

      // Modify the config
      const loadedConfig = await loadConfig(testDir);
      const modifiedConfig: ApexConfig = {
        ...loadedConfig,
        secretScanning: {
          enabled: false,
          enforcementMode: 'block',
          customPatterns: [],
          includeBuiltInPatterns: false,
          excludePaths: ['custom-exclude/**']
        }
      };

      await saveConfig(testDir, modifiedConfig);

      // Load again and verify modifications are preserved
      const reloadedConfig = await loadConfig(testDir);
      expect(reloadedConfig.secretScanning?.enabled).toBe(false);
      expect(reloadedConfig.secretScanning?.enforcementMode).toBe('block');
      expect(reloadedConfig.secretScanning?.customPatterns).toEqual([]);
      expect(reloadedConfig.secretScanning?.includeBuiltInPatterns).toBe(false);
      expect(reloadedConfig.secretScanning?.excludePaths).toEqual(['custom-exclude/**']);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should provide meaningful error for malformed YAML with invalid enforcement mode', async () => {
      const malformedYaml = `version: '1.0'
project:
  name: malformed-test
secretScanning:
  enabled: true
  enforcementMode: invalid_mode
  customPatterns: []`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        malformedYaml
      );

      await expect(loadConfig(testDir))
        .rejects
        .toThrow(/Failed to load APEX config/);
    });

    it('should recover gracefully from partial config corruption', async () => {
      // First create a valid config
      await initializeApex(testDir, { projectName: 'recovery-test' });

      // Verify it loads properly
      let config = await loadConfig(testDir);
      expect(config.secretScanning?.enforcementMode).toBe('warn');

      // Restore a minimal valid config
      const minimalValidYaml = `version: '1.0'
project:
  name: recovery-test
secretScanning:
  enforcementMode: audit`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        minimalValidYaml
      );

      // Should load successfully with defaults applied
      config = await loadConfig(testDir);
      expect(config.secretScanning?.enforcementMode).toBe('audit');
      expect(config.secretScanning?.enabled).toBeUndefined(); // Will get default in effective config
    });
  });
});