/**
 * MockOrchestrator test utility for AgentPanel integration tests
 * Extends EventEmitter to simulate orchestrator events matching the real orchestrator's patterns
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';
import type { OrchestratorEvents } from '@apexcli/orchestrator';

/**
 * Mock implementation of ApexOrchestrator for testing
 * Provides methods to simulate various orchestrator events
 */
export class MockOrchestrator extends EventEmitter {
  // Mock methods that would exist on the real orchestrator
  initialize = vi.fn().mockResolvedValue(undefined);
  executeTask = vi.fn().mockResolvedValue(undefined);
  getTask = vi.fn();
  listTasks = vi.fn().mockResolvedValue([]);
  updateTaskStatus = vi.fn().mockResolvedValue(undefined);

  constructor() {
    super();
    this.setMaxListeners(20); // Increase for complex test scenarios
  }

  /**
   * Simulate a stage change event
   * This is the core event that triggers agent transitions
   */
  simulateStageChange(taskId: string, stageName: string, agentName: string) {
    const mockTask = {
      id: taskId,
      workflow: 'feature',
      currentStage: stageName,
      status: 'in-progress' as const,
      description: 'Test task',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.emit('task:stage-changed', mockTask, stageName);
  }

  /**
   * Simulate agent transition event
   * More explicit than stage change for tracking previous/current agent
   */
  simulateAgentTransition(taskId: string, fromAgent: string | null, toAgent: string) {
    this.emit('agent:transition', taskId, fromAgent, toAgent);
  }

  /**
   * Simulate parallel execution start
   * Tests AgentPanel's handling of multiple concurrent agents
   */
  simulateParallelStart(taskId: string, stages: string[], agents: string[]) {
    this.emit('stage:parallel-started', taskId, stages, agents);
  }

  /**
   * Simulate parallel execution completion
   * Tests cleanup of parallel agent state
   */
  simulateParallelComplete(taskId: string) {
    this.emit('stage:parallel-completed', taskId);
  }

  /**
   * Simulate task completion
   * Tests cleanup of all agent state
   */
  simulateTaskComplete(task: any) {
    this.emit('task:completed', task);
  }

  /**
   * Simulate task failure
   * Tests error handling and state cleanup
   */
  simulateTaskFail(task: any, error: Error) {
    this.emit('task:failed', task, error);
  }

  /**
   * Simulate task start
   * Tests initialization of agent state
   */
  simulateTaskStart(task: any) {
    this.emit('task:started', task);
  }

  /**
   * Simulate subtask creation
   * Tests subtask progress tracking
   */
  simulateSubtaskCreated(subtask: any, parentTaskId: string) {
    this.emit('subtask:created', subtask, parentTaskId);
  }

  /**
   * Simulate subtask completion
   * Tests subtask progress updates
   */
  simulateSubtaskCompleted(subtask: any, parentTaskId: string) {
    this.emit('subtask:completed', subtask, parentTaskId);
  }

  /**
   * Simulate subtask failure
   * Tests error handling in subtask context
   */
  simulateSubtaskFailed(subtask: any, parentTaskId: string, error: Error) {
    this.emit('subtask:failed', subtask, parentTaskId, error);
  }

  /**
   * Simulate agent message
   * Tests real-time message streaming
   */
  simulateAgentMessage(taskId: string, message: unknown) {
    this.emit('agent:message', taskId, message);
  }

  /**
   * Simulate tool use
   * Tests tool usage tracking
   */
  simulateToolUse(taskId: string, tool: string, input: unknown) {
    this.emit('agent:tool-use', taskId, tool, input);
  }

  /**
   * Simulate usage update
   * Tests token and cost tracking
   */
  simulateUsageUpdate(taskId: string, usage: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number }) {
    this.emit('usage:updated', taskId, usage);
  }

  /**
   * Simulate task pause
   * Tests pause state handling
   */
  simulateTaskPause(task: any, reason: string) {
    this.emit('task:paused', task, reason);
  }

  /**
   * Simulate PR creation
   * Tests pull request handling
   */
  simulatePRCreated(taskId: string, prUrl: string) {
    this.emit('pr:created', taskId, prUrl);
  }

  /**
   * Simulate PR failure
   * Tests pull request error handling
   */
  simulatePRFailed(taskId: string, error: string) {
    this.emit('pr:failed', taskId, error);
  }

  /**
   * Simulate task decomposition
   * Tests task breakdown into subtasks
   */
  simulateTaskDecomposition(parentTask: any, subtaskIds: string[]) {
    this.emit('task:decomposed', parentTask, subtaskIds);
  }

  /**
   * Helper method to simulate a complete workflow execution
   * Useful for end-to-end integration tests
   */
  async simulateWorkflowExecution(taskId: string, stages: Array<{ name: string; agent: string }>) {
    const task = {
      id: taskId,
      workflow: 'feature',
      status: 'running' as const,
      description: 'Test workflow task',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Start task
    this.simulateTaskStart(task);

    // Execute each stage with a small delay
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const previousAgent = i > 0 ? stages[i - 1].agent : null;

      // Transition to new agent
      this.simulateAgentTransition(taskId, previousAgent, stage.agent);
      this.simulateStageChange(taskId, stage.name, stage.agent);

      // Small delay to simulate stage execution
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Complete task
    this.simulateTaskComplete({ ...task, status: 'completed' });
  }

  /**
   * Helper method to simulate parallel execution scenario
   */
  async simulateParallelExecution(taskId: string, parallelStages: Array<{ name: string; agent: string }>) {
    const stages = parallelStages.map(s => s.name);
    const agents = parallelStages.map(s => s.agent);

    // Start parallel execution
    this.simulateParallelStart(taskId, stages, agents);

    // Small delay to simulate execution
    await new Promise(resolve => setTimeout(resolve, 50));

    // Complete parallel execution
    this.simulateParallelComplete(taskId);
  }

  /**
   * Helper method to clean up all listeners
   * Should be called in test cleanup
   */
  cleanup() {
    this.removeAllListeners();
  }
}

/**
 * Factory function to create a fresh MockOrchestrator instance
 */
export function createMockOrchestrator(): MockOrchestrator {
  return new MockOrchestrator();
}