import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  ApexConfigSchema,
  SecretScanningConfigSchema,
  SecretScanningEnforcementModeSchema,
  ApexConfig
} from '../types';
import { loadConfig, saveConfig, getEffectiveConfig, initializeApex } from '../config';

describe('SecretScanning Enforcement Mode Configuration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-enforcement-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Enforcement Mode Type Safety', () => {
    it('should enforce TypeScript types for enforcement mode', () => {
      // This test ensures the TypeScript types are properly exported and usable
      const validModes: Array<'warn' | 'block' | 'audit'> = ['warn', 'block', 'audit'];

      validModes.forEach(mode => {
        const config = {
          enforcementMode: mode
        };
        expect(() => SecretScanningConfigSchema.parse(config)).not.toThrow();
      });
    });

    it('should handle case sensitivity in enforcement modes', () => {
      const caseSensitiveTests = [
        { value: 'WARN', shouldFail: true },
        { value: 'Block', shouldFail: true },
        { value: 'AUDIT', shouldFail: true },
        { value: 'warn', shouldFail: false },
        { value: 'block', shouldFail: false },
        { value: 'audit', shouldFail: false },
      ];

      caseSensitiveTests.forEach(({ value, shouldFail }) => {
        const test = () => SecretScanningEnforcementModeSchema.parse(value);

        if (shouldFail) {
          expect(test).toThrow(`Case-sensitive mode '${value}' should be rejected`);
        } else {
          expect(test).not.toThrow(`Valid mode '${value}' should be accepted`);
        }
      });
    });
  });

  describe('Default Enforcement Mode Behavior', () => {
    it('should default to warn mode when not specified', () => {
      const config = {};
      const parsed = SecretScanningConfigSchema.parse(config);
      expect(parsed.enforcementMode).toBe('warn');
    });

    it('should preserve explicit enforcement mode setting', () => {
      const modes: Array<'warn' | 'block' | 'audit'> = ['warn', 'block', 'audit'];

      modes.forEach(mode => {
        const config = { enforcementMode: mode };
        const parsed = SecretScanningConfigSchema.parse(config);
        expect(parsed.enforcementMode).toBe(mode);
      });
    });

    it('should use default in initializeApex', async () => {
      await initializeApex(testDir, { projectName: 'test-enforcement' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(configContent);

      expect(config.secretScanning.enforcementMode).toBe('warn');
    });
  });

  describe('Config Loading and Saving with Enforcement Modes', () => {
    it('should correctly load all enforcement modes from YAML', async () => {
      const modes: Array<'warn' | 'block' | 'audit'> = ['warn', 'block', 'audit'];

      for (const mode of modes) {
        const configContent = {
          version: '1.0',
          project: { name: 'test-project' },
          secretScanning: {
            enabled: true,
            enforcementMode: mode,
            customPatterns: [],
            includeBuiltInPatterns: true,
            excludePaths: []
          }
        };

        await fs.writeFile(
          path.join(testDir, '.apex', 'config.yaml'),
          yaml.stringify(configContent)
        );

        const loadedConfig = await loadConfig(testDir);
        expect(loadedConfig.secretScanning?.enforcementMode).toBe(mode);
      }
    });

    it('should save enforcement modes correctly to YAML', async () => {
      const modes: Array<'warn' | 'block' | 'audit'> = ['warn', 'block', 'audit'];

      for (const mode of modes) {
        const config: ApexConfig = {
          version: '1.0',
          project: { name: 'test-project' },
          secretScanning: {
            enabled: true,
            enforcementMode: mode,
            customPatterns: [],
            includeBuiltInPatterns: true,
            excludePaths: []
          }
        };

        await saveConfig(testDir, config);

        const savedContent = await fs.readFile(
          path.join(testDir, '.apex', 'config.yaml'),
          'utf-8'
        );
        const parsedContent = yaml.parse(savedContent);

        expect(parsedContent.secretScanning.enforcementMode).toBe(mode);
      }
    });
  });

  describe('Effective Config with Enforcement Modes', () => {
    it('should apply default enforcement mode in effective config', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        secretScanning: {
          enabled: true
          // enforcementMode not specified
        }
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('warn');
    });

    it('should preserve custom enforcement mode in effective config', () => {
      const modes: Array<'warn' | 'block' | 'audit'> = ['warn', 'block', 'audit'];

      modes.forEach(mode => {
        const baseConfig: ApexConfig = {
          version: '1.0',
          project: { name: 'test-project' },
          secretScanning: {
            enabled: true,
            enforcementMode: mode
          }
        };

        const effectiveConfig = getEffectiveConfig(baseConfig);
        expect(effectiveConfig.secretScanning.enforcementMode).toBe(mode);
      });
    });

    it('should handle undefined secretScanning in effective config', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
        // no secretScanning section
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('warn');
    });
  });

  describe('Complex Configuration Scenarios', () => {
    it('should handle enforcement mode with all other options', () => {
      const complexConfig = {
        enabled: false,
        enforcementMode: 'block',
        customPatterns: [
          {
            name: 'API Key',
            pattern: 'API_[A-Z0-9]{32}',
            severity: 'critical',
            description: 'API key pattern'
          }
        ],
        includeBuiltInPatterns: false,
        excludePaths: ['test/**', '*.spec.ts', 'fixtures/**']
      };

      const parsed = SecretScanningConfigSchema.parse(complexConfig);

      expect(parsed.enabled).toBe(false);
      expect(parsed.enforcementMode).toBe('block');
      expect(parsed.customPatterns).toHaveLength(1);
      expect(parsed.includeBuiltInPatterns).toBe(false);
      expect(parsed.excludePaths).toHaveLength(3);
    });

    it('should handle enforcement mode with minimal config', () => {
      const minimalConfig = {
        enforcementMode: 'audit'
      };

      const parsed = SecretScanningConfigSchema.parse(minimalConfig);

      expect(parsed.enabled).toBe(true); // default
      expect(parsed.enforcementMode).toBe('audit');
      expect(parsed.customPatterns).toEqual([]); // default
      expect(parsed.includeBuiltInPatterns).toBe(true); // default
      expect(parsed.excludePaths).toEqual([]); // default
    });

    it('should handle config evolution - adding enforcement mode to existing config', async () => {
      // First, save a config without enforcement mode
      const oldConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        secretScanning: {
          enabled: true,
          customPatterns: [
            {
              name: 'Legacy Pattern',
              pattern: 'LEGACY_[A-Z]+',
              severity: 'medium'
            }
          ]
        }
      };

      await saveConfig(testDir, oldConfig);

      // Then load it back (should get default enforcement mode)
      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.secretScanning?.enforcementMode).toBeUndefined();

      // But effective config should have the default
      const effectiveConfig = getEffectiveConfig(loadedConfig);
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('warn');

      // Now update with explicit enforcement mode
      const updatedConfig: ApexConfig = {
        ...loadedConfig,
        secretScanning: {
          ...loadedConfig.secretScanning!,
          enforcementMode: 'block'
        }
      };

      await saveConfig(testDir, updatedConfig);

      // Load again and verify
      const finalConfig = await loadConfig(testDir);
      expect(finalConfig.secretScanning?.enforcementMode).toBe('block');
    });
  });

  describe('Error Scenarios', () => {
    it('should provide meaningful error messages for invalid enforcement modes', () => {
      const invalidValues = [
        'stop',
        'halt',
        'ignore',
        'log',
        'silent',
        'error',
        'throw',
        'reject'
      ];

      invalidValues.forEach(value => {
        expect(() => SecretScanningEnforcementModeSchema.parse(value))
          .toThrow(/Expected 'warn' | 'block' | 'audit'/);
      });
    });

    it('should handle null and undefined enforcement modes', () => {
      // null should be rejected
      expect(() => SecretScanningEnforcementModeSchema.parse(null))
        .toThrow();

      // undefined should be rejected
      expect(() => SecretScanningEnforcementModeSchema.parse(undefined))
        .toThrow();
    });

    it('should handle array and object enforcement modes', () => {
      // Array should be rejected
      expect(() => SecretScanningEnforcementModeSchema.parse(['warn']))
        .toThrow();

      // Object should be rejected
      expect(() => SecretScanningEnforcementModeSchema.parse({ mode: 'warn' }))
        .toThrow();
    });
  });

  describe('Integration with Existing Features', () => {
    it('should work correctly with custom patterns and enforcement modes', () => {
      const config = {
        enforcementMode: 'block',
        customPatterns: [
          {
            name: 'High Security Token',
            pattern: 'HST_[A-F0-9]{40}',
            severity: 'critical',
            description: 'High security token that should block operations'
          },
          {
            name: 'Low Priority Secret',
            pattern: 'LPS_\\w{16}',
            severity: 'low',
            description: 'Low priority secret'
          }
        ]
      };

      const parsed = SecretScanningConfigSchema.parse(config);
      expect(parsed.enforcementMode).toBe('block');
      expect(parsed.customPatterns).toHaveLength(2);
      expect(parsed.customPatterns[0].severity).toBe('critical');
      expect(parsed.customPatterns[1].severity).toBe('low');
    });

    it('should work correctly with exclude paths and enforcement modes', () => {
      const config = {
        enforcementMode: 'audit',
        excludePaths: [
          '**/*.test.ts',
          '__tests__/**',
          'test/fixtures/**/*.json',
          'docs/**/*.md',
          '.github/**'
        ]
      };

      const parsed = SecretScanningConfigSchema.parse(config);
      expect(parsed.enforcementMode).toBe('audit');
      expect(parsed.excludePaths).toHaveLength(5);
      expect(parsed.excludePaths).toContain('**/*.test.ts');
      expect(parsed.excludePaths).toContain('.github/**');
    });

    it('should handle disabled scanning with enforcement mode', () => {
      const config = {
        enabled: false,
        enforcementMode: 'block'
      };

      // Should be valid - you can configure enforcement mode even if scanning is disabled
      const parsed = SecretScanningConfigSchema.parse(config);
      expect(parsed.enabled).toBe(false);
      expect(parsed.enforcementMode).toBe('block');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should handle configs created before enforcement mode was added', async () => {
      // Create a minimal old-style config
      const oldStyleConfig = {
        version: '1.0',
        project: { name: 'legacy-project' },
        secretScanning: {
          enabled: true,
          customPatterns: [],
          includeBuiltInPatterns: true,
          excludePaths: []
        }
      };

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        yaml.stringify(oldStyleConfig)
      );

      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Should load without errors and provide default enforcement mode
      expect(effectiveConfig.secretScanning.enabled).toBe(true);
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('warn');
    });

    it('should handle partial secretScanning configs', () => {
      const partialConfigs = [
        { enabled: true },
        { enforcementMode: 'block' },
        { customPatterns: [] },
        { includeBuiltInPatterns: false },
        { excludePaths: ['test/**'] }
      ];

      partialConfigs.forEach(partialConfig => {
        const parsed = SecretScanningConfigSchema.parse(partialConfig);

        // All should parse successfully with defaults applied
        expect(parsed).toBeDefined();
        expect(parsed.enforcementMode).toBeDefined();
        expect(['warn', 'block', 'audit']).toContain(parsed.enforcementMode);
      });
    });
  });
});