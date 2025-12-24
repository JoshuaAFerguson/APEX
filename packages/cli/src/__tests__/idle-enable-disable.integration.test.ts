/**
 * Idle Enable/Disable Commands Integration Tests
 *
 * Tests config persistence across CLI restarts and integration with the
 * actual file system to ensure changes persist properly.
 *
 * Acceptance Criteria Covered:
 * 1. Changes persist across CLI restarts
 * 2. Config file is properly written and can be read back
 * 3. Integration with real file system operations
 * 4. End-to-end command execution flow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import type { ApexConfig } from '@apexcli/core';
import { loadConfig, saveConfig } from '@apexcli/core';

describe('Idle Enable/Disable Commands Integration', () => {
  let tempDir: string;
  let apexConfigPath: string;
  let mockContext: any;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-idle-test-'));

    // Create .apex directory structure
    const apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    apexConfigPath = path.join(apexDir, 'config.yaml');

    // Create mock context pointing to temp directory
    mockContext = {
      cwd: tempDir,
      initialized: true,
      orchestrator: {
        initialize: vi.fn(),
      }
    };
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('config persistence', () => {
    it('should persist idle processing enable across file operations', async () => {
      // Setup: Create initial config file
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(initialConfig));

      // Import and execute the enable command
      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');
      expect(idleCommand).toBeDefined();

      // Execute enable command
      await idleCommand!.handler(mockContext, ['enable']);

      // Verify the config file was updated
      const configFileContent = await fs.readFile(apexConfigPath, 'utf-8');
      const parsedConfig = yaml.parse(configFileContent);

      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(true);
    });

    it('should persist idle processing disable across file operations', async () => {
      // Setup: Create initial config with idle processing enabled
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        daemon: {
          idleProcessing: {
            enabled: true,
            idleThreshold: 300000,
            taskGenerationInterval: 3600000,
            maxIdleTasks: 3
          }
        }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(initialConfig));

      // Import and execute the disable command
      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Execute disable command
      await idleCommand!.handler(mockContext, ['disable']);

      // Verify the config file was updated
      const configFileContent = await fs.readFile(apexConfigPath, 'utf-8');
      const parsedConfig = yaml.parse(configFileContent);

      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(false);
      // Verify other idle processing settings were preserved
      expect(parsedConfig.daemon?.idleProcessing?.idleThreshold).toBe(300000);
      expect(parsedConfig.daemon?.idleProcessing?.taskGenerationInterval).toBe(3600000);
      expect(parsedConfig.daemon?.idleProcessing?.maxIdleTasks).toBe(3);
    });

    it('should preserve config structure and formatting', async () => {
      // Setup: Create config with comments and structure
      const configYaml = `# APEX Configuration
version: "1.0"

# Project settings
project:
  name: test-project
  language: typescript
  framework: node

# Daemon configuration
daemon:
  pollInterval: 5000
  autoStart: false
  # Idle processing disabled by default
  idleProcessing:
    enabled: false
    idleThreshold: 300000
`;
      await fs.writeFile(apexConfigPath, configYaml);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Execute enable command
      await idleCommand!.handler(mockContext, ['enable']);

      // Read back the file and verify structure is preserved
      const updatedContent = await fs.readFile(apexConfigPath, 'utf-8');
      const parsedConfig = yaml.parse(updatedContent);

      // Verify the enabled flag was changed
      expect(parsedConfig.daemon.idleProcessing.enabled).toBe(true);

      // Verify other structure is preserved
      expect(parsedConfig.version).toBe('1.0');
      expect(parsedConfig.project.name).toBe('test-project');
      expect(parsedConfig.project.language).toBe('typescript');
      expect(parsedConfig.daemon.pollInterval).toBe(5000);
      expect(parsedConfig.daemon.autoStart).toBe(false);
      expect(parsedConfig.daemon.idleProcessing.idleThreshold).toBe(300000);
    });

    it('should handle missing config file gracefully', async () => {
      // Setup: No config file exists
      mockContext.cwd = '/nonexistent/path';

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Capture console output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        // Execute enable command - should handle error gracefully
        await idleCommand!.handler(mockContext, ['enable']);

        // Verify error message was displayed
        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should handle permission errors gracefully', async () => {
      // Setup: Create a read-only config file
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(initialConfig));
      await fs.chmod(apexConfigPath, 0o444); // Read-only

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        // Execute enable command - should handle permission error
        await idleCommand!.handler(mockContext, ['enable']);

        // Verify error message was displayed
        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
      } finally {
        consoleSpy.mockRestore();
        // Restore write permissions for cleanup
        await fs.chmod(apexConfigPath, 0o644);
      }
    });
  });

  describe('round-trip operations', () => {
    it('should enable then disable and verify final state', async () => {
      // Setup: Create initial config
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(initialConfig));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // 1. Enable idle processing
      await idleCommand!.handler(mockContext, ['enable']);

      // Verify enabled state
      let configContent = await fs.readFile(apexConfigPath, 'utf-8');
      let parsedConfig = yaml.parse(configContent);
      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(true);

      // 2. Disable idle processing
      await idleCommand!.handler(mockContext, ['disable']);

      // Verify disabled state
      configContent = await fs.readFile(apexConfigPath, 'utf-8');
      parsedConfig = yaml.parse(configContent);
      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(false);
    });

    it('should handle multiple enable operations idempotently', async () => {
      // Setup: Create initial config
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(initialConfig));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Execute enable multiple times
      await idleCommand!.handler(mockContext, ['enable']);
      await idleCommand!.handler(mockContext, ['enable']);
      await idleCommand!.handler(mockContext, ['enable']);

      // Verify still enabled (and not corrupted)
      const configContent = await fs.readFile(apexConfigPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);
      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(true);
    });

    it('should handle multiple disable operations idempotently', async () => {
      // Setup: Create initial config with idle processing enabled
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        daemon: {
          idleProcessing: { enabled: true }
        }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(initialConfig));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Execute disable multiple times
      await idleCommand!.handler(mockContext, ['disable']);
      await idleCommand!.handler(mockContext, ['disable']);
      await idleCommand!.handler(mockContext, ['disable']);

      // Verify still disabled (and not corrupted)
      const configContent = await fs.readFile(apexConfigPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);
      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(false);
    });
  });

  describe('CLI restart simulation', () => {
    it('should persist settings across simulated CLI restarts', async () => {
      // Setup: Create initial config
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(initialConfig));

      // === First CLI session: enable idle processing ===
      {
        const { commands } = await import('../index.js');
        const idleCommand = commands.find(cmd => cmd.name === 'idle');
        await idleCommand!.handler(mockContext, ['enable']);
      }

      // === Simulate CLI restart by re-importing modules ===
      vi.resetModules();

      // === Second CLI session: verify config persisted ===
      {
        // Load config using core function (simulating fresh CLI start)
        const loadedConfig = await loadConfig(tempDir);
        expect(loadedConfig.daemon?.idleProcessing?.enabled).toBe(true);

        // Also test via the idle status command
        const { commands } = await import('../index.js');
        const idleCommand = commands.find(cmd => cmd.name === 'idle');

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        await idleCommand!.handler(mockContext, ['status']);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls.some(call => call.includes('Status: GREEN(ENABLED)'))).toBe(true);

        consoleSpy.mockRestore();
      }

      // === Third CLI session: disable and verify ===
      {
        const { commands } = await import('../index.js');
        const idleCommand = commands.find(cmd => cmd.name === 'idle');
        await idleCommand!.handler(mockContext, ['disable']);
      }

      // === Fourth CLI session: verify disabled state persisted ===
      {
        const loadedConfig = await loadConfig(tempDir);
        expect(loadedConfig.daemon?.idleProcessing?.enabled).toBe(false);
      }
    });
  });

  describe('config file format validation', () => {
    it('should maintain valid YAML format after operations', async () => {
      // Setup: Create initial config
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        daemon: {
          pollInterval: 5000,
          logLevel: 'info' as const
        }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(initialConfig));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Execute enable command
      await idleCommand!.handler(mockContext, ['enable']);

      // Verify the file is still valid YAML
      const configContent = await fs.readFile(apexConfigPath, 'utf-8');
      expect(() => yaml.parse(configContent)).not.toThrow();

      // Verify the parsed config has expected structure
      const parsedConfig = yaml.parse(configContent);
      expect(parsedConfig).toHaveProperty('version');
      expect(parsedConfig).toHaveProperty('project');
      expect(parsedConfig).toHaveProperty('daemon');
      expect(parsedConfig.daemon).toHaveProperty('idleProcessing');
      expect(parsedConfig.daemon.idleProcessing).toHaveProperty('enabled', true);
    });

    it('should handle existing complex config structure', async () => {
      // Setup: Create complex config with multiple sections
      const complexConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-project',
          language: 'typescript',
          framework: 'node',
          testCommand: 'npm test',
          buildCommand: 'npm run build'
        },
        autonomy: {
          default: 'review-before-merge'
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku'
        },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional',
          defaultBranch: 'main'
        },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 10.0,
          dailyBudget: 50.0
        },
        api: {
          port: 3000,
          autoStart: false
        },
        daemon: {
          pollInterval: 5000,
          autoStart: false,
          logLevel: 'debug' as const,
          idleProcessing: {
            enabled: false,
            idleThreshold: 600000,
            taskGenerationInterval: 1800000,
            maxIdleTasks: 5,
            strategyWeights: {
              maintenance: 0.3,
              refactoring: 0.3,
              docs: 0.2,
              tests: 0.2
            }
          }
        }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(complexConfig));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Execute enable command
      await idleCommand!.handler(mockContext, ['enable']);

      // Load and verify the complete structure was preserved
      const updatedConfig = await loadConfig(tempDir);

      // Verify only the enabled flag changed
      expect(updatedConfig.daemon?.idleProcessing?.enabled).toBe(true);

      // Verify everything else was preserved
      expect(updatedConfig.project.language).toBe('typescript');
      expect(updatedConfig.autonomy?.default).toBe('review-before-merge');
      expect(updatedConfig.models?.planning).toBe('opus');
      expect(updatedConfig.git?.branchPrefix).toBe('feature/');
      expect(updatedConfig.limits?.dailyBudget).toBe(50.0);
      expect(updatedConfig.api?.port).toBe(3000);
      expect(updatedConfig.daemon?.pollInterval).toBe(5000);
      expect(updatedConfig.daemon?.idleProcessing?.idleThreshold).toBe(600000);
      expect(updatedConfig.daemon?.idleProcessing?.strategyWeights?.maintenance).toBe(0.3);
    });
  });
});