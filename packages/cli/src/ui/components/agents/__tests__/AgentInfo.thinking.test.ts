/**
 * Comprehensive tests for AgentInfo thinking functionality
 * Tests the thinking field integration, validation, and edge cases
 */

import { describe, it, expect } from 'vitest';
import type { AgentInfo } from '../AgentPanel';

describe('AgentInfo Thinking Functionality', () => {
  describe('AgentInfo interface with thinking field', () => {
    it('should support thinking field in debugInfo', () => {
      const agentWithThinking: AgentInfo = {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        progress: 75,
        startedAt: new Date('2024-01-01T10:00:00Z'),
        debugInfo: {
          thinking: 'I need to implement the authentication logic carefully',
          tokensUsed: { input: 1500, output: 2000 },
          stageStartedAt: new Date('2024-01-01T09:30:00Z'),
          lastToolCall: 'Write',
          turnCount: 5,
          errorCount: 0
        }
      };

      expect(agentWithThinking.debugInfo?.thinking).toBe('I need to implement the authentication logic carefully');
      expect(typeof agentWithThinking.debugInfo?.thinking).toBe('string');
    });

    it('should work without thinking field', () => {
      const agentWithoutThinking: AgentInfo = {
        name: 'tester',
        status: 'waiting',
        stage: 'testing',
        debugInfo: {
          tokensUsed: { input: 800, output: 1200 },
          turnCount: 2
        }
      };

      expect(agentWithoutThinking.debugInfo?.thinking).toBeUndefined();
    });

    it('should handle empty thinking content', () => {
      const agentWithEmptyThinking: AgentInfo = {
        name: 'reviewer',
        status: 'completed',
        debugInfo: {
          thinking: '',
          tokensUsed: { input: 500, output: 750 }
        }
      };

      expect(agentWithEmptyThinking.debugInfo?.thinking).toBe('');
    });

    it('should handle whitespace-only thinking content', () => {
      const agentWithWhitespaceThinking: AgentInfo = {
        name: 'architect',
        status: 'active',
        debugInfo: {
          thinking: '   \n\t   ',
          tokensUsed: { input: 300, output: 450 }
        }
      };

      expect(agentWithWhitespaceThinking.debugInfo?.thinking).toBe('   \n\t   ');
      expect(agentWithWhitespaceThinking.debugInfo?.thinking?.trim()).toBe('');
    });

    it('should handle undefined thinking explicitly', () => {
      const agentWithUndefinedThinking: AgentInfo = {
        name: 'devops',
        status: 'idle',
        debugInfo: {
          thinking: undefined,
          tokensUsed: { input: 100, output: 150 }
        }
      };

      expect(agentWithUndefinedThinking.debugInfo?.thinking).toBeUndefined();
    });
  });

  describe('Complex thinking content handling', () => {
    it('should handle multiline thinking content', () => {
      const multilineThinking = `I'm analyzing the user requirements:
1. Need to add authentication
2. Must validate inputs
3. Should handle errors gracefully

This will require careful planning.`;

      const agent: AgentInfo = {
        name: 'planner',
        status: 'active',
        debugInfo: {
          thinking: multilineThinking
        }
      };

      expect(agent.debugInfo?.thinking).toContain('I\'m analyzing the user requirements:');
      expect(agent.debugInfo?.thinking).toContain('This will require careful planning.');
      expect(agent.debugInfo?.thinking?.split('\n')).toHaveLength(6);
    });

    it('should handle thinking with special characters', () => {
      const specialCharsThinking = 'Processing data: {"key": "value"} & <tag>content</tag> 🤔 100% complete';

      const agent: AgentInfo = {
        name: 'developer',
        status: 'active',
        debugInfo: {
          thinking: specialCharsThinking
        }
      };

      expect(agent.debugInfo?.thinking).toContain('{"key": "value"}');
      expect(agent.debugInfo?.thinking).toContain('<tag>content</tag>');
      expect(agent.debugInfo?.thinking).toContain('🤔');
      expect(agent.debugInfo?.thinking).toContain('100%');
    });

    it('should handle very long thinking content', () => {
      const longThinking = 'A'.repeat(1000);

      const agent: AgentInfo = {
        name: 'architect',
        status: 'active',
        debugInfo: {
          thinking: longThinking
        }
      };

      expect(agent.debugInfo?.thinking).toBe(longThinking);
      expect(agent.debugInfo?.thinking?.length).toBe(1000);
    });

    it('should handle code snippets in thinking', () => {
      const codeThinking = `I need to implement this function:

\`\`\`typescript
function authenticate(user: User): boolean {
  return user.isValid && !user.isBlocked;
}
\`\`\`

This should handle the basic validation.`;

      const agent: AgentInfo = {
        name: 'developer',
        status: 'active',
        debugInfo: {
          thinking: codeThinking
        }
      };

      expect(agent.debugInfo?.thinking).toContain('function authenticate');
      expect(agent.debugInfo?.thinking).toContain('```typescript');
      expect(agent.debugInfo?.thinking).toContain('This should handle the basic validation.');
    });
  });

  describe('Optional chaining and null safety', () => {
    it('should safely handle missing debugInfo', () => {
      const agentWithoutDebugInfo: AgentInfo = {
        name: 'simple-agent',
        status: 'completed'
      };

      expect(agentWithoutDebugInfo.debugInfo?.thinking).toBeUndefined();
      expect(() => agentWithoutDebugInfo.debugInfo?.thinking?.length).not.toThrow();
    });

    it('should safely handle null debugInfo', () => {
      const agentWithNullDebugInfo = {
        name: 'null-agent',
        status: 'active',
        debugInfo: null
      } as AgentInfo;

      expect(agentWithNullDebugInfo.debugInfo?.thinking).toBeUndefined();
    });

    it('should work with partial debugInfo', () => {
      const agentWithPartialDebugInfo: AgentInfo = {
        name: 'partial-agent',
        status: 'active',
        debugInfo: {
          thinking: 'Only thinking present'
          // Other debugInfo fields missing
        }
      };

      expect(agentWithPartialDebugInfo.debugInfo?.thinking).toBe('Only thinking present');
      expect(agentWithPartialDebugInfo.debugInfo?.tokensUsed).toBeUndefined();
      expect(agentWithPartialDebugInfo.debugInfo?.turnCount).toBeUndefined();
    });
  });

  describe('Array operations with thinking agents', () => {
    it('should filter agents with thinking content', () => {
      const agents: AgentInfo[] = [
        {
          name: 'agent1',
          status: 'active',
          debugInfo: { thinking: 'Agent 1 thoughts' }
        },
        {
          name: 'agent2',
          status: 'waiting',
          debugInfo: { thinking: '' }
        },
        {
          name: 'agent3',
          status: 'completed',
          debugInfo: { thinking: 'Agent 3 thoughts' }
        },
        {
          name: 'agent4',
          status: 'idle'
          // No debugInfo
        }
      ];

      const agentsWithThinking = agents.filter(agent =>
        agent.debugInfo?.thinking && agent.debugInfo.thinking.trim().length > 0
      );

      expect(agentsWithThinking).toHaveLength(2);
      expect(agentsWithThinking[0].name).toBe('agent1');
      expect(agentsWithThinking[1].name).toBe('agent3');
    });

    it('should map thinking content from agents', () => {
      const agents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'active',
          debugInfo: { thinking: 'Planning the architecture' }
        },
        {
          name: 'developer',
          status: 'active',
          debugInfo: { thinking: 'Implementing the features' }
        },
        {
          name: 'tester',
          status: 'waiting'
          // No thinking
        }
      ];

      const thinkingContents = agents
        .map(agent => agent.debugInfo?.thinking)
        .filter((thinking): thinking is string => Boolean(thinking && thinking.trim()));

      expect(thinkingContents).toEqual([
        'Planning the architecture',
        'Implementing the features'
      ]);
    });

    it('should find agents by thinking content', () => {
      const agents: AgentInfo[] = [
        {
          name: 'agent1',
          status: 'active',
          debugInfo: { thinking: 'Working on authentication system' }
        },
        {
          name: 'agent2',
          status: 'active',
          debugInfo: { thinking: 'Designing the database schema' }
        },
        {
          name: 'agent3',
          status: 'active',
          debugInfo: { thinking: 'Testing authentication flows' }
        }
      ];

      const authAgents = agents.filter(agent =>
        agent.debugInfo?.thinking?.toLowerCase().includes('authentication')
      );

      expect(authAgents).toHaveLength(2);
      expect(authAgents[0].name).toBe('agent1');
      expect(authAgents[1].name).toBe('agent3');
    });
  });

  describe('Thinking content validation utilities', () => {
    it('should validate if thinking content should be displayed', () => {
      const shouldDisplayThinking = (thinking: string | undefined): boolean => {
        return Boolean(thinking && thinking.trim().length > 0);
      };

      expect(shouldDisplayThinking('Valid thinking')).toBe(true);
      expect(shouldDisplayThinking('')).toBe(false);
      expect(shouldDisplayThinking('   ')).toBe(false);
      expect(shouldDisplayThinking(undefined)).toBe(false);
      expect(shouldDisplayThinking('\n\t\r')).toBe(false);
      expect(shouldDisplayThinking('  Content with spaces  ')).toBe(true);
    });

    it('should truncate thinking content appropriately', () => {
      const truncateThinking = (thinking: string, maxLength: number): string => {
        if (thinking.length <= maxLength) return thinking;
        return thinking.substring(0, maxLength) + '...';
      };

      const longText = 'A'.repeat(100);

      expect(truncateThinking(longText, 50)).toBe('A'.repeat(50) + '...');
      expect(truncateThinking('Short', 50)).toBe('Short');
      expect(truncateThinking(longText, 100)).toBe(longText);
    });

    it('should count thinking content characters correctly', () => {
      const countThinkingChars = (thinking: string | undefined): number => {
        return thinking?.length || 0;
      };

      expect(countThinkingChars('Hello world')).toBe(11);
      expect(countThinkingChars('')).toBe(0);
      expect(countThinkingChars(undefined)).toBe(0);
      expect(countThinkingChars('Multi\nline\tcontent')).toBe(18);
    });
  });

  describe('Integration with agent status and workflow', () => {
    it('should correlate thinking with agent activity', () => {
      const activeAgentWithThinking: AgentInfo = {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        startedAt: new Date(),
        debugInfo: {
          thinking: 'Currently implementing the user authentication module',
          tokensUsed: { input: 1200, output: 1800 },
          turnCount: 3
        }
      };

      expect(activeAgentWithThinking.status).toBe('active');
      expect(activeAgentWithThinking.debugInfo?.thinking).toContain('Currently implementing');
    });

    it('should handle completed agents with final thinking', () => {
      const completedAgentWithThinking: AgentInfo = {
        name: 'reviewer',
        status: 'completed',
        stage: 'review',
        progress: 100,
        debugInfo: {
          thinking: 'Code review complete. All tests are passing and implementation looks good.',
          tokensUsed: { input: 800, output: 600 },
          turnCount: 2
        }
      };

      expect(completedAgentWithThinking.status).toBe('completed');
      expect(completedAgentWithThinking.progress).toBe(100);
      expect(completedAgentWithThinking.debugInfo?.thinking).toContain('Code review complete');
    });

    it('should handle parallel agents with thinking', () => {
      const parallelAgentsWithThinking: AgentInfo[] = [
        {
          name: 'tester-unit',
          status: 'parallel',
          stage: 'testing',
          debugInfo: { thinking: 'Running unit tests for authentication' }
        },
        {
          name: 'tester-integration',
          status: 'parallel',
          stage: 'testing',
          debugInfo: { thinking: 'Running integration tests for API endpoints' }
        }
      ];

      parallelAgentsWithThinking.forEach(agent => {
        expect(agent.status).toBe('parallel');
        expect(agent.debugInfo?.thinking).toBeDefined();
        expect(agent.debugInfo?.thinking).toContain('Running');
      });
    });
  });
});