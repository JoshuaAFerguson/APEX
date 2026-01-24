/**
 * Integration tests for the happy path approval flow in APEX
 *
 * Tests verify: CLI command creates task via orchestrator, task transitions through
 * pending->running->awaiting_approval->approved->completed states, events are emitted
 * correctly at each stage, final task state is stored correctly in SQLite.
 *
 * @see ADR-036: Integration Tests for Happy Path Approval Flow
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import {
  initializeApex,
  type Task,
  type TaskStatus,
  type ApprovalRequiredEventData,
  type ApprovalGrantedEventData
} from '@apexcli/core';

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

const { query } = await import('@anthropic-ai/claude-agent-sdk');

interface StateTransition {
  from: TaskStatus | null;
  to: TaskStatus;
  timestamp: Date;
  event?: string;
}

interface EmittedEvent {
  event: string;
  timestamp: Date;
  data: unknown;
}

describe('Happy Path Approval Flow Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;
  let stateTransitions: StateTransition[] = [];
  let emittedEvents: EmittedEvent[] = [];

  beforeEach(async () => {
    // Clear arrays for each test
    stateTransitions = [];
    emittedEvents = [];

    // Create isolated temp directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-happy-path-'));

    // Mock Claude Agent SDK
    mockQuery = vi.mocked(query);

    // Initialize APEX project
    await initializeApex(testDir, {
      projectName: 'test-happy-path',
      language: 'typescript',
      framework: 'node',
    });

    // Create config with approval gates
    const configContent = `
project:
  name: test-happy-path
  language: typescript
  framework: node

gates:
  - name: "code-review"
    type: "before-stage"
    description: "Code review required before completion"
    timeout: 60
    minApprovals: 1
    required: true
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Create workflow with approval gate
    const workflowsDir = path.join(testDir, '.apex', 'workflows');
    await fs.writeFile(
      path.join(workflowsDir, 'happy-path-workflow.yaml'),
      `name: happy-path-workflow
description: Simple workflow with single approval gate
stages:
  - name: planning
    agent: planner
    description: Plan the task
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement the task
    gate: "code-review"
  - name: completion
    agent: reviewer
    dependsOn: [implementation]
    description: Complete the task
`
    );

    // Create required agents
    const agentsDir = path.join(testDir, '.apex', 'agents');

    await fs.writeFile(
      path.join(agentsDir, 'planner.md'),
      `---
name: planner
description: Plans tasks and creates implementation strategies
---
You are a planner agent. Create detailed implementation plans.`
    );

    await fs.writeFile(
      path.join(agentsDir, 'developer.md'),
      `---
name: developer
description: Implements features and writes code
---
You are a developer agent. Write production-quality code.`
    );

    await fs.writeFile(
      path.join(agentsDir, 'reviewer.md'),
      `---
name: reviewer
description: Reviews code and ensures quality
---
You are a reviewer agent. Perform thorough code reviews.`
    );

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    // Set up event tracking
    setupEventTracking();

    // Configure Claude SDK mocks for successful stage completions
    setupClaudeMocks();
  });

  afterEach(async () => {
    if (orchestrator) {
      // Clean up event listeners
      orchestrator.removeAllListeners();
    }

    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  function setupEventTracking() {
    const events = [
      'task:created', 'task:started', 'task:stage-changed',
      'approval:required', 'approval:approved', 'task:completed'
    ] as const;

    events.forEach(eventName => {
      orchestrator.on(eventName, (data) => {
        emittedEvents.push({
          event: eventName,
          timestamp: new Date(),
          data
        });

        // Track state transitions if this is a task status change
        if (eventName === 'task:created' || eventName === 'task:stage-changed' || eventName === 'task:completed') {
          const taskData = data as any;
          if (taskData && typeof taskData === 'object' && 'status' in taskData) {
            stateTransitions.push({
              from: stateTransitions.length > 0 ? stateTransitions[stateTransitions.length - 1].to : null,
              to: taskData.status as TaskStatus,
              timestamp: new Date(),
              event: eventName
            });
          }
        }
      });
    });

    // Track approval state changes
    orchestrator.on('approval:required', (data) => {
      const transitionData = data as any;
      if (transitionData.taskId) {
        stateTransitions.push({
          from: 'in-progress',
          to: 'awaiting-approval',
          timestamp: new Date(),
          event: 'approval:required'
        });
      }
    });

    orchestrator.on('approval:approved', (data) => {
      stateTransitions.push({
        from: 'awaiting-approval',
        to: 'in-progress',
        timestamp: new Date(),
        event: 'approval:approved'
      });
    });
  }

  function setupClaudeMocks() {
    // Mock successful stage completions
    mockQuery
      .mockResolvedValueOnce({
        requestId: 'planning-request-1',
        output: {
          success: true,
          messages: [{
            role: 'assistant',
            content: [{ type: 'text', text: 'Planning completed successfully. Ready to proceed with implementation.' }]
          }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      })
      .mockResolvedValueOnce({
        requestId: 'implementation-request-1',
        output: {
          success: true,
          messages: [{
            role: 'assistant',
            content: [{ type: 'text', text: 'Implementation completed. Code is ready for review.' }]
          }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      })
      .mockResolvedValueOnce({
        requestId: 'completion-request-1',
        output: {
          success: true,
          messages: [{
            role: 'assistant',
            content: [{ type: 'text', text: 'Task completed successfully after review approval.' }]
          }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });
  }

  describe('Complete Happy Path Flow', () => {
    it('should transition task through complete approval flow and persist state', async () => {
      // 1. Create task (simulating CLI command)
      const task = await orchestrator.createTask({
        description: 'Implement user authentication feature',
        workflow: 'happy-path-workflow',
        autonomy: 'supervised'
      });

      expect(task).toBeDefined();
      expect(task.status).toBe('pending');

      // Verify task creation event was emitted
      const createEvent = emittedEvents.find(e => e.event === 'task:created');
      expect(createEvent).toBeDefined();

      // 2. Execute task until approval gate
      let approvalId: string | undefined;
      let approvalRequired = false;

      // Set up approval detection
      const approvalPromise = new Promise<string>((resolve) => {
        orchestrator.once('approval:required', (data: any) => {
          approvalRequired = true;
          approvalId = data.approvalId;
          resolve(data.approvalId);
        });
      });

      // Start task execution
      const executionPromise = orchestrator.executeTask(task.id);

      // Wait for approval to be required
      approvalId = await approvalPromise;
      expect(approvalRequired).toBe(true);
      expect(approvalId).toBeDefined();

      // 3. Verify awaiting-approval state
      const taskAtApproval = await orchestrator.getTask(task.id);
      expect(taskAtApproval).toBeDefined();
      expect(taskAtApproval!.status).toBe('awaiting-approval');

      // Verify approval event was emitted
      const approvalEvent = emittedEvents.find(e => e.event === 'approval:required');
      expect(approvalEvent).toBeDefined();
      expect((approvalEvent!.data as any).taskId).toBe(task.id);

      // 4. Grant approval
      await orchestrator.grantApproval(approvalId!, 'test-user', 'Code looks good to proceed');

      // Wait for task execution to complete
      await executionPromise;

      // 5. Verify task completes
      const finalTask = await orchestrator.getTask(task.id);
      expect(finalTask).toBeDefined();
      expect(finalTask!.status).toBe('completed');
      expect(finalTask!.completedAt).toBeInstanceOf(Date);

      // 6. Verify all events emitted in correct order
      const expectedEvents = [
        'task:created',
        'task:started',
        'approval:required',
        'approval:approved',
        'task:completed'
      ];

      expectedEvents.forEach((expectedEvent, index) => {
        const event = emittedEvents.find(e => e.event === expectedEvent);
        expect(event, `Expected event ${expectedEvent} to be emitted`).toBeDefined();
      });

      // Verify events are in chronological order
      for (let i = 1; i < emittedEvents.length; i++) {
        expect(emittedEvents[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          emittedEvents[i - 1].timestamp.getTime()
        );
      }

      // 7. Verify state transitions
      expect(stateTransitions.length).toBeGreaterThanOrEqual(4);

      // Should have: pending -> in-progress -> awaiting-approval -> in-progress -> completed
      const statusProgression = stateTransitions.map(t => t.to);
      expect(statusProgression).toContain('pending');
      expect(statusProgression).toContain('in-progress');
      expect(statusProgression).toContain('awaiting-approval');
      expect(statusProgression).toContain('completed');

      // 8. Verify SQLite persistence
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState).toBeDefined();
      expect(approvalState!.status).toBe('approved');
      expect(approvalState!.approver).toBe('test-user');
      expect(approvalState!.comment).toBe('Code looks good to proceed');

      // Verify task usage was tracked
      expect(finalTask!.usage.totalTokens).toBeGreaterThan(0);
      expect(finalTask!.usage.estimatedCost).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for integration test
  });

  describe('Event Ordering Verification', () => {
    it('should emit events in chronological order with required fields', async () => {
      const task = await orchestrator.createTask({
        description: 'Test event ordering',
        workflow: 'happy-path-workflow',
        autonomy: 'supervised'
      });

      // Execute until approval
      const approvalPromise = new Promise<void>((resolve) => {
        orchestrator.once('approval:required', () => resolve());
      });

      orchestrator.executeTask(task.id);
      await approvalPromise;

      // Verify each event has required fields
      emittedEvents.forEach(event => {
        expect(event.event).toBeTruthy();
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.data).toBeDefined();
      });

      // Verify events are in chronological order
      for (let i = 1; i < emittedEvents.length; i++) {
        expect(emittedEvents[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          emittedEvents[i - 1].timestamp.getTime()
        );
      }

      // Verify critical events have proper data structure
      const createdEvent = emittedEvents.find(e => e.event === 'task:created');
      expect(createdEvent).toBeDefined();
      expect((createdEvent!.data as any).id).toBe(task.id);

      const approvalEvent = emittedEvents.find(e => e.event === 'approval:required');
      expect(approvalEvent).toBeDefined();
      expect((approvalEvent!.data as any).taskId).toBe(task.id);
      expect((approvalEvent!.data as any).gateName).toBe('code-review');
    });
  });

  describe('State Persistence Across Restart', () => {
    it('should recover approval state from SQLite after orchestrator restart', async () => {
      // Create task and hit approval gate
      const task = await orchestrator.createTask({
        description: 'Test persistence across restart',
        workflow: 'happy-path-workflow',
        autonomy: 'supervised'
      });

      const approvalPromise = new Promise<string>((resolve) => {
        orchestrator.once('approval:required', (data: any) => {
          resolve(data.approvalId);
        });
      });

      orchestrator.executeTask(task.id);
      const approvalId = await approvalPromise;

      // Verify task is in awaiting-approval state
      const taskBeforeRestart = await orchestrator.getTask(task.id);
      expect(taskBeforeRestart!.status).toBe('awaiting-approval');

      // Close and recreate orchestrator (simulating restart)
      orchestrator.removeAllListeners();

      const newOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await newOrchestrator.initialize();

      // Verify state is recovered from SQLite
      const taskAfterRestart = await newOrchestrator.getTask(task.id);
      expect(taskAfterRestart).toBeDefined();
      expect(taskAfterRestart!.status).toBe('awaiting-approval');
      expect(taskAfterRestart!.id).toBe(task.id);
      expect(taskAfterRestart!.description).toBe(task.description);

      // Verify approval state is recovered
      const approvalState = await newOrchestrator.getApprovalStateById(approvalId);
      expect(approvalState).toBeDefined();
      expect(approvalState!.status).toBe('pending');
      expect(approvalState!.taskId).toBe(task.id);
      expect(approvalState!.gateName).toBe('code-review');

      // Verify we can still grant approval and complete the task
      await newOrchestrator.grantApproval(approvalId, 'test-user', 'Approved after restart');

      const finalTask = await newOrchestrator.getTask(task.id);
      expect(finalTask!.status).toBe('completed');
    });
  });

  describe('CLI Integration Simulation', () => {
    it('should handle task creation as if initiated from CLI command', async () => {
      // Simulate CLI createTask call with various parameters
      const cliTaskParams = {
        description: 'CLI-initiated task: Add user profile management',
        workflow: 'happy-path-workflow',
        autonomy: 'supervised' as const,
        priority: 'high' as const,
        acceptanceCriteria: 'User can view and edit profile information',
        tags: ['feature', 'user-management']
      };

      const task = await orchestrator.createTask(cliTaskParams);

      // Verify orchestrator receives correct parameters
      expect(task.description).toBe(cliTaskParams.description);
      expect(task.workflow).toBe(cliTaskParams.workflow);
      expect(task.autonomy).toBe(cliTaskParams.autonomy);
      expect(task.priority).toBe(cliTaskParams.priority);
      expect(task.acceptanceCriteria).toBe(cliTaskParams.acceptanceCriteria);
      expect(task.tags).toEqual(cliTaskParams.tags);

      // Verify task was stored in database
      const storedTask = await orchestrator.getTask(task.id);
      expect(storedTask).toBeDefined();
      expect(storedTask!.description).toBe(cliTaskParams.description);

      // Verify task can proceed through workflow
      const approvalPromise = new Promise<void>((resolve) => {
        orchestrator.once('approval:required', () => resolve());
      });

      orchestrator.executeTask(task.id);
      await approvalPromise;

      const taskAtApproval = await orchestrator.getTask(task.id);
      expect(taskAtApproval!.status).toBe('awaiting-approval');
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle approval denial and task failure correctly', async () => {
      const task = await orchestrator.createTask({
        description: 'Test approval denial flow',
        workflow: 'happy-path-workflow',
        autonomy: 'supervised'
      });

      const approvalPromise = new Promise<string>((resolve) => {
        orchestrator.once('approval:required', (data: any) => {
          resolve(data.approvalId);
        });
      });

      orchestrator.executeTask(task.id);
      const approvalId = await approvalPromise;

      // Deny approval
      await orchestrator.denyApproval(approvalId, 'test-user', 'Code quality issues found');

      // Verify task failed
      const finalTask = await orchestrator.getTask(task.id);
      expect(finalTask!.status).toBe('failed');

      // Verify approval state
      const approvalState = await orchestrator.getApprovalStateById(approvalId);
      expect(approvalState!.status).toBe('denied');
      expect(approvalState!.comment).toBe('Code quality issues found');
    });
  });
});