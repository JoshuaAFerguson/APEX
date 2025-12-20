/**
 * TypeScript compilation tests for AgentPanel with thinking field
 * These tests ensure that the thinking field is properly typed and compiles correctly.
 */

import { describe, it, expect } from 'vitest';
import type { AgentInfo } from '../AgentPanel';

describe('AgentPanel TypeScript compilation tests', () => {
  it('should compile AgentInfo with thinking field', () => {
    // This test ensures TypeScript compilation works correctly
    const agentWithThinking: AgentInfo = {
      name: 'test-agent',
      status: 'active',
      stage: 'testing',
      progress: 50,
      startedAt: new Date(),
      debugInfo: {
        thinking: 'This is a test thinking field',
        tokensUsed: { input: 1000, output: 1500 },
        stageStartedAt: new Date(),
        lastToolCall: 'Read',
        turnCount: 3,
        errorCount: 1,
      },
    };

    // Type assertions to ensure proper typing
    expect(agentWithThinking).toBeDefined();
    expect(agentWithThinking.debugInfo?.thinking).toBe('This is a test thinking field');
    expect(typeof agentWithThinking.debugInfo?.thinking).toBe('string');
  });

  it('should compile AgentInfo without thinking field', () => {
    const agentWithoutThinking: AgentInfo = {
      name: 'legacy-agent',
      status: 'waiting',
      debugInfo: {
        tokensUsed: { input: 500, output: 750 },
        turnCount: 2,
      },
    };

    expect(agentWithoutThinking).toBeDefined();
    expect(agentWithoutThinking.debugInfo?.thinking).toBeUndefined();
  });

  it('should allow thinking field to be undefined explicitly', () => {
    const agentWithUndefinedThinking: AgentInfo = {
      name: 'undefined-agent',
      status: 'idle',
      debugInfo: {
        thinking: undefined,
        tokensUsed: { input: 200, output: 300 },
      },
    };

    expect(agentWithUndefinedThinking).toBeDefined();
    expect(agentWithUndefinedThinking.debugInfo?.thinking).toBeUndefined();
  });

  it('should handle empty string thinking', () => {
    const agentWithEmptyThinking: AgentInfo = {
      name: 'empty-agent',
      status: 'completed',
      debugInfo: {
        thinking: '',
        tokensUsed: { input: 100, output: 150 },
      },
    };

    expect(agentWithEmptyThinking).toBeDefined();
    expect(agentWithEmptyThinking.debugInfo?.thinking).toBe('');
  });

  it('should work with array of mixed agents', () => {
    const agents: AgentInfo[] = [
      {
        name: 'agent1',
        status: 'active',
        debugInfo: {
          thinking: 'Agent 1 thinking',
          tokensUsed: { input: 1000, output: 1500 },
        },
      },
      {
        name: 'agent2',
        status: 'waiting',
        debugInfo: {
          tokensUsed: { input: 500, output: 750 },
          // No thinking field
        },
      },
      {
        name: 'agent3',
        status: 'completed',
        debugInfo: {
          thinking: '',
          tokensUsed: { input: 800, output: 1200 },
        },
      },
    ];

    expect(agents).toHaveLength(3);
    expect(agents[0].debugInfo?.thinking).toBe('Agent 1 thinking');
    expect(agents[1].debugInfo?.thinking).toBeUndefined();
    expect(agents[2].debugInfo?.thinking).toBe('');
  });

  it('should maintain type safety with optional chaining', () => {
    const agent: AgentInfo = {
      name: 'test',
      status: 'active',
      // No debugInfo
    };

    // Should not throw error with optional chaining
    const thinking = agent.debugInfo?.thinking;
    expect(thinking).toBeUndefined();

    const tokensUsed = agent.debugInfo?.tokensUsed;
    expect(tokensUsed).toBeUndefined();
  });

  it('should allow partial debugInfo with only thinking', () => {
    const agentWithOnlyThinking: AgentInfo = {
      name: 'thinking-only',
      status: 'active',
      debugInfo: {
        thinking: 'Only thinking field present',
        // No other fields
      },
    };

    expect(agentWithOnlyThinking.debugInfo?.thinking).toBe('Only thinking field present');
    expect(agentWithOnlyThinking.debugInfo?.tokensUsed).toBeUndefined();
    expect(agentWithOnlyThinking.debugInfo?.turnCount).toBeUndefined();
  });

  it('should handle complex thinking content types', () => {
    const complexThinkingAgent: AgentInfo = {
      name: 'complex',
      status: 'active',
      debugInfo: {
        thinking: `Multi-line thinking
        with various content:
        - Lists
        - "Quotes"
        - Special chars: <>&
        - Unicode: 🤔💭
        - Code: \`const x = 1;\``,
        tokensUsed: { input: 2000, output: 3000 },
      },
    };

    expect(complexThinkingAgent.debugInfo?.thinking).toContain('Multi-line thinking');
    expect(complexThinkingAgent.debugInfo?.thinking).toContain('🤔💭');
    expect(typeof complexThinkingAgent.debugInfo?.thinking).toBe('string');
  });

  it('should work with function parameters and returns', () => {
    // Test function that accepts AgentInfo with thinking
    const processAgent = (agent: AgentInfo): string | undefined => {
      return agent.debugInfo?.thinking;
    };

    const agent: AgentInfo = {
      name: 'function-test',
      status: 'active',
      debugInfo: {
        thinking: 'Function parameter test',
        tokensUsed: { input: 500, output: 750 },
      },
    };

    const result = processAgent(agent);
    expect(result).toBe('Function parameter test');
  });

  it('should work with generic array operations', () => {
    const agents: AgentInfo[] = [
      {
        name: 'agent1',
        status: 'active',
        debugInfo: { thinking: 'Thinking 1' },
      },
      {
        name: 'agent2',
        status: 'waiting',
        debugInfo: { thinking: 'Thinking 2' },
      },
      {
        name: 'agent3',
        status: 'completed',
        debugInfo: {}, // No thinking
      },
    ];

    // Filter agents with thinking
    const agentsWithThinking = agents.filter(
      agent => agent.debugInfo?.thinking && agent.debugInfo.thinking.trim().length > 0
    );

    expect(agentsWithThinking).toHaveLength(2);

    // Map thinking content
    const thinkingContent = agents.map(agent => agent.debugInfo?.thinking).filter(Boolean);
    expect(thinkingContent).toEqual(['Thinking 1', 'Thinking 2']);
  });
});