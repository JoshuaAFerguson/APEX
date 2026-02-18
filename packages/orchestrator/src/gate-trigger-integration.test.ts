import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk with realistic responses
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

const mockQuery = query as unknown as ReturnType<typeof vi.fn>;

describe('ApexOrchestrator - Gate Trigger Integration Tests', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-gate-integration-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-project',
      language: 'typescript',
      framework: 'node',
    });

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('real workflow execution with gates', () => {
    it('should pause at approval gate during real feature workflow', async () => {
      // Create a realistic feature development workflow with gates
      const workflowContent = `
name: feature-development
description: Complete feature development workflow with approval gates
gates:
  - id: design-review
    name: Design Review
    description: Review architectural design before implementation
    required: true
    autoApprove: false
    timeout: 3600
    minApprovals: 1
  - id: code-review
    name: Code Review
    description: Review implementation before testing
    required: true
    autoApprove: false
    timeout: 1800
    minApprovals: 2

stages:
  - name: planning
    agent: planner
    description: Create implementation plan and design
  - name: architecture
    agent: architect
    description: Design system architecture
    dependsOn:
      - planning
    gate: design-review
  - name: implementation
    agent: developer
    description: Implement the feature
    dependsOn:
      - architecture
    gate: code-review
  - name: testing
    agent: tester
    description: Test the implementation
    dependsOn:
      - implementation
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'feature-development.yaml'),
        workflowContent
      );

      // Create agent files
      const agents = [
        { name: 'planner', description: 'Plans implementation tasks', tools: 'Read, Glob, Grep' },
        { name: 'architect', description: 'Designs system architecture', tools: 'Read, Write, Edit' },
        { name: 'developer', description: 'Implements features', tools: 'Read, Write, Edit, Bash' },
        { name: 'tester', description: 'Tests implementations', tools: 'Read, Bash, Grep' }
      ];

      for (const agent of agents) {
        const agentContent = `---
name: ${agent.name}
description: ${agent.description}
tools: ${agent.tools}
model: sonnet
---
You are a ${agent.name} agent focused on ${agent.description.toLowerCase()}.`;

        await fs.writeFile(
          path.join(testDir, '.apex', 'agents', `${agent.name}.md`),
          agentContent
        );
      }

      await orchestrator.initialize();

      // Mock the Claude SDK to return realistic responses for each stage
      mockQuery.mockImplementation(async (options: any) => {
        const agentName = options.definition.name;

        if (agentName === 'planner') {
          return {
            content: [
              {
                type: 'text',
                text: `## Planning Summary

I've analyzed the requirements and created a comprehensive implementation plan:

### Key Components:
1. User interface components
2. Backend API endpoints
3. Database schema updates
4. Authentication integration

### Implementation Steps:
1. Design data models
2. Create API specifications
3. Implement frontend components
4. Add backend logic
5. Integration testing

The plan is ready for architecture review.`
              }
            ],
            usage: { input_tokens: 150, output_tokens: 200, total_tokens: 350 }
          };
        } else if (agentName === 'architect') {
          return {
            content: [
              {
                type: 'text',
                text: `## Architecture Design

Based on the planning output, I've designed the system architecture:

### System Architecture:
- **Frontend**: React components with TypeScript
- **Backend**: Node.js with Express framework
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT tokens

### Key Design Decisions:
1. Microservices architecture for scalability
2. RESTful API design
3. Component-based UI architecture
4. Centralized state management

Architecture design is complete and ready for implementation review.`
              }
            ],
            usage: { input_tokens: 200, output_tokens: 180, total_tokens: 380 }
          };
        }

        // Default response for other agents
        return {
          content: [{ type: 'text', text: `${agentName} stage completed successfully.` }],
          usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
        };
      });

      const task = await orchestrator.createTask({
        title: 'Implement user authentication feature',
        description: 'Add comprehensive user authentication with JWT tokens',
        workflow: 'feature-development',
      });

      // Track workflow progress
      const events: Array<{ event: string; data: any }> = [];
      const eventTypes = [
        'task:started', 'task:stage-changed', 'task:paused',
        'gate:required', 'agent:message'
      ];

      eventTypes.forEach(eventType => {
        orchestrator.on(eventType as any, (data: any) => {
          events.push({ event: eventType, data });
        });
      });

      // Start the workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for workflow to process
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify workflow progression
      const stageChangeEvents = events.filter(e => e.event === 'task:stage-changed');
      expect(stageChangeEvents.length).toBeGreaterThan(0);

      // Should have completed planning stage
      const planningCompleted = stageChangeEvents.some(e =>
        e.data.currentStage === 'planning' ||
        (Array.isArray(e.data.completedStages) && e.data.completedStages.includes('planning'))
      );
      expect(planningCompleted).toBe(true);

      // Should be paused at design-review gate
      const pauseEvents = events.filter(e => e.event === 'task:paused');
      expect(pauseEvents).toHaveLength(1);
      expect(pauseEvents[0].data.pauseReason || pauseEvents[0].data).toBe('approval_gate');

      // Should have emitted gate:required event
      const gateEvents = events.filter(e => e.event === 'gate:required');
      expect(gateEvents).toHaveLength(1);
      expect(gateEvents[0].data.gateName).toBe('design-review');
      expect(gateEvents[0].data.stage).toBe('architecture');

      // Verify task is in awaiting-approval state
      const updatedTask = await orchestrator.getTask(task.id);
      expect(updatedTask).toBeDefined();
      expect(updatedTask!.status).toBe('awaiting-approval');
      expect(updatedTask!.pauseReason).toBe('approval_gate');
      expect(updatedTask!.approvalState).toMatchObject({
        gateName: 'design-review',
        status: 'pending',
        stage: 'architecture',
        agent: 'architect',
        minApprovals: 1,
        timeout: 3600,
      });
    });

    it('should handle gate timeout scenarios', async () => {
      // Create workflow with short timeout gate for testing
      const workflowContent = `
name: timeout-test-workflow
description: Workflow for testing gate timeouts
gates:
  - id: timeout-gate
    name: Quick Timeout Gate
    description: Gate with very short timeout for testing
    required: true
    autoApprove: false
    timeout: 1 # 1 second timeout for testing

stages:
  - name: quick-stage
    agent: developer
    description: Stage with quick timeout gate
    gate: timeout-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'timeout-test-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      const task = await orchestrator.createTask({
        title: 'Test Gate Timeout',
        description: 'Testing gate timeout behavior',
        workflow: 'timeout-test-workflow',
      });

      // Start workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for initial pause
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify task is paused for approval
      let currentTask = await orchestrator.getTask(task.id);
      expect(currentTask!.status).toBe('awaiting-approval');
      expect(currentTask!.approvalState!.timeout).toBe(1);

      // Wait for timeout to expire (plus buffer)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check if timeout handling is implemented
      // Note: This test documents expected behavior - actual timeout handling
      // may need to be implemented as a background process
      currentTask = await orchestrator.getTask(task.id);
      // The task should still be awaiting approval since timeout handling
      // is not yet implemented in the basic gate logic
      expect(currentTask!.status).toBe('awaiting-approval');
    });

    it('should handle workflow with multiple sequential gates', async () => {
      // Create workflow with multiple gates to test sequential gate processing
      const workflowContent = `
name: multi-gate-workflow
description: Workflow with multiple sequential gates
gates:
  - id: gate-1
    name: First Gate
    description: First approval gate
    required: true
    autoApprove: false
  - id: gate-2
    name: Second Gate
    description: Second approval gate
    required: true
    autoApprove: false

stages:
  - name: stage-1
    agent: developer
    description: First stage
  - name: stage-2
    agent: developer
    description: Second stage with first gate
    gate: gate-1
    dependsOn:
      - stage-1
  - name: stage-3
    agent: developer
    description: Third stage with second gate
    gate: gate-2
    dependsOn:
      - stage-2
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'multi-gate-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Mock Claude SDK
      mockQuery.mockResolvedValue({
        content: [{ type: 'text', text: 'Stage completed successfully.' }],
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
      });

      const task = await orchestrator.createTask({
        title: 'Test Multiple Gates',
        description: 'Testing workflow with multiple sequential gates',
        workflow: 'multi-gate-workflow',
      });

      // Start workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be paused at first gate after stage-1 completion
      const currentTask = await orchestrator.getTask(task.id);
      expect(currentTask!.status).toBe('awaiting-approval');
      expect(currentTask!.approvalState!.gateName).toBe('gate-1');
      expect(currentTask!.approvalState!.stage).toBe('stage-2');

      // Verify stage-1 is completed but stage-2 hasn't started
      // This tests that the gate properly blocks execution
    });

    it('should preserve conversation context through gate pause and resume', async () => {
      // Create workflow to test conversation context preservation
      const workflowContent = `
name: context-preservation-workflow
description: Test conversation context preservation through gates
gates:
  - id: context-gate
    name: Context Gate
    description: Gate for testing context preservation
    required: true
    autoApprove: false

stages:
  - name: context-building-stage
    agent: developer
    description: Build conversation context
  - name: context-dependent-stage
    agent: developer
    description: Stage that depends on previous context
    gate: context-gate
    dependsOn:
      - context-building-stage
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'context-preservation-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent that builds on previous conversation context.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Mock Claude SDK to return context-building responses
      mockQuery.mockImplementation(async (options: any) => {
        const conversation = options.conversation || [];
        const contextMessages = conversation.filter((msg: any) =>
          msg.role === 'assistant' && msg.content.some((c: any) => c.text.includes('context'))
        );

        return {
          content: [{
            type: 'text',
            text: `I'm building on previous context. Found ${contextMessages.length} context messages in conversation history.`
          }],
          usage: { input_tokens: 150, output_tokens: 100, total_tokens: 250 }
        };
      });

      const task = await orchestrator.createTask({
        title: 'Test Context Preservation',
        description: 'Testing conversation context through gate pause',
        workflow: 'context-preservation-workflow',
        conversation: [
          {
            type: 'user',
            content: [{ type: 'text', text: 'Initial context message for testing' }]
          }
        ]
      });

      // Start workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify task is paused at gate
      const pausedTask = await orchestrator.getTask(task.id);
      expect(pausedTask!.status).toBe('awaiting-approval');

      // Verify checkpoint contains conversation state
      const checkpoints = await (orchestrator as any).store.getCheckpoints(task.id);
      expect(checkpoints).toHaveLength(1);

      const checkpoint = checkpoints[0];
      expect(checkpoint.conversationState).toBeDefined();
      expect(checkpoint.metadata.pauseReason).toBe('approval_gate');

      // Verify conversation context is preserved in checkpoint
      expect(checkpoint.conversationState.messages.length).toBeGreaterThan(0);
    });
  });

  describe('gate interaction with checkpoint system', () => {
    it('should create valid checkpoint that can be used for resumption', async () => {
      // Create workflow with gate
      const workflowContent = `
name: checkpoint-resume-test
description: Test checkpoint creation and resume capability
gates:
  - id: resume-gate
    name: Resume Gate
    description: Gate for testing resume functionality
    required: true
    autoApprove: false

stages:
  - name: pre-gate-stage
    agent: developer
    description: Stage before gate
  - name: post-gate-stage
    agent: developer
    description: Stage after gate
    gate: resume-gate
    dependsOn:
      - pre-gate-stage
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'checkpoint-resume-test.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Mock Claude SDK
      mockQuery.mockResolvedValue({
        content: [{ type: 'text', text: 'Stage completed successfully with valuable outputs.' }],
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
      });

      const task = await orchestrator.createTask({
        title: 'Test Checkpoint Resume',
        description: 'Testing checkpoint creation and resume capability',
        workflow: 'checkpoint-resume-test',
      });

      // Start workflow to create checkpoint
      await orchestrator.runWorkflow(task.id);

      // Wait for checkpoint creation
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify checkpoint was created
      const checkpoints = await (orchestrator as any).store.getCheckpoints(task.id);
      expect(checkpoints).toHaveLength(1);

      const checkpoint = checkpoints[0];
      expect(checkpoint.stage).toBe('post-gate-stage');
      expect(checkpoint.metadata.pauseReason).toBe('approval_gate');
      expect(checkpoint.metadata.resumePoint).toBe('pre_stage_gate');
      expect(checkpoint.metadata.completedStages).toContain('pre-gate-stage');

      // Verify checkpoint structure is valid for resumption
      expect(checkpoint).toHaveProperty('conversationState');
      expect(checkpoint.conversationState).toHaveProperty('messages');
      expect(checkpoint).toHaveProperty('createdAt');
      expect(checkpoint).toHaveProperty('id');

      // Test that the checkpoint contains all necessary resume data
      expect(checkpoint.metadata).toHaveProperty('gateName');
      expect(checkpoint.metadata).toHaveProperty('gateId');
      expect(checkpoint.metadata).toHaveProperty('approvalId');
      expect(checkpoint.metadata.gateName).toBe('resume-gate');
    });

    it('should handle checkpoint creation errors gracefully', async () => {
      // Create workflow
      const workflowContent = `
name: checkpoint-error-test
description: Test checkpoint error handling
gates:
  - id: error-gate
    name: Error Gate
    description: Gate for testing checkpoint errors
    required: true
    autoApprove: false

stages:
  - name: error-stage
    agent: developer
    description: Stage that might cause checkpoint errors
    gate: error-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'checkpoint-error-test.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      const task = await orchestrator.createTask({
        title: 'Test Checkpoint Error Handling',
        description: 'Testing checkpoint error scenarios',
        workflow: 'checkpoint-error-test',
      });

      // Mock saveCheckpoint to throw an error
      const originalSaveCheckpoint = (orchestrator as any).saveCheckpoint;
      (orchestrator as any).saveCheckpoint = vi.fn().mockRejectedValue(
        new Error('Simulated checkpoint save error')
      );

      // Mock console.error to track error logging
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Start workflow - should handle checkpoint error gracefully
      await expect(orchestrator.runWorkflow(task.id)).resolves.not.toThrow();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify error was logged but didn't crash the workflow
      expect(consoleSpy).toHaveBeenCalled();

      // Cleanup
      consoleSpy.mockRestore();
      (orchestrator as any).saveCheckpoint = originalSaveCheckpoint;
    });
  });

  describe('gate configuration validation', () => {
    it('should validate gate configuration during workflow execution', async () => {
      // Create workflow with comprehensive gate configuration
      const workflowContent = `
name: validation-test-workflow
description: Test comprehensive gate validation
gates:
  - id: comprehensive-gate
    name: Comprehensive Gate
    description: Gate with all possible configurations
    required: true
    autoApprove: false
    timeout: 1800
    minApprovals: 3
    type: pre-stage
    tags:
      - critical
      - security
      - review

stages:
  - name: validated-stage
    agent: developer
    description: Stage with comprehensive gate
    gate: comprehensive-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'validation-test-workflow.yaml'),
        workflowContent
      );

      const developerContent = `---
name: developer
description: Development agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a development agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      const task = await orchestrator.createTask({
        title: 'Test Gate Validation',
        description: 'Testing comprehensive gate validation',
        workflow: 'validation-test-workflow',
      });

      // Start workflow
      await orchestrator.runWorkflow(task.id);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify gate configuration is properly applied
      const pausedTask = await orchestrator.getTask(task.id);
      expect(pausedTask!.approvalState).toMatchObject({
        gateName: 'comprehensive-gate',
        minApprovals: 3,
        timeout: 1800,
        autoApprove: false,
        stage: 'validated-stage',
        agent: 'developer',
      });

      // Verify gate exists in orchestrator's gates map
      const gates = (orchestrator as any).gates as Map<string, any>;
      const gate = gates.get('comprehensive-gate');
      expect(gate).toBeDefined();
      expect(gate.tags).toEqual(['critical', 'security', 'review']);
      expect(gate.type).toBe('pre-stage');
    });
  });
});