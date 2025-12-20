import { describe, it, expect } from 'vitest';
import {
  VerboseDebugData,
  AgentUsage,
  StageResult,
  TaskUsage,
} from '../types';

describe('VerboseDebugData Integration Tests', () => {
  describe('integration with existing task types', () => {
    it('should integrate with StageResult type', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          planner: {
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationInputTokens: 100,
            cacheReadInputTokens: 50,
          },
        },
        timing: {
          stageStartTime: new Date('2023-01-01T10:00:00Z'),
          stageEndTime: new Date('2023-01-01T10:05:00Z'),
          stageDuration: 300000,
          agentResponseTimes: {
            planner: 2000,
          },
          toolUsageTimes: {
            Read: 500,
            Write: 750,
          },
        },
        agentDebug: {
          conversationLength: {
            planner: 8,
          },
          toolCallCounts: {
            planner: {
              Read: 5,
              Write: 3,
            },
          },
          errorCounts: {
            planner: 0,
          },
          retryAttempts: {
            planner: 0,
          },
        },
        metrics: {
          tokensPerSecond: 10.0,
          averageResponseTime: 2000,
          toolEfficiency: {
            Read: 1.0,
            Write: 0.95,
          },
          memoryUsage: 128000000,
          cpuUtilization: 15.5,
        },
      };

      // Create a StageResult that could potentially include verbose debug data
      const stageResult: StageResult = {
        stageName: 'planning',
        agent: 'planner',
        status: 'completed',
        outputs: {
          plan: 'Feature implementation plan',
          verboseDebug: verboseData, // VerboseDebugData can be included in outputs
        },
        artifacts: ['plan.md', 'requirements.md'],
        summary: 'Planning stage completed successfully',
        usage: {
          inputTokens: verboseData.agentTokens.planner.inputTokens,
          outputTokens: verboseData.agentTokens.planner.outputTokens,
          totalTokens: verboseData.agentTokens.planner.inputTokens + verboseData.agentTokens.planner.outputTokens,
          estimatedCost: 0.05,
        },
        startedAt: verboseData.timing.stageStartTime,
        completedAt: verboseData.timing.stageEndTime!,
      };

      expect(stageResult.outputs.verboseDebug).toBeDefined();
      expect(stageResult.outputs.verboseDebug.metrics.tokensPerSecond).toBe(10.0);
      expect(stageResult.usage.inputTokens).toBe(verboseData.agentTokens.planner.inputTokens);
    });

    it('should work with TaskUsage calculations', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          planner: { inputTokens: 500, outputTokens: 250 },
          developer: { inputTokens: 1000, outputTokens: 500 },
          reviewer: { inputTokens: 300, outputTokens: 150 },
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
          tokensPerSecond: 8.5,
          averageResponseTime: 2500,
          toolEfficiency: {},
        },
      };

      // Calculate total usage from verbose debug data
      const totalInputTokens = Object.values(verboseData.agentTokens)
        .reduce((sum, usage) => sum + usage.inputTokens, 0);
      const totalOutputTokens = Object.values(verboseData.agentTokens)
        .reduce((sum, usage) => sum + usage.outputTokens, 0);

      const taskUsage: TaskUsage = {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCost: (totalInputTokens + totalOutputTokens) * 0.000001 * 15, // Mock cost calculation
      };

      expect(taskUsage.inputTokens).toBe(1800); // 500 + 1000 + 300
      expect(taskUsage.outputTokens).toBe(900); // 250 + 500 + 150
      expect(taskUsage.totalTokens).toBe(2700);
      expect(taskUsage.estimatedCost).toBe(0.0405); // 2700 * 0.000001 * 15
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty agent tokens gracefully', () => {
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

      expect(Object.keys(verboseData.agentTokens)).toHaveLength(0);
      expect(verboseData.metrics.tokensPerSecond).toBe(0);
      expect(verboseData.metrics.averageResponseTime).toBe(0);
    });

    it('should handle large numbers and edge values', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          'heavy-agent': {
            inputTokens: 1000000, // 1M tokens
            outputTokens: 500000, // 500K tokens
            cacheCreationInputTokens: 100000,
            cacheReadInputTokens: 50000,
          },
        },
        timing: {
          stageStartTime: new Date('2023-01-01T00:00:00Z'),
          stageEndTime: new Date('2023-01-01T01:00:00Z'), // 1 hour duration
          stageDuration: 3600000, // 1 hour in milliseconds
          agentResponseTimes: {
            'heavy-agent': 30000, // 30 seconds
          },
          toolUsageTimes: {
            'LongRunningTool': 1800000, // 30 minutes
          },
        },
        agentDebug: {
          conversationLength: {
            'heavy-agent': 1000,
          },
          toolCallCounts: {
            'heavy-agent': {
              'LongRunningTool': 500,
            },
          },
          errorCounts: {
            'heavy-agent': 50,
          },
          retryAttempts: {
            'heavy-agent': 25,
          },
        },
        metrics: {
          tokensPerSecond: 416.67, // ~1.5M tokens / 3600 seconds
          averageResponseTime: 30000,
          toolEfficiency: {
            'LongRunningTool': 0.95,
          },
          memoryUsage: 2000000000, // 2GB
          cpuUtilization: 85.5,
        },
      };

      expect(verboseData.agentTokens['heavy-agent'].inputTokens).toBe(1000000);
      expect(verboseData.timing.stageDuration).toBe(3600000);
      expect(verboseData.agentDebug.errorCounts['heavy-agent']).toBe(50);
      expect(verboseData.metrics.memoryUsage).toBe(2000000000);
    });

    it('should handle special characters in agent and tool names', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          'special-agent@v1.0': {
            inputTokens: 100,
            outputTokens: 50,
          },
          'agent_with_underscores': {
            inputTokens: 200,
            outputTokens: 100,
          },
        },
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {
            'special-agent@v1.0': 1000,
            'agent_with_underscores': 1200,
          },
          toolUsageTimes: {
            'Read-v2': 500,
            'Custom_Tool': 750,
          },
        },
        agentDebug: {
          conversationLength: {
            'special-agent@v1.0': 3,
            'agent_with_underscores': 5,
          },
          toolCallCounts: {
            'special-agent@v1.0': {
              'Read-v2': 2,
            },
            'agent_with_underscores': {
              'Custom_Tool': 3,
            },
          },
          errorCounts: {
            'special-agent@v1.0': 0,
            'agent_with_underscores': 1,
          },
          retryAttempts: {
            'special-agent@v1.0': 0,
            'agent_with_underscores': 1,
          },
        },
        metrics: {
          tokensPerSecond: 5.0,
          averageResponseTime: 1100,
          toolEfficiency: {
            'Read-v2': 1.0,
            'Custom_Tool': 0.85,
          },
        },
      };

      expect(verboseData.agentTokens['special-agent@v1.0'].inputTokens).toBe(100);
      expect(verboseData.timing.toolUsageTimes['Read-v2']).toBe(500);
      expect(verboseData.agentDebug.toolCallCounts['agent_with_underscores']['Custom_Tool']).toBe(3);
      expect(verboseData.metrics.toolEfficiency['Custom_Tool']).toBe(0.85);
    });
  });

  describe('performance and optimization use cases', () => {
    it('should support performance analysis workflows', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          analyzer: { inputTokens: 800, outputTokens: 400 },
        },
        timing: {
          stageStartTime: new Date('2023-01-01T10:00:00Z'),
          stageEndTime: new Date('2023-01-01T10:02:30Z'),
          stageDuration: 150000, // 2.5 minutes
          agentResponseTimes: {
            analyzer: 5000, // 5 seconds - slow response
          },
          toolUsageTimes: {
            Read: 2000,
            Grep: 8000, // 8 seconds - bottleneck
            Write: 1000,
          },
        },
        agentDebug: {
          conversationLength: { analyzer: 10 },
          toolCallCounts: {
            analyzer: { Read: 15, Grep: 5, Write: 8 },
          },
          errorCounts: { analyzer: 2 },
          retryAttempts: { analyzer: 3 },
        },
        metrics: {
          tokensPerSecond: 8.0,
          averageResponseTime: 5000,
          toolEfficiency: {
            Read: 1.0,
            Grep: 0.6, // Low efficiency - optimization needed
            Write: 0.95,
          },
          memoryUsage: 512000000,
          cpuUtilization: 45.0,
        },
      };

      // Identify performance bottlenecks
      const slowestTool = Object.entries(verboseData.timing.toolUsageTimes)
        .reduce((max, [tool, time]) => time > max.time ? { tool, time } : max, { tool: '', time: 0 });

      const leastEfficientTool = Object.entries(verboseData.metrics.toolEfficiency)
        .reduce((min, [tool, efficiency]) => efficiency < min.efficiency ? { tool, efficiency } : min, { tool: '', efficiency: 1.0 });

      expect(slowestTool.tool).toBe('Grep');
      expect(slowestTool.time).toBe(8000);
      expect(leastEfficientTool.tool).toBe('Grep');
      expect(leastEfficientTool.efficiency).toBe(0.6);
      expect(verboseData.agentDebug.errorCounts.analyzer).toBeGreaterThan(0);
    });

    it('should support cost optimization analysis', () => {
      const verboseData: VerboseDebugData = {
        agentTokens: {
          'cost-aware-agent': {
            inputTokens: 10000,
            outputTokens: 2000,
            cacheCreationInputTokens: 1000,
            cacheReadInputTokens: 5000, // High cache usage - cost efficient
          },
        },
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: { 'cost-aware-agent': 1500 },
          toolUsageTimes: {},
        },
        agentDebug: {
          conversationLength: { 'cost-aware-agent': 20 },
          toolCallCounts: { 'cost-aware-agent': {} },
          errorCounts: { 'cost-aware-agent': 0 },
          retryAttempts: { 'cost-aware-agent': 0 },
        },
        metrics: {
          tokensPerSecond: 12.0, // High throughput
          averageResponseTime: 1500, // Fast responses
          toolEfficiency: {},
          memoryUsage: 200000000, // Low memory usage
          cpuUtilization: 20.0, // Low CPU usage
        },
      };

      const agent = verboseData.agentTokens['cost-aware-agent'];
      const cacheHitRatio = agent.cacheReadInputTokens! /
        (agent.inputTokens + (agent.cacheCreationInputTokens || 0) + (agent.cacheReadInputTokens || 0));

      const costEfficiency = {
        cacheHitRatio,
        tokensPerSecond: verboseData.metrics.tokensPerSecond,
        errorRate: verboseData.agentDebug.errorCounts['cost-aware-agent'] / verboseData.agentDebug.conversationLength['cost-aware-agent'],
        resourceUtilization: (verboseData.metrics.memoryUsage || 0) / 1000000000 + (verboseData.metrics.cpuUtilization || 0) / 100,
      };

      expect(costEfficiency.cacheHitRatio).toBeCloseTo(0.3125); // 5000 / 16000
      expect(costEfficiency.tokensPerSecond).toBe(12.0);
      expect(costEfficiency.errorRate).toBe(0);
      expect(costEfficiency.resourceUtilization).toBeCloseTo(0.4); // 0.2 + 0.2
    });
  });
});