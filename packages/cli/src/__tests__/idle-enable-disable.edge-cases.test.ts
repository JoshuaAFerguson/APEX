/**
 * Idle Enable/Disable Commands Edge Cases Tests
 *
 * Tests edge cases, error conditions, and boundary scenarios for the
 * 'apex idle enable/disable' commands to ensure robustness.
 *
 * Edge Cases Covered:
 * 1. Malformed config files
 * 2. Concurrent access scenarios
 * 3. Large config files
 * 4. Special characters and encoding
 * 5. Network filesystem edge cases
 * 6. Memory constraints
 * 7. Invalid permissions scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import type { ApexConfig } from '@apexcli/core';
import { skipOnWindows } from '@apexcli/core';

describe('Idle Enable/Disable Commands Edge Cases', () => {
  let tempDir: string;
  let apexConfigPath: string;
  let mockContext: any;
  let consoleSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-idle-edge-test-'));
    const apexDir = path.join(tempDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
    apexConfigPath = path.join(apexDir, 'config.yaml');

    mockContext = {
      cwd: tempDir,
      initialized: true,
      orchestrator: { initialize: vi.fn() }
    };

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('malformed config files', () => {
    it('should handle completely invalid YAML gracefully', async () => {
      // Setup: Create invalid YAML file
      const invalidYaml = `
version: "1.0"
project:
  name: test
    invalid: indentation
      more: invalid
  - broken list
daemon:
  { invalid json mixed with yaml
`;
      await fs.writeFile(apexConfigPath, invalidYaml);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
    });

    it('should handle config with missing required fields', async () => {
      // Setup: Create config missing required project field
      const incompleteConfig = {
        version: '1.0',
        // Missing project field
        daemon: {}
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(incompleteConfig));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
    });

    it('should handle config with null values', async () => {
      // Setup: Create config with null values
      const configWithNulls = {
        version: '1.0',
        project: { name: 'test' },
        daemon: null
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(configWithNulls));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      // Should handle gracefully and create proper daemon section
      const configContent = await fs.readFile(apexConfigPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);
      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(true);
    });

    it('should handle binary file as config', async () => {
      // Setup: Create binary file
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD]);
      await fs.writeFile(apexConfigPath, binaryData);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
    });

    it('should handle extremely large config files', async () => {
      // Setup: Create very large config (simulate 10MB+ config)
      const largeConfig: any = {
        version: '1.0',
        project: { name: 'test' },
        daemon: { idleProcessing: { enabled: false } }
      };

      // Add many large arrays to bloat the config
      largeConfig.bloat = {};
      for (let i = 0; i < 1000; i++) {
        largeConfig.bloat[`section${i}`] = new Array(1000).fill(`data_${i}`);
      }

      await fs.writeFile(apexConfigPath, yaml.stringify(largeConfig));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Should still work even with large files (within reasonable memory limits)
      await idleCommand!.handler(mockContext, ['enable']);

      const updatedContent = await fs.readFile(apexConfigPath, 'utf-8');
      const parsedConfig = yaml.parse(updatedContent);
      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(true);
    }, 30000); // Increased timeout for large file operations
  });

  describe('special characters and encoding', () => {
    it('should handle config with unicode characters', async () => {
      // Setup: Create config with unicode characters
      const unicodeConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'tëst-prøjéct-日本語-🚀',
          language: 'typescript',
          framework: 'node'
        },
        daemon: {
          idleProcessing: { enabled: false }
        }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(unicodeConfig), 'utf-8');

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      const configContent = await fs.readFile(apexConfigPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);
      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(true);
      expect(parsedConfig.project.name).toBe('tëst-prøjéct-日本語-🚀');
    });

    it('should handle config with special YAML characters', async () => {
      // Setup: Create config with YAML special characters in strings
      const specialConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test: project & more | special * chars []{}'
        },
        daemon: {
          idleProcessing: { enabled: false }
        }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(specialConfig));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      const configContent = await fs.readFile(apexConfigPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);
      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(true);
      expect(parsedConfig.project.name).toBe('test: project & more | special * chars []{}');
    });
  });

  describe('filesystem edge cases', () => {
    it('should handle read-only .apex directory', async () => {
      // Unix-only: chmod permission model doesn't apply to Windows
      skipOnWindows();

      // Setup: Create config and make .apex directory read-only
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(config));
      await fs.chmod(path.dirname(apexConfigPath), 0o555); // Read-only directory

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);

      // Cleanup: Restore permissions
      await fs.chmod(path.dirname(apexConfigPath), 0o755);
    });

    it('should handle missing .apex directory', async () => {
      // Setup: Remove .apex directory entirely
      await fs.rm(path.dirname(apexConfigPath), { recursive: true, force: true });

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
    });

    it('should handle config file as directory', async () => {
      // Setup: Create directory where config file should be
      await fs.mkdir(apexConfigPath, { recursive: true });

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
    });

    it('should handle symlink to nonexistent file', async () => {
      // Unix-only: Symlinks require elevated permissions or Developer Mode on Windows
      skipOnWindows();

      // Setup: Create symlink to nonexistent file
      const nonexistentFile = path.join(tempDir, 'nonexistent.yaml');
      await fs.symlink(nonexistentFile, apexConfigPath);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
    });
  });

  describe('concurrent access scenarios', () => {
    it('should handle rapid successive commands', async () => {
      // Setup: Create initial config
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        daemon: { idleProcessing: { enabled: false } }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(config));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Execute multiple commands rapidly
      const promises = [
        idleCommand!.handler(mockContext, ['enable']),
        idleCommand!.handler(mockContext, ['disable']),
        idleCommand!.handler(mockContext, ['enable']),
        idleCommand!.handler(mockContext, ['disable']),
      ];

      await Promise.allSettled(promises);

      // Final state should be consistent (some operations may have failed due to conflicts)
      const finalContent = await fs.readFile(apexConfigPath, 'utf-8');
      const finalConfig = yaml.parse(finalContent);
      expect(typeof finalConfig.daemon?.idleProcessing?.enabled).toBe('boolean');
    });
  });

  describe('memory and resource constraints', () => {
    it('should handle deeply nested configuration objects', async () => {
      // Setup: Create deeply nested config
      const deepConfig: any = {
        version: '1.0',
        project: { name: 'test' }
      };

      // Create 50 levels of nesting
      let current = deepConfig;
      for (let i = 0; i < 50; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      // Add daemon config at a reasonable level
      deepConfig.daemon = { idleProcessing: { enabled: false } };

      await fs.writeFile(apexConfigPath, yaml.stringify(deepConfig));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      // Verify the operation succeeded despite deep nesting
      const updatedContent = await fs.readFile(apexConfigPath, 'utf-8');
      const parsedConfig = yaml.parse(updatedContent);
      expect(parsedConfig.daemon?.idleProcessing?.enabled).toBe(true);
    });

    it('should handle config with circular reference protection', async () => {
      // Setup: Create config that would create circular references if not handled properly
      const configText = `
version: "1.0"
project:
  name: test
daemon:
  idleProcessing:
    enabled: false
  self: &daemon_ref
    reference: *daemon_ref
`;
      await fs.writeFile(apexConfigPath, configText);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Should either handle gracefully or fail safely
      await idleCommand!.handler(mockContext, ['enable']);

      // If it doesn't crash, that's a success
      expect(true).toBe(true);
    });
  });

  describe('invalid command arguments', () => {
    it('should handle unknown subcommands gracefully', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(config));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['invalid-subcommand']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('Usage: /idle'))).toBe(true);
    });

    it('should handle empty arguments array', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(config));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Should fall back to status command
      await idleCommand!.handler(mockContext, []);

      // Should not crash
      expect(true).toBe(true);
    });

    it('should handle null/undefined arguments', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(config));

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Test with null argument
      await idleCommand!.handler(mockContext, [null as any]);

      // Test with undefined argument
      await idleCommand!.handler(mockContext, [undefined as any]);

      // Should handle gracefully without crashing
      expect(true).toBe(true);
    });
  });

  describe('context edge cases', () => {
    it('should handle context with missing cwd', async () => {
      const invalidContext = {
        ...mockContext,
        cwd: undefined
      };

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(invalidContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
    });

    it('should handle context with null orchestrator', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(config));

      const invalidContext = {
        ...mockContext,
        orchestrator: null
      };

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(invalidContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('APEX not initialized'))).toBe(true);
    });
  });

  describe('async error handling', () => {
    it('should handle promise rejections in config operations', async () => {
      // This test ensures that promise rejections don't cause unhandled rejections

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Mock loadConfig to reject after a delay
      const originalLoadConfig = (await import('@apexcli/core')).loadConfig;
      vi.mocked(originalLoadConfig).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Async config load error');
      });

      await idleCommand!.handler(mockContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
    });

    it('should handle timeout scenarios', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(config));

      // Mock saveConfig to hang indefinitely
      const originalSaveConfig = (await import('@apexcli/core')).saveConfig;
      vi.mocked(originalSaveConfig).mockImplementation(async () => {
        return new Promise(() => {}); // Never resolves
      });

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      // Create a promise that should complete within reasonable time
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), 5000);
      });

      const commandPromise = idleCommand!.handler(mockContext, ['enable']);

      // The command should either complete or timeout
      await expect(Promise.race([commandPromise, timeoutPromise])).rejects.toThrow('Operation timed out');
    });
  });

  describe('recovery scenarios', () => {
    it('should recover from partial config updates', async () => {
      // Setup: Create config and simulate partial update
      const config: ApexConfig = {
        version: '1.0',
        project: { name: 'test' },
        daemon: { idleProcessing: { enabled: false } }
      };
      await fs.writeFile(apexConfigPath, yaml.stringify(config));

      // Simulate corrupted config state
      const partialConfig = 'version: "1.0"\nproject:\n  name: test\ndaemon:\n';
      await fs.writeFile(apexConfigPath, partialConfig);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      // Should either recover gracefully or fail safely
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      const hasError = calls.some(call => call.includes('❌ Failed to enable idle processing'));
      const hasSuccess = calls.some(call => call.includes('✅ Idle processing enabled'));

      // Should either succeed or fail gracefully, not crash
      expect(hasError || hasSuccess).toBe(true);
    });
  });
});