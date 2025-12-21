import { describe, it, expect } from 'vitest';
import { convertVerboseDataToLogEntries } from '../App.js';
import type { VerboseDebugData } from '@apex/core';

/**
 * Edge case tests for verboseData functionality
 * These tests focus on error conditions, boundary cases, and robustness
 */
describe('App VerboseData Edge Cases', () => {
  describe('convertVerboseDataToLogEntries edge cases', () => {
    it('should handle undefined values gracefully', () => {
      const verboseData: VerboseDebugData = {
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

      const result = convertVerboseDataToLogEntries(verboseData);
      expect(result).toEqual([]);
    });

    it('should handle very large numbers in metrics', () => {
      const verboseData: VerboseDebugData = {
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
          tokensPerSecond: Number.MAX_SAFE_INTEGER,
          averageResponseTime: Number.MAX_SAFE_INTEGER,
          toolEfficiency: {},
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      // Should create a metrics entry with large numbers
      const metricsEntry = result.find(entry => entry.category === 'metrics');
      expect(metricsEntry).toBeDefined();
      expect(metricsEntry?.message).toContain(`${Number.MAX_SAFE_INTEGER.toFixed(2)} tokens/sec`);
    });

    it('should handle zero and negative values', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          'test-agent': {
            inputTokens: 0,
            outputTokens: 0,
          },
        },
        timing: {
          stageStartTime: new Date(),
          stageDuration: 0,
          agentResponseTimes: {
            'test-agent': 0,
          },
          toolUsageTimes: {
            'Test': 0,
          },
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {
            'test-agent': 0,
          },
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 0,
          averageResponseTime: 0,
          toolEfficiency: {
            'Test': 0,
          },
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      // Should include timing entry even with 0 duration
      const timingEntry = result.find(entry => entry.category === 'timing');
      expect(timingEntry).toBeDefined();
      expect(timingEntry?.message).toBe('Stage completed in 0ms');

      // Should include agent response time entry even with 0 duration
      const responseEntry = result.find(entry => entry.category === 'performance');
      expect(responseEntry).toBeDefined();
      expect(responseEntry?.message).toBe('Agent response time: 0ms');

      // Should include token entry even with 0 tokens
      const tokenEntry = result.find(entry => entry.category === 'tokens');
      expect(tokenEntry).toBeDefined();
      expect(tokenEntry?.message).toBe('Token usage: 0 total (0 in, 0 out)');

      // Should include tool entry even with 0 usage time
      const toolEntry = result.find(entry => entry.category === 'tools');
      expect(toolEntry).toBeDefined();
      expect(toolEntry?.message).toBe('Tool Test used for 0ms');

      // Should NOT include error entry for 0 errors
      const errorEntry = result.find(entry => entry.category === 'errors');
      expect(errorEntry).toBeUndefined();

      // Should NOT include metrics entry for 0 tokens per second
      const metricsEntry = result.find(entry => entry.category === 'metrics');
      expect(metricsEntry).toBeUndefined();
    });

    it('should handle missing optional fields in agentTokens', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          'minimal-agent': {
            inputTokens: 100,
            outputTokens: 50,
            // Missing estimatedCost, cacheCreationInputTokens, cacheReadInputTokens
          },
          'complete-agent': {
            inputTokens: 200,
            outputTokens: 100,
            estimatedCost: 0.05,
            cacheCreationInputTokens: 20,
            cacheReadInputTokens: 10,
          },
        },
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

      const result = convertVerboseDataToLogEntries(verboseData);

      const tokenEntries = result.filter(entry => entry.category === 'tokens');
      expect(tokenEntries).toHaveLength(2);

      // Minimal agent entry
      const minimalEntry = tokenEntries.find(entry => entry.agent === 'minimal-agent');
      expect(minimalEntry?.data).toMatchObject({
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: undefined,
      });

      // Complete agent entry
      const completeEntry = tokenEntries.find(entry => entry.agent === 'complete-agent');
      expect(completeEntry?.data).toMatchObject({
        inputTokens: 200,
        outputTokens: 100,
        estimatedCost: 0.05,
      });
    });

    it('should handle special characters in agent and tool names', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          'agent-with-dashes': {
            inputTokens: 100,
            outputTokens: 50,
          },
          'agent_with_underscores': {
            inputTokens: 150,
            outputTokens: 75,
          },
          'Agent With Spaces': {
            inputTokens: 200,
            outputTokens: 100,
          },
          'агент': { // Cyrillic characters
            inputTokens: 50,
            outputTokens: 25,
          },
          '🤖-agent': { // Emoji
            inputTokens: 75,
            outputTokens: 35,
          },
        },
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {
            'agent-with-dashes': 1000,
            'agent_with_underscores': 1500,
            'Agent With Spaces': 2000,
            'агент': 500,
            '🤖-agent': 750,
          },
          toolUsageTimes: {
            'Tool-With-Dashes': 1000,
            'Tool_With_Underscores': 1500,
            'Tool With Spaces': 2000,
            'инструмент': 500,
            '🔧Tool': 750,
          },
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
          toolEfficiency: {
            'Tool-With-Dashes': 0.95,
            'Tool_With_Underscores': 0.87,
            'Tool With Spaces': 0.92,
            'инструмент': 0.88,
            '🔧Tool': 0.91,
          },
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      // Should handle all agent names correctly
      const tokenEntries = result.filter(entry => entry.category === 'tokens');
      expect(tokenEntries).toHaveLength(5);

      const agentNames = tokenEntries.map(entry => entry.agent);
      expect(agentNames).toContain('agent-with-dashes');
      expect(agentNames).toContain('agent_with_underscores');
      expect(agentNames).toContain('Agent With Spaces');
      expect(agentNames).toContain('агент');
      expect(agentNames).toContain('🤖-agent');

      // Should handle all tool names correctly
      const toolEntries = result.filter(entry => entry.category === 'tools');
      expect(toolEntries).toHaveLength(5);

      const toolMessages = toolEntries.map(entry => entry.message);
      expect(toolMessages).toContain('Tool Tool-With-Dashes used for 1000ms');
      expect(toolMessages).toContain('Tool Tool_With_Underscores used for 1500ms');
      expect(toolMessages).toContain('Tool Tool With Spaces used for 2000ms');
      expect(toolMessages).toContain('Tool инструмент used for 500ms');
      expect(toolMessages).toContain('Tool 🔧Tool used for 750ms');
    });

    it('should handle extremely long values', () => {
      const longString = 'a'.repeat(10000);

      const verboseData: VerboseDebugData = {
        agentTokens: {
          [longString]: {
            inputTokens: 1,
            outputTokens: 1,
          },
        },
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {
            [longString]: 1000,
          },
          toolUsageTimes: {
            [longString]: 500,
          },
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
          toolEfficiency: {
            [longString]: 0.5,
          },
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      // Should handle long names without throwing errors
      expect(result.length).toBeGreaterThan(0);

      const tokenEntry = result.find(entry => entry.category === 'tokens');
      expect(tokenEntry?.agent).toBe(longString);

      const toolEntry = result.find(entry => entry.category === 'tools');
      expect(toolEntry?.data.tool).toBe(longString);
    });

    it('should maintain consistent ID generation across multiple calls', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          'test-agent': {
            inputTokens: 100,
            outputTokens: 50,
          },
        },
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {
            'test-agent': 1000,
          },
          toolUsageTimes: {},
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 5.0,
          averageResponseTime: 1000,
          toolEfficiency: {},
        },
      };

      const result1 = convertVerboseDataToLogEntries(verboseData);
      const result2 = convertVerboseDataToLogEntries(verboseData);

      // IDs should be different between calls (timestamp-based)
      const ids1 = result1.map(entry => entry.id);
      const ids2 = result2.map(entry => entry.id);

      // Should have different IDs due to different timestamps
      expect(ids1).not.toEqual(ids2);

      // But should have the same structure
      expect(result1.length).toBe(result2.length);

      // Same types of entries
      const categories1 = result1.map(entry => entry.category).sort();
      const categories2 = result2.map(entry => entry.category).sort();
      expect(categories1).toEqual(categories2);
    });

    it('should handle NaN and Infinity values in metrics', () => {
      const verboseData: VerboseDebugData = {
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
          tokensPerSecond: NaN,
          averageResponseTime: Infinity,
          memoryUsage: -Infinity,
          cpuUtilization: NaN,
          toolEfficiency: {},
        },
      };

      // Should not throw errors with invalid numeric values
      expect(() => convertVerboseDataToLogEntries(verboseData)).not.toThrow();

      const result = convertVerboseDataToLogEntries(verboseData);

      // Should not create metrics entry when tokensPerSecond is NaN
      const metricsEntry = result.find(entry => entry.category === 'metrics');
      expect(metricsEntry).toBeUndefined();
    });

    it('should preserve order consistency in sorting', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          'agent1': { inputTokens: 100, outputTokens: 50 },
          'agent2': { inputTokens: 200, outputTokens: 100 },
          'agent3': { inputTokens: 150, outputTokens: 75 },
        },
        timing: {
          stageStartTime: new Date(),
          stageDuration: 5000,
          agentResponseTimes: {
            'agent1': 1000,
            'agent2': 2000,
            'agent3': 1500,
          },
          toolUsageTimes: {
            'Tool1': 500,
            'Tool2': 750,
            'Tool3': 600,
          },
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {
            'agent1': 1,
            'agent2': 2,
          },
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 10.0,
          averageResponseTime: 1500,
          toolEfficiency: {
            'Tool1': 0.9,
            'Tool2': 0.85,
            'Tool3': 0.95,
          },
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      // Verify sorted by timestamp
      for (let i = 1; i < result.length; i++) {
        expect(result[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          result[i - 1].timestamp.getTime()
        );
      }

      // Should consistently produce the same order when called multiple times
      const result2 = convertVerboseDataToLogEntries(verboseData);

      // Compare categories in order
      const categories1 = result.map(entry => entry.category);
      const categories2 = result2.map(entry => entry.category);
      expect(categories1).toEqual(categories2);
    });
  });
});