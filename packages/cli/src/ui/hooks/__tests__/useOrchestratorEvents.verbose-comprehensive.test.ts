/**
 * Comprehensive tests for useOrchestratorEvents verbose data population
 * Focuses on the specific acceptance criteria for v0.3.0 implementation
 *
 * Tests verify that:
 * - Hook populates agentTokens from usage:updated events
 * - agentTimings from agent:transition timestamps
 * - turnCount and lastToolCall from agent events
 * - VerboseDebugData state updated reactively
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOrchestratorEvents } from '../useOrchestratorEvents';
import { MockOrchestrator, createMockOrchestrator } from '../../components/agents/__tests__/test-utils/MockOrchestrator';

describe('useOrchestratorEvents - Verbose Data Comprehensive Tests', () => {
  let mockOrchestrator: MockOrchestrator;
  const testWorkflow = {
    stages: [
      { name: 'planning', agent: 'planner' },
      { name: 'implementation', agent: 'developer' },
      { name: 'testing', agent: 'tester' },
      { name: 'review', agent: 'reviewer' }
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

  describe('Acceptance Criteria Validation', () => {
    it('populates agentTokens from usage:updated events with accumulation', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Set current agent first
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      // First usage update
      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 150,
          outputTokens: 75,
          totalTokens: 225,
          estimatedCost: 0.002
        });
      });

      expect(result.current.verboseData?.agentTokens['planner']).toMatchObject({
        inputTokens: 150,
        outputTokens: 75,
        estimatedCost: 0.002,
      });

      // Second usage update should accumulate
      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      expect(result.current.verboseData?.agentTokens['planner']).toMatchObject({
        inputTokens: 250,
        outputTokens: 125,
        estimatedCost: 0.001,
      });

      // Verify metrics are calculated
      expect(result.current.verboseData?.metrics.tokensPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('populates agentTimings from agent:transition timestamps', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Start first agent
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      // Advance time to simulate agent work
      act(() => {
        vi.advanceTimersByTime(3500); // 3.5 seconds
      });

      // Transition to second agent
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
      });

      // Verify timing was captured
      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeGreaterThan(3400);
      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeLessThan(3600);

      // Advance time for second agent
      act(() => {
        vi.advanceTimersByTime(2000); // 2 seconds
      });

      // Transition to third agent
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'developer', 'tester');
      });

      // Verify second agent timing
      expect(result.current.verboseData?.timing.agentResponseTimes['developer']).toBeGreaterThan(1900);
      expect(result.current.verboseData?.timing.agentResponseTimes['developer']).toBeLessThan(2100);
    });

    it('populates turnCount and lastToolCall from agent events', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Set current agent
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'developer');
      });

      // Simulate agent turn
      act(() => {
        mockOrchestrator.simulateAgentTurn({ taskId: 'test-task', agentName: 'developer', turnNumber: 1 });
      });

      // Simulate tool use
      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: 'test.js' });
      });

      const developerAgent = result.current.agents.find(agent => agent.name === 'developer');

      // Verify turn count
      expect(developerAgent?.debugInfo?.turnCount).toBe(1);

      // Verify last tool call
      expect(developerAgent?.debugInfo?.lastToolCall).toBe('Read');

      // Multiple turns should increment
      act(() => {
        mockOrchestrator.simulateAgentTurn({ taskId: 'test-task', agentName: 'developer', turnNumber: 2 });
      });

      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Write', { content: 'new code' });
      });

      const updatedAgent = result.current.agents.find(agent => agent.name === 'developer');
      expect(updatedAgent?.debugInfo?.turnCount).toBe(2);
      expect(updatedAgent?.debugInfo?.lastToolCall).toBe('Write');
    });

    it('updates VerboseDebugData state reactively', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Initial state should be defined
      expect(result.current.verboseData).toBeDefined();
      expect(result.current.verboseData?.agentTokens).toEqual({});

      const initialTimestamp = result.current.verboseData?.timing.stageStartTime;

      // Set current agent and trigger events
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      act(() => {
        mockOrchestrator.simulateStageChange('test-task', 'planning', 'planner');
      });

      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
          estimatedCost: 0.003
        });
      });

      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Bash', { command: 'npm test' });
      });

      // Verify state is reactive - should have new data
      expect(result.current.verboseData?.agentTokens['planner']).toBeDefined();
      expect(result.current.verboseData?.agentDebug.toolCallCounts['planner']?.['Bash']).toBe(1);

      // State should be a different object instance (reactive)
      expect(result.current.verboseData?.timing.stageStartTime).not.toBe(initialTimestamp);

      // Additional events should continue to update
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
      });

      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 300,
          outputTokens: 150,
          totalTokens: 450,
          estimatedCost: 0.004
        });
      });

      // Verify multiple agents are tracked
      expect(result.current.verboseData?.agentTokens['developer']).toMatchObject({
        inputTokens: 300,
        outputTokens: 150,
        estimatedCost: 0.004,
      });
      expect(result.current.verboseData?.agentTokens['planner']).toMatchObject({
        inputTokens: 200,
        outputTokens: 100,
        estimatedCost: 0.003,
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles usage events with no current agent gracefully', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Send usage update without setting current agent
      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      // Should not crash and agentTokens should remain empty
      expect(result.current.verboseData?.agentTokens).toEqual({});
    });

    it('handles tool events with no current agent gracefully', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Send tool use without setting current agent
      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: 'test.js' });
      });

      // Should not crash and toolCallCounts should remain empty
      expect(result.current.verboseData?.agentDebug.toolCallCounts).toEqual({});
    });

    it('handles agent transitions with timing edge cases', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Rapid transitions without time advancement
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
        mockOrchestrator.simulateAgentTransition('test-task', 'developer', 'tester');
      });

      // Should handle rapid transitions without errors
      expect(result.current.currentAgent).toBe('tester');
      expect(result.current.verboseData?.timing.agentResponseTimes['planner']).toBeGreaterThanOrEqual(0);
      expect(result.current.verboseData?.timing.agentResponseTimes['developer']).toBeGreaterThanOrEqual(0);
    });

    it('handles concurrent events from multiple agents', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Simulate parallel execution scenario
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'developer');
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });

        mockOrchestrator.simulateAgentTransition('test-task', 'developer', 'tester');
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 80,
          outputTokens: 40,
          totalTokens: 120,
          estimatedCost: 0.001
        });
      });

      // Both agents should have their data tracked
      expect(result.current.verboseData?.agentTokens['developer']).toMatchObject({
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.001,
      });
      expect(result.current.verboseData?.agentTokens['tester']).toMatchObject({
        inputTokens: 80,
        outputTokens: 40,
        estimatedCost: 0.001,
      });
    });
  });

  describe('Performance and Memory', () => {
    it('updates metrics efficiently on multiple events', () => {
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

      // Simulate heavy usage
      act(() => {
        for (let i = 0; i < 10; i++) {
          mockOrchestrator.simulateUsageUpdate('test-task', {
            inputTokens: 100 + i,
            outputTokens: 50 + i,
            totalTokens: 150 + (i * 2),
            estimatedCost: 0.001 * (i + 1)
          });

          mockOrchestrator.simulateToolUse('test-task', 'Read', { file: `test${i}.js` });
        }
      });

      // Should accumulate correctly
      expect(result.current.verboseData?.agentTokens['planner'].inputTokens).toBe(1045); // Sum of 100+i for i=0 to 9
      expect(result.current.verboseData?.agentTokens['planner'].outputTokens).toBe(545); // Sum of 50+i for i=0 to 9
      expect(result.current.verboseData?.agentDebug.toolCallCounts['planner']?.['Read']).toBe(10);

      // Metrics should be calculated
      expect(result.current.verboseData?.metrics.tokensPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('maintains separate timing contexts per stage', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      const initialStageTime = result.current.verboseData?.timing.stageStartTime;

      // Progress through stages
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        mockOrchestrator.simulateStageChange('test-task', 'implementation', 'developer');
      });

      // Stage start time should be updated
      expect(result.current.verboseData?.timing.stageStartTime.getTime()).toBeGreaterThanOrEqual(
        initialStageTime!.getTime()
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
        vi.advanceTimersByTime(2000);
      });

      act(() => {
        mockOrchestrator.simulateStageChange('test-task', 'testing', 'tester');
      });

      // Stage timing should continue to update
      expect(result.current.verboseData?.timing.stageStartTime.getTime()).toBeGreaterThanOrEqual(
        initialStageTime!.getTime() + 1000
      );
    });
  });

  describe('Task Filtering', () => {
    it('only processes events for the specified taskId', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'target-task',
        })
      );

      // Events for different task should be ignored
      act(() => {
        mockOrchestrator.simulateAgentTransition('other-task', null, 'planner');
        mockOrchestrator.simulateUsageUpdate('other-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      expect(result.current.verboseData?.agentTokens).toEqual({});
      expect(result.current.currentAgent).toBeUndefined();

      // Events for target task should be processed
      act(() => {
        mockOrchestrator.simulateAgentTransition('target-task', null, 'developer');
        mockOrchestrator.simulateUsageUpdate('target-task', {
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
          estimatedCost: 0.002
        });
      });

      expect(result.current.verboseData?.agentTokens['developer']).toMatchObject({
        inputTokens: 200,
        outputTokens: 100,
        estimatedCost: 0.002,
      });
      expect(result.current.currentAgent).toBe('developer');
    });

    it('processes all events when no taskId specified', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          // No taskId specified
        })
      );

      // All events should be processed regardless of taskId
      act(() => {
        mockOrchestrator.simulateAgentTransition('task-1', null, 'planner');
        mockOrchestrator.simulateUsageUpdate('task-1', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      act(() => {
        mockOrchestrator.simulateAgentTransition('task-2', 'planner', 'developer');
        mockOrchestrator.simulateUsageUpdate('task-2', {
          inputTokens: 200,
          outputTokens: 100,
          totalTokens: 300,
          estimatedCost: 0.002
        });
      });

      // Both agents should have data from different tasks
      expect(result.current.verboseData?.agentTokens['planner']).toBeDefined();
      expect(result.current.verboseData?.agentTokens['developer']).toBeDefined();
      expect(result.current.currentAgent).toBe('developer');
    });
  });
});
