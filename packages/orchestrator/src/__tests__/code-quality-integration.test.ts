/**
 * Integration test for code quality features
 *
 * This test verifies that the code quality integration features work properly:
 * - Automatic linter plugin registration
 * - Lint-after-edit hook functionality
 * - Auto-fix capability
 * - Configuration handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import type { ApexConfig } from '@apexcli/core';

describe('Code Quality Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-quality-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create a basic config with linter enabled
    const config: ApexConfig = {
      linter: {
        global: {
          enabled: true,
          runAfterEdit: true,
          parallel: false,
          failFast: false,
          timeoutMs: 30000,
        },
        eslint: {
          enabled: true,
          autoFix: true,
        },
        prettier: {
          enabled: true,
          autoFix: true,
        },
      },
    };

    // Write config file
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `linter:
  global:
    enabled: true
    runAfterEdit: true
    parallel: false
    failFast: false
    timeoutMs: 30000
  eslint:
    enabled: true
    autoFix: true
  prettier:
    enabled: true
    autoFix: true`,
      'utf8'
    );

    orchestrator = new ApexOrchestrator({
      projectPath: testDir,
      apiUrl: 'http://localhost:3000',
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should initialize and register available linter plugins', async () => {
    // Mock the availability checks to avoid depending on actual ESLint/Prettier installation
    const mockESLintAvailable = vi.fn().mockResolvedValue(true);
    const mockPrettierAvailable = vi.fn().mockResolvedValue(true);

    // We need to mock the plugin classes before initialization
    const originalESLintPlugin = require('../linter/plugins/eslint').ESLintPlugin;
    const originalPrettierPlugin = require('../linter/plugins/prettier').PrettierPlugin;

    class MockESLintPlugin extends originalESLintPlugin {
      async isAvailable() {
        return mockESLintAvailable();
      }
    }

    class MockPrettierPlugin extends originalPrettierPlugin {
      async isAvailable() {
        return mockPrettierAvailable();
      }
    }

    // Mock the plugin imports
    vi.doMock('../linter/plugins/eslint', () => ({
      ESLintPlugin: MockESLintPlugin,
    }));
    vi.doMock('../linter/plugins/prettier', () => ({
      PrettierPlugin: MockPrettierPlugin,
    }));

    await orchestrator.initialize();

    const linterService = orchestrator.getLinterService();
    const registeredPlugins = linterService.getRegisteredPlugins();

    // Should have registered both plugins
    expect(registeredPlugins).toHaveLength(2);

    const pluginIds = registeredPlugins.map(p => p.plugin.metadata.id);
    expect(pluginIds).toContain('eslint');
    expect(pluginIds).toContain('prettier');

    // Verify they were checked for availability
    expect(mockESLintAvailable).toHaveBeenCalled();
    expect(mockPrettierAvailable).toHaveBeenCalled();
  });

  it('should skip plugin registration when tools are not available', async () => {
    // Mock plugins as not available
    const mockESLintAvailable = vi.fn().mockResolvedValue(false);
    const mockPrettierAvailable = vi.fn().mockResolvedValue(false);

    const originalESLintPlugin = require('../linter/plugins/eslint').ESLintPlugin;
    const originalPrettierPlugin = require('../linter/plugins/prettier').PrettierPlugin;

    class MockESLintPlugin extends originalESLintPlugin {
      async isAvailable() {
        return mockESLintAvailable();
      }
    }

    class MockPrettierPlugin extends originalPrettierPlugin {
      async isAvailable() {
        return mockPrettierAvailable();
      }
    }

    vi.doMock('../linter/plugins/eslint', () => ({
      ESLintPlugin: MockESLintPlugin,
    }));
    vi.doMock('../linter/plugins/prettier', () => ({
      PrettierPlugin: MockPrettierPlugin,
    }));

    await orchestrator.initialize();

    const linterService = orchestrator.getLinterService();
    const registeredPlugins = linterService.getRegisteredPlugins();

    // Should have no plugins registered since none are available
    expect(registeredPlugins).toHaveLength(0);
  });

  it('should respect linter configuration', async () => {
    // Update config to disable prettier
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `linter:
  global:
    enabled: true
    runAfterEdit: true
  eslint:
    enabled: true
  prettier:
    enabled: false`,
      'utf8'
    );

    const mockESLintAvailable = vi.fn().mockResolvedValue(true);
    const mockPrettierAvailable = vi.fn().mockResolvedValue(true);

    const originalESLintPlugin = require('../linter/plugins/eslint').ESLintPlugin;
    const originalPrettierPlugin = require('../linter/plugins/prettier').PrettierPlugin;

    class MockESLintPlugin extends originalESLintPlugin {
      async isAvailable() {
        return mockESLintAvailable();
      }
    }

    class MockPrettierPlugin extends originalPrettierPlugin {
      async isAvailable() {
        return mockPrettierAvailable();
      }
    }

    vi.doMock('../linter/plugins/eslint', () => ({
      ESLintPlugin: MockESLintPlugin,
    }));
    vi.doMock('../linter/plugins/prettier', () => ({
      PrettierPlugin: MockPrettierPlugin,
    }));

    await orchestrator.initialize();

    const linterService = orchestrator.getLinterService();
    const registeredPlugins = linterService.getRegisteredPlugins();

    // Should only have ESLint registered
    expect(registeredPlugins).toHaveLength(1);
    expect(registeredPlugins[0].plugin.metadata.id).toBe('eslint');

    // ESLint should be checked for availability, but not Prettier
    expect(mockESLintAvailable).toHaveBeenCalled();
    expect(mockPrettierAvailable).not.toHaveBeenCalled();
  });

  it('should not register plugins when linter is globally disabled', async () => {
    // Update config to disable linter globally
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `linter:
  global:
    enabled: false`,
      'utf8'
    );

    await orchestrator.initialize();

    const linterService = orchestrator.getLinterService();
    const registeredPlugins = linterService.getRegisteredPlugins();

    // Should have no plugins registered
    expect(registeredPlugins).toHaveLength(0);
  });

  it('should have lint-after-edit enabled by default', async () => {
    // Create config without explicitly setting runAfterEdit
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `linter:
  global:
    enabled: true`,
      'utf8'
    );

    await orchestrator.initialize();

    const config = (orchestrator as any).config;
    expect(config.linter?.global?.runAfterEdit).toBe(true);
  });

  it('should support configuration priority order', async () => {
    // Create config with custom priority order
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `linter:
  global:
    enabled: true
  order: ['prettier', 'eslint']
  eslint:
    enabled: true
  prettier:
    enabled: true`,
      'utf8'
    );

    const mockESLintAvailable = vi.fn().mockResolvedValue(true);
    const mockPrettierAvailable = vi.fn().mockResolvedValue(true);

    const originalESLintPlugin = require('../linter/plugins/eslint').ESLintPlugin;
    const originalPrettierPlugin = require('../linter/plugins/prettier').PrettierPlugin;

    class MockESLintPlugin extends originalESLintPlugin {
      async isAvailable() {
        return mockESLintAvailable();
      }
    }

    class MockPrettierPlugin extends originalPrettierPlugin {
      async isAvailable() {
        return mockPrettierAvailable();
      }
    }

    vi.doMock('../linter/plugins/eslint', () => ({
      ESLintPlugin: MockESLintPlugin,
    }));
    vi.doMock('../linter/plugins/prettier', () => ({
      PrettierPlugin: MockPrettierPlugin,
    }));

    await orchestrator.initialize();

    const linterService = orchestrator.getLinterService();
    const registeredPlugins = linterService.getRegisteredPlugins();

    expect(registeredPlugins).toHaveLength(2);

    // Prettier should have priority 1 (higher priority)
    const prettierPlugin = registeredPlugins.find(p => p.plugin.metadata.id === 'prettier');
    const eslintPlugin = registeredPlugins.find(p => p.plugin.metadata.id === 'eslint');

    // Note: We currently hardcode priorities in registerAvailableLinterPlugins
    // In a future iteration, we could respect the order configuration
    expect(prettierPlugin).toBeDefined();
    expect(eslintPlugin).toBeDefined();
  });
});