/**
 * MockOrchestrator test utility for AgentPanel integration tests
 * Extends EventEmitter to simulate orchestrator events matching the real orchestrator's patterns
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';
import type {
  OrchestratorEvents,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData
} from '@apexcli/orchestrator';

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

  // Additional properties for budget status testing
  private _connectionState: 'connecting' | 'connected' | 'disconnected' | 'error' = 'connected';
  private _error: Error | null = null;
  private _refreshError: Error | null = null;
  private _refreshDelay: number = 0;
  public refreshCalled: boolean = false;

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
   * Simulate progress updates for multiple parallel agents
   */
  simulateParallelProgress(
    taskId: string,
    agentProgressMap: Record<string, number>
  ): void {
    Object.entries(agentProgressMap).forEach(([agent, progress]) => {
      this.emit('agent:progress', taskId, agent, progress);
    });
  }

  /**
   * Simulate malformed event for error testing
   */
  simulateMalformedEvent(eventType: string): void {
    switch (eventType) {
      case 'parallel-started':
        this.emit('stage:parallel-started', 'task-1', null, undefined);
        break;
      case 'parallel-completed':
        this.emit('stage:parallel-completed', undefined);
        break;
      case 'agent-transition':
        this.emit('agent:transition', null, '', '');
        break;
      default:
        this.emit(eventType, null, undefined);
    }
  }

  /**
   * Simulate rapid event sequence for performance testing
   */
  async simulateRapidEvents(
    eventCount: number,
    intervalMs: number = 10
  ): Promise<void> {
    for (let i = 0; i < eventCount; i++) {
      this.emit('stage:parallel-started', `task-${i}`, [`stage-${i}`], [`agent-${i}`]);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      this.emit('stage:parallel-completed', `task-${i}`);
    }
  }

  /**
   * Simulate complete parallel workflow with all events
   */
  async simulateFullParallelWorkflow(
    taskId: string,
    stages: Array<{ name: string; agent: string; progress?: number }>
  ): Promise<void> {
    // Start task
    this.simulateTaskStart({ id: taskId, workflow: 'feature', status: 'running' });

    // Sequential pre-parallel stages
    this.simulateAgentTransition(taskId, null, 'planner');
    this.simulateStageChange(taskId, 'planning', 'planner');

    await new Promise(resolve => setTimeout(resolve, 10));

    // Parallel execution
    const stageNames = stages.map(s => s.name);
    const agentNames = stages.map(s => s.agent);
    this.simulateParallelStart(taskId, stageNames, agentNames);

    // Simulate progress updates
    for (const stage of stages) {
      if (stage.progress !== undefined) {
        this.emit('agent:progress', taskId, stage.agent, stage.progress);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 20));

    // Complete parallel
    this.simulateParallelComplete(taskId);

    // Complete task
    this.simulateTaskComplete({ id: taskId, status: 'completed' });
  }

  /**
   * Simulate agent progress update
   */
  simulateAgentProgress(taskId: string, agentName: string, progress: number): void {
    this.emit('agent:progress', taskId, agentName, progress);
  }

  /**
   * Simulate multiple task isolation scenario
   */
  simulateMultiTaskEvents(
    tasks: Array<{ id: string; events: Array<{ type: string; args: any[] }> }>
  ): void {
    tasks.forEach(task => {
      task.events.forEach(event => {
        this.emit(event.type, task.id, ...event.args);
      });
    });
  }

  /**
   * Simulate agent turn event
   * Tests turn count tracking in verbose data
   */
  simulateAgentTurn(event: { taskId: string; agentName: string; turnNumber: number }) {
    this.emit('agent:turn', event);
  }

  /**
   * Simulate permission request event
   * Tests permission flow initiation
   */
  simulatePermissionRequest(eventData: Partial<PermissionRequestEventData> = {}) {
    const defaultData: PermissionRequestEventData = {
      requestId: 'mock-request-' + Math.random().toString(36).substr(2, 9),
      tool: 'Write',
      scope: '/test/path',
      description: 'Mock permission request for testing',
      isDangerous: false,
      agent: 'developer',
      timestamp: new Date(),
      ...eventData
    };

    this.emit('permission:request', defaultData);
    return defaultData;
  }

  /**
   * Simulate permission granted event
   * Tests successful permission grant handling
   */
  simulatePermissionGranted(eventData: Partial<PermissionGrantedEventData> = {}) {
    const defaultData: PermissionGrantedEventData = {
      requestId: 'mock-request-' + Math.random().toString(36).substr(2, 9),
      tool: 'Write',
      scope: '/test/path',
      level: 'allow-once',
      grantedBy: 'user',
      timestamp: new Date(),
      reason: 'Test permission grant',
      ...eventData
    };

    this.emit('permission:granted', defaultData);
    return defaultData;
  }

  /**
   * Simulate permission denied event
   * Tests permission denial handling
   */
  simulatePermissionDenied(eventData: Partial<PermissionDeniedEventData> = {}) {
    const defaultData: PermissionDeniedEventData = {
      requestId: 'mock-request-' + Math.random().toString(36).substr(2, 9),
      tool: 'Write',
      scope: '/test/path',
      deniedBy: 'user',
      timestamp: new Date(),
      reason: 'Test permission denial',
      ...eventData
    };

    this.emit('permission:denied', defaultData);
    return defaultData;
  }

  /**
   * Simulate dangerous operation detected event
   * Tests dangerous operation detection and warning
   */
  simulateDangerousOperationDetected(eventData: Partial<DangerousOperationDetectedEventData> = {}) {
    const defaultData: DangerousOperationDetectedEventData = {
      operationId: 'mock-op-' + Math.random().toString(36).substr(2, 9),
      tool: 'Bash',
      operation: 'rm -rf /',
      riskLevel: 'critical',
      riskDescription: 'This operation could delete system files',
      agent: 'developer',
      timestamp: new Date(),
      context: { command: 'rm -rf /', workingDir: '/' },
      ...eventData
    };

    this.emit('dangerous:detected', defaultData);
    return defaultData;
  }

  /**
   * Simulate dangerous operation confirmed event
   * Tests user confirmation of dangerous operations
   */
  simulateDangerousOperationConfirmed(eventData: Partial<DangerousOperationConfirmedEventData> = {}) {
    const defaultData: DangerousOperationConfirmedEventData = {
      operationId: 'mock-op-' + Math.random().toString(36).substr(2, 9),
      tool: 'Bash',
      operation: 'rm -rf /',
      confirmedBy: 'user',
      timestamp: new Date(),
      reason: 'User confirmed dangerous operation',
      ...eventData
    };

    this.emit('dangerous:confirmed', defaultData);
    return defaultData;
  }

  /**
   * Simulate dangerous operation blocked event
   * Tests blocking of dangerous operations for safety
   */
  simulateDangerousOperationBlocked(eventData: Partial<DangerousOperationBlockedEventData> = {}) {
    const defaultData: DangerousOperationBlockedEventData = {
      operationId: 'mock-op-' + Math.random().toString(36).substr(2, 9),
      tool: 'Bash',
      operation: 'rm -rf /',
      blockedBy: 'security-policy',
      timestamp: new Date(),
      reason: 'Operation blocked due to security policy',
      ...eventData
    };

    this.emit('dangerous:blocked', defaultData);
    return defaultData;
  }

  /**
   * Set the mock connection state for budget status testing
   */
  setConnectionState(state: 'connecting' | 'connected' | 'disconnected' | 'error') {
    this._connectionState = state;
    this.emit('connection:state-changed', state);
  }

  /**
   * Get the current connection state
   */
  getConnectionState() {
    return this._connectionState;
  }

  /**
   * Simulate an error for budget status testing
   */
  simulateError(error: Error) {
    this._error = error;
    this.emit('error', error);
  }

  /**
   * Clear the error state
   */
  clearError() {
    this._error = null;
  }

  /**
   * Get the current error
   */
  getCurrentError() {
    return this._error;
  }

  /**
   * Set an error to be thrown during refresh operations
   */
  setRefreshError(error: Error) {
    this._refreshError = error;
  }

  /**
   * Set a delay for refresh operations (in milliseconds)
   */
  setRefreshDelay(delay: number) {
    this._refreshDelay = delay;
  }

  /**
   * Mock refresh method that tracks calls and handles errors/delays
   */
  refresh = vi.fn().mockImplementation(async () => {
    this.refreshCalled = true;

    if (this._refreshError) {
      throw this._refreshError;
    }

    if (this._refreshDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this._refreshDelay));
    }

    return Promise.resolve();
  });

  /**
   * Override listenerCount to support budget status testing
   */
  get listenerCount() {
    return (event?: string) => {
      if (event) {
        return super.listenerCount(event);
      }
      return this.eventNames().reduce((count, eventName) => {
        return count + super.listenerCount(eventName);
      }, 0);
    };
  }

  /**
   * Helper method to clean up all listeners
   * Should be called in test cleanup
   */
  cleanup() {
    this.removeAllListeners();
    this._connectionState = 'connected';
    this._error = null;
    this._refreshError = null;
    this._refreshDelay = 0;
    this.refreshCalled = false;
  }
}

/**
 * Factory function to create a fresh MockOrchestrator instance
 */
export function createMockOrchestrator(): MockOrchestrator {
  return new MockOrchestrator();
}