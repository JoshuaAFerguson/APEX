import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { initializeApex, getEffectiveConfig, loadConfig } from '../config';
import { ApexConfig } from '../types';

describe('SecretScanning Functions Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-functions-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('initializeApex Function', () => {
    it('should create secretScanning config with proper defaults', async () => {
      await initializeApex(testDir, {
        projectName: 'test-init-project',
        language: 'typescript',
        framework: 'react'
      });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(configContent);

      // Verify secretScanning section exists with correct defaults
      expect(config.secretScanning).toBeDefined();
      expect(config.secretScanning.enabled).toBe(true);
      expect(config.secretScanning.enforcementMode).toBe('warn');
      expect(config.secretScanning.customPatterns).toEqual([]);
      expect(config.secretScanning.includeBuiltInPatterns).toBe(true);
      expect(config.secretScanning.excludePaths).toEqual([]);
    });

    it('should create config that loads correctly', async () => {
      await initializeApex(testDir, {
        projectName: 'test-load-project'
      });

      // Verify the created config can be loaded without errors
      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.secretScanning).toBeDefined();
      expect(loadedConfig.secretScanning?.enabled).toBe(true);
      expect(loadedConfig.secretScanning?.enforcementMode).toBe('warn');
    });

    it('should create config with all required APEX directories', async () => {
      await initializeApex(testDir, {
        projectName: 'test-directories',
        language: 'javascript'
      });

      // Check that all required directories were created
      const apexDir = path.join(testDir, '.apex');
      const agentsDir = path.join(apexDir, 'agents');
      const workflowsDir = path.join(apexDir, 'workflows');
      const skillsDir = path.join(apexDir, 'skills');
      const scriptsDir = path.join(apexDir, 'scripts');

      expect(await fs.access(apexDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(agentsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(workflowsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(skillsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(scriptsDir).then(() => true).catch(() => false)).toBe(true);

      // Verify config still has secretScanning
      const config = await loadConfig(testDir);
      expect(config.secretScanning?.enforcementMode).toBe('warn');
    });

    it('should create config with consistent structure across different project types', async () => {
      const projectTypes = [
        { language: 'typescript', framework: 'react' },
        { language: 'javascript', framework: 'vue' },
        { language: 'python' },
        { language: 'typescript', framework: 'next' }
      ];

      for (const projectType of projectTypes) {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-type-test-'));

        try {
          await initializeApex(tempDir, {
            projectName: `test-${projectType.language}-project`,
            ...projectType
          });

          const config = await loadConfig(tempDir);

          // secretScanning should be consistent regardless of project type
          expect(config.secretScanning?.enabled).toBe(true);
          expect(config.secretScanning?.enforcementMode).toBe('warn');
          expect(config.secretScanning?.customPatterns).toEqual([]);
          expect(config.secretScanning?.includeBuiltInPatterns).toBe(true);
          expect(config.secretScanning?.excludePaths).toEqual([]);
        } finally {
          await fs.rm(tempDir, { recursive: true, force: true });
        }
      }
    });
  });

  describe('getEffectiveConfig Function', () => {
    it('should apply secretScanning defaults when section is missing', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
        // no secretScanning section
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      expect(effectiveConfig.secretScanning).toBeDefined();
      expect(effectiveConfig.secretScanning.enabled).toBe(true);
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('warn');
      expect(effectiveConfig.secretScanning.customPatterns).toEqual([]);
      expect(effectiveConfig.secretScanning.includeBuiltInPatterns).toBe(true);
      expect(effectiveConfig.secretScanning.excludePaths).toEqual([]);
    });

    it('should preserve custom secretScanning config', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        secretScanning: {
          enabled: false,
          enforcementMode: 'block',
          customPatterns: [],
          includeBuiltInPatterns: false,
          excludePaths: ['test/**']
        }
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      expect(effectiveConfig.secretScanning.enabled).toBe(false);
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('block');
      expect(effectiveConfig.secretScanning.customPatterns).toEqual([]);
      expect(effectiveConfig.secretScanning.includeBuiltInPatterns).toBe(false);
      expect(effectiveConfig.secretScanning.excludePaths).toEqual(['test/**']);
    });

    it('should merge partial secretScanning config with defaults', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        secretScanning: {
          enforcementMode: 'audit'
          // other fields missing
        }
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      expect(effectiveConfig.secretScanning.enabled).toBe(true); // default
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('audit'); // specified
      expect(effectiveConfig.secretScanning.customPatterns).toEqual([]); // default
      expect(effectiveConfig.secretScanning.includeBuiltInPatterns).toBe(true); // default
      expect(effectiveConfig.secretScanning.excludePaths).toEqual([]); // default
    });

    it('should handle all enforcement modes in effective config', () => {
      const modes: Array<'warn' | 'block' | 'audit'> = ['warn', 'block', 'audit'];

      modes.forEach(mode => {
        const baseConfig: ApexConfig = {
          version: '1.0',
          project: { name: 'test-project' },
          secretScanning: {
            enforcementMode: mode
          }
        };

        const effectiveConfig = getEffectiveConfig(baseConfig);
        expect(effectiveConfig.secretScanning.enforcementMode).toBe(mode);
      });
    });

    it('should preserve other config sections while adding secretScanning defaults', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          language: 'typescript'
        },
        git: {
          branchPrefix: 'feature/',
          autoPush: false
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet'
        }
        // no secretScanning
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      // Verify secretScanning was added
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('warn');

      // Verify other sections were preserved
      expect(effectiveConfig.project.language).toBe('typescript');
      expect(effectiveConfig.git.branchPrefix).toBe('feature/');
      expect(effectiveConfig.git.autoPush).toBe(false);
      expect(effectiveConfig.models.planning).toBe('opus');
      expect(effectiveConfig.models.implementation).toBe('sonnet');
    });

    it('should handle complex config structures with secretScanning', () => {
      const complexConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'complex-project' },
        autonomy: {
          level: 'review-before-commit',
          limits: {
            maxCost: 50.0,
            maxTokens: 100000
          }
        },
        secretScanning: {
          enabled: true,
          enforcementMode: 'audit',
          excludePaths: ['node_modules/**', '.git/**']
        },
        permissions: {
          preset: 'review-all'
        },
        policy: {
          enforcement: 'warn',
          enabled: true
        }
      };

      const effectiveConfig = getEffectiveConfig(complexConfig);

      // Verify secretScanning section
      expect(effectiveConfig.secretScanning.enabled).toBe(true);
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('audit');
      expect(effectiveConfig.secretScanning.excludePaths).toEqual(['node_modules/**', '.git/**']);
      expect(effectiveConfig.secretScanning.customPatterns).toEqual([]); // default
      expect(effectiveConfig.secretScanning.includeBuiltInPatterns).toBe(true); // default

      // Verify other sections remain intact
      expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveConfig.autonomy.limits?.maxCost).toBe(50.0);
      expect(effectiveConfig.permissions.preset).toBe('review-all');
      expect(effectiveConfig.policy.enforcement).toBe('warn');
    });
  });

  describe('Integration between initializeApex and getEffectiveConfig', () => {
    it('should produce consistent results', async () => {
      await initializeApex(testDir, { projectName: 'integration-test' });

      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Both should have the same secretScanning configuration
      expect(loadedConfig.secretScanning?.enforcementMode).toBe('warn');
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('warn');

      expect(loadedConfig.secretScanning?.enabled).toBe(true);
      expect(effectiveConfig.secretScanning.enabled).toBe(true);

      expect(loadedConfig.secretScanning?.customPatterns).toEqual([]);
      expect(effectiveConfig.secretScanning.customPatterns).toEqual([]);

      expect(loadedConfig.secretScanning?.includeBuiltInPatterns).toBe(true);
      expect(effectiveConfig.secretScanning.includeBuiltInPatterns).toBe(true);

      expect(loadedConfig.secretScanning?.excludePaths).toEqual([]);
      expect(effectiveConfig.secretScanning.excludePaths).toEqual([]);
    });

    it('should handle config modifications correctly', async () => {
      await initializeApex(testDir, { projectName: 'modification-test' });

      // Load and modify config
      const originalConfig = await loadConfig(testDir);
      const modifiedConfig: ApexConfig = {
        ...originalConfig,
        secretScanning: {
          enabled: false,
          enforcementMode: 'block',
          customPatterns: [],
          includeBuiltInPatterns: false,
          excludePaths: ['custom/**']
        }
      };

      // Get effective config of modified version
      const effectiveConfig = getEffectiveConfig(modifiedConfig);

      // Should reflect the modifications
      expect(effectiveConfig.secretScanning.enabled).toBe(false);
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('block');
      expect(effectiveConfig.secretScanning.includeBuiltInPatterns).toBe(false);
      expect(effectiveConfig.secretScanning.excludePaths).toEqual(['custom/**']);
    });
  });
});