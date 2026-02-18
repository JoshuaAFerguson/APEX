import { ApexOrchestrator } from '../index';
import { TaskStore, ToolActionStore } from '../store';
import { ApprovalResponse, ApprovalState } from '@apexcli/core';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'eventemitter3';

/**
 * Test suite for respondToApproval method and approval promise management
 */
describe('ApexOrchestrator - respondToApproval', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = path.join(__dirname, 'temp-test-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

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

  describe('respondToApproval method', () => {
    it('should throw error for empty request ID', async () => {
      const response: ApprovalResponse = {
        requestId: 'test-approval',
        taskId: 'test-task',
        response: 'approved',
        approver: 'test-user'
      };

      await expect(orchestrator.respondToApproval('', response))
        .rejects.toThrow('Request ID is required');
    });

    it('should throw error for missing approval decision', async () => {
      const response = {
        requestId: 'test-approval',
        taskId: 'test-task',
        approver: 'test-user'
      } as ApprovalResponse;

      await expect(orchestrator.respondToApproval('test-approval', response))
        .rejects.toThrow('Approval decision is required');
    });

    it('should handle approved response by delegating to grantApproval', async () => {
      const approvalId = 'test-approval-001';
      const taskId = 'test-task-001';
      const approver = 'test-user';
      const comment = 'Looks good to me';

      // Create a test task and approval state
      const task = await store.createTask({
        id: taskId,
        description: 'Test task',
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
        gateName: 'test-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'test-stage',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Spy on grantApproval method
      const grantApprovalSpy = jest.spyOn(orchestrator, 'grantApproval').mockResolvedValue();

      const response: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'approved',
        approver,
        message: comment
      };

      await orchestrator.respondToApproval(approvalId, response);

      expect(grantApprovalSpy).toHaveBeenCalledWith(approvalId, approver, comment);

      grantApprovalSpy.mockRestore();
    });

    it('should handle denied response by delegating to denyApproval', async () => {
      const approvalId = 'test-approval-002';
      const taskId = 'test-task-002';
      const approver = 'test-user';
      const reason = 'Security concerns';

      // Create a test task and approval state
      const task = await store.createTask({
        id: taskId,
        description: 'Test task',
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
        gateName: 'test-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'test-stage',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Spy on denyApproval method
      const denyApprovalSpy = jest.spyOn(orchestrator, 'denyApproval').mockResolvedValue();

      const response: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'denied',
        approver,
        message: reason
      };

      await orchestrator.respondToApproval(approvalId, response);

      expect(denyApprovalSpy).toHaveBeenCalledWith(approvalId, approver, reason);

      denyApprovalSpy.mockRestore();
    });

    it('should handle info-requested response by emitting event and logging', async () => {
      const approvalId = 'test-approval-003';
      const taskId = 'test-task-003';
      const requester = 'test-user';
      const message = 'Need more details about the changes';

      // Create a test task
      await store.createTask({
        id: taskId,
        description: 'Test task',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      // Listen for the info-requested event
      let emittedEvent: any = null;
      orchestrator.once('approval:info-requested', (event) => {
        emittedEvent = event;
      });

      const response: ApprovalResponse = {
        requestId: approvalId,
        taskId,
        response: 'info-requested',
        approver: requester,
        message
      };

      await orchestrator.respondToApproval(approvalId, response);

      // Check that the event was emitted
      expect(emittedEvent).not.toBeNull();
      expect(emittedEvent.approvalId).toBe(approvalId);
      expect(emittedEvent.taskId).toBe(taskId);
      expect(emittedEvent.requester).toBe(requester);
      expect(emittedEvent.message).toBe(message);
      expect(emittedEvent.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error for invalid approval response', async () => {
      const response: any = {
        requestId: 'test-approval',
        taskId: 'test-task',
        response: 'invalid-response',
        approver: 'test-user'
      };

      await expect(orchestrator.respondToApproval('test-approval', response))
        .rejects.toThrow('Invalid approval response: invalid-response');
    });
  });

  describe('waitForApproval method', () => {
    it('should throw error for empty request ID', () => {
      expect(() => orchestrator.waitForApproval(''))
        .toThrow('Request ID is required');
    });

    it('should throw error if already waiting for approval', () => {
      const requestId = 'test-approval-004';

      // Start waiting
      const promise1 = orchestrator.waitForApproval(requestId);

      // Try to wait again
      expect(() => orchestrator.waitForApproval(requestId))
        .toThrow(`Already waiting for approval response to request: ${requestId}`);

      // Clean up
      orchestrator.respondToApproval(requestId, {
        requestId,
        taskId: 'test-task',
        response: 'approved',
        approver: 'test-user'
      }).catch(() => {}); // Ignore errors in cleanup
    });

    it('should resolve promise when approval response is provided', async () => {
      const requestId = 'test-approval-005';
      const taskId = 'test-task-005';

      // Create test task and approval state
      await store.createTask({
        id: taskId,
        description: 'Test task',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      const approvalState: ApprovalState = {
        id: requestId,
        taskId,
        gateName: 'test-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'test-stage',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Mock the delegate methods to avoid actual processing
      const grantApprovalSpy = jest.spyOn(orchestrator, 'grantApproval').mockResolvedValue();

      // Start waiting for approval
      const waitPromise = orchestrator.waitForApproval(requestId);

      const response: ApprovalResponse = {
        requestId,
        taskId,
        response: 'approved',
        approver: 'test-user',
        message: 'Approved'
      };

      // Respond to the approval in parallel
      setTimeout(async () => {
        await orchestrator.respondToApproval(requestId, response);
      }, 10);

      // Wait for the promise to resolve
      const resolvedResponse = await waitPromise;

      expect(resolvedResponse).toEqual(response);
      expect(grantApprovalSpy).toHaveBeenCalled();

      grantApprovalSpy.mockRestore();
    });

    it('should timeout if no response is provided within timeout', async () => {
      const requestId = 'test-approval-006';
      const timeoutMs = 100; // Very short timeout for test

      const waitPromise = orchestrator.waitForApproval(requestId, timeoutMs);

      await expect(waitPromise).rejects.toThrow(
        `Approval request ${requestId} timed out after ${timeoutMs}ms`
      );
    });
  });

  describe('promise integration', () => {
    it('should resolve pending promise when respondToApproval is called', async () => {
      const requestId = 'test-approval-007';
      const taskId = 'test-task-007';

      // Create test task and approval state
      await store.createTask({
        id: taskId,
        description: 'Test task',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      const approvalState: ApprovalState = {
        id: requestId,
        taskId,
        gateName: 'test-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'test-stage',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Mock the delegate methods
      const grantApprovalSpy = jest.spyOn(orchestrator, 'grantApproval').mockResolvedValue();

      // Start waiting and responding
      const waitPromise = orchestrator.waitForApproval(requestId);

      const response: ApprovalResponse = {
        requestId,
        taskId,
        response: 'approved',
        approver: 'integration-test-user',
        message: 'Integration test approval'
      };

      // Respond after a short delay
      setTimeout(async () => {
        await orchestrator.respondToApproval(requestId, response);
      }, 50);

      const resolvedResponse = await waitPromise;
      expect(resolvedResponse).toEqual(response);

      grantApprovalSpy.mockRestore();
    });

    it('should reject pending promise if respondToApproval throws error', async () => {
      const requestId = 'test-approval-008';

      // Mock the delegate method to throw an error
      const grantApprovalSpy = jest.spyOn(orchestrator, 'grantApproval')
        .mockRejectedValue(new Error('Grant approval failed'));

      const waitPromise = orchestrator.waitForApproval(requestId);

      const response: ApprovalResponse = {
        requestId,
        taskId: 'test-task',
        response: 'approved',
        approver: 'test-user'
      };

      setTimeout(async () => {
        try {
          await orchestrator.respondToApproval(requestId, response);
        } catch (error) {
          // Expected to fail
        }
      }, 50);

      await expect(waitPromise).rejects.toThrow('Grant approval failed');

      grantApprovalSpy.mockRestore();
    });
  });
});