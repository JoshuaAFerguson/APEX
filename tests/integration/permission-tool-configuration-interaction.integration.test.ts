/**
 * @fileoverview Permission Tool Configuration Interaction Integration Tests
 *
 * This test suite verifies complex interactions between permissions, tool configurations,
 * and directory access controls that affect tool availability.
 *
 * Additional scenarios beyond the basic permission changes:
 * - Tool configuration overrides affecting permission decisions
 * - Directory access controls combining with tool permissions
 * - Tool-specific settings (timeout, rate limiting, confirmation) with permissions
 * - Path validation combining with permission levels
 * - Configuration persistence and session behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  ApexOrchestrator,
  PermissionManager,
  PermissionStore,
} from '@apexcli/orchestrator';
import type {
  PermissionLevel,
  ToolPermissionConfig,
  DirectoryAccessConfig,
  AgentTool,
} from '@apexcli/core';

describe('Permission Tool Configuration Interaction Integration Tests', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-permission-config-test-'));

    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });
    await mkdir(join(apexDir, 'agents'), { recursive: true });

    const configContent = `
project:
  name: permission-config-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: manual

agents:
  test-agent:
    role: "Test agent"
    model: sonnet
    tools: [Read, Write, Edit, Bash]

workflows:
  test-workflow:
    name: "Test Workflow"
    agents: [test-agent]
    stages:
      - name: test-stage
        agent: test-agent

limits:
  maxTasksPerHour: 100
  maxCostPerTask: 10.0
  maxConcurrentTasks: 5
`;

    await writeFile(join(apexDir, 'config.yaml'), configContent);

    orchestrator = new ApexOrchestrator(tempDir, {
      maxTasksPerHour: 100,
      maxCostPerTask: 10,
      maxConcurrentTasks: 5,
    });

    await orchestrator.initialize();

    permissionManager = orchestrator.permissionManager;
    permissionStore = orchestrator.permissionStore;

    permissionManager.resetSession();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Tool Configuration Override Scenarios
  // ============================================================================

  describe('Tool Configuration Override Scenarios', () => {
    it('should deny tool access when tool is disabled via configuration despite having permission', async () => {
      const toolName: AgentTool = 'Read';
      const scope = '/project/data.txt';

      // Grant permission for the tool
      await permissionManager.grantPermission(toolName, scope, 'allow-always');

      // Verify permission is granted
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');

      // Disable the tool via configuration
      const disabledConfig: ToolPermissionConfig = {
        enabled: false,
        timeout: 5000,
        rateLimitPerMinute: 0,
      };
      permissionManager.setToolConfig(toolName, disabledConfig, scope);

      // Tool should now be denied despite permission
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Tool is disabled');
      expect(result.level).toBe('allow-always'); // Permission still exists but overridden
    });

    it('should require confirmation when tool configuration demands it', async () => {
      const toolName: AgentTool = 'Bash';
      const scope = 'git push origin main';

      // Grant permission for the tool
      await permissionManager.grantPermission(toolName, scope, 'allow-always');

      // Set configuration to require confirmation
      const confirmationConfig: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: true,
        timeout: 10000,
        rateLimitPerMinute: 0,
      };
      permissionManager.setToolConfig(toolName, confirmationConfig, scope);

      // Tool should require confirmation despite having permission
      const result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.denialReason).toContain('requires user confirmation');
      expect(result.level).toBe('allow-always');
    });

    it('should apply different configurations to different scopes of the same tool', async () => {
      const toolName: AgentTool = 'Write';
      const safeScope = '/project/output.txt';
      const dangerousScope = '/etc/hosts';

      // Grant permissions for both scopes
      await permissionManager.grantPermission(toolName, safeScope, 'allow-always');
      await permissionManager.grantPermission(toolName, dangerousScope, 'allow-always');

      // Configure safe scope as enabled, dangerous scope as requiring confirmation
      permissionManager.setToolConfig(toolName, { enabled: true }, safeScope);
      permissionManager.setToolConfig(toolName, {
        enabled: true,
        requireConfirmation: true
      }, dangerousScope);

      // Safe scope should be allowed
      let result = await permissionManager.checkToolPermission(toolName, { scope: safeScope });
      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);

      // Dangerous scope should require confirmation
      result = await permissionManager.checkToolPermission(toolName, { scope: dangerousScope });
      expect(result.allowed).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should preserve tool configuration across permission changes', async () => {
      const toolName: AgentTool = 'Edit';
      const scope = '/project/config.yaml';

      // Set tool configuration first
      const config: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: true,
        timeout: 15000,
        rateLimitPerMinute: 5,
      };
      permissionManager.setToolConfig(toolName, config, scope);

      // Grant allow-once permission
      await permissionManager.grantPermission(toolName, scope, 'allow-once');
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.requiresConfirmation).toBe(true);

      // Upgrade to allow-always permission
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.requiresConfirmation).toBe(true); // Config should persist

      // Revoke permission
      await permissionManager.revokePermission(toolName, scope);

      // Grant permission again
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.requiresConfirmation).toBe(true); // Config should still be there
    });
  });

  // ============================================================================
  // Directory Access Control Integration
  // ============================================================================

  describe('Directory Access Control Integration', () => {
    it('should deny file operations when directory access is blocked', async () => {
      const toolName: AgentTool = 'Read';
      const blockedPath = '/etc/passwd';

      // Grant permission for the tool
      await permissionManager.grantPermission(toolName, undefined, 'allow-always');

      // Set up directory access configuration with blocklist
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: [],
        blocklist: ['/etc/**'],
        defaultAllow: true,
        resolveSymlinks: true,
        maxDepth: 0,
      };

      const toolConfig: ToolPermissionConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };
      permissionManager.setToolConfig(toolName, toolConfig);

      // Check path that should be blocked by directory config
      const result = await permissionManager.checkToolPermission(toolName, { path: blockedPath });
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Directory access denied');
      expect(result.pathValidation?.allowed).toBe(false);
      expect(result.pathValidation?.matchedPattern).toBe('/etc/**');
    });

    it('should allow file operations when directory access is explicitly allowed', async () => {
      const toolName: AgentTool = 'Write';
      const allowedPath = '/project/src/main.ts';

      // Grant permission for the tool
      await permissionManager.grantPermission(toolName, undefined, 'allow-always');

      // Set up directory access configuration with allowlist
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/project/**'],
        blocklist: [],
        defaultAllow: false, // Deny by default, only allow specific patterns
        resolveSymlinks: true,
        maxDepth: 10,
      };

      const toolConfig: ToolPermissionConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };
      permissionManager.setToolConfig(toolName, toolConfig);

      // Check path that should be allowed by directory config
      const result = await permissionManager.checkToolPermission(toolName, { path: allowedPath });
      expect(result.allowed).toBe(true);
      expect(result.pathValidation?.allowed).toBe(true);
      expect(result.pathValidation?.matchedPattern).toBe('/project/**');
    });

    it('should handle complex directory access patterns with tool permissions', async () => {
      const toolName: AgentTool = 'Edit';
      const projectFile = '/project/src/component.tsx';
      const nodeModulesFile = '/project/node_modules/package/index.js';
      const systemFile = '/usr/bin/env';

      // Grant permission for all file operations
      await permissionManager.grantPermission(toolName, undefined, 'allow-always');

      // Complex directory access rules
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/project/src/**', '/project/tests/**'],
        blocklist: ['/project/node_modules/**', '/usr/**', '/etc/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 20,
      };

      const toolConfig: ToolPermissionConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };
      permissionManager.setToolConfig(toolName, toolConfig);

      // Project file should be allowed
      let result = await permissionManager.checkToolPermission(toolName, { path: projectFile });
      expect(result.allowed).toBe(true);
      expect(result.pathValidation?.matchType).toBe('allowlist');

      // Node modules file should be blocked
      result = await permissionManager.checkToolPermission(toolName, { path: nodeModulesFile });
      expect(result.allowed).toBe(false);
      expect(result.pathValidation?.matchType).toBe('blocklist');

      // System file should be blocked
      result = await permissionManager.checkToolPermission(toolName, { path: systemFile });
      expect(result.allowed).toBe(false);
      expect(result.pathValidation?.matchType).toBe('blocklist');
    });

    it('should combine scope-specific permissions with directory access controls', async () => {
      const toolName: AgentTool = 'Read';
      const allowedFile = '/project/public/data.json';
      const blockedFile = '/project/private/secrets.json';

      // Grant scope-specific permission only for public files
      await permissionManager.grantPermission(toolName, '/project/public/**', 'allow-always');

      // Set up directory access that mirrors the permission scope
      const directoryConfig: DirectoryAccessConfig = {
        allowlist: ['/project/public/**'],
        blocklist: ['/project/private/**'],
        defaultAllow: false,
        resolveSymlinks: true,
        maxDepth: 10,
      };

      const toolConfig: ToolPermissionConfig = {
        enabled: true,
        directoryAccess: directoryConfig,
      };
      permissionManager.setToolConfig(toolName, toolConfig, '/project/public/**');

      // Allowed file should work (both permission and directory access allow it)
      let result = await permissionManager.checkToolPermission(toolName, {
        scope: '/project/public/**',
        path: allowedFile
      });
      expect(result.allowed).toBe(true);

      // Blocked file should fail due to directory access even with broader permission check
      result = await permissionManager.checkToolPermission(toolName, { path: blockedFile });
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Directory access denied');
    });
  });

  // ============================================================================
  // Session Configuration Behavior
  // ============================================================================

  describe('Session Configuration Behavior', () => {
    it('should clear session-level tool configurations on session reset', async () => {
      const toolName: AgentTool = 'Bash';
      const scope = 'npm test';

      // Set session-level configuration
      const config: ToolPermissionConfig = {
        enabled: true,
        requireConfirmation: true,
        timeout: 30000,
      };
      permissionManager.setToolConfig(toolName, config, scope);

      // Grant permission and verify config is active
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.requiresConfirmation).toBe(true);

      // Reset session
      permissionManager.resetSession();

      // Configuration should be cleared, permission check should work normally
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.requiresConfirmation).toBe(false);
      expect(result.allowed).toBe(true); // Permission should still exist (it was persistent)
    });

    it('should maintain separate configurations for different sessions', async () => {
      const toolName: AgentTool = 'Write';
      const scope = '/tmp/session-test.txt';

      // Set configuration and permission in first session
      permissionManager.setToolConfig(toolName, { requireConfirmation: true }, scope);
      await permissionManager.grantPermission(toolName, scope, 'allow-always');

      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.requiresConfirmation).toBe(true);

      // Reset session (simulating new session)
      permissionManager.resetSession();

      // Set different configuration in new session
      permissionManager.setToolConfig(toolName, { requireConfirmation: false }, scope);

      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.requiresConfirmation).toBe(false);
    });

    it('should handle configuration updates during active permissions', async () => {
      const toolName: AgentTool = 'Edit';
      const scope = '/project/live-config-test.ts';

      // Grant allow-once permission
      await permissionManager.grantPermission(toolName, scope, 'allow-once');

      // Initially no special configuration
      let result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.requiresConfirmation).toBe(false);

      // Update configuration to require confirmation
      permissionManager.setToolConfig(toolName, { requireConfirmation: true }, scope);

      // Same permission should now require confirmation
      result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.requiresConfirmation).toBe(true);

      // Disable the tool entirely
      permissionManager.setToolConfig(toolName, { enabled: false }, scope);

      result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('disabled');
    });
  });

  // ============================================================================
  // Complex Permission-Configuration Interactions
  // ============================================================================

  describe('Complex Permission-Configuration Interactions', () => {
    it('should handle permission inheritance with configuration overrides', async () => {
      const toolName: AgentTool = 'Read';
      const globalScope = undefined;
      const specificScope = '/project/sensitive.env';

      // Grant global permission
      await permissionManager.grantPermission(toolName, globalScope, 'allow-always');

      // Set global configuration (lenient)
      permissionManager.setToolConfig(toolName, { enabled: true }, globalScope);

      // Set specific scope configuration (strict)
      permissionManager.setToolConfig(toolName, {
        enabled: true,
        requireConfirmation: true
      }, specificScope);

      // Global scope should be allowed without confirmation
      let result = await permissionManager.checkToolPermission(toolName);
      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);

      // Specific scope should require confirmation despite global permission
      result = await permissionManager.checkToolPermission(toolName, { scope: specificScope });
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should resolve conflicts between permission levels and configuration settings', async () => {
      const toolName: AgentTool = 'Bash';
      const scope = 'rm -rf /dangerous/path';

      // Grant allow-once permission (user explicitly allowed once)
      await permissionManager.grantPermission(toolName, scope, 'allow-once');

      // Set configuration to disabled (system policy)
      permissionManager.setToolConfig(toolName, { enabled: false }, scope);

      // Configuration should override permission
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('disabled');

      // Enable tool but require confirmation
      permissionManager.setToolConfig(toolName, {
        enabled: true,
        requireConfirmation: true
      }, scope);

      // Should require confirmation despite having permission
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.requiresConfirmation).toBe(true);

      // Remove configuration restriction
      permissionManager.setToolConfig(toolName, null, scope);

      // Now the permission should work normally (and be consumed)
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Permission should be consumed
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should maintain configuration-permission relationships across complex workflows', async () => {
      const tools: AgentTool[] = ['Read', 'Write', 'Edit'];
      const scope = '/project/workflow-test/';

      // Set up complex configuration for each tool
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, scope, 'allow-always');

        if (tool === 'Read') {
          // Read: always enabled, no confirmation
          permissionManager.setToolConfig(tool, { enabled: true }, scope);
        } else if (tool === 'Write') {
          // Write: enabled but requires confirmation
          permissionManager.setToolConfig(tool, {
            enabled: true,
            requireConfirmation: true
          }, scope);
        } else if (tool === 'Edit') {
          // Edit: disabled entirely
          permissionManager.setToolConfig(tool, { enabled: false }, scope);
        }
      }

      // Simulate workflow progression with changing requirements

      // Phase 1: Initial state
      let readResult = await permissionManager.checkToolPermission('Read', { scope });
      let writeResult = await permissionManager.checkToolPermission('Write', { scope });
      let editResult = await permissionManager.checkToolPermission('Edit', { scope });

      expect(readResult.allowed).toBe(true);
      expect(writeResult.requiresConfirmation).toBe(true);
      expect(editResult.allowed).toBe(false);

      // Phase 2: Emergency mode - enable all tools temporarily
      for (const tool of tools) {
        permissionManager.setToolConfig(tool, { enabled: true }, scope);
      }

      readResult = await permissionManager.checkToolPermission('Read', { scope });
      writeResult = await permissionManager.checkToolPermission('Write', { scope });
      editResult = await permissionManager.checkToolPermission('Edit', { scope });

      expect(readResult.allowed).toBe(true);
      expect(writeResult.allowed).toBe(true);
      expect(editResult.allowed).toBe(true);

      // Phase 3: Back to restricted mode
      permissionManager.setToolConfig('Read', { enabled: true }, scope);
      permissionManager.setToolConfig('Write', {
        enabled: true,
        requireConfirmation: true
      }, scope);
      permissionManager.setToolConfig('Edit', { enabled: false }, scope);

      readResult = await permissionManager.checkToolPermission('Read', { scope });
      writeResult = await permissionManager.checkToolPermission('Write', { scope });
      editResult = await permissionManager.checkToolPermission('Edit', { scope });

      expect(readResult.allowed).toBe(true);
      expect(writeResult.requiresConfirmation).toBe(true);
      expect(editResult.allowed).toBe(false);
    });
  });
});