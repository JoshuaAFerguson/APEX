/**
 * Self-Repair Loop Event Definitions
 *
 * Typed event interfaces for the repair loop lifecycle, emitted by the
 * orchestrator during diagnosis, fix application, and validation cycles.
 *
 * @module repair-loop/repair-events
 */

import type { ErrorFingerprint, FixAttempt } from '@apexcli/core';
import type { RepairDiagnosis, RepairFixPlan } from './repair-types.js';

// ============================================================================
// Termination & Escalation Types
// ============================================================================

export type RepairTerminationReason =
  | 'resolved'
  | 'max_attempts'
  | 'loop_detected'
  | 'budget_exceeded'
  | 'timeout'
  | 'unrecoverable'
  | 'escalated';

export interface EscalationReport {
  /** High-level summary of what went wrong */
  summary: string;
  /** Root cause analysis from diagnosis */
  rootCauseAnalysis: string;
  /** Summary of each attempted fix and its outcome */
  attemptsSummary: Array<{ approach: string; outcome: string }>;
  /** Suggested manual actions for the operator */
  suggestedActions: string[];
  /** Files involved in the failure */
  affectedFiles: string[];
  /** Error fingerprints encountered */
  errorFingerprints: ErrorFingerprint[];
}

// ============================================================================
// Event Payloads
// ============================================================================

export interface RepairStartedEvent {
  taskId: string;
  stageName: string;
  stageAgent: string;
  errorCount: number;
  errors: ErrorFingerprint[];
  timestamp: Date;
}

export interface RepairStateChangeEvent {
  taskId: string;
  stageName: string;
  fromState: string;
  toState: string;
  iteration: number;
  timestamp: Date;
}

export interface RepairDiagnosisEvent {
  taskId: string;
  stageName: string;
  diagnosis: RepairDiagnosis;
  iteration: number;
  timestamp: Date;
}

export interface RepairFixPlannedEvent {
  taskId: string;
  stageName: string;
  plan: RepairFixPlan;
  previousApproaches: string[];
  iteration: number;
  timestamp: Date;
}

export interface RepairFixAppliedEvent {
  taskId: string;
  stageName: string;
  attempt: FixAttempt;
  filesModified: string[];
  iteration: number;
  timestamp: Date;
}

export interface RepairValidationEvent {
  taskId: string;
  stageName: string;
  passed: boolean;
  newErrors?: ErrorFingerprint[];
  iteration: number;
  timestamp: Date;
}

export interface RepairResolvedEvent {
  taskId: string;
  stageName: string;
  totalAttempts: number;
  totalDurationMs: number;
  successfulApproach: string;
  timestamp: Date;
}

export interface RepairEscalatedEvent {
  taskId: string;
  stageName: string;
  reason: RepairTerminationReason;
  report: EscalationReport;
  totalAttempts: number;
  totalDurationMs: number;
  timestamp: Date;
}

export interface RepairTerminatedEvent {
  taskId: string;
  stageName: string;
  reason: RepairTerminationReason;
  resolved: boolean;
  totalAttempts: number;
  timestamp: Date;
}

// ============================================================================
// Event Map (for type-safe EventEmitter registration)
// ============================================================================

export interface RepairLoopEvents {
  'repair:started': (event: RepairStartedEvent) => void;
  'repair:state-change': (event: RepairStateChangeEvent) => void;
  'repair:diagnosis': (event: RepairDiagnosisEvent) => void;
  'repair:fix-planned': (event: RepairFixPlannedEvent) => void;
  'repair:fix-applied': (event: RepairFixAppliedEvent) => void;
  'repair:validation-passed': (event: RepairValidationEvent) => void;
  'repair:validation-failed': (event: RepairValidationEvent) => void;
  'repair:resolved': (event: RepairResolvedEvent) => void;
  'repair:escalated': (event: RepairEscalatedEvent) => void;
  'repair:terminated': (event: RepairTerminatedEvent) => void;
}
