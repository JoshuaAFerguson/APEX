import { describe, it, expect } from 'vitest';
import { convertVerboseDataToLogEntries } from '../App.js';
import type { VerboseDebugData } from '@apexcli/core';
import type { LogEntry } from '../components/ActivityLog.js';

describe('convertVerboseDataToLogEntries', () => {
  const createMockVerboseData = (overrides: Partial<VerboseDebugData> = {}): VerboseDebugData => ({
    agentTokens: {
      'test-agent': {
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 50,
        estimatedCost: 0.05,
      },
      'another-agent': {
        inputTokens: 2000,
        outputTokens: 800,
        estimatedCost: 0.12,
      },
    },
    timing: {
      stageStartTime: new Date('2023-01-01T10:00:00Z'),
      stageEndTime: new Date('2023-01-01T10:05:00Z'),
      stageDuration: 300000,
      agentResponseTimes: {
        'test-agent': 2000,
        'another-agent': 3500,
      },
      toolUsageTimes: {
        Read: 1000,
        Write: 750,
        Bash: 2000,
      },
    },
    agentDebug: {
      conversationLength: {
        'test-agent': 5,
        'another-agent': 8,
      },
      toolCallCounts: {
        'test-agent': { Read: 3, Write: 2 },
        'another-agent': { Write: 4, Bash: 1 },
      },
      errorCounts: {
        'test-agent': 0,
        'another-agent': 1,
      },
      retryAttempts: {
        'test-agent': 0,
        'another-agent': 1,
      },
    },
    metrics: {
      tokensPerSecond: 10.5,
      averageResponseTime: 2750,
      memoryUsage: 256000000,
      cpuUtilization: 25.5,
      toolEfficiency: {
        Read: 1.0,
        Write: 0.95,
        Bash: 0.87,
      },
    },
    ...overrides,
  });

  describe('basic functionality', () => {
    it('should convert complete VerboseDebugData to LogEntry array', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);

      // Verify each entry has required fields
      entries.forEach((entry) => {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('level');
        expect(entry).toHaveProperty('message');
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(['debug', 'info', 'warn', 'error', 'success']).toContain(entry.level);
      });
    });

    it('should generate entries from all major categories', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      // Check that different categories are represented
      const categories = entries.map(entry => entry.category).filter(Boolean);
      expect(categories).toContain('timing');
      expect(categories).toContain('performance');
      expect(categories).toContain('metrics');
      expect(categories).toContain('tokens');
      expect(categories).toContain('tools');
    });

    it('should sort entries by timestamp', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          entries[i - 1].timestamp.getTime()
        );
      }
    });
  });

  describe('timing information conversion', () => {
    it('should create timing entry when stageDuration is present', () => {
      const verboseData = createMockVerboseData({
        timing: {
          stageStartTime: new Date('2023-01-01T10:00:00Z'),
          stageEndTime: new Date('2023-01-01T10:05:00Z'),
          stageDuration: 300000,
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
      });

      const entries = convertVerboseDataToLogEntries(verboseData);
      const timingEntry = entries.find(entry => entry.category === 'timing');

      expect(timingEntry).toBeDefined();
      expect(timingEntry!.level).toBe('info');
      expect(timingEntry!.message).toContain('Stage completed in 300000ms');
      expect(timingEntry!.data).toHaveProperty('duration', 300000);
    });

    it('should not create timing entry when stageDuration is missing', () => {
      const verboseData = createMockVerboseData({
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: {},
        },
      });

      const entries = convertVerboseDataToLogEntries(verboseData);
      const timingEntry = entries.find(entry => entry.category === 'timing');

      expect(timingEntry).toBeUndefined();
    });

    it('should create agent response time entries', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      const agentEntries = entries.filter(entry =>
        entry.category === 'performance' && entry.agent
      );

      expect(agentEntries.length).toBe(2); // test-agent and another-agent

      const testAgentEntry = agentEntries.find(entry => entry.agent === 'test-agent');
      expect(testAgentEntry).toBeDefined();
      expect(testAgentEntry!.level).toBe('debug');
      expect(testAgentEntry!.message).toContain('Agent response time: 2000ms');
      expect(testAgentEntry!.duration).toBe(2000);
    });

    it('should create tool usage time entries', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      const toolEntries = entries.filter(entry => entry.category === 'tools');

      expect(toolEntries.length).toBe(3); // Read, Write, Bash

      const readEntry = toolEntries.find(entry =>
        entry.message.includes('Read used for')
      );
      expect(readEntry).toBeDefined();
      expect(readEntry!.level).toBe('debug');
      expect(readEntry!.duration).toBe(1000);
      expect(readEntry!.data).toHaveProperty('efficiency', 1.0);
    });
  });

  describe('metrics conversion', () => {
    it('should create metrics entry when tokensPerSecond > 0', () => {
      const verboseData = createMockVerboseData({
        metrics: {
          tokensPerSecond: 15.5,
          averageResponseTime: 2000,
          toolEfficiency: {},
        },
      });

      const entries = convertVerboseDataToLogEntries(verboseData);
      const metricsEntry = entries.find(entry => entry.category === 'metrics');

      expect(metricsEntry).toBeDefined();
      expect(metricsEntry!.level).toBe('info');
      expect(metricsEntry!.message).toContain('Processing rate: 15.50 tokens/sec');
      expect(metricsEntry!.data).toHaveProperty('tokensPerSecond', 15.5);
    });

    it('should not create metrics entry when tokensPerSecond is 0', () => {
      const verboseData = createMockVerboseData({
        metrics: {
          tokensPerSecond: 0,
          averageResponseTime: 0,
          toolEfficiency: {},
        },
      });

      const entries = convertVerboseDataToLogEntries(verboseData);
      const metricsEntry = entries.find(entry => entry.category === 'metrics');

      expect(metricsEntry).toBeUndefined();
    });

    it('should include system metrics when available', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      const metricsEntry = entries.find(entry => entry.category === 'metrics');
      expect(metricsEntry!.data).toHaveProperty('memoryUsage', 256000000);
      expect(metricsEntry!.data).toHaveProperty('cpuUtilization', 25.5);
    });
  });

  describe('agent token usage conversion', () => {
    it('should create token usage entries for each agent', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      const tokenEntries = entries.filter(entry => entry.category === 'tokens');

      expect(tokenEntries.length).toBe(2); // test-agent and another-agent

      const testAgentEntry = tokenEntries.find(entry => entry.agent === 'test-agent');
      expect(testAgentEntry).toBeDefined();
      expect(testAgentEntry!.level).toBe('debug');
      expect(testAgentEntry!.message).toContain('Token usage: 1500 total (1000 in, 500 out)');
      expect(testAgentEntry!.data).toHaveProperty('inputTokens', 1000);
      expect(testAgentEntry!.data).toHaveProperty('outputTokens', 500);
      expect(testAgentEntry!.data).toHaveProperty('estimatedCost', 0.05);
    });

    it('should handle agents without cache data', () => {
      const verboseData = createMockVerboseData({
        agentTokens: {
          'simple-agent': {
            inputTokens: 100,
            outputTokens: 50,
          },
        },
      });

      const entries = convertVerboseDataToLogEntries(verboseData);
      const tokenEntry = entries.find(entry =>
        entry.category === 'tokens' && entry.agent === 'simple-agent'
      );

      expect(tokenEntry).toBeDefined();
      expect(tokenEntry!.message).toContain('150 total (100 in, 50 out)');
    });
  });

  describe('error and retry conversion', () => {
    it('should create error entries for agents with errors', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      const errorEntries = entries.filter(entry => entry.category === 'errors');

      expect(errorEntries.length).toBe(1); // Only another-agent has errors

      const errorEntry = errorEntries[0];
      expect(errorEntry.agent).toBe('another-agent');
      expect(errorEntry.level).toBe('warn');
      expect(errorEntry.message).toContain('Agent another-agent encountered 1 error(s)');
      expect(errorEntry.data).toHaveProperty('errorCount', 1);
      expect(errorEntry.data).toHaveProperty('retryAttempts', 1);
    });

    it('should not create error entries for agents without errors', () => {
      const verboseData = createMockVerboseData({
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: { 'test-agent': 0 },
          retryAttempts: { 'test-agent': 0 },
        },
      });

      const entries = convertVerboseDataToLogEntries(verboseData);
      const errorEntries = entries.filter(entry => entry.category === 'errors');

      expect(errorEntries.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty verboseData gracefully', () => {
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

      const entries = convertVerboseDataToLogEntries(verboseData);
      expect(entries).toEqual([]);
    });

    it('should handle missing optional fields in metrics', () => {
      const verboseData = createMockVerboseData({
        metrics: {
          tokensPerSecond: 5.0,
          averageResponseTime: 1000,
          toolEfficiency: { Read: 0.95 },
        },
      });

      const entries = convertVerboseDataToLogEntries(verboseData);
      const metricsEntry = entries.find(entry => entry.category === 'metrics');

      expect(metricsEntry).toBeDefined();
      expect(metricsEntry!.data).not.toHaveProperty('memoryUsage');
      expect(metricsEntry!.data).not.toHaveProperty('cpuUtilization');
    });

    it('should handle agents with missing retry attempts data', () => {
      const verboseData = createMockVerboseData({
        agentDebug: {
          conversationLength: {},
          toolCallCounts: {},
          errorCounts: { 'error-agent': 2 },
          retryAttempts: {}, // Missing retry data for error-agent
        },
      });

      const entries = convertVerboseDataToLogEntries(verboseData);
      const errorEntry = entries.find(entry =>
        entry.category === 'errors' && entry.agent === 'error-agent'
      );

      expect(errorEntry).toBeDefined();
      expect(errorEntry!.data).toHaveProperty('retryAttempts', 0);
    });

    it('should generate unique IDs for all entries', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      const ids = entries.map(entry => entry.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should handle tool efficiency with missing tools', () => {
      const verboseData = createMockVerboseData({
        timing: {
          stageStartTime: new Date(),
          agentResponseTimes: {},
          toolUsageTimes: { Write: 500, UnknownTool: 1000 },
        },
        metrics: {
          tokensPerSecond: 5.0,
          averageResponseTime: 1000,
          toolEfficiency: { Write: 0.9 }, // Missing UnknownTool
        },
      });

      const entries = convertVerboseDataToLogEntries(verboseData);
      const toolEntries = entries.filter(entry => entry.category === 'tools');

      const unknownToolEntry = toolEntries.find(entry =>
        entry.message.includes('UnknownTool')
      );
      expect(unknownToolEntry!.data).toHaveProperty('efficiency', 0);
    });
  });

  describe('data structure validation', () => {
    it('should create entries with correct LogEntry structure', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      entries.forEach(entry => {
        // Required fields
        expect(typeof entry.id).toBe('string');
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(typeof entry.level).toBe('string');
        expect(typeof entry.message).toBe('string');

        // Optional fields when present
        if (entry.agent) {
          expect(typeof entry.agent).toBe('string');
        }
        if (entry.category) {
          expect(typeof entry.category).toBe('string');
        }
        if (entry.data) {
          expect(typeof entry.data).toBe('object');
        }
        if (entry.duration) {
          expect(typeof entry.duration).toBe('number');
        }
      });
    });

    it('should set appropriate log levels for different entry types', () => {
      const verboseData = createMockVerboseData();
      const entries = convertVerboseDataToLogEntries(verboseData);

      const timingEntry = entries.find(entry => entry.category === 'timing');
      expect(timingEntry!.level).toBe('info');

      const performanceEntry = entries.find(entry => entry.category === 'performance');
      expect(performanceEntry!.level).toBe('debug');

      const metricsEntry = entries.find(entry => entry.category === 'metrics');
      expect(metricsEntry!.level).toBe('info');

      const tokensEntry = entries.find(entry => entry.category === 'tokens');
      expect(tokensEntry!.level).toBe('debug');

      const toolsEntry = entries.find(entry => entry.category === 'tools');
      expect(toolsEntry!.level).toBe('debug');

      const errorEntry = entries.find(entry => entry.category === 'errors');
      if (errorEntry) {
        expect(errorEntry.level).toBe('warn');
      }
    });
  });
});