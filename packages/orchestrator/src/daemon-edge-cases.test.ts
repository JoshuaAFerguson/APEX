import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UsageManager } from './usage-manager';
import { SessionManager } from './session-manager';
import { IdleProcessor } from './idle-processor';
import { EnhancedDaemon } from './enhanced-daemon';
import { DaemonConfig, LimitsConfig, TaskUsage, ApexConfig } from '@apexcli/core';
import { promises as fs } from 'fs';

describe('Daemon Edge Cases and Error Handling', () => {
  describe('UsageManager edge cases', () => {
    let usageManager: UsageManager;
    let mockConfig: DaemonConfig;
    let mockLimits: LimitsConfig;

    beforeEach(() => {
      mockConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
        },
      };

      mockLimits = {
        maxTokensPerTask: 100000,
        maxCostPerTask: 5.0,
        maxConcurrentTasks: 2,
        dailyBudget: 50.0,
      };

      usageManager = new UsageManager(mockConfig, mockLimits);
    });

    it('should handle extremely large task usage values', () => {
      const extremeUsage: TaskUsage = {
        inputTokens: Number.MAX_SAFE_INTEGER,
        outputTokens: Number.MAX_SAFE_INTEGER,
        totalTokens: Number.MAX_SAFE_INTEGER,
        estimatedCost: Number.MAX_VALUE,
      };

      usageManager.trackTaskStart('extreme-task');
      usageManager.trackTaskCompletion('extreme-task', extremeUsage, true);

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.totalTokens).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle negative usage values gracefully', () => {
      const negativeUsage: TaskUsage = {
        inputTokens: -1000,
        outputTokens: -500,
        totalTokens: -1500,
        estimatedCost: -10.0,
      };

      usageManager.trackTaskStart('negative-task');
      usageManager.trackTaskCompletion('negative-task', negativeUsage, true);

      const stats = usageManager.getUsageStats();
      // Should handle negative values without crashing
      expect(stats.current.dailyUsage.totalCost).toBe(-10.0);
    });

    it('should handle midnight boundary edge case', () => {
      vi.useFakeTimers();

      // Set time to 11:59 PM
      const beforeMidnight = new Date('2024-01-01T23:59:00Z');
      vi.setSystemTime(beforeMidnight);

      const usageBeforeMidnight = usageManager.getCurrentUsage();

      // Advance to 12:01 AM next day
      const afterMidnight = new Date('2024-01-02T00:01:00Z');
      vi.setSystemTime(afterMidnight);

      const usageAfterMidnight = usageManager.getCurrentUsage();

      // Mode might change based on night hour configuration
      expect(usageAfterMidnight.currentMode).toBe('night');

      vi.useRealTimers();
    });

    it('should handle time zone changes', () => {
      const originalTimezone = process.env.TZ;

      try {
        // Test with different timezone
        process.env.TZ = 'Asia/Tokyo';
        const tokyoUsage = usageManager.getCurrentUsage();

        process.env.TZ = 'America/New_York';
        const nyUsage = usageManager.getCurrentUsage();

        // Both should work without errors
        expect(tokyoUsage.currentMode).toBeDefined();
        expect(nyUsage.currentMode).toBeDefined();
      } finally {
        process.env.TZ = originalTimezone;
      }
    });

    it('should handle corrupted daily stats', () => {
      // Force corrupted state
      usageManager['currentDayStats'] = {
        date: 'invalid-date',
        totalTokens: NaN,
        totalCost: Infinity,
        tasksCompleted: -1,
        tasksFailed: NaN,
        peakConcurrentTasks: undefined as any,
        modeBreakdown: null as any,
      };

      // Should not crash when getting stats
      const stats = usageManager.getUsageStats();
      expect(stats).toBeDefined();
      expect(stats.efficiency.successRate).toBeNaN();
    });

    it('should handle rapid task start/stop cycles', () => {
      // Simulate rapid operations
      for (let i = 0; i < 1000; i++) {
        usageManager.trackTaskStart(`rapid-task-${i}`);
        usageManager.trackTaskCompletion(`rapid-task-${i}`, {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.01,
        }, true);
      }

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.tasksCompleted).toBe(1000);
      expect(stats.current.dailyUsage.totalCost).toBeCloseTo(10.0);
    });
  });

  describe('SessionManager edge cases', () => {
    let sessionManager: SessionManager;
    let testProjectPath: string;

    beforeEach(async () => {
      testProjectPath = '/tmp/test-session-edge-cases';

      const config: DaemonConfig = {
        sessionRecovery: {
          enabled: true,
          autoResume: true,
          contextSummarizationThreshold: 10,
        },
      };

      sessionManager = new SessionManager({
        projectPath: testProjectPath,
        config,
      });

      // Mock fs operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('{}');
      vi.mocked(fs.readdir).mockResolvedValue([]);
    });

    it('should handle extremely long conversation history', async () => {
      const hugeConversation = Array.from({ length: 10000 }, (_, i) => ({
        type: 'assistant' as const,
        timestamp: new Date(),
        content: [{
          type: 'text' as const,
          text: `Message ${i}: ${'a'.repeat(1000)}` // Very long message
        }],
      }));

      const summary = await sessionManager.summarizeContext(hugeConversation);

      expect(summary.conversationLength).toBe(10000);
      expect(summary.currentContext.length).toBeLessThanOrEqual(1000); // Should be truncated
      expect(summary.keyDecisions.length).toBeLessThanOrEqual(5); // Should be limited
    });

    it('should handle malformed conversation messages', async () => {
      const malformedConversation = [
        { type: 'invalid-type' as any, content: null as any },
        { type: 'assistant', content: [{ type: 'unknown', data: 'invalid' }] as any },
        null as any,
        undefined as any,
        { type: 'assistant', content: [{ type: 'text', text: null }] as any },
      ];

      // Should not crash on malformed data
      const summary = await sessionManager.summarizeContext(malformedConversation);
      expect(summary).toBeDefined();
    });

    it('should handle file system permission errors', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      // Should handle errors gracefully
      await expect(sessionManager.initialize()).rejects.toThrow('Permission denied');

      const restored = await sessionManager.restoreSession('any-task');
      expect(restored.canResume).toBe(false);
    });

    it('should handle checkpoint directory corruption', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'corrupted-file.json',
        'task-123-invalid.json',
        '.hidden-file',
        'not-json.txt',
      ] as any);

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('corrupted')) {
          return Promise.resolve('invalid json content');
        }
        if (path.includes('invalid')) {
          return Promise.resolve('{"incomplete": true');
        }
        return Promise.resolve('{"taskId": "valid", "createdAt": "2024-01-01T00:00:00Z"}');
      });

      const restored = await sessionManager.restoreSession('task-123');
      expect(restored).toBeDefined();
      // Should handle corrupted files gracefully
    });

    it('should handle concurrent checkpoint operations', async () => {
      const mockTask = {
        id: 'concurrent-task',
        currentStage: 'test',
        status: 'running',
        usage: { totalTokens: 100, estimatedCost: 0.01 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockConversation = [{
        type: 'user' as const,
        timestamp: new Date(),
        content: [{ type: 'text' as const, text: 'test' }],
      }];

      // Simulate concurrent checkpoint creation
      const promises = Array.from({ length: 10 }, () =>
        sessionManager.createCheckpoint(mockTask as any, mockConversation)
      );

      const checkpoints = await Promise.all(promises);
      expect(checkpoints).toHaveLength(10);
      // All should have unique checkpoint IDs
      const ids = checkpoints.map(c => c.checkpointId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });

  describe('IdleProcessor edge cases', () => {
    let idleProcessor: IdleProcessor;
    let mockStore: any;
    let mockConfig: DaemonConfig;

    beforeEach(() => {
      mockConfig = {
        idleProcessing: {
          enabled: true,
          idleThreshold: 60000,
          maxIdleTasks: 5,
        },
      };

      mockStore = {
        createTask: vi.fn().mockResolvedValue({ id: 'new-task' }),
        getTasksByStatus: vi.fn().mockResolvedValue([]),
        getAllTasks: vi.fn().mockResolvedValue([]),
      };

      idleProcessor = new IdleProcessor('/test/project', mockConfig, mockStore);

      // Mock exec to prevent actual command execution
      const mockExec = vi.fn().mockImplementation((command: string, options: any, callback?: Function) => {
        const cb = callback || arguments[1];
        cb(null, { stdout: '', stderr: '' });
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should handle command execution timeouts', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any, callback?: Function) => {
        const cb = callback || arguments[1];
        // Simulate timeout
        setTimeout(() => cb(new Error('Command timeout')), 100);
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      // Should not crash on command timeout
      await expect(idleProcessor.processIdleTime()).resolves.toBeUndefined();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis?.codebaseSize.files).toBe(0); // Should have fallback values
    });

    it('should handle extremely large codebases', async () => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any, callback?: Function) => {
        const cb = callback || arguments[1];

        if (command.includes('find . -type f')) {
          // Simulate finding thousands of files
          const files = Array.from({ length: 10000 }, (_, i) => `./file${i}.ts`).join('\n');
          cb(null, { stdout: files });
        } else if (command.includes('wc -l')) {
          cb(null, { stdout: '1000000' }); // Million lines
        } else {
          cb(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockResolvedValue('line\n'.repeat(1000));

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis?.codebaseSize.files).toBe(10000);
      expect(analysis?.codebaseSize.lines).toBeGreaterThan(0);
    });

    it('should handle memory pressure during analysis', async () => {
      const originalMemory = process.memoryUsage;

      // Mock low memory conditions
      process.memoryUsage = vi.fn().mockReturnValue({
        rss: 1024 * 1024 * 1024, // 1GB
        heapTotal: 1024 * 1024 * 1024,
        heapUsed: 1024 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0,
      });

      try {
        await idleProcessor.processIdleTime();
        expect(idleProcessor.getLastAnalysis()).toBeDefined();
      } finally {
        process.memoryUsage = originalMemory;
      }
    });

    it('should handle task generation overflow', async () => {
      // Mock analysis that would generate many tasks
      const overflowAnalysis = {
        codebaseSize: { files: 1000, lines: 100000, languages: {} },
        testCoverage: { percentage: 10, uncoveredFiles: [] },
        dependencies: { outdated: Array.from({ length: 100 }, (_, i) => `lib${i}@0.1.0`), security: [] },
        codeQuality: { lintIssues: 10000, duplicatedCode: [], complexityHotspots: [] },
        documentation: { coverage: 5, missingDocs: [] },
        performance: { slowTests: [], bottlenecks: Array.from({ length: 50 }, (_, i) => `file${i}.ts`) },
      };

      idleProcessor['lastAnalysis'] = overflowAnalysis;
      await idleProcessor['generateImprovementTasks']();

      const tasks = idleProcessor.getGeneratedTasks();
      expect(tasks.length).toBeLessThanOrEqual(5); // Should respect maxIdleTasks limit
    });

    it('should handle project in invalid state', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Project corrupted'));

      const mockExec = vi.fn().mockImplementation((command: string, options: any, callback?: Function) => {
        const cb = callback || arguments[1];
        cb(new Error('Command failed'), { stdout: '', stderr: 'Error' });
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      // Should handle project analysis failure gracefully
      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis?.codebaseSize.files).toBe(0);
      expect(analysis?.dependencies.outdated).toHaveLength(0);
    });
  });

  describe('EnhancedDaemon error recovery', () => {
    let daemon: EnhancedDaemon;
    let testConfig: ApexConfig;

    beforeEach(() => {
      testConfig = {
        version: '1.0',
        project: { name: 'error-test' },
        daemon: {
          watchdog: {
            enabled: true,
            maxRestarts: 2,
            restartDelay: 100,
            restartWindow: 60000,
          },
        },
      };

      daemon = new EnhancedDaemon('/test/project', testConfig);
    });

    it('should handle cascading component failures', async () => {
      // Mock multiple component failures
      const mockStore = daemon['store'];
      const mockOrchestrator = daemon['orchestrator'];

      vi.mocked(mockStore.initialize).mockRejectedValueOnce(new Error('Store failed'))
        .mockRejectedValueOnce(new Error('Store failed again'))
        .mockResolvedValue(undefined);

      vi.mocked(mockOrchestrator.initialize).mockRejectedValue(new Error('Orchestrator failed'));

      let errorCount = 0;
      daemon.on('daemon:error', () => errorCount++);

      // Should fail initially
      await expect(daemon.start()).rejects.toThrow();
      expect(errorCount).toBeGreaterThan(0);
    });

    it('should handle restart loop detection', async () => {
      vi.useFakeTimers();

      await daemon.start();

      let restartAttempts = 0;
      const originalRestart = daemon['restartDaemon'];
      daemon['restartDaemon'] = vi.fn(async () => {
        restartAttempts++;
        if (restartAttempts <= 2) {
          // Simulate restart failure for first attempts
          throw new Error(`Restart attempt ${restartAttempts} failed`);
        }
        return originalRestart.call(daemon);
      });

      // Trigger multiple errors rapidly
      daemon.emit('daemon:error', new Error('Error 1'));
      vi.advanceTimersByTime(100);

      daemon.emit('daemon:error', new Error('Error 2'));
      vi.advanceTimersByTime(100);

      daemon.emit('daemon:error', new Error('Error 3'));
      vi.advanceTimersByTime(100);

      // Should eventually stop trying to restart
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(restartAttempts).toBeLessThanOrEqual(2); // Should respect maxRestarts

      vi.useRealTimers();
      await daemon.stop();
    });

    it('should handle resource exhaustion gracefully', async () => {
      // Simulate resource exhaustion
      const originalSetInterval = global.setInterval;
      global.setInterval = vi.fn().mockImplementation(() => {
        throw new Error('Too many timers');
      });

      try {
        await daemon.start();
        // Should handle timer creation failure
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        global.setInterval = originalSetInterval;
      }
    });

    it('should handle configuration corruption during runtime', async () => {
      await daemon.start();

      // Corrupt the configuration
      daemon['config'] = null as any;

      // Should not crash when accessing config
      const status = await daemon.getStatus();
      expect(status).toBeDefined();

      await daemon.stop();
    });
  });

  describe('Cross-component integration failures', () => {
    it('should handle usage manager and session manager interaction failure', async () => {
      const mockConfig: DaemonConfig = {
        timeBasedUsage: { enabled: true },
        sessionRecovery: { enabled: true },
      };

      const mockLimits: LimitsConfig = {
        dailyBudget: 100,
        maxCostPerTask: 10,
        maxTokensPerTask: 50000,
        maxConcurrentTasks: 3,
      };

      const usageManager = new UsageManager(mockConfig, mockLimits);
      const sessionManager = new SessionManager({
        projectPath: '/test',
        config: mockConfig,
      });

      // Mock session manager failure
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Session save failed'));

      // Usage tracking should still work even if session save fails
      usageManager.trackTaskStart('test-task');

      const mockTask = {
        id: 'test-task',
        currentStage: 'test',
        status: 'running',
        usage: { totalTokens: 1000, estimatedCost: 0.5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // This should not crash the usage manager
      await expect(sessionManager.createCheckpoint(
        mockTask as any,
        [],
        {}
      )).rejects.toThrow('Session save failed');

      // Usage manager should still function
      const stats = usageManager.getUsageStats();
      expect(stats.active).toHaveLength(1);
    });

    it('should handle race conditions between components', async () => {
      const testConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'race-test' },
        daemon: {
          idleProcessing: { enabled: true },
          sessionRecovery: { enabled: true },
        },
      };

      const daemon = new EnhancedDaemon('/test/project', testConfig);

      await daemon.start();

      // Simulate rapid component interactions
      const promises = [
        daemon.getIdleProcessor().processIdleTime(),
        daemon.getUsageManager().getUsageStats(),
        daemon['sessionManager'].cleanupCheckpoints(),
        daemon.getWorkspaceManager().getWorkspaceStats(),
        daemon.getServiceManager().performHealthCheck(),
      ];

      // Should handle concurrent operations without deadlocks
      const results = await Promise.allSettled(promises);
      expect(results).toHaveLength(5);

      await daemon.stop();
    });
  });
});