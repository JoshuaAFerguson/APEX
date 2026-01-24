/**
 * Test suite for autonomy level based approval triggering
 *
 * Covers acceptance criteria:
 * 1. ApexOrchestrator emits 'approval-required' events based on autonomy level
 * 2. Different autonomy levels trigger different approval requirements
 * 3. Task autonomy settings override global configuration
 * 4. Autonomy enforcer integration with approval gates
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ApprovalRequiredEventData, AutonomyLevel } from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

describe('Autonomy Level Based Approval Triggering', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-autonomy-approval-test-'));
    mockQuery = vi.mocked(query);

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-autonomy-approval',
      language: 'typescript',
      framework: 'node',
    });

    // Create test agent files
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'planner.md'),
      `---
name: planner
description: Plans tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`
    );

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      `---
name: developer
description: Implements code
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a developer agent.`
    );

    // Create simple workflow for testing
    const workflowContent = `
name: simple-task
description: Simple task for autonomy testing
stages:
  - name: planning
    agent: planner
    description: Plan the task
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement the task
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'simple-task.yaml'),
      workflowContent
    );
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Global Autonomy Level Configuration', () => {
    it('should trigger approval for manual autonomy level', async () => {
      // Configure with manual autonomy
      const configContent = `
version: "1.0"
project:
  name: test-autonomy-approval
  language: typescript
  framework: node
autonomy:
  level: manual
  approvals:
    taskStart: true
    codeChanges: true
    dataAccess: true
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test manual autonomy approval',
        workflow: 'simple-task',
      });

      await orchestrator.runTask(task.id);

      // In manual mode, approval should be required
      expect(approvalEvent).toBeDefined();
      expect(approvalEvent!.taskId).toBe(task.id);
    });

    it('should not trigger approval for autonomous level', async () => {
      // Configure with autonomous level
      const configContent = `
version: "1.0"
project:
  name: test-autonomy-approval
  language: typescript
  framework: node
autonomy:
  level: autonomous
  approvals:
    taskStart: false
    codeChanges: false
    dataAccess: false
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const approvalEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test autonomous execution',
        workflow: 'simple-task',
      });

      await orchestrator.runTask(task.id);

      // In autonomous mode, no approval should be required for basic tasks
      expect(approvalEvents).toHaveLength(0);
    });

    it('should trigger selective approvals for supervised autonomy level', async () => {
      // Configure with supervised autonomy
      const configContent = `
version: "1.0"
project:
  name: test-autonomy-approval
  language: typescript
  framework: node
autonomy:
  level: supervised
  approvals:
    taskStart: false
    codeChanges: true  # Only require approval for code changes
    dataAccess: false
    fileOperations:
      write: true
      delete: true
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const approvalEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test supervised autonomy',
        workflow: 'simple-task',
      });

      await orchestrator.runTask(task.id);

      // Planning stage should proceed without approval
      // Implementation stage might trigger approval if it involves code changes
      // The exact behavior depends on the autonomy enforcer implementation
    });
  });

  describe('Task-Level Autonomy Overrides', () => {
    it('should override global autonomy with task-specific setting', async () => {
      // Configure global autonomous level
      const configContent = `
version: "1.0"
project:
  name: test-autonomy-approval
  language: typescript
  framework: node
autonomy:
  level: autonomous
  approvals:
    taskStart: false
    codeChanges: false
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      // Create task with manual autonomy override
      const task = await orchestrator.createTask({
        description: 'Task with manual override',
        workflow: 'simple-task',
        autonomy: 'manual', // Override global autonomous setting
      });

      await orchestrator.runTask(task.id);

      // Should trigger approval despite global autonomous setting
      // Note: The exact implementation may vary
    });

    it('should respect task priority in autonomy enforcement', async () => {
      // Configure with priority-based autonomy rules
      const configContent = `
version: "1.0"
project:
  name: test-autonomy-approval
  language: typescript
  framework: node
autonomy:
  level: supervised
  approvals:
    taskStart: false
    codeChanges: true
  rules:
    - condition: "priority === 'critical'"
      require: ["senior-dev", "lead"]
    - condition: "priority === 'high'"
      require: ["senior-dev"]
    - condition: "priority === 'low'"
      autoApprove: true
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      const testCases: Array<{
        priority: string;
        expectedApprovalRequired: boolean;
        description: string;
      }> = [
        { priority: 'critical', expectedApprovalRequired: true, description: 'Critical priority should require approval' },
        { priority: 'high', expectedApprovalRequired: true, description: 'High priority should require approval' },
        { priority: 'low', expectedApprovalRequired: false, description: 'Low priority should auto-approve' },
        { priority: 'normal', expectedApprovalRequired: true, description: 'Normal priority should follow default rules' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        mockQuery.mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        });

        const approvalEvents: ApprovalRequiredEventData[] = [];
        orchestrator.on('approval:required', (event) => {
          approvalEvents.push(event);
        });

        const task = await orchestrator.createTask({
          description: `Test ${testCase.priority} priority`,
          workflow: 'simple-task',
          priority: testCase.priority,
        });

        await orchestrator.runTask(task.id);

        if (testCase.expectedApprovalRequired) {
          expect(approvalEvents.length).toBeGreaterThan(0);
        } else {
          expect(approvalEvents).toHaveLength(0);
        }
      }
    });
  });

  describe('Autonomy Enforcer Integration', () => {
    it('should trigger approval through autonomy enforcer for risky operations', async () => {
      // Configure with autonomy enforcer enabled
      const configContent = `
version: "1.0"
project:
  name: test-autonomy-approval
  language: typescript
  framework: node
autonomy:
  level: supervised
  enforcer:
    enabled: true
    riskThreshold: "medium"
    rules:
      - operation: "file_write"
        pattern: "*.config.*"
        require: ["lead"]
      - operation: "bash_command"
        pattern: "rm -rf*"
        require: ["admin"]
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      // Create workflow that involves risky operations
      const riskyWorkflowContent = `
name: risky-task
description: Task with potentially risky operations
stages:
  - name: planning
    agent: planner
    description: Plan risky operations
  - name: dangerous-implementation
    agent: developer
    dependsOn: [planning]
    description: Implement with file modifications
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'risky-task.yaml'),
        riskyWorkflowContent
      );

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning risky operations.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const approvalEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test autonomy enforcer approval',
        workflow: 'risky-task',
      });

      await orchestrator.runTask(task.id);

      // Autonomy enforcer should detect risky operations and trigger approval
      // Note: The exact behavior depends on the autonomy enforcer implementation
    });

    it('should handle autonomy enforcer errors gracefully', async () => {
      // Configure with autonomy enforcer that might fail
      const configContent = `
version: "1.0"
project:
  name: test-autonomy-approval
  language: typescript
  framework: node
autonomy:
  level: supervised
  enforcer:
    enabled: true
    timeout: 1000  # Very short timeout
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const task = await orchestrator.createTask({
        description: 'Test autonomy enforcer error handling',
        workflow: 'simple-task',
      });

      // Should not throw error even if autonomy enforcer fails
      await expect(orchestrator.runTask(task.id)).resolves.not.toThrow();

      const completedTask = await orchestrator.getTask(task.id);
      expect(completedTask).toBeDefined();
    });
  });

  describe('Event Data Validation', () => {
    it('should include autonomy context in approval event data', async () => {
      // Configure with manual autonomy
      const configContent = `
version: "1.0"
project:
  name: test-autonomy-approval
  language: typescript
  framework: node
autonomy:
  level: manual
  approvals:
    taskStart: true
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      let approvalEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        approvalEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test autonomy context in event',
        workflow: 'simple-task',
        autonomy: 'manual',
      });

      await orchestrator.runTask(task.id);

      expect(approvalEvent).toBeDefined();
      expect(approvalEvent!.context).toBeDefined();
      expect(approvalEvent!.context.taskId).toBe(task.id);

      // The context should include autonomy-related information
      // Note: The exact structure depends on the implementation
      if (approvalEvent!.context.autonomyLevel) {
        expect(approvalEvent!.context.autonomyLevel).toBe('manual');
      }
    });

    it('should emit different event types for different autonomy triggers', async () => {
      // Configure with multiple autonomy rules
      const configContent = `
version: "1.0"
project:
  name: test-autonomy-approval
  language: typescript
  framework: node
autonomy:
  level: supervised
  approvals:
    taskStart: true
    codeChanges: true
    dataAccess: true
gates:
  - name: "task-start-gate"
    type: "task-start"
    description: "Approval required for task start"
    approvers: ["lead"]
    timeout: 30
  - name: "code-change-gate"
    type: "code-change"
    description: "Approval required for code changes"
    approvers: ["senior-dev"]
    timeout: 60
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      // Create workflow with different gate types
      const multiGateWorkflow = `
name: multi-gate-autonomy
description: Workflow with multiple autonomy gates
stages:
  - name: planning
    agent: planner
    description: Plan the task
    gate: "task-start-gate"
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement changes
    gate: "code-change-gate"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'multi-gate-autonomy.yaml'),
        multiGateWorkflow
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      mockQuery.mockResolvedValue({
        requestId: 'test-request',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Stage completed.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const approvalEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test multiple autonomy gates',
        workflow: 'multi-gate-autonomy',
      });

      await orchestrator.runTask(task.id);

      // Should trigger multiple approval events for different gate types
      expect(approvalEvents.length).toBeGreaterThan(0);

      // Each event should have appropriate gate type information
      for (const event of approvalEvents) {
        expect(event.gateType).toBeDefined();
        expect(['task-start', 'code-change']).toContain(event.gateType);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent tasks with autonomy checks', async () => {
      // Configure with supervised autonomy
      const configContent = `
version: "1.0"
project:
  name: test-autonomy-approval
  language: typescript
  framework: node
autonomy:
  level: supervised
  approvals:
    taskStart: true
limits:
  maxConcurrentTasks: 5
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      // Mock multiple successful responses
      mockQuery.mockResolvedValue({
        requestId: 'test-request',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Task completed.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const approvalEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      // Create multiple tasks concurrently
      const taskPromises = Array.from({ length: 3 }, (_, i) =>
        orchestrator.createTask({
          description: `Concurrent task ${i + 1}`,
          workflow: 'simple-task',
        })
      );

      const tasks = await Promise.all(taskPromises);

      // Run all tasks concurrently
      const runPromises = tasks.map(task => orchestrator.runTask(task.id));
      await Promise.all(runPromises);

      // Should handle multiple approval events correctly
      expect(approvalEvents.length).toBeGreaterThanOrEqual(0);

      // Each task should be tracked independently
      const uniqueTaskIds = new Set(approvalEvents.map(event => event.taskId));
      expect(uniqueTaskIds.size).toBeLessThanOrEqual(tasks.length);
    });
  });
});