import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  ApexConfigSchema,
  SecretScanningConfigSchema,
  SecretScanningEnforcementModeSchema,
  SecretPatternSchema,
  ApexConfig
} from '../types';
import { loadConfig, saveConfig, getEffectiveConfig, initializeApex } from '../config';

describe('SecretScanning Configuration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-secret-scanning-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('SecretScanningConfigSchema Validation', () => {
    it('should accept valid SecretScanning configurations', () => {
      const validConfigs = [
        {
          enabled: true,
          enforcementMode: 'warn',
          customPatterns: [],
          includeBuiltInPatterns: true,
          excludePaths: [],
        },
        {
          enabled: false,
          enforcementMode: 'block',
          customPatterns: [
            {
              name: 'Test API Key',
              pattern: 'TEST_[A-Z0-9]{16}',
              severity: 'high',
              description: 'Test API key pattern'
            }
          ],
          includeBuiltInPatterns: false,
          excludePaths: ['*.test.ts', 'fixtures/**'],
        },
        {
          enabled: true,
          enforcementMode: 'audit',
          customPatterns: [
            {
              name: 'Simple Pattern',
              pattern: 'SECRET_\\d+',
            }
          ],
        },
        {}  // Empty config should use all defaults
      ];

      validConfigs.forEach((config, index) => {
        expect(() => SecretScanningConfigSchema.parse(config))
          .not.toThrow(`Valid SecretScanning config ${index} should parse successfully`);
      });
    });

    it('should apply default values correctly', () => {
      const emptyConfig = {};
      const parsed = SecretScanningConfigSchema.parse(emptyConfig);

      expect(parsed.enabled).toBe(true);
      expect(parsed.enforcementMode).toBe('warn');
      expect(parsed.customPatterns).toEqual([]);
      expect(parsed.includeBuiltInPatterns).toBe(true);
      expect(parsed.excludePaths).toEqual([]);
    });

    it('should reject invalid enforcementMode values', () => {
      const invalidConfigs = [
        { enforcementMode: 'invalid' },
        { enforcementMode: 'error' },
        { enforcementMode: 'throw' },
        { enforcementMode: '' },
        { enforcementMode: null },
        { enforcementMode: 123 },
      ];

      invalidConfigs.forEach((config, index) => {
        expect(() => SecretScanningConfigSchema.parse(config))
          .toThrow(`Invalid enforcementMode config ${index} should be rejected`);
      });
    });

    it('should validate custom patterns correctly', () => {
      const invalidPatternConfigs = [
        {
          customPatterns: [
            {
              // missing name
              pattern: 'test',
            }
          ]
        },
        {
          customPatterns: [
            {
              name: 'Test',
              // missing pattern
            }
          ]
        },
        {
          customPatterns: [
            {
              name: 'Test',
              pattern: 'test',
              severity: 'invalid'  // invalid severity
            }
          ]
        },
      ];

      invalidPatternConfigs.forEach((config, index) => {
        expect(() => SecretScanningConfigSchema.parse(config))
          .toThrow(`Invalid custom pattern config ${index} should be rejected`);
      });
    });

    it('should accept valid enforcement modes', () => {
      const validModes = ['warn', 'block', 'audit'];

      validModes.forEach(mode => {
        const config = {
          enforcementMode: mode as any,
        };

        expect(() => SecretScanningConfigSchema.parse(config))
          .not.toThrow(`Enforcement mode '${mode}' should be valid`);
      });
    });
  });

  describe('SecretScanningEnforcementModeSchema Validation', () => {
    it('should accept all valid enforcement mode values', () => {
      const validModes = ['warn', 'block', 'audit'];

      validModes.forEach(mode => {
        expect(() => SecretScanningEnforcementModeSchema.parse(mode))
          .not.toThrow(`Enforcement mode '${mode}' should be valid`);
      });
    });

    it('should reject invalid enforcement mode values', () => {
      const invalidModes = ['error', 'throw', 'ignore', '', null, undefined, 123];

      invalidModes.forEach(mode => {
        expect(() => SecretScanningEnforcementModeSchema.parse(mode))
          .toThrow(`Enforcement mode '${mode}' should be rejected`);
      });
    });
  });

  describe('APEX Config with SecretScanning', () => {
    it('should parse config with SecretScanning section', async () => {
      const configWithSecretScanning = {
        version: '1.0',
        project: { name: 'test-project' },
        secretScanning: {
          enabled: true,
          enforcementMode: 'warn',
          customPatterns: [
            {
              name: 'API Key Pattern',
              pattern: 'API_[A-Z0-9]{32}',
              severity: 'high'
            }
          ],
          includeBuiltInPatterns: true,
          excludePaths: ['*.test.ts']
        }
      };

      expect(() => ApexConfigSchema.parse(configWithSecretScanning))
        .not.toThrow('Config with secretScanning section should be valid');

      const parsed = ApexConfigSchema.parse(configWithSecretScanning);
      expect(parsed.secretScanning).toBeDefined();
      expect(parsed.secretScanning!.enabled).toBe(true);
      expect(parsed.secretScanning!.enforcementMode).toBe('warn');
      expect(parsed.secretScanning!.customPatterns).toHaveLength(1);
      expect(parsed.secretScanning!.includeBuiltInPatterns).toBe(true);
      expect(parsed.secretScanning!.excludePaths).toEqual(['*.test.ts']);
    });

    it('should parse config without SecretScanning section', async () => {
      const configWithoutSecretScanning = {
        version: '1.0',
        project: { name: 'test-project' }
      };

      const parsed = ApexConfigSchema.parse(configWithoutSecretScanning);
      expect(parsed.secretScanning).toBeUndefined();
    });

    it('should load config from YAML file with SecretScanning', async () => {
      const configContent = {
        version: '1.0',
        project: { name: 'test-project' },
        secretScanning: {
          enabled: false,
          enforcementMode: 'block',
          customPatterns: [
            {
              name: 'Custom Secret',
              pattern: 'CUSTOM_[0-9A-F]{16}',
              severity: 'critical',
              description: 'Custom secret pattern'
            }
          ],
          includeBuiltInPatterns: false,
          excludePaths: ['test/**', '*.spec.ts']
        }
      };

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        yaml.stringify(configContent)
      );

      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.secretScanning).toBeDefined();
      expect(loadedConfig.secretScanning!.enabled).toBe(false);
      expect(loadedConfig.secretScanning!.enforcementMode).toBe('block');
      expect(loadedConfig.secretScanning!.includeBuiltInPatterns).toBe(false);
      expect(loadedConfig.secretScanning!.customPatterns).toHaveLength(1);
      expect(loadedConfig.secretScanning!.excludePaths).toEqual(['test/**', '*.spec.ts']);
    });

    it('should save config with SecretScanning section', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        secretScanning: {
          enabled: true,
          enforcementMode: 'audit',
          customPatterns: [
            {
              name: 'Token Pattern',
              pattern: 'TOKEN_[A-Za-z0-9]{24}',
              severity: 'high'
            }
          ],
          includeBuiltInPatterns: true,
          excludePaths: ['docs/**']
        }
      };

      await saveConfig(testDir, config);

      const savedContent = await fs.readFile(
        path.join(testDir, '.apex', 'config.yaml'),
        'utf-8'
      );
      const parsedContent = yaml.parse(savedContent);

      expect(parsedContent.secretScanning).toBeDefined();
      expect(parsedContent.secretScanning.enabled).toBe(true);
      expect(parsedContent.secretScanning.enforcementMode).toBe('audit');
      expect(parsedContent.secretScanning.customPatterns).toHaveLength(1);
    });
  });

  describe('Effective Config with SecretScanning', () => {
    it('should apply SecretScanning defaults in effective config', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      expect(effectiveConfig.secretScanning).toBeDefined();
      expect(effectiveConfig.secretScanning.enabled).toBe(true);
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('warn');
      expect(effectiveConfig.secretScanning.customPatterns).toEqual([]);
      expect(effectiveConfig.secretScanning.includeBuiltInPatterns).toBe(true);
      expect(effectiveConfig.secretScanning.excludePaths).toEqual([]);
    });

    it('should preserve custom SecretScanning config in effective config', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        secretScanning: {
          enabled: false,
          enforcementMode: 'block',
          customPatterns: [
            {
              name: 'Test Pattern',
              pattern: 'TEST_\\w+',
              severity: 'low'
            }
          ],
          includeBuiltInPatterns: false,
          excludePaths: ['test/**', 'fixtures/**']
        }
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      expect(effectiveConfig.secretScanning.enabled).toBe(false);
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('block');
      expect(effectiveConfig.secretScanning.customPatterns).toHaveLength(1);
      expect(effectiveConfig.secretScanning.includeBuiltInPatterns).toBe(false);
      expect(effectiveConfig.secretScanning.excludePaths).toEqual(['test/**', 'fixtures/**']);
    });

    it('should merge partial SecretScanning config with defaults', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        secretScanning: {
          enforcementMode: 'block',
          customPatterns: [
            {
              name: 'Partial Pattern',
              pattern: 'PARTIAL_.*'
            }
          ]
        }
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      expect(effectiveConfig.secretScanning.enabled).toBe(true); // default
      expect(effectiveConfig.secretScanning.enforcementMode).toBe('block');
      expect(effectiveConfig.secretScanning.customPatterns).toHaveLength(1);
      expect(effectiveConfig.secretScanning.customPatterns[0].severity).toBe('medium'); // pattern default
      expect(effectiveConfig.secretScanning.includeBuiltInPatterns).toBe(true); // default
      expect(effectiveConfig.secretScanning.excludePaths).toEqual([]); // default
    });
  });

  describe('Initialize APEX with SecretScanning defaults', () => {
    it('should include SecretScanning in default initialization', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(configContent);

      // SecretScanning should be in the default config
      expect(config.secretScanning).toBeDefined();
      expect(config.secretScanning.enabled).toBe(true);
      expect(config.secretScanning.enforcementMode).toBe('warn');
      expect(config.secretScanning.customPatterns).toEqual([]);
      expect(config.secretScanning.includeBuiltInPatterns).toBe(true);
      expect(config.secretScanning.excludePaths).toEqual([]);

      // The effective config should also include it
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);
      expect(effectiveConfig.secretScanning).toBeDefined();
      expect(effectiveConfig.secretScanning.enabled).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty custom patterns array', () => {
      const config = {
        customPatterns: []
      };

      const parsed = SecretScanningConfigSchema.parse(config);
      expect(parsed.customPatterns).toEqual([]);
    });

    it('should handle empty exclude paths array', () => {
      const config = {
        excludePaths: []
      };

      const parsed = SecretScanningConfigSchema.parse(config);
      expect(parsed.excludePaths).toEqual([]);
    });

    it('should handle numeric values for boolean fields', () => {
      expect(() => SecretScanningConfigSchema.parse({ enabled: 1 }))
        .toThrow('Numeric values should be rejected for boolean fields');

      expect(() => SecretScanningConfigSchema.parse({ includeBuiltInPatterns: 0 }))
        .toThrow('Numeric values should be rejected for boolean fields');
    });

    it('should handle array vs string for excludePaths', () => {
      // Should accept array
      const configWithArray = {
        excludePaths: ['test/**', '*.spec.ts']
      };
      expect(() => SecretScanningConfigSchema.parse(configWithArray))
        .not.toThrow('Array excludePaths should be valid');

      // Should reject string
      expect(() => SecretScanningConfigSchema.parse({ excludePaths: 'test/**' }))
        .toThrow('String excludePaths should be rejected');
    });

    it('should handle complex custom pattern configurations', () => {
      const complexConfig = {
        customPatterns: [
          {
            name: 'AWS Access Key',
            pattern: 'AKIA[0-9A-Z]{16}',
            severity: 'critical',
            description: 'AWS Access Key identifier'
          },
          {
            name: 'JWT Token',
            pattern: 'eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*',
            severity: 'high',
            description: 'JSON Web Token'
          },
          {
            name: 'Simple Secret',
            pattern: 'secret_[a-z0-9]+',
            // severity should default to 'medium'
            // description is optional
          }
        ]
      };

      const parsed = SecretScanningConfigSchema.parse(complexConfig);
      expect(parsed.customPatterns).toHaveLength(3);
      expect(parsed.customPatterns[2].severity).toBe('medium');
      expect(parsed.customPatterns[2].description).toBeUndefined();
    });

    it('should handle complex exclude path patterns', () => {
      const config = {
        excludePaths: [
          '*.test.ts',
          '**/*.spec.js',
          'node_modules/**',
          '.git/**',
          'coverage/**',
          'dist/**',
          '__tests__/**',
          'test/fixtures/**/*.json'
        ]
      };

      const parsed = SecretScanningConfigSchema.parse(config);
      expect(parsed.excludePaths).toHaveLength(8);
      expect(parsed.excludePaths).toContain('*.test.ts');
      expect(parsed.excludePaths).toContain('test/fixtures/**/*.json');
    });
  });
});