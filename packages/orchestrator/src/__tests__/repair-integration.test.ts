import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorClassifier } from '../repair-loop/error-classifier.js';
import { RepairLoop } from '../repair-loop/repair-loop.js';
import { resolveRepairConfig, DEFAULT_REPAIR_CONFIG } from '../repair-loop/repair-config.js';
import { buildDiagnosisPrompt, buildRepairPrompt, buildEscalationPrompt } from '../repair-loop/repair-prompts.js';
import type { RepairLoopHost } from '../repair-loop/repair-loop.js';
import type { RepairContext, StageResult, ClassifiedError } from '../repair-loop/repair-types.js';
import type { Task, FixAttempt } from '@apexcli/core';

// ============================================================================
// Test Helpers
// ============================================================================

function makeStageResult(overrides: Partial<StageResult> = {}): StageResult {
  return {
    stageName: 'implementation',
    agent: 'developer',
    status: 'failed',
    outputs: {},
    artifacts: [],
    summary: 'Build failed with type errors',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, totalCostCents: 0, executionTimeMs: 0 },
    error: 'TypeScript compilation failed',
    startedAt: new Date(),
    completedAt: new Date(),
    ...overrides,
  };
}

function makeTask(): Task {
  return {
    id: 'task-integration-1',
    description: 'Implement user authentication module',
    acceptanceCriteria: 'All tests pass, TypeScript compiles',
    status: 'in-progress',
    workflow: 'default',
    priority: 'high',
    effort: 'medium',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Task;
}

// ============================================================================
// Integration: Error Classifier → Diagnosis Prompt → Repair Prompt
// ============================================================================

describe('Repair Loop Integration', () => {
  describe('Error Classification → Prompt Pipeline', () => {
    const classifier = new ErrorClassifier();

    it('should classify TypeScript errors and build diagnosis prompt', () => {
      const error = new Error('src/auth.ts(42,10): error TS2339: Property \'token\' does not exist on type \'User\'');
      const stageResult = makeStageResult({
        error: error.message,
        summary: `Stage failed: ${error.message}`,
      });

      const classified = classifier.classify(error, stageResult, []);
      expect(classified.length).toBeGreaterThan(0);
      expect(classified[0].category).toBe('type');
      expect(classified[0].fingerprint.code).toBe('TS2339');

      // Build diagnosis prompt from classified errors
      const prompt = buildDiagnosisPrompt({
        task: makeTask(),
        stageName: 'implementation',
        stageAgent: 'developer',
        errors: classified,
        previousAttempts: [],
        stageOutput: [error.message],
        fileContents: { 'src/auth.ts': 'interface User { name: string; }\nconst u: User = { name: "test" };\nconsole.log(u.token);' },
        acceptanceCriteria: 'All tests pass',
      });

      expect(prompt).toContain('Error Diagnosis');
      expect(prompt).toContain('TS2339');
      expect(prompt).toContain('src/auth.ts');
      expect(prompt).toContain('type');
      expect(prompt).toContain('implementation');
      expect(prompt).toContain('Implement user authentication');
    });

    it('should include previous attempts as anti-patterns in repair prompt', () => {
      const error = new Error('src/auth.ts(42,10): error TS2339: Property \'token\' does not exist');
      const classified = classifier.classify(error, makeStageResult(), []);

      const previousAttempts: FixAttempt[] = [
        {
          id: 'attempt-1',
          taskId: 'task-1',
          attemptNumber: 1,
          error: classified[0].fingerprint,
          startedAt: new Date(),
          completedAt: new Date(),
          approach: 'Add token property to User interface',
          result: { success: true, resolved: false, reason: 'Introduced new type errors in other files' },
        },
      ];

      const prompt = buildRepairPrompt({
        task: makeTask(),
        stageName: 'implementation',
        stageAgent: 'developer',
        errors: classified,
        previousAttempts,
        stageOutput: [],
        fileContents: { 'src/auth.ts': 'interface User { name: string; }' },
        acceptanceCriteria: 'All tests pass',
        diagnosis: {
          rootCause: 'Missing token property on User type',
          errorCategory: 'type',
          affectedFiles: ['src/auth.ts'],
          suggestedApproaches: ['Extend User interface with token field'],
          confidence: 0.9,
          requiresHumanInput: false,
        },
        fixPlan: {
          approach: 'Add token?: string to User interface',
          steps: ['Open src/auth.ts', 'Add token property', 'Run tsc to verify'],
          filesToModify: ['src/auth.ts'],
          expectedOutcome: 'TypeScript compilation succeeds',
          rollbackStrategy: 'Remove the added property',
        },
        maxFilesPerRepair: 10,
      });

      expect(prompt).toContain('Anti-Patterns');
      expect(prompt).toContain('Add token property to User interface');
      expect(prompt).toContain('Introduced new type errors');
      expect(prompt).toContain('MINIMAL');
    });

    it('should build escalation prompt with full context', () => {
      const error = new Error('src/auth.ts: error TS2339: Property \'token\' does not exist');
      const classified = classifier.classify(error, makeStageResult(), []);

      const prompt = buildEscalationPrompt({
        task: makeTask(),
        stageName: 'implementation',
        errors: classified,
        previousAttempts: [
          { id: '1', taskId: 'task-1', attemptNumber: 1, error: classified[0].fingerprint, startedAt: new Date(), approach: 'Fix A', result: { success: false, resolved: false, reason: 'Failed' } },
          { id: '2', taskId: 'task-1', attemptNumber: 2, error: classified[0].fingerprint, startedAt: new Date(), approach: 'Fix B', result: { success: true, resolved: false, reason: 'New errors' } },
        ] as FixAttempt[],
        terminationReason: 'max_attempts',
      });

      expect(prompt).toContain('Escalation Report');
      expect(prompt).toContain('Maximum repair attempts');
      expect(prompt).toContain('Fix A');
      expect(prompt).toContain('Fix B');
      expect(prompt).toContain('Implement user authentication');
    });
  });

  describe('Configuration Resolution', () => {
    it('should resolve defaults when no config provided', () => {
      const config = resolveRepairConfig(undefined);
      expect(config.enabled).toBe(true);
      expect(config.maxRepairTimeMs).toBe(300000);
      expect(config.maxRepairCostPerStage).toBe(2.0);
      expect(config.fixAttempts.maxAttemptsPerError).toBe(3);
      expect(config.fixAttempts.maxTotalAttempts).toBe(10);
      expect(config.fixAttempts.backoffStrategy).toBe('exponential');
    });

    it('should merge partial config with defaults', () => {
      const config = resolveRepairConfig({
        maxRepairTimeMs: 60000,
        maxFilesPerRepair: 5,
      });
      expect(config.maxRepairTimeMs).toBe(60000);
      expect(config.maxFilesPerRepair).toBe(5);
      expect(config.enabled).toBe(true); // Default preserved
      expect(config.fixAttempts.maxAttemptsPerError).toBe(3); // Default preserved
    });

    it('should allow disabling the repair loop', () => {
      const config = resolveRepairConfig({ enabled: false });
      expect(config.enabled).toBe(false);
    });
  });

  describe('Repair Loop with Mock Host', () => {
    it('should complete full repair cycle: observe → diagnose → plan → apply → validate', async () => {
      const eventLog: string[] = [];

      const host: RepairLoopHost = {
        queryAgent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            rootCause: 'Missing import statement',
            errorCategory: 'type',
            affectedFiles: ['src/service.ts'],
            suggestedApproaches: ['Add the missing import'],
            confidence: 0.95,
            requiresHumanInput: false,
          }),
          tokensUsed: 200,
          costUsd: 0.003,
        }),
        rerunStage: vi.fn().mockResolvedValue(
          makeStageResult({ status: 'completed', error: undefined }),
        ),
        readFiles: vi.fn().mockResolvedValue({
          'src/service.ts': 'export class Service { }\n',
        }),
        getTask: vi.fn().mockResolvedValue(makeTask()),
        addFixAttempt: vi.fn().mockResolvedValue(undefined),
        getFixAttemptHistory: vi.fn().mockResolvedValue({
          entries: [],
          totalAttempts: 0,
          resolvedCount: 0,
          failedCount: 0,
          errorAttemptCounts: {},
        }),
        getFixAttemptsForError: vi.fn().mockResolvedValue([]),
        emit: vi.fn((event: string) => { eventLog.push(event); }),
        addLog: vi.fn().mockResolvedValue(undefined),
      };

      const loop = new RepairLoop(host, DEFAULT_REPAIR_CONFIG);
      const context: RepairContext = {
        taskId: 'task-1',
        stageName: 'implementation',
        stageAgent: 'developer',
        workflowName: 'default',
        failedResult: makeStageResult({
          error: 'src/service.ts(1,1): error TS2304: Cannot find name \'Request\'',
        }),
        originalError: new Error('src/service.ts(1,1): error TS2304: Cannot find name \'Request\''),
        stageOutput: ['src/service.ts(1,1): error TS2304: Cannot find name \'Request\''],
        history: { entries: [], totalAttempts: 0, resolvedCount: 0, failedCount: 0, errorAttemptCounts: {} },
        config: DEFAULT_REPAIR_CONFIG,
        currentState: 'idle',
        stateEnteredAt: new Date(),
        iterationCount: 0,
        repairCostSoFar: 0,
        repairTokensUsed: 0,
        loopStartedAt: new Date(),
      };

      const result = await loop.attemptRepair(context);

      // Verify resolution
      expect(result.resolved).toBe(true);
      expect(result.terminationReason).toBe('resolved');
      expect(result.attempts.length).toBe(1);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.totalTokensUsed).toBeGreaterThan(0);

      // Verify event sequence
      expect(eventLog).toContain('repair:started');
      expect(eventLog).toContain('repair:state-change');
      expect(eventLog).toContain('repair:diagnosis');
      expect(eventLog).toContain('repair:fix-planned');
      expect(eventLog).toContain('repair:fix-applied');
      expect(eventLog).toContain('repair:validation-passed');
      expect(eventLog).toContain('repair:resolved');
      expect(eventLog).toContain('repair:terminated');

      // Verify persistence
      expect(host.addFixAttempt).toHaveBeenCalledTimes(1);
      expect(host.addFixAttempt).toHaveBeenCalledWith('task-1', expect.objectContaining({
        taskId: 'task-1',
        stage: 'implementation',
        approach: expect.any(String),
      }));

      // Verify queryAgent was called (diagnosis + repair)
      expect(host.queryAgent).toHaveBeenCalledTimes(2);
    });

    it('should not attempt repair when all errors are unrecoverable', async () => {
      const host: RepairLoopHost = {
        queryAgent: vi.fn().mockResolvedValue({ text: '{}', tokensUsed: 0, costUsd: 0 }),
        rerunStage: vi.fn(),
        readFiles: vi.fn().mockResolvedValue({}),
        getTask: vi.fn().mockResolvedValue(makeTask()),
        addFixAttempt: vi.fn(),
        getFixAttemptHistory: vi.fn().mockResolvedValue({ entries: [], totalAttempts: 0, resolvedCount: 0, failedCount: 0, errorAttemptCounts: {} }),
        getFixAttemptsForError: vi.fn().mockResolvedValue([]),
        emit: vi.fn(),
        addLog: vi.fn().mockResolvedValue(undefined),
      };

      const loop = new RepairLoop(host, DEFAULT_REPAIR_CONFIG);
      const context: RepairContext = {
        taskId: 'task-1',
        stageName: 'deploy',
        stageAgent: 'devops',
        workflowName: 'default',
        failedResult: makeStageResult({ error: 'Error: EACCES: permission denied' }),
        originalError: new Error('Error: EACCES: permission denied, open /etc/ssl/certs/ca-bundle.crt'),
        stageOutput: [],
        history: { entries: [], totalAttempts: 0, resolvedCount: 0, failedCount: 0, errorAttemptCounts: {} },
        config: DEFAULT_REPAIR_CONFIG,
        currentState: 'idle',
        stateEnteredAt: new Date(),
        iterationCount: 0,
        repairCostSoFar: 0,
        repairTokensUsed: 0,
        loopStartedAt: new Date(),
      };

      const result = await loop.attemptRepair(context);

      expect(result.resolved).toBe(false);
      expect(result.terminationReason).toBe('unrecoverable');
      expect(host.rerunStage).not.toHaveBeenCalled();
      expect(result.escalationReport).toBeDefined();
    });

    it('should avoid repeating previously failed approaches', async () => {
      const queryPrompts: string[] = [];

      const host: RepairLoopHost = {
        queryAgent: vi.fn().mockImplementation(async (prompt: string) => {
          queryPrompts.push(prompt);
          return {
            text: JSON.stringify({
              rootCause: 'Type error',
              errorCategory: 'type',
              affectedFiles: ['src/file.ts'],
              suggestedApproaches: ['Approach A (already tried)', 'Approach B (new)', 'Approach C (new)'],
              confidence: 0.8,
              requiresHumanInput: false,
            }),
            tokensUsed: 100,
            costUsd: 0.001,
          };
        }),
        rerunStage: vi.fn().mockResolvedValue(makeStageResult({ status: 'completed' })),
        readFiles: vi.fn().mockResolvedValue({}),
        getTask: vi.fn().mockResolvedValue(makeTask()),
        addFixAttempt: vi.fn(),
        getFixAttemptHistory: vi.fn().mockResolvedValue({
          entries: [{
            id: '1',
            taskId: 'task-1',
            attemptNumber: 1,
            error: { hash: 'abc', message: 'Error', category: 'type' },
            startedAt: new Date(),
            approach: 'Approach A (already tried)',
            result: { success: true, resolved: false, reason: 'Did not resolve' },
          }],
          totalAttempts: 1,
          resolvedCount: 0,
          failedCount: 1,
          errorAttemptCounts: {},
        }),
        getFixAttemptsForError: vi.fn().mockResolvedValue([]),
        emit: vi.fn(),
        addLog: vi.fn().mockResolvedValue(undefined),
      };

      const loop = new RepairLoop(host, DEFAULT_REPAIR_CONFIG);
      const context: RepairContext = {
        taskId: 'task-1',
        stageName: 'implementation',
        stageAgent: 'developer',
        workflowName: 'default',
        failedResult: makeStageResult(),
        originalError: new Error('src/file.ts(1,1): error TS2322: Type mismatch'),
        stageOutput: [],
        history: {
          entries: [{
            id: '1',
            taskId: 'task-1',
            attemptNumber: 1,
            error: { hash: 'abc', message: 'Error', category: 'type' },
            startedAt: new Date(),
            approach: 'Approach A (already tried)',
            result: { success: true, resolved: false, reason: 'Did not resolve' },
          }] as FixAttempt[],
          totalAttempts: 1,
          resolvedCount: 0,
          failedCount: 1,
          errorAttemptCounts: {},
        },
        config: DEFAULT_REPAIR_CONFIG,
        currentState: 'idle',
        stateEnteredAt: new Date(),
        iterationCount: 0,
        repairCostSoFar: 0,
        repairTokensUsed: 0,
        loopStartedAt: new Date(),
      };

      const result = await loop.attemptRepair(context);

      expect(result.resolved).toBe(true);
      // The repair prompt should reference the failed approach
      const repairPrompt = queryPrompts[1]; // Second call is repair
      if (repairPrompt) {
        expect(repairPrompt).toContain('Approach A (already tried)');
      }
    });
  });

  describe('Multi-Error Classification', () => {
    it('should classify multiple errors from stage output', () => {
      const classifier = new ErrorClassifier();
      const output = [
        'src/auth.ts(10,5): error TS2322: Type \'string\' is not assignable to type \'number\'',
        'src/auth.ts(25,3): error TS2339: Property \'foo\' does not exist on type \'Bar\'',
        'src/utils.ts(5,1): error TS2304: Cannot find name \'xyz\'',
      ];
      const error = new Error('TypeScript compilation failed');
      const result = classifier.classify(error, makeStageResult(), output);

      expect(result.length).toBe(3);
      expect(result[0].fingerprint.code).toBe('TS2322');
      expect(result[1].fingerprint.code).toBe('TS2339');
      expect(result[2].fingerprint.code).toBe('TS2304');

      // All should be type errors
      expect(result.every(e => e.category === 'type')).toBe(true);

      // Should have different file references
      const files = result.map(e => e.fingerprint.filePath);
      expect(files).toContain('src/auth.ts');
      expect(files).toContain('src/utils.ts');
    });
  });
});
