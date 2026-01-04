import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { loadConfig, getEffectiveConfig } from '../config';

describe('SecretScanner Configuration Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-scanner-integration-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should load and parse SecretScanner config from YAML', async () => {
    const configContent = {
      version: '1.0',
      project: { name: 'test-project' },
      scanner: {
        onSecretDetected: 'warn',
        maskSecrets: true,
        customPatterns: [
          {
            name: 'Test Pattern',
            pattern: 'TEST_[0-9A-F]+',
            severity: 'high'
          }
        ]
      }
    };

    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      yaml.stringify(configContent)
    );

    const config = await loadConfig(testDir);
    expect(config.scanner).toBeDefined();
    expect(config.scanner?.onSecretDetected).toBe('warn');
    expect(config.scanner?.maskSecrets).toBe(true);
    expect(config.scanner?.customPatterns).toHaveLength(1);
  });

  it('should apply SecretScanner defaults in effective config', async () => {
    const basicConfig = {
      version: '1.0',
      project: { name: 'test-project' }
    };

    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      yaml.stringify(basicConfig)
    );

    const config = await loadConfig(testDir);
    const effectiveConfig = getEffectiveConfig(config);

    expect(effectiveConfig.scanner).toBeDefined();
    expect(effectiveConfig.scanner.onSecretDetected).toBe('warn');
    expect(effectiveConfig.scanner.maskSecrets).toBe(true);
    expect(effectiveConfig.scanner.includeBuiltInPatterns).toBe(true);
    expect(effectiveConfig.scanner.customPatterns).toEqual([]);
    expect(effectiveConfig.scanner.maxLineLength).toBe(10000);
    expect(effectiveConfig.scanner.contextLength).toBe(20);
  });

  it('should handle all valid onSecretDetected behaviors', async () => {
    const behaviors = ['log', 'warn', 'mask', 'block'];

    for (const behavior of behaviors) {
      const configContent = {
        version: '1.0',
        project: { name: 'test-project' },
        scanner: {
          onSecretDetected: behavior
        }
      };

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        yaml.stringify(configContent)
      );

      const config = await loadConfig(testDir);
      expect(config.scanner?.onSecretDetected).toBe(behavior);
    }
  });
});