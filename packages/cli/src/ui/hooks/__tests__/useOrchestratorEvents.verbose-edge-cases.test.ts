/**
 * Edge case tests for useOrchestratorEvents verbose data functionality
 * Tests boundary conditions, error scenarios, and robustness
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOrchestratorEvents } from '../useOrchestratorEvents';
import { MockOrchestrator, createMockOrchestrator } from '../../components/agents/__tests__/test-utils/MockOrchestrator';

describe('useOrchestratorEvents - Verbose Data Edge Cases', () => {
  let mockOrchestrator: MockOrchestrator;
  const testWorkflow = {
    stages: [
      { name: 'planning', agent: 'planner' },
      { name: 'implementation', agent: 'developer' }
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

  describe('Invalid Event Data', () => {
    it('handles usage:updated events with invalid token values', () => {
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

      // Test with negative values
      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: -50,
          outputTokens: -25,
          totalTokens: -75,
          estimatedCost: -0.001
        });
      });

      // Should handle gracefully and not break
      expect(result.current.verboseData?.agentTokens['planner']).toEqual({
        inputTokens: -50,
        outputTokens: -25,
      });

      // Test with very large numbers
      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: Number.MAX_SAFE_INTEGER,
          outputTokens: Number.MAX_SAFE_INTEGER,
          totalTokens: Number.MAX_SAFE_INTEGER,
          estimatedCost: Number.MAX_VALUE
        });
      });

      // Should accumulate even with extreme values
      expect(result.current.verboseData?.agentTokens['planner'].inputTokens).toBe(Number.MAX_SAFE_INTEGER - 50);
    });

    it('handles agent:turn events with invalid turn numbers', () => {
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

      // Test with invalid turn numbers
      act(() => {
        mockOrchestrator.simulateAgentTurn({ taskId: 'test-task', agentName: 'planner', turnNumber: -1 });
      });

      const plannerAgent = result.current.agents.find(agent => agent.name === 'planner');
      expect(plannerAgent?.debugInfo?.turnCount).toBe(-1);

      // Test with zero
      act(() => {
        mockOrchestrator.simulateAgentTurn({ taskId: 'test-task', agentName: 'planner', turnNumber: 0 });
      });

      const updatedAgent = result.current.agents.find(agent => agent.name === 'planner');
      expect(updatedAgent?.debugInfo?.turnCount).toBe(0);
    });

    it('handles tool use events with null or undefined tool names', () => {
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

      // Test with null tool name - direct emit to avoid validation
      act(() => {
        mockOrchestrator.emit('agent:tool-use', 'test-task', null, { input: 'test' });
      });

      // Should not crash
      expect(result.current.verboseData?.agentDebug.toolCallCounts['developer']).toEqual({
        'null': 1
      });

      // Test with undefined tool name
      act(() => {
        mockOrchestrator.emit('agent:tool-use', 'test-task', undefined, { input: 'test' });
      });

      expect(result.current.verboseData?.agentDebug.toolCallCounts['developer']).toEqual({
        'null': 1,
        'undefined': 1
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('handles extremely rapid event sequences', async () => {
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

      // Simulate 1000 rapid events
      act(() => {
        for (let i = 0; i < 1000; i++) {
          mockOrchestrator.simulateUsageUpdate('test-task', {
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            estimatedCost: 0.00001
          });
        }
      });

      // Should handle the accumulation
      expect(result.current.verboseData?.agentTokens['developer']).toEqual({
        inputTokens: 1000,
        outputTokens: 1000,
      });

      // Should calculate metrics without issues
      expect(result.current.verboseData?.metrics.tokensPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('handles memory-intensive tool usage tracking', () => {
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

      // Simulate many different tools
      act(() => {
        for (let i = 0; i < 100; i++) {
          mockOrchestrator.simulateToolUse('test-task', `Tool${i}`, { param: i });
        }
      });

      // Should track all tools correctly
      const toolCounts = result.current.verboseData?.agentDebug.toolCallCounts['developer'];
      expect(Object.keys(toolCounts || {}).length).toBe(100);

      // Each tool should have count of 1
      Object.values(toolCounts || {}).forEach(count => {
        expect(count).toBe(1);
      });
    });

    it('handles concurrent agent transitions and timing calculations', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Rapid agent switches with minimal time
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
        vi.advanceTimersByTime(1);
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
        vi.advanceTimersByTime(1);
        mockOrchestrator.simulateAgentTransition('test-task', 'developer', 'planner');
        vi.advanceTimersByTime(1);
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
      });

      // Should handle rapid transitions without issues
      expect(result.current.currentAgent).toBe('developer');
      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeGreaterThanOrEqual(0);
      expect(result.current.verboseData?.timing.agentResponseTimes['developer']).toBeGreaterThanOrEqual(0);
    });
  });

  describe('State Consistency Edge Cases', () => {
    it('maintains state consistency during stage changes', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Set up initial state
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      const preStageTokens = result.current.verboseData?.agentTokens['planner'];

      // Stage change should reset timing but preserve agent data
      act(() => {
        mockOrchestrator.simulateStageChange({ id: 'test-task' }, 'implementation');
      });

      // Agent tokens should be preserved
      expect(result.current.verboseData?.agentTokens['planner']).toEqual(preStageTokens);

      // Stage start time should be reset
      expect(result.current.verboseData?.timing.stageStartTime).toBeInstanceOf(Date);
    });

    it('handles orphaned agent data after workflow changes', () => {
      const { result, rerender } = renderHook(
        (props) => useOrchestratorEvents(props),
        {
          initialProps: {
            orchestrator: mockOrchestrator,
            workflow: testWorkflow,
            taskId: 'test-task'
          }
        }
      );

      // Set up data with original workflow
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      expect(result.current.verboseData?.agentTokens['planner']).toBeDefined();

      // Change workflow to exclude planner
      const newWorkflow = {
        stages: [
          { name: 'implementation', agent: 'developer' },
          { name: 'testing', agent: 'tester' }
        ]
      };

      rerender({
        orchestrator: mockOrchestrator,
        workflow: newWorkflow,
        taskId: 'test-task'
      });

      // Existing verbose data should still be accessible
      expect(result.current.verboseData?.agentTokens['planner']).toBeDefined();

      // New agents should be available
      expect(result.current.agents.find(a => a.name === 'developer')).toBeDefined();
      expect(result.current.agents.find(a => a.name === 'tester')).toBeDefined();
    });
  });

  describe('Event Ordering Edge Cases', () => {
    it('handles out-of-order events correctly', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Send usage update before agent transition
      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      // Should not crash and tokens should not be applied yet
      expect(result.current.verboseData?.agentTokens).toEqual({});

      // Now set agent
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      // Previous usage should not be retroactively applied
      expect(result.current.verboseData?.agentTokens['planner']).toBeUndefined();

      // New usage should work
      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
          estimatedCost: 0.002
        });
      });

      expect(result.current.verboseData?.agentTokens['planner']).toEqual({
        inputTokens: 200,
        outputTokens: 100,
      });
    });

    it('handles tool events before agent transition', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Send tool use before agent transition
      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: 'test.js' });
      });

      // Should not crash and tool usage should not be recorded
      expect(result.current.verboseData?.agentDebug.toolCallCounts).toEqual({});

      // Set agent
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'developer');
      });

      // Tool usage from before agent set should not be retroactive
      expect(result.current.verboseData?.agentDebug.toolCallCounts['developer']).toBeUndefined();

      // New tool usage should work
      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Write', { content: 'code' });
      });

      expect(result.current.verboseData?.agentDebug.toolCallCounts['developer']).toEqual({
        Write: 1
      });
    });
  });

  describe('Boundary Value Tests', () => {
    it('handles zero values in usage data', () => {
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
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0
        });
      });

      expect(result.current.verboseData?.agentTokens['planner']).toEqual({
        inputTokens: 0,
        outputTokens: 0,
      });

      // Metrics calculation with zero values
      expect(result.current.verboseData?.metrics.tokensPerSecond).toBe(0);
    });

    it('handles timing calculations with zero elapsed time', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Immediate transition with no time advancement
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
      });

      // Should handle zero or minimal timing
      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeGreaterThanOrEqual(0);
      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeLessThan(10);
    });

    it('handles empty or whitespace tool names', () => {
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
        mockOrchestrator.simulateToolUse('test-task', '', { input: 'test' });
        mockOrchestrator.simulateToolUse('test-task', '   ', { input: 'test' });
        mockOrchestrator.simulateToolUse('test-task', '\\t\\n', { input: 'test' });
      });

      // Should track even unusual tool names
      expect(result.current.verboseData?.agentDebug.toolCallCounts['developer']).toEqual({
        '': 1,
        '   ': 1,
        '\\t\\n': 1
      });
    });
  });
});