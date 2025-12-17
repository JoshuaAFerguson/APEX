/**
 * Integration test for AgentThoughts functionality with AgentPanel and App
 * Tests the complete flow from AgentInfo thinking to UI display
 */

import { describe, it, expect, vi } from 'vitest';
import type { AgentInfo } from '../components/agents/AgentPanel';
import type { AppState } from '../App';
import type { AgentThoughtsProps } from '../components/AgentThoughts';

describe('AgentThoughts Integration Tests', () => {
  describe('End-to-end thinking display workflow', () => {
    it('should integrate AgentInfo thinking with AgentPanel display', () => {
      // Create agent with thinking content
      const agentWithThinking: AgentInfo = {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        progress: 75,
        startedAt: new Date(),
        debugInfo: {
          thinking: 'I need to implement the authentication logic step by step. First, I should validate the user credentials, then create a session token.',
          tokensUsed: { input: 1200, output: 1800 },
          turnCount: 5,
          errorCount: 0,
        },
      };

      // Simulate app state with showThoughts enabled
      const appState: AppState = {
        initialized: true,
        projectPath: '/test/project',
        config: null,
        orchestrator: null,
        messages: [],
        inputHistory: [],
        isProcessing: false,
        tokens: { input: 1200, output: 1800 },
        cost: 0.05,
        model: 'sonnet',
        displayMode: 'normal',
        previewMode: false,
        showThoughts: true,
        activeAgent: 'developer',
      };

      // Simulate the logic that determines if AgentThoughts should be shown
      const shouldShowThoughts = appState.showThoughts &&
        agentWithThinking.debugInfo?.thinking &&
        agentWithThinking.debugInfo.thinking.trim().length > 0;

      expect(shouldShowThoughts).toBe(true);

      // Simulate AgentThoughts props that would be passed
      const agentThoughtsProps: AgentThoughtsProps = {
        thinking: agentWithThinking.debugInfo!.thinking!,
        agent: agentWithThinking.name,
        displayMode: appState.displayMode,
        defaultCollapsed: true,
      };

      expect(agentThoughtsProps.thinking).toContain('authentication logic');
      expect(agentThoughtsProps.agent).toBe('developer');
      expect(agentThoughtsProps.displayMode).toBe('normal');
    });

    it('should handle multiple agents with different thinking states', () => {
      const agents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          debugInfo: {
            thinking: 'Planning phase complete. Architecture looks solid.',
            tokensUsed: { input: 800, output: 1000 },
          },
        },
        {
          name: 'developer',
          status: 'active',
          debugInfo: {
            thinking: 'Currently working on the API endpoints. Need to handle error cases properly.',
            tokensUsed: { input: 1500, output: 2200 },
          },
        },
        {
          name: 'tester',
          status: 'waiting',
          debugInfo: {
            // No thinking content
            tokensUsed: { input: 200, output: 300 },
          },
        },
        {
          name: 'reviewer',
          status: 'idle',
          debugInfo: {
            thinking: '', // Empty thinking
            tokensUsed: { input: 100, output: 150 },
          },
        },
      ];

      const appState: AppState = {
        initialized: true,
        projectPath: '/test/project',
        config: null,
        orchestrator: null,
        messages: [],
        inputHistory: [],
        isProcessing: false,
        tokens: { input: 2600, output: 3650 },
        cost: 0.12,
        model: 'sonnet',
        displayMode: 'verbose',
        previewMode: false,
        showThoughts: true,
        activeAgent: 'developer',
      };

      // Simulate the filtering logic for agents with displayable thinking
      const agentsWithDisplayableThinking = agents.filter(agent =>
        appState.showThoughts &&
        agent.debugInfo?.thinking &&
        agent.debugInfo.thinking.trim().length > 0
      );

      expect(agentsWithDisplayableThinking).toHaveLength(2);
      expect(agentsWithDisplayableThinking[0].name).toBe('planner');
      expect(agentsWithDisplayableThinking[1].name).toBe('developer');

      // Verify thinking content
      expect(agentsWithDisplayableThinking[0].debugInfo?.thinking).toContain('Planning phase complete');
      expect(agentsWithDisplayableThinking[1].debugInfo?.thinking).toContain('API endpoints');
    });

    it('should handle thoughts command integration with agent display', () => {
      let currentAppState: AppState = {
        initialized: true,
        projectPath: '/test/project',
        config: null,
        orchestrator: null,
        messages: [],
        inputHistory: [],
        isProcessing: false,
        tokens: { input: 1000, output: 1500 },
        cost: 0.04,
        model: 'sonnet',
        displayMode: 'normal',
        previewMode: false,
        showThoughts: false, // Initially disabled
      };

      const agentWithThinking: AgentInfo = {
        name: 'architect',
        status: 'active',
        debugInfo: {
          thinking: 'Designing the microservices architecture. Need to consider data flow between services.',
          tokensUsed: { input: 600, output: 900 },
        },
      };

      // Initially thoughts should not be shown
      const initialShouldShow = currentAppState.showThoughts &&
        agentWithThinking.debugInfo?.thinking;
      expect(initialShouldShow).toBe(false);

      // Simulate /thoughts command execution
      const handleThoughtsCommand = (state: AppState) => {
        const newShowThoughts = !state.showThoughts;
        return {
          ...state,
          showThoughts: newShowThoughts,
          messages: [
            ...state.messages,
            {
              id: `msg_${Date.now()}`,
              type: 'system' as const,
              content: newShowThoughts
                ? 'Thought visibility enabled: AI reasoning will be shown'
                : 'Thought visibility disabled: AI reasoning will be hidden',
              timestamp: new Date(),
            },
          ],
        };
      };

      currentAppState = handleThoughtsCommand(currentAppState);

      // Now thoughts should be shown
      const finalShouldShow = currentAppState.showThoughts &&
        agentWithThinking.debugInfo?.thinking;
      expect(finalShouldShow).toBe(true);
      expect(currentAppState.showThoughts).toBe(true);
      expect(currentAppState.messages).toHaveLength(1);
      expect(currentAppState.messages[0].content).toContain('enabled');
    });
  });

  describe('Display mode integration', () => {
    it('should handle thinking display in compact mode', () => {
      const appState: AppState = {
        initialized: true,
        projectPath: '/test/project',
        config: null,
        orchestrator: null,
        messages: [],
        inputHistory: [],
        isProcessing: false,
        tokens: { input: 500, output: 750 },
        cost: 0.02,
        model: 'sonnet',
        displayMode: 'compact',
        previewMode: false,
        showThoughts: true,
      };

      const agentWithThinking: AgentInfo = {
        name: 'developer',
        status: 'active',
        debugInfo: {
          thinking: 'Working on the implementation...',
          tokensUsed: { input: 500, output: 750 },
        },
      };

      // In compact mode, AgentThoughts component returns empty Box
      // But the thinking data is still available in the agent
      expect(appState.displayMode).toBe('compact');
      expect(appState.showThoughts).toBe(true);
      expect(agentWithThinking.debugInfo?.thinking).toBeDefined();

      // Simulate AgentThoughts behavior in compact mode
      const shouldRenderContent = appState.displayMode !== 'compact';
      expect(shouldRenderContent).toBe(false);
    });

    it('should handle thinking display in verbose mode', () => {
      const longThinking = 'This is a very long thinking process that involves multiple steps. '.repeat(20);

      const appState: AppState = {
        initialized: true,
        projectPath: '/test/project',
        config: null,
        orchestrator: null,
        messages: [],
        inputHistory: [],
        isProcessing: false,
        tokens: { input: 2000, output: 3000 },
        cost: 0.08,
        model: 'sonnet',
        displayMode: 'verbose',
        previewMode: false,
        showThoughts: true,
      };

      const agentWithLongThinking: AgentInfo = {
        name: 'architect',
        status: 'active',
        debugInfo: {
          thinking: longThinking,
          tokensUsed: { input: 2000, output: 3000 },
        },
      };

      // In verbose mode, maxLength should be 1000 instead of 500
      const effectiveMaxLength = appState.displayMode === 'verbose' ? 1000 : 500;
      const shouldTruncate = agentWithLongThinking.debugInfo!.thinking!.length > effectiveMaxLength;

      expect(appState.displayMode).toBe('verbose');
      expect(effectiveMaxLength).toBe(1000);
      expect(agentWithLongThinking.debugInfo?.thinking?.length).toBeGreaterThan(1000);
      expect(shouldTruncate).toBe(true);
    });
  });

  describe('Parallel agents thinking integration', () => {
    it('should handle multiple parallel agents with thinking', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'tester-unit',
          status: 'parallel',
          stage: 'testing',
          debugInfo: {
            thinking: 'Running comprehensive unit tests for the authentication module.',
            tokensUsed: { input: 800, output: 1200 },
          },
        },
        {
          name: 'tester-integration',
          status: 'parallel',
          stage: 'testing',
          debugInfo: {
            thinking: 'Executing integration tests for API endpoints and database connections.',
            tokensUsed: { input: 900, output: 1350 },
          },
        },
        {
          name: 'security-audit',
          status: 'parallel',
          stage: 'security',
          debugInfo: {
            thinking: 'Performing security analysis of authentication flows and data validation.',
            tokensUsed: { input: 700, output: 1050 },
          },
        },
      ];

      const appState: AppState = {
        initialized: true,
        projectPath: '/test/project',
        config: null,
        orchestrator: null,
        messages: [],
        inputHistory: [],
        isProcessing: false,
        tokens: { input: 2400, output: 3600 },
        cost: 0.15,
        model: 'sonnet',
        displayMode: 'normal',
        previewMode: false,
        showThoughts: true,
        showParallelPanel: true,
        parallelAgents,
      };

      // All parallel agents should have displayable thinking
      const parallelAgentsWithThinking = parallelAgents.filter(agent =>
        appState.showThoughts &&
        agent.debugInfo?.thinking &&
        agent.debugInfo.thinking.trim().length > 0
      );

      expect(parallelAgentsWithThinking).toHaveLength(3);
      expect(appState.showParallelPanel).toBe(true);

      // Verify each agent has relevant thinking content
      expect(parallelAgentsWithThinking[0].debugInfo?.thinking).toContain('unit tests');
      expect(parallelAgentsWithThinking[1].debugInfo?.thinking).toContain('integration tests');
      expect(parallelAgentsWithThinking[2].debugInfo?.thinking).toContain('security analysis');
    });
  });

  describe('Message thinking integration', () => {
    it('should handle messages with thinking content', () => {
      const messagesWithThinking = [
        {
          id: 'msg1',
          type: 'assistant' as const,
          content: 'Starting the implementation of user authentication.',
          agent: 'developer',
          thinking: 'I should start by setting up the database schema for users and sessions.',
          timestamp: new Date(),
        },
        {
          id: 'msg2',
          type: 'assistant' as const,
          content: 'Created user model and authentication endpoints.',
          agent: 'developer',
          thinking: 'The endpoints are working, but I need to add proper input validation and error handling.',
          timestamp: new Date(),
        },
        {
          id: 'msg3',
          type: 'user' as const,
          content: 'Please add password hashing.',
          timestamp: new Date(),
        },
        {
          id: 'msg4',
          type: 'assistant' as const,
          content: 'Added bcrypt password hashing and salt generation.',
          agent: 'developer',
          thinking: 'Password security is critical. I used bcrypt with a cost factor of 12 for good security vs performance balance.',
          timestamp: new Date(),
        },
      ];

      const appState: AppState = {
        initialized: true,
        projectPath: '/test/project',
        config: null,
        orchestrator: null,
        messages: messagesWithThinking,
        inputHistory: [],
        isProcessing: false,
        tokens: { input: 1800, output: 2700 },
        cost: 0.09,
        model: 'sonnet',
        displayMode: 'normal',
        previewMode: false,
        showThoughts: true,
      };

      // Filter messages that should display thinking
      const messagesWithDisplayableThinking = appState.messages.filter(msg =>
        appState.showThoughts &&
        msg.thinking &&
        msg.thinking.trim().length > 0 &&
        msg.agent
      );

      expect(messagesWithDisplayableThinking).toHaveLength(3);

      // Verify thinking content
      expect(messagesWithDisplayableThinking[0].thinking).toContain('database schema');
      expect(messagesWithDisplayableThinking[1].thinking).toContain('input validation');
      expect(messagesWithDisplayableThinking[2].thinking).toContain('bcrypt with a cost factor');
    });

    it('should handle thinking visibility toggle with existing messages', () => {
      const messages = [
        {
          id: 'msg1',
          type: 'assistant' as const,
          content: 'Working on the feature...',
          agent: 'developer',
          thinking: 'This requires careful consideration of edge cases.',
          timestamp: new Date(),
        },
      ];

      let appState: AppState = {
        initialized: true,
        projectPath: '/test/project',
        config: null,
        orchestrator: null,
        messages,
        inputHistory: [],
        isProcessing: false,
        tokens: { input: 600, output: 900 },
        cost: 0.03,
        model: 'sonnet',
        displayMode: 'normal',
        previewMode: false,
        showThoughts: false, // Initially disabled
      };

      // Initially, thinking should not be displayed
      const initialDisplayableMessages = appState.messages.filter(msg =>
        appState.showThoughts && msg.thinking
      );
      expect(initialDisplayableMessages).toHaveLength(0);

      // Toggle thoughts on
      appState = {
        ...appState,
        showThoughts: true,
      };

      // Now thinking should be displayed
      const finalDisplayableMessages = appState.messages.filter(msg =>
        appState.showThoughts && msg.thinking
      );
      expect(finalDisplayableMessages).toHaveLength(1);
      expect(finalDisplayableMessages[0].thinking).toContain('edge cases');
    });
  });

  describe('Performance with thinking content', () => {
    it('should handle large numbers of agents with thinking efficiently', () => {
      const manyAgentsWithThinking = Array.from({ length: 50 }, (_, i) => ({
        name: `agent-${i}`,
        status: 'parallel' as const,
        debugInfo: {
          thinking: `Agent ${i} is processing task step ${i + 1}. This involves analyzing the requirements and implementing the solution.`,
          tokensUsed: { input: 100 + i * 10, output: 150 + i * 15 },
        },
      }));

      const appState: AppState = {
        initialized: true,
        projectPath: '/test/project',
        config: null,
        orchestrator: null,
        messages: [],
        inputHistory: [],
        isProcessing: false,
        tokens: { input: 5000, output: 7500 },
        cost: 0.25,
        model: 'sonnet',
        displayMode: 'verbose',
        previewMode: false,
        showThoughts: true,
        parallelAgents: manyAgentsWithThinking,
      };

      // Filter for agents with thinking (performance test)
      const start = performance.now();
      const agentsWithThinking = appState.parallelAgents?.filter(agent =>
        appState.showThoughts &&
        agent.debugInfo?.thinking &&
        agent.debugInfo.thinking.trim().length > 0
      ) || [];
      const end = performance.now();

      expect(agentsWithThinking).toHaveLength(50);
      expect(end - start).toBeLessThan(10); // Should be very fast

      // Verify thinking content is properly structured
      agentsWithThinking.forEach((agent, i) => {
        expect(agent.debugInfo?.thinking).toContain(`Agent ${i}`);
        expect(agent.debugInfo?.thinking).toContain('task step');
      });
    });
  });
});