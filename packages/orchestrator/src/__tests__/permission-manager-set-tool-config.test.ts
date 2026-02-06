import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import { ToolPermissionConfig } from '@apexcli/core';

describe('PermissionManager - setToolConfig Method', () => {
  let manager: PermissionManager;
  let store: PermissionStore;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `apex-permission-set-tool-config-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    mkdirSync(testDir, { recursive: true });

    store = new PermissionStore(testDir);
    await store.initialize();

    manager = new PermissionManager(store);
  });

  afterEach(() => {
    // Clean up
    if (store) {
      store.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('setToolConfig basic functionality', () => {
    it('should set tool configuration for session cache', async () => {
      const config: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
      };

      // Set config should not throw
      expect(() => {
        manager.setToolConfig('TestTool', config);
      }).not.toThrow();

      // Verify config is accessible via getToolConfig
      const retrievedConfig = await manager.getToolConfig('TestTool');
      expect(retrievedConfig).toEqual(config);
    });

    it('should set tool configuration with scope', async () => {
      const config: ToolPermissionConfig = {
        enabled: false,
        requireConfirmation: true,
      };

      // Set config with scope
      manager.setToolConfig('TestTool', config, 'test-scope');

      // Verify config is accessible with scope
      const retrievedConfig = await manager.getToolConfig('TestTool', 'test-scope');
      expect(retrievedConfig).toEqual(config);

      // Verify different scope returns null
      const differentScopeConfig = await manager.getToolConfig('TestTool', 'different-scope');
      expect(differentScopeConfig).toBeNull();

      // Verify no scope returns null
      const noScopeConfig = await manager.getToolConfig('TestTool');
      expect(noScopeConfig).toBeNull();
    });

    it('should set different configurations for different tools', async () => {
      const config1: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
      };

      const config2: ToolPermissionConfig = {
        enabled: false,
        requireConfirmation: true,
      };

      manager.setToolConfig('Tool1', config1);
      manager.setToolConfig('Tool2', config2);

      const retrievedConfig1 = await manager.getToolConfig('Tool1');
      const retrievedConfig2 = await manager.getToolConfig('Tool2');

      expect(retrievedConfig1).toEqual(config1);
      expect(retrievedConfig2).toEqual(config2);
    });
  });

  describe('setToolConfig with null values', () => {
    it('should clear tool configuration when set to null', async () => {
      const config: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
      };

      // First set a config
      manager.setToolConfig('TestTool', config);
      const initialConfig = await manager.getToolConfig('TestTool');
      expect(initialConfig).toEqual(config);

      // Clear the config by setting to null
      manager.setToolConfig('TestTool', null);
      const clearedConfig = await manager.getToolConfig('TestTool');
      expect(clearedConfig).toBeNull();
    });

    it('should clear scoped tool configuration when set to null', async () => {
      const config: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
      };

      // Set config with scope
      manager.setToolConfig('TestTool', config, 'test-scope');
      const initialConfig = await manager.getToolConfig('TestTool', 'test-scope');
      expect(initialConfig).toEqual(config);

      // Clear the scoped config
      manager.setToolConfig('TestTool', null, 'test-scope');
      const clearedConfig = await manager.getToolConfig('TestTool', 'test-scope');
      expect(clearedConfig).toBeNull();
    });

    it('should handle setting null on non-existent configuration', () => {
      // Should not throw when clearing non-existent config
      expect(() => {
        manager.setToolConfig('NonExistentTool', null);
      }).not.toThrow();

      expect(() => {
        manager.setToolConfig('NonExistentTool', null, 'some-scope');
      }).not.toThrow();
    });
  });

  describe('setToolConfig session isolation', () => {
    it('should isolate configuration changes to current session', async () => {
      const sessionConfig: ToolPermissionConfig = {
        enabled: false,
        requireConfirmation: true,
      };

      // Set session config
      manager.setToolConfig('SessionTool', sessionConfig);

      // Reset session (simulates new session)
      manager.resetSession();

      // Session config should be cleared, should fallback to persistent store (null in this case)
      const configAfterReset = await manager.getToolConfig('SessionTool');
      expect(configAfterReset).toBeNull();
    });

    it('should maintain separate configs for different scopes within session', async () => {
      const scope1Config: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
      };

      const scope2Config: ToolPermissionConfig = {
        enabled: false,
        requireConfirmation: true,
      };

      // Set configs for different scopes
      manager.setToolConfig('MultiScopeTool', scope1Config, 'scope1');
      manager.setToolConfig('MultiScopeTool', scope2Config, 'scope2');

      // Verify each scope returns correct config
      const retrievedScope1Config = await manager.getToolConfig('MultiScopeTool', 'scope1');
      const retrievedScope2Config = await manager.getToolConfig('MultiScopeTool', 'scope2');

      expect(retrievedScope1Config).toEqual(scope1Config);
      expect(retrievedScope2Config).toEqual(scope2Config);

      // Verify no-scope config is still null
      const noScopeConfig = await manager.getToolConfig('MultiScopeTool');
      expect(noScopeConfig).toBeNull();
    });
  });

  describe('setToolConfig with complex configurations', () => {
    it('should handle filesystem tool configuration', async () => {
      const filesystemConfig: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
        directoryAccess: {
          allowlist: ['/allowed/path'],
          blocklist: ['/blocked/path'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 5,
        },
        rateLimit: {
          requestsPerMinute: 60,
          burstLimit: 10,
        },
        timeout: 30000,
      };

      manager.setToolConfig('FilesystemTool', filesystemConfig);
      const retrievedConfig = await manager.getToolConfig('FilesystemTool');
      expect(retrievedConfig).toEqual(filesystemConfig);
    });

    it('should handle shell tool configuration', async () => {
      const shellConfig: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: true,
        allowedCommands: ['ls', 'cat', 'echo'],
        blockedCommands: ['rm', 'sudo', 'chmod'],
        workingDirectory: '/safe/working/dir',
        rateLimit: {
          requestsPerMinute: 30,
          burstLimit: 5,
        },
        timeout: 15000,
      };

      manager.setToolConfig('ShellTool', shellConfig);
      const retrievedConfig = await manager.getToolConfig('ShellTool');
      expect(retrievedConfig).toEqual(shellConfig);
    });

    it('should handle web tool configuration', async () => {
      const webConfig: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
        allowedDomains: ['example.com', 'api.service.com'],
        blockedDomains: ['malicious.com', 'spam.site'],
        timeout: 10000,
        rateLimit: {
          requestsPerMinute: 100,
          burstLimit: 20,
        },
      };

      manager.setToolConfig('WebTool', webConfig);
      const retrievedConfig = await manager.getToolConfig('WebTool');
      expect(retrievedConfig).toEqual(webConfig);
    });

    it('should handle search tool configuration', async () => {
      const searchConfig: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
        allowedPatterns: ['*.md', '*.txt'],
        blockedPatterns: ['*.exe', '*.bin'],
        maxResults: 100,
        timeout: 5000,
        rateLimit: {
          requestsPerMinute: 50,
          burstLimit: 10,
        },
      };

      manager.setToolConfig('SearchTool', searchConfig);
      const retrievedConfig = await manager.getToolConfig('SearchTool');
      expect(retrievedConfig).toEqual(searchConfig);
    });
  });

  describe('setToolConfig override behavior', () => {
    it('should override existing session configuration', async () => {
      const initialConfig: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: false,
      };

      const updatedConfig: ToolPermissionConfig = {
        enabled: false,
        requireConfirmation: true,
      };

      // Set initial config
      manager.setToolConfig('OverrideTool', initialConfig);
      const firstConfig = await manager.getToolConfig('OverrideTool');
      expect(firstConfig).toEqual(initialConfig);

      // Override with new config
      manager.setToolConfig('OverrideTool', updatedConfig);
      const secondConfig = await manager.getToolConfig('OverrideTool');
      expect(secondConfig).toEqual(updatedConfig);
      expect(secondConfig).not.toEqual(initialConfig);
    });

    it('should allow multiple overrides in same session', async () => {
      const configs = [
        { enabled: true, requireConfirmation: false },
        { enabled: false, requireConfirmation: true },
        { enabled: true, requireConfirmation: true },
      ];

      for (const config of configs) {
        manager.setToolConfig('MultiOverrideTool', config);
        const retrievedConfig = await manager.getToolConfig('MultiOverrideTool');
        expect(retrievedConfig).toEqual(config);
      }
    });
  });

  describe('setToolConfig edge cases', () => {
    it('should handle empty string tool name', () => {
      const config: ToolPermissionConfig = { enabled: true };

      expect(() => {
        manager.setToolConfig('', config);
      }).not.toThrow();
    });

    it('should handle empty string scope', async () => {
      const config: ToolPermissionConfig = { enabled: true };

      manager.setToolConfig('TestTool', config, '');
      const retrievedConfig = await manager.getToolConfig('TestTool', '');
      expect(retrievedConfig).toEqual(config);
    });

    it('should handle undefined scope explicitly', async () => {
      const config: ToolPermissionConfig = { enabled: true };

      manager.setToolConfig('TestTool', config, undefined);
      const retrievedConfig = await manager.getToolConfig('TestTool', undefined);
      expect(retrievedConfig).toEqual(config);
    });

    it('should handle configurations with all optional properties', async () => {
      const minimalConfig: ToolPermissionConfig = {};

      manager.setToolConfig('MinimalTool', minimalConfig);
      const retrievedConfig = await manager.getToolConfig('MinimalTool');
      expect(retrievedConfig).toEqual(minimalConfig);
    });
  });
});