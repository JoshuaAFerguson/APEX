import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOrchestratorEvents } from '../useOrchestratorEvents';
import { MockOrchestrator, createMockOrchestrator } from '../../components/agents/__tests__/test-utils/MockOrchestrator';

describe('useOrchestratorEvents - Verbose Data Population', () => {
  let mockOrchestrator: MockOrchestrator;
  const testWorkflow = {
    stages: [
      { name: 'planning', agent: 'planner' },
      { name: 'implementation', agent: 'developer' },
      { name: 'testing', agent: 'tester' }
    ]
  };

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockOrchestrator.cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('VerboseDebugData State Management', () => {
    it('initializes verboseData with default structure', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      expect(result.current.verboseData).toBeDefined();
      expect(result.current.verboseData).toMatchObject({
        agentTokens: {},
        timing: {
          stageStartTime: expect.any(Date),
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
      });
    });
  });

  describe('Token Tracking from usage:updated Events', () => {
    it('accumulates tokens per agent from usage:updated events', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Simulate agent transition to set current agent
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      // Simulate usage update
      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      expect(result.current.verboseData?.agentTokens['planner']).toEqual({
        inputTokens: 100,
        outputTokens: 50,
      });

      // Second usage update should accumulate
      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 80,
          outputTokens: 40,
          totalTokens: 120,
          estimatedCost: 0.001
        });
      });

      expect(result.current.verboseData?.agentTokens['planner']).toEqual({
        inputTokens: 180,
        outputTokens: 90,
      });
    });

    it('calculates tokens per second metric', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      // Advance time by 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      expect(result.current.verboseData?.metrics.tokensPerSecond).toBeCloseTo(75, 0); // 150 tokens / 2 seconds
    });

    it('updates agent debugInfo with token usage', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      const plannerAgent = result.current.agents.find(agent => agent.name === 'planner');
      expect(plannerAgent?.debugInfo?.tokensUsed).toEqual({
        input: 100,
        output: 50,
      });
    });
  });

  describe('Tool Tracking from agent:tool-use Events', () => {
    it('tracks tool call counts per agent', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'developer');
      });

      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: 'test.js' });
      });

      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Write', { content: 'test' });
      });

      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: 'other.js' });
      });

      expect(result.current.verboseData?.agentDebug.toolCallCounts['developer']).toEqual({
        Read: 2,
        Write: 1,
      });
    });

    it('updates lastToolCall in agent debugInfo', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'developer');
      });

      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Bash', { command: 'ls' });
      });

      const developerAgent = result.current.agents.find(agent => agent.name === 'developer');
      expect(developerAgent?.debugInfo?.lastToolCall).toBe('Bash');
    });

    it('tracks tool usage times', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'developer');
      });

      // Start tool use
      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: 'test.js' });
      });

      // Advance time
      act(() => {
        vi.advanceTimersByTime(1000); // 1 second
      });

      // End tool use (simulate another call to the same tool)
      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: 'test2.js' });
      });

      expect(result.current.verboseData?.timing.toolUsageTimes['Read']).toBeGreaterThan(900);
      expect(result.current.verboseData?.timing.toolUsageTimes['Read']).toBeLessThan(1100);
    });
  });

  describe('Agent Timing from agent:transition Events', () => {
    it('calculates agent response times', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Start with planner
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      // Advance time
      act(() => {
        vi.advanceTimersByTime(5000); // 5 seconds
      });

      // Transition to developer
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
      });

      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeGreaterThan(4900);
      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeLessThan(5100);
    });

    it('sets stageStartedAt for new agent', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      const startTime = new Date();

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      const plannerAgent = result.current.agents.find(agent => agent.name === 'planner');
      expect(plannerAgent?.debugInfo?.stageStartedAt).toBeInstanceOf(Date);
      expect(plannerAgent?.debugInfo?.stageStartedAt?.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
    });

    it('accumulates response times for multiple agent activations', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // First activation of planner
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Second activation of planner
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'developer', 'planner');
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'tester');
      });

      // Should accumulate both response times
      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeGreaterThan(4900);
      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeLessThan(5100);
    });
  });

  describe('Stage Change Timing Reset', () => {
    it('resets timing context on stage change', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      const initialStageTime = result.current.verboseData?.timing.stageStartTime;

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      act(() => {
        mockOrchestrator.simulateStageChange({ id: 'test-task' }, 'implementation');
      });

      expect(result.current.verboseData?.timing.stageStartTime.getTime()).toBeGreaterThan(
        initialStageTime!.getTime()
      );
    });
  });

  describe('Agent Turn Tracking', () => {
    it('updates turn count from agent:turn events', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTurn({ taskId: 'test-task', agentName: 'planner', turnNumber: 1 });
      });

      const plannerAgent = result.current.agents.find(agent => agent.name === 'planner');
      expect(plannerAgent?.debugInfo?.turnCount).toBe(1);

      act(() => {
        mockOrchestrator.simulateAgentTurn({ taskId: 'test-task', agentName: 'planner', turnNumber: 2 });
      });

      const updatedPlannerAgent = result.current.agents.find(agent => agent.name === 'planner');
      expect(updatedPlannerAgent?.debugInfo?.turnCount).toBe(2);
    });
  });

  describe('Cross-agent Event Flow', () => {
    it('tracks data across multiple agents correctly', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Planner phase
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: 'plan.md' });
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Developer phase
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
      });

      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
          estimatedCost: 0.002
        });
      });

      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Write', { content: 'code' });
      });

      // Verify planner data is preserved
      expect(result.current.verboseData?.agentTokens['planner']).toEqual({
        inputTokens: 100,
        outputTokens: 50,
      });

      // Verify developer data is tracked
      expect(result.current.verboseData?.agentTokens['developer']).toEqual({
        inputTokens: 200,
        outputTokens: 100,
      });

      // Verify tool counts are tracked per agent
      expect(result.current.verboseData?.agentDebug.toolCallCounts['planner']).toEqual({
        Read: 1,
      });

      expect(result.current.verboseData?.agentDebug.toolCallCounts['developer']).toEqual({
        Write: 1,
      });

      // Verify response time was calculated for planner
      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeGreaterThan(2900);
    });
  });
});