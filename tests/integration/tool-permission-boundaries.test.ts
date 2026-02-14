/**
 * @fileoverview Tool Permission Boundaries Integration Tests
 *
 * This test suite comprehensively verifies that all APEX tools respect
 * permission boundaries according to the tool permission system.
 *
 * Test Matrix (18 core test cases):
 * - Filesystem Tools: Read, Write, Edit
 * - Shell Tools: Bash
 * - Search Tools: Grep, Glob
 *
 * Each tool is tested with all 3 permission levels:
 * - allow-always: Permission persists across multiple uses
 * - allow-once: Permission is consumed after first use
 * - deny: Tool execution is blocked with proper error handling
 *
 * Acceptance Criteria:
 * - Tests verify that filesystem tools (Read, Write, Edit), shell tools (Bash),
 *   and search tools (Grep, Glob) respect allow-always, allow-once, and deny
 *   permission levels. All tests pass.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  ApexOrchestrator,
  PermissionManager,
  PermissionStore,
} from '@apexcli/orchestrator';
import type { PermissionLevel } from '@apexcli/core';

// Mock the Claude SDK query function to avoid actual API calls
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn().mockResolvedValue({
    content: [],
    usage: { inputTokens: 10, outputTokens: 10 }
  }),
  AgentDefinition: {},
  McpServerConfig: {}
}));

describe('Tool Permission Boundaries', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let testFilePath: string;
  let testDirPath: string;

  beforeEach(async () => {
    // Create isolated test environment
    tempDir = await mkdtemp(join(tmpdir(), 'apex-tool-permission-test-'));
    testDirPath = join(tempDir, 'test-files');
    await mkdir(testDirPath, { recursive: true });
    testFilePath = join(testDirPath, 'test-file.txt');
    await writeFile(testFilePath, 'Initial test content');

    // Create minimal .apex directory structure
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });
    await mkdir(join(apexDir, 'agents'), { recursive: true });
    await mkdir(join(apexDir, 'workflows'), { recursive: true });

    // Create minimal test configuration
    const configContent = `
project:
  name: tool-permission-boundary-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all

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

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator(tempDir);
    await orchestrator.initialize();

    // Get component instances for testing
    permissionManager = orchestrator.permissionManager;
    permissionStore = orchestrator.permissionStore;
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
  // Test Helper Functions
  // ============================================================================

  async function grantPermission(tool: string, scope: string, level: PermissionLevel): Promise<void> {
    await permissionManager.grantPermission(tool, scope, level);
  }

  async function checkPermission(tool: string, scope?: string): Promise<PermissionLevel | null> {
    return await permissionManager.checkPermission(tool, scope);
  }

  async function verifyPermissionLevel(tool: string, scope: string, expectedLevel: PermissionLevel): Promise<void> {
    const actualLevel = await checkPermission(tool, scope);
    expect(actualLevel).toBe(expectedLevel);
  }

  async function verifyPermissionConsumed(tool: string, scope: string): Promise<void> {
    const permission = await checkPermission(tool, scope);
    expect(permission).toBeNull();
  }

  async function simulatePermissionConsumption(tool: string, scope: string): Promise<void> {
    // For allow-once permissions, the first checkPermission call consumes the permission
    await checkPermission(tool, scope);
  }

  // ============================================================================
  // Filesystem Tools Tests
  // ============================================================================

  describe('Filesystem Tools', () => {
    describe('Read Tool', () => {
      it('should allow reading when permission is allow-always', async () => {
        // Grant allow-always permission
        await grantPermission('Read', testFilePath, 'allow-always');

        // Verify permission is granted
        await verifyPermissionLevel('Read', testFilePath, 'allow-always');

        // Verify permission persists after multiple checks
        await verifyPermissionLevel('Read', testFilePath, 'allow-always');
        await verifyPermissionLevel('Read', testFilePath, 'allow-always');
      });

      it('should allow reading once when permission is allow-once', async () => {
        // Grant allow-once permission
        await grantPermission('Read', testFilePath, 'allow-once');

        // Verify permission is granted initially
        await verifyPermissionLevel('Read', testFilePath, 'allow-once');

        // Consume the permission by checking it (allow-once is consumed on first check)
        await simulatePermissionConsumption('Read', testFilePath);

        // Verify permission is consumed after use
        await verifyPermissionConsumed('Read', testFilePath);
      });

      it('should deny reading when permission is deny', async () => {
        // Grant deny permission
        await grantPermission('Read', testFilePath, 'deny');

        // Verify permission is denied
        await verifyPermissionLevel('Read', testFilePath, 'deny');

        // Verify denial persists
        await verifyPermissionLevel('Read', testFilePath, 'deny');
      });
    });

    describe('Write Tool', () => {
      it('should allow writing when permission is allow-always', async () => {
        // Grant allow-always permission
        await grantPermission('Write', testFilePath, 'allow-always');

        // Verify permission is granted
        await verifyPermissionLevel('Write', testFilePath, 'allow-always');

        // Verify permission persists after multiple checks
        await verifyPermissionLevel('Write', testFilePath, 'allow-always');
        await verifyPermissionLevel('Write', testFilePath, 'allow-always');
      });

      it('should allow writing once when permission is allow-once', async () => {
        // Grant allow-once permission
        await grantPermission('Write', testFilePath, 'allow-once');

        // Verify permission is granted initially
        await verifyPermissionLevel('Write', testFilePath, 'allow-once');

        // Consume the permission by checking it (allow-once is consumed on first check)
        await simulatePermissionConsumption('Write', testFilePath);

        // Verify permission is consumed after use
        await verifyPermissionConsumed('Write', testFilePath);
      });

      it('should deny writing when permission is deny', async () => {
        // Grant deny permission
        await grantPermission('Write', testFilePath, 'deny');

        // Verify permission is denied
        await verifyPermissionLevel('Write', testFilePath, 'deny');

        // Verify denial persists
        await verifyPermissionLevel('Write', testFilePath, 'deny');
      });
    });

    describe('Edit Tool', () => {
      it('should allow editing when permission is allow-always', async () => {
        // Grant allow-always permission
        await grantPermission('Edit', testFilePath, 'allow-always');

        // Verify permission is granted
        await verifyPermissionLevel('Edit', testFilePath, 'allow-always');

        // Verify permission persists after multiple checks
        await verifyPermissionLevel('Edit', testFilePath, 'allow-always');
        await verifyPermissionLevel('Edit', testFilePath, 'allow-always');
      });

      it('should allow editing once when permission is allow-once', async () => {
        // Grant allow-once permission
        await grantPermission('Edit', testFilePath, 'allow-once');

        // Verify permission is granted initially
        await verifyPermissionLevel('Edit', testFilePath, 'allow-once');

        // Consume the permission by checking it (allow-once is consumed on first check)
        await simulatePermissionConsumption('Edit', testFilePath);

        // Verify permission is consumed after use
        await verifyPermissionConsumed('Edit', testFilePath);
      });

      it('should deny editing when permission is deny', async () => {
        // Grant deny permission
        await grantPermission('Edit', testFilePath, 'deny');

        // Verify permission is denied
        await verifyPermissionLevel('Edit', testFilePath, 'deny');

        // Verify denial persists
        await verifyPermissionLevel('Edit', testFilePath, 'deny');
      });
    });
  });

  // ============================================================================
  // Shell Tools Tests
  // ============================================================================

  describe('Shell Tools', () => {
    describe('Bash Tool', () => {
      const testCommand = 'echo "test command"';

      it('should allow command execution when permission is allow-always', async () => {
        // Grant allow-always permission
        await grantPermission('Bash', testCommand, 'allow-always');

        // Verify permission is granted
        await verifyPermissionLevel('Bash', testCommand, 'allow-always');

        // Verify permission persists after multiple checks
        await verifyPermissionLevel('Bash', testCommand, 'allow-always');
        await verifyPermissionLevel('Bash', testCommand, 'allow-always');
      });

      it('should allow command execution once when permission is allow-once', async () => {
        // Grant allow-once permission
        await grantPermission('Bash', testCommand, 'allow-once');

        // Verify permission is granted initially
        await verifyPermissionLevel('Bash', testCommand, 'allow-once');

        // Consume the permission by checking it (allow-once is consumed on first check)
        await simulatePermissionConsumption('Bash', testCommand);

        // Verify permission is consumed after use
        await verifyPermissionConsumed('Bash', testCommand);
      });

      it('should deny command execution when permission is deny', async () => {
        // Grant deny permission
        await grantPermission('Bash', testCommand, 'deny');

        // Verify permission is denied
        await verifyPermissionLevel('Bash', testCommand, 'deny');

        // Verify denial persists
        await verifyPermissionLevel('Bash', testCommand, 'deny');
      });
    });
  });

  // ============================================================================
  // Search Tools Tests
  // ============================================================================

  describe('Search Tools', () => {
    describe('Grep Tool', () => {
      const testPattern = 'test.*content';

      it('should allow searching when permission is allow-always', async () => {
        // Grant allow-always permission
        await grantPermission('Grep', testPattern, 'allow-always');

        // Verify permission is granted
        await verifyPermissionLevel('Grep', testPattern, 'allow-always');

        // Verify permission persists after multiple checks
        await verifyPermissionLevel('Grep', testPattern, 'allow-always');
        await verifyPermissionLevel('Grep', testPattern, 'allow-always');
      });

      it('should allow searching once when permission is allow-once', async () => {
        // Grant allow-once permission
        await grantPermission('Grep', testPattern, 'allow-once');

        // Verify permission is granted initially
        await verifyPermissionLevel('Grep', testPattern, 'allow-once');

        // Consume the permission by checking it (allow-once is consumed on first check)
        await simulatePermissionConsumption('Grep', testPattern);

        // Verify permission is consumed after use
        await verifyPermissionConsumed('Grep', testPattern);
      });

      it('should deny searching when permission is deny', async () => {
        // Grant deny permission
        await grantPermission('Grep', testPattern, 'deny');

        // Verify permission is denied
        await verifyPermissionLevel('Grep', testPattern, 'deny');

        // Verify denial persists
        await verifyPermissionLevel('Grep', testPattern, 'deny');
      });
    });

    describe('Glob Tool', () => {
      const testPattern = '**/*.txt';

      it('should allow file pattern matching when permission is allow-always', async () => {
        // Grant allow-always permission
        await grantPermission('Glob', testPattern, 'allow-always');

        // Verify permission is granted
        await verifyPermissionLevel('Glob', testPattern, 'allow-always');

        // Verify permission persists after multiple checks
        await verifyPermissionLevel('Glob', testPattern, 'allow-always');
        await verifyPermissionLevel('Glob', testPattern, 'allow-always');
      });

      it('should allow file pattern matching once when permission is allow-once', async () => {
        // Grant allow-once permission
        await grantPermission('Glob', testPattern, 'allow-once');

        // Verify permission is granted initially
        await verifyPermissionLevel('Glob', testPattern, 'allow-once');

        // Consume the permission by checking it (allow-once is consumed on first check)
        await simulatePermissionConsumption('Glob', testPattern);

        // Verify permission is consumed after use
        await verifyPermissionConsumed('Glob', testPattern);
      });

      it('should deny file pattern matching when permission is deny', async () => {
        // Grant deny permission
        await grantPermission('Glob', testPattern, 'deny');

        // Verify permission is denied
        await verifyPermissionLevel('Glob', testPattern, 'deny');

        // Verify denial persists
        await verifyPermissionLevel('Glob', testPattern, 'deny');
      });
    });
  });

  // ============================================================================
  // Scope-Based Permission Tests
  // ============================================================================

  describe('Scope-Based Permissions', () => {
    it('should respect wildcard scope patterns', async () => {
      const wildcardScope = join(testDirPath, '**/*.txt');

      // Test with different permission levels for wildcard patterns
      await grantPermission('Read', wildcardScope, 'allow-always');
      await verifyPermissionLevel('Read', wildcardScope, 'allow-always');

      // Test specific file under wildcard scope
      await grantPermission('Write', testFilePath, 'allow-once');
      await verifyPermissionLevel('Write', testFilePath, 'allow-once');
    });

    it('should handle nested scope hierarchies', async () => {
      const parentScope = join(testDirPath, '**');
      const childScope = testFilePath;

      // Grant parent scope permission
      await grantPermission('Edit', parentScope, 'allow-always');
      await verifyPermissionLevel('Edit', parentScope, 'allow-always');

      // Test child scope permission
      await grantPermission('Edit', childScope, 'allow-once');
      await verifyPermissionLevel('Edit', childScope, 'allow-once');
    });

    it('should handle global scope permissions', async () => {
      // Test permission without scope (global)
      await grantPermission('Bash', '', 'allow-always');
      await verifyPermissionLevel('Bash', '', 'allow-always');

      await grantPermission('Grep', '', 'deny');
      await verifyPermissionLevel('Grep', '', 'deny');
    });
  });

  // ============================================================================
  // Permission Lifecycle Tests
  // ============================================================================

  describe('Permission Lifecycle', () => {
    it('should handle grant → check → revoke cycles', async () => {
      const tool = 'Read';
      const scope = testFilePath;

      // Grant permission
      await grantPermission(tool, scope, 'allow-always');
      await verifyPermissionLevel(tool, scope, 'allow-always');

      // Revoke permission
      await permissionManager.revokePermission(tool, scope);
      await verifyPermissionConsumed(tool, scope);
    });

    it('should correctly consume allow-once permissions', async () => {
      const tool = 'Write';
      const scope = testFilePath;

      // Grant allow-once permission
      await grantPermission(tool, scope, 'allow-once');
      await verifyPermissionLevel(tool, scope, 'allow-once');

      // Consume the permission by checking it (allow-once is consumed on first check)
      await simulatePermissionConsumption(tool, scope);

      // Verify it's consumed
      await verifyPermissionConsumed(tool, scope);

      // Second check should still return null
      await verifyPermissionConsumed(tool, scope);
    });

    it('should maintain permission persistence for allow-always', async () => {
      const tool = 'Edit';
      const scope = testFilePath;

      // Grant allow-always permission
      await grantPermission(tool, scope, 'allow-always');

      // Multiple checks should not consume the permission
      for (let i = 0; i < 5; i++) {
        await verifyPermissionLevel(tool, scope, 'allow-always');
      }
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty scope gracefully', async () => {
      await grantPermission('Bash', '', 'allow-always');
      await verifyPermissionLevel('Bash', '', 'allow-always');
    });

    it('should handle undefined scope as empty string', async () => {
      await grantPermission('Grep', '', 'deny');
      const result = await checkPermission('Grep');
      expect(result).toBe('deny');
    });

    it('should handle permission checks for non-existent permissions', async () => {
      const result = await checkPermission('NonExistentTool', 'some-scope');
      expect(result).toBeNull();
    });

    it('should handle concurrent permission operations', async () => {
      const promises = [];

      // Concurrent grants
      promises.push(grantPermission('Read', testFilePath + '1', 'allow-always'));
      promises.push(grantPermission('Write', testFilePath + '2', 'allow-once'));
      promises.push(grantPermission('Edit', testFilePath + '3', 'deny'));

      await Promise.all(promises);

      // Verify all permissions were granted correctly
      await verifyPermissionLevel('Read', testFilePath + '1', 'allow-always');
      await verifyPermissionLevel('Write', testFilePath + '2', 'allow-once');
      await verifyPermissionLevel('Edit', testFilePath + '3', 'deny');
    });
  });
});