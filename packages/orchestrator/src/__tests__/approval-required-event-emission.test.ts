/**
 * Test suite for approval:required event emission functionality
 *
 * Covers acceptance criteria:
 * 1. 'approval:required' event defined in OrchestratorEvents
 * 2. Event emitted when gate is hit with ApprovalRequiredEventData
 * 3. Event includes task context, gate info, approval ID/URL
 * 4. Approval URL generated using apiUrl config
 * 5. Unit tests verify event emission and payload
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  ApprovalRequiredEventData,
  ApprovalGate,
  ApprovalCheckpointType,
  WorkflowDefinition
} from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

describe('Approval Required Event Emission', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-test-'));
    mockQuery = vi.mocked(query);

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-approval-project',
      language: 'typescript',
      framework: 'node',
    });

    // Create config with api.url setting for approval URL generation
    const configContent = `
version: "1.0"
project:
  name: test-approval-project
  language: typescript
  framework: node
api:
  url: "https://api.example.com"
  port: 3000
  autoStart: false
gates:
  - name: "code-review-gate"
    type: "before-commit"
    description: "Code review required before commit"
    approvers: ["senior-dev", "tech-lead"]
    timeout: 30
    minApprovals: 1
  - name: "security-gate"
    type: "before-deploy"
    description: "Security review for production deployment"
    approvers: ["security-team"]
    timeout: 60
    minApprovals: 1
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Create a workflow with approval gates
    const workflowContent = `
name: feature-with-gates
description: Feature development with approval gates
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
  - name: implementation
    agent: developer
    dependsOn:
      - planning
    description: Implement the feature
    gate: "code-review-gate"
  - name: deployment
    agent: devops
    dependsOn:
      - implementation
    description: Deploy to production
    gate: "security-gate"
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature-with-gates.yaml'),
      workflowContent
    );

    // Create test agent files
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'planner.md'),
      `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`
    );

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      `---
name: developer
description: Implements code changes
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a developer agent.`
    );

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'devops.md'),
      `---
name: devops
description: Handles deployment
tools: Bash
model: sonnet
---
You are a devops agent.`
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('OrchestratorEvents Interface', () => {
    it('should define approval:required event in OrchestratorEvents', () => {
      // Test that the event can be listened to (compile-time verification)
      const handler = vi.fn();

      // This should compile without errors if the event is properly defined
      orchestrator.on('approval:required', handler);

      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');

      // Clean up
      orchestrator.off('approval:required', handler);
    });

    it('should allow removal of approval:required event listeners', () => {
      const handler = vi.fn();

      orchestrator.on('approval:required', handler);
      orchestrator.off('approval:required', handler);

      // Verify event listener was removed (no error should occur)
      expect(() => orchestrator.off('approval:required', handler)).not.toThrow();
    });
  });

  describe('Event Emission on Gate Hit', () => {
    it('should emit approval:required event when reaching a gate during stage execution', async () => {
      // Set up mock query response for planning stage
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'Planning completed successfully. Implementation plan created.',
                },
              ],
            },
          ],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      // Set up mock query response for implementation stage that will hit the gate
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-2',
        output: {
          success: true,
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'Implementation completed. Ready for code review.',
                },
              ],
            },
          ],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalRequiredEvents.push(event);
      });

      // Create and run a task with a workflow containing gates
      const task = await orchestrator.createTask({
        description: 'Implement feature with approval gates',
        workflow: 'feature-with-gates',
      });

      await orchestrator.runTask(task.id);

      // Verify that approval:required event was emitted
      expect(approvalRequiredEvents).toHaveLength(1);

      const event = approvalRequiredEvents[0];
      expect(event).toBeDefined();
      expect(event.taskId).toBe(task.id);
      expect(event.approvalId).toBeDefined();
      expect(typeof event.approvalId).toBe('string');
      expect(event.gateName).toBe('code-review-gate');
      expect(event.gateType).toBe('before-commit');
    });

    it('should emit multiple approval:required events for multiple gates', async () => {
      // Mock all stage completions
      mockQuery
        .mockResolvedValueOnce({ // planning
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({ // implementation
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        })
        .mockResolvedValueOnce({ // deployment
          requestId: 'test-request-3',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Deployment ready.' }] }],
          },
          usage: { totalTokens: 200, inputTokens: 100, outputTokens: 100 },
        });

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalRequiredEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Feature with multiple gates',
        workflow: 'feature-with-gates',
      });

      await orchestrator.runTask(task.id);

      // Should emit events for both gates (after implementation and deployment stages)
      expect(approvalRequiredEvents).toHaveLength(2);

      // First gate - code review
      const firstEvent = approvalRequiredEvents[0];
      expect(firstEvent.gateName).toBe('code-review-gate');
      expect(firstEvent.gateType).toBe('before-commit');

      // Second gate - security review
      const secondEvent = approvalRequiredEvents[1];
      expect(secondEvent.gateName).toBe('security-gate');
      expect(secondEvent.gateType).toBe('before-deploy');
    });

    it('should not emit approval:required event for stages without gates', async () => {
      // Create a workflow without any gates
      const simpleWorkflowContent = `
name: simple-feature
description: Simple feature workflow without gates
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
  - name: implementation
    agent: developer
    dependsOn:
      - planning
    description: Implement the feature
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'simple-feature.yaml'),
        simpleWorkflowContent
      );

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

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalRequiredEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Simple feature without gates',
        workflow: 'simple-feature',
      });

      await orchestrator.runTask(task.id);

      // Should not emit any approval events
      expect(approvalRequiredEvents).toHaveLength(0);
    });
  });

  describe('Event Payload Validation', () => {
    it('should emit event with complete ApprovalRequiredEventData structure', async () => {
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      }).mockResolvedValueOnce({
        requestId: 'test-request-2',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      let emittedEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test approval event payload',
        workflow: 'feature-with-gates',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();
      expect(emittedEvent!).toMatchObject({
        // Core identifiers
        approvalId: expect.any(String),
        taskId: task.id,

        // Gate information
        gateName: 'code-review-gate',
        gateType: 'before-commit',
        description: 'Code review required before commit',

        // Approval requirements
        requiredApprovals: expect.any(Number),
        approvers: expect.arrayContaining(['senior-dev', 'tech-lead']),
        timeout: 30,

        // Timestamps
        requestedAt: expect.any(Date),
        expiresAt: expect.any(Date),

        // Metadata
        stage: 'implementation',
        agent: 'developer',
        blocking: true,
      });

      // Verify approval ID is a valid UUID
      expect(emittedEvent!.approvalId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      // Verify expiration time is calculated correctly
      const timeDiffMinutes = (emittedEvent!.expiresAt!.getTime() - emittedEvent!.requestedAt.getTime()) / (1000 * 60);
      expect(timeDiffMinutes).toBeCloseTo(30, 1); // Within 1 minute tolerance
    });

    it('should include task context in the event payload', async () => {
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      }).mockResolvedValueOnce({
        requestId: 'test-request-2',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      let emittedEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Feature with custom context',
        workflow: 'feature-with-gates',
        priority: 'urgent',
        acceptanceCriteria: 'Must pass all tests\nMust be reviewed by senior dev',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();
      expect(emittedEvent!.context).toBeDefined();
      expect(emittedEvent!.context).toMatchObject({
        taskId: task.id,
        taskDescription: 'Feature with custom context',
        taskPriority: 'urgent',
        taskWorkflow: 'feature-with-gates',
        acceptanceCriteria: 'Must pass all tests\nMust be reviewed by senior dev',
        currentStage: 'implementation',
        currentAgent: 'developer',
      });
    });

    it('should handle different gate types correctly', async () => {
      const testCases: Array<{
        gateName: string;
        expectedType: ApprovalCheckpointType;
        description: string;
      }> = [
        {
          gateName: 'code-review-gate',
          expectedType: 'before-commit',
          description: 'Code review required before commit',
        },
        {
          gateName: 'security-gate',
          expectedType: 'before-deploy',
          description: 'Security review for production deployment',
        },
      ];

      for (const testCase of testCases) {
        // Reset mocks for each test case
        vi.clearAllMocks();

        mockQuery.mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        }).mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

        let emittedEvent: ApprovalRequiredEventData | undefined;
        orchestrator.on('approval:required', (event) => {
          if (event.gateName === testCase.gateName) {
            emittedEvent = event;
          }
        });

        const task = await orchestrator.createTask({
          description: `Test ${testCase.gateName}`,
          workflow: 'feature-with-gates',
        });

        await orchestrator.runTask(task.id);

        expect(emittedEvent).toBeDefined();
        expect(emittedEvent!.gateName).toBe(testCase.gateName);
        expect(emittedEvent!.gateType).toBe(testCase.expectedType);
        expect(emittedEvent!.description).toBe(testCase.description);
      }
    });
  });

  describe('Approval URL Generation', () => {
    it('should generate approval URL using apiUrl config', async () => {
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      }).mockResolvedValueOnce({
        requestId: 'test-request-2',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      let emittedEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test approval URL generation',
        workflow: 'feature-with-gates',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();
      expect(emittedEvent!.approvalUrl).toBeDefined();
      expect(emittedEvent!.approvalUrl).toBe(
        `https://api.example.com/approvals/${emittedEvent!.approvalId}`
      );
    });

    it('should use default apiUrl when not configured', async () => {
      // Create a new test directory with default config
      const defaultTestDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-default-test-'));

      try {
        await initializeApex(defaultTestDir, {
          projectName: 'test-default-api',
          language: 'typescript',
          framework: 'node',
        });

        // Use default config (no api.url override)
        const defaultConfigContent = `
version: "1.0"
project:
  name: test-default-api
  language: typescript
  framework: node
gates:
  - name: "test-gate"
    type: "before-commit"
    description: "Test gate"
    approvers: ["reviewer"]
    timeout: 30
`;
        await fs.writeFile(
          path.join(defaultTestDir, '.apex', 'config.yaml'),
          defaultConfigContent
        );

        // Create simple workflow with gate
        const workflowContent = `
name: test-workflow
description: Test workflow
stages:
  - name: planning
    agent: planner
    description: Plan
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement
    gate: "test-gate"
`;
        await fs.writeFile(
          path.join(defaultTestDir, '.apex', 'workflows', 'test-workflow.yaml'),
          workflowContent
        );

        // Copy agent files
        await fs.copyFile(
          path.join(testDir, '.apex', 'agents', 'planner.md'),
          path.join(defaultTestDir, '.apex', 'agents', 'planner.md')
        );
        await fs.copyFile(
          path.join(testDir, '.apex', 'agents', 'developer.md'),
          path.join(defaultTestDir, '.apex', 'agents', 'developer.md')
        );

        const defaultOrchestrator = new ApexOrchestrator({ projectPath: defaultTestDir });
        await defaultOrchestrator.initialize();

        mockQuery.mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        }).mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

        let emittedEvent: ApprovalRequiredEventData | undefined;
        defaultOrchestrator.on('approval:required', (event) => {
          emittedEvent = event;
        });

        const task = await defaultOrchestrator.createTask({
          description: 'Test default API URL',
          workflow: 'test-workflow',
        });

        await defaultOrchestrator.runTask(task.id);

        expect(emittedEvent).toBeDefined();
        expect(emittedEvent!.approvalUrl).toBe(
          `http://localhost:3000/approvals/${emittedEvent!.approvalId}`
        );
      } finally {
        await fs.rm(defaultTestDir, { recursive: true, force: true });
      }
    });

    it('should handle URL path construction correctly', async () => {
      // Test with trailing slash in API URL
      const trailingSlashConfigContent = `
version: "1.0"
project:
  name: test-trailing-slash
  language: typescript
  framework: node
api:
  url: "https://api.example.com/"
gates:
  - name: "test-gate"
    type: "before-commit"
    description: "Test gate"
    approvers: ["reviewer"]
    timeout: 30
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        trailingSlashConfigContent
      );

      // Reinitialize orchestrator with new config
      const newOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await newOrchestrator.initialize();

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      }).mockResolvedValueOnce({
        requestId: 'test-request-2',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      let emittedEvent: ApprovalRequiredEventData | undefined;
      newOrchestrator.on('approval:required', (event) => {
        emittedEvent = event;
      });

      const task = await newOrchestrator.createTask({
        description: 'Test trailing slash URL',
        workflow: 'feature-with-gates',
      });

      await newOrchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();
      // Should not have double slashes
      expect(emittedEvent!.approvalUrl).toBe(
        `https://api.example.com/approvals/${emittedEvent!.approvalId}`
      );
    });
  });

  describe('Event Schema Compliance', () => {
    it('should emit events that comply with ApprovalRequiredEventDataSchema', async () => {
      // Import the schema to validate against
      const { ApprovalRequiredEventDataSchema } = await import('@apexcli/core');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      }).mockResolvedValueOnce({
        requestId: 'test-request-2',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      let emittedEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test schema compliance',
        workflow: 'feature-with-gates',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();

      // Validate against Zod schema
      expect(() => ApprovalRequiredEventDataSchema.parse(emittedEvent)).not.toThrow();

      // Verify the parsed result matches our expected structure
      const parsed = ApprovalRequiredEventDataSchema.parse(emittedEvent);
      expect(parsed).toEqual(emittedEvent);
    });

    it('should emit events with all required fields populated', async () => {
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      }).mockResolvedValueOnce({
        requestId: 'test-request-2',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      let emittedEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval:required', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test required fields',
        workflow: 'feature-with-gates',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();

      // Check all required fields are present and non-empty
      expect(emittedEvent!.approvalId).toBeTruthy();
      expect(typeof emittedEvent!.approvalId).toBe('string');

      expect(emittedEvent!.taskId).toBeTruthy();
      expect(typeof emittedEvent!.taskId).toBe('string');

      expect(emittedEvent!.gateName).toBeTruthy();
      expect(typeof emittedEvent!.gateName).toBe('string');

      expect(emittedEvent!.gateType).toBeTruthy();
      expect(typeof emittedEvent!.gateType).toBe('string');

      expect(emittedEvent!.requestedAt).toBeInstanceOf(Date);
      expect(emittedEvent!.requestedAt.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing gate configuration gracefully', async () => {
      // Create workflow with invalid gate reference
      const invalidWorkflowContent = `
name: invalid-gate-workflow
description: Workflow with invalid gate reference
stages:
  - name: planning
    agent: planner
    description: Plan
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement
    gate: "non-existent-gate"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'invalid-gate-workflow.yaml'),
        invalidWorkflowContent
      );

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      }).mockResolvedValueOnce({
        requestId: 'test-request-2',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalRequiredEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test missing gate',
        workflow: 'invalid-gate-workflow',
      });

      // Should not throw an error, but may not emit event
      await expect(orchestrator.runTask(task.id)).resolves.not.toThrow();

      // Verify that either no event is emitted, or if emitted, it handles the missing gate gracefully
      if (approvalRequiredEvents.length > 0) {
        const event = approvalRequiredEvents[0];
        expect(event.gateName).toBe('non-existent-gate');
        // The event might be emitted with default or minimal gate information
      }
    });

    it('should continue workflow execution after emitting approval:required event', async () => {
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      }).mockResolvedValueOnce({
        requestId: 'test-request-2',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      const approvalRequiredEvents: ApprovalRequiredEventData[] = [];
      const taskUpdates: any[] = [];

      orchestrator.on('approval:required', (event) => {
        approvalRequiredEvents.push(event);
      });

      orchestrator.on('task:updated', (task) => {
        taskUpdates.push(task);
      });

      const task = await orchestrator.createTask({
        description: 'Test workflow continuation',
        workflow: 'feature-with-gates',
      });

      await orchestrator.runTask(task.id);

      // Verify that approval event was emitted
      expect(approvalRequiredEvents).toHaveLength(1);

      // Verify that task was updated (workflow continued)
      expect(taskUpdates.length).toBeGreaterThan(0);

      // Task should be in awaiting-approval status
      const finalTask = await orchestrator.getTask(task.id);
      expect(finalTask).toBeDefined();
      expect(finalTask!.status).toBe('waiting-approval');
    });
  });
});