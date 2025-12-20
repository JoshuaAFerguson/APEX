import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertVerboseDataToLogEntries } from '../App.js';
import type { VerboseDebugData } from '@apexcli/core';

describe('convertVerboseDataToLogEntries', () => {
  beforeEach(() => {
    // Mock Date.now() for consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('timing information conversion', () => {
    it('should convert stage duration to log entry', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date('2023-01-01T10:00:00Z'),
          stageEndTime: new Date('2023-01-01T10:05:00Z'),
          stageDuration: 300000, // 5 minutes
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentTokens: {},
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

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: expect.stringContaining('timing_'),
        level: 'info',
        message: 'Stage completed in 300000ms',
        category: 'timing',
        data: {
          stageStartTime: new Date('2023-01-01T10:00:00Z'),
          stageEndTime: new Date('2023-01-01T10:05:00Z'),
          duration: 300000,
        },
      });
    });

    it('should not create timing entry when stageDuration is missing', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date('2023-01-01T10:00:00Z'),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentTokens: {},
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

      const timingEntries = result.filter(entry => entry.category === 'timing');
      expect(timingEntries).toHaveLength(0);
    });

    it('should convert agent response times to log entries', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {
            'developer': 2000,
            'tester': 1500,
            'reviewer': 3000,
          },
          toolUsageTimes: {},
        },
        agentTokens: {},
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

      const responseTimeEntries = result.filter(entry => entry.category === 'performance');
      expect(responseTimeEntries).toHaveLength(3);

      expect(responseTimeEntries[0]).toMatchObject({
        id: expect.stringContaining('agent_response_developer'),
        level: 'debug',
        message: 'Agent response time: 2000ms',
        agent: 'developer',
        category: 'performance',
        duration: 2000,
        data: {
          responseTime: 2000,
          agent: 'developer',
        },
      });
    });

    it('should convert tool usage times to log entries', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {
            'Read': 1000,
            'Write': 750,
            'Bash': 2000,
          },
        },
        agentTokens: {},
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
            'Read': 0.95,
            'Write': 0.87,
            'Bash': 0.92,
          },
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      const toolEntries = result.filter(entry => entry.category === 'tools');
      expect(toolEntries).toHaveLength(3);

      expect(toolEntries[0]).toMatchObject({
        id: expect.stringContaining('tool_Read'),
        level: 'debug',
        message: 'Tool Read used for 1000ms',
        category: 'tools',
        duration: 1000,
        data: {
          tool: 'Read',
          usageTime: 1000,
          efficiency: 0.95,
        },
      });

      expect(toolEntries[1]).toMatchObject({
        data: {
          tool: 'Write',
          usageTime: 750,
          efficiency: 0.87,
        },
      });

      expect(toolEntries[2]).toMatchObject({
        data: {
          tool: 'Bash',
          usageTime: 2000,
          efficiency: 0.92,
        },
      });
    });
  });

  describe('performance metrics conversion', () => {
    it('should convert performance metrics when tokensPerSecond > 0', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentTokens: {},
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 15.67,
          averageResponseTime: 2500,
          memoryUsage: 256000000,
          cpuUtilization: 45.3,
          toolEfficiency: {},
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      const metricsEntries = result.filter(entry => entry.category === 'metrics');
      expect(metricsEntries).toHaveLength(1);

      expect(metricsEntries[0]).toMatchObject({
        id: expect.stringContaining('metrics_'),
        level: 'info',
        message: 'Processing rate: 15.67 tokens/sec',
        category: 'metrics',
        data: {
          tokensPerSecond: 15.67,
          averageResponseTime: 2500,
          memoryUsage: 256000000,
          cpuUtilization: 45.3,
        },
      });
    });

    it('should not create metrics entry when tokensPerSecond is 0', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentTokens: {},
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

      const metricsEntries = result.filter(entry => entry.category === 'metrics');
      expect(metricsEntries).toHaveLength(0);
    });

    it('should format tokensPerSecond to 2 decimal places', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentTokens: {},
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 12.345678,
          averageResponseTime: 0,
          toolEfficiency: {},
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);
      const metricsEntry = result.find(entry => entry.category === 'metrics');

      expect(metricsEntry?.message).toBe('Processing rate: 12.35 tokens/sec');
    });
  });

  describe('agent token usage conversion', () => {
    it('should convert agent token usage to log entries', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentTokens: {
          'developer': {
            inputTokens: 1000,
            outputTokens: 500,
            estimatedCost: 0.15,
          },
          'tester': {
            inputTokens: 750,
            outputTokens: 300,
            cacheCreationInputTokens: 100,
            cacheReadInputTokens: 50,
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
          toolEfficiency: {},
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      const tokenEntries = result.filter(entry => entry.category === 'tokens');
      expect(tokenEntries).toHaveLength(2);

      expect(tokenEntries[0]).toMatchObject({
        id: expect.stringContaining('tokens_developer'),
        level: 'debug',
        message: 'Token usage: 1500 total (1000 in, 500 out)',
        agent: 'developer',
        category: 'tokens',
        data: {
          inputTokens: 1000,
          outputTokens: 500,
          estimatedCost: 0.15,
        },
      });

      expect(tokenEntries[1]).toMatchObject({
        id: expect.stringContaining('tokens_tester'),
        level: 'debug',
        message: 'Token usage: 1050 total (750 in, 300 out)',
        agent: 'tester',
        category: 'tokens',
        data: {
          inputTokens: 750,
          outputTokens: 300,
          estimatedCost: undefined,
        },
      });
    });

    it('should handle agent tokens with only optional fields', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentTokens: {
          'minimal-agent': {
            inputTokens: 100,
            outputTokens: 50,
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
          toolEfficiency: {},
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      const tokenEntries = result.filter(entry => entry.category === 'tokens');
      expect(tokenEntries).toHaveLength(1);
      expect(tokenEntries[0].data).toMatchObject({
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: undefined,
      });
    });
  });

  describe('error and retry information conversion', () => {
    it('should convert error counts to log entries only when errors > 0', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentTokens: {},
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {
            'developer': 0,
            'tester': 2,
            'reviewer': 1,
          },
          retryAttempts: {
            'developer': 0,
            'tester': 1,
            'reviewer': 1,
          },
        },
        metrics: {
          tokensPerSecond: 0,
          averageResponseTime: 0,
          toolEfficiency: {},
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      const errorEntries = result.filter(entry => entry.category === 'errors');
      expect(errorEntries).toHaveLength(2); // Only tester and reviewer, not developer (0 errors)

      expect(errorEntries[0]).toMatchObject({
        id: expect.stringContaining('errors_tester'),
        level: 'warn',
        message: 'Agent tester encountered 2 error(s)',
        agent: 'tester',
        category: 'errors',
        data: {
          errorCount: 2,
          retryAttempts: 1,
        },
      });

      expect(errorEntries[1]).toMatchObject({
        id: expect.stringContaining('errors_reviewer'),
        level: 'warn',
        message: 'Agent reviewer encountered 1 error(s)',
        agent: 'reviewer',
        category: 'errors',
        data: {
          errorCount: 1,
          retryAttempts: 1,
        },
      });
    });

    it('should handle missing retryAttempts data gracefully', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentTokens: {},
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {
            'problematic-agent': 3,
          },
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 0,
          averageResponseTime: 0,
          toolEfficiency: {},
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      const errorEntries = result.filter(entry => entry.category === 'errors');
      expect(errorEntries).toHaveLength(1);
      expect(errorEntries[0].data).toMatchObject({
        errorCount: 3,
        retryAttempts: 0, // Should default to 0
      });
    });
  });

  describe('edge cases and comprehensive scenarios', () => {
    it('should handle completely empty verboseData', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
        agentTokens: {},
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

      expect(result).toHaveLength(0);
    });

    it('should create comprehensive log entries from full verboseData', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date('2023-01-01T10:00:00Z'),
          stageEndTime: new Date('2023-01-01T10:05:00Z'),
          stageDuration: 300000,
          agentResponseTimes: {
            'developer': 2000,
            'tester': 1500,
          },
          toolUsageTimes: {
            'Read': 1000,
            'Write': 500,
          },
        },
        agentTokens: {
          'developer': {
            inputTokens: 1000,
            outputTokens: 500,
            estimatedCost: 0.10,
          },
          'tester': {
            inputTokens: 750,
            outputTokens: 300,
          },
        },
        agentDebug: {
          conversationLength: {
            'developer': 5,
            'tester': 3,
          },
          toolCallCounts: {
            'developer': { Read: 3, Write: 2 },
            'tester': { Read: 2 },
          },
          errorCounts: {
            'developer': 0,
            'tester': 1,
          },
          retryAttempts: {
            'developer': 0,
            'tester': 1,
          },
        },
        metrics: {
          tokensPerSecond: 10.5,
          averageResponseTime: 1750,
          memoryUsage: 256000000,
          cpuUtilization: 30.0,
          toolEfficiency: {
            'Read': 0.95,
            'Write': 0.87,
          },
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      // Verify all expected categories are present
      const categories = result.map(entry => entry.category).filter(Boolean);
      expect(categories).toContain('timing');
      expect(categories).toContain('performance');
      expect(categories).toContain('metrics');
      expect(categories).toContain('tokens');
      expect(categories).toContain('tools');
      expect(categories).toContain('errors');

      // Verify total count
      expect(result.length).toBeGreaterThan(6); // At least one from each category

      // Verify timing entries
      expect(result.filter(e => e.category === 'timing')).toHaveLength(1);

      // Verify performance entries (agent response times)
      expect(result.filter(e => e.category === 'performance')).toHaveLength(2);

      // Verify metrics entries
      expect(result.filter(e => e.category === 'metrics')).toHaveLength(1);

      // Verify token entries
      expect(result.filter(e => e.category === 'tokens')).toHaveLength(2);

      // Verify tool entries
      expect(result.filter(e => e.category === 'tools')).toHaveLength(2);

      // Verify error entries (only tester has errors > 0)
      expect(result.filter(e => e.category === 'errors')).toHaveLength(1);
    });

    it('should sort entries by timestamp', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          stageDuration: 1000,
          agentResponseTimes: {
            'agent1': 1500,
            'agent2': 1000,
          },
          toolUsageTimes: {},
        },
        agentTokens: {
          'agent1': {
            inputTokens: 100,
            outputTokens: 50,
          },
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 5.0,
          averageResponseTime: 1250,
          toolEfficiency: {},
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      // Verify that entries are sorted by timestamp
      for (let i = 1; i < result.length; i++) {
        expect(result[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          result[i - 1].timestamp.getTime()
        );
      }
    });

    it('should generate unique IDs for all entries', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          stageDuration: 1000,
          agentResponseTimes: {
            'agent1': 1500,
            'agent2': 1000,
          },
          toolUsageTimes: {
            'Read': 500,
            'Write': 300,
          },
        },
        agentTokens: {
          'agent1': {
            inputTokens: 100,
            outputTokens: 50,
          },
          'agent2': {
            inputTokens: 200,
            outputTokens: 75,
          },
        },
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {
            'agent1': 1,
          },
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 5.0,
          averageResponseTime: 1250,
          toolEfficiency: {},
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);
      const ids = result.map(entry => entry.id);

      // Verify all IDs are unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Verify ID format patterns
      expect(ids.some(id => id.includes('timing_'))).toBe(true);
      expect(ids.some(id => id.includes('agent_response_'))).toBe(true);
      expect(ids.some(id => id.includes('tokens_'))).toBe(true);
      expect(ids.some(id => id.includes('tool_'))).toBe(true);
      expect(ids.some(id => id.includes('metrics_'))).toBe(true);
      expect(ids.some(id => id.includes('errors_'))).toBe(true);
    });

    it('should handle missing toolEfficiency data gracefully', () => {
      const verboseData: VerboseDebugData = {
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {
            'UnknownTool': 1000,
          },
        },
        agentTokens: {},
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: {},
          retryAttempts: {},
        },
        metrics: {
          tokensPerSecond: 0,
          averageResponseTime: 0,
          toolEfficiency: {}, // Empty efficiency data
        },
      };

      const result = convertVerboseDataToLogEntries(verboseData);

      const toolEntries = result.filter(entry => entry.category === 'tools');
      expect(toolEntries).toHaveLength(1);
      expect(toolEntries[0].data).toMatchObject({
        tool: 'UnknownTool',
        usageTime: 1000,
        efficiency: 0, // Should default to 0
      });
    });
  });
});