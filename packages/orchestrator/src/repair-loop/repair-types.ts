/**
 * Self-Repair Loop Types
 *
 * Core type definitions for the repair loop state machine, including
 * diagnosis results, fix plans, and loop context.
 *
 * @module repair-loop/repair-types
 */

import type {
  ErrorFingerprint,
  FixAttempt,
  FixAttemptHistory,
  ErrorCategory,
} from '@apexcli/core';
import type { RepairConfig } from './repair-config.js';
import type { RepairTerminationReason, EscalationReport } from './repair-events.js';

// ============================================================================
// State Machine
// ============================================================================

export type RepairState =
  | 'idle'
  | 'observing'
  | 'diagnosing'
  | 'planning_fix'
  | 'applying_fix'
  | 'validating'
  | 'resolved'
  | 'escalating'
  | 'terminated';

// ============================================================================
// Error Classification
// ============================================================================

export type ErrorSeverity = 'blocking' | 'degrading' | 'cosmetic';

export interface ClassifiedError {
  /** Structured fingerprint for deduplication */
  fingerprint: ErrorFingerprint;
  /** Error category from core */
  category: ErrorCategory;
  /** Impact severity */
  severity: ErrorSeverity;
  /** Whether the repair loop can potentially fix this */
  isRecoverable: boolean;
  /** Which agent type should attempt the fix */
  suggestedAgent: string;
  /** Files involved in the error */
  relatedFiles: string[];
}

// ============================================================================
// Diagnosis & Fix Planning
// ============================================================================

export interface RepairDiagnosis {
  /** Natural language root cause explanation */
  rootCause: string;
  /** Classified error category */
  errorCategory: string;
  /** Files that need modification to resolve the issue */
  affectedFiles: string[];
  /** Potential fix strategies ordered by confidence */
  suggestedApproaches: string[];
  /** Confidence in the diagnosis (0-1) */
  confidence: number;
  /** If true, repair loop should escalate immediately */
  requiresHumanInput: boolean;
}

export interface RepairFixPlan {
  /** Selected fix approach from diagnosis */
  approach: string;
  /** Ordered steps to apply the fix */
  steps: string[];
  /** Specific files that will be modified */
  filesToModify: string[];
  /** Description of what success looks like */
  expectedOutcome: string;
  /** How to undo this fix if it makes things worse */
  rollbackStrategy: string;
}

// ============================================================================
// Loop Context & Results
// ============================================================================

export interface StageResult {
  stageName: string;
  agent: string;
  status: 'completed' | 'failed';
  outputs: Record<string, unknown>;
  artifacts: unknown[];
  summary: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    totalCostCents: number;
    executionTimeMs: number;
  };
  error?: string;
  startedAt: Date;
  completedAt: Date;
  decompositionRequest?: unknown;
}

export interface RepairContext {
  /** Task being repaired */
  taskId: string;
  /** Name of the failed stage */
  stageName: string;
  /** Agent assigned to the failed stage */
  stageAgent: string;
  /** Workflow containing the failed stage */
  workflowName: string;
  /** The stage result that triggered repair */
  failedResult: StageResult;
  /** The error thrown by the failed stage */
  originalError: Error;
  /** Full output collected from the failed stage run */
  stageOutput: string[];
  /** Previous fix attempts loaded from persistence */
  history: FixAttemptHistory;
  /** Repair loop configuration */
  config: RepairConfig;
  /** Current state machine state */
  currentState: RepairState;
  /** When the current state was entered */
  stateEnteredAt: Date;
  /** Current repair iteration within this loop invocation */
  iterationCount: number;
  /** Cumulative cost of repair attempts so far (USD) */
  repairCostSoFar: number;
  /** Cumulative tokens used for repair */
  repairTokensUsed: number;
  /** Timestamp when the repair loop started */
  loopStartedAt: Date;
}

export interface RepairResult {
  /** Whether the repair loop successfully fixed the issue */
  resolved: boolean;
  /** The successful stage result (only if resolved) */
  stageResult?: StageResult;
  /** All fix attempts made during this loop invocation */
  attempts: FixAttempt[];
  /** Why the loop terminated (if not resolved) */
  terminationReason?: RepairTerminationReason;
  /** Detailed escalation report (if escalated) */
  escalationReport?: EscalationReport;
  /** Total wall-clock time spent in the repair loop */
  totalDurationMs: number;
  /** Total tokens consumed by repair queries */
  totalTokensUsed: number;
}

// ============================================================================
// Loop Detection
// ============================================================================

export type LoopType = 'same_error' | 'oscillating' | 'circular_fixes';

export interface LoopDetectionResult {
  /** Whether a loop pattern was detected */
  loopDetected: boolean;
  /** Type of loop pattern found */
  loopType?: LoopType;
  /** Human-readable description of the detected pattern */
  description?: string;
  /** Error fingerprints involved in the loop */
  involvedErrors?: ErrorFingerprint[];
}
