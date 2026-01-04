import { createHash } from 'crypto';
import EventEmitter from 'eventemitter3';
import {
  FixAttempt,
  FixAttemptConfig,
  FixAttemptHistory,
  FixAttemptDecision,
  FixAttemptSnapshot,
  ErrorFingerprint,
  BackoffStrategy,
  LoopDetectionResult,
  TaskStatus,
  TaskUsage,
} from '@apexcli/core';
import { TaskStore } from './store';

/**
 * Events emitted by FixAttemptTracker
 */
export interface FixAttemptTrackerEvents {
  'fix:started': (attempt: FixAttempt) => void;
  'fix:completed': (attempt: FixAttempt) => void;
  'fix:resolved': (attempt: FixAttempt) => void;
  'fix:failed': (attempt: FixAttempt) => void;
  'error:max-attempts': (error: ErrorFingerprint, attempts: number) => void;
  'loop:detected': (result: LoopDetectionResult) => void;
  'backoff:waiting': (error: ErrorFingerprint, delayMs: number) => void;
}

/**
 * Options for creating a FixAttemptTracker
 */
export interface FixAttemptTrackerOptions {
  taskId: string;
  store: TaskStore;
  config?: Partial<FixAttemptConfig>;
}

/**
 * FixAttemptTracker manages fix attempts for errors encountered during task execution.
 * It provides:
 * - Per-error attempt tracking with unique fingerprinting
 * - Loop detection to identify repeated/circular fix patterns
 * - Configurable backoff strategies
 * - Integration with TaskStore for persistence
 */
export class FixAttemptTracker extends EventEmitter<FixAttemptTrackerEvents> {
  private readonly taskId: string;
  private readonly store: TaskStore;
  private readonly config: FixAttemptConfig;

  // In-memory state
  private history: FixAttemptHistory;
  private activeAttempt: FixAttempt | null = null;
  private lastAttemptByError: Map<string, Date> = new Map();

  constructor(options: FixAttemptTrackerOptions) {
    super();
    this.taskId = options.taskId;
    this.store = options.store;
    this.config = {
      maxAttemptsPerError: options.config?.maxAttemptsPerError ?? 3,
      maxTotalAttempts: options.config?.maxTotalAttempts ?? 10,
      backoffStrategy: options.config?.backoffStrategy ?? 'exponential',
      baseDelayMs: options.config?.baseDelayMs ?? 1000,
      maxDelayMs: options.config?.maxDelayMs ?? 30000,
      groupSimilarErrors: options.config?.groupSimilarErrors ?? true,
      similarityThreshold: options.config?.similarityThreshold ?? 0.8,
    };
    this.history = this.createEmptyHistory();
  }

  /**
   * Initialize the tracker, loading any existing history from the store
   */
  async initialize(): Promise<void> {
    this.history = await this.store.getFixAttemptHistory(this.taskId);

    // Rebuild lastAttemptByError map from history
    for (const entry of this.history.entries) {
      const existingDate = this.lastAttemptByError.get(entry.error.hash);
      if (!existingDate || entry.startedAt > existingDate) {
        this.lastAttemptByError.set(entry.error.hash, entry.startedAt);
      }
    }
  }

  /**
   * Create an error fingerprint from error details
   */
  createErrorFingerprint(
    message: string,
    category: string,
    options?: {
      filePath?: string;
      line?: number;
      column?: number;
      code?: string;
    }
  ): ErrorFingerprint {
    // Normalize message for consistent hashing
    const normalizedMessage = this.normalizeErrorMessage(message);

    // Create hash from relevant fields
    const hashInput = [
      normalizedMessage,
      category,
      options?.filePath ?? '',
      options?.code ?? '',
    ].join('|');

    const hash = createHash('sha256').update(hashInput).digest('hex').slice(0, 16);

    return {
      hash,
      message: message.slice(0, 500), // Truncate long messages
      category,
      filePath: options?.filePath,
      line: options?.line,
      column: options?.column,
      code: options?.code,
    };
  }

  /**
   * Check if a fix attempt should be made for the given error
   */
  shouldAttemptFix(error: ErrorFingerprint): FixAttemptDecision {
    // Find matching error (exact or similar)
    const matchingHash = this.findMatchingErrorHash(error);
    const attemptCount = matchingHash
      ? (this.history.errorAttemptCounts[matchingHash] ?? 0)
      : 0;

    // Check total attempts
    if (this.history.totalAttempts >= this.config.maxTotalAttempts) {
      return {
        shouldAttempt: false,
        reason: 'max_total',
        attemptCount,
        maxAttempts: this.config.maxTotalAttempts,
      };
    }

    // Check per-error attempts
    if (attemptCount >= this.config.maxAttemptsPerError) {
      this.emit('error:max-attempts', error, attemptCount);
      return {
        shouldAttempt: false,
        reason: 'max_per_error',
        attemptCount,
        maxAttempts: this.config.maxAttemptsPerError,
      };
    }

    // Check backoff
    const lastAttempt = this.lastAttemptByError.get(matchingHash ?? error.hash);
    if (lastAttempt && this.config.backoffStrategy !== 'none') {
      const delay = this.calculateBackoffDelay(attemptCount);
      const nextAllowedTime = new Date(lastAttempt.getTime() + delay);
      const now = new Date();

      if (now < nextAllowedTime) {
        this.emit('backoff:waiting', error, delay);
        return {
          shouldAttempt: false,
          reason: 'backoff_active',
          retryAfter: nextAllowedTime,
          attemptCount,
          maxAttempts: this.config.maxAttemptsPerError,
        };
      }
    }

    // Check for loop patterns
    const loopResult = this.detectLoop();
    if (loopResult.loopDetected) {
      this.emit('loop:detected', loopResult);
      return {
        shouldAttempt: false,
        reason: 'loop_detected',
        attemptCount,
        maxAttempts: this.config.maxAttemptsPerError,
      };
    }

    // Calculate suggested delay for this attempt
    const suggestedDelayMs = attemptCount > 0
      ? this.calculateBackoffDelay(attemptCount)
      : 0;

    return {
      shouldAttempt: true,
      attemptCount: attemptCount + 1,
      maxAttempts: this.config.maxAttemptsPerError,
      suggestedDelayMs,
    };
  }

  /**
   * Start tracking a new fix attempt
   */
  async startFixAttempt(
    error: ErrorFingerprint,
    approach: string,
    options?: {
      agent?: string;
      stage?: string;
      beforeState?: FixAttemptSnapshot;
    }
  ): Promise<FixAttempt> {
    if (this.activeAttempt) {
      throw new Error('A fix attempt is already in progress. Complete it first.');
    }

    const attemptNumber = this.history.totalAttempts + 1;
    const id = `${this.taskId}-fix-${attemptNumber}-${Date.now()}`;

    const attempt: FixAttempt = {
      id,
      taskId: this.taskId,
      attemptNumber,
      error,
      startedAt: new Date(),
      approach,
      agent: options?.agent,
      stage: options?.stage,
      beforeState: options?.beforeState,
      result: {
        success: false,
        resolved: false,
      },
    };

    this.activeAttempt = attempt;
    this.emit('fix:started', attempt);

    return attempt;
  }

  /**
   * Complete a fix attempt with results
   */
  async completeFixAttempt(
    result: {
      success: boolean;
      resolved: boolean;
      reason?: string;
      newErrors?: ErrorFingerprint[];
    },
    afterState?: FixAttemptSnapshot
  ): Promise<FixAttempt> {
    if (!this.activeAttempt) {
      throw new Error('No active fix attempt to complete.');
    }

    const attempt = this.activeAttempt;
    attempt.completedAt = new Date();
    attempt.afterState = afterState;
    attempt.result = result;

    // Calculate delay that was applied
    const lastAttempt = this.lastAttemptByError.get(attempt.error.hash);
    if (lastAttempt) {
      attempt.delayAppliedMs = attempt.startedAt.getTime() - lastAttempt.getTime();
    }

    // Update history
    this.history.entries.push(attempt);
    this.history.totalAttempts++;
    this.history.lastAttemptAt = attempt.startedAt;

    if (result.resolved) {
      this.history.resolvedCount++;
    } else {
      this.history.failedCount++;
    }

    // Update error attempt count
    const errorHash = attempt.error.hash;
    this.history.errorAttemptCounts[errorHash] =
      (this.history.errorAttemptCounts[errorHash] ?? 0) + 1;
    this.lastAttemptByError.set(errorHash, attempt.startedAt);

    // Update current error tracking
    if (!result.resolved) {
      this.history.currentError = {
        fingerprint: attempt.error,
        attemptCount: this.history.errorAttemptCounts[errorHash],
        firstSeenAt: this.history.currentError?.fingerprint.hash === errorHash
          ? this.history.currentError.firstSeenAt
          : attempt.startedAt,
        lastAttemptAt: attempt.startedAt,
      };
    } else {
      this.history.currentError = undefined;
    }

    // Persist to store
    await this.store.addFixAttempt(this.taskId, attempt);

    // Emit appropriate events
    this.emit('fix:completed', attempt);
    if (result.resolved) {
      this.emit('fix:resolved', attempt);
    } else {
      this.emit('fix:failed', attempt);
    }

    this.activeAttempt = null;
    return attempt;
  }

  /**
   * Cancel the current fix attempt without recording a result
   */
  cancelCurrentAttempt(): void {
    this.activeAttempt = null;
  }

  /**
   * Get the current fix attempt history
   */
  getHistory(): FixAttemptHistory {
    return { ...this.history };
  }

  /**
   * Get attempts for a specific error
   */
  getAttemptsForError(error: ErrorFingerprint): FixAttempt[] {
    const matchingHash = this.findMatchingErrorHash(error);
    if (!matchingHash) return [];

    return this.history.entries.filter(
      entry => entry.error.hash === matchingHash
    );
  }

  /**
   * Detect if the fix attempts are in a loop pattern
   */
  detectLoop(): LoopDetectionResult {
    const recentAttempts = this.history.entries.slice(-6); // Check last 6 attempts

    if (recentAttempts.length < 3) {
      return { loopDetected: false };
    }

    // Check for same error repeated
    const lastThree = recentAttempts.slice(-3);
    const allSameError = lastThree.every(
      a => a.error.hash === lastThree[0].error.hash
    );
    if (allSameError && lastThree.every(a => !a.result.resolved)) {
      return {
        loopDetected: true,
        loopType: 'same_error',
        description: `The same error has been attempted ${lastThree.length} times without resolution`,
        involvedErrors: [lastThree[0].error],
        suggestedAction: 'Consider a different approach or manual intervention',
      };
    }

    // Check for oscillating between two errors (A -> B -> A -> B)
    if (recentAttempts.length >= 4) {
      const lastFour = recentAttempts.slice(-4);
      const errorHashes = lastFour.map(a => a.error.hash);
      if (
        errorHashes[0] === errorHashes[2] &&
        errorHashes[1] === errorHashes[3] &&
        errorHashes[0] !== errorHashes[1]
      ) {
        return {
          loopDetected: true,
          loopType: 'oscillating_state',
          description: 'Fixes are oscillating between two errors',
          involvedErrors: [lastFour[0].error, lastFour[1].error],
          suggestedAction: 'Both errors may need to be addressed together',
        };
      }
    }

    // Check for circular pattern (A -> B -> C -> A)
    if (recentAttempts.length >= 4) {
      const hashSet = new Set(recentAttempts.map(a => a.error.hash));
      const lastHash = recentAttempts[recentAttempts.length - 1].error.hash;
      const firstOccurrence = recentAttempts.findIndex(a => a.error.hash === lastHash);

      if (firstOccurrence < recentAttempts.length - 3) {
        return {
          loopDetected: true,
          loopType: 'circular_fixes',
          description: 'Fixes are cycling through multiple errors in a pattern',
          involvedErrors: [...hashSet].slice(0, 3).map(hash =>
            recentAttempts.find(a => a.error.hash === hash)!.error
          ),
          suggestedAction: 'The fix for one error may be causing another. Review the chain.',
        };
      }
    }

    return { loopDetected: false };
  }

  /**
   * Reset the tracker state (for testing or manual intervention)
   */
  async reset(): Promise<void> {
    this.history = this.createEmptyHistory();
    this.activeAttempt = null;
    this.lastAttemptByError.clear();
    await this.store.clearFixAttempts(this.taskId);
  }

  // Private helper methods

  private createEmptyHistory(): FixAttemptHistory {
    return {
      entries: [],
      totalAttempts: 0,
      resolvedCount: 0,
      failedCount: 0,
      errorAttemptCounts: {},
    };
  }

  private normalizeErrorMessage(message: string): string {
    return message
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/['"`]/g, '')
      .replace(/\d+/g, 'N') // Replace numbers with placeholder
      .trim();
  }

  private findMatchingErrorHash(error: ErrorFingerprint): string | null {
    // Exact match first
    if (this.history.errorAttemptCounts[error.hash] !== undefined) {
      return error.hash;
    }

    // If grouping similar errors, check for similar messages
    if (this.config.groupSimilarErrors) {
      const normalizedNew = this.normalizeErrorMessage(error.message);

      for (const entry of this.history.entries) {
        const normalizedExisting = this.normalizeErrorMessage(entry.error.message);
        const similarity = this.calculateSimilarity(normalizedNew, normalizedExisting);

        if (
          similarity >= this.config.similarityThreshold &&
          entry.error.category === error.category
        ) {
          return entry.error.hash;
        }
      }
    }

    return null;
  }

  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // Simple Jaccard similarity on words
    const wordsA = new Set(a.split(' '));
    const wordsB = new Set(b.split(' '));

    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;

    return intersection / union;
  }

  private calculateBackoffDelay(attemptNumber: number): number {
    let delay: number;

    switch (this.config.backoffStrategy) {
      case 'none':
        delay = 0;
        break;
      case 'constant':
        delay = this.config.baseDelayMs;
        break;
      case 'linear':
        delay = this.config.baseDelayMs * attemptNumber;
        break;
      case 'exponential':
        delay = this.config.baseDelayMs * Math.pow(2, attemptNumber - 1);
        break;
      default:
        delay = this.config.baseDelayMs;
    }

    return Math.min(delay, this.config.maxDelayMs);
  }
}