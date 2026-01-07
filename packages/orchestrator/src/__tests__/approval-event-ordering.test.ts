/**
 * Tests for approval event ordering and sequence validation
 *
 * This test suite ensures that approval events are emitted in the correct order
 * and that the event sequence follows the expected approval lifecycle:
 * 1. approval:required -> 2. approval:approved/denied -> 3. approval:resolved
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  ApprovalRequiredEventData,
  ApprovalGrantedEventData,
  ApprovalDeniedEventData,
  ApprovalResolvedEventData,
  ApprovalEventData
} from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Approval Event Ordering', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let mockQuery: MockInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-event-ordering-test-'));
    mockQuery = vi.mocked(query);

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-event-ordering',
      language: 'typescript',
      framework: 'node',
    });

    // Create config with gates
    const configContent = `
version: "1.0"
project:
  name: test-event-ordering
  language: typescript
  framework: node
api:
  url: "https://api.example.com"
gates:
  - name: "test-gate"
    type: "before-commit"
    description: "Test gate for event ordering"
    approvers: ["reviewer"]
    timeout: 30
    minApprovals: 1
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Create workflow with approval gate
    const workflowContent = `
name: event-order-workflow
description: Workflow to test event ordering
stages:
  - name: planning
    agent: planner
    description: Plan the implementation
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement the feature
    gate: "test-gate"
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'event-order-workflow.yaml'),
      workflowContent
    );

    // Create agent files
    const agents = ['planner', 'developer'];
    for (const agent of agents) {
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', `${agent}.md`),
        `---
name: ${agent}
description: ${agent.charAt(0).toUpperCase() + agent.slice(1)} agent
tools: Read, Write, Edit
model: sonnet
---
You are a ${agent} agent.`
      );
    }

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Event Sequence Validation', () => {
    it('should emit approval events in correct order for approved flow', async () => {
      // Mock stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'planning-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'implementation-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation completed.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const eventSequence: Array<{
        event: string;
        timestamp: Date;
        data: any;
      }> = [];

      // Listen to all approval events
      orchestrator.on('approval:required', (data) => {
        eventSequence.push({
          event: 'approval:required',
          timestamp: new Date(),
          data
        });
      });

      orchestrator.on('approval:approved', (data) => {
        eventSequence.push({
          event: 'approval:approved',
          timestamp: new Date(),
          data
        });
      });

      orchestrator.on('approval:denied', (data) => {
        eventSequence.push({
          event: 'approval:denied',
          timestamp: new Date(),
          data
        });
      });

      orchestrator.on('approval:resolved', (data) => {
        eventSequence.push({
          event: 'approval:resolved',
          timestamp: new Date(),
          data
        });
      });

      // Create and run task
      const task = await orchestrator.createTask({
        description: 'Test event ordering for approval',
        workflow: 'event-order-workflow',
      });

      await orchestrator.runTask(task.id);

      // At this point, we should have approval:required
      expect(eventSequence).toHaveLength(1);
      expect(eventSequence[0].event).toBe('approval:required');

      const approvalRequiredData = eventSequence[0].data as ApprovalRequiredEventData;
      expect(approvalRequiredData.approvalId).toBeDefined();
      expect(approvalRequiredData.taskId).toBe(task.id);

      // Approve the gate
      await orchestrator.approveTask(
        task.id,
        approvalRequiredData.approvalId,
        'reviewer',
        'Approved for testing'
      );

      // Now we should have the approval sequence
      expect(eventSequence.length).toBeGreaterThanOrEqual(2);

      // Find approval:approved event
      const approvedEventIndex = eventSequence.findIndex(e => e.event === 'approval:approved');
      expect(approvedEventIndex).toBeGreaterThan(-1);
      expect(approvedEventIndex).toBeGreaterThan(0); // Should come after approval:required

      // Verify event timestamps are in order
      for (let i = 1; i < eventSequence.length; i++) {
        expect(eventSequence[i].timestamp.getTime())
          .toBeGreaterThanOrEqual(eventSequence[i - 1].timestamp.getTime());
      }

      // Verify approval:approved data structure
      const approvedEvent = eventSequence[approvedEventIndex];
      const approvedData = approvedEvent.data as ApprovalGrantedEventData;
      expect(approvedData.approvalId).toBe(approvalRequiredData.approvalId);
      expect(approvedData.taskId).toBe(task.id);
      expect(approvedData.approver).toBe('reviewer');
      expect(approvedData.comment).toBe('Approved for testing');
    });

    it('should emit approval events in correct order for denied flow', async () => {
      // Mock stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'planning-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning completed.' }] }],
          },
          usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'implementation-request',
          output: {
            success: true,
            messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation completed.' }] }],
          },
          usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
        });

      const eventSequence: Array<{
        event: string;
        timestamp: Date;
        data: any;
      }> = [];

      // Listen to all approval events
      const eventTypes = ['approval:required', 'approval:approved', 'approval:denied', 'approval:resolved'];
      eventTypes.forEach(eventType => {
        orchestrator.on(eventType as any, (data) => {
          eventSequence.push({
            event: eventType,
            timestamp: new Date(),
            data
          });
        });
      });

      // Create and run task
      const task = await orchestrator.createTask({
        description: 'Test denial event ordering',
        workflow: 'event-order-workflow',
      });

      await orchestrator.runTask(task.id);

      // Should have approval:required
      expect(eventSequence).toHaveLength(1);
      expect(eventSequence[0].event).toBe('approval:required');

      const approvalRequiredData = eventSequence[0].data as ApprovalRequiredEventData;

      // Deny the approval
      await orchestrator.denyTask(
        task.id,
        approvalRequiredData.approvalId,
        'reviewer',
        'Issues found in implementation'
      );

      // Should have denial event
      const deniedEventIndex = eventSequence.findIndex(e => e.event === 'approval:denied');
      expect(deniedEventIndex).toBeGreaterThan(-1);
      expect(deniedEventIndex).toBeGreaterThan(0); // Should come after approval:required

      // Verify no approval:approved event was emitted
      const approvedEventIndex = eventSequence.findIndex(e => e.event === 'approval:approved');
      expect(approvedEventIndex).toBe(-1);

      // Verify denial data
      const deniedEvent = eventSequence[deniedEventIndex];
      const deniedData = deniedEvent.data as ApprovalDeniedEventData;
      expect(deniedData.approvalId).toBe(approvalRequiredData.approvalId);
      expect(deniedData.taskId).toBe(task.id);
      expect(deniedData.approver).toBe('reviewer');
      expect(deniedData.reason).toBe('Issues found in implementation');
    });

    it('should maintain event ordering under concurrent operations', async () => {
      // Create a workflow with multiple gates for concurrent testing
      const multiGateWorkflow = `
name: multi-gate-workflow
description: Workflow with multiple gates
stages:
  - name: planning
    agent: planner
    description: Plan
  - name: dev1
    agent: developer
    dependsOn: [planning]
    description: First development
    gate: "test-gate"
  - name: dev2
    agent: developer
    dependsOn: [planning]
    description: Second development
    gate: "test-gate"
`;
      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'multi-gate-workflow.yaml'),
        multiGateWorkflow
      );

      // Mock multiple completions
      mockQuery.mockResolvedValue({
        requestId: 'test-request',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Stage completed.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const allEvents: Array<{
        event: string;
        timestamp: Date;
        approvalId?: string;
        taskId?: string;
      }> = [];

      const eventTypes = ['approval:required', 'approval:approved', 'approval:denied'];
      eventTypes.forEach(eventType => {
        orchestrator.on(eventType as any, (data) => {
          allEvents.push({
            event: eventType,
            timestamp: new Date(),
            approvalId: data.approvalId,
            taskId: data.taskId
          });
        });
      });

      const task = await orchestrator.createTask({
        description: 'Test concurrent approval events',
        workflow: 'multi-gate-workflow',
      });

      await orchestrator.runTask(task.id);

      // There should be some events
      expect(allEvents.length).toBeGreaterThan(0);

      // Group events by approval ID
      const eventsByApproval = new Map<string, typeof allEvents>();

      allEvents.forEach(event => {
        if (event.approvalId) {
          if (!eventsByApproval.has(event.approvalId)) {
            eventsByApproval.set(event.approvalId, []);
          }
          eventsByApproval.get(event.approvalId)!.push(event);
        }
      });

      // For each approval, verify event ordering
      eventsByApproval.forEach((events, approvalId) => {
        // Events should be chronologically ordered
        for (let i = 1; i < events.length; i++) {
          expect(events[i].timestamp.getTime())
            .toBeGreaterThanOrEqual(events[i - 1].timestamp.getTime());
        }

        // First event should always be approval:required
        expect(events[0].event).toBe('approval:required');

        // If there are subsequent events, they should be approval outcomes
        if (events.length > 1) {
          const outcomeEvents = events.slice(1);
          outcomeEvents.forEach(event => {
            expect(['approval:approved', 'approval:denied', 'approval:resolved'])
              .toContain(event.event);
          });
        }
      });
    });
  });

  describe('Event Timing and Consistency', () => {
    it('should emit events with consistent timestamp progression', async () => {
      mockQuery.mockResolvedValueOnce({
        requestId: 'timing-test',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      }).mockResolvedValueOnce({
        requestId: 'timing-test-2',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      const eventTimestamps: Array<{
        event: string;
        timestamp: Date;
        systemTime: number;
      }> = [];

      orchestrator.on('approval:required', (data) => {
        eventTimestamps.push({
          event: 'approval:required',
          timestamp: data.requestedAt,
          systemTime: Date.now()
        });
      });

      orchestrator.on('approval:approved', (data) => {
        eventTimestamps.push({
          event: 'approval:approved',
          timestamp: data.approvedAt,
          systemTime: Date.now()
        });
      });

      const task = await orchestrator.createTask({
        description: 'Test event timing consistency',
        workflow: 'event-order-workflow',
      });

      const startTime = Date.now();
      await orchestrator.runTask(task.id);

      expect(eventTimestamps.length).toBeGreaterThan(0);

      // Find approval required event
      const requiredEvent = eventTimestamps.find(e => e.event === 'approval:required');
      expect(requiredEvent).toBeDefined();

      const approvalData = await orchestrator.getApprovalStatesByTask(task.id);
      if (approvalData.length > 0) {
        const approvalId = approvalData[0].id;

        // Approve with some delay
        await new Promise(resolve => setTimeout(resolve, 10));
        const approveTime = Date.now();

        await orchestrator.approveTask(
          task.id,
          approvalId,
          'reviewer',
          'Timing test approval'
        );

        const approvedEvent = eventTimestamps.find(e => e.event === 'approval:approved');
        if (approvedEvent) {
          // Timestamps should be logical and consistent
          expect(approvedEvent.timestamp.getTime())
            .toBeGreaterThan(requiredEvent!.timestamp.getTime());

          expect(approvedEvent.systemTime)
            .toBeGreaterThanOrEqual(approveTime - 100); // Allow some variance
        }
      }
    });

    it('should handle rapid event sequences without timestamp conflicts', async () => {
      mockQuery.mockResolvedValue({
        requestId: 'rapid-test',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Stage done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const eventTimestamps: number[] = [];

      ['approval:required', 'approval:approved', 'approval:denied'].forEach(eventType => {
        orchestrator.on(eventType as any, () => {
          eventTimestamps.push(Date.now());
        });
      });

      const task = await orchestrator.createTask({
        description: 'Test rapid event sequence',
        workflow: 'event-order-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(eventTimestamps.length).toBeGreaterThan(0);

      // Even in rapid sequences, timestamps should be non-decreasing
      for (let i = 1; i < eventTimestamps.length; i++) {
        expect(eventTimestamps[i]).toBeGreaterThanOrEqual(eventTimestamps[i - 1]);
      }
    });
  });

  describe('Event Data Consistency', () => {
    it('should maintain consistent data across related events', async () => {
      mockQuery.mockResolvedValueOnce({
        requestId: 'consistency-test',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Planning done.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      }).mockResolvedValueOnce({
        requestId: 'consistency-test-2',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Implementation done.' }] }],
        },
        usage: { totalTokens: 150, inputTokens: 75, outputTokens: 75 },
      });

      let requiredEventData: ApprovalRequiredEventData | undefined;
      let approvedEventData: ApprovalGrantedEventData | undefined;

      orchestrator.on('approval:required', (data) => {
        requiredEventData = data;
      });

      orchestrator.on('approval:approved', (data) => {
        approvedEventData = data;
      });

      const task = await orchestrator.createTask({
        description: 'Test data consistency across events',
        workflow: 'event-order-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(requiredEventData).toBeDefined();

      // Approve the task
      await orchestrator.approveTask(
        task.id,
        requiredEventData!.approvalId,
        'reviewer',
        'Consistency test approval'
      );

      expect(approvedEventData).toBeDefined();

      // Verify consistent data across events
      expect(approvedEventData!.approvalId).toBe(requiredEventData!.approvalId);
      expect(approvedEventData!.taskId).toBe(requiredEventData!.taskId);
      expect(approvedEventData!.taskId).toBe(task.id);

      // Context data should be consistent
      if (requiredEventData!.context && approvedEventData!.context) {
        expect(approvedEventData!.context.taskId).toBe(requiredEventData!.context.taskId);
        expect(approvedEventData!.context.taskDescription)
          .toBe(requiredEventData!.context.taskDescription);
      }
    });

    it('should provide consistent approval metadata across event lifecycle', async () => {
      mockQuery.mockResolvedValue({
        requestId: 'metadata-test',
        output: {
          success: true,
          messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Stage completed.' }] }],
        },
        usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
      });

      const eventMetadata: Array<{
        event: string;
        approvalId: string;
        taskId: string;
        stage?: string;
        agent?: string;
        gateName?: string;
      }> = [];

      orchestrator.on('approval:required', (data: ApprovalRequiredEventData) => {
        eventMetadata.push({
          event: 'approval:required',
          approvalId: data.approvalId,
          taskId: data.taskId,
          stage: data.stage,
          agent: data.agent,
          gateName: data.gateName
        });
      });

      orchestrator.on('approval:approved', (data: ApprovalGrantedEventData) => {
        eventMetadata.push({
          event: 'approval:approved',
          approvalId: data.approvalId,
          taskId: data.taskId,
          stage: data.stage,
          agent: data.agent,
          gateName: data.gateName
        });
      });

      const task = await orchestrator.createTask({
        description: 'Test metadata consistency',
        workflow: 'event-order-workflow',
      });

      await orchestrator.runTask(task.id);

      expect(eventMetadata.length).toBeGreaterThan(0);

      const requiredEvent = eventMetadata.find(e => e.event === 'approval:required');
      expect(requiredEvent).toBeDefined();

      // Approve and check metadata consistency
      if (requiredEvent) {
        await orchestrator.approveTask(
          task.id,
          requiredEvent.approvalId,
          'reviewer',
          'Metadata test'
        );

        const approvedEvent = eventMetadata.find(e => e.event === 'approval:approved');
        if (approvedEvent) {
          // Core identifiers should match
          expect(approvedEvent.approvalId).toBe(requiredEvent.approvalId);
          expect(approvedEvent.taskId).toBe(requiredEvent.taskId);

          // Contextual metadata should be consistent
          expect(approvedEvent.stage).toBe(requiredEvent.stage);
          expect(approvedEvent.agent).toBe(requiredEvent.agent);
          expect(approvedEvent.gateName).toBe(requiredEvent.gateName);
        }
      }
    });
  });
});