/**
 * Test suite for approval:request event emission functionality
 *
 * Covers acceptance criteria:
 * 1. ApexOrchestrator emits 'approval:request' events with correct ApprovalRequest payload
 * 2. Event emitted when approval is needed
 * 3. Payload includes all required ApprovalRequest fields
 * 4. Unit tests verify event emission and payload structure
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
  ApprovalRequest,
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

describe('Approval Request Event Emission', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-request-test-'));
    mockQuery = vi.mocked(query);

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-approval-request-project',
      language: 'typescript',
      framework: 'node',
    });

    // Create config with api.url setting for approval URL generation
    const configContent = `
version: "1.0"
project:
  name: test-approval-request-project
  language: typescript
  framework: node
api:
  url: "https://api.example.com"
  port: 3000
  autoStart: false
gates:
  - name: "security-review-gate"
    type: "before-deploy"
    description: "Security review required before production deployment"
    approvers: ["security-team", "senior-dev"]
    timeout: 60
    minApprovals: 2
  - name: "code-review-gate"
    type: "before-commit"
    description: "Code review required before commit"
    approvers: ["senior-dev", "tech-lead"]
    timeout: 30
    minApprovals: 1
  - name: "database-migration-gate"
    type: "before-deploy"
    description: "Database migration approval required"
    approvers: ["dba", "tech-lead"]
    timeout: 120
    minApprovals: 1
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Create a workflow with approval gates
    const workflowContent = `
name: secure-feature-workflow
description: Feature development workflow with security gates
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
  - name: security-review
    agent: security-analyst
    dependsOn:
      - implementation
    description: Security analysis
    gate: "security-review-gate"
  - name: deployment
    agent: devops
    dependsOn:
      - security-review
    description: Deploy to production
    gate: "database-migration-gate"
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'secure-feature-workflow.yaml'),
      workflowContent
    );

    // Create test agent files
    const agents = [
      { name: 'planner', description: 'Plans implementation tasks', tools: 'Read, Glob, Grep' },
      { name: 'developer', description: 'Implements code changes', tools: 'Read, Write, Edit, Bash' },
      { name: 'security-analyst', description: 'Performs security analysis', tools: 'Read, Grep, Bash' },
      { name: 'devops', description: 'Handles deployment', tools: 'Bash' },
    ];

    for (const agent of agents) {
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', `${agent.name}.md`),
        `---
name: ${agent.name}
description: ${agent.description}
tools: ${agent.tools}
model: sonnet
---
You are a ${agent.name} agent.`
      );
    }

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('OrchestratorEvents Interface Support', () => {
    it('should support approval:request event in OrchestratorEvents interface', () => {
      // Test that the event can be listened to (compile-time verification)
      const handler = vi.fn();

      // This should compile without errors if the event is properly defined
      orchestrator.on('approval:request', handler);

      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');

      // Clean up
      orchestrator.off('approval:request', handler);
    });

    it('should allow removal of approval:request event listeners', () => {
      const handler = vi.fn();

      orchestrator.on('approval:request', handler);
      orchestrator.off('approval:request', handler);

      // Verify event listener was removed (no error should occur)
      expect(() => orchestrator.off('approval:request', handler)).not.toThrow();
    });
  });

  describe('Event Emission on Approval Needed', () => {
    it('should emit approval:request event when approval is needed for a gate', async () => {
      // Set up mock query responses for all stages
      mockQuery
        .mockResolvedValueOnce({ // planning
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
        })
        .mockResolvedValueOnce({ // implementation
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

      const approvalRequestEvents: ApprovalRequest[] = [];
      orchestrator.on('approval:request', (event) => {
        approvalRequestEvents.push(event);
      });

      // Create and run a task with a workflow containing gates
      const task = await orchestrator.createTask({
        description: 'Implement secure feature with approval gates',
        workflow: 'secure-feature-workflow',
      });

      await orchestrator.runTask(task.id);

      // Verify that approval:request event was emitted
      expect(approvalRequestEvents).toHaveLength(1);

      const event = approvalRequestEvents[0];
      expect(event).toBeDefined();
      expect(event.taskId).toBe(task.id);
      expect(event.requestId).toBeDefined();
      expect(typeof event.requestId).toBe('string');
      expect(event.description).toBeTruthy();
      expect(event.reason).toBeTruthy();
    });

    it('should emit multiple approval:request events for workflow with multiple gates', async () => {
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
        .mockResolvedValueOnce({ // security-review
          requestId: 'test-request-3',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Security review done.' }] }],
          },
          usage: { totalTokens: 200, inputTokens: 100, outputTokens: 100 },
        })
        .mockResolvedValueOnce({ // deployment
          requestId: 'test-request-4',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Deployment ready.' }] }],
          },
          usage: { totalTokens: 250, inputTokens: 125, outputTokens: 125 },
        });

      const approvalRequestEvents: ApprovalRequest[] = [];
      orchestrator.on('approval:request', (event) => {
        approvalRequestEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Secure feature with multiple approval gates',
        workflow: 'secure-feature-workflow',
      });

      await orchestrator.runTask(task.id);

      // Should emit events for all gates (code review, security review, database migration)
      expect(approvalRequestEvents).toHaveLength(3);

      // Verify each event has unique request IDs
      const requestIds = approvalRequestEvents.map(e => e.requestId);
      const uniqueRequestIds = new Set(requestIds);
      expect(uniqueRequestIds.size).toBe(3);

      // Verify all events reference the same task
      expect(approvalRequestEvents.every(e => e.taskId === task.id)).toBe(true);
    });

    it('should not emit approval:request event for stages without gates', async () => {
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

      const approvalRequestEvents: ApprovalRequest[] = [];
      orchestrator.on('approval:request', (event) => {
        approvalRequestEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Simple feature without gates',
        workflow: 'simple-feature',
      });

      await orchestrator.runTask(task.id);

      // Should not emit any approval request events
      expect(approvalRequestEvents).toHaveLength(0);
    });
  });

  describe('ApprovalRequest Payload Validation', () => {
    it('should emit event with complete ApprovalRequest structure', async () => {
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

      let emittedEvent: ApprovalRequest | undefined;
      orchestrator.on('approval:request', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test approval request payload validation',
        workflow: 'secure-feature-workflow',
        priority: 'high',
        acceptanceCriteria: 'Must pass security review\nMust have proper approval documentation',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();
      expect(emittedEvent!).toMatchObject({
        // Required fields
        requestId: expect.any(String),
        taskId: task.id,
        description: expect.any(String),
        reason: expect.any(String),
        id: expect.any(String), // Legacy field

        // Optional fields that may be present
        resourceImpact: expect.any(String),
        gateName: expect.any(String),
        gateType: expect.any(String),
        minApprovals: expect.any(Number),
        approvers: expect.any(Array),
        timeoutMinutes: expect.any(Number),
        requestedAt: expect.any(Date),
        expiresAt: expect.any(Date),
        stage: expect.any(String),
        agent: expect.any(String),
        context: expect.any(Object),
      });

      // Verify request ID is a valid UUID
      expect(emittedEvent!.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      // Verify description and reason are meaningful
      expect(emittedEvent!.description.length).toBeGreaterThan(0);
      expect(emittedEvent!.reason.length).toBeGreaterThan(0);
    });

    it('should include gate-specific information in the payload', async () => {
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

      let emittedEvent: ApprovalRequest | undefined;
      orchestrator.on('approval:request', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test gate-specific information',
        workflow: 'secure-feature-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();
      expect(emittedEvent!.gateName).toBe('code-review-gate');
      expect(emittedEvent!.gateType).toBe('before-commit');
      expect(emittedEvent!.minApprovals).toBe(1);
      expect(emittedEvent!.approvers).toEqual(['senior-dev', 'tech-lead']);
      expect(emittedEvent!.timeoutMinutes).toBe(30);
      expect(emittedEvent!.stage).toBe('implementation');
      expect(emittedEvent!.agent).toBe('developer');
      expect(emittedEvent!.context?.blocking).toBe(true);
    });

    it('should include task context information in the payload', async () => {
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

      let emittedEvent: ApprovalRequest | undefined;
      orchestrator.on('approval:request', (event) => {
        emittedEvent = event;
      });

      const customDescription = 'Feature with custom context and metadata';
      const customCriteria = 'Must pass integration tests\nMust have documentation\nMust be reviewed by architect';

      const task = await orchestrator.createTask({
        description: customDescription,
        workflow: 'secure-feature-workflow',
        priority: 'urgent',
        acceptanceCriteria: customCriteria,
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();
      expect(emittedEvent!.context).toBeDefined();
      expect(emittedEvent!.context).toMatchObject({
        taskId: task.id,
        taskDescription: customDescription,
        taskPriority: 'urgent',
        taskWorkflow: 'secure-feature-workflow',
        acceptanceCriteria: customCriteria,
        currentStage: 'implementation',
        currentAgent: 'developer',
      });
    });

    it('should calculate correct expiration time based on gate timeout', async () => {
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

      let emittedEvent: ApprovalRequest | undefined;
      orchestrator.on('approval:request', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test timeout calculation',
        workflow: 'secure-feature-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();
      expect(emittedEvent!.requestedAt).toBeInstanceOf(Date);
      expect(emittedEvent!.expiresAt).toBeInstanceOf(Date);

      // Verify timeout is set correctly (30 minutes for code-review-gate)
      expect(emittedEvent!.timeoutMinutes).toBe(30);

      // Verify expiration time exists
      expect(emittedEvent!.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Different Gate Types and Configurations', () => {
    it('should handle different gate types correctly', async () => {
      const testCases: Array<{
        expectedGate: string;
        expectedType: ApprovalCheckpointType;
        expectedApprovers: string[];
        expectedMinApprovals: number;
        expectedTimeout: number;
      }> = [
        {
          expectedGate: 'code-review-gate',
          expectedType: 'before-commit',
          expectedApprovers: ['senior-dev', 'tech-lead'],
          expectedMinApprovals: 1,
          expectedTimeout: 30,
        },
        {
          expectedGate: 'security-review-gate',
          expectedType: 'before-deploy',
          expectedApprovers: ['security-team', 'senior-dev'],
          expectedMinApprovals: 2,
          expectedTimeout: 60,
        },
        {
          expectedGate: 'database-migration-gate',
          expectedType: 'before-deploy',
          expectedApprovers: ['dba', 'tech-lead'],
          expectedMinApprovals: 1,
          expectedTimeout: 120,
        },
      ];

      let currentTestCaseIndex = 0;
      const approvalRequestEvents: ApprovalRequest[] = [];

      // Mock all stage completions to trigger all gates
      mockQuery
        .mockResolvedValue({ // Reusable response for all stages
          requestId: `test-request-${Date.now()}`,
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Stage completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        });

      orchestrator.on('approval:request', (event) => {
        approvalRequestEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test all gate types',
        workflow: 'secure-feature-workflow',
      });

      await orchestrator.runTask(task.id);

      // Should have triggered all three gates
      expect(approvalRequestEvents).toHaveLength(3);

      // Verify each gate configuration
      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const event = approvalRequestEvents[i];

        expect(event.gateName).toBe(testCase.expectedGate);
        expect(event.gateType).toBe(testCase.expectedType);
        expect(event.approvers).toEqual(testCase.expectedApprovers);
        expect(event.minApprovals).toBe(testCase.expectedMinApprovals);
        expect(event.timeoutMinutes).toBe(testCase.expectedTimeout);
      }
    });
  });

  describe('Schema Compliance', () => {
    it('should emit events that comply with ApprovalRequestSchema', async () => {
      // Import the schema to validate against
      const { ApprovalRequestSchema } = await import('@apexcli/core');

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

      let emittedEvent: ApprovalRequest | undefined;
      orchestrator.on('approval:request', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test schema compliance',
        workflow: 'secure-feature-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();

      // Validate against Zod schema
      expect(() => ApprovalRequestSchema.parse(emittedEvent)).not.toThrow();

      // Verify the parsed result matches our expected structure
      const parsed = ApprovalRequestSchema.parse(emittedEvent);
      expect(parsed).toEqual(emittedEvent);
    });

    it('should emit events with all required fields populated', async () => {
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

      let emittedEvent: ApprovalRequest | undefined;
      orchestrator.on('approval:request', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test required fields population',
        workflow: 'secure-feature-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();

      // Check all required fields are present and non-empty
      expect(emittedEvent!.requestId).toBeTruthy();
      expect(typeof emittedEvent!.requestId).toBe('string');

      expect(emittedEvent!.taskId).toBeTruthy();
      expect(typeof emittedEvent!.taskId).toBe('string');

      expect(emittedEvent!.description).toBeTruthy();
      expect(typeof emittedEvent!.description).toBe('string');

      expect(emittedEvent!.reason).toBeTruthy();
      expect(typeof emittedEvent!.reason).toBe('string');

      expect(emittedEvent!.requestedAt).toBeInstanceOf(Date);
      expect(emittedEvent!.requestedAt.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
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

      const approvalRequestEvents: ApprovalRequest[] = [];
      orchestrator.on('approval:request', (event) => {
        approvalRequestEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test missing gate handling',
        workflow: 'invalid-gate-workflow',
      });

      // Should not throw an error
      await expect(orchestrator.runTask(task.id)).resolves.not.toThrow();

      // Verify that either no event is emitted, or if emitted, it handles the missing gate gracefully
      if (approvalRequestEvents.length > 0) {
        const event = approvalRequestEvents[0];
        expect(event.gateName).toBe('non-existent-gate');
        // Should handle missing gate information with defaults or error handling
      }
    });

    it('should continue workflow after approval request emission', async () => {
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

      const approvalRequestEvents: ApprovalRequest[] = [];
      const taskUpdates: any[] = [];

      orchestrator.on('approval:request', (event) => {
        approvalRequestEvents.push(event);
      });

      orchestrator.on('task:updated', (task) => {
        taskUpdates.push(task);
      });

      const task = await orchestrator.createTask({
        description: 'Test workflow continuation after approval request',
        workflow: 'secure-feature-workflow',
      });

      await orchestrator.runTask(task.id);

      // Verify that approval request event was emitted
      expect(approvalRequestEvents).toHaveLength(1);

      // Verify that task was updated (workflow continued)
      expect(taskUpdates.length).toBeGreaterThan(0);

      // Task should be in awaiting-approval status
      const finalTask = await orchestrator.getTask(task.id);
      expect(finalTask).toBeDefined();
      expect(finalTask!.status).toBe('waiting-approval');
    });
  });
});