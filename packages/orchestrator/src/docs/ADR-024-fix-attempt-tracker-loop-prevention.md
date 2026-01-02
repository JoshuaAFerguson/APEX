# ADR-024: Fix Attempt Tracker with Loop Prevention

## Status
Proposed

## Date
2025-01-02

## Context

APEX agents may encounter errors during task execution (compilation errors, test failures, lint issues, etc.). When errors occur, agents attempt to fix them. However, without proper tracking, agents can enter infinite loops where they:

1. Detect an error
2. Attempt a fix
3. The fix doesn't resolve the issue (or introduces the same error differently)
4. Return to step 1 indefinitely

### Current State

The existing infrastructure provides:

1. **Iteration History** (`packages/core/src/types.ts`):
   - `IterationEntry`, `IterationSnapshot`, `IterationHistory` interfaces
   - Tracks user feedback iterations with before/after states
   - Database storage in `task_iterations` table

2. **Resume Attempt Tracking** (ADR-007):
   - `resumeAttempts` counter on Task interface
   - `maxResumeAttempts` config for loop prevention
   - Prevents infinite checkpoint/resume loops

3. **Task Retry Infrastructure**:
   - `retryCount` and `maxRetries` fields on Task
   - Basic retry counting but not error-specific

### Problem

There is no mechanism to:
1. **Track fix attempts per error** - Same error may be attempted to fix multiple times
2. **Detect repeated failures** - Recognize when fixes aren't working
3. **Apply backoff strategies** - Delay retries to avoid hammering the same issue
4. **Provide feedback loop integration** - Connect error detection with fix attempt history

This creates risks:
- Wasted API tokens on futile fix attempts
- Task stalls from infinite fix loops
- Poor user experience when tasks spin without progress
- Difficulty diagnosing why tasks aren't completing

### Scenarios Leading to Fix Loops

1. **Compilation errors with deep dependency chains**: Fixing one import breaks another
2. **Test failures with flaky conditions**: Test passes sometimes, fails others
3. **Lint rules with conflicting fixes**: Auto-fix for one rule violates another
4. **Type errors with complex generics**: Fix one type error, introduce another
5. **Build configuration issues**: Changes cause cascading failures

## Decision

Implement a `FixAttemptTracker` class that:
1. Records fix attempts per error with unique error identification
2. Detects repeated failures on the same error
3. Enforces configurable max retry limits
4. Provides backoff strategies (constant, linear, exponential)
5. Integrates with a future `ErrorFeedbackLoop` class

## Technical Design

### 1. Type Definitions (packages/core/src/types.ts)

```typescript
// ============================================================================
// Error Tracking and Fix Attempts (v0.5.0)
// ============================================================================

/**
 * Category of error for grouping and tracking
 */
export const ErrorCategorySchema = z.enum([
  'compilation',    // Build/compile errors (TypeScript, etc.)
  'runtime',        // Runtime execution errors
  'test',           // Test failures
  'lint',           // Linting/formatting errors
  'type',           // Type checking errors
  'dependency',     // Package/dependency issues
  'configuration',  // Config file errors
  'permission',     // Access/permission errors
  'network',        // Network-related errors
  'other',          // Uncategorized errors
]);
export type ErrorCategory = z.infer<typeof ErrorCategorySchema>;

/**
 * Backoff strategy for retry delays
 */
export const BackoffStrategySchema = z.enum([
  'none',           // No delay between attempts
  'constant',       // Fixed delay (e.g., 5s every time)
  'linear',         // Linearly increasing delay (e.g., 5s, 10s, 15s)
  'exponential',    // Exponentially increasing delay (e.g., 5s, 10s, 20s, 40s)
]);
export type BackoffStrategy = z.infer<typeof BackoffStrategySchema>;

/**
 * Configuration for fix attempt tracking
 */
export const FixAttemptConfigSchema = z.object({
  /** Maximum attempts per unique error (default: 3) */
  maxAttemptsPerError: z.number().min(1).max(20).default(3),
  /** Maximum total fix attempts per task (default: 10) */
  maxTotalAttempts: z.number().min(1).max(100).default(10),
  /** Backoff strategy for retries (default: 'exponential') */
  backoffStrategy: BackoffStrategySchema.default('exponential'),
  /** Base delay in milliseconds for backoff (default: 1000) */
  baseDelayMs: z.number().min(0).max(60000).default(1000),
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs: z.number().min(0).max(300000).default(30000),
  /** Whether to consider similar errors as the same (default: true) */
  groupSimilarErrors: z.boolean().default(true),
  /** Similarity threshold for error grouping (0-1, default: 0.8) */
  similarityThreshold: z.number().min(0).max(1).default(0.8),
});
export type FixAttemptConfig = z.infer<typeof FixAttemptConfigSchema>;

/**
 * Unique identifier for an error instance
 */
export interface ErrorFingerprint {
  /** Hash of error message and context for deduplication */
  hash: string;
  /** Original error message */
  message: string;
  /** Error category */
  category: ErrorCategory;
  /** Optional file path where error occurred */
  filePath?: string;
  /** Optional line number */
  line?: number;
  /** Optional column number */
  column?: number;
  /** Error code if available (e.g., TS2322, ESLint rule) */
  code?: string;
}

/**
 * Snapshot of task state at time of fix attempt
 */
export interface FixAttemptSnapshot {
  /** Timestamp when snapshot was taken */
  timestamp: Date;
  /** Current stage of the task */
  stage?: string;
  /** Current status of the task */
  status: TaskStatus;
  /** Files created or modified */
  files: {
    created: string[];
    modified: string[];
  };
  /** Usage statistics at this point */
  usage: TaskUsage;
  /** Number of active errors */
  errorCount: number;
}

/**
 * Record of a single fix attempt
 */
export interface FixAttempt {
  /** Unique identifier for this fix attempt */
  id: string;
  /** ID of the task this attempt belongs to */
  taskId: string;
  /** Sequential number within the task (1-based) */
  attemptNumber: number;
  /** Error being fixed */
  error: ErrorFingerprint;
  /** Timestamp when fix attempt started */
  startedAt: Date;
  /** Timestamp when fix attempt completed */
  completedAt?: Date;
  /** Description of the fix approach taken */
  approach: string;
  /** Agent that performed the fix */
  agent?: string;
  /** Stage where the fix was attempted */
  stage?: string;
  /** State before the fix */
  beforeState?: FixAttemptSnapshot;
  /** State after the fix */
  afterState?: FixAttemptSnapshot;
  /** Result of the fix attempt */
  result: {
    /** Whether the fix was applied successfully (no errors during fix) */
    success: boolean;
    /** Whether the original error was resolved */
    resolved: boolean;
    /** Reason if not resolved */
    reason?: string;
    /** New errors introduced by the fix (if any) */
    newErrors?: ErrorFingerprint[];
  };
  /** Delay applied before this attempt (backoff) */
  delayAppliedMs?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated history of fix attempts for a task
 */
export interface FixAttemptHistory {
  /** All fix attempt entries */
  entries: FixAttempt[];
  /** Total number of fix attempts */
  totalAttempts: number;
  /** Number of successful resolutions */
  resolvedCount: number;
  /** Number of failed attempts */
  failedCount: number;
  /** Timestamp of the most recent attempt */
  lastAttemptAt?: Date;
  /** Current error being worked on (if any) */
  currentError?: {
    fingerprint: ErrorFingerprint;
    attemptCount: number;
    firstSeenAt: Date;
    lastAttemptAt: Date;
  };
  /** Map of error fingerprint hashes to attempt counts */
  errorAttemptCounts: Record<string, number>;
}

/**
 * Result of checking if a fix should be attempted
 */
export interface FixAttemptDecision {
  /** Whether to proceed with the fix */
  shouldAttempt: boolean;
  /** If not attempting, the reason why */
  reason?: 'max_per_error' | 'max_total' | 'backoff_active' | 'loop_detected';
  /** If backoff is active, when the next attempt can be made */
  retryAfter?: Date;
  /** Current attempt count for this error */
  attemptCount: number;
  /** Maximum attempts allowed for this error */
  maxAttempts: number;
  /** Delay to apply before this attempt (if proceeding) */
  suggestedDelayMs?: number;
}

/**
 * Loop detection result
 */
export interface LoopDetectionResult {
  /** Whether a loop was detected */
  loopDetected: boolean;
  /** Type of loop if detected */
  loopType?: 'same_error' | 'circular_fixes' | 'oscillating_state';
  /** Detailed description of the loop */
  description?: string;
  /** Errors involved in the loop pattern */
  involvedErrors?: ErrorFingerprint[];
  /** Suggested action to break the loop */
  suggestedAction?: string;
}
```

### 2. FixAttemptTracker Class (packages/orchestrator/src/fix-attempt-tracker.ts)

```typescript
import { createHash } from 'crypto';
import EventEmitter from 'eventemitter3';
import {
  FixAttempt,
  FixAttemptConfig,
  FixAttemptHistory,
  FixAttemptDecision,
  FixAttemptSnapshot,
  ErrorFingerprint,
  ErrorCategory,
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
    category: ErrorCategory,
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
```

### 3. Database Schema Extension (packages/orchestrator/src/store.ts)

Add a new table for fix attempts:

```sql
CREATE TABLE IF NOT EXISTS fix_attempts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  error_hash TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_category TEXT NOT NULL,
  error_file_path TEXT,
  error_line INTEGER,
  error_column INTEGER,
  error_code TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  approach TEXT NOT NULL,
  agent TEXT,
  stage TEXT,
  before_state TEXT,
  after_state TEXT,
  result_success INTEGER NOT NULL DEFAULT 0,
  result_resolved INTEGER NOT NULL DEFAULT 0,
  result_reason TEXT,
  result_new_errors TEXT,
  delay_applied_ms INTEGER,
  metadata TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_fix_attempts_task_id ON fix_attempts(task_id);
CREATE INDEX IF NOT EXISTS idx_fix_attempts_error_hash ON fix_attempts(error_hash);
CREATE INDEX IF NOT EXISTS idx_fix_attempts_started_at ON fix_attempts(started_at);
```

### 4. TaskStore Methods

Add these methods to `TaskStore`:

```typescript
/**
 * Add a fix attempt record to the database
 */
async addFixAttempt(taskId: string, attempt: FixAttempt): Promise<void> {
  const stmt = this.db.prepare(`
    INSERT INTO fix_attempts (
      id, task_id, attempt_number, error_hash, error_message, error_category,
      error_file_path, error_line, error_column, error_code,
      started_at, completed_at, approach, agent, stage,
      before_state, after_state, result_success, result_resolved,
      result_reason, result_new_errors, delay_applied_ms, metadata
    ) VALUES (
      @id, @taskId, @attemptNumber, @errorHash, @errorMessage, @errorCategory,
      @errorFilePath, @errorLine, @errorColumn, @errorCode,
      @startedAt, @completedAt, @approach, @agent, @stage,
      @beforeState, @afterState, @resultSuccess, @resultResolved,
      @resultReason, @resultNewErrors, @delayAppliedMs, @metadata
    )
  `);

  stmt.run({
    id: attempt.id,
    taskId: attempt.taskId,
    attemptNumber: attempt.attemptNumber,
    errorHash: attempt.error.hash,
    errorMessage: attempt.error.message,
    errorCategory: attempt.error.category,
    errorFilePath: attempt.error.filePath ?? null,
    errorLine: attempt.error.line ?? null,
    errorColumn: attempt.error.column ?? null,
    errorCode: attempt.error.code ?? null,
    startedAt: attempt.startedAt.toISOString(),
    completedAt: attempt.completedAt?.toISOString() ?? null,
    approach: attempt.approach,
    agent: attempt.agent ?? null,
    stage: attempt.stage ?? null,
    beforeState: attempt.beforeState ? JSON.stringify(attempt.beforeState) : null,
    afterState: attempt.afterState ? JSON.stringify(attempt.afterState) : null,
    resultSuccess: attempt.result.success ? 1 : 0,
    resultResolved: attempt.result.resolved ? 1 : 0,
    resultReason: attempt.result.reason ?? null,
    resultNewErrors: attempt.result.newErrors ? JSON.stringify(attempt.result.newErrors) : null,
    delayAppliedMs: attempt.delayAppliedMs ?? null,
    metadata: attempt.metadata ? JSON.stringify(attempt.metadata) : null,
  });
}

/**
 * Get fix attempt history for a task
 */
async getFixAttemptHistory(taskId: string): Promise<FixAttemptHistory> {
  const stmt = this.db.prepare(`
    SELECT * FROM fix_attempts
    WHERE task_id = ?
    ORDER BY started_at ASC
  `);
  const rows = stmt.all(taskId) as FixAttemptRow[];

  const entries: FixAttempt[] = rows.map(row => this.rowToFixAttempt(row));

  // Build error attempt counts
  const errorAttemptCounts: Record<string, number> = {};
  for (const entry of entries) {
    errorAttemptCounts[entry.error.hash] =
      (errorAttemptCounts[entry.error.hash] ?? 0) + 1;
  }

  return {
    entries,
    totalAttempts: entries.length,
    resolvedCount: entries.filter(e => e.result.resolved).length,
    failedCount: entries.filter(e => !e.result.resolved).length,
    lastAttemptAt: entries.length > 0 ? entries[entries.length - 1].startedAt : undefined,
    errorAttemptCounts,
  };
}

/**
 * Clear all fix attempts for a task
 */
async clearFixAttempts(taskId: string): Promise<void> {
  const stmt = this.db.prepare('DELETE FROM fix_attempts WHERE task_id = ?');
  stmt.run(taskId);
}

private rowToFixAttempt(row: FixAttemptRow): FixAttempt {
  return {
    id: row.id,
    taskId: row.task_id,
    attemptNumber: row.attempt_number,
    error: {
      hash: row.error_hash,
      message: row.error_message,
      category: row.error_category as ErrorCategory,
      filePath: row.error_file_path ?? undefined,
      line: row.error_line ?? undefined,
      column: row.error_column ?? undefined,
      code: row.error_code ?? undefined,
    },
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    approach: row.approach,
    agent: row.agent ?? undefined,
    stage: row.stage ?? undefined,
    beforeState: row.before_state ? JSON.parse(row.before_state) : undefined,
    afterState: row.after_state ? JSON.parse(row.after_state) : undefined,
    result: {
      success: row.result_success === 1,
      resolved: row.result_resolved === 1,
      reason: row.result_reason ?? undefined,
      newErrors: row.result_new_errors ? JSON.parse(row.result_new_errors) : undefined,
    },
    delayAppliedMs: row.delay_applied_ms ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}
```

### 5. Integration with OrchestratorEvents

Add new events to `OrchestratorEvents` interface:

```typescript
// Fix attempt tracking events
'fix:started': (event: FixStartedEventData) => void;
'fix:completed': (event: FixCompletedEventData) => void;
'fix:resolved': (event: FixResolvedEventData) => void;
'fix:failed': (event: FixFailedEventData) => void;
'fix:max-attempts': (event: FixMaxAttemptsEventData) => void;
'fix:loop-detected': (event: FixLoopDetectedEventData) => void;
```

### 6. Configuration Integration

Add to `ApexConfig`:

```typescript
export const ApexConfigSchema = z.object({
  // ... existing fields ...

  /** Fix attempt tracking configuration */
  fixAttemptTracking: FixAttemptConfigSchema.optional(),
});
```

Default configuration in `.apex/config.yaml`:

```yaml
fixAttemptTracking:
  maxAttemptsPerError: 3
  maxTotalAttempts: 10
  backoffStrategy: exponential
  baseDelayMs: 1000
  maxDelayMs: 30000
  groupSimilarErrors: true
  similarityThreshold: 0.8
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FIX ATTEMPT FLOW                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Error Detected                                                      │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────┐                                │
│  │ createErrorFingerprint()        │                                │
│  │ - Normalize message             │                                │
│  │ - Create unique hash            │                                │
│  └─────────────────────────────────┘                                │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────┐     ┌────────────────────────┐ │
│  │ shouldAttemptFix()              │────▶│ Return decision:       │ │
│  │ - Check max per error           │     │ - shouldAttempt: bool  │ │
│  │ - Check max total               │     │ - reason (if no)       │ │
│  │ - Check backoff                 │     │ - suggestedDelayMs     │ │
│  │ - Check loop detection          │     └────────────────────────┘ │
│  └─────────────────────────────────┘                                │
│       │                                                              │
│       ▼ (if should attempt)                                         │
│  ┌─────────────────────────────────┐                                │
│  │ Apply backoff delay             │                                │
│  │ (if suggestedDelayMs > 0)       │                                │
│  └─────────────────────────────────┘                                │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────┐                                │
│  │ startFixAttempt()               │                                │
│  │ - Create FixAttempt record      │                                │
│  │ - Capture beforeState           │                                │
│  │ - Emit 'fix:started'            │                                │
│  └─────────────────────────────────┘                                │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────┐                                │
│  │ Agent applies fix               │                                │
│  │ (external to tracker)           │                                │
│  └─────────────────────────────────┘                                │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────┐                                │
│  │ completeFixAttempt()            │                                │
│  │ - Record result                 │                                │
│  │ - Capture afterState            │                                │
│  │ - Update history                │                                │
│  │ - Persist to database           │                                │
│  │ - Emit events                   │                                │
│  └─────────────────────────────────┘                                │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────┐     ┌────────────────────────┐ │
│  │ result.resolved?                │────▶│ Continue task          │ │
│  └─────────────────────────────────┘ YES └────────────────────────┘ │
│       │ NO                                                           │
│       ▼                                                              │
│  Return to "Error Detected" (new error or same error)               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/core/src/types.ts` | Add | New types for error tracking and fix attempts |
| `packages/orchestrator/src/fix-attempt-tracker.ts` | Add | New FixAttemptTracker class |
| `packages/orchestrator/src/fix-attempt-tracker.test.ts` | Add | Unit tests for FixAttemptTracker |
| `packages/orchestrator/src/store.ts` | Modify | Add fix_attempts table and methods |
| `packages/orchestrator/src/index.ts` | Modify | Export FixAttemptTracker, add events |
| `packages/core/src/types.ts` | Modify | Add FixAttemptConfig to ApexConfig |

## Testing Strategy

### Unit Tests

1. **Error Fingerprinting**:
   - Verify consistent hashing for same error
   - Verify different hashes for different errors
   - Test message normalization

2. **Attempt Decision Logic**:
   - Test max attempts per error enforcement
   - Test max total attempts enforcement
   - Test backoff delay calculation
   - Test decision when limits not reached

3. **Backoff Strategies**:
   - Verify constant delay calculation
   - Verify linear delay calculation
   - Verify exponential delay calculation
   - Verify max delay cap

4. **Loop Detection**:
   - Test same-error loop detection
   - Test oscillating pattern detection
   - Test circular pattern detection
   - Test no-loop scenarios

5. **History Management**:
   - Test history accumulation
   - Test counts (resolved, failed, total)
   - Test error attempt count tracking

### Integration Tests

1. **Database Persistence**:
   - Test addFixAttempt persistence
   - Test getFixAttemptHistory retrieval
   - Test clearFixAttempts cleanup

2. **Event Emission**:
   - Verify events emitted at correct times
   - Verify event payloads are correct

3. **Full Workflow**:
   - Multiple fix attempts for same error
   - Fix that resolves error
   - Fix that introduces new error
   - Backoff enforcement across attempts

## Consequences

### Positive
- Prevents infinite fix loops that waste resources
- Provides visibility into fix attempt patterns
- Enables intelligent backoff to allow external issues to resolve
- Preserves audit trail for debugging
- Follows established patterns (like IterationHistory)

### Negative
- Adds complexity to error handling flow
- May delay legitimate retry attempts due to backoff
- Requires integration work with ErrorFeedbackLoop (future)

### Neutral
- Default configuration is conservative (3 attempts per error)
- Configurable per-project to adjust behavior
- No performance impact for normal (non-error) execution

## Future Integration: ErrorFeedbackLoop

The `FixAttemptTracker` is designed to integrate with a future `ErrorFeedbackLoop` class:

```typescript
class ErrorFeedbackLoop {
  private fixTracker: FixAttemptTracker;

  async handleError(error: Error, context: ErrorContext): Promise<FixResult> {
    const fingerprint = this.fixTracker.createErrorFingerprint(
      error.message,
      this.categorizeError(error),
      { filePath: context.file, line: context.line }
    );

    const decision = this.fixTracker.shouldAttemptFix(fingerprint);
    if (!decision.shouldAttempt) {
      return { action: 'escalate', reason: decision.reason };
    }

    if (decision.suggestedDelayMs) {
      await this.delay(decision.suggestedDelayMs);
    }

    const attempt = await this.fixTracker.startFixAttempt(
      fingerprint,
      'Attempting automated fix',
      { beforeState: this.captureState() }
    );

    try {
      const fixResult = await this.applyFix(error, context);
      await this.fixTracker.completeFixAttempt(
        { success: true, resolved: fixResult.resolved },
        this.captureState()
      );
      return fixResult;
    } catch (e) {
      await this.fixTracker.completeFixAttempt(
        { success: false, resolved: false, reason: e.message },
        this.captureState()
      );
      throw e;
    }
  }
}
```

## Implementation Notes

1. **Error fingerprinting should be stable**: Small variations in error messages should map to the same fingerprint when they represent the same underlying issue.

2. **Backoff starts from attempt 1**: The first retry (attempt 2) will have a delay; the initial attempt (attempt 1) has no delay.

3. **Loop detection is conservative**: It requires clear patterns before declaring a loop to avoid false positives.

4. **Similar error grouping uses Jaccard similarity**: This is a simple but effective method for short text comparison.

5. **State snapshots are optional**: The tracker works without them but provides better diagnostics when they're captured.
