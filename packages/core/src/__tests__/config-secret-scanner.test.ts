import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  ApexConfigSchema,
  SecretScannerConfigSchema,
  SecretDetectionBehaviorSchema,
  SecretPatternSchema,
  ApexConfig
} from '../types';
import { loadConfig, saveConfig, getEffectiveConfig, initializeApex } from '../config';

describe('SecretScanner Configuration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-secret-scanner-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('SecretScannerConfigSchema Validation', () => {
    it('should accept valid SecretScanner configurations', () => {
      const validConfigs = [
        {
          onSecretDetected: 'warn',
          maskSecrets: true,
          includeBuiltInPatterns: true,
          customPatterns: [],
          maxLineLength: 10000,
          contextLength: 20,
        },
        {
          onSecretDetected: 'log',
          maskSecrets: false,
          includeBuiltInPatterns: false,
          customPatterns: [
            {
              name: 'Test API Key',
              pattern: 'TEST_[A-Z0-9]{16}',
              severity: 'high',
              description: 'Test API key pattern'
            }
          ],
          maxLineLength: 5000,
          contextLength: 10,
        },
        {
          onSecretDetected: 'block',
        },
        {
          onSecretDetected: 'mask',
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
        expect(() => SecretScannerConfigSchema.parse(config))
          .not.toThrow(`Valid SecretScanner config ${index} should parse successfully`);
      });
    });

    it('should apply default values correctly', () => {
      const emptyConfig = {};
      const parsed = SecretScannerConfigSchema.parse(emptyConfig);

      expect(parsed.onSecretDetected).toBe('warn');
      expect(parsed.maskSecrets).toBe(true);
      expect(parsed.includeBuiltInPatterns).toBe(true);
      expect(parsed.customPatterns).toEqual([]);
      expect(parsed.maxLineLength).toBe(10000);
      expect(parsed.contextLength).toBe(20);
    });

    it('should reject invalid onSecretDetected values', () => {
      const invalidConfigs = [
        { onSecretDetected: 'invalid' },
        { onSecretDetected: 'error' },
        { onSecretDetected: 'throw' },
        { onSecretDetected: '' },
        { onSecretDetected: null },
        { onSecretDetected: 123 },
      ];

      invalidConfigs.forEach((config, index) => {
        expect(() => SecretScannerConfigSchema.parse(config))
          .toThrow(`Invalid onSecretDetected config ${index} should be rejected`);
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
        expect(() => SecretScannerConfigSchema.parse(config))
          .toThrow(`Invalid custom pattern config ${index} should be rejected`);
      });
    });

    it('should accept valid pattern severities', () => {
      const validSeverities = ['critical', 'high', 'medium', 'low'];

      validSeverities.forEach(severity => {
        const config = {
          customPatterns: [
            {
              name: 'Test Pattern',
              pattern: 'TEST_.*',
              severity: severity as any,
            }
          ]
        };

        expect(() => SecretScannerConfigSchema.parse(config))
          .not.toThrow(`Severity '${severity}' should be valid`);
      });
    });
  });

  describe('SecretDetectionBehaviorSchema Validation', () => {
    it('should accept all valid behavior values', () => {
      const validBehaviors = ['log', 'warn', 'mask', 'block'];

      validBehaviors.forEach(behavior => {
        expect(() => SecretDetectionBehaviorSchema.parse(behavior))
          .not.toThrow(`Behavior '${behavior}' should be valid`);
      });
    });

    it('should reject invalid behavior values', () => {
      const invalidBehaviors = ['error', 'throw', 'ignore', '', null, undefined, 123];

      invalidBehaviors.forEach(behavior => {
        expect(() => SecretDetectionBehaviorSchema.parse(behavior))
          .toThrow(`Behavior '${behavior}' should be rejected`);
      });
    });
  });

  describe('SecretPatternSchema Validation', () => {
    it('should validate required fields', () => {
      const validPattern = {
        name: 'Test Pattern',
        pattern: 'TEST_[A-Z0-9]+'
      };

      expect(() => SecretPatternSchema.parse(validPattern))
        .not.toThrow('Valid pattern should parse');
    });

    it('should apply default severity', () => {
      const pattern = {
        name: 'Test Pattern',
        pattern: 'TEST_.*'
      };

      const parsed = SecretPatternSchema.parse(pattern);
      expect(parsed.severity).toBe('medium');
    });

    it('should accept optional description', () => {
      const pattern = {
        name: 'Test Pattern',
        pattern: 'TEST_.*',
        description: 'A test pattern for validation'
      };

      const parsed = SecretPatternSchema.parse(pattern);
      expect(parsed.description).toBe('A test pattern for validation');
    });

    it('should reject patterns missing required fields', () => {
      const invalidPatterns = [
        { pattern: 'TEST_.*' },  // missing name
        { name: 'Test' },        // missing pattern
        {},                      // missing both
      ];

      invalidPatterns.forEach((pattern, index) => {
        expect(() => SecretPatternSchema.parse(pattern))
          .toThrow(`Invalid pattern ${index} should be rejected`);
      });
    });
  });

  describe('APEX Config with SecretScanner', () => {
    it('should parse config with SecretScanner section', async () => {
      const configWithScanner = {
        version: '1.0',
        project: { name: 'test-project' },
        scanner: {
          onSecretDetected: 'warn',
          maskSecrets: true,
          customPatterns: [
            {
              name: 'API Key Pattern',
              pattern: 'API_[A-Z0-9]{32}',
              severity: 'high'
            }
          ]
        }
      };

      expect(() => ApexConfigSchema.parse(configWithScanner))
        .not.toThrow('Config with scanner section should be valid');

      const parsed = ApexConfigSchema.parse(configWithScanner);
      expect(parsed.scanner).toBeDefined();
      expect(parsed.scanner!.onSecretDetected).toBe('warn');
      expect(parsed.scanner!.maskSecrets).toBe(true);
      expect(parsed.scanner!.customPatterns).toHaveLength(1);
    });

    it('should parse config without SecretScanner section', async () => {
      const configWithoutScanner = {
        version: '1.0',
        project: { name: 'test-project' }
      };

      const parsed = ApexConfigSchema.parse(configWithoutScanner);
      expect(parsed.scanner).toBeUndefined();
    });

    it('should load config from YAML file with SecretScanner', async () => {
      const configContent = {
        version: '1.0',
        project: { name: 'test-project' },
        scanner: {
          onSecretDetected: 'block',
          maskSecrets: false,
          includeBuiltInPatterns: false,
          customPatterns: [
            {
              name: 'Custom Secret',
              pattern: 'CUSTOM_[0-9A-F]{16}',
              severity: 'critical',
              description: 'Custom secret pattern'
            }
          ],
          maxLineLength: 8000,
          contextLength: 15
        }
      };

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        yaml.stringify(configContent)
      );

      const loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.scanner).toBeDefined();
      expect(loadedConfig.scanner!.onSecretDetected).toBe('block');
      expect(loadedConfig.scanner!.maskSecrets).toBe(false);
      expect(loadedConfig.scanner!.includeBuiltInPatterns).toBe(false);
      expect(loadedConfig.scanner!.maxLineLength).toBe(8000);
      expect(loadedConfig.scanner!.contextLength).toBe(15);
      expect(loadedConfig.scanner!.customPatterns).toHaveLength(1);
      expect(loadedConfig.scanner!.customPatterns[0].name).toBe('Custom Secret');
    });

    it('should save config with SecretScanner section', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        scanner: {
          onSecretDetected: 'mask',
          maskSecrets: true,
          includeBuiltInPatterns: true,
          customPatterns: [
            {
              name: 'Token Pattern',
              pattern: 'TOKEN_[A-Za-z0-9]{24}',
              severity: 'high'
            }
          ],
          maxLineLength: 12000,
          contextLength: 25
        }
      };

      await saveConfig(testDir, config);

      const savedContent = await fs.readFile(
        path.join(testDir, '.apex', 'config.yaml'),
        'utf-8'
      );
      const parsedContent = yaml.parse(savedContent);

      expect(parsedContent.scanner).toBeDefined();
      expect(parsedContent.scanner.onSecretDetected).toBe('mask');
      expect(parsedContent.scanner.customPatterns).toHaveLength(1);
    });
  });

  describe('Effective Config with SecretScanner', () => {
    it('should apply SecretScanner defaults in effective config', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      expect(effectiveConfig.scanner).toBeDefined();
      expect(effectiveConfig.scanner.onSecretDetected).toBe('warn');
      expect(effectiveConfig.scanner.maskSecrets).toBe(true);
      expect(effectiveConfig.scanner.includeBuiltInPatterns).toBe(true);
      expect(effectiveConfig.scanner.customPatterns).toEqual([]);
      expect(effectiveConfig.scanner.maxLineLength).toBe(10000);
      expect(effectiveConfig.scanner.contextLength).toBe(20);
    });

    it('should preserve custom SecretScanner config in effective config', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        scanner: {
          onSecretDetected: 'log',
          maskSecrets: false,
          includeBuiltInPatterns: false,
          customPatterns: [
            {
              name: 'Test Pattern',
              pattern: 'TEST_\\w+',
              severity: 'low'
            }
          ],
          maxLineLength: 5000,
          contextLength: 10
        }
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      expect(effectiveConfig.scanner.onSecretDetected).toBe('log');
      expect(effectiveConfig.scanner.maskSecrets).toBe(false);
      expect(effectiveConfig.scanner.includeBuiltInPatterns).toBe(false);
      expect(effectiveConfig.scanner.customPatterns).toHaveLength(1);
      expect(effectiveConfig.scanner.maxLineLength).toBe(5000);
      expect(effectiveConfig.scanner.contextLength).toBe(10);
    });

    it('should merge partial SecretScanner config with defaults', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        scanner: {
          onSecretDetected: 'block',
          customPatterns: [
            {
              name: 'Partial Pattern',
              pattern: 'PARTIAL_.*'
            }
          ]
        }
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);

      expect(effectiveConfig.scanner.onSecretDetected).toBe('block');
      expect(effectiveConfig.scanner.maskSecrets).toBe(true); // default
      expect(effectiveConfig.scanner.includeBuiltInPatterns).toBe(true); // default
      expect(effectiveConfig.scanner.customPatterns).toHaveLength(1);
      expect(effectiveConfig.scanner.customPatterns[0].severity).toBe('medium'); // pattern default
      expect(effectiveConfig.scanner.maxLineLength).toBe(10000); // default
      expect(effectiveConfig.scanner.contextLength).toBe(20); // default
    });
  });

  describe('Initialize APEX with SecretScanner defaults', () => {
    it('should not include SecretScanner in default initialization', async () => {
      await initializeApex(testDir, { projectName: 'test-project' });

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(configContent);

      // SecretScanner should not be in the default config
      expect(config.scanner).toBeUndefined();

      // But the effective config should include defaults
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);
      expect(effectiveConfig.scanner).toBeDefined();
      expect(effectiveConfig.scanner.onSecretDetected).toBe('warn');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty custom patterns array', () => {
      const config = {
        customPatterns: []
      };

      const parsed = SecretScannerConfigSchema.parse(config);
      expect(parsed.customPatterns).toEqual([]);
    });

    it('should handle numeric values for boolean fields', () => {
      expect(() => SecretScannerConfigSchema.parse({ maskSecrets: 1 }))
        .toThrow('Numeric values should be rejected for boolean fields');

      expect(() => SecretScannerConfigSchema.parse({ includeBuiltInPatterns: 0 }))
        .toThrow('Numeric values should be rejected for boolean fields');
    });

    it('should handle string values for numeric fields', () => {
      expect(() => SecretScannerConfigSchema.parse({ maxLineLength: "10000" }))
        .toThrow('String values should be rejected for numeric fields');

      expect(() => SecretScannerConfigSchema.parse({ contextLength: "20" }))
        .toThrow('String values should be rejected for numeric fields');
    });

    it('should validate negative numbers appropriately', () => {
      expect(() => SecretScannerConfigSchema.parse({ maxLineLength: -1 }))
        .not.toThrow('Negative maxLineLength should be allowed');

      expect(() => SecretScannerConfigSchema.parse({ contextLength: -5 }))
        .not.toThrow('Negative contextLength should be allowed');
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

      const parsed = SecretScannerConfigSchema.parse(complexConfig);
      expect(parsed.customPatterns).toHaveLength(3);
      expect(parsed.customPatterns[2].severity).toBe('medium');
      expect(parsed.customPatterns[2].description).toBeUndefined();
    });
  });
});