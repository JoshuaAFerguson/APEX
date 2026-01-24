import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepairLoop } from '../repair-loop/repair-loop.js';
import type { RepairLoopHost, RepairQueryResult } from '../repair-loop/repair-loop.js';
import type { RepairContext, StageResult } from '../repair-loop/repair-types.js';
import type { RepairConfig } from '../repair-loop/repair-config.js';
import { DEFAULT_REPAIR_CONFIG } from '../repair-loop/repair-config.js';
import type { FixAttempt, FixAttemptHistory, Task } from '@apexcli/core';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockHost(overrides: Partial<RepairLoopHost> = {}): RepairLoopHost {
  return {
    queryAgent: vi.fn().mockResolvedValue({ text: '{}', tokensUsed: 100, costUsd: 0.001 }),
    rerunStage: vi.fn().mockResolvedValue(makeStageResult({ status: 'completed' })),
    readFiles: vi.fn().mockResolvedValue({}),
    getTask: vi.fn().mockResolvedValue(makeTask()),
    addFixAttempt: vi.fn().mockResolvedValue(undefined),
    getFixAttemptHistory: vi.fn().mockResolvedValue(makeEmptyHistory()),
    getFixAttemptsForError: vi.fn().mockResolvedValue([]),
    emit: vi.fn(),
    addLog: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeStageResult(overrides: Partial<StageResult> = {}): StageResult {
  return {
    stageName: 'implementation',
    agent: 'developer',
    status: 'failed',
    outputs: {},
    artifacts: [],
    summary: 'Stage failed: Type error',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, totalCostCents: 0, executionTimeMs: 0 },
    error: 'Type error in src/file.ts',
    startedAt: new Date(),
    completedAt: new Date(),
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    description: 'Implement feature X',
    status: 'in-progress',
    workflow: 'default',
    priority: 'normal',
    effort: 'medium',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Task;
}

function makeEmptyHistory(): FixAttemptHistory {
  return {
    entries: [],
    totalAttempts: 0,
    resolvedCount: 0,
    failedCount: 0,
    errorAttemptCounts: {},
  };
}

function makeContext(overrides: Partial<RepairContext> = {}): RepairContext {
  return {
    taskId: 'task-1',
    stageName: 'implementation',
    stageAgent: 'developer',
    workflowName: 'default',
    failedResult: makeStageResult(),
    originalError: new Error('src/file.ts(10,5): error TS2322: Type \'string\' is not assignable to type \'number\''),
    stageOutput: [],
    history: makeEmptyHistory(),
    config: DEFAULT_REPAIR_CONFIG,
    currentState: 'idle',
    stateEnteredAt: new Date(),
    iterationCount: 0,
    repairCostSoFar: 0,
    repairTokensUsed: 0,
    loopStartedAt: new Date(),
    ...overrides,
  };
}

function makeDiagnosisResponse(overrides: Partial<{
  rootCause: string;
  errorCategory: string;
  affectedFiles: string[];
  suggestedApproaches: string[];
  confidence: number;
  requiresHumanInput: boolean;
}> = {}): string {
  return JSON.stringify({
    rootCause: 'Type mismatch in function parameter',
    errorCategory: 'type',
    affectedFiles: ['src/file.ts'],
    suggestedApproaches: ['Fix the type annotation', 'Cast the value', 'Change the function signature'],
    confidence: 0.9,
    requiresHumanInput: false,
    ...overrides,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('RepairLoop', () => {
  let host: RepairLoopHost;
  let loop: RepairLoop;

  beforeEach(() => {
    host = createMockHost();
    loop = new RepairLoop(host, DEFAULT_REPAIR_CONFIG);
  });

  describe('attemptRepair - successful resolution', () => {
    it('should resolve on first iteration when validation passes', async () => {
      // Mock diagnosis response
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 500,
        costUsd: 0.01,
      });

      // Mock validation (re-run) succeeds
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'completed', error: undefined }),
      );

      const context = makeContext();
      const result = await loop.attemptRepair(context);

      expect(result.resolved).toBe(true);
      expect(result.terminationReason).toBe('resolved');
      expect(result.attempts.length).toBe(1);
      expect(result.stageResult?.status).toBe('completed');
    });

    it('should resolve on second iteration after first fix fails', async () => {
      let callCount = 0;

      // Mock diagnosis always succeeds
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 500,
        costUsd: 0.01,
      });

      // First validation fails, second succeeds
      (host.rerunStage as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return makeStageResult({ status: 'failed', error: 'Still failing' });
        }
        return makeStageResult({ status: 'completed', error: undefined });
      });

      const context = makeContext();
      const result = await loop.attemptRepair(context);

      expect(result.resolved).toBe(true);
      expect(result.attempts.length).toBe(2);
    });

    it('should emit repair:resolved event on success', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 500,
        costUsd: 0.01,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'completed' }),
      );

      await loop.attemptRepair(makeContext());

      expect(host.emit).toHaveBeenCalledWith('repair:resolved', expect.objectContaining({
        taskId: 'task-1',
        stageName: 'implementation',
      }));
    });
  });

  describe('attemptRepair - termination conditions', () => {
    it('should terminate when max total attempts exceeded', async () => {
      // Mock a history that already has maxTotalAttempts
      const history = makeEmptyHistory();
      history.totalAttempts = 10;
      (host.getFixAttemptHistory as ReturnType<typeof vi.fn>).mockResolvedValue(history);

      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'failed' }),
      );

      const context = makeContext({ history });
      const result = await loop.attemptRepair(context);

      expect(result.resolved).toBe(false);
      expect(result.terminationReason).toBe('max_attempts');
    });

    it('should terminate when per-error attempts exceeded', async () => {
      const errorHash = 'abc123';
      const history: FixAttemptHistory = {
        entries: [],
        totalAttempts: 3,
        resolvedCount: 0,
        failedCount: 3,
        errorAttemptCounts: { [errorHash]: 3 },
      };

      // The classifier will produce a fingerprint, and the error count check
      // happens based on that fingerprint's hash
      (host.getFixAttemptHistory as ReturnType<typeof vi.fn>).mockResolvedValue(history);
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'failed' }),
      );

      const config: RepairConfig = {
        ...DEFAULT_REPAIR_CONFIG,
        fixAttempts: { ...DEFAULT_REPAIR_CONFIG.fixAttempts, maxAttemptsPerError: 3, maxTotalAttempts: 100 },
      };

      const context = makeContext({ history, config });
      // First iteration should work since the actual classified error hash won't match 'abc123'
      // But after the first failed iteration, the history will be refreshed
      const result = await loop.attemptRepair(context);

      // The loop should eventually terminate
      expect(result.resolved).toBe(false);
    });

    it('should terminate when repair cost exceeds budget', async () => {
      // Each query costs $1.50, budget is $2
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 10000,
        costUsd: 1.5,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'failed' }),
      );

      const config: RepairConfig = {
        ...DEFAULT_REPAIR_CONFIG,
        maxRepairCostPerStage: 2.0,
      };

      const context = makeContext({ config });
      const result = await loop.attemptRepair(context);

      // Should terminate after 1-2 iterations due to cost
      expect(result.resolved).toBe(false);
      expect(result.totalTokensUsed).toBeGreaterThan(0);
    });

    it('should terminate when timeout is reached', async () => {
      // Mock slow queries
      (host.queryAgent as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        return { text: makeDiagnosisResponse(), tokensUsed: 100, costUsd: 0.001 };
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'failed' }),
      );

      const config: RepairConfig = {
        ...DEFAULT_REPAIR_CONFIG,
        maxRepairTimeMs: 1, // 1ms timeout — will trigger immediately
      };

      const context = makeContext({ config });
      const result = await loop.attemptRepair(context);

      expect(result.resolved).toBe(false);
    });

    it('should terminate for unrecoverable errors', async () => {
      const context = makeContext({
        originalError: new Error('Error: EACCES: permission denied, open /etc/passwd'),
      });

      const result = await loop.attemptRepair(context);

      expect(result.resolved).toBe(false);
      expect(result.terminationReason).toBe('unrecoverable');
    });

    it('should escalate when diagnosis requires human input', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse({ requiresHumanInput: true }),
        tokensUsed: 100,
        costUsd: 0.001,
      });

      const result = await loop.attemptRepair(makeContext());

      expect(result.resolved).toBe(false);
      expect(result.terminationReason).toBe('escalated');
    });
  });

  describe('attemptRepair - loop detection', () => {
    it('should detect same error recurring 3 times', async () => {
      const errorHash = 'same-hash';
      const history: FixAttemptHistory = {
        entries: [
          { id: '1', taskId: 'task-1', attemptNumber: 1, error: { hash: errorHash, message: 'Error X', category: 'type' }, startedAt: new Date(), approach: 'fix1', result: { success: true, resolved: false } },
          { id: '2', taskId: 'task-1', attemptNumber: 2, error: { hash: errorHash, message: 'Error X', category: 'type' }, startedAt: new Date(), approach: 'fix2', result: { success: true, resolved: false } },
          { id: '3', taskId: 'task-1', attemptNumber: 3, error: { hash: errorHash, message: 'Error X', category: 'type' }, startedAt: new Date(), approach: 'fix3', result: { success: true, resolved: false } },
        ] as FixAttempt[],
        totalAttempts: 3,
        resolvedCount: 0,
        failedCount: 3,
        errorAttemptCounts: { [errorHash]: 3 },
      };

      (host.getFixAttemptHistory as ReturnType<typeof vi.fn>).mockResolvedValue(history);
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'failed' }),
      );

      const config: RepairConfig = {
        ...DEFAULT_REPAIR_CONFIG,
        fixAttempts: { ...DEFAULT_REPAIR_CONFIG.fixAttempts, maxAttemptsPerError: 5, maxTotalAttempts: 20 },
      };

      const context = makeContext({ history, config });
      const result = await loop.attemptRepair(context);

      expect(result.resolved).toBe(false);
      expect(result.terminationReason).toBe('loop_detected');
    });

    it('should detect oscillating error pattern', async () => {
      const history: FixAttemptHistory = {
        entries: [
          { id: '1', taskId: 'task-1', attemptNumber: 1, error: { hash: 'error-A', message: 'Error A', category: 'type' }, startedAt: new Date(), approach: 'fix1', result: { success: true, resolved: false } },
          { id: '2', taskId: 'task-1', attemptNumber: 2, error: { hash: 'error-B', message: 'Error B', category: 'type' }, startedAt: new Date(), approach: 'fix2', result: { success: true, resolved: false } },
          { id: '3', taskId: 'task-1', attemptNumber: 3, error: { hash: 'error-A', message: 'Error A', category: 'type' }, startedAt: new Date(), approach: 'fix3', result: { success: true, resolved: false } },
          { id: '4', taskId: 'task-1', attemptNumber: 4, error: { hash: 'error-B', message: 'Error B', category: 'type' }, startedAt: new Date(), approach: 'fix4', result: { success: true, resolved: false } },
        ] as FixAttempt[],
        totalAttempts: 4,
        resolvedCount: 0,
        failedCount: 4,
        errorAttemptCounts: { 'error-A': 2, 'error-B': 2 },
      };

      (host.getFixAttemptHistory as ReturnType<typeof vi.fn>).mockResolvedValue(history);
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'failed' }),
      );

      const config: RepairConfig = {
        ...DEFAULT_REPAIR_CONFIG,
        fixAttempts: { ...DEFAULT_REPAIR_CONFIG.fixAttempts, maxAttemptsPerError: 10, maxTotalAttempts: 20 },
      };

      const context = makeContext({ history, config });
      const result = await loop.attemptRepair(context);

      expect(result.resolved).toBe(false);
      expect(result.terminationReason).toBe('loop_detected');
    });
  });

  describe('attemptRepair - event emission', () => {
    it('should emit repair:started on first observation', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'completed' }),
      );

      await loop.attemptRepair(makeContext());

      expect(host.emit).toHaveBeenCalledWith('repair:started', expect.objectContaining({
        taskId: 'task-1',
        stageName: 'implementation',
      }));
    });

    it('should emit repair:state-change for each transition', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'completed' }),
      );

      await loop.attemptRepair(makeContext());

      const stateChangeCalls = (host.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([event]) => event === 'repair:state-change',
      );
      expect(stateChangeCalls.length).toBeGreaterThan(0);

      // Should transition through: idle→observing→diagnosing→planning_fix→applying_fix→validating→resolved→terminated
      const states = stateChangeCalls.map(([, payload]) => payload.toState);
      expect(states).toContain('observing');
      expect(states).toContain('diagnosing');
      expect(states).toContain('validating');
      expect(states).toContain('resolved');
      expect(states).toContain('terminated');
    });

    it('should emit repair:terminated with correct reason', async () => {
      const context = makeContext({
        originalError: new Error('Error: connect ECONNREFUSED'),
      });

      await loop.attemptRepair(context);

      expect(host.emit).toHaveBeenCalledWith('repair:terminated', expect.objectContaining({
        reason: 'unrecoverable',
        resolved: false,
      }));
    });

    it('should emit repair:diagnosis with diagnosis details', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse({ rootCause: 'Missing type annotation' }),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'completed' }),
      );

      await loop.attemptRepair(makeContext());

      expect(host.emit).toHaveBeenCalledWith('repair:diagnosis', expect.objectContaining({
        diagnosis: expect.objectContaining({
          rootCause: 'Missing type annotation',
        }),
      }));
    });

    it('should emit repair:fix-applied with attempt details', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'completed' }),
      );

      await loop.attemptRepair(makeContext());

      expect(host.emit).toHaveBeenCalledWith('repair:fix-applied', expect.objectContaining({
        taskId: 'task-1',
        attempt: expect.objectContaining({
          taskId: 'task-1',
        }),
      }));
    });
  });

  describe('attemptRepair - persistence', () => {
    it('should persist each fix attempt via addFixAttempt', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'completed' }),
      );

      await loop.attemptRepair(makeContext());

      expect(host.addFixAttempt).toHaveBeenCalledWith('task-1', expect.objectContaining({
        taskId: 'task-1',
        stage: 'implementation',
      }));
    });

    it('should refresh history after each iteration', async () => {
      let iterationCount = 0;
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        iterationCount++;
        if (iterationCount < 2) {
          return makeStageResult({ status: 'failed' });
        }
        return makeStageResult({ status: 'completed' });
      });

      await loop.attemptRepair(makeContext());

      // getFixAttemptHistory should be called after each fix is applied
      expect(host.getFixAttemptHistory).toHaveBeenCalled();
    });
  });

  describe('attemptRepair - diagnosis fallback', () => {
    it('should handle non-JSON diagnosis responses gracefully', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: 'This is not JSON. The error seems to be a type mismatch.',
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'completed' }),
      );

      const result = await loop.attemptRepair(makeContext());

      // Should still work with fallback diagnosis
      expect(result.resolved).toBe(true);
    });

    it('should use error-based diagnosis when Claude response is empty', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: '',
        tokensUsed: 0,
        costUsd: 0,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'completed' }),
      );

      const result = await loop.attemptRepair(makeContext());

      expect(result.resolved).toBe(true);
    });
  });

  describe('attemptRepair - backoff', () => {
    it('should apply exponential backoff between iterations', async () => {
      const sleepSpy = vi.spyOn(global, 'setTimeout');
      let iterations = 0;

      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        iterations++;
        if (iterations < 3) {
          return makeStageResult({ status: 'failed' });
        }
        return makeStageResult({ status: 'completed' });
      });

      // Use a config with short backoff for testing
      const config: RepairConfig = {
        ...DEFAULT_REPAIR_CONFIG,
        fixAttempts: {
          ...DEFAULT_REPAIR_CONFIG.fixAttempts,
          backoffStrategy: 'exponential',
          baseDelayMs: 10,
          maxDelayMs: 100,
        },
      };

      await loop.attemptRepair(makeContext({ config }));

      // The loop should have completed after 3 iterations
      expect(iterations).toBe(3);
      sleepSpy.mockRestore();
    });
  });

  describe('attemptRepair - escalation report', () => {
    it('should generate escalation report on termination', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: JSON.stringify({
          summary: 'Cannot resolve type error',
          rootCauseAnalysis: 'Missing type definition',
          suggestedActions: ['Add type definition', 'Install @types package'],
        }),
        tokensUsed: 100,
        costUsd: 0.001,
      });

      // Make it fail with unrecoverable
      const context = makeContext({
        originalError: new Error('Error: EACCES: permission denied'),
      });

      const result = await loop.attemptRepair(context);

      expect(result.escalationReport).toBeDefined();
      expect(result.escalationReport?.affectedFiles).toBeDefined();
      expect(result.escalationReport?.errorFingerprints).toBeDefined();
    });

    it('should include all attempted approaches in escalation summary', async () => {
      let iterations = 0;
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'failed' }),
      );
      (host.getFixAttemptHistory as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        iterations++;
        return {
          entries: [],
          totalAttempts: iterations >= 10 ? 10 : iterations,
          resolvedCount: 0,
          failedCount: iterations,
          errorAttemptCounts: {},
        };
      });

      const config: RepairConfig = {
        ...DEFAULT_REPAIR_CONFIG,
        fixAttempts: { ...DEFAULT_REPAIR_CONFIG.fixAttempts, maxTotalAttempts: 2 },
        maxRepairTimeMs: 60000,
      };

      const result = await loop.attemptRepair(makeContext({ config }));

      expect(result.resolved).toBe(false);
      expect(result.attempts.length).toBeGreaterThan(0);
      expect(result.escalationReport).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should respect validateAfterFix=false by skipping validation', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });

      const config: RepairConfig = {
        ...DEFAULT_REPAIR_CONFIG,
        validateAfterFix: false,
        fixAttempts: { ...DEFAULT_REPAIR_CONFIG.fixAttempts, maxTotalAttempts: 1 },
      };

      // With validateAfterFix=false, the loop won't call rerunStage
      // But it also won't know if the fix worked, so it'll terminate after max attempts
      const result = await loop.attemptRepair(makeContext({ config }));

      expect(host.rerunStage).not.toHaveBeenCalled();
    });

    it('should track total duration in result', async () => {
      (host.queryAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: makeDiagnosisResponse(),
        tokensUsed: 100,
        costUsd: 0.001,
      });
      (host.rerunStage as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeStageResult({ status: 'completed' }),
      );

      const result = await loop.attemptRepair(makeContext());

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
