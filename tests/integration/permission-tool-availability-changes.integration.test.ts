/**
 * @fileoverview Permission Changes Affecting Tool Availability Integration Tests
 *
 * This test suite verifies that permission changes directly affect tool availability
 * and that the session cache updates correctly when permissions are modified.
 *
 * Acceptance Criteria:
 * - Tests verify that granting permission enables tool access
 * - Tests verify that revoking permission disables tool access
 * - Tests verify that permission level upgrades/downgrades work correctly
 * - Tests verify that session cache updates correctly
 * - All tests pass
 *
 * Test scenarios covered:
 * - Granting allow-always permission enables tool access
 * - Granting allow-once permission enables single-use tool access
 * - Revoking permission disables previously enabled tool access
 * - Upgrading from allow-once to allow-always
 * - Downgrading from allow-always to allow-once
 * - Changing from allow to deny
 * - Session cache consistency during permission changes
 * - Multiple tools permission changes simultaneously
 * - Scope-specific permission changes
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
  ToolPermissionResult,
  AgentTool,
} from '@apexcli/core';

describe('Permission Changes Affecting Tool Availability Integration Tests', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let eventLog: Array<{ type: string; data: any; timestamp: number }>;

  beforeEach(async () => {
    // Create isolated test environment
    tempDir = await mkdtemp(join(tmpdir(), 'apex-permission-tool-availability-test-'));

    // Create .apex directory structure
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });
    await mkdir(join(apexDir, 'agents'), { recursive: true });
    await mkdir(join(apexDir, 'workflows'), { recursive: true });

    // Create test configuration
    const configContent = `
project:
  name: permission-tool-availability-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: manual
  presets:
    manual:
      tools: {}  # Start with no preset permissions

agents:
  test-agent:
    role: "Test agent for permission validation"
    model: sonnet
    tools: [Read, Write, Edit, Bash, Grep, Glob]

workflows:
  test-workflow:
    name: "Test Workflow"
    agents: [test-agent]
    stages:
      - name: test-stage
        agent: test-agent
        description: "Test stage for permission validation"

limits:
  maxTasksPerHour: 100
  maxCostPerTask: 10.0
  maxConcurrentTasks: 5
`;

    await writeFile(join(apexDir, 'config.yaml'), configContent);

    // Create test agent file
    await writeFile(
      join(apexDir, 'agents', 'test-agent.md'),
      `---
name: test-agent
description: Test agent for permission validation
tools: [Read, Write, Edit, Bash, Grep, Glob]
---

You are a test agent that validates tool-permission interactions.`
    );

    // Initialize orchestrator and components
    orchestrator = new ApexOrchestrator(tempDir, {
      maxTasksPerHour: 100,
      maxCostPerTask: 10,
      maxConcurrentTasks: 5,
      enableAuditLog: true,
    });

    await orchestrator.initialize();

    // Get component instances for direct testing
    permissionManager = orchestrator.permissionManager;
    permissionStore = orchestrator.permissionStore;

    // Setup event logging
    eventLog = [];
    const originalEmit = orchestrator.emit.bind(orchestrator);
    vi.spyOn(orchestrator, 'emit').mockImplementation((event: string, ...args: any[]) => {
      eventLog.push({
        type: event,
        data: args[0],
        timestamp: Date.now(),
      });
      return originalEmit(event, ...args);
    });

    // Reset session to ensure clean state
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
  // Granting Permission Enables Tool Access
  // ============================================================================

  describe('Granting Permission Enables Tool Access', () => {
    it('should enable tool access when granting allow-always permission', async () => {
      const toolName: AgentTool = 'Read';
      const scope = '/project/src/**';

      // Initially, tool should be denied (no permission granted)
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();

      // Grant allow-always permission
      await permissionManager.grantPermission(toolName, scope, 'allow-always');

      // Tool should now be allowed
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.denialReason).toBeUndefined();
    });

    it('should enable single-use tool access when granting allow-once permission', async () => {
      const toolName: AgentTool = 'Write';
      const scope = '/tmp/test-file.txt';

      // Initially, tool should be denied
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();

      // Grant allow-once permission
      await permissionManager.grantPermission(toolName, scope, 'allow-once');

      // First check should be allowed and consume the permission
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Second check should be denied (permission was consumed)
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should enable tool access with non-consuming check for allow-once permissions', async () => {
      const toolName: AgentTool = 'Edit';
      const scope = '/project/config.yaml';

      // Grant allow-once permission
      await permissionManager.grantPermission(toolName, scope, 'allow-once');

      // Non-consuming check should show permission exists but not consume it
      let result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Another non-consuming check should still show permission exists
      result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Consuming check should work and consume the permission
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Now permission should be consumed
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should enable tool access for multiple tools simultaneously', async () => {
      const tools: AgentTool[] = ['Read', 'Grep', 'Glob'];
      const scope = '/project/**';

      // Initially, all tools should be denied
      for (const tool of tools) {
        const result = await permissionManager.checkToolPermission(tool, { scope });
        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
      }

      // Grant allow-always permission for all tools
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, scope, 'allow-always');
      }

      // All tools should now be allowed
      for (const tool of tools) {
        const result = await permissionManager.checkToolPermission(tool, { scope });
        expect(result.allowed).toBe(true);
        expect(result.level).toBe('allow-always');
      }
    });

    it('should enable scope-specific tool access', async () => {
      const toolName: AgentTool = 'Bash';
      const allowedScope = 'npm install';
      const deniedScope = 'rm -rf /';

      // Grant permission only for npm install scope
      await permissionManager.grantPermission(toolName, allowedScope, 'allow-always');

      // Check allowed scope
      let result = await permissionManager.checkToolPermission(toolName, { scope: allowedScope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');

      // Check denied scope (no permission granted)
      result = await permissionManager.checkToolPermission(toolName, { scope: deniedScope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });
  });

  // ============================================================================
  // Revoking Permission Disables Tool Access
  // ============================================================================

  describe('Revoking Permission Disables Tool Access', () => {
    it('should disable tool access when revoking allow-always permission', async () => {
      const toolName: AgentTool = 'Write';
      const scope = '/project/output.txt';

      // Grant permission first
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);

      // Revoke permission
      const wasRevoked = await permissionManager.revokePermission(toolName, scope);
      expect(wasRevoked).toBe(true);

      // Tool should now be denied
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should disable tool access when revoking allow-once permission from session cache', async () => {
      const toolName: AgentTool = 'Edit';
      const scope = '/tmp/session-file.txt';

      // Grant allow-once permission (stored in session cache)
      await permissionManager.grantPermission(toolName, scope, 'allow-once');

      // Verify permission exists in session cache
      let result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Revoke permission
      const wasRevoked = await permissionManager.revokePermission(toolName, scope);
      expect(wasRevoked).toBe(true);

      // Tool should now be denied
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should handle revoking non-existent permissions gracefully', async () => {
      const toolName: AgentTool = 'Bash';
      const scope = 'non-existent-command';

      // Try to revoke a permission that was never granted
      const wasRevoked = await permissionManager.revokePermission(toolName, scope);
      expect(wasRevoked).toBe(false);

      // Tool should remain denied
      const result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should disable tool access for multiple scopes when revoked', async () => {
      const toolName: AgentTool = 'Read';
      const scopes = ['/project/file1.txt', '/project/file2.txt', '/project/file3.txt'];

      // Grant permissions for all scopes
      for (const scope of scopes) {
        await permissionManager.grantPermission(toolName, scope, 'allow-always');
      }

      // Verify all are allowed
      for (const scope of scopes) {
        const result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(true);
      }

      // Revoke permissions for all scopes
      for (const scope of scopes) {
        const wasRevoked = await permissionManager.revokePermission(toolName, scope);
        expect(wasRevoked).toBe(true);
      }

      // Verify all are now denied
      for (const scope of scopes) {
        const result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
      }
    });

    it('should preserve other permissions when revoking specific scope', async () => {
      const toolName: AgentTool = 'Grep';
      const allowedScope = '*.ts';
      const revokedScope = '*.js';

      // Grant permissions for both scopes
      await permissionManager.grantPermission(toolName, allowedScope, 'allow-always');
      await permissionManager.grantPermission(toolName, revokedScope, 'allow-always');

      // Revoke permission for one scope only
      await permissionManager.revokePermission(toolName, revokedScope);

      // Allowed scope should still work
      let result = await permissionManager.checkToolPermission(toolName, { scope: allowedScope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');

      // Revoked scope should be denied
      result = await permissionManager.checkToolPermission(toolName, { scope: revokedScope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });
  });

  // ============================================================================
  // Permission Level Upgrades/Downgrades
  // ============================================================================

  describe('Permission Level Upgrades/Downgrades', () => {
    it('should upgrade from allow-once to allow-always', async () => {
      const toolName: AgentTool = 'Write';
      const scope = '/project/upgrade-test.txt';

      // Start with allow-once permission
      await permissionManager.grantPermission(toolName, scope, 'allow-once');
      let result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.level).toBe('allow-once');

      // Upgrade to allow-always
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');

      // Multiple checks should continue to work (not consumed)
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
    });

    it('should downgrade from allow-always to allow-once', async () => {
      const toolName: AgentTool = 'Edit';
      const scope = '/project/downgrade-test.txt';

      // Start with allow-always permission
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.level).toBe('allow-always');

      // Downgrade to allow-once
      await permissionManager.grantPermission(toolName, scope, 'allow-once');
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Second check should be denied (allow-once was consumed)
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should change from allow-always to deny', async () => {
      const toolName: AgentTool = 'Bash';
      const scope = 'sudo rm -rf /';

      // Start with allow-always permission (dangerous but for testing)
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');

      // Change to explicit deny
      await permissionManager.grantPermission(toolName, scope, 'deny');
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toBeDefined();
      expect(result.denialReason).toContain('explicitly denied');
    });

    it('should change from allow-once to deny', async () => {
      const toolName: AgentTool = 'Read';
      const scope = '/etc/passwd';

      // Start with allow-once permission
      await permissionManager.grantPermission(toolName, scope, 'allow-once');
      let result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.level).toBe('allow-once');

      // Change to explicit deny
      await permissionManager.grantPermission(toolName, scope, 'deny');
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toBeDefined();
    });

    it('should change from deny to allow-always', async () => {
      const toolName: AgentTool = 'Glob';
      const scope = '/safe/project/**';

      // Start with explicit deny
      await permissionManager.grantPermission(toolName, scope, 'deny');
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');

      // Change to allow-always
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
    });

    it('should handle rapid permission level changes', async () => {
      const toolName: AgentTool = 'Write';
      const scope = '/project/rapid-change-test.txt';
      const levels: PermissionLevel[] = ['allow-once', 'allow-always', 'deny', 'allow-always', 'allow-once'];

      // Rapidly change permission levels
      for (const level of levels) {
        await permissionManager.grantPermission(toolName, scope, level);
        const result = await permissionManager.checkToolPermission(toolName, {
          scope,
          consumeAllowOnce: false
        });
        expect(result.level).toBe(level);

        if (level === 'deny') {
          expect(result.allowed).toBe(false);
        } else {
          expect(result.allowed).toBe(true);
        }
      }
    });
  });

  // ============================================================================
  // Session Cache Updates
  // ============================================================================

  describe('Session Cache Updates', () => {
    it('should update session cache when granting allow-once permissions', async () => {
      const toolName: AgentTool = 'Read';
      const scope = '/project/session-test.txt';

      // Grant allow-once permission (should be stored in session cache)
      await permissionManager.grantPermission(toolName, scope, 'allow-once');

      // Check without consuming to verify it's in cache
      let result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Consume the permission
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Should be removed from cache after consumption
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should clear session cache when session is reset', async () => {
      const toolName: AgentTool = 'Edit';
      const scope = '/project/reset-test.txt';

      // Grant allow-once permission
      await permissionManager.grantPermission(toolName, scope, 'allow-once');
      let result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.allowed).toBe(true);

      // Reset session
      permissionManager.resetSession();

      // Permission should no longer be available
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should update session cache when upgrading from persistent to allow-once', async () => {
      const toolName: AgentTool = 'Bash';
      const scope = 'git status';

      // Start with persistent allow-always permission
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.level).toBe('allow-always');

      // Upgrade to allow-once (should move to session cache)
      await permissionManager.grantPermission(toolName, scope, 'allow-once');
      result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.level).toBe('allow-once');

      // Consume permission
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);

      // Should be consumed and not available anymore
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should maintain cache consistency across multiple permission operations', async () => {
      const tools: AgentTool[] = ['Read', 'Write', 'Edit'];
      const scope = '/project/consistency-test.txt';

      // Grant allow-once for all tools
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, scope, 'allow-once');
      }

      // Verify all are in session cache
      for (const tool of tools) {
        const result = await permissionManager.checkToolPermission(tool, {
          scope,
          consumeAllowOnce: false
        });
        expect(result.level).toBe('allow-once');
      }

      // Upgrade one to allow-always, revoke one, keep one as allow-once
      await permissionManager.grantPermission('Read', scope, 'allow-always');
      await permissionManager.revokePermission('Write', scope);
      // Edit remains allow-once

      // Verify final states
      let result = await permissionManager.checkToolPermission('Read', { scope });
      expect(result.level).toBe('allow-always');

      result = await permissionManager.checkToolPermission('Write', { scope });
      expect(result.level).toBeNull();

      result = await permissionManager.checkToolPermission('Edit', {
        scope,
        consumeAllowOnce: false
      });
      expect(result.level).toBe('allow-once');
    });

    it('should handle session cache when allow-once permissions expire or are revoked', async () => {
      const toolName: AgentTool = 'Grep';
      const scope = '*.log';

      // Grant allow-once permission (stored in session cache)
      await permissionManager.grantPermission(toolName, scope, 'allow-once');

      // Verify it's in cache
      let result = await permissionManager.checkToolPermission(toolName, {
        scope,
        consumeAllowOnce: false
      });
      expect(result.level).toBe('allow-once');

      // Revoke the permission
      await permissionManager.revokePermission(toolName, scope);

      // Should be removed from session cache
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should preserve persistent permissions when session cache is cleared', async () => {
      const toolName: AgentTool = 'Glob';
      const scope = '/project/**';

      // Grant persistent allow-always permission
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.level).toBe('allow-always');

      // Reset session cache
      permissionManager.resetSession();

      // Persistent permission should still be available
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle permission checks for undefined/null scopes consistently', async () => {
      const toolName: AgentTool = 'Read';

      // Grant permission without scope
      await permissionManager.grantPermission(toolName, undefined, 'allow-always');

      // Check without scope should work
      let result = await permissionManager.checkToolPermission(toolName);
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');

      // Check with scope should not match the scopeless permission
      result = await permissionManager.checkToolPermission(toolName, { scope: '/some/path' });
      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
    });

    it('should handle concurrent permission operations safely', async () => {
      const toolName: AgentTool = 'Write';
      const scope = '/project/concurrent-test.txt';

      // Perform multiple permission operations concurrently
      const operations = [
        permissionManager.grantPermission(toolName, scope, 'allow-once'),
        permissionManager.grantPermission(toolName, scope, 'allow-always'),
        permissionManager.revokePermission(toolName, scope),
        permissionManager.grantPermission(toolName, scope, 'deny'),
      ];

      // All operations should complete without throwing
      await Promise.all(operations);

      // Final state should be deterministic (last operation wins)
      const result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.level).toBe('deny');
      expect(result.allowed).toBe(false);
    });

    it('should maintain data integrity during session resets with active permissions', async () => {
      const persistentTool: AgentTool = 'Read';
      const sessionTool: AgentTool = 'Write';
      const scope = '/project/integrity-test.txt';

      // Set up both persistent and session permissions
      await permissionManager.grantPermission(persistentTool, scope, 'allow-always');
      await permissionManager.grantPermission(sessionTool, scope, 'allow-once');

      // Verify both are accessible
      let persistentResult = await permissionManager.checkToolPermission(persistentTool, { scope });
      let sessionResult = await permissionManager.checkToolPermission(sessionTool, {
        scope,
        consumeAllowOnce: false
      });
      expect(persistentResult.allowed).toBe(true);
      expect(sessionResult.allowed).toBe(true);

      // Reset session
      permissionManager.resetSession();

      // Persistent permission should survive, session permission should be gone
      persistentResult = await permissionManager.checkToolPermission(persistentTool, { scope });
      sessionResult = await permissionManager.checkToolPermission(sessionTool, { scope });
      expect(persistentResult.allowed).toBe(true);
      expect(sessionResult.allowed).toBe(false);
    });

    it('should handle permission changes on non-existent tools gracefully', async () => {
      const nonExistentTool = 'NonExistentTool' as AgentTool;
      const scope = '/any/path';

      // These operations should not throw, even for non-existent tools
      await expect(
        permissionManager.grantPermission(nonExistentTool, scope, 'allow-always')
      ).resolves.toBeUndefined();

      const result = await permissionManager.checkToolPermission(nonExistentTool, { scope });
      expect(result.allowed).toBe(true); // Permission was granted, regardless of tool existence
      expect(result.level).toBe('allow-always');

      const wasRevoked = await permissionManager.revokePermission(nonExistentTool, scope);
      expect(wasRevoked).toBe(true);
    });
  });
});