/**
 * Unit tests for ApexOrchestrator approval response handling
 *
 * Tests verify that ApexOrchestrator correctly processes ApprovalResponse:
 * - Approved responses continue execution
 * - Denied responses halt appropriately
 *
 * This test suite focuses specifically on the ApprovalResponse processing logic
 * in the ApexOrchestrator.respondToApproval method and its downstream effects.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import { ApprovalResponse, ApprovalState, Task, TaskStatus } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

describe('ApexOrchestrator - Approval Response Handling', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let store: TaskStore;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-approval-response-test-'));

    // Create .apex directory structure
    const apexDir = path.join(tempDir, '.apex');
    fs.mkdirSync(apexDir, { recursive: true });
    fs.mkdirSync(path.join(apexDir, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(apexDir, 'workflows'), { recursive: true });

    // Write minimal config
    const configPath = path.join(apexDir, 'config.yaml');
    fs.writeFileSync(configPath, `
name: "test-project"
version: "1.0.0"
autonomy: "supervised"
limits:
  maxTokens: 1000
  maxCost: 10.0
`);

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
      apiUrl: 'http://localhost:3000'
    });

    await orchestrator.initialize();
    store = (orchestrator as any).store;
    mockQuery = vi.mocked(query);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Approved Response Processing', () => {
    it('should continue execution when approval is granted', async () => {
      const approvalId = 'approval-continue-001';
      const taskId = 'task-continue-001';
      const approver = 'test-approver';
      const comment = 'Approved for execution';

      // Create a test task in awaiting-approval status
      const task: Omit<Task, 'createdAt' | 'updatedAt'> = {
        id: taskId,
        description: 'Test task for approval continuation',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      };

      await store.createTask(task);

      // Create approval state
      const approvalState: ApprovalState = {
        id: approvalId,
        taskId,
        gateName: 'test-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'implementation',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {
          operation: 'code-change',
          description: 'Adding new feature'
        }
      };

      await store.saveApprovalState(approvalState);

      // Spy on methods to verify they're called appropriately
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval');

      // Create approved response
      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'approved',
        approver,
        message: comment,
        // Legacy fields for compatibility - all required
        approvalId,
        gateName: 'test-gate',
        action: 'approve',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      // Process the approval response
      await orchestrator.respondToApproval(approvalId, approvalResponse);

      // Verify grantApproval was called with correct parameters
      expect(grantApprovalSpy).toHaveBeenCalledWith(approvalId, approver, comment);

      // Verify approval state was updated to approved
      const updatedApprovalState = await store.getApprovalStateById(approvalId);
      expect(updatedApprovalState).toBeTruthy();
      expect(updatedApprovalState!.status).toBe('approved');
      expect(updatedApprovalState!.approver).toBe(approver);

      // Verify task status was updated to allow continuation
      const updatedTask = await store.getTask(taskId);
      expect(updatedTask).toBeTruthy();
      expect(updatedTask!.status).not.toBe('awaiting-approval');

      // Verify audit log was created for the approval
      const logs = await store.getTaskLogs(taskId);
      const approvalLog = logs.find(log =>
        log.message.includes('Approval granted') &&
        log.metadata?.approvalId === approvalId
      );
      expect(approvalLog).toBeTruthy();
      expect(approvalLog!.level).toBe('info');

      grantApprovalSpy.mockRestore();
    });

    it('should emit approval:granted event when approval is processed', async () => {
      const approvalId = 'approval-event-001';
      const taskId = 'task-event-001';
      const approver = 'event-approver';

      // Create test task and approval state
      await store.createTask({
        id: taskId,
        description: 'Test task for event emission',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      const approvalState: ApprovalState = {
        id: approvalId,
        taskId,
        gateName: 'event-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'testing',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Listen for the approval:granted event
      let emittedEvent: any = null;
      orchestrator.once('approval:granted', (event) => {
        emittedEvent = event;
      });

      // Mock grantApproval to avoid actual processing
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval')
        .mockResolvedValue();

      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'approved',
        approver,
        message: 'Event test approval',
        // Legacy fields
        approvalId,
        gateName: 'event-gate',
        action: 'approve',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      await orchestrator.respondToApproval(approvalId, approvalResponse);

      // Verify the event was emitted with correct data
      expect(emittedEvent).toBeTruthy();
      expect(emittedEvent.approvalId).toBe(approvalId);
      expect(emittedEvent.taskId).toBe(taskId);
      expect(emittedEvent.approver).toBe(approver);
      expect(emittedEvent.gateName).toBe('event-gate');

      grantApprovalSpy.mockRestore();
    });

    it('should resolve pending waitForApproval promise on approval', async () => {
      const approvalId = 'approval-promise-001';
      const taskId = 'task-promise-001';

      // Create test task and approval state
      await store.createTask({
        id: taskId,
        description: 'Test task for promise resolution',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      const approvalState: ApprovalState = {
        id: approvalId,
        taskId,
        gateName: 'promise-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'deployment',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Mock grantApproval to avoid actual processing
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval')
        .mockResolvedValue();

      // Start waiting for approval
      const waitPromise = orchestrator.waitForApproval(approvalId);

      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'approved',
        approver: 'promise-approver',
        message: 'Promise resolution test',
        // Legacy fields
        approvalId,
        gateName: 'promise-gate',
        action: 'approve',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      // Respond to approval in next tick to allow promise to be set up
      setTimeout(async () => {
        await orchestrator.respondToApproval(approvalId, approvalResponse);
      }, 10);

      // Wait for the promise to resolve
      const resolvedResponse = await waitPromise;

      // Verify the promise resolved with the correct response
      expect(resolvedResponse).toEqual(approvalResponse);

      grantApprovalSpy.mockRestore();
    });
  });

  describe('Denied Response Processing', () => {
    it('should halt execution when approval is denied', async () => {
      const approvalId = 'approval-halt-001';
      const taskId = 'task-halt-001';
      const approver = 'denying-approver';
      const reason = 'Security concerns identified';

      // Create a test task in awaiting-approval status
      await store.createTask({
        id: taskId,
        description: 'Test task for approval denial',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      // Create approval state
      const approvalState: ApprovalState = {
        id: approvalId,
        taskId,
        gateName: 'security-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'deployment',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {
          operation: 'deploy-production',
          environment: 'production'
        }
      };

      await store.saveApprovalState(approvalState);

      // Spy on methods to verify they're called appropriately
      const denyApprovalSpy = vi.spyOn(orchestrator, 'denyApproval');

      // Create denied response
      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'denied',
        approver,
        message: reason,
        // Legacy fields
        approvalId,
        gateName: 'security-gate',
        action: 'deny',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      // Process the approval response
      await orchestrator.respondToApproval(approvalId, approvalResponse);

      // Verify denyApproval was called with correct parameters
      expect(denyApprovalSpy).toHaveBeenCalledWith(approvalId, approver, reason);

      // Verify approval state was updated to denied
      const updatedApprovalState = await store.getApprovalStateById(approvalId);
      expect(updatedApprovalState).toBeTruthy();
      expect(updatedApprovalState!.status).toBe('denied');
      expect(updatedApprovalState!.approver).toBe(approver);
      expect(updatedApprovalState!.comment).toBe(reason);

      // Verify task status was updated to failed (which halts execution)
      const updatedTask = await store.getTask(taskId);
      expect(updatedTask).toBeTruthy();
      expect(updatedTask!.status).toBe('failed');

      // Verify audit log was created for the denial
      const logs = await store.getTaskLogs(taskId);
      const denialLog = logs.find(log =>
        log.message.includes('Approval denied') &&
        log.metadata?.approvalId === approvalId
      );
      expect(denialLog).toBeTruthy();
      expect(denialLog!.level).toBe('warn');

      denyApprovalSpy.mockRestore();
    });

    it('should emit approval:denied event when approval is denied', async () => {
      const approvalId = 'approval-deny-event-001';
      const taskId = 'task-deny-event-001';
      const approver = 'deny-event-approver';
      const reason = 'Policy violation detected';

      // Create test task and approval state
      await store.createTask({
        id: taskId,
        description: 'Test task for denial event',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      const approvalState: ApprovalState = {
        id: approvalId,
        taskId,
        gateName: 'policy-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'review',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Listen for the approval:denied event
      let emittedEvent: any = null;
      orchestrator.once('approval:denied', (event) => {
        emittedEvent = event;
      });

      // Mock denyApproval to avoid actual processing
      const denyApprovalSpy = vi.spyOn(orchestrator, 'denyApproval')
        .mockResolvedValue();

      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'denied',
        approver,
        message: reason,
        // Legacy fields
        approvalId,
        gateName: 'policy-gate',
        action: 'deny',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      await orchestrator.respondToApproval(approvalId, approvalResponse);

      // Verify the event was emitted with correct data
      expect(emittedEvent).toBeTruthy();
      expect(emittedEvent.approvalId).toBe(approvalId);
      expect(emittedEvent.taskId).toBe(taskId);
      expect(emittedEvent.approver).toBe(approver);
      expect(emittedEvent.reason).toBe(reason);
      expect(emittedEvent.gateName).toBe('policy-gate');

      denyApprovalSpy.mockRestore();
    });

    it('should resolve pending waitForApproval promise on denial', async () => {
      const approvalId = 'approval-deny-promise-001';
      const taskId = 'task-deny-promise-001';

      // Create test task and approval state
      await store.createTask({
        id: taskId,
        description: 'Test task for denial promise',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      const approvalState: ApprovalState = {
        id: approvalId,
        taskId,
        gateName: 'deny-promise-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'validation',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Mock denyApproval to avoid actual processing
      const denyApprovalSpy = vi.spyOn(orchestrator, 'denyApproval')
        .mockResolvedValue();

      // Start waiting for approval
      const waitPromise = orchestrator.waitForApproval(approvalId);

      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'denied',
        approver: 'deny-promise-approver',
        message: 'Denial promise test',
        // Legacy fields
        approvalId,
        gateName: 'deny-promise-gate',
        action: 'deny',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      // Respond to approval in next tick
      setTimeout(async () => {
        await orchestrator.respondToApproval(approvalId, approvalResponse);
      }, 10);

      // Wait for the promise to resolve
      const resolvedResponse = await waitPromise;

      // Verify the promise resolved with the denial response
      expect(resolvedResponse).toEqual(approvalResponse);

      denyApprovalSpy.mockRestore();
    });

    it('should prevent task continuation after denial', async () => {
      const approvalId = 'approval-prevent-001';
      const taskId = 'task-prevent-001';

      // Create test task
      await store.createTask({
        id: taskId,
        description: 'Test task for prevention',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      const approvalState: ApprovalState = {
        id: approvalId,
        taskId,
        gateName: 'prevention-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'execution',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Mock denyApproval to track state changes
      const denyApprovalSpy = vi.spyOn(orchestrator, 'denyApproval');

      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'denied',
        approver: 'prevention-approver',
        message: 'Task cannot continue',
        // Legacy fields
        approvalId,
        gateName: 'prevention-gate',
        action: 'deny',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      await orchestrator.respondToApproval(approvalId, approvalResponse);

      // Verify the task cannot continue execution
      const finalTask = await store.getTask(taskId);
      expect(finalTask).toBeTruthy();

      // Task should be in a terminal state that prevents continuation
      const terminalStates: TaskStatus[] = ['cancelled', 'failed', 'completed'];
      expect(terminalStates).toContain(finalTask!.status);

      // Specifically, for denial, it should be failed
      expect(finalTask!.status).toBe('failed');

      denyApprovalSpy.mockRestore();
    });
  });

  describe('Info Request Processing', () => {
    it('should handle info-requested response without changing approval state', async () => {
      const approvalId = 'approval-info-001';
      const taskId = 'task-info-001';
      const requester = 'info-requester';
      const message = 'Need more details about the implementation';

      // Create test task and approval state
      await store.createTask({
        id: taskId,
        description: 'Test task for info request',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      const approvalState: ApprovalState = {
        id: approvalId,
        taskId,
        gateName: 'info-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'review',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Listen for the info-requested event
      let emittedEvent: any = null;
      orchestrator.once('approval:info-requested', (event) => {
        emittedEvent = event;
      });

      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'info-requested',
        approver: requester,
        message,
        // Legacy fields
        approvalId,
        gateName: 'info-gate',
        action: 'request-info',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: false
      };

      await orchestrator.respondToApproval(approvalId, approvalResponse);

      // Verify approval state remains pending (not changed)
      const updatedApprovalState = await store.getApprovalStateById(approvalId);
      expect(updatedApprovalState).toBeTruthy();
      expect(updatedApprovalState!.status).toBe('pending');

      // Verify task status remains waiting-approval
      const updatedTask = await store.getTask(taskId);
      expect(updatedTask).toBeTruthy();
      expect(updatedTask!.status).toBe('awaiting-approval');

      // Verify info-requested event was emitted
      expect(emittedEvent).toBeTruthy();
      expect(emittedEvent.approvalId).toBe(approvalId);
      expect(emittedEvent.taskId).toBe(taskId);
      expect(emittedEvent.requester).toBe(requester);
      expect(emittedEvent.message).toBe(message);

      // Verify info request was logged
      const logs = await store.getTaskLogs(taskId);
      const infoLog = logs.find(log =>
        log.message.includes('Information requested') &&
        log.metadata?.approvalId === approvalId
      );
      expect(infoLog).toBeTruthy();
      expect(infoLog!.level).toBe('info');
      expect(infoLog!.metadata?.infoRequest).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing approval state gracefully', async () => {
      const approvalId = 'missing-approval-001';
      const taskId = 'missing-task-001';

      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'approved',
        approver: 'test-approver',
        // Legacy fields
        approvalId,
        gateName: 'missing-gate',
        action: 'approve',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      // Attempting to respond to a non-existent approval should be handled by grantApproval
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval')
        .mockRejectedValue(new Error(`Approval request not found: ${approvalId}`));

      await expect(orchestrator.respondToApproval(approvalId, approvalResponse))
        .rejects.toThrow(`Approval request not found: ${approvalId}`);

      expect(grantApprovalSpy).toHaveBeenCalledWith(approvalId, 'test-approver', undefined);

      grantApprovalSpy.mockRestore();
    });

    it('should handle invalid approval response types', async () => {
      const approvalId = 'invalid-response-001';
      const taskId = 'invalid-task-001';

      const invalidResponse: any = {
        requestId: approvalId,
        taskId,
        response: 'invalid-response-type',
        approver: 'test-approver',
        // Legacy fields
        approvalId,
        gateName: 'invalid-gate',
        action: 'invalid',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      await expect(orchestrator.respondToApproval(approvalId, invalidResponse))
        .rejects.toThrow('Invalid approval response: invalid-response-type');
    });

    it('should handle errors in grantApproval gracefully', async () => {
      const approvalId = 'grant-error-001';
      const taskId = 'grant-error-task-001';

      // Create test task and approval state
      await store.createTask({
        id: taskId,
        description: 'Test task for grant error',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      const approvalState: ApprovalState = {
        id: approvalId,
        taskId,
        gateName: 'error-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'testing',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Mock grantApproval to throw an error
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval')
        .mockRejectedValue(new Error('Grant approval process failed'));

      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'approved',
        approver: 'error-approver',
        // Legacy fields
        approvalId,
        gateName: 'error-gate',
        action: 'approve',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      // The error from grantApproval should propagate
      await expect(orchestrator.respondToApproval(approvalId, approvalResponse))
        .rejects.toThrow('Grant approval process failed');

      grantApprovalSpy.mockRestore();
    });

    it('should handle errors in denyApproval gracefully', async () => {
      const approvalId = 'deny-error-001';
      const taskId = 'deny-error-task-001';

      // Create test task and approval state
      await store.createTask({
        id: taskId,
        description: 'Test task for deny error',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      const approvalState: ApprovalState = {
        id: approvalId,
        taskId,
        gateName: 'deny-error-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'testing',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Mock denyApproval to throw an error
      const denyApprovalSpy = vi.spyOn(orchestrator, 'denyApproval')
        .mockRejectedValue(new Error('Deny approval process failed'));

      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'denied',
        approver: 'deny-error-approver',
        message: 'Error test denial',
        // Legacy fields
        approvalId,
        gateName: 'deny-error-gate',
        action: 'deny',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      // The error from denyApproval should propagate
      await expect(orchestrator.respondToApproval(approvalId, approvalResponse))
        .rejects.toThrow('Deny approval process failed');

      denyApprovalSpy.mockRestore();
    });

    it('should reject pending promises when approval processing fails', async () => {
      const approvalId = 'promise-error-001';
      const taskId = 'promise-error-task-001';

      // Start waiting for approval
      const waitPromise = orchestrator.waitForApproval(approvalId);

      // Mock grantApproval to throw an error
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval')
        .mockRejectedValue(new Error('Promise rejection test'));

      const approvalResponse: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'approved',
        approver: 'promise-error-approver',
        // Legacy fields
        approvalId,
        gateName: 'promise-error-gate',
        action: 'approve',
        timestamp: new Date(),
        requestedAt: new Date(),
        resolved: true
      };

      // Respond to approval in next tick
      setTimeout(async () => {
        try {
          await orchestrator.respondToApproval(approvalId, approvalResponse);
        } catch (error) {
          // Expected to fail
        }
      }, 10);

      // The waiting promise should reject with the error
      await expect(waitPromise).rejects.toThrow('Promise rejection test');

      grantApprovalSpy.mockRestore();
    });
  });
});