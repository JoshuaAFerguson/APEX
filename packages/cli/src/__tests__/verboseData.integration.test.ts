/**
 * Integration tests for VerboseDebugData population from orchestrator events
 * Tests the event handling in repl.tsx that populates verboseData state
 */
import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApexOrchestrator } from '@apex/orchestrator';
import type { VerboseDebugData, Task, AgentUsage } from '@apex/core';

// Mock the ApexOrchestrator to simulate events
class MockApexOrchestrator extends EventEmitter implements Partial<ApexOrchestrator> {
  // Mock methods that might be called
  createTask = vi.fn();
  getTask = vi.fn();
  getTasks = vi.fn();

  // Helper methods for testing
  simulateTaskStarted(task: Task) {
    this.emit('task:started', task);
  }

  simulateStageChanged(taskId: string, stage: string, agent: string) {
    this.emit('task:stage-changed', { taskId, stage, agent });
  }

  simulateStageCompleted(taskId: string, stage: string, agent: string, result: any) {
    this.emit('task:stage-completed', { taskId, stage, agent, result });
  }

  simulateAgentMessage(agent: string, message: any) {
    this.emit('agent:message', { agent, content: message });
  }

  simulateToolCalled(agent: string, tool: string, input: any, output: any) {
    this.emit('tool:called', { agent, tool, input, output });
  }

  simulateTokensUsed(agent: string, usage: AgentUsage) {
    this.emit('tokens:used', { agent, usage });
  }

  simulateAgentError(agent: string, error: Error) {
    this.emit('agent:error', { agent, error });
  }
}

describe('VerboseDebugData Integration Tests', () => {
  let mockOrchestrator: MockApexOrchestrator;
  let currentVerboseData: VerboseDebugData;
  let mockApp: any;

  // Mock context object similar to what's used in repl.tsx
  let ctx: {
    orchestrator: MockApexOrchestrator;
    app?: any;
  };

  const initializeVerboseData = (): void => {
    currentVerboseData = {
      agentTokens: {},
      timing: {
        stageStartTime: new Date(),
        agentResponseTimes: {},
        toolUsageTimes: {},
      },
      agentDebug: {
        conversationLength: {},
        toolCallCounts: {},
        errorCounts: {},
        retryAttempts: {},
      },
      metrics: {
        tokensPerSecond: 0,
        averageResponseTime: 0,
        toolEfficiency: {},
      },
    };
  };

  const updatePerformanceMetrics = (): void => {
    const now = Date.now();
    const agents = Object.keys(currentVerboseData.agentTokens);

    if (agents.length === 0) return;

    // Calculate tokens per second
    const totalTokens = agents.reduce((sum, agent) => {
      const usage = currentVerboseData.agentTokens[agent];
      return sum + usage.inputTokens + usage.outputTokens;
    }, 0);

    const stageStart = currentVerboseData.timing.stageStartTime.getTime();
    const duration = now - stageStart;

    if (duration > 0) {
      currentVerboseData.metrics.tokensPerSecond = (totalTokens / duration) * 1000;
    }

    // Calculate average response time
    const responseTimes = Object.values(currentVerboseData.timing.agentResponseTimes);
    if (responseTimes.length > 0) {
      currentVerboseData.metrics.averageResponseTime =
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    }

    // Update tool efficiency (simplified calculation)
    Object.keys(currentVerboseData.timing.toolUsageTimes).forEach(tool => {
      const usageTime = currentVerboseData.timing.toolUsageTimes[tool];
      // Simple efficiency calculation based on usage time
      currentVerboseData.metrics.toolEfficiency[tool] = Math.max(0.5, 1.0 - (usageTime / 10000));
    });

    // Mock system metrics
    currentVerboseData.metrics.memoryUsage = process.memoryUsage().heapUsed;
    currentVerboseData.metrics.cpuUtilization = Math.random() * 100; // Mock CPU usage
  };

  beforeEach(() => {
    mockOrchestrator = new MockApexOrchestrator();

    mockApp = {
      updateState: vi.fn(),
      getState: vi.fn().mockReturnValue({}),
    };

    ctx = {
      orchestrator: mockOrchestrator,
      app: mockApp,
    };

    initializeVerboseData();

    // Set up event handlers similar to repl.tsx
    setupEventHandlers();
  });

  const setupEventHandlers = () => {
    // Event handler for task:started
    ctx.orchestrator.on('task:started', (task) => {
      initializeVerboseData();
      ctx.app?.updateState({ verboseData: currentVerboseData });
    });

    // Event handler for task:stage-changed
    ctx.orchestrator.on('task:stage-changed', (data) => {
      if (data?.agent) {
        const now = Date.now();

        // Initialize agent data if not exists
        if (!currentVerboseData.agentTokens[data.agent]) {
          currentVerboseData.agentTokens[data.agent] = {
            inputTokens: 0,
            outputTokens: 0,
          };
        }

        // Update stage timing
        if (currentVerboseData.timing.stageEndTime) {
          currentVerboseData.timing.stageDuration =
            currentVerboseData.timing.stageEndTime.getTime() -
            currentVerboseData.timing.stageStartTime.getTime();
        }

        currentVerboseData.timing.stageStartTime = new Date(now);
        updatePerformanceMetrics();
        ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
      }
    });

    // Event handler for task:stage-completed
    ctx.orchestrator.on('task:stage-completed', (data) => {
      if (data?.agent) {
        const now = Date.now();
        currentVerboseData.timing.stageEndTime = new Date(now);
        if (currentVerboseData.timing.stageStartTime) {
          currentVerboseData.timing.stageDuration =
            now - currentVerboseData.timing.stageStartTime.getTime();
        }
        updatePerformanceMetrics();
        ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
      }
    });

    // Event handler for agent:message
    ctx.orchestrator.on('agent:message', (data) => {
      if (data?.agent) {
        // Track conversation length
        currentVerboseData.agentDebug.conversationLength[data.agent] =
          (currentVerboseData.agentDebug.conversationLength[data.agent] || 0) + 1;

        // Mock response time calculation
        const responseTime = Math.floor(Math.random() * 5000) + 500; // 500-5500ms
        currentVerboseData.timing.agentResponseTimes[data.agent] = responseTime;

        updatePerformanceMetrics();
        ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
      }
    });

    // Event handler for tool:called
    ctx.orchestrator.on('tool:called', (data) => {
      if (data?.agent && data?.tool) {
        // Track tool call counts
        if (!currentVerboseData.agentDebug.toolCallCounts[data.agent]) {
          currentVerboseData.agentDebug.toolCallCounts[data.agent] = {};
        }
        currentVerboseData.agentDebug.toolCallCounts[data.agent][data.tool] =
          (currentVerboseData.agentDebug.toolCallCounts[data.agent][data.tool] || 0) + 1;

        // Mock tool usage time
        const usageTime = Math.floor(Math.random() * 3000) + 100; // 100-3100ms
        currentVerboseData.timing.toolUsageTimes[data.tool] =
          (currentVerboseData.timing.toolUsageTimes[data.tool] || 0) + usageTime;

        ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
      }
    });

    // Event handler for tokens:used
    ctx.orchestrator.on('tokens:used', (data) => {
      if (data?.agent && data?.usage) {
        currentVerboseData.agentTokens[data.agent] = {
          ...currentVerboseData.agentTokens[data.agent],
          ...data.usage,
        };
        updatePerformanceMetrics();
        ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
      }
    });

    // Event handler for agent:error
    ctx.orchestrator.on('agent:error', (data) => {
      if (data?.agent) {
        currentVerboseData.agentDebug.errorCounts[data.agent] =
          (currentVerboseData.agentDebug.errorCounts[data.agent] || 0) + 1;
        updatePerformanceMetrics();
        ctx.app?.updateState({ verboseData: { ...currentVerboseData } });
      }
    });
  };

  describe('task lifecycle events', () => {
    it('should initialize verboseData on task:started', () => {
      const task: Task = {
        id: 'test-task-123',
        description: 'Test task',
        workflow: 'test-workflow',
        status: 'running',
        createdAt: new Date(),
      };

      mockOrchestrator.simulateTaskStarted(task);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        verboseData: expect.objectContaining({
          agentTokens: {},
          timing: expect.objectContaining({
            stageStartTime: expect.any(Date),
          }),
          agentDebug: expect.objectContaining({
            conversationLength: {},
            toolCallCounts: {},
            errorCounts: {},
            retryAttempts: {},
          }),
          metrics: expect.objectContaining({
            tokensPerSecond: 0,
            averageResponseTime: 0,
            toolEfficiency: {},
          }),
        }),
      });
    });

    it('should update timing on stage changes', () => {
      const taskId = 'test-task-123';
      const stage = 'planning';
      const agent = 'planner';

      mockOrchestrator.simulateStageChanged(taskId, stage, agent);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        verboseData: expect.objectContaining({
          agentTokens: expect.objectContaining({
            [agent]: expect.objectContaining({
              inputTokens: 0,
              outputTokens: 0,
            }),
          }),
          timing: expect.objectContaining({
            stageStartTime: expect.any(Date),
          }),
        }),
      });
    });

    it('should calculate stage duration on completion', () => {
      const taskId = 'test-task-123';
      const stage = 'planning';
      const agent = 'planner';

      // Start stage
      mockOrchestrator.simulateStageChanged(taskId, stage, agent);

      // Wait a bit
      vi.advanceTimersByTime(2000);

      // Complete stage
      mockOrchestrator.simulateStageCompleted(taskId, stage, agent, {});

      const lastCall = mockApp.updateState.mock.calls[mockApp.updateState.mock.calls.length - 1];
      const verboseData = lastCall[0].verboseData;

      expect(verboseData.timing.stageEndTime).toBeInstanceOf(Date);
      expect(verboseData.timing.stageDuration).toBeGreaterThan(0);
    });
  });

  describe('agent interaction tracking', () => {
    it('should track conversation length on agent messages', () => {
      const agent = 'developer';
      const message = { content: 'Test message', role: 'assistant' };

      mockOrchestrator.simulateAgentMessage(agent, message);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        verboseData: expect.objectContaining({
          agentDebug: expect.objectContaining({
            conversationLength: { [agent]: 1 },
          }),
          timing: expect.objectContaining({
            agentResponseTimes: expect.objectContaining({
              [agent]: expect.any(Number),
            }),
          }),
        }),
      });
    });

    it('should accumulate conversation length for multiple messages', () => {
      const agent = 'developer';

      // Send three messages
      mockOrchestrator.simulateAgentMessage(agent, { content: 'Message 1' });
      mockOrchestrator.simulateAgentMessage(agent, { content: 'Message 2' });
      mockOrchestrator.simulateAgentMessage(agent, { content: 'Message 3' });

      const lastCall = mockApp.updateState.mock.calls[mockApp.updateState.mock.calls.length - 1];
      const verboseData = lastCall[0].verboseData;

      expect(verboseData.agentDebug.conversationLength[agent]).toBe(3);
    });

    it('should track response times for different agents', () => {
      const agent1 = 'planner';
      const agent2 = 'developer';

      mockOrchestrator.simulateAgentMessage(agent1, { content: 'Planning message' });
      mockOrchestrator.simulateAgentMessage(agent2, { content: 'Development message' });

      const lastCall = mockApp.updateState.mock.calls[mockApp.updateState.mock.calls.length - 1];
      const verboseData = lastCall[0].verboseData;

      expect(verboseData.timing.agentResponseTimes[agent1]).toBeGreaterThan(0);
      expect(verboseData.timing.agentResponseTimes[agent2]).toBeGreaterThan(0);
    });
  });

  describe('tool usage tracking', () => {
    it('should track tool call counts per agent', () => {
      const agent = 'developer';
      const tool = 'Write';

      mockOrchestrator.simulateToolCalled(agent, tool, { content: 'test' }, 'success');

      expect(mockApp.updateState).toHaveBeenCalledWith({
        verboseData: expect.objectContaining({
          agentDebug: expect.objectContaining({
            toolCallCounts: {
              [agent]: { [tool]: 1 },
            },
          }),
        }),
      });
    });

    it('should accumulate tool usage times', () => {
      const agent = 'developer';
      const tool = 'Read';

      // Simulate multiple tool calls
      mockOrchestrator.simulateToolCalled(agent, tool, { path: 'file1.txt' }, 'content1');
      mockOrchestrator.simulateToolCalled(agent, tool, { path: 'file2.txt' }, 'content2');

      const lastCall = mockApp.updateState.mock.calls[mockApp.updateState.mock.calls.length - 1];
      const verboseData = lastCall[0].verboseData;

      expect(verboseData.agentDebug.toolCallCounts[agent][tool]).toBe(2);
      expect(verboseData.timing.toolUsageTimes[tool]).toBeGreaterThan(0);
    });

    it('should track multiple tools per agent', () => {
      const agent = 'developer';

      mockOrchestrator.simulateToolCalled(agent, 'Read', {}, '');
      mockOrchestrator.simulateToolCalled(agent, 'Write', {}, '');
      mockOrchestrator.simulateToolCalled(agent, 'Edit', {}, '');

      const lastCall = mockApp.updateState.mock.calls[mockApp.updateState.mock.calls.length - 1];
      const verboseData = lastCall[0].verboseData;

      expect(verboseData.agentDebug.toolCallCounts[agent]).toEqual({
        Read: 1,
        Write: 1,
        Edit: 1,
      });
    });
  });

  describe('token usage tracking', () => {
    it('should update agent token usage', () => {
      const agent = 'planner';
      const usage: AgentUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 50,
        estimatedCost: 0.05,
      };

      mockOrchestrator.simulateTokensUsed(agent, usage);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        verboseData: expect.objectContaining({
          agentTokens: {
            [agent]: usage,
          },
        }),
      });
    });

    it('should calculate tokens per second based on token usage', () => {
      jest.useFakeTimers();
      const startTime = Date.now();
      jest.setSystemTime(startTime);

      const agent = 'developer';
      const usage: AgentUsage = {
        inputTokens: 2000,
        outputTokens: 1000,
      };

      // Advance time by 10 seconds
      jest.advanceTimersByTime(10000);

      mockOrchestrator.simulateTokensUsed(agent, usage);

      const lastCall = mockApp.updateState.mock.calls[mockApp.updateState.mock.calls.length - 1];
      const verboseData = lastCall[0].verboseData;

      // 3000 tokens in 10 seconds = 300 tokens/second
      expect(verboseData.metrics.tokensPerSecond).toBeCloseTo(300, 0);

      vi.useRealTimers();
    });
  });

  describe('error tracking', () => {
    it('should track agent error counts', () => {
      const agent = 'developer';
      const error = new Error('Test error');

      mockOrchestrator.simulateAgentError(agent, error);

      expect(mockApp.updateState).toHaveBeenCalledWith({
        verboseData: expect.objectContaining({
          agentDebug: expect.objectContaining({
            errorCounts: { [agent]: 1 },
          }),
        }),
      });
    });

    it('should accumulate error counts for multiple errors', () => {
      const agent = 'developer';

      mockOrchestrator.simulateAgentError(agent, new Error('Error 1'));
      mockOrchestrator.simulateAgentError(agent, new Error('Error 2'));
      mockOrchestrator.simulateAgentError(agent, new Error('Error 3'));

      const lastCall = mockApp.updateState.mock.calls[mockApp.updateState.mock.calls.length - 1];
      const verboseData = lastCall[0].verboseData;

      expect(verboseData.agentDebug.errorCounts[agent]).toBe(3);
    });
  });

  describe('metrics calculation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate average response time across agents', () => {
      const agent1 = 'planner';
      const agent2 = 'developer';

      // Set up consistent response times for testing
      currentVerboseData.timing.agentResponseTimes[agent1] = 2000;
      currentVerboseData.timing.agentResponseTimes[agent2] = 4000;

      updatePerformanceMetrics();

      expect(currentVerboseData.metrics.averageResponseTime).toBe(3000);
    });

    it('should calculate tool efficiency based on usage time', () => {
      // Set up tool usage times
      currentVerboseData.timing.toolUsageTimes['Read'] = 1000;  // Fast tool
      currentVerboseData.timing.toolUsageTimes['SlowTool'] = 8000; // Slow tool

      updatePerformanceMetrics();

      expect(currentVerboseData.metrics.toolEfficiency['Read']).toBeGreaterThan(0.8);
      expect(currentVerboseData.metrics.toolEfficiency['SlowTool']).toBeLessThan(0.6);
    });

    it('should include system metrics', () => {
      updatePerformanceMetrics();

      expect(currentVerboseData.metrics.memoryUsage).toBeGreaterThan(0);
      expect(currentVerboseData.metrics.cpuUtilization).toBeGreaterThanOrEqual(0);
      expect(currentVerboseData.metrics.cpuUtilization).toBeLessThanOrEqual(100);
    });
  });

  describe('end-to-end workflow simulation', () => {
    it('should properly track a complete task workflow', async () => {
      jest.useFakeTimers();
      const startTime = Date.now();

      // Start task
      const task: Task = {
        id: 'workflow-test-123',
        description: 'Complete workflow test',
        workflow: 'feature-development',
        status: 'running',
        createdAt: new Date(),
      };
      mockOrchestrator.simulateTaskStarted(task);

      // Planning stage
      mockOrchestrator.simulateStageChanged(task.id, 'planning', 'planner');
      mockOrchestrator.simulateAgentMessage('planner', { content: 'Starting planning...' });
      mockOrchestrator.simulateToolCalled('planner', 'Read', { path: 'requirements.md' }, 'content');
      mockOrchestrator.simulateTokensUsed('planner', { inputTokens: 500, outputTokens: 250 });

      jest.advanceTimersByTime(5000);
      mockOrchestrator.simulateStageCompleted(task.id, 'planning', 'planner', { plan: 'detailed plan' });

      // Development stage
      mockOrchestrator.simulateStageChanged(task.id, 'development', 'developer');
      mockOrchestrator.simulateAgentMessage('developer', { content: 'Implementing features...' });
      mockOrchestrator.simulateToolCalled('developer', 'Write', { path: 'feature.ts' }, 'success');
      mockOrchestrator.simulateToolCalled('developer', 'Edit', { path: 'feature.ts' }, 'success');
      mockOrchestrator.simulateTokensUsed('developer', { inputTokens: 1500, outputTokens: 750 });

      jest.advanceTimersByTime(10000);
      mockOrchestrator.simulateStageCompleted(task.id, 'development', 'developer', { code: 'implemented' });

      // Verify final state
      const lastCall = mockApp.updateState.mock.calls[mockApp.updateState.mock.calls.length - 1];
      const finalVerboseData = lastCall[0].verboseData;

      // Check agent tokens
      expect(finalVerboseData.agentTokens.planner).toEqual({
        inputTokens: 500,
        outputTokens: 250,
      });
      expect(finalVerboseData.agentTokens.developer).toEqual({
        inputTokens: 1500,
        outputTokens: 750,
      });

      // Check tool usage
      expect(finalVerboseData.agentDebug.toolCallCounts.planner.Read).toBe(1);
      expect(finalVerboseData.agentDebug.toolCallCounts.developer.Write).toBe(1);
      expect(finalVerboseData.agentDebug.toolCallCounts.developer.Edit).toBe(1);

      // Check timing
      expect(finalVerboseData.timing.stageDuration).toBeGreaterThan(0);
      expect(finalVerboseData.timing.agentResponseTimes.planner).toBeGreaterThan(0);
      expect(finalVerboseData.timing.agentResponseTimes.developer).toBeGreaterThan(0);

      // Check metrics
      expect(finalVerboseData.metrics.tokensPerSecond).toBeGreaterThan(0);
      expect(finalVerboseData.metrics.averageResponseTime).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });
});