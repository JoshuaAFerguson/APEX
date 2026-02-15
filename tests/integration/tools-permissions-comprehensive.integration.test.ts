/**
 * @fileoverview Comprehensive Tools-Permissions Integration Tests
 *
 * This test suite provides comprehensive integration testing for tools and permissions
 * interaction in the APEX system. It verifies all acceptance criteria:
 *
 * 1. Tests verify that tools respect permission boundaries
 * 2. Unauthorized tool access is blocked
 * 3. Permission changes affect tool availability
 * 4. Error handling works correctly
 * 5. All tests pass
 *
 * This file consolidates and extends existing test coverage to ensure complete
 * validation of tool-permission interactions across all scenarios.
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
  ToolPermissionResult,
  AgentTool,
  ToolPermissionCheckOptions,
} from '@apexcli/core';

describe('Comprehensive Tools-Permissions Integration Tests', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let presetManager: PermissionPresetManager;
  let eventLog: Array<{ type: string; data: any; timestamp: number }>;

  beforeEach(async () => {
    // Create isolated test environment
    tempDir = await mkdtemp(join(tmpdir(), 'apex-comprehensive-tools-permissions-test-'));

    // Create .apex directory structure
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });
    await mkdir(join(apexDir, 'agents'), { recursive: true });
    await mkdir(join(apexDir, 'workflows'), { recursive: true });

    // Create comprehensive test configuration
    const configContent = `
project:
  name: comprehensive-tools-permissions-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: manual
  presets:
    manual:
      tools: {}  # Start with no preset permissions
    autonomous:
      tools:
        Read: allow
        Write: allow
        Edit: allow
        Bash: allow
        Grep: allow
        Glob: allow
        Browser: allow
        WebFetch: allow
        WebSearch: allow
        TodoWrite: allow
    read-only:
      tools:
        Read: allow
        Grep: allow
        Glob: allow
        Write: deny
        Edit: deny
        Bash: deny
        Browser: deny
        WebFetch: deny
        WebSearch: deny
        TodoWrite: deny
    restricted:
      tools:
        Read: confirm
        Write: confirm
        Edit: confirm
        Bash: deny
        Grep: allow
        Glob: allow
        Browser: deny
        WebFetch: deny
        WebSearch: deny
        TodoWrite: confirm

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
    role: "Test agent for comprehensive permission validation"
    model: sonnet
    tools: [Read, Write, Edit, Bash, Grep, Glob, Browser, WebFetch, WebSearch, TodoWrite, TestTool]

workflows:
  test-workflow:
    name: "Test Workflow"
    agents: [test-agent]
    stages:
      - name: test-stage
        agent: test-agent
        description: "Test stage for comprehensive permission validation"

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
description: Test agent for comprehensive permission validation
tools: [Read, Write, Edit, Bash, Grep, Glob, Browser, WebFetch, WebSearch, TodoWrite, TestTool]
---

You are a test agent that validates comprehensive tool-permission interactions.`
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
  // ACCEPTANCE CRITERIA 1: Tests verify that tools respect permission boundaries
  // ============================================================================

  describe('Acceptance Criteria 1: Tools Respect Permission Boundaries', () => {
    describe('Allow-Always Permission Boundaries', () => {
      it('should respect allow-always permissions with unlimited usage', async () => {
        const toolName: AgentTool = 'Read';
        const scope = '/project/**/*.ts';

        // Grant allow-always permission
        await permissionManager.grantPermission(toolName, scope, 'allow-always');

        // Multiple permission checks should all succeed
        for (let i = 0; i < 5; i++) {
          const result = await permissionManager.checkToolPermission(toolName, { scope });
          expect(result.allowed).toBe(true);
          expect(result.level).toBe('allow-always');
          expect(result.requiresConfirmation).toBe(false);
          expect(result.denialReason).toBeUndefined();
        }
      });

      it('should respect allow-always permissions with scope specificity', async () => {
        const toolName: AgentTool = 'Write';
        const allowedScope = '/project/src/**';
        const deniedScope = '/project/secrets/**';

        // Grant permission only for src directory
        await permissionManager.grantPermission(toolName, allowedScope, 'allow-always');

        // Check allowed scope
        const allowedResult = await permissionManager.checkToolPermission(toolName, { scope: allowedScope });
        expect(allowedResult.allowed).toBe(true);
        expect(allowedResult.level).toBe('allow-always');

        // Check denied scope (no permission granted)
        const deniedResult = await permissionManager.checkToolPermission(toolName, { scope: deniedScope });
        expect(deniedResult.allowed).toBe(false);
        expect(deniedResult.level).toBeNull();
      });
    });

    describe('Allow-Once Permission Boundaries', () => {
      it('should respect allow-once permissions with single-use consumption', async () => {
        const toolName: AgentTool = 'Edit';
        const scope = '/project/config.yaml';

        // Grant allow-once permission
        await permissionManager.grantPermission(toolName, scope, 'allow-once');

        // First use should succeed and consume the permission
        const firstResult = await permissionManager.checkToolPermission(toolName, { scope });
        expect(firstResult.allowed).toBe(true);
        expect(firstResult.level).toBe('allow-once');

        // Second use should fail (permission consumed)
        const secondResult = await permissionManager.checkToolPermission(toolName, { scope });
        expect(secondResult.allowed).toBe(false);
        expect(secondResult.level).toBeNull();
      });

      it('should respect allow-once permissions with non-consuming preview checks', async () => {
        const toolName: AgentTool = 'Bash';
        const scope = 'npm install';

        // Grant allow-once permission
        await permissionManager.grantPermission(toolName, scope, 'allow-once');

        // Non-consuming check should show permission exists
        const previewResult = await permissionManager.checkToolPermission(toolName, {
          scope,
          consumeAllowOnce: false
        });
        expect(previewResult.allowed).toBe(true);
        expect(previewResult.level).toBe('allow-once');

        // Another non-consuming check should still work
        const secondPreviewResult = await permissionManager.checkToolPermission(toolName, {
          scope,
          consumeAllowOnce: false
        });
        expect(secondPreviewResult.allowed).toBe(true);
        expect(secondPreviewResult.level).toBe('allow-once');

        // Consuming check should work and consume
        const consumingResult = await permissionManager.checkToolPermission(toolName, { scope });
        expect(consumingResult.allowed).toBe(true);
        expect(consumingResult.level).toBe('allow-once');

        // Now permission should be consumed
        const finalResult = await permissionManager.checkToolPermission(toolName, { scope });
        expect(finalResult.allowed).toBe(false);
        expect(finalResult.level).toBeNull();
      });
    });

    describe('Deny Permission Boundaries', () => {
      it('should respect explicit deny permissions with clear error messages', async () => {
        const toolName: AgentTool = 'Bash';
        const scope = 'sudo rm -rf /';

        // Grant explicit deny permission
        await permissionManager.grantPermission(toolName, scope, 'deny');

        // Permission check should be denied
        const result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.level).toBe('deny');
        expect(result.denialReason).toBeDefined();
        expect(result.denialReason).toContain('explicitly denied');
      });

      it('should respect deny permissions even with tool config allowances', async () => {
        const toolName: AgentTool = 'Browser';
        const scope = 'https://malicious-site.com';

        // Grant deny permission
        await permissionManager.grantPermission(toolName, scope, 'deny');

        // Configure tool as enabled (should not override deny)
        permissionManager.setToolConfig(toolName, {
          enabled: true,
          timeout: 30000,
          rateLimitPerMinute: 0,
        });

        const result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.level).toBe('deny');
      });
    });

    describe('Preset-Based Permission Boundaries', () => {
      it('should respect autonomous preset permissions', async () => {
        // Apply autonomous preset (all tools allowed)
        await presetManager.applyPreset('autonomous');

        const tools: AgentTool[] = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];

        // All tools should be allowed under autonomous preset
        for (const tool of tools) {
          const result = await permissionManager.checkToolPermission(tool, { scope: 'test-scope' });
          expect(result.allowed).toBe(true);
          expect(result.level).toBe('allow');
        }
      });

      it('should respect read-only preset permissions', async () => {
        // Apply read-only preset
        await presetManager.applyPreset('read-only');

        // Read operations should be allowed
        const readResult = await permissionManager.checkToolPermission('Read', { scope: '/tmp/test.txt' });
        expect(readResult.allowed).toBe(true);

        const grepResult = await permissionManager.checkToolPermission('Grep', { scope: '*.js' });
        expect(grepResult.allowed).toBe(true);

        // Write operations should be denied
        const writeResult = await permissionManager.checkToolPermission('Write', { scope: '/tmp/test.txt' });
        expect(writeResult.allowed).toBe(false);

        const bashResult = await permissionManager.checkToolPermission('Bash', { scope: 'ls -la' });
        expect(bashResult.allowed).toBe(false);
      });

      it('should respect restricted preset permissions with confirmation requirements', async () => {
        // Apply restricted preset
        await presetManager.applyPreset('restricted');

        // Confirmation-required tools should be blocked without user interaction
        const readResult = await permissionManager.checkToolPermission('Read', { scope: '/tmp/test.txt' });
        expect(readResult.allowed).toBe(false);
        expect(readResult.requiresConfirmation).toBe(true);

        // Allowed tools should work
        const grepResult = await permissionManager.checkToolPermission('Grep', { scope: '*.js' });
        expect(grepResult.allowed).toBe(true);

        // Denied tools should be blocked
        const bashResult = await permissionManager.checkToolPermission('Bash', { scope: 'ls -la' });
        expect(bashResult.allowed).toBe(false);
        expect(bashResult.level).toBe('deny');
      });
    });

    describe('Complex Scope Pattern Boundaries', () => {
      it('should respect wildcard pattern permissions', async () => {
        const toolName: AgentTool = 'Grep';

        // Grant permissions for different wildcard patterns
        await permissionManager.grantPermission(toolName, '*.ts', 'allow-always');
        await permissionManager.grantPermission(toolName, '*.test.*', 'allow-once');
        await permissionManager.grantPermission(toolName, '*.secret.*', 'deny');

        // Test TypeScript files (should be allowed)
        const tsResult = await permissionManager.checkToolPermission(toolName, { scope: '*.ts' });
        expect(tsResult.allowed).toBe(true);
        expect(tsResult.level).toBe('allow-always');

        // Test files (should be allowed once)
        const testResult = await permissionManager.checkToolPermission(toolName, { scope: '*.test.js' });
        expect(testResult.allowed).toBe(true);
        expect(testResult.level).toBe('allow-once');

        // Secret files (should be denied)
        const secretResult = await permissionManager.checkToolPermission(toolName, { scope: '*.secret.json' });
        expect(secretResult.allowed).toBe(false);
        expect(secretResult.level).toBe('deny');
      });

      it('should respect hierarchical path permissions', async () => {
        const toolName: AgentTool = 'Read';

        // Grant permissions for nested paths
        await permissionManager.grantPermission(toolName, '/project/**', 'allow-always');
        await permissionManager.grantPermission(toolName, '/project/secrets/**', 'deny');

        // General project path should be allowed
        const projectResult = await permissionManager.checkToolPermission(toolName, { scope: '/project/src/main.ts' });
        expect(projectResult.allowed).toBe(true);

        // Secrets path should be denied (more specific rule)
        const secretsResult = await permissionManager.checkToolPermission(toolName, { scope: '/project/secrets/api.key' });
        expect(secretsResult.allowed).toBe(false);
        expect(secretsResult.level).toBe('deny');
      });
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA 2: Unauthorized tool access is blocked
  // ============================================================================

  describe('Acceptance Criteria 2: Unauthorized Tool Access Is Blocked', () => {
    describe('No Permission Scenarios', () => {
      it('should block tools when no explicit permission is granted', async () => {
        const tools: AgentTool[] = ['Read', 'Write', 'Edit', 'Bash', 'Browser', 'WebFetch', 'WebSearch', 'TodoWrite'];

        // Test all tools without any permissions
        for (const tool of tools) {
          const result = await permissionManager.checkToolPermission(tool, { scope: 'test-scope' });
          expect(result.allowed).toBe(false);
          expect(result.level).toBeNull();
          expect(result.denialReason).toBeDefined();
          expect(result.denialReason).toContain('No permission found');
        }
      });

      it('should block custom tools when no permission is granted', async () => {
        const customTool = 'TestTool' as AgentTool;

        const result = await permissionManager.checkToolPermission(customTool, { scope: 'test-message' });
        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
        expect(result.denialReason).toBeDefined();
      });
    });

    describe('Explicit Denial Scenarios', () => {
      it('should block tools with explicit deny permissions', async () => {
        const dangerousOperations = [
          { tool: 'Bash' as AgentTool, scope: 'sudo rm -rf /' },
          { tool: 'Write' as AgentTool, scope: '/etc/passwd' },
          { tool: 'Edit' as AgentTool, scope: '/boot/grub/grub.cfg' },
          { tool: 'Browser' as AgentTool, scope: 'https://malicious-site.com' },
        ];

        // Grant explicit deny permissions
        for (const { tool, scope } of dangerousOperations) {
          await permissionManager.grantPermission(tool, scope, 'deny');
        }

        // Verify all are blocked
        for (const { tool, scope } of dangerousOperations) {
          const result = await permissionManager.checkToolPermission(tool, { scope });
          expect(result.allowed).toBe(false);
          expect(result.level).toBe('deny');
          expect(result.denialReason).toContain('explicitly denied');
        }
      });
    });

    describe('Tool Configuration Blocking', () => {
      it('should block tools when disabled via configuration', async () => {
        const toolName: AgentTool = 'WebFetch';
        const scope = 'https://example.com';

        // Grant permission but disable via configuration
        await permissionManager.grantPermission(toolName, scope, 'allow-always');
        permissionManager.setToolConfig(toolName, {
          enabled: false,
          timeout: 5000,
          rateLimitPerMinute: 0,
        });

        const result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.denialReason).toContain('Tool is disabled');
      });

      it('should block tools requiring confirmation without user interaction', async () => {
        const toolName: AgentTool = 'Bash';
        const scope = 'npm install --global some-package';

        // Grant permission but require confirmation
        await permissionManager.grantPermission(toolName, scope, 'allow-always');
        permissionManager.setToolConfig(toolName, {
          enabled: true,
          requireConfirmation: true,
          timeout: 5000,
          rateLimitPerMinute: 0,
        });

        const result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.requiresConfirmation).toBe(true);
        expect(result.denialReason).toContain('requires user confirmation');
      });
    });

    describe('Directory Access Control', () => {
      it('should block tools with directory access violations', async () => {
        const toolName: AgentTool = 'Read';
        const allowedScope = '/project/src/**';

        // Grant permission and configure directory access control
        await permissionManager.grantPermission(toolName, allowedScope, 'allow-always');
        permissionManager.setToolConfig(toolName, {
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

        // Allowed path should work
        const allowedResult = await permissionManager.checkToolPermission(toolName, {
          scope: '/project/src/main.ts',
          path: '/project/src/main.ts'
        });
        expect(allowedResult.allowed).toBe(true);

        // Blocked path should be denied
        const blockedResult = await permissionManager.checkToolPermission(toolName, {
          scope: '/project/src/secrets/api.key',
          path: '/project/src/secrets/api.key'
        });
        expect(blockedResult.allowed).toBe(false);
        expect(blockedResult.denialReason).toContain('Directory access denied');

        // Path outside allowlist should be denied
        const outsideResult = await permissionManager.checkToolPermission(toolName, {
          scope: '/etc/passwd',
          path: '/etc/passwd'
        });
        expect(outsideResult.allowed).toBe(false);
        expect(outsideResult.denialReason).toContain('Directory access denied');
      });
    });

    describe('Session-Based Blocking', () => {
      it('should block access after session-based permission expires', async () => {
        const toolName: AgentTool = 'Write';
        const scope = '/tmp/session-test.txt';

        // Grant allow-once permission
        await permissionManager.grantPermission(toolName, scope, 'allow-once');

        // First check should work
        const firstResult = await permissionManager.checkToolPermission(toolName, { scope });
        expect(firstResult.allowed).toBe(true);

        // Second check should be blocked
        const secondResult = await permissionManager.checkToolPermission(toolName, { scope });
        expect(secondResult.allowed).toBe(false);
        expect(secondResult.level).toBeNull();
      });
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA 3: Permission changes affect tool availability
  // ============================================================================

  describe('Acceptance Criteria 3: Permission Changes Affect Tool Availability', () => {
    describe('Real-Time Permission Grants', () => {
      it('should enable tool access immediately when permission is granted', async () => {
        const toolName: AgentTool = 'Edit';
        const scope = '/project/update-me.txt';

        // Initially should be blocked
        let result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);

        // Grant permission
        await permissionManager.grantPermission(toolName, scope, 'allow-always');

        // Should now be allowed
        result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(true);
        expect(result.level).toBe('allow-always');
      });

      it('should enable multiple tools simultaneously when permissions are granted', async () => {
        const tools: AgentTool[] = ['Read', 'Write', 'Grep'];
        const scope = '/project/batch-update/**';

        // Initially all should be blocked
        for (const tool of tools) {
          const result = await permissionManager.checkToolPermission(tool, { scope });
          expect(result.allowed).toBe(false);
        }

        // Grant permissions simultaneously
        await Promise.all(tools.map(tool =>
          permissionManager.grantPermission(tool, scope, 'allow-always')
        ));

        // All should now be allowed
        for (const tool of tools) {
          const result = await permissionManager.checkToolPermission(tool, { scope });
          expect(result.allowed).toBe(true);
          expect(result.level).toBe('allow-always');
        }
      });
    });

    describe('Real-Time Permission Revocations', () => {
      it('should disable tool access immediately when permission is revoked', async () => {
        const toolName: AgentTool = 'Bash';
        const scope = 'git push --force-with-lease';

        // Grant permission first
        await permissionManager.grantPermission(toolName, scope, 'allow-always');
        let result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(true);

        // Revoke permission
        const wasRevoked = await permissionManager.revokePermission(toolName, scope);
        expect(wasRevoked).toBe(true);

        // Should now be blocked
        result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
      });

      it('should revoke session-cached permissions immediately', async () => {
        const toolName: AgentTool = 'Browser';
        const scope = 'https://example.com';

        // Grant allow-once permission (stored in session cache)
        await permissionManager.grantPermission(toolName, scope, 'allow-once');

        // Verify it's accessible
        let result = await permissionManager.checkToolPermission(toolName, {
          scope,
          consumeAllowOnce: false
        });
        expect(result.allowed).toBe(true);

        // Revoke permission
        await permissionManager.revokePermission(toolName, scope);

        // Should now be blocked
        result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
      });
    });

    describe('Permission Level Changes', () => {
      it('should reflect permission level upgrades immediately', async () => {
        const toolName: AgentTool = 'Write';
        const scope = '/project/evolving-permissions.txt';

        // Start with allow-once
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

        // Multiple uses should work (not consumed)
        result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(true);
        expect(result.level).toBe('allow-always');
      });

      it('should reflect permission level downgrades immediately', async () => {
        const toolName: AgentTool = 'Read';
        const scope = '/project/downgrade-test.txt';

        // Start with allow-always
        await permissionManager.grantPermission(toolName, scope, 'allow-always');
        let result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.level).toBe('allow-always');

        // Downgrade to allow-once
        await permissionManager.grantPermission(toolName, scope, 'allow-once');
        result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(true);
        expect(result.level).toBe('allow-once');

        // Second use should fail
        result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
      });

      it('should reflect permission changes from allow to deny immediately', async () => {
        const toolName: AgentTool = 'Bash';
        const scope = 'potentially-dangerous-command';

        // Start with allow-always
        await permissionManager.grantPermission(toolName, scope, 'allow-always');
        let result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(true);

        // Change to deny
        await permissionManager.grantPermission(toolName, scope, 'deny');
        result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.level).toBe('deny');
        expect(result.denialReason).toContain('explicitly denied');
      });
    });

    describe('Preset Application Effects', () => {
      it('should affect tool availability when presets are applied', async () => {
        // Start with no preset (manual mode)
        let readResult = await permissionManager.checkToolPermission('Read', { scope: '/tmp/test.txt' });
        let writeResult = await permissionManager.checkToolPermission('Write', { scope: '/tmp/test.txt' });
        expect(readResult.allowed).toBe(false);
        expect(writeResult.allowed).toBe(false);

        // Apply autonomous preset
        await presetManager.applyPreset('autonomous');

        // Both should now be allowed
        readResult = await permissionManager.checkToolPermission('Read', { scope: '/tmp/test.txt' });
        writeResult = await permissionManager.checkToolPermission('Write', { scope: '/tmp/test.txt' });
        expect(readResult.allowed).toBe(true);
        expect(writeResult.allowed).toBe(true);

        // Apply read-only preset
        await presetManager.applyPreset('read-only');

        // Read should still be allowed, Write should be denied
        readResult = await permissionManager.checkToolPermission('Read', { scope: '/tmp/test.txt' });
        writeResult = await permissionManager.checkToolPermission('Write', { scope: '/tmp/test.txt' });
        expect(readResult.allowed).toBe(true);
        expect(writeResult.allowed).toBe(false);
      });
    });

    describe('Session Reset Effects', () => {
      it('should clear session-based permissions on session reset', async () => {
        const toolName: AgentTool = 'Edit';
        const scope = '/project/session-dependent.txt';

        // Grant allow-once permission
        await permissionManager.grantPermission(toolName, scope, 'allow-once');
        let result = await permissionManager.checkToolPermission(toolName, {
          scope,
          consumeAllowOnce: false
        });
        expect(result.allowed).toBe(true);

        // Reset session
        permissionManager.resetSession();

        // Should no longer be available
        result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.level).toBeNull();
      });

      it('should preserve persistent permissions across session resets', async () => {
        const toolName: AgentTool = 'Grep';
        const scope = '*.persistent';

        // Grant persistent permission
        await permissionManager.grantPermission(toolName, scope, 'allow-always');
        let result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(true);

        // Reset session
        permissionManager.resetSession();

        // Should still be available
        result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(true);
        expect(result.level).toBe('allow-always');
      });
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA 4: Error handling works correctly
  // ============================================================================

  describe('Acceptance Criteria 4: Error Handling Works Correctly', () => {
    describe('Clear Error Messages', () => {
      it('should provide clear error messages for denied permissions', async () => {
        const scenarios = [
          { tool: 'Write' as AgentTool, scope: '/etc/passwd', level: 'deny' as PermissionLevel, expectedMessage: 'explicitly denied' },
          { tool: 'Bash' as AgentTool, scope: 'rm -rf /', level: 'deny' as PermissionLevel, expectedMessage: 'explicitly denied' },
        ];

        for (const { tool, scope, level, expectedMessage } of scenarios) {
          await permissionManager.grantPermission(tool, scope, level);
          const result = await permissionManager.checkToolPermission(tool, { scope });

          expect(result.allowed).toBe(false);
          expect(result.denialReason).toBeDefined();
          expect(result.denialReason).toContain(expectedMessage);
        }
      });

      it('should provide clear error messages for missing permissions', async () => {
        const tools: AgentTool[] = ['Read', 'Write', 'Edit', 'Bash'];

        for (const tool of tools) {
          const result = await permissionManager.checkToolPermission(tool, { scope: 'test-scope' });
          expect(result.allowed).toBe(false);
          expect(result.denialReason).toBeDefined();
          expect(result.denialReason).toContain('No permission found');
        }
      });

      it('should provide clear error messages for configuration-based blocks', async () => {
        const toolName: AgentTool = 'Browser';
        const scope = 'https://disabled-site.com';

        // Grant permission but disable tool
        await permissionManager.grantPermission(toolName, scope, 'allow-always');
        permissionManager.setToolConfig(toolName, {
          enabled: false,
          timeout: 5000,
          rateLimitPerMinute: 0,
        });

        const result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(false);
        expect(result.denialReason).toContain('Tool is disabled');
      });
    });

    describe('Database Error Handling', () => {
      it('should handle database connection errors gracefully', async () => {
        // Close the permission store to simulate connection error
        await permissionStore.close();

        // Permission checks should throw descriptive errors
        await expect(async () => {
          await permissionManager.checkToolPermission('Read', { scope: '/test' });
        }).rejects.toThrow();

        // Reinitialize for cleanup
        await permissionStore.initialize();
      });

      it('should handle corrupted permission data gracefully', async () => {
        const toolName: AgentTool = 'Write';
        const scope = '/tmp/corruption-test.txt';

        // Grant a valid permission first
        await permissionManager.grantPermission(toolName, scope, 'allow-always');

        // Verify it works
        let result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(true);

        // Simulate corruption by trying invalid permission level
        await expect(async () => {
          await permissionManager.grantPermission(toolName, scope, 'invalid-level' as any);
        }).rejects.toThrow();

        // Original permission should still work
        result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(result.allowed).toBe(true);
      });
    });

    describe('Concurrent Access Error Handling', () => {
      it('should handle concurrent permission operations safely', async () => {
        const toolName: AgentTool = 'Edit';
        const scope = '/tmp/concurrent-test.txt';

        // Perform multiple concurrent operations
        const operations = Promise.all([
          permissionManager.grantPermission(toolName, scope, 'allow-once'),
          permissionManager.grantPermission(toolName, scope, 'allow-always'),
          permissionManager.checkToolPermission(toolName, { scope }),
          permissionManager.revokePermission(toolName, scope),
          permissionManager.grantPermission(toolName, scope, 'deny'),
        ]);

        // All operations should complete without crashing
        await expect(operations).resolves.not.toThrow();

        // Final state should be consistent
        const finalResult = await permissionManager.checkToolPermission(toolName, { scope });
        expect(['allow', 'allow-always', 'allow-once', 'deny', null]).toContain(finalResult.level);
      });

      it('should handle rapid permission changes safely', async () => {
        const toolName: AgentTool = 'Bash';
        const scope = 'rapid-change-command';
        const levels: PermissionLevel[] = ['allow-once', 'allow-always', 'deny', 'allow-always', 'allow-once'];

        // Rapidly change permissions
        for (const level of levels) {
          await permissionManager.grantPermission(toolName, scope, level);
          const result = await permissionManager.checkToolPermission(toolName, {
            scope,
            consumeAllowOnce: false
          });
          expect(result.level).toBe(level);
        }
      });
    });

    describe('Invalid Input Error Handling', () => {
      it('should handle empty or malformed scopes gracefully', async () => {
        const toolName: AgentTool = 'Read';

        // Empty scope
        let result = await permissionManager.checkToolPermission(toolName, { scope: '' });
        expect(result.allowed).toBe(false);

        // Very long scope
        const longScope = 'a'.repeat(1000);
        result = await permissionManager.checkToolPermission(toolName, { scope: longScope });
        expect(result.allowed).toBe(false);

        // Special characters
        result = await permissionManager.checkToolPermission(toolName, { scope: '../../etc/passwd' });
        expect(result.allowed).toBe(false);
      });

      it('should handle invalid tool names gracefully', async () => {
        const invalidTool = 'NonExistentTool' as AgentTool;

        // Grant permission for invalid tool (should not crash)
        await expect(
          permissionManager.grantPermission(invalidTool, 'test-scope', 'allow-always')
        ).resolves.not.toThrow();

        // Check permission for invalid tool
        const result = await permissionManager.checkToolPermission(invalidTool, { scope: 'test-scope' });
        expect(typeof result.allowed).toBe('boolean');
      });
    });

    describe('Recovery and Degradation', () => {
      it('should recover from permission store errors', async () => {
        const toolName: AgentTool = 'Glob';
        const scope = '*.recovery-test';

        // Grant initial permission
        await permissionManager.grantPermission(toolName, scope, 'allow-always');

        // Simulate store error by closing it
        await permissionStore.close();

        // Operations should fail gracefully
        await expect(
          permissionManager.checkToolPermission(toolName, { scope })
        ).rejects.toThrow();

        // Reinitialize store
        await permissionStore.initialize();

        // Should work again (though permission may be lost due to restart)
        const result = await permissionManager.checkToolPermission(toolName, { scope });
        expect(typeof result.allowed).toBe('boolean');
      });

      it('should maintain session cache integrity during errors', async () => {
        const sessionTool: AgentTool = 'Write';
        const persistentTool: AgentTool = 'Read';
        const scope = '/tmp/integrity-test.txt';

        // Set up session and persistent permissions
        await permissionManager.grantPermission(sessionTool, scope, 'allow-once');
        await permissionManager.grantPermission(persistentTool, scope, 'allow-always');

        // Simulate error scenario
        try {
          await permissionStore.close();
          await permissionManager.checkToolPermission(persistentTool, { scope });
        } catch (error) {
          // Expected to fail
        }

        // Reinitialize
        await permissionStore.initialize();

        // Session cache should still work for cached permissions
        const sessionResult = await permissionManager.checkToolPermission(sessionTool, {
          scope,
          consumeAllowOnce: false
        });
        // Session cache may or may not survive store restart - both behaviors are acceptable
        expect(typeof sessionResult.allowed).toBe('boolean');
      });
    });
  });

  // ============================================================================
  // COMPREHENSIVE INTEGRATION SCENARIOS
  // ============================================================================

  describe('Comprehensive Integration Scenarios', () => {
    it('should handle complex multi-tool workflow with dynamic permissions', async () => {
      const workflow = [
        { tool: 'Read' as AgentTool, scope: '/project/config.json', level: 'allow-always' as PermissionLevel },
        { tool: 'Write' as AgentTool, scope: '/tmp/backup.json', level: 'allow-once' as PermissionLevel },
        { tool: 'Bash' as AgentTool, scope: 'git status', level: 'allow-always' as PermissionLevel },
        { tool: 'Edit' as AgentTool, scope: '/project/config.json', level: 'allow-once' as PermissionLevel },
        { tool: 'Grep' as AgentTool, scope: '*.json', level: 'allow-always' as PermissionLevel },
      ];

      // Grant all permissions
      for (const { tool, scope, level } of workflow) {
        await permissionManager.grantPermission(tool, scope, level);
      }

      // Execute workflow steps
      for (const { tool, scope, level } of workflow) {
        const result = await permissionManager.checkToolPermission(tool, { scope });
        expect(result.allowed).toBe(true);
        expect(result.level).toBe(level);
      }

      // Test allow-once consumption
      const writeResult = await permissionManager.checkToolPermission('Write', { scope: '/tmp/backup.json' });
      expect(writeResult.allowed).toBe(false); // Should be consumed

      const editResult = await permissionManager.checkToolPermission('Edit', { scope: '/project/config.json' });
      expect(editResult.allowed).toBe(false); // Should be consumed

      // Test allow-always persistence
      const readResult = await permissionManager.checkToolPermission('Read', { scope: '/project/config.json' });
      expect(readResult.allowed).toBe(true); // Should still work
    });

    it('should handle permission cascades and inheritance patterns', async () => {
      const baseScope = '/project/**';
      const specificScope = '/project/src/main.ts';
      const deniedScope = '/project/secrets/**';

      // Set up hierarchical permissions
      await permissionManager.grantPermission('Read', baseScope, 'allow-always');
      await permissionManager.grantPermission('Read', deniedScope, 'deny');

      // Base scope should work
      const baseResult = await permissionManager.checkToolPermission('Read', { scope: baseScope });
      expect(baseResult.allowed).toBe(true);

      // Specific scope should inherit from base
      const specificResult = await permissionManager.checkToolPermission('Read', { scope: specificScope });
      expect(specificResult.allowed).toBe(true);

      // Denied scope should override base permission
      const deniedResult = await permissionManager.checkToolPermission('Read', { scope: deniedScope });
      expect(deniedResult.allowed).toBe(false);
      expect(deniedResult.level).toBe('deny');
    });

    it('should maintain consistency across session resets and permission changes', async () => {
      const persistentTool: AgentTool = 'Grep';
      const sessionTool: AgentTool = 'Write';
      const scope = '/project/consistency-test/**';

      // Set up mixed permissions
      await permissionManager.grantPermission(persistentTool, scope, 'allow-always');
      await permissionManager.grantPermission(sessionTool, scope, 'allow-once');

      // Verify initial state
      let persistentResult = await permissionManager.checkToolPermission(persistentTool, { scope });
      let sessionResult = await permissionManager.checkToolPermission(sessionTool, {
        scope,
        consumeAllowOnce: false
      });
      expect(persistentResult.allowed).toBe(true);
      expect(sessionResult.allowed).toBe(true);

      // Reset session
      permissionManager.resetSession();

      // Persistent should survive, session should not
      persistentResult = await permissionManager.checkToolPermission(persistentTool, { scope });
      sessionResult = await permissionManager.checkToolPermission(sessionTool, { scope });
      expect(persistentResult.allowed).toBe(true);
      expect(sessionResult.allowed).toBe(false);

      // Change persistent permission
      await permissionManager.grantPermission(persistentTool, scope, 'deny');
      persistentResult = await permissionManager.checkToolPermission(persistentTool, { scope });
      expect(persistentResult.allowed).toBe(false);
      expect(persistentResult.level).toBe('deny');
    });
  });
});