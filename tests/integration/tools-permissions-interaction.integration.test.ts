/**
 * @fileoverview Tools-Permissions Interaction Integration Tests
 *
 * This test suite verifies the interaction between the tool system and the
 * permission system in APEX. It ensures that:
 *
 * 1. Tools respect permission configurations
 * 2. Permission grants/denials affect tool execution
 * 3. Custom tools integrate properly with the permission system
 * 4. Permission presets correctly configure tool access
 * 5. Cross-system workflows function correctly
 *
 * Acceptance Criteria:
 * - Test file exists at the specified location
 * - Proper setup/teardown infrastructure
 * - Correct imports from APEX packages
 * - At least one passing placeholder test
 *
 * Integration scenarios covered:
 * - Tool permission checks before execution
 * - Permission grant impact on tool availability
 * - Permission denial enforcement across tool types
 * - Preset-based tool permission configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  ApexOrchestrator,
  PermissionManager,
  PermissionStore,
  PermissionPresetManager,
} from '@apexcli/orchestrator';
import type {
  PermissionLevel,
  ToolPermissionCheckOptions,
} from '@apexcli/core';

describe('Tools-Permissions Interaction Integration Tests', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let presetManager: PermissionPresetManager;
  let eventLog: Array<{ type: string; data: any; timestamp: number }>;

  beforeEach(async () => {
    // Create isolated test environment
    tempDir = await mkdtemp(join(tmpdir(), 'apex-tools-permissions-interaction-test-'));

    // Create .apex directory structure
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });
    await mkdir(join(apexDir, 'agents'), { recursive: true });
    await mkdir(join(apexDir, 'workflows'), { recursive: true });

    // Create comprehensive test configuration
    const configContent = `
project:
  name: tools-permissions-interaction-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all
  presets:
    autonomous:
      tools:
        Read: allow
        Write: allow
        Edit: allow
        Bash: allow
        Grep: allow
        Glob: allow
    review-all:
      tools:
        Read: confirm
        Write: confirm
        Edit: confirm
        Bash: confirm
        Grep: confirm
        Glob: confirm
    read-only:
      tools:
        Read: allow
        Write: deny
        Edit: deny
        Bash: deny
        Grep: allow
        Glob: allow

customTools:
  - name: TestTool
    description: A test tool for permission integration testing
    command: echo
    args: ['{{input.message}}']
    parameters:
      type: object
      properties:
        message:
          type: string
      required: [message]
      additionalProperties: false
    outputParser: text
    timeoutMs: 5000
    enabled: true

agents:
  test-agent:
    role: "Test agent for permission validation"
    model: sonnet
    tools: [Read, Write, Edit, Bash, Grep, Glob, TestTool]

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

audit:
  enabled: true
  location: ${apexDir}/audit.log
`;

    await writeFile(join(apexDir, 'config.yaml'), configContent);

    // Create test agent file
    await writeFile(
      join(apexDir, 'agents', 'test-agent.md'),
      `---
name: test-agent
description: Test agent for permission validation
tools: [Read, Write, Edit, Bash, Grep, Glob, TestTool]
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
    presetManager = orchestrator.presetManager;

    // Setup event logging for comprehensive verification
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
  // Infrastructure Validation Tests
  // ============================================================================

  describe('Infrastructure Validation', () => {
    it('should have test infrastructure correctly configured', async () => {
      // Verify orchestrator is initialized
      expect(orchestrator).toBeDefined();

      // Verify permission manager is available
      expect(permissionManager).toBeDefined();

      // Verify permission store is available
      expect(permissionStore).toBeDefined();

      // Verify preset manager is available
      expect(presetManager).toBeDefined();

      // Verify temp directory exists
      expect(tempDir).toBeDefined();
      expect(tempDir).toContain('apex-tools-permissions-interaction-test-');

      // Verify event logging is set up
      expect(eventLog).toBeDefined();
      expect(Array.isArray(eventLog)).toBe(true);
    });

    it('should have custom tools server initialized when custom tools are configured', async () => {
      // Verify custom tools server is created
      expect(orchestrator.customToolsServer).toBeDefined();
      expect(orchestrator.customToolsServer?.name).toBe('custom-tools');
    });

    it('should be able to check tool permissions', async () => {
      // Test that permission check doesn't throw
      const result = await permissionManager.checkPermission('Read');
      // Initial check should return null (no explicit permission set)
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  // ============================================================================
  // Tool Permission Check Flow
  // ============================================================================

  describe('Tool Permission Check Flow', () => {
    it('should verify basic tool permission checking', async () => {
      // Grant a permission
      await permissionManager.grantPermission('Read', '/tmp/test.txt', 'allow-always');

      // Check tool permission using the comprehensive permission check
      const result = await permissionManager.checkToolPermission('Read', { scope: '/tmp/test.txt' });

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.denialReason).toBeUndefined();
    });

    it('should block tool execution when no permission exists', async () => {
      // Don't grant any permission for Write tool
      const result = await permissionManager.checkToolPermission('Write', { scope: '/tmp/test.txt' });

      expect(result.allowed).toBe(false);
      expect(result.level).toBeNull();
      expect(result.denialReason).toBeDefined();
      expect(result.requiresConfirmation).toBe(false);
    });

    it('should handle allow-once permissions correctly', async () => {
      // Grant allow-once permission
      await permissionManager.grantPermission('Edit', '/tmp/test.txt', 'allow-once');

      // First check should allow and consume the permission
      const firstCheck = await permissionManager.checkToolPermission('Edit', { scope: '/tmp/test.txt' });
      expect(firstCheck.allowed).toBe(true);
      expect(firstCheck.level).toBe('allow-once');

      // Second check should be denied as the allow-once permission was consumed
      const secondCheck = await permissionManager.checkToolPermission('Edit', { scope: '/tmp/test.txt' });
      expect(secondCheck.allowed).toBe(false);
      expect(secondCheck.level).toBeNull();
    });

    it('should respect tool configuration settings', async () => {
      // Grant permission but configure tool to require confirmation
      await permissionManager.grantPermission('Bash', '/bin/ls', 'allow-always');

      // Set tool configuration to require confirmation
      permissionManager.setToolConfig('Bash', {
        enabled: true,
        requireConfirmation: true,
        timeout: 5000,
        rateLimitPerMinute: 0,
      }, '/bin/ls');

      const result = await permissionManager.checkToolPermission('Bash', { scope: '/bin/ls' });

      expect(result.allowed).toBe(false); // Should be false because confirmation is required
      expect(result.requiresConfirmation).toBe(true);
      expect(result.denialReason).toContain('requires user confirmation');
    });
  });

  // ============================================================================
  // Permission Grant Impact on Tools
  // ============================================================================

  describe('Permission Grant Impact on Tools', () => {
    it('should allow tool execution when permission is granted', async () => {
      // Apply autonomous preset (all tools allowed)
      await presetManager.applyPreset('autonomous');

      // Check that tool is allowed
      const isAllowed = await presetManager.isToolAllowed('Write');
      expect(isAllowed).toBe(true);

      // Verify with comprehensive permission check
      const result = await permissionManager.checkToolPermission('Write', { scope: '/project/file.txt' });
      expect(result.allowed).toBe(true);
    });

    it('should dynamically affect tool availability when permissions change', async () => {
      // Initially no permission - should be denied
      let result = await permissionManager.checkToolPermission('Grep', { scope: '*.ts' });
      expect(result.allowed).toBe(false);

      // Grant permission - should be allowed
      await permissionManager.grantPermission('Grep', '*.ts', 'allow-always');
      result = await permissionManager.checkToolPermission('Grep', { scope: '*.ts' });
      expect(result.allowed).toBe(true);

      // Revoke permission - should be denied again
      await permissionManager.revokePermission('Grep', '*.ts');
      result = await permissionManager.checkToolPermission('Grep', { scope: '*.ts' });
      expect(result.allowed).toBe(false);
    });

    it('should handle preset-based permissions correctly', async () => {
      // Apply read-only preset
      await presetManager.applyPreset('read-only');

      // Read tools should be allowed
      const readResult = await permissionManager.checkToolPermission('Read', { scope: '/tmp/test.txt' });
      expect(readResult.allowed).toBe(true);

      // Grep should be allowed (read-only operation)
      const grepResult = await permissionManager.checkToolPermission('Grep', { scope: '*.js' });
      expect(grepResult.allowed).toBe(true);

      // Write operations should be denied
      const writeResult = await permissionManager.checkToolPermission('Write', { scope: '/tmp/test.txt' });
      expect(writeResult.allowed).toBe(false);

      // Bash should be denied (potentially dangerous)
      const bashResult = await permissionManager.checkToolPermission('Bash', { scope: 'ls -la' });
      expect(bashResult.allowed).toBe(false);
    });
  });

  // ============================================================================
  // Permission Denial Enforcement
  // ============================================================================

  describe('Permission Denial Enforcement', () => {
    it('should deny tool execution when permission is explicitly denied', async () => {
      // Explicitly grant deny permission
      await permissionManager.grantPermission('Bash', '/usr/bin/rm', 'deny');

      // Check that tool is denied
      const result = await permissionManager.checkToolPermission('Bash', { scope: '/usr/bin/rm' });
      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toBeDefined();
    });

    it('should enforce preset-based denials', async () => {
      // Apply read-only preset (write tools denied)
      await presetManager.applyPreset('read-only');

      // Check that write tool is denied
      const isDenied = await presetManager.isToolDenied('Write');
      expect(isDenied).toBe(true);

      // Verify with comprehensive permission check
      const writeResult = await permissionManager.checkToolPermission('Write', { scope: '/tmp/test.txt' });
      expect(writeResult.allowed).toBe(false);

      // Check that read tool is still allowed
      const isReadAllowed = await presetManager.isToolAllowed('Read');
      expect(isReadAllowed).toBe(true);

      const readResult = await permissionManager.checkToolPermission('Read', { scope: '/tmp/test.txt' });
      expect(readResult.allowed).toBe(true);
    });

    it('should handle tool configuration-based blocking', async () => {
      // Grant permission but disable the tool via config
      await permissionManager.grantPermission('WebFetch', 'https://example.com', 'allow-always');

      // Set tool configuration to disabled
      permissionManager.setToolConfig('WebFetch', {
        enabled: false,
        timeout: 5000,
        rateLimitPerMinute: 0,
      }, 'https://example.com');

      const result = await permissionManager.checkToolPermission('WebFetch', { scope: 'https://example.com' });

      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Tool is disabled');
    });

    it('should handle unauthorized tool access attempts', async () => {
      // Try to access various tools without any permissions
      const tools = ['Read', 'Write', 'Edit', 'Bash', 'Browser', 'WebFetch', 'WebSearch'];

      for (const tool of tools) {
        const result = await permissionManager.checkToolPermission(tool, { scope: 'test-scope' });
        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
        expect(result.denialReason).toBeDefined();
      }
    });
  });

  // ============================================================================
  // Cross-System Integration
  // ============================================================================

  describe('Cross-System Integration', () => {
    it('should handle permission workflow with event emission', async () => {
      // Clear event log for clean test
      eventLog.length = 0;

      // Grant a permission through the permission manager
      await permissionManager.grantPermission('Write', '/tmp/test-file.txt', 'allow-always');

      // Check that the permission was granted
      const permission = await permissionManager.checkPermission('Write', '/tmp/test-file.txt');
      expect(permission).toBe('allow-always');

      // Verify permission was stored in the manager
      const hasPermission = await permissionManager.hasPermission('Write', '/tmp/test-file.txt');
      expect(hasPermission).toBe(true);
    });

    it('should handle permission changes affecting tool availability', async () => {
      // Start with no permissions
      let result = await permissionManager.checkToolPermission('Edit', { scope: '/project/src/main.ts' });
      expect(result.allowed).toBe(false);

      // Apply a preset that allows editing
      await presetManager.applyPreset('autonomous');

      // Tool should now be available
      result = await permissionManager.checkToolPermission('Edit', { scope: '/project/src/main.ts' });
      expect(result.allowed).toBe(true);

      // Switch to restrictive preset
      await presetManager.applyPreset('read-only');

      // Edit tool should now be blocked
      result = await permissionManager.checkToolPermission('Edit', { scope: '/project/src/main.ts' });
      expect(result.allowed).toBe(false);
    });

    it('should handle custom tool permissions', async () => {
      // Grant permission for the custom test tool
      await permissionManager.grantPermission('TestTool', 'test-message', 'allow-always');

      // Check permission
      const result = await permissionManager.checkToolPermission('TestTool', { scope: 'test-message' });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');
    });

    it('should handle complex permission scenarios with path validation', async () => {
      // Grant permissions with directory access control
      await permissionManager.grantPermission('Read', '/project/src/*', 'allow-always');

      // Configure directory access for the tool
      permissionManager.setToolConfig('Read', {
        enabled: true,
        timeout: 5000,
        rateLimitPerMinute: 0,
        directoryAccess: {
          allowlist: ['/project/src/**'],
          blocklist: ['/project/src/secrets/**'],
          defaultAllow: false,
          resolveSymlinks: true,
          maxDepth: 10
        }
      });

      // Check permission for allowed path
      let result = await permissionManager.checkToolPermission('Read', {
        scope: '/project/src/main.ts',
        path: '/project/src/main.ts'
      });
      expect(result.allowed).toBe(true);

      // Check permission for blocked path
      result = await permissionManager.checkToolPermission('Read', {
        scope: '/project/src/secrets/api.key',
        path: '/project/src/secrets/api.key'
      });
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('Directory access denied');
    });

    it('should handle concurrent permission checks', async () => {
      // Grant permissions for multiple tools
      await Promise.all([
        permissionManager.grantPermission('Read', '*.ts', 'allow-always'),
        permissionManager.grantPermission('Write', '*.ts', 'allow-once'),
        permissionManager.grantPermission('Grep', '*.ts', 'allow-always'),
      ]);

      // Perform concurrent permission checks
      const checks = await Promise.all([
        permissionManager.checkToolPermission('Read', { scope: '*.ts' }),
        permissionManager.checkToolPermission('Write', { scope: '*.ts' }),
        permissionManager.checkToolPermission('Grep', { scope: '*.ts' }),
      ]);

      // All should be allowed
      checks.forEach(result => {
        expect(result.allowed).toBe(true);
      });

      // Second write check should fail (allow-once was consumed)
      const secondWriteCheck = await permissionManager.checkToolPermission('Write', { scope: '*.ts' });
      expect(secondWriteCheck.allowed).toBe(false);
    });

    it('should handle error scenarios gracefully', async () => {
      // Test with invalid tool name
      const result = await permissionManager.checkToolPermission('InvalidTool', { scope: 'test' });
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toBeDefined();

      // Test with malformed scope
      const malformedResult = await permissionManager.checkToolPermission('Read', { scope: '' });
      expect(malformedResult.allowed).toBe(false);
    });
  });

  // ============================================================================
  // Permission Change Events and Notifications
  // ============================================================================

  describe('Permission Change Events and Notifications', () => {
    it('should emit events when permissions are granted', async () => {
      // Clear event log
      eventLog.length = 0;

      // Grant a permission
      await permissionManager.grantPermission('Browser', 'https://example.com', 'allow-always');

      // Check for permission-related events
      const permissionEvents = eventLog.filter(event =>
        event.type.includes('permission') || event.type.includes('tool')
      );

      // Verify that some permission-related activity was logged
      expect(eventLog.length).toBeGreaterThan(0);
    });

    it('should handle permission revocation events', async () => {
      // Grant initial permission
      await permissionManager.grantPermission('Edit', '/tmp/revoke-test.txt', 'allow-always');

      // Clear event log after initial setup
      eventLog.length = 0;

      // Revoke the permission
      const revoked = await permissionManager.revokePermission('Edit', '/tmp/revoke-test.txt');
      expect(revoked).toBe(true);

      // Check that permission is actually revoked
      const result = await permissionManager.checkToolPermission('Edit', { scope: '/tmp/revoke-test.txt' });
      expect(result.allowed).toBe(false);
    });

    it('should handle permission transitions correctly', async () => {
      const toolName = 'Bash';
      const scope = 'test-command';

      // Start with no permission
      let result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);

      // Grant allow-once permission
      await permissionManager.grantPermission(toolName, scope, 'allow-once');
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-once');

      // Second check should fail (consumed)
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);

      // Grant allow-always permission
      await permissionManager.grantPermission(toolName, scope, 'allow-always');
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('allow-always');

      // Multiple checks should still work
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(true);

      // Change to deny
      await permissionManager.grantPermission(toolName, scope, 'deny');
      result = await permissionManager.checkToolPermission(toolName, { scope });
      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe('Error Handling and Edge Cases', () => {
    // ========================================================================
    // Comprehensive Invalid Tool Names Tests
    // ========================================================================

    describe('Invalid Tool Names Handling', () => {
      it('should handle empty and whitespace tool names gracefully', async () => {
        const invalidNames = ['', '   ', '\t', '\n', '  \t\n  '];

        for (const toolName of invalidNames) {
          const result = await permissionManager.checkToolPermission(toolName, { scope: 'test' });
          expect(result.allowed).toBe(false);
          expect(result.denialReason).toMatch(/(invalid|empty|tool name|unknown)/i);
        }
      });

      it('should handle null and undefined tool names', async () => {
        const invalidNames = [null, undefined];

        for (const toolName of invalidNames) {
          try {
            const result = await permissionManager.checkToolPermission(toolName as any, { scope: 'test' });
            expect(result.allowed).toBe(false);
            expect(result.denialReason).toMatch(/(invalid|null|undefined|tool name|unknown)/i);
          } catch (error) {
            expect(error).toBeDefined();
            expect((error as Error).message).toMatch(/(invalid|null|undefined|tool name|required)/i);
          }
        }
      });

      it('should handle tool names with special characters', async () => {
        const specialCharNames = [
          'Tool@Name',
          'Tool#Name',
          'Tool$Name',
          'Tool&Name',
          'Tool*Name',
          'Tool+Name',
          'Tool Name', // with space
          'Tool.Name',
          'Tool/Name',
          'Tool\\Name',
        ];

        for (const toolName of specialCharNames) {
          const result = await permissionManager.checkToolPermission(toolName, { scope: 'test' });
          expect(result.allowed).toBe(false);
          expect(result.denialReason).toMatch(/(invalid|unknown|tool|name|not found)/i);
        }
      });

      it('should handle excessively long tool names', async () => {
        const longToolName = 'A'.repeat(1000);
        const result = await permissionManager.checkToolPermission(longToolName, { scope: 'test' });
        expect(result.allowed).toBe(false);
        expect(result.denialReason).toMatch(/(invalid|unknown|tool|name|too long|length)/i);
      });
    });

    // ========================================================================
    // Comprehensive Concurrent Permission Modifications Tests
    // ========================================================================

    describe('Concurrent Permission Modifications', () => {
      it('should handle concurrent permission grants without corruption', async () => {
        const toolName = 'ConcurrentTestTool';
        const paths = Array.from({ length: 10 }, (_, i) => `/concurrent/path/${i}`);

        // Perform concurrent permission grants
        const grantPromises = paths.map(async (path, index) => {
          const level = index % 3 === 0 ? 'allow-always' : index % 3 === 1 ? 'allow-once' : 'deny';
          try {
            await permissionManager.grantPermission(toolName, path, level);
            return { path, level, success: true };
          } catch (error) {
            return { path, level, success: false, error };
          }
        });

        const results = await Promise.all(grantPromises);

        // Verify that most operations succeeded (allow for some race conditions)
        const successCount = results.filter(r => r.success).length;
        expect(successCount).toBeGreaterThan(paths.length * 0.7); // At least 70% success rate

        // Verify data integrity for successful operations
        for (const result of results) {
          if (result.success) {
            const storedPermission = await permissionManager.checkPermission(toolName, result.path);
            expect(storedPermission).toBe(result.level);
          }
        }
      });

      it('should handle concurrent permission revocations', async () => {
        const toolName = 'RevocationTestTool';
        const paths = Array.from({ length: 8 }, (_, i) => `/revoke/path/${i}`);

        // First, grant permissions
        await Promise.all(paths.map(path =>
          permissionManager.grantPermission(toolName, path, 'allow-always')
        ));

        // Then perform concurrent revocations
        const revocationPromises = paths.map(async (path) => {
          try {
            await permissionManager.revokePermission(toolName, path);
            return { path, success: true };
          } catch (error) {
            return { path, success: false, error };
          }
        });

        const results = await Promise.all(revocationPromises);

        // Verify that most operations succeeded
        const successCount = results.filter(r => r.success).length;
        expect(successCount).toBeGreaterThan(paths.length * 0.7);

        // Verify that permissions were actually revoked for successful operations
        for (const result of results) {
          if (result.success) {
            const permission = await permissionManager.checkPermission(toolName, result.path);
            expect(permission).toBeNull();
          }
        }
      });

      it('should handle concurrent preset applications', async () => {
        const presets = ['autonomous', 'read-only', 'review-all'];
        const iterations = 3;

        // Perform concurrent preset applications
        const promises = [];
        for (let i = 0; i < iterations; i++) {
          for (const preset of presets) {
            promises.push(
              new Promise(resolve => {
                setTimeout(async () => {
                  try {
                    await presetManager.applyPreset(preset);
                    resolve({ preset, success: true, iteration: i });
                  } catch (error) {
                    resolve({ preset, success: false, error, iteration: i });
                  }
                }, Math.random() * 30); // Random delay up to 30ms
              })
            );
          }
        }

        const results = await Promise.all(promises);

        // At least some preset applications should succeed
        const successCount = results.filter((r: any) => r.success).length;
        expect(successCount).toBeGreaterThan(0);

        // Final state should be consistent
        const currentPreset = presetManager.getCurrentPreset();
        expect(presets).toContain(currentPreset);
      });

      it('should maintain consistency during mixed concurrent operations', async () => {
        const toolName = 'MixedOpsTestTool';
        const path = '/mixed/ops/path';

        // Perform mixed concurrent operations
        const operations = [
          () => permissionManager.grantPermission(toolName, path, 'allow-always'),
          () => permissionManager.checkPermission(toolName, path),
          () => permissionManager.hasPermission(toolName, path),
          () => permissionManager.checkToolPermission(toolName, { scope: path }),
        ];

        const promises = operations.map(async (op, index) => {
          try {
            const result = await op();
            return { index, success: true, result };
          } catch (error) {
            return { index, success: false, error };
          }
        });

        const results = await Promise.all(promises);

        // System should handle concurrent operations without crashing
        expect(results).toHaveLength(operations.length);

        // Most operations should succeed
        const successCount = results.filter(r => r.success).length;
        expect(successCount).toBeGreaterThan(operations.length * 0.5);

        // Final state should be consistent
        const finalPermission = await permissionManager.checkPermission(toolName, path);
        const finalHasPermission = await permissionManager.hasPermission(toolName, path);

        if (finalPermission !== null) {
          expect(finalHasPermission).toBe(true);
        } else {
          expect(finalHasPermission).toBe(false);
        }
      });
    });

    // ========================================================================
    // Comprehensive Database Error Handling Tests
    // ========================================================================

    describe('Database Error Handling', () => {
      it('should handle various database connection failures', async () => {
        // Create a backup of the original store
        const originalStore = permissionManager['store'];

        try {
          // Mock stores that throw different types of database errors
          const errorScenarios = [
            {
              name: 'connection_timeout',
              error: new Error('SQLITE_BUSY: database is locked')
            },
            {
              name: 'io_error',
              error: new Error('SQLITE_IOERR: disk I/O error')
            },
            {
              name: 'corrupt_database',
              error: new Error('SQLITE_CORRUPT: database disk image is malformed')
            },
            {
              name: 'permission_denied',
              error: new Error('SQLITE_CANTOPEN: unable to open database file')
            }
          ];

          for (const scenario of errorScenarios) {
            const failingStore = {
              async getPermission() { throw scenario.error; },
              async setPermission() { throw scenario.error; },
              async hasPermission() { throw scenario.error; },
              async deletePermission() { throw scenario.error; }
            };

            // @ts-ignore - Testing error conditions
            permissionManager['store'] = failingStore;

            try {
              const result = await permissionManager.checkPermission('TestTool', '/test');
              // If no error is thrown, verify graceful fallback
              expect(result === null || typeof result === 'string').toBe(true);
            } catch (error) {
              expect(error).toBeDefined();
              expect((error as Error).message).toMatch(/(database|sqlite|locked|corrupt|ioerr|cantopen)/i);
            }
          }

        } finally {
          // Restore the original store
          // @ts-ignore - Restoring after test
          permissionManager['store'] = originalStore;
        }
      });

      it('should handle data corruption scenarios', async () => {
        const originalStore = permissionManager['store'];

        try {
          // Mock a store that returns various types of corrupted data
          const corruptedData = [
            'invalid-json-string',
            { malformed: 'object', with: 'wrong', structure: true },
            12345,
            [],
            true,
            new Date(),
            Symbol('corrupt'),
            Buffer.from('corrupt data'),
          ];

          for (const corruptData of corruptedData) {
            const corruptedStore = {
              async getPermission() { return corruptData; },
              async setPermission() { return true; },
              async hasPermission() { return Boolean(corruptData); }
            };

            // @ts-ignore - Testing error conditions
            permissionManager['store'] = corruptedStore;

            try {
              const result = await permissionManager.checkPermission('TestTool', '/test');
              // System should handle corrupted data gracefully
              expect(result === null || typeof result === 'string').toBe(true);
            } catch (error) {
              // If an error is thrown, it should be meaningful
              expect(error).toBeDefined();
              expect((error as Error).message).toMatch(/(invalid|corrupt|data|malformed|unexpected)/i);
            }
          }

        } finally {
          // @ts-ignore - Restoring after test
          permissionManager['store'] = originalStore;
        }
      });

      it('should handle transaction rollback scenarios', async () => {
        let transactionCount = 0;
        const originalStore = permissionManager['store'];

        try {
          // Mock a store that fails transactions intermittently
          const unreliableStore = {
            async getPermission(tool: string, scope: string) {
              return await originalStore.getPermission(tool, scope);
            },
            async setPermission(tool: string, scope: string, level: string) {
              transactionCount++;
              if (transactionCount % 3 === 0) {
                throw new Error('SQLITE_BUSY: database transaction failed');
              }
              return await originalStore.setPermission(tool, scope, level);
            },
            async hasPermission(tool: string, scope: string) {
              return await originalStore.hasPermission(tool, scope);
            },
            async deletePermission(tool: string, scope: string) {
              return await originalStore.deletePermission(tool, scope);
            }
          };

          // @ts-ignore - Testing error conditions
          permissionManager['store'] = unreliableStore;

          // Attempt multiple permission grants
          const grantAttempts = [];
          for (let i = 0; i < 9; i++) {
            grantAttempts.push(
              permissionManager.grantPermission('TransactionTest', `/test/${i}`, 'allow-always')
                .then(() => ({ index: i, success: true }))
                .catch(error => ({ index: i, success: false, error }))
            );
          }

          const results = await Promise.all(grantAttempts);

          // Some should succeed, some should fail due to transaction failures
          const successCount = results.filter(r => r.success).length;
          const failureCount = results.filter(r => !r.success).length;

          expect(successCount).toBeGreaterThan(0);
          expect(failureCount).toBeGreaterThan(0);

          // Verify that successful grants are actually stored
          for (const result of results) {
            if (result.success) {
              const storedPermission = await permissionManager.checkPermission('TransactionTest', `/test/${result.index}`);
              expect(storedPermission).toBe('allow-always');
            }
          }

        } finally {
          // @ts-ignore - Restoring after test
          permissionManager['store'] = originalStore;
        }
      });
    });

    // ========================================================================
    // Original Edge Cases (Enhanced)
    // ========================================================================
    it('should handle database connection errors gracefully', async () => {
      // Force close the permission store to simulate connection error
      await permissionStore.close();

      // Permission checks should handle the error gracefully
      await expect(async () => {
        await permissionManager.checkToolPermission('Read', { scope: '/test' });
      }).rejects.toThrow();

      // Reinitialize for cleanup
      await permissionStore.initialize();
    });

    it('should handle invalid permission levels', async () => {
      // Test with invalid permission level (this should be caught by TypeScript, but test runtime behavior)
      await expect(async () => {
        await permissionManager.grantPermission('Write', '/test', 'invalid-level' as any);
      }).rejects.toThrow();
    });

    it('should handle empty or malformed scopes', async () => {
      // Empty scope
      let result = await permissionManager.checkToolPermission('Read', { scope: '' });
      expect(result.allowed).toBe(false);

      // Null/undefined scope (should work)
      result = await permissionManager.checkToolPermission('Read', {});
      expect(result.allowed).toBe(false);

      // Very long scope
      const longScope = 'a'.repeat(1000);
      result = await permissionManager.checkToolPermission('Read', { scope: longScope });
      expect(result.allowed).toBe(false);
    });

    it('should handle tool configuration edge cases', async () => {
      // Grant permission
      await permissionManager.grantPermission('WebSearch', 'test-query', 'allow-always');

      // Set configuration with zero timeout
      permissionManager.setToolConfig('WebSearch', {
        enabled: true,
        timeout: 0, // Zero timeout should be handled
        rateLimitPerMinute: 0,
      });

      const result = await permissionManager.checkToolPermission('WebSearch', { scope: 'test-query' });
      expect(result.allowed).toBe(true);
      expect(result.config?.timeout).toBe(0);
    });

    it('should handle rate limiting configuration', async () => {
      // Grant permission
      await permissionManager.grantPermission('TodoWrite', 'test-todo', 'allow-always');

      // Set rate limiting
      permissionManager.setToolConfig('TodoWrite', {
        enabled: true,
        timeout: 5000,
        rateLimitPerMinute: 10, // Allow 10 calls per minute
      });

      const result = await permissionManager.checkToolPermission('TodoWrite', { scope: 'test-todo' });
      expect(result.allowed).toBe(true);
      expect(result.config?.rateLimitPerMinute).toBe(10);
    });

    it('should handle session cache reset', async () => {
      // Grant allow-once permission
      await permissionManager.grantPermission('Glob', '*.test', 'allow-once');

      // Check permission (should consume allow-once)
      let result = await permissionManager.checkToolPermission('Glob', { scope: '*.test' });
      expect(result.allowed).toBe(true);

      // Reset session
      permissionManager.resetSession();

      // Grant another allow-once permission
      await permissionManager.grantPermission('Glob', '*.test', 'allow-once');

      // Should work again after session reset
      result = await permissionManager.checkToolPermission('Glob', { scope: '*.test' });
      expect(result.allowed).toBe(true);
    });
  });
});
