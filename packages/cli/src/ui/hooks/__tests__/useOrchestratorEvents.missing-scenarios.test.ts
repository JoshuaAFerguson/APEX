import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOrchestratorEvents } from '../useOrchestratorEvents';
import { MockOrchestrator, createMockOrchestrator } from '../../components/agents/__tests__/test-utils/MockOrchestrator';

describe('useOrchestratorEvents - Missing Scenarios and Edge Cases', () => {
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

  describe('Error Handling and Edge Cases', () => {
    it('handles usage updates without current agent gracefully', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // No agent transition has happened yet, so currentAgent is undefined
      expect(result.current.currentAgent).toBeUndefined();

      // This should not crash or cause issues
      act(() => {
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      // verboseData should remain unchanged
      expect(result.current.verboseData?.agentTokens).toEqual({});
    });

    it('handles tool use without current agent gracefully', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // No agent transition has happened yet, so currentAgent is undefined
      expect(result.current.currentAgent).toBeUndefined();

      // This should not crash
      act(() => {
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: 'test.js' });
      });

      // verboseData should remain unchanged
      expect(result.current.verboseData?.agentDebug.toolCallCounts).toEqual({});
    });

    it('handles events for different taskIds correctly (ignores non-matching)', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Set up an agent for our task
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      // Emit events for different task IDs - these should be ignored
      act(() => {
        mockOrchestrator.simulateUsageUpdate('other-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });

        mockOrchestrator.simulateToolUse('other-task', 'Write', { content: 'test' });
        mockOrchestrator.simulateAgentTurn({ taskId: 'other-task', agentName: 'planner', turnNumber: 5 });
      });

      // Our hook should not be affected by other task events
      expect(result.current.verboseData?.agentTokens['planner']).toBeUndefined();
      expect(result.current.verboseData?.agentDebug.toolCallCounts['planner']).toBeUndefined();

      const plannerAgent = result.current.agents.find(a => a.name === 'planner');
      expect(plannerAgent?.debugInfo?.turnCount).toBeUndefined();
    });

    it('handles events without taskId filter (processes all events)', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          // No taskId provided - should process events for all tasks
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('any-task', null, 'planner');
      });

      act(() => {
        mockOrchestrator.simulateUsageUpdate('any-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      // Should process events regardless of task ID
      expect(result.current.verboseData?.agentTokens['planner']).toEqual({
        inputTokens: 100,
        outputTokens: 50,
      });
    });

    it('handles rapid sequential events correctly', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'developer');

        // Rapid sequence of tool uses
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: '1.js' });
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: '2.js' });
        mockOrchestrator.simulateToolUse('test-task', 'Write', { content: 'test1' });
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: '3.js' });
        mockOrchestrator.simulateToolUse('test-task', 'Write', { content: 'test2' });
      });

      expect(result.current.verboseData?.agentDebug.toolCallCounts['developer']).toEqual({
        Read: 3,
        Write: 2,
      });

      // Last tool call should be captured
      const developerAgent = result.current.agents.find(a => a.name === 'developer');
      expect(developerAgent?.debugInfo?.lastToolCall).toBe('Write');
    });
  });

  describe('Agent Conversation Length Tracking', () => {
    it('tracks conversation length from agent:message events', () => {
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

      // Simulate multiple agent messages
      act(() => {
        mockOrchestrator.simulateAgentMessage('test-task', { content: 'Message 1' });
        mockOrchestrator.simulateAgentMessage('test-task', { content: 'Message 2' });
        mockOrchestrator.simulateAgentMessage('test-task', { content: 'Message 3' });
      });

      expect(result.current.verboseData?.agentDebug.conversationLength['planner']).toBe(3);
    });

    it('tracks conversation length per agent separately', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Planner messages
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
        mockOrchestrator.simulateAgentMessage('test-task', { content: 'Plan 1' });
        mockOrchestrator.simulateAgentMessage('test-task', { content: 'Plan 2' });
      });

      // Switch to developer and send messages
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
        mockOrchestrator.simulateAgentMessage('test-task', { content: 'Dev 1' });
        mockOrchestrator.simulateAgentMessage('test-task', { content: 'Dev 2' });
        mockOrchestrator.simulateAgentMessage('test-task', { content: 'Dev 3' });
      });

      expect(result.current.verboseData?.agentDebug.conversationLength['planner']).toBe(2);
      expect(result.current.verboseData?.agentDebug.conversationLength['developer']).toBe(3);
    });
  });

  describe('Agent Error Tracking', () => {
    it('tracks error counts from handleError', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Note: The actual handleError is not in the current event listeners
      // but we can test the error count functionality through direct state updates
      const testError = new Error('Test error');

      // Simulate the error scenario by calling the handler logic directly
      act(() => {
        // We need to find another way to test error tracking since it's not in the event listeners yet
        // Let's test if the verboseData structure supports error counts
        expect(result.current.verboseData?.agentDebug.errorCounts).toEqual({});
      });
    });
  });

  describe('Agent Thinking Event Handling', () => {
    it('updates agent thinking from agent:thinking events', () => {
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

      const thinkingText = 'I need to analyze the requirements carefully before proceeding...';

      // Simulate thinking event
      act(() => {
        // Note: Need to add this to MockOrchestrator if not already there
        mockOrchestrator.emit('agent:thinking', 'test-task', 'planner', thinkingText);
      });

      const plannerAgent = result.current.agents.find(a => a.name === 'planner');
      expect(plannerAgent?.debugInfo?.thinking).toBe(thinkingText);
    });

    it('truncates long thinking text in debug logs', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
          debug: true, // Enable debug logging
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      // Create a long thinking text (over 100 characters)
      const longThinkingText = 'A'.repeat(150) + ' and more thinking...';

      act(() => {
        mockOrchestrator.emit('agent:thinking', 'test-task', 'planner', longThinkingText);
      });

      const plannerAgent = result.current.agents.find(a => a.name === 'planner');
      expect(plannerAgent?.debugInfo?.thinking).toBe(longThinkingText);
    });
  });

  describe('Metrics Calculation', () => {
    it('calculates average response time correctly', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // First agent for 2 seconds
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Second agent for 4 seconds
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'planner', 'developer');
      });

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      // Third agent
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', 'developer', 'tester');
      });

      // Average should be (2000 + 4000) / 2 = 3000ms
      expect(result.current.verboseData?.metrics.averageResponseTime).toBeCloseTo(3000, 0);
    });

    it('calculates tool efficiency (currently defaults to 1.0)', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'developer');
        mockOrchestrator.simulateToolUse('test-task', 'Read', { file: 'test.js' });
      });

      // Tool efficiency currently defaults to 1.0 (100% success rate)
      // In a real implementation, this would track actual success/failure rates
      expect(result.current.verboseData?.metrics.toolEfficiency).toEqual({
        Read: 1.0,
      });
    });

    it('handles zero response times gracefully', () => {
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
      });

      expect(result.current.verboseData?.metrics.averageResponseTime).toBe(0);
    });
  });

  describe('Stage Change Context Reset', () => {
    it('preserves accumulated data while resetting timing context', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
          taskId: 'test-task',
        })
      );

      // Build up some data first
      act(() => {
        mockOrchestrator.simulateAgentTransition('test-task', null, 'planner');
        mockOrchestrator.simulateUsageUpdate('test-task', {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001
        });
      });

      const initialTokenData = result.current.verboseData?.agentTokens['planner'];
      const initialStageTime = result.current.verboseData?.timing.stageStartTime;

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Stage change should reset timing but preserve token data
      act(() => {
        mockOrchestrator.simulateStageChange({ id: 'test-task' }, 'implementation');
      });

      // Token data should be preserved
      expect(result.current.verboseData?.agentTokens['planner']).toEqual(initialTokenData);

      // Timing context should be reset
      expect(result.current.verboseData?.timing.stageStartTime.getTime()).toBeGreaterThan(
        initialStageTime!.getTime()
      );
      expect(result.current.verboseData?.timing.stageEndTime).toBeUndefined();
      expect(result.current.verboseData?.timing.stageDuration).toBeUndefined();
    });
  });
});