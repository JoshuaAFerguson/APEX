import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrchestratorEvents } from '../useOrchestratorEvents';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

// Mock orchestrator
const createMockOrchestrator = () => {
  const events: Record<string, Function[]> = {};

  return {
    on: vi.fn((event: string, handler: Function) => {
      if (!events[event]) events[event] = [];
      events[event].push(handler);
    }),
    off: vi.fn((event: string, handler: Function) => {
      if (events[event]) {
        events[event] = events[event].filter(h => h !== handler);
      }
    }),
    emit: vi.fn((event: string, ...args: any[]) => {
      if (events[event]) {
        events[event].forEach(handler => handler(...args));
      }
    }),
    simulateAgentTransition: (taskId: string, fromAgent: string | null, toAgent: string) => {
      (events['agent:transition'] || []).forEach(handler => handler(taskId, fromAgent, toAgent));
    },
    simulateUsageUpdate: (taskId: string, usage: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number }) => {
      (events['usage:updated'] || []).forEach(handler => handler(taskId, usage));
    },
    simulateToolUse: (taskId: string, tool: string, input: unknown) => {
      (events['agent:tool-use'] || []).forEach(handler => handler(taskId, tool, input));
    },
    simulateAgentTurn: (event: { taskId: string; agentName: string; turnNumber: number }) => {
      (events['agent:turn'] || []).forEach(handler => handler(event));
    },
    // Helper to get registered handlers
    _getHandlers: () => events,
  };
};

describe('useOrchestratorEvents thinking functionality', () => {
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator> & Partial<ApexOrchestrator>;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle agent:thinking events correctly', () => {
    const taskId = 'test-task-123';
    const workflow = {
      stages: [
        { name: 'planning', agent: 'planner' },
        { name: 'implementation', agent: 'developer' },
      ],
    };

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
        debug: true,
      })
    );

    // Initially no thinking content
    expect(result.current.agents).toHaveLength(2);
    expect(result.current.agents[0].debugInfo?.thinking).toBeUndefined();
    expect(result.current.agents[1].debugInfo?.thinking).toBeUndefined();

    // Emit agent thinking event
    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'developer', 'I need to implement the feature carefully...');
    });

    // Check that thinking content was updated
    expect(result.current.agents[1].debugInfo?.thinking).toBe('I need to implement the feature carefully...');
    expect(result.current.agents[0].debugInfo?.thinking).toBeUndefined(); // Other agent unchanged
  });

  it('should handle multiple thinking updates for the same agent', () => {
    const taskId = 'test-task-456';
    const workflow = {
      stages: [{ name: 'development', agent: 'developer' }],
    };

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
      })
    );

    // First thinking update
    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'developer', 'Initial analysis...');
    });

    expect(result.current.agents[0].debugInfo?.thinking).toBe('Initial analysis...');

    // Second thinking update
    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'developer', 'Deeper consideration of the problem...');
    });

    expect(result.current.agents[0].debugInfo?.thinking).toBe('Deeper consideration of the problem...');

    // Third thinking update with empty content
    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'developer', '');
    });

    expect(result.current.agents[0].debugInfo?.thinking).toBe('');
  });

  it('should handle thinking events for different agents', () => {
    const taskId = 'multi-agent-task';
    const workflow = {
      stages: [
        { name: 'planning', agent: 'planner' },
        { name: 'coding', agent: 'developer' },
        { name: 'testing', agent: 'tester' },
      ],
    };

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
      })
    );

    // Emit thinking events for different agents
    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'planner', 'Planning the architecture...');
      mockOrchestrator.emit('agent:thinking', taskId, 'developer', 'Implementing the solution...');
      mockOrchestrator.emit('agent:thinking', taskId, 'tester', 'Designing test cases...');
    });

    // Check that all agents have their thinking content
    const agents = result.current.agents;
    expect(agents[0].debugInfo?.thinking).toBe('Planning the architecture...');
    expect(agents[1].debugInfo?.thinking).toBe('Implementing the solution...');
    expect(agents[2].debugInfo?.thinking).toBe('Designing test cases...');
  });

  it('should ignore thinking events for different task IDs', () => {
    const taskId = 'target-task';
    const otherTaskId = 'other-task';
    const workflow = {
      stages: [{ name: 'development', agent: 'developer' }],
    };

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
      })
    );

    // Emit thinking event for different task ID
    act(() => {
      mockOrchestrator.emit('agent:thinking', otherTaskId, 'developer', 'Should be ignored...');
    });

    // Should not update thinking for our task
    expect(result.current.agents[0].debugInfo?.thinking).toBeUndefined();

    // Emit thinking event for correct task ID
    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'developer', 'Should be captured...');
    });

    // Should update thinking for our task
    expect(result.current.agents[0].debugInfo?.thinking).toBe('Should be captured...');
  });

  it('should handle thinking alongside other debug information', () => {
    const taskId = 'debug-info-task';
    const workflow = {
      stages: [{ name: 'implementation', agent: 'developer' }],
    };

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
      })
    );

    // Emit various debug events
    act(() => {
      mockOrchestrator.simulateAgentTransition(taskId, null, 'developer');
      mockOrchestrator.simulateUsageUpdate(taskId, {
        inputTokens: 1000,
        outputTokens: 1500,
        totalTokens: 2500,
        estimatedCost: 0,
      });
      mockOrchestrator.simulateToolUse(taskId, 'Edit', { file: 'src/index.ts' });
      mockOrchestrator.simulateAgentTurn({
        taskId,
        agentName: 'developer',
        turnNumber: 3,
      });
      mockOrchestrator.emit('agent:thinking', taskId, 'developer', 'Thinking about the implementation...');
    });

    // Check that all debug info is preserved
    const agent = result.current.agents[0];
    expect(agent.debugInfo?.tokensUsed).toEqual({ input: 1000, output: 1500 });
    expect(agent.debugInfo?.lastToolCall).toBe('Edit');
    expect(agent.debugInfo?.turnCount).toBe(3);
    expect(agent.debugInfo?.thinking).toBe('Thinking about the implementation...');
  });

  it('should handle very long thinking content', () => {
    const taskId = 'long-thinking-task';
    const workflow = {
      stages: [{ name: 'analysis', agent: 'analyst' }],
    };

    const longThinking = 'Very long thinking process. '.repeat(1000) + 'Final conclusion.';

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
      })
    );

    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'analyst', longThinking);
    });

    expect(result.current.agents[0].debugInfo?.thinking).toBe(longThinking);
    expect(result.current.agents[0].debugInfo?.thinking?.length).toBeGreaterThan(1000);
  });

  it('should handle special characters in thinking content', () => {
    const taskId = 'special-chars-task';
    const workflow = {
      stages: [{ name: 'processing', agent: 'processor' }],
    };

    const specialThinking = 'Processing with special chars: <>&"\'🤔💭\n\tMultiline content\n{"json": "data"}';

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
      })
    );

    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'processor', specialThinking);
    });

    expect(result.current.agents[0].debugInfo?.thinking).toBe(specialThinking);
  });

  it('should handle thinking events for agents not in workflow', () => {
    const taskId = 'dynamic-agent-task';
    const workflow = {
      stages: [{ name: 'main', agent: 'main-agent' }],
    };

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
      })
    );

    // Emit thinking for agent not in workflow
    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'unknown-agent', 'Thinking from unknown agent...');
    });

    // Should not crash, but shouldn't add the agent either
    expect(result.current.agents).toHaveLength(1);
    expect(result.current.agents[0].name).toBe('main-agent');
    expect(result.current.agents[0].debugInfo?.thinking).toBeUndefined();
  });

  it('should properly clean up thinking event listeners', () => {
    const taskId = 'cleanup-task';
    const workflow = {
      stages: [{ name: 'work', agent: 'worker' }],
    };

    const { unmount } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
      })
    );

    // Verify agent:thinking listener was registered
    expect(mockOrchestrator.on).toHaveBeenCalledWith('agent:thinking', expect.any(Function));

    // Unmount the hook
    unmount();

    // Verify agent:thinking listener was removed
    expect(mockOrchestrator.off).toHaveBeenCalledWith('agent:thinking', expect.any(Function));
  });

  it('should handle rapid thinking updates efficiently', () => {
    const taskId = 'rapid-updates-task';
    const workflow = {
      stages: [{ name: 'rapid', agent: 'rapid-agent' }],
    };

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
      })
    );

    // Emit many rapid thinking updates
    act(() => {
      for (let i = 0; i < 100; i++) {
        mockOrchestrator.emit('agent:thinking', taskId, 'rapid-agent', `Update ${i}`);
      }
    });

    // Should handle all updates and show the final one
    expect(result.current.agents[0].debugInfo?.thinking).toBe('Update 99');
  });

  it('should work when no taskId filter is specified', () => {
    const workflow = {
      stages: [{ name: 'global', agent: 'global-agent' }],
    };

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        // No taskId specified
        workflow,
      })
    );

    // Should capture thinking from any task
    act(() => {
      mockOrchestrator.emit('agent:thinking', 'any-task-id', 'global-agent', 'Global thinking...');
    });

    expect(result.current.agents[0].debugInfo?.thinking).toBe('Global thinking...');
  });

  it('should maintain thinking content during agent transitions', () => {
    const taskId = 'transition-task';
    const workflow = {
      stages: [
        { name: 'stage1', agent: 'agent1' },
        { name: 'stage2', agent: 'agent2' },
      ],
    };

    const { result } = renderHook(() =>
      useOrchestratorEvents({
        orchestrator: mockOrchestrator as ApexOrchestrator,
        taskId,
        workflow,
      })
    );

    // Add thinking to first agent
    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'agent1', 'Initial thinking...');
    });

    expect(result.current.agents[0].debugInfo?.thinking).toBe('Initial thinking...');

    // Transition to second agent
    act(() => {
      mockOrchestrator.emit('agent:transition', taskId, 'agent1', 'agent2');
    });

    // First agent should maintain its thinking content
    expect(result.current.agents[0].debugInfo?.thinking).toBe('Initial thinking...');
    expect(result.current.agents[0].status).toBe('completed');
    expect(result.current.agents[1].status).toBe('active');

    // Add thinking to second agent
    act(() => {
      mockOrchestrator.emit('agent:thinking', taskId, 'agent2', 'Second agent thinking...');
    });

    // Both agents should maintain their thinking content
    expect(result.current.agents[0].debugInfo?.thinking).toBe('Initial thinking...');
    expect(result.current.agents[1].debugInfo?.thinking).toBe('Second agent thinking...');
  });
});
