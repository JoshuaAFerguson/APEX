/**
 * Test suite for approval-required event schema validation
 *
 * Validates that emitted approval-required events conform exactly to the
 * ApprovalRequiredEventDataSchema and that all required fields are properly populated.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { initializeApex, ApprovalRequiredEventDataSchema } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ApprovalRequiredEventData, ApprovalCheckpointType } from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

describe('Approval Event Schema Validation', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-schema-test-'));
    mockQuery = vi.mocked(query);

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-schema-validation',
      language: 'typescript',
      framework: 'node',
    });

    // Create config with various gate types
    const configContent = `
version: "1.0"
project:
  name: test-schema-validation
  language: typescript
  framework: node
api:
  url: "https://api.test.com"
  port: 3001
gates:
  - name: "before-commit-gate"
    type: "before-commit"
    description: "Pre-commit validation gate"
    approvers: ["reviewer1", "reviewer2"]
    timeout: 15
    minApprovals: 2
    required: true
  - name: "before-deploy-gate"
    type: "before-deploy"
    description: "Pre-deployment security check"
    approvers: ["security-team", "ops-lead"]
    timeout: 60
    minApprovals: 1
    required: false
  - name: "manual-gate"
    type: "manual"
    description: "Manual approval checkpoint"
    approvers: ["project-manager"]
    timeout: 120
    minApprovals: 1
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Create workflow with multiple gate types
    const workflowContent = `
name: multi-gate-workflow
description: Workflow with multiple gate types
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement the feature
    gate: "before-commit-gate"
  - name: testing
    agent: tester
    dependsOn: [implementation]
    description: Run tests
    gate: "manual-gate"
  - name: deployment
    agent: devops
    dependsOn: [testing]
    description: Deploy to production
    gate: "before-deploy-gate"
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'multi-gate-workflow.yaml'),
      workflowContent
    );

    // Create test agent files
    const agents = ['planner', 'developer', 'tester', 'devops'];
    for (const agent of agents) {
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', `${agent}.md`),
        `---
name: ${agent}
description: ${agent.charAt(0).toUpperCase() + agent.slice(1)} agent
tools: Read, Write, Bash
model: sonnet
---
You are a ${agent} agent.`
      );
    }

    orchestrator = new ApexOrchestrator({
      projectPath: testDir,
      apiUrl: 'https://api.test.com'
    });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Schema Compliance Tests', () => {
    it('should emit events that pass Zod schema validation for before-commit gate', async () => {
      // Mock stage completions up to implementation
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation completed.' }] }],
          },
          usage: { totalTokens: 200, inputTokens: 100, outputTokens: 100 },
        });

      let emittedEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval-required', (event) => {
        if (event.gateName === 'before-commit-gate') {
          emittedEvent = event;
        }
      });

      const task = await orchestrator.createTask({
        description: 'Test before-commit gate schema validation',
        workflow: 'multi-gate-workflow',
        priority: 'high',
        acceptanceCriteria: 'All tests must pass\nCode review required'
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();

      // Test 1: Schema validation should pass
      expect(() => ApprovalRequiredEventDataSchema.parse(emittedEvent)).not.toThrow();

      // Test 2: Validate specific fields match expected values
      const validatedEvent = ApprovalRequiredEventDataSchema.parse(emittedEvent);
      expect(validatedEvent).toEqual(emittedEvent);

      // Test 3: Validate field types and values
      expect(validatedEvent.approvalId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(validatedEvent.taskId).toBe(task.id);
      expect(validatedEvent.gateName).toBe('before-commit-gate');
      expect(validatedEvent.gateType).toBe('before-commit' as ApprovalCheckpointType);
      expect(validatedEvent.description).toBe('Pre-commit validation gate');
      expect(validatedEvent.approvers).toEqual(['reviewer1', 'reviewer2']);
      expect(validatedEvent.minApprovals).toBe(2);
      expect(validatedEvent.timeoutMinutes).toBe(15);
      expect(validatedEvent.blocking).toBe(true);
      expect(validatedEvent.stage).toBe('implementation');
      expect(validatedEvent.agent).toBe('developer');
      expect(validatedEvent.timestamp).toBeInstanceOf(Date);
      expect(validatedEvent.approvalUrl).toBe(`https://api.test.com/approvals/${validatedEvent.approvalId}`);
    });

    it('should emit valid events for all gate types', async () => {
      const gateTypeTests: Array<{
        gateName: string;
        gateType: ApprovalCheckpointType;
        stage: string;
        agent: string;
        minApprovals: number;
        blocking: boolean;
      }> = [
        {
          gateName: 'before-commit-gate',
          gateType: 'before-commit',
          stage: 'implementation',
          agent: 'developer',
          minApprovals: 2,
          blocking: true,
        },
        {
          gateName: 'manual-gate',
          gateType: 'manual',
          stage: 'testing',
          agent: 'tester',
          minApprovals: 1,
          blocking: true, // Default when not specified
        },
        {
          gateName: 'before-deploy-gate',
          gateType: 'before-deploy',
          stage: 'deployment',
          agent: 'devops',
          minApprovals: 1,
          blocking: false,
        },
      ];

      // Mock all stage completions
      const mockResponses = [
        { stage: 'planning', text: 'Planning completed.' },
        { stage: 'implementation', text: 'Implementation completed.' },
        { stage: 'testing', text: 'Testing completed.' },
        { stage: 'deployment', text: 'Deployment completed.' },
      ];

      mockQuery.mockClear();
      mockResponses.forEach((response, index) => {
        mockQuery.mockResolvedValueOnce({
          requestId: `test-request-${index + 1}`,
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: response.text }] }],
          },
          usage: { totalTokens: 100 + (index * 50), inputTokens: 50 + (index * 25), outputTokens: 50 + (index * 25) },
        });
      });

      const emittedEvents: ApprovalRequiredEventData[] = [];
      orchestrator.on('approval-required', (event) => {
        emittedEvents.push(event);
      });

      const task = await orchestrator.createTask({
        description: 'Test all gate types schema validation',
        workflow: 'multi-gate-workflow',
      });

      await orchestrator.runTask(task.id);

      // Expect events for all three gates
      expect(emittedEvents).toHaveLength(3);

      // Validate each event
      for (let i = 0; i < gateTypeTests.length; i++) {
        const expectedGate = gateTypeTests[i];
        const actualEvent = emittedEvents.find(e => e.gateName === expectedGate.gateName);

        expect(actualEvent).toBeDefined();

        // Schema validation
        expect(() => ApprovalRequiredEventDataSchema.parse(actualEvent)).not.toThrow();

        // Field validation
        expect(actualEvent!.gateName).toBe(expectedGate.gateName);
        expect(actualEvent!.gateType).toBe(expectedGate.gateType);
        expect(actualEvent!.stage).toBe(expectedGate.stage);
        expect(actualEvent!.agent).toBe(expectedGate.agent);
        expect(actualEvent!.minApprovals).toBe(expectedGate.minApprovals);
        expect(actualEvent!.blocking).toBe(expectedGate.blocking);
      }
    });
  });

  describe('Required Fields Validation', () => {
    it('should populate all required fields without exceptions', async () => {
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

      let emittedEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval-required', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test required fields validation',
        workflow: 'multi-gate-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();

      // Check all required fields are truthy and properly typed
      const requiredStringFields = ['approvalId', 'taskId', 'gateName', 'gateType'];
      for (const field of requiredStringFields) {
        expect(emittedEvent![field as keyof ApprovalRequiredEventData]).toBeTruthy();
        expect(typeof emittedEvent![field as keyof ApprovalRequiredEventData]).toBe('string');
        expect((emittedEvent![field as keyof ApprovalRequiredEventData] as string).length).toBeGreaterThan(0);
      }

      // Check timestamp is valid Date
      expect(emittedEvent!.timestamp).toBeInstanceOf(Date);
      expect(emittedEvent!.timestamp.getTime()).toBeGreaterThan(0);
      expect(emittedEvent!.timestamp.getTime()).toBeLessThanOrEqual(Date.now());

      // Check minApprovals is positive integer
      expect(emittedEvent!.minApprovals).toBeGreaterThan(0);
      expect(Number.isInteger(emittedEvent!.minApprovals)).toBe(true);
    });

    it('should handle optional fields correctly', async () => {
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

      let emittedEvent: ApprovalRequiredEventData | undefined;
      orchestrator.on('approval-required', (event) => {
        emittedEvent = event;
      });

      const task = await orchestrator.createTask({
        description: 'Test optional fields handling',
        workflow: 'multi-gate-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();

      // Validate optional fields are either present with correct types or undefined
      if (emittedEvent!.description !== undefined) {
        expect(typeof emittedEvent!.description).toBe('string');
      }

      if (emittedEvent!.approvers !== undefined) {
        expect(Array.isArray(emittedEvent!.approvers)).toBe(true);
        emittedEvent!.approvers.forEach(approver => {
          expect(typeof approver).toBe('string');
        });
      }

      if (emittedEvent!.timeoutMinutes !== undefined) {
        expect(typeof emittedEvent!.timeoutMinutes).toBe('number');
        expect(emittedEvent!.timeoutMinutes).toBeGreaterThan(0);
      }

      if (emittedEvent!.expiresAt !== undefined) {
        expect(emittedEvent!.expiresAt).toBeInstanceOf(Date);
        expect(emittedEvent!.expiresAt.getTime()).toBeGreaterThan(emittedEvent!.timestamp.getTime());
      }

      if (emittedEvent!.context !== undefined) {
        expect(typeof emittedEvent!.context).toBe('object');
        expect(emittedEvent!.context).not.toBeNull();
      }

      if (emittedEvent!.approvalUrl !== undefined) {
        expect(typeof emittedEvent!.approvalUrl).toBe('string');
        expect(emittedEvent!.approvalUrl).toMatch(/^https?:\/\/.+\/approvals\/.+$/);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle gates with minimal configuration', async () => {
      // Create a minimal gate configuration
      const minimalConfigContent = `
version: "1.0"
project:
  name: test-minimal-gate
  language: typescript
  framework: node
gates:
  - name: "minimal-gate"
    type: "manual"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        minimalConfigContent
      );

      // Create minimal workflow
      const minimalWorkflowContent = `
name: minimal-workflow
description: Minimal workflow for testing
stages:
  - name: implementation
    agent: developer
    description: Implement
    gate: "minimal-gate"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'minimal-workflow.yaml'),
        minimalWorkflowContent
      );

      // Reinitialize orchestrator with minimal config
      const minimalOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await minimalOrchestrator.initialize();

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      let emittedEvent: ApprovalRequiredEventData | undefined;
      minimalOrchestrator.on('approval-required', (event) => {
        emittedEvent = event;
      });

      const task = await minimalOrchestrator.createTask({
        description: 'Test minimal gate configuration',
        workflow: 'minimal-workflow',
      });

      await minimalOrchestrator.runTask(task.id);

      expect(emittedEvent).toBeDefined();

      // Should still pass schema validation with default values
      expect(() => ApprovalRequiredEventDataSchema.parse(emittedEvent)).not.toThrow();

      // Validate default values are applied
      expect(emittedEvent!.minApprovals).toBe(1); // Default from schema
      expect(emittedEvent!.blocking).toBe(true); // Default from schema
    });
  });
});