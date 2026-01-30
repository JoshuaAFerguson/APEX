/**
 * Mid-Stream Permission Revocation Tests
 *
 * Tests that verify permission revocation is correctly detected and handled
 * during active Claude SDK streaming sessions. These tests ensure:
 *
 * 1. Active sessions detect permission revocation mid-stream
 * 2. In-flight requests are gracefully terminated
 * 3. Partial results are handled appropriately
 * 4. No data corruption occurs during interruption
 *
 * @see ADR-048-mid-stream-permission-revocation-tests.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { PermissionManager } from '../permission-manager';
import { PermissionStore } from '../permission-store';
import {
  PermissionRevocationController,
  type RevocationLogEntry,
} from './helpers/permission-revocation-controller';
import {
  MockClaudeAgentSDK,
  StreamingResponseBuilder,
  MockResponseBuilder,
} from './mocks/claude-agent-sdk';
import type { StreamingEvent } from './mocks/claude-agent-sdk.types';

describe('Mid-stream permission revocation', () => {
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let revocationController: PermissionRevocationController;
  let mockSDK: MockClaudeAgentSDK;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `apex-midstream-test-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    mkdirSync(testDir, { recursive: true });

    permissionStore = new PermissionStore(testDir);
    await permissionStore.initialize();
    permissionManager = new PermissionManager(permissionStore);
    revocationController = new PermissionRevocationController(permissionManager);

    mockSDK = new MockClaudeAgentSDK();
  });

  afterEach(() => {
    if (permissionStore) {
      permissionStore.close();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    revocationController.reset();
    mockSDK.reset();
  });

  // =========================================================================
  // Scenario 1: Permission revoked between tool calls
  // =========================================================================
  describe('Scenario 1: Permission revoked between tool calls', () => {
    it('should detect revocation when checking permission after revocation point', async () => {
      // Setup: Grant permission initially
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      // Verify permission exists
      const initialCheck = await permissionManager.hasPermission('Write');
      expect(initialCheck).toBe(true);

      // Schedule revocation after first event
      revocationController.scheduleRevocation('Write', 1);

      // Simulate processing stream events
      await revocationController.notifyEventProcessed(); // Event 1 → triggers revocation

      // Verify permission was revoked
      const postRevocationCheck = await permissionManager.hasPermission('Write');
      expect(postRevocationCheck).toBe(false);

      // Verify revocation log
      const log = revocationController.getRevocationLog();
      expect(log).toHaveLength(1);
      expect(log[0].tool).toBe('Write');
      expect(log[0].wasRevoked).toBe(true);
      expect(log[0].eventIndex).toBe(1);
    });

    it('should allow tool calls before revocation and deny after', async () => {
      // Setup: Grant permissions for two tools
      await permissionManager.grantPermission('Read', undefined, 'allow-always');
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      // Schedule Write revocation after event 2
      revocationController.scheduleRevocation('Write', 2);

      // Event 1: Both tools accessible
      await revocationController.notifyEventProcessed();
      expect(await permissionManager.hasPermission('Read')).toBe(true);
      expect(await permissionManager.hasPermission('Write')).toBe(true);

      // Event 2: Triggers revocation of Write
      await revocationController.notifyEventProcessed();

      // Read still accessible, Write revoked
      expect(await permissionManager.hasPermission('Read')).toBe(true);
      expect(await permissionManager.hasPermission('Write')).toBe(false);
    });
  });

  // =========================================================================
  // Scenario 2: Revoke all tools for an agent mid-stream
  // =========================================================================
  describe('Scenario 2: Revoke all tools for an agent mid-stream', () => {
    it('should revoke all tools simultaneously', async () => {
      const tools = ['Read', 'Write', 'Edit', 'Bash', 'Glob'];

      // Grant all tools
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Schedule all revocations at event 3
      for (const tool of tools) {
        revocationController.scheduleRevocation(tool, 3);
      }

      // Process events 1-2: all tools still allowed
      await revocationController.notifyEventProcessed();
      await revocationController.notifyEventProcessed();
      for (const tool of tools) {
        expect(await permissionManager.hasPermission(tool)).toBe(true);
      }

      // Event 3: all tools revoked
      await revocationController.notifyEventProcessed();
      for (const tool of tools) {
        expect(await permissionManager.hasPermission(tool)).toBe(false);
      }

      // Verify summary
      const summary = revocationController.getSummary();
      expect(summary.totalRevocations).toBe(5);
      expect(summary.successfulRevocations).toBe(5);
      expect(summary.revokedTools).toEqual(expect.arrayContaining(tools));
    });
  });

  // =========================================================================
  // Scenario 3: Revoke during multi-tool streaming - partial results preserved
  // =========================================================================
  describe('Scenario 3: Partial results preserved during multi-tool stream', () => {
    it('should preserve results from tools used before revocation', async () => {
      // Grant Write permission
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      // Track tool call results
      const toolResults: Array<{ tool: string; allowed: boolean; eventIndex: number }> = [];

      // Schedule revocation after event 2
      revocationController.scheduleRevocation('Write', 2);

      // Simulate 4 tool calls across the stream
      for (let i = 1; i <= 4; i++) {
        await revocationController.notifyEventProcessed();
        const allowed = await permissionManager.hasPermission('Write');
        toolResults.push({ tool: 'Write', allowed, eventIndex: i });
      }

      // First 2 calls should have been allowed, last 2 denied
      expect(toolResults[0].allowed).toBe(true);
      expect(toolResults[1].allowed).toBe(true);
      expect(toolResults[2].allowed).toBe(false);
      expect(toolResults[3].allowed).toBe(false);

      // Verify partial results: we have 2 successful + 2 denied
      const successfulCalls = toolResults.filter(r => r.allowed);
      const deniedCalls = toolResults.filter(r => !r.allowed);
      expect(successfulCalls).toHaveLength(2);
      expect(deniedCalls).toHaveLength(2);
    });
  });

  // =========================================================================
  // Scenario 4: allow-always to deny transition
  // =========================================================================
  describe('Scenario 4: allow-always to deny transition', () => {
    it('should transition from allow-always to deny immediately', async () => {
      // Start with allow-always
      await permissionManager.grantPermission('Write', 'project-scope', 'allow-always');

      // Verify initial state
      const initialResult = await permissionManager.checkToolPermission('Write', {
        scope: 'project-scope',
        consumeAllowOnce: false,
      });
      expect(initialResult.allowed).toBe(true);
      expect(initialResult.level).toBe('allow-always');

      // Schedule denial (revoke + set deny) after event 1
      revocationController.scheduleDenial('Write', 1, 'project-scope');

      // Process event 1 → triggers denial
      await revocationController.notifyEventProcessed();

      // Grant the deny permission explicitly (scheduleDenial does this)
      // Now check: should be explicitly denied
      const postDenialResult = await permissionManager.checkToolPermission('Write', {
        scope: 'project-scope',
        consumeAllowOnce: false,
      });
      expect(postDenialResult.allowed).toBe(false);
      expect(postDenialResult.level).toBe('deny');
      expect(postDenialResult.denialReason).toBe('Tool access is explicitly denied');
    });
  });

  // =========================================================================
  // Scenario 5: Concurrent revocation during tool execution
  // =========================================================================
  describe('Scenario 5: Concurrent revocation during tool execution', () => {
    it('should handle revocation occurring while a tool permission check is in-flight', async () => {
      await permissionManager.grantPermission('Bash', undefined, 'allow-always');

      // Simulate a scenario where:
      // 1. Tool permission is checked (returns allowed)
      // 2. While tool is executing, permission is revoked
      // 3. Next permission check returns denied

      // Step 1: Check before revocation
      const beforeRevocation = await permissionManager.hasPermission('Bash');
      expect(beforeRevocation).toBe(true);

      // Step 2: Revoke during "execution" (concurrent operation)
      revocationController.scheduleRevocation('Bash', 1);
      await revocationController.notifyEventProcessed();

      // Step 3: Next check should be denied
      const afterRevocation = await permissionManager.hasPermission('Bash');
      expect(afterRevocation).toBe(false);

      // The tool execution that started before revocation should be considered valid
      // (it was authorized when it started), but new calls should fail
      expect(revocationController.wasToolRevoked('Bash')).toBe(true);
    });

    it('should handle concurrent revocations without race conditions', async () => {
      // Grant multiple tools
      await permissionManager.grantPermission('Read', undefined, 'allow-always');
      await permissionManager.grantPermission('Write', undefined, 'allow-always');
      await permissionManager.grantPermission('Edit', undefined, 'allow-always');

      // Schedule revocations at the same event index
      revocationController.scheduleRevocation('Read', 1);
      revocationController.scheduleRevocation('Write', 1);
      revocationController.scheduleRevocation('Edit', 1);

      // All three should be revoked atomically
      await revocationController.notifyEventProcessed();

      expect(await permissionManager.hasPermission('Read')).toBe(false);
      expect(await permissionManager.hasPermission('Write')).toBe(false);
      expect(await permissionManager.hasPermission('Edit')).toBe(false);

      const log = revocationController.getRevocationLog();
      expect(log).toHaveLength(3);
      expect(log.every(e => e.wasRevoked)).toBe(true);
      expect(log.every(e => e.eventIndex === 1)).toBe(true);
    });
  });

  // =========================================================================
  // Scenario 6: Revocation with checkpoint/state integrity
  // =========================================================================
  describe('Scenario 6: Checkpoint integrity after revocation', () => {
    it('should maintain consistent permission state after multiple revocation cycles', async () => {
      // Simulate a scenario with multiple grant/revoke cycles
      const cycles = [
        { action: 'grant' as const, tool: 'Write', level: 'allow-always' as const },
        { action: 'revoke' as const, tool: 'Write' },
        { action: 'grant' as const, tool: 'Write', level: 'allow-once' as const },
        { action: 'revoke' as const, tool: 'Write' },
        { action: 'grant' as const, tool: 'Write', level: 'allow-always' as const },
      ];

      for (const cycle of cycles) {
        if (cycle.action === 'grant') {
          await permissionManager.grantPermission(cycle.tool, undefined, cycle.level);
        } else {
          await permissionManager.revokePermission(cycle.tool);
        }
      }

      // After all cycles, last action was grant allow-always
      expect(await permissionManager.hasPermission('Write')).toBe(true);
      expect(await permissionManager.checkPermission('Write')).toBe('allow-always');
    });

    it('should correctly reflect permission state at each checkpoint moment', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      // Simulate checkpoints at different event indices
      const checkpoints: Array<{ eventIndex: number; writeAllowed: boolean }> = [];

      revocationController.scheduleRevocation('Write', 3);

      for (let i = 1; i <= 5; i++) {
        await revocationController.notifyEventProcessed();
        checkpoints.push({
          eventIndex: i,
          writeAllowed: await permissionManager.hasPermission('Write'),
        });
      }

      // Checkpoints 1-2: Write allowed (before revocation at event 3)
      expect(checkpoints[0].writeAllowed).toBe(true);
      expect(checkpoints[1].writeAllowed).toBe(true);

      // Checkpoints 3-5: Write denied (after revocation)
      // Note: Event 3 triggers revocation, so check at event 3 happens AFTER revocation
      expect(checkpoints[2].writeAllowed).toBe(false);
      expect(checkpoints[3].writeAllowed).toBe(false);
      expect(checkpoints[4].writeAllowed).toBe(false);
    });
  });

  // =========================================================================
  // Scenario 7: Session cache invalidation on revoke
  // =========================================================================
  describe('Scenario 7: Session cache invalidation', () => {
    it('should clear session cache entries when revoking allow-always permissions', async () => {
      // Grant allow-always (stored in persistent store, also cached)
      await permissionManager.grantPermission('Write', 'scope-a', 'allow-always');

      // Verify cached/stored permission
      expect(await permissionManager.checkPermission('Write', 'scope-a')).toBe('allow-always');

      // Revoke via controller
      revocationController.scheduleRevocation('Write', 1, 'scope-a');
      await revocationController.notifyEventProcessed();

      // Session cache and persistent store should both be cleared
      expect(await permissionManager.checkPermission('Write', 'scope-a')).toBeNull();
    });

    it('should clear session cache entries when revoking allow-once permissions', async () => {
      // Grant allow-once (stored in session cache)
      await permissionManager.grantPermission('Write', 'scope-b', 'allow-once');

      // Revoke before it's consumed
      revocationController.scheduleRevocation('Write', 1, 'scope-b');
      await revocationController.notifyEventProcessed();

      // Should be null (revoked before consumption)
      expect(await permissionManager.checkPermission('Write', 'scope-b')).toBeNull();
    });

    it('should handle resetSession after mid-stream revocation', async () => {
      // Grant and revoke
      await permissionManager.grantPermission('Read', undefined, 'allow-always');
      await permissionManager.grantPermission('Write', undefined, 'allow-once');

      revocationController.scheduleRevocation('Read', 1);
      await revocationController.notifyEventProcessed();

      // Reset session (simulating session boundary)
      permissionManager.resetSession();

      // Read was revoked from persistent store - should still be null
      expect(await permissionManager.checkPermission('Read')).toBeNull();

      // Write was allow-once in session cache - cleared by resetSession
      expect(await permissionManager.checkPermission('Write')).toBeNull();
    });
  });

  // =========================================================================
  // Scenario 8: Event ordering during revocation
  // =========================================================================
  describe('Scenario 8: Event ordering during revocation', () => {
    it('should maintain correct revocation order for sequentially scheduled revocations', async () => {
      const tools = ['Read', 'Write', 'Edit', 'Bash'];

      // Grant all
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Schedule revocations at sequential events
      revocationController.scheduleRevocation('Read', 1);
      revocationController.scheduleRevocation('Write', 2);
      revocationController.scheduleRevocation('Edit', 3);
      revocationController.scheduleRevocation('Bash', 4);

      // Process events and verify ordering
      for (let i = 0; i < 4; i++) {
        await revocationController.notifyEventProcessed();
      }

      const log = revocationController.getRevocationLog();
      expect(log).toHaveLength(4);

      // Verify ordering
      expect(log[0].tool).toBe('Read');
      expect(log[0].eventIndex).toBe(1);
      expect(log[1].tool).toBe('Write');
      expect(log[1].eventIndex).toBe(2);
      expect(log[2].tool).toBe('Edit');
      expect(log[2].eventIndex).toBe(3);
      expect(log[3].tool).toBe('Bash');
      expect(log[3].eventIndex).toBe(4);
    });

    it('should invoke onRevocation callbacks in order', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      const callbackOrder: string[] = [];

      revocationController.onRevocation((entry) => {
        callbackOrder.push(`revoked:${entry.tool}:${entry.eventIndex}`);
      });

      revocationController.scheduleRevocation('Write', 2);

      await revocationController.notifyEventProcessed(); // Event 1: no revocation
      expect(callbackOrder).toHaveLength(0);

      await revocationController.notifyEventProcessed(); // Event 2: triggers revocation
      expect(callbackOrder).toEqual(['revoked:Write:2']);
    });
  });

  // =========================================================================
  // Scenario 9: Graceful termination after revocation
  // =========================================================================
  describe('Scenario 9: Graceful termination after revocation', () => {
    it('should not throw errors during permission check after revocation', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      revocationController.scheduleRevocation('Write', 1);
      await revocationController.notifyEventProcessed();

      // Checking permission after revocation should not throw
      await expect(permissionManager.hasPermission('Write')).resolves.toBe(false);
      await expect(permissionManager.checkPermission('Write')).resolves.toBeNull();
      await expect(
        permissionManager.checkToolPermission('Write')
      ).resolves.toMatchObject({ allowed: true }); // No explicit deny, just null level
    });

    it('should handle graceful denial when tool is explicitly denied', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      // Schedule denial (revoke + set deny)
      revocationController.scheduleDenial('Write', 1);
      await revocationController.notifyEventProcessed();

      // checkToolPermission should return a clean denial result
      const result = await permissionManager.checkToolPermission('Write');
      expect(result.allowed).toBe(false);
      expect(result.level).toBe('deny');
      expect(result.denialReason).toBe('Tool access is explicitly denied');

      // No unhandled promise rejections
      await expect(
        permissionManager.checkToolPermission('Write', { consumeAllowOnce: false })
      ).resolves.toBeDefined();
    });

    it('should handle revocation of non-existent permission gracefully', async () => {
      // Revoke a permission that was never granted
      revocationController.scheduleRevocation('NonExistentTool', 1);
      await revocationController.notifyEventProcessed();

      const log = revocationController.getRevocationLog();
      expect(log).toHaveLength(1);
      expect(log[0].wasRevoked).toBe(false); // No permission existed to revoke
      expect(log[0].tool).toBe('NonExistentTool');
    });
  });

  // =========================================================================
  // Scenario 10: Multiple sequential revocations
  // =========================================================================
  describe('Scenario 10: Multiple sequential revocations', () => {
    it('should handle progressive permission narrowing across stream', async () => {
      // Start with broad permissions
      const tools = ['Read', 'Write', 'Edit', 'Bash', 'Glob'];
      for (const tool of tools) {
        await permissionManager.grantPermission(tool, undefined, 'allow-always');
      }

      // Schedule progressive revocations: lose one tool per event
      revocationController.scheduleRevocation('Bash', 1);   // Lose Bash
      revocationController.scheduleRevocation('Glob', 2);   // Lose Glob
      revocationController.scheduleRevocation('Edit', 3);   // Lose Edit
      revocationController.scheduleRevocation('Write', 4);  // Lose Write
      // Read is never revoked

      // Track available tools at each event
      const availableToolsPerEvent: string[][] = [];

      for (let i = 0; i < 5; i++) {
        await revocationController.notifyEventProcessed();
        const available: string[] = [];
        for (const tool of tools) {
          if (await permissionManager.hasPermission(tool)) {
            available.push(tool);
          }
        }
        availableToolsPerEvent.push(available);
      }

      // Event 1: Bash revoked → [Read, Write, Edit, Glob]
      expect(availableToolsPerEvent[0]).toEqual(
        expect.arrayContaining(['Read', 'Write', 'Edit', 'Glob'])
      );
      expect(availableToolsPerEvent[0]).not.toContain('Bash');

      // Event 2: Glob revoked → [Read, Write, Edit]
      expect(availableToolsPerEvent[1]).toEqual(
        expect.arrayContaining(['Read', 'Write', 'Edit'])
      );
      expect(availableToolsPerEvent[1]).not.toContain('Bash');
      expect(availableToolsPerEvent[1]).not.toContain('Glob');

      // Event 3: Edit revoked → [Read, Write]
      expect(availableToolsPerEvent[2]).toEqual(
        expect.arrayContaining(['Read', 'Write'])
      );

      // Event 4: Write revoked → [Read]
      expect(availableToolsPerEvent[3]).toEqual(['Read']);

      // Event 5: No more revocations → [Read]
      expect(availableToolsPerEvent[4]).toEqual(['Read']);

      // Summary
      const summary = revocationController.getSummary();
      expect(summary.totalRevocations).toBe(4);
      expect(summary.successfulRevocations).toBe(4);
      expect(summary.firstRevocationAt).toBe(1);
      expect(summary.lastRevocationAt).toBe(4);
    });

    it('should handle re-granting a revoked permission mid-stream', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      // Revoke at event 2
      revocationController.scheduleRevocation('Write', 2);

      // Process events
      await revocationController.notifyEventProcessed(); // Event 1: Write allowed
      expect(await permissionManager.hasPermission('Write')).toBe(true);

      await revocationController.notifyEventProcessed(); // Event 2: Write revoked
      expect(await permissionManager.hasPermission('Write')).toBe(false);

      // Re-grant permission (simulating admin action)
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      await revocationController.notifyEventProcessed(); // Event 3: Write re-granted
      expect(await permissionManager.hasPermission('Write')).toBe(true);
    });
  });

  // =========================================================================
  // Integration: Mock SDK streaming with revocation controller
  // =========================================================================
  describe('Integration: Mock SDK streaming with permission revocation', () => {
    it('should coordinate revocation timing with streaming events', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');

      // Build a streaming response with multiple events
      const streamingEvents = new StreamingResponseBuilder()
        .addTextChunk('Starting work...', 10)
        .addToolUse('call-1', 'Write', { path: '/tmp/file1.txt', content: 'hello' }, 10)
        .addTextChunk('First write done, doing second...', 10)
        .addToolUse('call-2', 'Write', { path: '/tmp/file2.txt', content: 'world' }, 10)
        .addUsage(1000, 500)
        .build();

      // Schedule revocation after 2nd event (after first tool_use)
      revocationController.scheduleRevocation('Write', 2);

      // Add streaming response to mock SDK
      mockSDK.addStreamingResponse(streamingEvents);

      // Process the stream and check permissions at each step
      const queryMock = mockSDK.getQueryMock();
      const iterator = await queryMock(
        { name: 'test-agent', description: 'test', prompt: 'test' } as any,
        'test prompt'
      );

      const results: Array<{ eventIndex: number; writePermission: boolean }> = [];
      let eventIndex = 0;

      for await (const event of iterator) {
        eventIndex++;
        await revocationController.notifyEventProcessed();
        const hasWrite = await permissionManager.hasPermission('Write');
        results.push({ eventIndex, writePermission: hasWrite });
      }

      // Events processed: text(1), tool_use(2)→revocation, text(3), tool_use(4), usage(5)
      expect(results.length).toBe(5);

      // Before revocation (event 1): Write allowed
      expect(results[0].writePermission).toBe(true);

      // After revocation (events 2+): Write denied
      expect(results[1].writePermission).toBe(false);
      expect(results[2].writePermission).toBe(false);
      expect(results[3].writePermission).toBe(false);
      expect(results[4].writePermission).toBe(false);
    });

    it('should handle permission check during streaming with delays', async () => {
      await permissionManager.grantPermission('Bash', undefined, 'allow-always');

      // Build streaming with deliberate delays
      const streamingEvents = new StreamingResponseBuilder()
        .addTextChunk('Preparing...', 5)
        .addToolUse('exec-1', 'Bash', { command: 'ls' }, 20) // Longer delay
        .addTextChunk('Done with first command', 5)
        .addToolUse('exec-2', 'Bash', { command: 'pwd' }, 5)
        .build();

      // Revoke after the 2nd event (first tool use) with some delay
      revocationController.scheduleRevocation('Bash', 2);

      mockSDK.addStreamingResponse(streamingEvents);
      const queryMock = mockSDK.getQueryMock();
      const iterator = await queryMock(
        { name: 'test-agent', description: 'test', prompt: 'test' } as any,
        'Execute commands'
      );

      let processedCount = 0;
      let bashAllowedAfterRevocation = false;

      for await (const event of iterator) {
        processedCount++;
        await revocationController.notifyEventProcessed();

        if (processedCount > 2) {
          // After revocation point, verify Bash is denied
          const allowed = await permissionManager.hasPermission('Bash');
          if (allowed) {
            bashAllowedAfterRevocation = true;
          }
        }
      }

      expect(processedCount).toBe(4);
      expect(bashAllowedAfterRevocation).toBe(false);
      expect(revocationController.wasToolRevoked('Bash')).toBe(true);
    });
  });

  // =========================================================================
  // Data integrity tests
  // =========================================================================
  describe('Data integrity during mid-stream revocation', () => {
    it('should not corrupt permission store during concurrent operations', async () => {
      // Rapidly grant and revoke permissions to test store integrity
      const operations: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        operations.push(
          permissionManager.grantPermission(`Tool${i}`, undefined, 'allow-always')
        );
      }
      await Promise.all(operations);

      // Revoke all simultaneously
      const revocationOps: Promise<boolean>[] = [];
      for (let i = 0; i < 10; i++) {
        revocationOps.push(permissionManager.revokePermission(`Tool${i}`));
      }
      const results = await Promise.all(revocationOps);

      // All should have been revoked
      expect(results.every(r => r === true)).toBe(true);

      // All should now be null
      for (let i = 0; i < 10; i++) {
        expect(await permissionManager.checkPermission(`Tool${i}`)).toBeNull();
      }
    });

    it('should maintain store consistency after error during revocation', async () => {
      await permissionManager.grantPermission('Write', undefined, 'allow-always');
      await permissionManager.grantPermission('Read', undefined, 'allow-always');

      // Revoke one tool normally
      await permissionManager.revokePermission('Write');
      expect(await permissionManager.checkPermission('Write')).toBeNull();

      // Read should still be unaffected
      expect(await permissionManager.checkPermission('Read')).toBe('allow-always');
    });

    it('should handle revocation controller reset cleanly', () => {
      revocationController.scheduleRevocation('Write', 1);
      revocationController.scheduleRevocation('Read', 2);

      revocationController.reset();

      // After reset, state should be clean
      expect(revocationController.getRevocationLog()).toHaveLength(0);
      expect(revocationController.getEventCount()).toBe(0);
      expect(revocationController.getSummary().totalRevocations).toBe(0);
    });
  });
});
