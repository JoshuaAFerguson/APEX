/**
 * Self-Repair Loop State Machine
 *
 * The core engine that drives the autonomous repair cycle. When a workflow stage
 * fails, this module observes the error, diagnoses the root cause via Claude,
 * generates and applies a targeted fix, validates the result, and repeats until
 * the issue is resolved or a termination condition is met.
 *
 * @module repair-loop/repair-loop
 */

import { randomUUID } from 'crypto';
import type { FixAttempt, FixAttemptHistory, FixAttemptDecision, ErrorFingerprint, Task } from '@apexcli/core';
import { ErrorClassifier } from './error-classifier.js';
import {
  buildDiagnosisPrompt,
  buildRepairPrompt,
  buildEscalationPrompt,
} from './repair-prompts.js';
import type { RepairConfig } from './repair-config.js';
import type {
  RepairState,
  RepairContext,
  RepairResult,
  RepairDiagnosis,
  RepairFixPlan,
  ClassifiedError,
  LoopDetectionResult,
  StageResult,
} from './repair-types.js';
import type {
  RepairTerminationReason,
  EscalationReport,
  RepairLoopEvents,
} from './repair-events.js';

// ============================================================================
// Orchestrator Interface (dependency injection)
// ============================================================================

/**
 * Interface the repair loop uses to interact with the orchestrator.
 * This decouples the loop from the full orchestrator implementation.
 */
export interface RepairLoopHost {
  /** Invoke Claude with a prompt and return the collected text response */
  queryAgent(prompt: string, model: string, options?: RepairQueryOptions): Promise<RepairQueryResult>;

  /** Re-run a workflow stage and return the result */
  rerunStage(taskId: string, stageName: string): Promise<StageResult>;

  /** Read file contents for the given paths */
  readFiles(filePaths: string[]): Promise<Record<string, string>>;

  /** Get the task object */
  getTask(taskId: string): Promise<Task | null>;

  /** Persist a fix attempt record */
  addFixAttempt(taskId: string, attempt: FixAttempt): Promise<void>;

  /** Get fix attempt history for a task */
  getFixAttemptHistory(taskId: string): Promise<FixAttemptHistory>;

  /** Get fix attempts for a specific error hash */
  getFixAttemptsForError(taskId: string, errorHash: string): Promise<FixAttempt[]>;

  /** Emit a typed event */
  emit<K extends keyof RepairLoopEvents>(event: K, ...args: Parameters<RepairLoopEvents[K]>): void;

  /** Add a log entry for the task */
  addLog(taskId: string, log: { level: 'error' | 'debug' | 'info' | 'warn'; message: string; stage?: string }): Promise<void>;
}

export interface RepairQueryOptions {
  maxTurns?: number;
  cwd?: string;
  tools?: string[];
}

export interface RepairQueryResult {
  text: string;
  tokensUsed: number;
  costUsd: number;
}

// ============================================================================
// RepairLoop Class
// ============================================================================

export class RepairLoop {
  private readonly classifier: ErrorClassifier;

  constructor(
    private readonly host: RepairLoopHost,
    private readonly config: RepairConfig,
  ) {
    this.classifier = new ErrorClassifier();
  }

  /**
   * Main entry point. Attempts to repair a failed stage by cycling through
   * observe → diagnose → plan → apply → validate until resolved or terminated.
   */
  async attemptRepair(context: RepairContext): Promise<RepairResult> {
    const startTime = Date.now();
    const attempts: FixAttempt[] = [];

    context.currentState = 'idle';
    context.loopStartedAt = new Date();
    context.iterationCount = 0;
    context.repairCostSoFar = 0;
    context.repairTokensUsed = 0;

    try {
      // Main repair loop
      while (true) {
        context.iterationCount++;

        // === OBSERVE ===
        await this.transition(context, 'observing');
        const classifiedErrors = await this.observe(context);

        // Check if any errors are unrecoverable
        const unrecoverable = classifiedErrors.filter(e => !e.isRecoverable);
        if (unrecoverable.length > 0 && classifiedErrors.every(e => !e.isRecoverable)) {
          await this.transition(context, 'escalating');
          const report = await this.buildEscalationReport(context, classifiedErrors, attempts, 'unrecoverable');
          await this.transition(context, 'terminated');
          return this.buildResult(false, attempts, 'unrecoverable', report, startTime, context);
        }

        // Check termination before attempting fix
        const decision = this.shouldTerminate(context, classifiedErrors);
        if (!decision.shouldAttempt) {
          const reason = this.mapDecisionToTermination(decision);
          await this.transition(context, 'escalating');
          const report = await this.buildEscalationReport(context, classifiedErrors, attempts, reason);
          await this.transition(context, 'terminated');
          return this.buildResult(false, attempts, reason, report, startTime, context);
        }

        // Apply backoff delay if specified
        if (decision.suggestedDelayMs && decision.suggestedDelayMs > 0) {
          await this.sleep(decision.suggestedDelayMs);
        }

        // === DIAGNOSE ===
        await this.transition(context, 'diagnosing');
        const diagnosis = await this.diagnose(context, classifiedErrors, attempts);

        this.host.emit('repair:diagnosis', {
          taskId: context.taskId,
          stageName: context.stageName,
          diagnosis,
          iteration: context.iterationCount,
          timestamp: new Date(),
        });

        // If diagnosis says human input needed, escalate
        if (diagnosis.requiresHumanInput) {
          await this.transition(context, 'escalating');
          const report = await this.buildEscalationReport(context, classifiedErrors, attempts, 'escalated');
          await this.transition(context, 'terminated');
          return this.buildResult(false, attempts, 'escalated', report, startTime, context);
        }

        // === PLAN FIX ===
        await this.transition(context, 'planning_fix');
        const fixPlan = await this.planFix(context, diagnosis, attempts);

        this.host.emit('repair:fix-planned', {
          taskId: context.taskId,
          stageName: context.stageName,
          plan: fixPlan,
          previousApproaches: attempts.map(a => a.approach),
          iteration: context.iterationCount,
          timestamp: new Date(),
        });

        // === APPLY FIX ===
        await this.transition(context, 'applying_fix');
        const attempt = await this.applyFix(context, diagnosis, fixPlan, classifiedErrors);
        attempts.push(attempt);

        // Persist the attempt
        await this.host.addFixAttempt(context.taskId, attempt);

        this.host.emit('repair:fix-applied', {
          taskId: context.taskId,
          stageName: context.stageName,
          attempt,
          filesModified: fixPlan.filesToModify,
          iteration: context.iterationCount,
          timestamp: new Date(),
        });

        // Update history for termination checks
        context.history = await this.host.getFixAttemptHistory(context.taskId);

        // === VALIDATE ===
        if (context.config.validateAfterFix) {
          await this.transition(context, 'validating');
          const validationResult = await this.validate(context);

          if (validationResult.status === 'completed') {
            // Fix worked!
            this.host.emit('repair:validation-passed', {
              taskId: context.taskId,
              stageName: context.stageName,
              passed: true,
              iteration: context.iterationCount,
              timestamp: new Date(),
            });

            await this.transition(context, 'resolved');
            await this.transition(context, 'terminated');

            this.host.emit('repair:resolved', {
              taskId: context.taskId,
              stageName: context.stageName,
              totalAttempts: attempts.length,
              totalDurationMs: Date.now() - startTime,
              successfulApproach: fixPlan.approach,
              timestamp: new Date(),
            });

            return this.buildResult(true, attempts, 'resolved', undefined, startTime, context, validationResult);
          }

          // Validation failed — update the context with new failure info
          this.host.emit('repair:validation-failed', {
            taskId: context.taskId,
            stageName: context.stageName,
            passed: false,
            iteration: context.iterationCount,
            timestamp: new Date(),
          });

          // Update context for next iteration
          context.failedResult = validationResult;
          context.originalError = new Error(validationResult.error || validationResult.summary);
        }

        // Loop back to OBSERVE for next iteration
      }
    } catch (error) {
      // Unexpected error in the repair loop itself
      await this.host.addLog(context.taskId, {
        level: 'error',
        message: `Repair loop encountered unexpected error: ${(error as Error).message}`,
        stage: context.stageName,
      });

      const reason: RepairTerminationReason = 'escalated';
      return this.buildResult(false, attempts, reason, undefined, startTime, context);
    }
  }

  // --------------------------------------------------------------------------
  // State Handlers
  // --------------------------------------------------------------------------

  private async observe(context: RepairContext): Promise<ClassifiedError[]> {
    const errors = this.classifier.classify(
      context.originalError,
      context.failedResult,
      context.stageOutput,
    );

    this.host.emit('repair:started', {
      taskId: context.taskId,
      stageName: context.stageName,
      stageAgent: context.stageAgent,
      errorCount: errors.length,
      errors: errors.map(e => e.fingerprint),
      timestamp: new Date(),
    });

    return errors;
  }

  private async diagnose(
    context: RepairContext,
    errors: ClassifiedError[],
    previousAttempts: FixAttempt[],
  ): Promise<RepairDiagnosis> {
    const task = await this.host.getTask(context.taskId);
    if (!task) throw new Error(`Task ${context.taskId} not found`);

    // Collect related files from errors
    const relatedFiles = [...new Set(errors.flatMap(e => e.relatedFiles))];
    const fileContents = await this.host.readFiles(relatedFiles.slice(0, 5));

    const prompt = buildDiagnosisPrompt({
      task,
      stageName: context.stageName,
      stageAgent: context.stageAgent,
      errors,
      previousAttempts,
      stageOutput: context.stageOutput,
      fileContents,
      acceptanceCriteria: task.acceptanceCriteria,
    });

    const result = await this.host.queryAgent(prompt, this.mapModel(context.config.diagnosisModel));
    context.repairCostSoFar += result.costUsd;
    context.repairTokensUsed += result.tokensUsed;

    return this.parseDiagnosisResponse(result.text, errors);
  }

  private async planFix(
    context: RepairContext,
    diagnosis: RepairDiagnosis,
    previousAttempts: FixAttempt[],
  ): Promise<RepairFixPlan> {
    // Select the first approach that hasn't been tried before
    const triedApproaches = new Set(previousAttempts.map(a => a.approach.toLowerCase()));
    const selectedApproach = diagnosis.suggestedApproaches.find(
      a => !triedApproaches.has(a.toLowerCase())
    ) || diagnosis.suggestedApproaches[0] || 'Apply fix based on diagnosis';

    return {
      approach: selectedApproach,
      steps: [`Diagnose: ${diagnosis.rootCause}`, `Fix: ${selectedApproach}`],
      filesToModify: diagnosis.affectedFiles.slice(0, context.config.maxFilesPerRepair),
      expectedOutcome: `The ${diagnosis.errorCategory} error should be resolved`,
      rollbackStrategy: 'Revert modified files to their state before the fix',
    };
  }

  private async applyFix(
    context: RepairContext,
    diagnosis: RepairDiagnosis,
    fixPlan: RepairFixPlan,
    errors: ClassifiedError[],
  ): Promise<FixAttempt> {
    const attemptId = randomUUID();
    const startedAt = new Date();

    const task = await this.host.getTask(context.taskId);
    if (!task) throw new Error(`Task ${context.taskId} not found`);

    // Get previous attempts for anti-pattern section
    const previousAttempts = context.history.entries;

    // Read current file contents for the repair prompt
    const fileContents = await this.host.readFiles(fixPlan.filesToModify);

    const prompt = buildRepairPrompt({
      task,
      stageName: context.stageName,
      stageAgent: context.stageAgent,
      errors,
      previousAttempts,
      stageOutput: context.stageOutput,
      fileContents,
      acceptanceCriteria: task.acceptanceCriteria,
      diagnosis,
      fixPlan,
      maxFilesPerRepair: context.config.maxFilesPerRepair,
    });

    let result: RepairQueryResult;
    let success = true;
    let reason: string | undefined;

    try {
      result = await this.host.queryAgent(prompt, this.mapModel(context.config.repairModel), {
        maxTurns: 30,
        cwd: undefined, // Use orchestrator's working directory
        tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      });
      context.repairCostSoFar += result.costUsd;
      context.repairTokensUsed += result.tokensUsed;
    } catch (err) {
      success = false;
      reason = `Repair agent failed: ${(err as Error).message}`;
      result = { text: '', tokensUsed: 0, costUsd: 0 };
    }

    const attempt: FixAttempt = {
      id: attemptId,
      taskId: context.taskId,
      attemptNumber: context.history.totalAttempts + context.iterationCount,
      error: errors[0]?.fingerprint || { hash: 'unknown', message: context.originalError.message, category: 'unknown' },
      startedAt,
      completedAt: new Date(),
      approach: fixPlan.approach,
      agent: context.stageAgent,
      stage: context.stageName,
      result: {
        success,
        resolved: false, // Will be updated after validation
        reason,
      },
    };

    return attempt;
  }

  private async validate(context: RepairContext): Promise<StageResult> {
    await this.host.addLog(context.taskId, {
      level: 'info',
      message: `Repair loop: re-running stage "${context.stageName}" for validation (iteration ${context.iterationCount})`,
      stage: context.stageName,
    });

    return this.host.rerunStage(context.taskId, context.stageName);
  }

  // --------------------------------------------------------------------------
  // Termination Logic
  // --------------------------------------------------------------------------

  private shouldTerminate(context: RepairContext, errors: ClassifiedError[]): FixAttemptDecision {
    const { history, config } = context;
    const fixConfig = config.fixAttempts;

    // 1. Check total attempts across all errors
    if (history.totalAttempts + context.iterationCount > fixConfig.maxTotalAttempts) {
      return { shouldAttempt: false, reason: 'max_total', attemptCount: history.totalAttempts, maxAttempts: fixConfig.maxTotalAttempts };
    }

    // 2. Check per-error attempts
    if (errors.length > 0) {
      const primaryError = errors[0].fingerprint;
      const errorCount = history.errorAttemptCounts?.[primaryError.hash] || 0;
      if (errorCount >= fixConfig.maxAttemptsPerError) {
        return { shouldAttempt: false, reason: 'max_per_error', attemptCount: errorCount, maxAttempts: fixConfig.maxAttemptsPerError };
      }
    }

    // 3. Check time budget
    const elapsedMs = Date.now() - context.loopStartedAt.getTime();
    if (elapsedMs >= config.maxRepairTimeMs) {
      return { shouldAttempt: false, reason: 'max_total', attemptCount: context.iterationCount, maxAttempts: fixConfig.maxTotalAttempts };
    }

    // 4. Check cost budget
    if (context.repairCostSoFar >= config.maxRepairCostPerStage) {
      return { shouldAttempt: false, reason: 'max_total', attemptCount: context.iterationCount, maxAttempts: fixConfig.maxTotalAttempts };
    }

    // 5. Loop detection
    const loopResult = this.detectLoop(context);
    if (loopResult.loopDetected) {
      return { shouldAttempt: false, reason: 'loop_detected', attemptCount: context.iterationCount, maxAttempts: fixConfig.maxTotalAttempts };
    }

    // 6. Calculate backoff delay
    const attemptCount = errors.length > 0
      ? (history.errorAttemptCounts?.[errors[0].fingerprint.hash] || 0)
      : context.iterationCount;
    const suggestedDelayMs = this.calculateBackoff(
      fixConfig.backoffStrategy,
      attemptCount,
      fixConfig.baseDelayMs,
      fixConfig.maxDelayMs,
    );

    return {
      shouldAttempt: true,
      attemptCount,
      maxAttempts: fixConfig.maxAttemptsPerError,
      suggestedDelayMs,
    };
  }

  private detectLoop(context: RepairContext): LoopDetectionResult {
    const entries = context.history.entries;

    // Pattern 1: Same error hash in last 3 attempts
    if (entries.length >= 3) {
      const lastThree = entries.slice(-3);
      const allSame = lastThree.every(e => e.error.hash === lastThree[0].error.hash);
      if (allSame && !lastThree.some(e => e.result.resolved)) {
        return {
          loopDetected: true,
          loopType: 'same_error',
          description: `Same error (${lastThree[0].error.message.substring(0, 50)}) persists after 3 fix attempts`,
          involvedErrors: [lastThree[0].error],
        };
      }
    }

    // Pattern 2: Oscillating A→B→A→B pattern
    if (entries.length >= 4) {
      const lastFour = entries.slice(-4);
      if (
        lastFour[0].error.hash === lastFour[2].error.hash &&
        lastFour[1].error.hash === lastFour[3].error.hash &&
        lastFour[0].error.hash !== lastFour[1].error.hash
      ) {
        return {
          loopDetected: true,
          loopType: 'oscillating',
          description: `Errors oscillating between two states: "${lastFour[0].error.message.substring(0, 30)}" and "${lastFour[1].error.message.substring(0, 30)}"`,
          involvedErrors: [lastFour[0].error, lastFour[1].error],
        };
      }
    }

    // Pattern 3: Circular fixes — a fix introduces an error that was seen before
    if (entries.length >= 2) {
      const last = entries[entries.length - 1];
      const newErrors = last.result.newErrors || [];
      const previousHashes = new Set(entries.slice(0, -1).map(e => e.error.hash));
      const reintroduced = newErrors.filter(ne => previousHashes.has(ne.hash));
      if (reintroduced.length > 0) {
        return {
          loopDetected: true,
          loopType: 'circular_fixes',
          description: `Fix reintroduced a previously seen error: "${reintroduced[0].message.substring(0, 50)}"`,
          involvedErrors: reintroduced,
        };
      }
    }

    return { loopDetected: false };
  }

  private calculateBackoff(
    strategy: string,
    attemptCount: number,
    baseDelayMs: number,
    maxDelayMs: number,
  ): number {
    if (attemptCount === 0) return 0; // No delay on first attempt

    let delay: number;
    switch (strategy) {
      case 'none':
        delay = 0;
        break;
      case 'constant':
        delay = baseDelayMs;
        break;
      case 'linear':
        delay = baseDelayMs * attemptCount;
        break;
      case 'exponential':
        delay = baseDelayMs * Math.pow(2, attemptCount - 1);
        break;
      default:
        delay = baseDelayMs;
    }

    return Math.min(delay, maxDelayMs);
  }

  // --------------------------------------------------------------------------
  // State Transition
  // --------------------------------------------------------------------------

  private async transition(context: RepairContext, to: RepairState): Promise<void> {
    const from = context.currentState;
    context.currentState = to;
    context.stateEnteredAt = new Date();

    this.host.emit('repair:state-change', {
      taskId: context.taskId,
      stageName: context.stageName,
      fromState: from,
      toState: to,
      iteration: context.iterationCount,
      timestamp: new Date(),
    });

    await this.host.addLog(context.taskId, {
      level: 'info',
      message: `Repair loop: ${from} → ${to} (iteration ${context.iterationCount})`,
      stage: context.stageName,
    });
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private mapModel(model: string): string {
    switch (model) {
      case 'opus': return 'claude-opus-4-5-20251101';
      case 'haiku': return 'claude-haiku-4-5-20251001';
      case 'sonnet':
      default: return 'claude-sonnet-4-20250514';
    }
  }

  private mapDecisionToTermination(decision: FixAttemptDecision): RepairTerminationReason {
    switch (decision.reason) {
      case 'max_per_error':
      case 'max_total':
        return 'max_attempts';
      case 'loop_detected':
        return 'loop_detected';
      case 'backoff_active':
        return 'timeout';
      default:
        return 'max_attempts';
    }
  }

  private parseDiagnosisResponse(text: string, errors: ClassifiedError[]): RepairDiagnosis {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          rootCause: parsed.rootCause || 'Unknown root cause',
          errorCategory: parsed.errorCategory || errors[0]?.category || 'unknown',
          affectedFiles: Array.isArray(parsed.affectedFiles) ? parsed.affectedFiles : errors.flatMap(e => e.relatedFiles),
          suggestedApproaches: Array.isArray(parsed.suggestedApproaches) ? parsed.suggestedApproaches : ['Apply generic fix based on error type'],
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          requiresHumanInput: parsed.requiresHumanInput === true,
        };
      } catch {
        // Fall through to fallback
      }
    }

    // Fallback: construct diagnosis from classified errors
    return {
      rootCause: errors[0]?.fingerprint.message || 'Could not determine root cause',
      errorCategory: errors[0]?.category || 'unknown',
      affectedFiles: [...new Set(errors.flatMap(e => e.relatedFiles))],
      suggestedApproaches: ['Fix the error based on the error message and file context'],
      confidence: 0.3,
      requiresHumanInput: false,
    };
  }

  private async buildEscalationReport(
    context: RepairContext,
    errors: ClassifiedError[],
    attempts: FixAttempt[],
    reason: RepairTerminationReason,
  ): Promise<EscalationReport> {
    const task = await this.host.getTask(context.taskId);

    // Try to get a structured escalation via Claude
    if (task) {
      try {
        const prompt = buildEscalationPrompt({
          task,
          stageName: context.stageName,
          errors,
          previousAttempts: attempts,
          terminationReason: reason,
        });

        const result = await this.host.queryAgent(prompt, this.mapModel(context.config.diagnosisModel));
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            summary: parsed.summary || `Stage "${context.stageName}" failed after ${attempts.length} repair attempts`,
            rootCauseAnalysis: parsed.rootCauseAnalysis || 'Could not determine root cause',
            attemptsSummary: attempts.map(a => ({
              approach: a.approach,
              outcome: a.result.resolved ? 'Resolved' : (a.result.reason || 'Failed'),
            })),
            suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
            affectedFiles: [...new Set(errors.flatMap(e => e.relatedFiles))],
            errorFingerprints: errors.map(e => e.fingerprint),
          };
        }
      } catch {
        // Fall through to static report
      }
    }

    // Static fallback report
    return {
      summary: `Stage "${context.stageName}" failed after ${attempts.length} repair attempts. Reason: ${reason}`,
      rootCauseAnalysis: errors[0]?.fingerprint.message || 'Unknown error',
      attemptsSummary: attempts.map(a => ({
        approach: a.approach,
        outcome: a.result.resolved ? 'Resolved' : (a.result.reason || 'Failed'),
      })),
      suggestedActions: ['Review the error output manually', 'Check if the issue requires configuration changes'],
      affectedFiles: [...new Set(errors.flatMap(e => e.relatedFiles))],
      errorFingerprints: errors.map(e => e.fingerprint),
    };
  }

  private buildResult(
    resolved: boolean,
    attempts: FixAttempt[],
    terminationReason: RepairTerminationReason,
    escalationReport: EscalationReport | undefined,
    startTime: number,
    context: RepairContext,
    stageResult?: StageResult,
  ): RepairResult {
    const result: RepairResult = {
      resolved,
      attempts,
      terminationReason,
      escalationReport,
      totalDurationMs: Date.now() - startTime,
      totalTokensUsed: context.repairTokensUsed,
    };

    if (stageResult) {
      result.stageResult = stageResult;
    }

    this.host.emit('repair:terminated', {
      taskId: context.taskId,
      stageName: context.stageName,
      reason: terminationReason,
      resolved,
      totalAttempts: attempts.length,
      timestamp: new Date(),
    });

    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
