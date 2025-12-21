import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator, TaskSessionResumedEvent } from './index';
import { initializeApex } from '@apexcli/core';
import { TaskStatus, TaskSessionData } from '@apexcli/core';

describe('TaskSessionResumedEvent Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-session-integration-'));

    // Initialize APEX project
    await initializeApex(testDir, {
      projectName: 'session-integration-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create test workflow
    const workflowContent = `
name: feature
description: Feature development workflow
stages:
  - name: planning
    agent: planner
    description: Plan the feature
  - name: implementation
    agent: developer
    description: Implement the feature
    dependsOn: [planning]
`;
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      workflowContent
    );

    // Create test agents
    const plannerContent = `---
name: planner
description: Planning agent
tools: Read, Grep, Glob
model: haiku
---
Plan implementation tasks carefully.`;

    const developerContent = `---
name: developer
description: Developer agent
tools: Read, Write, Edit, Bash
model: sonnet
---
Implement features according to plan.`;

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'planner.md'),
      plannerContent
    );

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      developerContent
    );

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it('should emit task:session-resumed event when resuming from real checkpoint', async () => {
    // Create a task
    const task = await orchestrator.createTask({
      description: 'Implement user authentication system',
      workflow: 'feature',
      acceptanceCriteria: '- Users can log in\n- Passwords are secure\n- Sessions are managed'
    });

    // Simulate pausing the task during planning stage
    await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'session_limit');

    // Create realistic session data
    const now = new Date();
    const sessionData: TaskSessionData = {
      lastCheckpoint: now,
      contextSummary: 'Task was working on implementing user authentication. Completed initial planning and was starting to create user model.',
      conversationHistory: [
        {
          type: 'user',
          content: [{
            type: 'text',
            text: 'Implement user authentication system'
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement a user authentication system with secure login, password handling, and session management.'
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: 'src/types.ts' }
          }]
        },
        {
          type: 'user',
          content: [{
            type: 'tool_result',
            toolResult: 'export interface User {\n  id: string;\n  email: string;\n}'
          }]
        }
      ],
      stageState: {
        stage: 'planning',
        completedSteps: ['requirements_analysis', 'architecture_design'],
        nextStep: 'create_user_model',
        filesAnalyzed: ['src/types.ts', 'src/models/index.ts'],
        planningProgress: 0.75
      },
      resumePoint: {
        stage: 'planning',
        stepIndex: 3,
        metadata: {
          nextAction: 'create_user_interface',
          estimatedTimeRemaining: '15 minutes',
          criticalDecisions: ['password_hashing_strategy', 'session_storage_method']
        }
      }
    };

    // Save checkpoint with comprehensive data
    const checkpointId = await orchestrator.saveCheckpoint(task.id, {
      stage: 'planning',
      stageIndex: 0,
      conversationState: sessionData.conversationHistory,
      metadata: {
        sessionData,
        pauseReason: 'session_limit',
        pausedAt: now,
        workflowProgress: {
          totalStages: 2,
          completedStages: 0,
          currentStage: 'planning',
          stageProgress: 0.75
        }
      }
    });

    // Set up event listener
    const sessionResumedHandler = vi.fn();
    const emittedEvents: TaskSessionResumedEvent[] = [];

    orchestrator.on('task:session-resumed', (event: TaskSessionResumedEvent) => {
      sessionResumedHandler(event);
      emittedEvents.push(event);
    });

    // Resume the task
    const resumeStartTime = new Date();
    const resumed = await orchestrator.resumeTask(task.id, {
      checkpointId,
      resumeReason: 'manual_resume'
    });
    const resumeEndTime = new Date();

    // Verify resume was successful
    expect(resumed).toBe(true);

    // Verify event was emitted
    expect(sessionResumedHandler).toHaveBeenCalledTimes(1);
    expect(emittedEvents).toHaveLength(1);

    const event = emittedEvents[0];

    // Verify event structure
    expect(event).toEqual({
      taskId: task.id,
      resumeReason: 'manual_resume',
      contextSummary: expect.stringContaining('authentication'),
      previousStatus: 'paused',
      sessionData: expect.objectContaining({
        lastCheckpoint: expect.any(Date),
        contextSummary: expect.stringContaining('authentication'),
        conversationHistory: expect.arrayContaining([
          expect.objectContaining({ type: 'user' }),
          expect.objectContaining({ type: 'assistant' })
        ]),
        stageState: expect.objectContaining({
          stage: 'planning',
          completedSteps: expect.arrayContaining(['requirements_analysis', 'architecture_design'])
        }),
        resumePoint: expect.objectContaining({
          stage: 'planning',
          stepIndex: 3
        })
      }),
      timestamp: expect.any(Date)
    });

    // Verify timing
    expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(resumeStartTime.getTime());
    expect(event.timestamp.getTime()).toBeLessThanOrEqual(resumeEndTime.getTime());

    // Verify session data preservation
    expect(event.sessionData.conversationHistory).toHaveLength(4);
    expect(event.sessionData.stageState?.completedSteps).toEqual(['requirements_analysis', 'architecture_design']);
    expect(event.sessionData.resumePoint?.metadata?.nextAction).toBe('create_user_interface');

    // Verify task status was updated
    const updatedTask = await orchestrator.getTask(task.id);
    expect(updatedTask?.status).not.toBe('paused');
  });

  it('should handle real auto-resume scenario', async () => {
    const task = await orchestrator.createTask({
      description: 'Fix authentication bug',
      workflow: 'feature',
      priority: 'high'
    });

    // Simulate task being auto-paused due to budget limits
    await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'budget_exceeded');

    const sessionData: TaskSessionData = {
      lastCheckpoint: new Date(),
      contextSummary: 'Task was debugging authentication issue in login endpoint. Identified potential SQL injection vulnerability.',
      conversationHistory: [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Fix authentication bug' }]
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'I will investigate the authentication bug and implement a fix.' }]
        }
      ],
      stageState: {
        bugStatus: 'investigating',
        affectedFiles: ['src/auth/login.ts', 'src/middleware/auth.ts'],
        suspectedIssue: 'sql_injection_in_login_query'
      },
      resumePoint: {
        stage: 'implementation',
        stepIndex: 1,
        metadata: {
          nextAction: 'fix_sql_injection',
          priority: 'high'
        }
      }
    };

    const checkpointId = await orchestrator.saveCheckpoint(task.id, {
      stage: 'implementation',
      stageIndex: 1,
      conversationState: sessionData.conversationHistory,
      metadata: {
        sessionData,
        pauseReason: 'budget_exceeded'
      }
    });

    const sessionResumedHandler = vi.fn();
    orchestrator.on('task:session-resumed', sessionResumedHandler);

    // Simulate auto-resume when budget resets
    await orchestrator.resumeTask(task.id, {
      checkpointId,
      resumeReason: 'auto_resume'
    });

    expect(sessionResumedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: task.id,
        resumeReason: 'auto_resume',
        contextSummary: expect.stringContaining('debugging authentication'),
        previousStatus: 'paused',
        sessionData: expect.objectContaining({
          contextSummary: expect.stringContaining('SQL injection'),
          stageState: expect.objectContaining({
            bugStatus: 'investigating',
            suspectedIssue: 'sql_injection_in_login_query'
          })
        })
      })
    );
  });

  it('should generate contextSummary from session data when not provided', async () => {
    const task = await orchestrator.createTask({
      description: 'Optimize database queries',
      workflow: 'feature'
    });

    await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'manual');

    // Session data without explicit context summary
    const sessionData: TaskSessionData = {
      lastCheckpoint: new Date(),
      conversationHistory: [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Optimize database queries for better performance' }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: 'src/db/queries.sql' }
          }]
        },
        {
          type: 'user',
          content: [{
            type: 'tool_result',
            toolResult: 'SELECT * FROM users WHERE active = 1; -- This query is slow'
          }]
        }
      ],
      stageState: {
        queriesAnalyzed: ['user_lookup', 'product_search'],
        optimizationsPending: ['add_index_on_active', 'limit_select_columns']
      },
      resumePoint: {
        stage: 'implementation',
        stepIndex: 2,
        metadata: { currentQuery: 'user_lookup' }
      }
    };

    const checkpointId = await orchestrator.saveCheckpoint(task.id, {
      stage: 'implementation',
      stageIndex: 2,
      conversationState: sessionData.conversationHistory,
      metadata: {
        sessionData,
        pauseReason: 'manual'
      }
    });

    const sessionResumedHandler = vi.fn();
    orchestrator.on('task:session-resumed', sessionResumedHandler);

    await orchestrator.resumeTask(task.id, { checkpointId });

    const emittedEvent = sessionResumedHandler.mock.calls[0][0];

    // Should generate meaningful context summary from available data
    expect(emittedEvent.contextSummary).toBeDefined();
    expect(emittedEvent.contextSummary.length).toBeGreaterThan(0);
    expect(emittedEvent.contextSummary).toMatch(/(optim|databas|quer|performance)/i);
  });

  it('should handle multiple pause/resume cycles', async () => {
    const task = await orchestrator.createTask({
      description: 'Complex multi-stage feature',
      workflow: 'feature'
    });

    const sessionResumedHandler = vi.fn();
    orchestrator.on('task:session-resumed', sessionResumedHandler);

    // First pause/resume cycle
    await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'session_limit');

    const checkpoint1 = await orchestrator.saveCheckpoint(task.id, {
      stage: 'planning',
      stageIndex: 0,
      metadata: {
        sessionData: {
          lastCheckpoint: new Date(),
          contextSummary: 'Working on planning phase',
          stageState: { phase: 'requirements' }
        },
        pauseReason: 'session_limit'
      }
    });

    await orchestrator.resumeTask(task.id, { checkpointId: checkpoint1 });

    // Second pause/resume cycle
    await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'rate_limit');

    const checkpoint2 = await orchestrator.saveCheckpoint(task.id, {
      stage: 'implementation',
      stageIndex: 1,
      metadata: {
        sessionData: {
          lastCheckpoint: new Date(),
          contextSummary: 'Working on implementation phase',
          stageState: { phase: 'coding' }
        },
        pauseReason: 'rate_limit'
      }
    });

    await orchestrator.resumeTask(task.id, { checkpointId: checkpoint2 });

    // Verify two resume events were emitted
    expect(sessionResumedHandler).toHaveBeenCalledTimes(2);

    const [event1, event2] = sessionResumedHandler.mock.calls.map(call => call[0]);

    expect(event1.sessionData.stageState?.phase).toBe('requirements');
    expect(event2.sessionData.stageState?.phase).toBe('coding');
  });

  it('should maintain event consistency with task store', async () => {
    const task = await orchestrator.createTask({
      description: 'Store consistency test',
      workflow: 'feature'
    });

    await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'manual');

    const sessionData: TaskSessionData = {
      lastCheckpoint: new Date(),
      contextSummary: 'Consistent state test',
      conversationHistory: [],
      stageState: { test: true }
    };

    const checkpointId = await orchestrator.saveCheckpoint(task.id, {
      stage: 'planning',
      stageIndex: 0,
      metadata: { sessionData, pauseReason: 'manual' }
    });

    const sessionResumedHandler = vi.fn();
    orchestrator.on('task:session-resumed', sessionResumedHandler);

    await orchestrator.resumeTask(task.id, { checkpointId });

    // Verify event data matches what's stored
    const emittedEvent = sessionResumedHandler.mock.calls[0][0];
    const storedCheckpoint = await orchestrator.getCheckpoint(task.id, checkpointId);
    const updatedTask = await orchestrator.getTask(task.id);

    expect(emittedEvent.taskId).toBe(task.id);
    expect(emittedEvent.sessionData.contextSummary).toBe('Consistent state test');
    expect(storedCheckpoint?.stage).toBe('planning');
    expect(updatedTask?.status).not.toBe('paused');
  });

  it('should handle large-scale data in session resume', async () => {
    const task = await orchestrator.createTask({
      description: 'Large data processing task',
      workflow: 'feature'
    });

    // Create large conversation history
    const largeConversation = Array.from({ length: 100 }, (_, i) => ({
      type: 'user' as const,
      content: [{
        type: 'text' as const,
        text: `Processing batch ${i}: ${Array.from({ length: 100 }, (_, j) => `item-${j}`).join(', ')}`
      }]
    }));

    const sessionData: TaskSessionData = {
      lastCheckpoint: new Date(),
      contextSummary: 'Processing large dataset with 10,000 items across 100 batches',
      conversationHistory: largeConversation,
      stageState: {
        processedBatches: 75,
        totalBatches: 100,
        failedItems: ['item-42', 'item-157', 'item-298'],
        processingErrors: Array.from({ length: 50 }, (_, i) => ({
          batch: i,
          error: `Timeout error in batch ${i}`
        }))
      },
      resumePoint: {
        stage: 'implementation',
        stepIndex: 75,
        metadata: {
          currentBatch: 76,
          remainingWork: '25 batches',
          estimatedCompletion: '2 hours'
        }
      }
    };

    await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'resource_limit');

    const checkpointId = await orchestrator.saveCheckpoint(task.id, {
      stage: 'implementation',
      stageIndex: 75,
      conversationState: largeConversation,
      metadata: {
        sessionData,
        pauseReason: 'resource_limit'
      }
    });

    const sessionResumedHandler = vi.fn();
    orchestrator.on('task:session-resumed', sessionResumedHandler);

    // Should handle large data efficiently
    const start = performance.now();
    await orchestrator.resumeTask(task.id, { checkpointId });
    const end = performance.now();

    // Verify performance is reasonable (< 1 second for large data)
    expect(end - start).toBeLessThan(1000);

    expect(sessionResumedHandler).toHaveBeenCalledTimes(1);
    const event = sessionResumedHandler.mock.calls[0][0];

    expect(event.sessionData.conversationHistory).toHaveLength(100);
    expect(event.sessionData.stageState?.processedBatches).toBe(75);
    expect(event.sessionData.stageState?.processingErrors).toHaveLength(50);
  });

  it('should emit events in correct order with other orchestrator events', async () => {
    const task = await orchestrator.createTask({
      description: 'Event order test',
      workflow: 'feature'
    });

    // Track all events in order
    const eventLog: Array<{ type: string; timestamp: number; data?: any }> = [];

    orchestrator.on('task:session-resumed', (event) => {
      eventLog.push({ type: 'task:session-resumed', timestamp: Date.now(), data: event });
    });

    orchestrator.on('usage:updated', (taskId, usage) => {
      eventLog.push({ type: 'usage:updated', timestamp: Date.now(), data: { taskId, usage } });
    });

    orchestrator.on('log:entry', (entry) => {
      eventLog.push({ type: 'log:entry', timestamp: Date.now(), data: entry });
    });

    await orchestrator.updateTaskStatus(task.id, 'paused', undefined, 'manual');

    const checkpointId = await orchestrator.saveCheckpoint(task.id, {
      stage: 'planning',
      stageIndex: 0,
      metadata: {
        sessionData: {
          lastCheckpoint: new Date(),
          contextSummary: 'Event ordering test'
        },
        pauseReason: 'manual'
      }
    });

    await orchestrator.resumeTask(task.id, { checkpointId });

    // Verify task:session-resumed event was emitted
    const sessionResumedEvents = eventLog.filter(e => e.type === 'task:session-resumed');
    expect(sessionResumedEvents).toHaveLength(1);

    // Verify event timing is logical
    if (eventLog.length > 1) {
      for (let i = 1; i < eventLog.length; i++) {
        expect(eventLog[i].timestamp).toBeGreaterThanOrEqual(eventLog[i - 1].timestamp);
      }
    }
  });
});