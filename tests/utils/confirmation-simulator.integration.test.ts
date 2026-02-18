/**
 * @fileoverview Integration tests for ConfirmationSimulator
 *
 * These tests focus on complex real-world scenarios where the confirmation
 * simulator needs to handle multiple types of confirmations in sequence,
 * simulate realistic workflow approvals, and integrate with the broader
 * APEX orchestration system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  ApexOrchestrator,
  ApprovalRequiredEventData,
  PermissionRequestEventData,
  DangerousOperationDetectedEventData,
  Task,
  TaskStatus,
} from '@apexcli/orchestrator';
import {
  ConfirmationSimulator,
  createConfirmationSimulatorWithResponses,
  waitForOrchestratorEvent,
  type BatchResponseConfig,
} from './confirmation-simulator';

// Realistic Mock Orchestrator for integration testing
class RealisticMockOrchestrator extends EventEmitter {
  private tasks: Map<string, Task> = new Map();

  respondToApproval = vi.fn();
  createTask = vi.fn();
  runTask = vi.fn();
  pauseTask = vi.fn();
  resumeTask = vi.fn();

  constructor() {
    super();

    // Set up realistic method implementations
    this.respondToApproval = vi.fn().mockImplementation(async (approvalId: string, response: any) => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate database write
      return { success: true, approvalId, response };
    });

    this.createTask = vi.fn().mockImplementation(async (description: string) => {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const task: Partial<Task> = {
        id: taskId,
        description,
        status: 'pending' as TaskStatus,
        createdAt: new Date(),
        workflowName: 'test-workflow',
        currentStage: 'planning',
      };

      this.tasks.set(taskId, task as Task);
      this.emit('task:created', task);
      return task;
    });

    this.runTask = vi.fn().mockImplementation(async (taskId: string) => {
      const task = this.tasks.get(taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);

      task.status = 'running';
      this.emit('task:started', task);

      // Simulate workflow progression that requires confirmations
      await this.simulateWorkflowStages(task);

      return task;
    });
  }

  private async simulateWorkflowStages(task: Task) {
    // Simulate a multi-stage workflow with different confirmation needs
    const stages = [
      { name: 'planning', needsApproval: false },
      { name: 'implementation', needsApproval: true, approvalType: 'code-review' },
      { name: 'testing', needsApproval: false, needsPermission: 'Write' },
      { name: 'deployment', needsApproval: true, approvalType: 'deployment', needsDangerousOp: 'service-restart' },
    ];

    for (const stage of stages) {
      task.currentStage = stage.name;
      this.emit('task:stage-changed', task, stage.name);

      if (stage.needsApproval) {
        await this.requestStageApproval(task, stage);
      }

      if (stage.needsPermission) {
        await this.requestStagePermission(task, stage);
      }

      if (stage.needsDangerousOp) {
        await this.detectDangerousOperation(task, stage);
      }

      // Small delay to simulate stage processing
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    task.status = 'completed';
    this.emit('task:completed', task);
  }

  private async requestStageApproval(task: Task, stage: any) {
    const approvalId = `approval_${task.id}_${stage.name}_${Date.now()}`;
    const approvalData: ApprovalRequiredEventData = {
      approvalId,
      taskId: task.id,
      gateName: `${stage.name}-approval`,
      gateType: stage.approvalType || 'manual',
      description: `Approval required for ${stage.name} stage`,
      timestamp: new Date(),
      minApprovals: 1,
      currentApprovals: 0,
      approvers: [],
      requester: 'workflow-engine',
      metadata: {
        stage: stage.name,
        taskDescription: task.description,
      },
    };

    this.emit('approval:required', approvalData);
  }

  private async requestStagePermission(task: Task, stage: any) {
    const permissionId = `perm_${task.id}_${stage.name}_${Date.now()}`;
    const permissionData: PermissionRequestEventData = {
      requestId: permissionId,
      tool: stage.needsPermission,
      scope: [`/project/${task.id}`],
      timestamp: new Date(),
      metadata: {
        stage: stage.name,
        taskId: task.id,
        reason: `${stage.needsPermission} access needed for ${stage.name}`,
      },
    };

    this.emit('permission:request', permissionData);
  }

  private async detectDangerousOperation(task: Task, stage: any) {
    const operationId = `danger_${task.id}_${stage.name}_${Date.now()}`;
    const dangerousData: DangerousOperationDetectedEventData = {
      operationId,
      tool: 'Bash',
      operation: `systemctl restart ${stage.needsDangerousOp}`,
      severity: 'medium',
      timestamp: new Date(),
      context: {
        stage: stage.name,
        taskId: task.id,
        service: stage.needsDangerousOp,
      },
    };

    this.emit('dangerous:detected', dangerousData);
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }
}

describe('ConfirmationSimulator Integration Tests', () => {
  let mockOrchestrator: RealisticMockOrchestrator;
  let simulator: ConfirmationSimulator;

  beforeEach(() => {
    mockOrchestrator = new RealisticMockOrchestrator();
    simulator = new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);
  });

  afterEach(() => {
    simulator.dispose();
    vi.clearAllMocks();
  });

  describe('Multi-Stage Workflow Scenarios', () => {
    it('should handle a complete CI/CD pipeline with mixed confirmations', async () => {
      // Configure comprehensive workflow responses
      const pipelineResponses: BatchResponseConfig[] = [
        // Approve code review
        {
          type: 'approval',
          matchPattern: /.*implementation.*/,
          action: 'approve',
          options: {
            approver: 'senior-dev@company.com',
            comment: 'Code looks good, tests passing'
          }
        },
        // Grant write permissions for testing
        {
          type: 'permission',
          matchPattern: 'Write',
          action: 'approve',
          options: {
            approver: 'test-admin@company.com',
            comment: 'Test file access granted'
          }
        },
        // Approve deployment
        {
          type: 'approval',
          matchPattern: /.*deployment.*/,
          action: 'approve',
          options: {
            approver: 'devops-lead@company.com',
            comment: 'Deployment approved for staging'
          }
        },
        // Confirm dangerous service restart
        {
          type: 'dangerous-operation',
          matchPattern: /systemctl restart/,
          action: 'approve',
          options: {
            approver: 'ops-admin@company.com',
            comment: 'Service restart confirmed'
          }
        }
      ];

      simulator.simulateBatchResponses(pipelineResponses);

      // Track all events
      const events: any[] = [];
      mockOrchestrator.on('task:created', (task) => events.push({ type: 'task:created', task }));
      mockOrchestrator.on('task:started', (task) => events.push({ type: 'task:started', task }));
      mockOrchestrator.on('task:stage-changed', (task, stage) => events.push({ type: 'task:stage-changed', task, stage }));
      mockOrchestrator.on('task:completed', (task) => events.push({ type: 'task:completed', task }));

      // Create and run a task
      const task = await mockOrchestrator.createTask('Deploy user authentication feature');
      await mockOrchestrator.runTask(task.id);

      // Verify the workflow completed successfully
      const completionEvent = events.find(e => e.type === 'task:completed');
      expect(completionEvent).toBeTruthy();
      expect(completionEvent.task.id).toBe(task.id);
      expect(completionEvent.task.status).toBe('completed');

      // Verify all stages were processed
      const stageEvents = events.filter(e => e.type === 'task:stage-changed');
      expect(stageEvents).toHaveLength(4);
      const stageNames = stageEvents.map(e => e.stage);
      expect(stageNames).toEqual(['planning', 'implementation', 'testing', 'deployment']);

      // Verify confirmations were handled
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledTimes(2); // implementation and deployment
    });

    it('should handle workflow failure when critical approval is denied', async () => {
      // Configure to deny deployment approval
      simulator.simulateBatchResponses([
        {
          type: 'approval',
          matchPattern: /.*implementation.*/,
          action: 'approve',
          options: { approver: 'dev-team' }
        },
        {
          type: 'permission',
          matchPattern: 'Write',
          action: 'approve',
          options: { approver: 'test-admin' }
        },
        {
          type: 'approval',
          matchPattern: /.*deployment.*/,
          action: 'deny',
          options: {
            denier: 'security-admin@company.com',
            reason: 'Security review failed - vulnerabilities detected'
          }
        }
      ]);

      const task = await mockOrchestrator.createTask('Deploy with security issues');
      await mockOrchestrator.runTask(task.id);

      // Verify deployment approval was denied
      const denialCall = mockOrchestrator.respondToApproval.mock.calls.find(
        call => call[1].response === 'denied'
      );
      expect(denialCall).toBeTruthy();
      expect(denialCall[1].message).toBe('Security review failed - vulnerabilities detected');
    });
  });

  describe('Complex Permission Scenarios', () => {
    it('should handle escalating permission requests', async () => {
      // Start with automatic denials, then escalate to manual approval
      simulator
        .simulateUserDenial(/Write/, {
          denier: 'auto-security',
          reason: 'Initial automatic denial'
        })
        .simulateUserApproval(/Write/, {
          approver: 'manual-override',
          comment: 'Override approved by admin'
        });

      let permissionEvents: any[] = [];
      mockOrchestrator.on('permission:denied', (event) => permissionEvents.push(event));
      mockOrchestrator.on('permission:granted', (event) => permissionEvents.push(event));

      // Emit two permission requests
      const permission1: PermissionRequestEventData = {
        requestId: 'write-req-1',
        tool: 'Write',
        scope: ['/secure/config'],
        timestamp: new Date(),
      };

      const permission2: PermissionRequestEventData = {
        requestId: 'write-req-2',
        tool: 'Write',
        scope: ['/secure/config'],
        timestamp: new Date(),
      };

      mockOrchestrator.emit('permission:request', permission1);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockOrchestrator.emit('permission:request', permission2);
      await new Promise(resolve => setTimeout(resolve, 10));

      // First should be denied, second approved
      expect(permissionEvents).toHaveLength(2);
      expect(permissionEvents[0].requestId).toBe('write-req-1');
      expect(permissionEvents[0].deniedBy).toBe('auto-security');
      expect(permissionEvents[1].requestId).toBe('write-req-2');
      expect(permissionEvents[1].grantedBy).toBe('manual-override');
    });

    it('should handle permission scoping and tool-specific rules', async () => {
      // Configure different rules for different tools and scopes
      simulator.simulateBatchResponses([
        {
          type: 'permission',
          matchPattern: 'Read',
          action: 'approve',
          options: { approver: 'read-admin', comment: 'Read access always allowed' }
        },
        {
          type: 'permission',
          matchPattern: 'Write',
          action: 'deny',
          options: { denier: 'write-admin', reason: 'Write access restricted' }
        },
        {
          type: 'permission',
          matchPattern: 'Bash',
          action: 'approve',
          options: { approver: 'shell-admin', comment: 'Shell access for testing' }
        }
      ]);

      const permissions = [
        { tool: 'Read', requestId: 'read-1', expected: 'granted' },
        { tool: 'Write', requestId: 'write-1', expected: 'denied' },
        { tool: 'Bash', requestId: 'bash-1', expected: 'granted' },
      ];

      const results: any[] = [];
      mockOrchestrator.on('permission:granted', (event) => results.push({ ...event, result: 'granted' }));
      mockOrchestrator.on('permission:denied', (event) => results.push({ ...event, result: 'denied' }));

      // Submit all permission requests
      for (const perm of permissions) {
        mockOrchestrator.emit('permission:request', {
          requestId: perm.requestId,
          tool: perm.tool,
          scope: ['/test'],
          timestamp: new Date(),
        });
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify results match expectations
      expect(results).toHaveLength(3);
      for (const perm of permissions) {
        const result = results.find(r => r.requestId === perm.requestId);
        expect(result).toBeTruthy();
        expect(result.result).toBe(perm.expected);
      }
    });
  });

  describe('Dangerous Operation Workflows', () => {
    it('should handle progressive dangerous operation escalation', async () => {
      // Configure escalating responses for increasingly dangerous operations
      simulator.simulateBatchResponses([
        {
          type: 'dangerous-operation',
          matchPattern: /touch.*\.tmp/,
          action: 'approve',
          options: { approver: 'auto-approve', comment: 'Safe file creation' }
        },
        {
          type: 'dangerous-operation',
          matchPattern: /rm.*\.log/,
          action: 'approve',
          options: { approver: 'log-admin', comment: 'Log cleanup approved' }
        },
        {
          type: 'dangerous-operation',
          matchPattern: /rm -rf/,
          action: 'deny',
          options: { denier: 'safety-admin', reason: 'Recursive delete blocked' }
        }
      ]);

      const operations = [
        { op: 'touch /tmp/test.tmp', expected: 'confirmed', severity: 'low' },
        { op: 'rm /var/log/old.log', expected: 'confirmed', severity: 'medium' },
        { op: 'rm -rf /data', expected: 'blocked', severity: 'critical' },
      ];

      const results: any[] = [];
      mockOrchestrator.on('dangerous:confirmed', (event) => results.push({ ...event, result: 'confirmed' }));
      mockOrchestrator.on('dangerous:blocked', (event) => results.push({ ...event, result: 'blocked' }));

      // Submit all dangerous operations
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        mockOrchestrator.emit('dangerous:detected', {
          operationId: `danger-${i}`,
          tool: 'Bash',
          operation: op.op,
          severity: op.severity as any,
          timestamp: new Date(),
        });
      }

      await new Promise(resolve => setTimeout(resolve, 30));

      // Verify results
      expect(results).toHaveLength(3);
      for (let i = 0; i < operations.length; i++) {
        const result = results.find(r => r.operationId === `danger-${i}`);
        expect(result).toBeTruthy();
        expect(result.result).toBe(operations[i].expected);
      }
    });
  });

  describe('Timeout and Delay Scenarios', () => {
    it('should handle realistic approval timeouts with escalation', async () => {
      // Set up timeout with escalation
      simulator.simulateTimeout(/urgent-approval-.*/, {
        timeoutMs: 100,
        timeoutAction: 'escalate',
        message: 'Approval escalated to management due to timeout'
      });

      let escalationEvent: any = null;
      mockOrchestrator.on('apex-event', (event) => {
        if (event.type === 'confirmation:escalated') {
          escalationEvent = event;
        }
      });

      // Submit an urgent approval that will timeout
      const urgentApproval: ApprovalRequiredEventData = {
        approvalId: 'urgent-approval-deploy',
        taskId: 'urgent-task',
        gateName: 'emergency-deploy',
        gateType: 'emergency',
        description: 'Critical bug fix deployment',
        timestamp: new Date(),
        minApprovals: 1,
        priority: 'urgent',
        metadata: {
          severity: 'critical',
          impactedUsers: 'all-users'
        },
      };

      mockOrchestrator.emit('approval:required', urgentApproval);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(escalationEvent).toBeTruthy();
      expect(escalationEvent.data.requestId).toBe('urgent-approval-deploy');
      expect(escalationEvent.data.message).toBe('Approval escalated to management due to timeout');
    });

    it('should handle delayed responses with timing verification', async () => {
      simulator.simulateUserApproval('delayed-approval', {
        approver: 'slow-approver',
        comment: 'Approved after review',
        delayMs: 100
      });

      const startTime = Date.now();

      mockOrchestrator.emit('approval:required', {
        approvalId: 'delayed-approval',
        taskId: 'delayed-task',
        gateName: 'slow-gate',
        gateType: 'manual',
        description: 'Delayed approval test',
        timestamp: new Date(),
        minApprovals: 1,
      });

      // Wait for the delayed response
      await new Promise(resolve => setTimeout(resolve, 150));

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Verify the delay was respected
      expect(elapsed).toBeGreaterThan(90); // Should be at least ~100ms
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        'delayed-approval',
        expect.objectContaining({
          approver: 'slow-approver'
        })
      );
    });
  });

  describe('Real-World Integration Patterns', () => {
    it('should support feature flag deployment workflow', async () => {
      // Simulate a feature flag deployment with multiple gates
      const featureFlagWorkflow: BatchResponseConfig[] = [
        // Approve feature flag creation
        {
          type: 'permission',
          matchPattern: 'Write',
          action: 'approve',
          options: { approver: 'feature-admin', comment: 'Feature flag config write access' }
        },
        // Approve canary deployment
        {
          type: 'approval',
          matchPattern: /canary-deploy/,
          action: 'approve',
          options: { approver: 'sre-team', comment: 'Canary deployment approved' }
        },
        // Block dangerous rollback operation initially
        {
          type: 'dangerous-operation',
          matchPattern: /rollback.*production/,
          action: 'deny',
          options: { denier: 'safety-check', reason: 'Automatic rollback protection' }
        }
      ];

      simulator.simulateBatchResponses(featureFlagWorkflow);

      const events: string[] = [];

      // Track confirmation events
      mockOrchestrator.on('permission:granted', () => events.push('permission-granted'));
      mockOrchestrator.on('approval:required', () => events.push('approval-required'));
      mockOrchestrator.on('dangerous:blocked', () => events.push('dangerous-blocked'));

      // Simulate feature flag deployment sequence
      mockOrchestrator.emit('permission:request', {
        requestId: 'ff-write-1',
        tool: 'Write',
        scope: ['/config/feature-flags.yaml'],
        timestamp: new Date(),
        metadata: { feature: 'new-auth-system' }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      mockOrchestrator.emit('approval:required', {
        approvalId: 'canary-deploy-auth',
        taskId: 'ff-deploy-task',
        gateName: 'canary-gate',
        gateType: 'canary',
        description: 'Deploy auth system feature flag to 5% of users',
        timestamp: new Date(),
        minApprovals: 1,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      mockOrchestrator.emit('dangerous:detected', {
        operationId: 'rollback-prod-1',
        tool: 'Bash',
        operation: 'kubectl rollback production auth-service',
        severity: 'high',
        timestamp: new Date(),
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(events).toEqual(['approval-required', 'permission-granted', 'dangerous-blocked']);

      // Verify responses were called appropriately
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        'canary-deploy-auth',
        expect.objectContaining({ approver: 'sre-team' })
      );
    });

    it('should handle emergency hotfix deployment with override capabilities', async () => {
      // Configure emergency override patterns
      simulator.simulateBatchResponses([
        // Emergency approvals are auto-approved
        {
          type: 'approval',
          matchPattern: /emergency-hotfix/,
          action: 'approve',
          options: { approver: 'emergency-system', comment: 'Emergency auto-approval' }
        },
        // Emergency dangerous operations require manual confirmation
        {
          type: 'dangerous-operation',
          matchPattern: /production.*restart/,
          action: 'timeout',
          options: {
            timeoutMs: 30000, // 30 second timeout
            timeoutAction: 'escalate',
            message: 'Production restart escalated - no response'
          }
        }
      ]);

      let escalationOccurred = false;
      mockOrchestrator.on('apex-event', (event) => {
        if (event.type === 'confirmation:escalated') {
          escalationOccurred = true;
        }
      });

      // Simulate emergency hotfix deployment
      mockOrchestrator.emit('approval:required', {
        approvalId: 'emergency-hotfix-deploy',
        taskId: 'hotfix-task',
        gateName: 'emergency-gate',
        gateType: 'emergency',
        description: 'Critical security hotfix deployment',
        timestamp: new Date(),
        minApprovals: 1,
        priority: 'emergency',
      });

      mockOrchestrator.emit('dangerous:detected', {
        operationId: 'prod-restart-1',
        tool: 'Bash',
        operation: 'systemctl restart production-service',
        severity: 'critical',
        timestamp: new Date(),
        context: { environment: 'production' }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Emergency approval should be granted immediately
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledWith(
        'emergency-hotfix-deploy',
        expect.objectContaining({ approver: 'emergency-system' })
      );

      // The dangerous operation should be set to timeout (escalate later)
      expect(escalationOccurred).toBe(false); // Not yet - timeout hasn't elapsed
    });
  });

  describe('Memory and Performance', () => {
    it('should handle high-volume confirmation scenarios efficiently', async () => {
      const BATCH_SIZE = 50;

      // Configure batch responses for high volume
      const batchResponses: BatchResponseConfig[] = Array.from(
        { length: BATCH_SIZE },
        (_, i) => ({
          type: 'approval',
          matchPattern: `batch-approval-${i}`,
          action: 'approve',
          options: { approver: `batch-approver-${i % 5}` } // Rotate approvers
        })
      );

      simulator.simulateBatchResponses(batchResponses);

      const startTime = Date.now();

      // Emit all confirmations rapidly
      const promises = Array.from({ length: BATCH_SIZE }, (_, i) => {
        const approvalData: ApprovalRequiredEventData = {
          approvalId: `batch-approval-${i}`,
          taskId: `batch-task-${i}`,
          gateName: `batch-gate-${i}`,
          gateType: 'batch',
          description: `Batch approval ${i}`,
          timestamp: new Date(),
          minApprovals: 1,
        };

        return new Promise<void>(resolve => {
          // Small stagger to prevent overwhelming
          setTimeout(() => {
            mockOrchestrator.emit('approval:required', approvalData);
            resolve();
          }, i * 2);
        });
      });

      await Promise.all(promises);

      // Wait for all processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Verify all approvals were processed
      expect(mockOrchestrator.respondToApproval).toHaveBeenCalledTimes(BATCH_SIZE);

      // Performance check - should handle 50 items in reasonable time
      expect(elapsed).toBeLessThan(1000); // Less than 1 second

      console.log(`Processed ${BATCH_SIZE} confirmations in ${elapsed}ms`);
    });
  });
});

describe('ConfirmationSimulator Cross-Event Integration', () => {
  let mockOrchestrator: RealisticMockOrchestrator;
  let simulator: ConfirmationSimulator;

  beforeEach(() => {
    mockOrchestrator = new RealisticMockOrchestrator();
    simulator = new ConfirmationSimulator(mockOrchestrator as unknown as ApexOrchestrator);
  });

  afterEach(() => {
    simulator.dispose();
    vi.clearAllMocks();
  });

  it('should coordinate between different confirmation types in a single workflow', async () => {
    // Use the existing workflow simulation from RealisticMockOrchestrator
    // but override with specific responses for testing coordination

    const responses: BatchResponseConfig[] = [
      // Approve all approvals
      {
        type: 'approval',
        action: 'approve',
        options: { approver: 'workflow-admin', comment: 'Auto-approved' }
      },
      // Grant all permissions
      {
        type: 'permission',
        action: 'approve',
        options: { approver: 'perm-admin', comment: 'Auto-granted' }
      },
      // Confirm dangerous operations with caution
      {
        type: 'dangerous-operation',
        action: 'approve',
        options: { approver: 'ops-admin', comment: 'Carefully approved' }
      }
    ];

    simulator.simulateBatchResponses(responses);

    // Track the order of confirmations
    const confirmationOrder: string[] = [];

    mockOrchestrator.on('approval:required', () => confirmationOrder.push('approval-required'));
    mockOrchestrator.on('permission:request', () => confirmationOrder.push('permission-request'));
    mockOrchestrator.on('dangerous:detected', () => confirmationOrder.push('dangerous-detected'));

    // Run a complete workflow
    const task = await mockOrchestrator.createTask('Integration test workflow');
    await mockOrchestrator.runTask(task.id);

    // Verify the expected order of confirmations
    expect(confirmationOrder).toEqual([
      'approval-required',    // implementation stage approval
      'permission-request',   // testing stage permission
      'approval-required',    // deployment stage approval
      'dangerous-detected'    // deployment stage dangerous operation
    ]);

    // Verify all confirmations were handled
    expect(mockOrchestrator.respondToApproval).toHaveBeenCalledTimes(2); // Two approval stages

    // Verify task completed successfully
    const finalTask = mockOrchestrator.getTask(task.id);
    expect(finalTask?.status).toBe('completed');
  });
});