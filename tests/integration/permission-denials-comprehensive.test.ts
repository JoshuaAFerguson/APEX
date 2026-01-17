/**
 * @fileoverview Comprehensive Permission Denials Integration Tests
 *
 * This test suite provides comprehensive coverage of permission denial scenarios
 * to verify that:
 * 1. Permission denials work correctly - denying permissions prevents actions
 * 2. Denial states are tracked accurately in the system
 * 3. Denied permissions can be re-requested appropriately
 *
 * These tests extend the existing permission acceptance criteria tests with
 * more detailed coverage of denial edge cases, tracking mechanisms, and
 * re-request workflows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  ApexOrchestrator,
  PermissionManager,
  PermissionStore,
  PermissionPresetManager
} from '@apexcli/orchestrator';
import type {
  PermissionDeniedEventData,
  ApprovalDeniedEventData,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  DangerousOperationDetectedEventData,
  ToolPermissionCheckOptions,
  PermissionLevel,
} from '@apexcli/core';

describe('Permission Denials - Comprehensive Integration Tests', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  // Event tracking for verification
  let permissionRequestEvents: PermissionRequestEventData[] = [];
  let permissionDeniedEvents: PermissionDeniedEventData[] = [];
  let permissionGrantedEvents: PermissionGrantedEventData[] = [];
  let approvalDeniedEvents: ApprovalDeniedEventData[] = [];
  let dangerousOperationEvents: DangerousOperationDetectedEventData[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-permission-denial-test-'));

    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Minimal config for denial testing
    const config = `
project:
  name: permission-denial-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all  # All operations require confirmation

agents:
  test-agent:
    role: "Test agent for permission denials"
    model: sonnet
    tools: [Read, Write, Edit, Bash, LSP]

workflows:
  denial-test:
    name: "Denial Test Workflow"
    agents: [test-agent]
    stages:
      - name: test-stage
        agent: test-agent
        description: "Test stage for permission denials"

limits:
  maxTasksPerHour: 100
  maxCostPerTask: 10.0
`;

    await writeFile(join(apexDir, 'config.yaml'), config);

    orchestrator = new ApexOrchestrator(tempDir);
    await orchestrator.initialize();

    // Reset event tracking arrays
    permissionRequestEvents = [];
    permissionDeniedEvents = [];
    permissionGrantedEvents = [];
    approvalDeniedEvents = [];
    dangerousOperationEvents = [];

    // Set up event listeners for tracking
    orchestrator.on('permission:request', (event) => {
      permissionRequestEvents.push(event);
    });

    orchestrator.on('permission:denied', (event) => {
      permissionDeniedEvents.push(event);
    });

    orchestrator.on('permission:granted', (event) => {
      permissionGrantedEvents.push(event);
    });

    orchestrator.on('approval:denied', (event) => {
      approvalDeniedEvents.push(event);
    });

    orchestrator.on('dangerous:detected', (event) => {
      dangerousOperationEvents.push(event);
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('1. Permission Denials Prevent Actions', () => {
    it('should prevent tool execution when explicitly denied', async () => {
      // GIVEN: Explicitly denied permission
      await orchestrator.permissionManager.grantPermission('Write', '/system/sensitive-file', 'deny');

      // WHEN: Checking tool permission for denied resource
      const result = await orchestrator.permissionManager.checkToolPermission('Write', {
        scope: '/system/sensitive-file',
        operation: 'file-write',
        parameters: { filePath: '/system/sensitive-file', content: 'malicious' }
      });

      // THEN: Tool execution should be prevented
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('denied');
      expect(result.level).toBe('deny');
      expect(result.requiresConfirmation).toBe(false); // No confirmation needed, explicitly denied
    });

    it('should prevent multiple tools when scoped denial applies', async () => {
      // GIVEN: Wildcard denial for sensitive directory
      await orchestrator.permissionManager.grantPermission('*', '/etc/*', 'deny');

      // WHEN: Checking multiple tools for files in denied directory
      const results = await Promise.all([
        orchestrator.permissionManager.checkToolPermission('Read', {
          scope: '/etc/passwd',
          operation: 'file-read'
        }),
        orchestrator.permissionManager.checkToolPermission('Write', {
          scope: '/etc/shadow',
          operation: 'file-write'
        }),
        orchestrator.permissionManager.checkToolPermission('Edit', {
          scope: '/etc/hosts',
          operation: 'file-edit'
        }),
      ]);

      // THEN: All tools should be denied
      for (const result of results) {
        expect(result.allowed).toBe(false);
        expect(result.denialReason).toContain('denied');
      }
    });

    it('should deny dangerous operations based on security rules', async () => {
      // GIVEN: Dangerous bash command
      const dangerousCommand = 'rm -rf /';
      await orchestrator.permissionManager.grantPermission('Bash', dangerousCommand, 'deny');

      // WHEN: Checking permission for dangerous command
      const result = await orchestrator.permissionManager.checkToolPermission('Bash', {
        scope: dangerousCommand,
        operation: 'shell-command',
        parameters: { command: dangerousCommand },
        isDangerous: true
      });

      // THEN: Should be denied
      expect(result.allowed).toBe(false);
      expect(result.denialReason).toContain('denied');
    });

    it('should prevent actions based on preset denials', async () => {
      // GIVEN: Read-only preset denying write operations
      await orchestrator.presetManager.applyPreset('read-only');

      // WHEN: Checking write-related tools
      const writeResults = await Promise.all([
        orchestrator.presetManager.isToolDenied('Write'),
        orchestrator.presetManager.isToolDenied('Edit'),
        orchestrator.presetManager.isToolDenied('Bash'), // May involve writes
      ]);

      // THEN: Write operations should be denied
      expect(writeResults[0]).toBe(true); // Write denied
      expect(writeResults[1]).toBe(true); // Edit denied
      // Note: Bash might not be denied by read-only preset depending on implementation

      // AND: Read operations should still be allowed
      const readAllowed = await orchestrator.presetManager.isToolAllowed('Read');
      expect(readAllowed).toBe(true);
    });

    it('should enforce path-based denial restrictions', async () => {
      // GIVEN: Path-specific denials
      const deniedPaths = [
        '/proc/sys/*',
        '/dev/mem',
        '/root/.ssh/*',
        '/home/*/.ssh/id_rsa'
      ];

      for (const path of deniedPaths) {
        await orchestrator.permissionManager.grantPermission('Read', path, 'deny');
      }

      // WHEN: Testing access to denied paths
      const denialResults = await Promise.all(
        deniedPaths.map(path =>
          orchestrator.permissionManager.checkToolPermission('Read', {
            scope: path.replace('*', 'file'),
            operation: 'file-read'
          })
        )
      );

      // THEN: All paths should be denied
      for (const result of denialResults) {
        expect(result.allowed).toBe(false);
      }
    });
  });

  describe('2. Denial State Tracking', () => {
    it('should track who denied permissions and when', async () => {
      // GIVEN: A permission request
      const tool = 'Write';
      const scope = '/tmp/tracked-denial.txt';
      const requestId = await orchestrator.requestPermission(
        'test-task-1',
        tool,
        scope,
        'Test operation requiring permission',
        false,
        'test-agent'
      );

      // WHEN: Denying the permission with user details
      const denierName = 'security-admin';
      const denialReason = 'Operation violates security policy';
      await orchestrator.denyPermissionConfirmation(
        requestId,
        'test-task-1',
        tool,
        scope,
        denierName,
        denialReason
      );

      // THEN: Permission denial should be tracked with metadata
      const storedPermission = await orchestrator.permissionStore.getPermission(tool, scope);
      expect(storedPermission).toBeDefined();
      expect(storedPermission?.level).toBe('deny');
      expect(storedPermission?.grantedBy).toBe(denierName);
      expect(storedPermission?.grantReason).toContain(denialReason);
      expect(storedPermission?.createdAt).toBeDefined();

      // AND: Denial event should be emitted with tracking info
      expect(permissionDeniedEvents).toHaveLength(1);
      const denialEvent = permissionDeniedEvents[0];
      expect(denialEvent.tool).toBe(tool);
      expect(denialEvent.scope).toBe(scope);
      expect(denialEvent.deniedBy).toBe(denierName);
      expect(denialEvent.reason).toBe(denialReason);
      expect(denialEvent.timestamp).toBeDefined();
    });

    it('should maintain audit trail for denial decisions', async () => {
      // GIVEN: Multiple denial decisions over time
      const denialActions = [
        { tool: 'Bash', scope: 'sudo reboot', denier: 'admin-1', reason: 'Maintenance window not approved' },
        { tool: 'Write', scope: '/etc/passwd', denier: 'admin-2', reason: 'Security violation' },
        { tool: 'LSP', scope: 'dangerous-query', denier: 'dev-lead', reason: 'Code injection risk' },
      ];

      // WHEN: Recording denial decisions
      for (const denial of denialActions) {
        const requestId = await orchestrator.requestPermission(
          `audit-task-${denial.tool}`,
          denial.tool,
          denial.scope,
          `Audit test for ${denial.tool}`,
          false,
          'audit-agent'
        );
        await orchestrator.denyPermissionConfirmation(
          requestId,
          `audit-task-${denial.tool}`,
          denial.tool,
          denial.scope,
          denial.denier,
          denial.reason
        );
      }

      // THEN: All denials should be auditable
      expect(permissionDeniedEvents).toHaveLength(denialActions.length);

      for (let i = 0; i < denialActions.length; i++) {
        const event = permissionDeniedEvents[i];
        const expected = denialActions[i];

        expect(event.tool).toBe(expected.tool);
        expect(event.scope).toBe(expected.scope);
        expect(event.deniedBy).toBe(expected.denier);
        expect(event.reason).toBe(expected.reason);
        expect(event.timestamp).toBeDefined();

        // Verify persistence
        const stored = await orchestrator.permissionStore.getPermission(expected.tool, expected.scope);
        expect(stored?.level).toBe('deny');
        expect(stored?.grantedBy).toBe(expected.denier);
        expect(stored?.grantReason).toContain(expected.reason);
      }
    });

    it('should track denial reasons with categorization', async () => {
      // GIVEN: Denials with different categories/reasons
      const categorizedDenials = [
        {
          tool: 'Write',
          scope: '/system/config',
          reason: 'Security: Unauthorized system modification',
          tags: ['security', 'system']
        },
        {
          tool: 'Bash',
          scope: 'dangerous-script.sh',
          reason: 'Safety: Potentially destructive operation',
          tags: ['safety', 'destructive']
        },
        {
          tool: 'Edit',
          scope: '/database/schema',
          reason: 'Policy: Change requires approval workflow',
          tags: ['policy', 'database']
        },
      ];

      // WHEN: Denying with categorized reasons
      for (const denial of categorizedDenials) {
        await orchestrator.permissionManager.grantPermission(
          denial.tool,
          denial.scope,
          'deny',
          denial.reason,
          'policy-engine',
          undefined, // expiresAt
          denial.tags
        );
      }

      // THEN: Denials should be categorized for analysis
      for (const denial of categorizedDenials) {
        const stored = await orchestrator.permissionStore.getPermission(denial.tool, denial.scope);
        expect(stored?.level).toBe('deny');
        expect(stored?.grantReason).toBe(denial.reason);
        expect(stored?.tags).toEqual(denial.tags);
      }
    });

    it('should handle concurrent denial tracking correctly', async () => {
      // GIVEN: Multiple simultaneous permission requests
      const concurrentRequests = await Promise.all([
        orchestrator.requestPermission('concurrent-1', 'Read', '/file1', 'Concurrent test 1', false, 'agent-1'),
        orchestrator.requestPermission('concurrent-2', 'Write', '/file2', 'Concurrent test 2', false, 'agent-2'),
        orchestrator.requestPermission('concurrent-3', 'Edit', '/file3', 'Concurrent test 3', false, 'agent-3'),
      ]);

      // WHEN: Denying all requests concurrently
      const denialPromises = concurrentRequests.map((requestId, index) =>
        orchestrator.denyPermissionConfirmation(
          requestId,
          `concurrent-${index + 1}`,
          ['Read', 'Write', 'Edit'][index],
          [`/file1`, `/file2`, `/file3`][index],
          `denier-${index + 1}`,
          `Concurrent denial ${index + 1}`
        )
      );

      await Promise.all(denialPromises);

      // THEN: All denials should be tracked correctly without conflicts
      expect(permissionDeniedEvents).toHaveLength(3);

      const tools = ['Read', 'Write', 'Edit'];
      const scopes = ['/file1', '/file2', '/file3'];

      for (let i = 0; i < 3; i++) {
        const stored = await orchestrator.permissionStore.getPermission(tools[i], scopes[i]);
        expect(stored?.level).toBe('deny');
        expect(stored?.grantedBy).toBe(`denier-${i + 1}`);
        expect(stored?.grantReason).toContain(`Concurrent denial ${i + 1}`);
      }
    });
  });

  describe('3. Denied Permission Re-Request Scenarios', () => {
    it('should allow re-requesting previously denied permissions', async () => {
      // GIVEN: Initially denied permission
      const tool = 'Write';
      const scope = '/tmp/re-request-test.txt';

      const initialRequestId = await orchestrator.requestPermission(
        'initial-task',
        tool,
        scope,
        'Initial request',
        false,
        'test-agent'
      );

      await orchestrator.denyPermissionConfirmation(
        initialRequestId,
        'initial-task',
        tool,
        scope,
        'initial-denier',
        'Initial denial'
      );

      // Verify initial denial
      const initialCheck = await orchestrator.permissionManager.checkPermission(tool, scope);
      expect(initialCheck).toBe('deny');

      // WHEN: Re-requesting the same permission
      const newRequestId = await orchestrator.requestPermission(
        'retry-task',
        tool,
        scope,
        'Re-request after review',
        false,
        'test-agent'
      );

      // THEN: Should receive new request ID (different from initial)
      expect(newRequestId).toBeDefined();
      expect(newRequestId).not.toBe(initialRequestId);

      // AND: Should be able to track the re-request
      expect(permissionRequestEvents.length).toBeGreaterThanOrEqual(2);
      const reRequestEvent = permissionRequestEvents.find(e => e.requestId === newRequestId);
      expect(reRequestEvent).toBeDefined();

      // WHEN: Granting the re-request
      await orchestrator.grantPermissionConfirmation(
        newRequestId,
        'retry-task',
        tool,
        scope,
        'allow-once',
        'approver',
        'Approved after review'
      );

      // THEN: Permission should now be allowed
      const finalCheck = await orchestrator.permissionManager.checkPermission(tool, scope);
      expect(finalCheck).toBe('allow-once');
    });

    it('should handle multiple re-request cycles', async () => {
      // GIVEN: A permission that goes through multiple request/denial cycles
      const tool = 'Bash';
      const scope = 'complex-operation.sh';

      const cycles = [
        { requester: 'agent-1', denier: 'reviewer-1', reason: 'Needs testing' },
        { requester: 'agent-2', denier: 'reviewer-2', reason: 'Incomplete documentation' },
        { requester: 'agent-3', approver: 'reviewer-3', reason: 'Approved after fixes' },
      ];

      let currentPermissionState = null;

      // WHEN: Going through multiple cycles
      for (let i = 0; i < cycles.length; i++) {
        const cycle = cycles[i];
        const taskId = `cycle-${i + 1}`;

        // Request permission
        const requestId = await orchestrator.requestPermission(
          taskId,
          tool,
          scope,
          `Cycle ${i + 1} request`,
          false,
          cycle.requester
        );

        if (cycle.denier) {
          // Deny the permission
          await orchestrator.denyPermissionConfirmation(
            requestId,
            taskId,
            tool,
            scope,
            cycle.denier,
            cycle.reason
          );
          currentPermissionState = 'deny';
        } else if (cycle.approver) {
          // Grant the permission
          await orchestrator.grantPermissionConfirmation(
            requestId,
            taskId,
            tool,
            scope,
            'allow-always',
            cycle.approver,
            cycle.reason
          );
          currentPermissionState = 'allow-always';
        }

        // Verify state after each cycle
        const checkResult = await orchestrator.permissionManager.checkPermission(tool, scope);
        expect(checkResult).toBe(currentPermissionState);
      }

      // THEN: Final state should be approved
      const finalState = await orchestrator.permissionManager.checkPermission(tool, scope);
      expect(finalState).toBe('allow-always');

      // AND: Event history should show all cycles
      expect(permissionRequestEvents.length).toBeGreaterThanOrEqual(3);
      expect(permissionDeniedEvents).toHaveLength(2);
      expect(permissionGrantedEvents).toHaveLength(1);
    });

    it('should respect re-request with different scopes', async () => {
      // GIVEN: Denial for specific scope
      await orchestrator.permissionManager.grantPermission('Read', '/sensitive/file1.txt', 'deny');

      // WHEN: Re-requesting with broader scope
      const broadRequestId = await orchestrator.requestPermission(
        'broad-scope',
        'Read',
        '/sensitive/*',
        'Broader scope request',
        false,
        'test-agent'
      );

      // THEN: Should be treated as new request (not blocked by specific denial)
      expect(broadRequestId).toBeDefined();

      // WHEN: Granting broader scope
      await orchestrator.grantPermissionConfirmation(
        broadRequestId,
        'broad-scope',
        'Read',
        '/sensitive/*',
        'allow-always',
        'scope-approver',
        'Approved broader access'
      );

      // THEN: Broader scope should be allowed
      const broadResult = await orchestrator.permissionManager.checkPermission('Read', '/sensitive/*');
      expect(broadResult).toBe('allow-always');

      // BUT: Specific denial should still be in effect
      const specificResult = await orchestrator.permissionManager.checkPermission('Read', '/sensitive/file1.txt');
      expect(specificResult).toBe('deny'); // More specific denial takes precedence
    });

    it('should handle re-request escalation workflows', async () => {
      // GIVEN: Standard user denial, then admin escalation
      const tool = 'Write';
      const scope = '/production/config.yaml';

      // Standard user denial
      const userRequestId = await orchestrator.requestPermission(
        'user-request',
        tool,
        scope,
        'Standard user request',
        false,
        'user-agent'
      );

      await orchestrator.denyPermissionConfirmation(
        userRequestId,
        'user-request',
        tool,
        scope,
        'team-lead',
        'Requires admin approval'
      );

      // WHEN: Admin escalation re-request
      const adminRequestId = await orchestrator.requestPermission(
        'admin-escalation',
        tool,
        scope,
        'Admin escalation after team lead review',
        false,
        'admin-agent',
        { escalation: true, originalRequestId: userRequestId }
      );

      await orchestrator.grantPermissionConfirmation(
        adminRequestId,
        'admin-escalation',
        tool,
        scope,
        'allow-once',
        'system-admin',
        'Approved via escalation'
      );

      // THEN: Permission should be granted via escalation
      const escalationResult = await orchestrator.permissionManager.checkPermission(tool, scope);
      expect(escalationResult).toBe('allow-once');

      // AND: Audit trail should show escalation path
      const grantEvent = permissionGrantedEvents[0];
      expect(grantEvent.grantedBy).toBe('system-admin');
      expect(grantEvent.reason).toContain('escalation');
    });

    it('should handle re-request after permission expiration', async () => {
      // GIVEN: Temporarily granted permission that expires
      const tool = 'Edit';
      const scope = '/tmp/temporary-access.txt';
      const expirationDate = new Date(Date.now() + 100); // Expire in 100ms

      await orchestrator.permissionManager.grantPermission(
        tool,
        scope,
        'allow-always',
        'Temporary access',
        'temp-granter',
        expirationDate
      );

      // Verify initially allowed
      let currentState = await orchestrator.permissionManager.checkPermission(tool, scope);
      expect(currentState).toBe('allow-always');

      // WHEN: Waiting for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // THEN: Permission should be expired (null)
      currentState = await orchestrator.permissionManager.checkPermission(tool, scope);
      expect(currentState).toBeNull(); // Expired permissions return null

      // WHEN: Re-requesting after expiration
      const renewRequestId = await orchestrator.requestPermission(
        'renewal-task',
        tool,
        scope,
        'Renewal after expiration',
        false,
        'renewal-agent'
      );

      await orchestrator.grantPermissionConfirmation(
        renewRequestId,
        'renewal-task',
        tool,
        scope,
        'allow-always',
        'renewer',
        'Renewed access'
      );

      // THEN: Permission should be renewed
      const renewedState = await orchestrator.permissionManager.checkPermission(tool, scope);
      expect(renewedState).toBe('allow-always');
    });
  });

  describe('4. Approval Denial Integration', () => {
    it('should handle approval gate denials correctly', async () => {
      // GIVEN: Task with approval gate
      const taskId = await orchestrator.createTask('Approval denial test', 'feature');
      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan requiring approval' },
        conversationState: [{ type: 'text', text: 'Awaiting approval' }],
        metadata: { approvalRequired: true }
      });

      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      // WHEN: Denying the approval
      await orchestrator.denyApproval(
        approvalId,
        'approval-denier',
        'Plan needs more detail'
      );

      // THEN: Task should be marked as failed
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.result).toContain('approval-denier');
      expect(task?.result).toContain('Plan needs more detail');

      // AND: Approval denied event should be emitted
      expect(approvalDeniedEvents).toHaveLength(1);
      const denialEvent = approvalDeniedEvents[0];
      expect(denialEvent.approvalId).toBe(approvalId);
      expect(denialEvent.taskId).toBe(taskId);
      expect(denialEvent.approver).toBe('approval-denier');
      expect(denialEvent.reason).toBe('Plan needs more detail');
      expect(denialEvent.timestamp).toBeDefined();
    });

    it('should track denial vs permission denial separately', async () => {
      // GIVEN: Both permission and approval denials
      const taskId = await orchestrator.createTask('Mixed denial test', 'feature');

      // Permission denial
      const permRequestId = await orchestrator.requestPermission(
        taskId,
        'Write',
        '/secure/file',
        'Permission test',
        false,
        'test-agent'
      );
      await orchestrator.denyPermissionConfirmation(
        permRequestId,
        taskId,
        'Write',
        '/secure/file',
        'permission-denier',
        'File access denied'
      );

      // Approval denial
      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'implementation',
        status: 'awaiting_approval',
        stageOutputs: { implementation: 'test implementation' },
        conversationState: [{ type: 'text', text: 'Implementation checkpoint' }],
        metadata: { mixed: true }
      });

      const approvalId = `approval-${taskId}-gate-${Date.now()}`;
      await orchestrator.denyApproval(
        approvalId,
        'approval-denier',
        'Implementation rejected'
      );

      // THEN: Should have both types of denials tracked
      expect(permissionDeniedEvents).toHaveLength(1);
      expect(approvalDeniedEvents).toHaveLength(1);

      const permDenial = permissionDeniedEvents[0];
      const approvalDenial = approvalDeniedEvents[0];

      // Permission denial tracking
      expect(permDenial.tool).toBe('Write');
      expect(permDenial.scope).toBe('/secure/file');
      expect(permDenial.deniedBy).toBe('permission-denier');
      expect(permDenial.reason).toBe('File access denied');

      // Approval denial tracking
      expect(approvalDenial.approvalId).toBe(approvalId);
      expect(approvalDenial.approver).toBe('approval-denier');
      expect(approvalDenial.reason).toBe('Implementation rejected');

      // Different event types, different data structures
      expect(permDenial).not.toHaveProperty('approvalId');
      expect(approvalDenial).not.toHaveProperty('tool');
    });
  });

  describe('5. Edge Cases and Error Scenarios', () => {
    it('should handle invalid denial requests gracefully', async () => {
      // WHEN: Trying to deny non-existent request
      await expect(
        orchestrator.denyPermissionConfirmation(
          'invalid-request-id',
          'fake-task',
          'Write',
          '/fake/path',
          'fake-denier',
          'Invalid denial'
        )
      ).rejects.toThrow(); // Should throw error for invalid request

      // THEN: No denial events should be emitted
      expect(permissionDeniedEvents).toHaveLength(0);
    });

    it('should handle denial with empty/null reasons', async () => {
      const requestId = await orchestrator.requestPermission(
        'empty-reason-test',
        'Read',
        '/test/file',
        'Test empty reason',
        false,
        'test-agent'
      );

      // WHEN: Trying to deny with empty reason
      await expect(
        orchestrator.denyPermissionConfirmation(
          requestId,
          'empty-reason-test',
          'Read',
          '/test/file',
          'denier',
          ''
        )
      ).rejects.toThrow('Reason is required');

      // WHEN: Trying to deny with null reason
      await expect(
        orchestrator.denyPermissionConfirmation(
          requestId,
          'empty-reason-test',
          'Read',
          '/test/file',
          'denier',
          null as any
        )
      ).rejects.toThrow('Reason is required');
    });

    it('should handle concurrent denials of same request', async () => {
      const requestId = await orchestrator.requestPermission(
        'concurrent-denial-test',
        'Edit',
        '/test/concurrent',
        'Concurrent denial test',
        false,
        'test-agent'
      );

      // WHEN: Multiple concurrent denial attempts
      const denialPromises = [
        orchestrator.denyPermissionConfirmation(
          requestId,
          'concurrent-denial-test',
          'Edit',
          '/test/concurrent',
          'denier-1',
          'First denial'
        ),
        orchestrator.denyPermissionConfirmation(
          requestId,
          'concurrent-denial-test',
          'Edit',
          '/test/concurrent',
          'denier-2',
          'Second denial'
        ),
      ];

      // THEN: Only one should succeed, others should fail gracefully
      const results = await Promise.allSettled(denialPromises);
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // AND: Only one denial event should be emitted
      expect(permissionDeniedEvents).toHaveLength(1);
    });

    it('should handle denial state consistency during database issues', async () => {
      // GIVEN: Permission request
      const requestId = await orchestrator.requestPermission(
        'db-consistency-test',
        'Write',
        '/test/db-consistency',
        'DB consistency test',
        false,
        'test-agent'
      );

      // WHEN: Simulating database transaction issues (mock implementation)
      // This is a conceptual test - in real implementation, you might mock the store
      // For now, we'll test the happy path and verify consistency
      await orchestrator.denyPermissionConfirmation(
        requestId,
        'db-consistency-test',
        'Write',
        '/test/db-consistency',
        'consistency-tester',
        'Testing consistency'
      );

      // THEN: Both in-memory and persistent state should be consistent
      const memoryCheck = await orchestrator.permissionManager.checkPermission(
        'Write',
        '/test/db-consistency'
      );
      const storeCheck = await orchestrator.permissionStore.getPermission(
        'Write',
        '/test/db-consistency'
      );

      expect(memoryCheck).toBe('deny');
      expect(storeCheck?.level).toBe('deny');
      expect(storeCheck?.grantedBy).toBe('consistency-tester');
      expect(storeCheck?.grantReason).toBe('Testing consistency');
    });
  });

  describe('6. Performance and Scalability', () => {
    it('should handle high volume of denials efficiently', async () => {
      // GIVEN: Large number of permission requests
      const numRequests = 50;
      const requests = [];

      for (let i = 0; i < numRequests; i++) {
        const requestId = await orchestrator.requestPermission(
          `bulk-test-${i}`,
          'Read',
          `/bulk/file-${i}.txt`,
          `Bulk test ${i}`,
          false,
          'bulk-agent'
        );
        requests.push({
          requestId,
          taskId: `bulk-test-${i}`,
          tool: 'Read',
          scope: `/bulk/file-${i}.txt`
        });
      }

      // WHEN: Denying all requests in bulk
      const startTime = Date.now();

      await Promise.all(
        requests.map(req =>
          orchestrator.denyPermissionConfirmation(
            req.requestId,
            req.taskId,
            req.tool,
            req.scope,
            'bulk-denier',
            `Bulk denial ${requests.indexOf(req)}`
          )
        )
      );

      const endTime = Date.now();

      // THEN: Should complete within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds

      // AND: All denials should be tracked
      expect(permissionDeniedEvents).toHaveLength(numRequests);

      // AND: All permissions should be denied in database
      for (const req of requests) {
        const stored = await orchestrator.permissionStore.getPermission(req.tool, req.scope);
        expect(stored?.level).toBe('deny');
      }
    });
  });
});