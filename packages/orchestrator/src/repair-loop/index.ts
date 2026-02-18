/**
 * Self-Repair Loop Module
 *
 * Exports the autonomous repair loop engine, error classifier, configuration,
 * event types, and prompt builders.
 *
 * @module repair-loop
 */

export { RepairLoop } from './repair-loop.js';
export type { RepairLoopHost, RepairQueryOptions, RepairQueryResult } from './repair-loop.js';
export { ErrorClassifier } from './error-classifier.js';
export { RepairConfigSchema, resolveRepairConfig, DEFAULT_REPAIR_CONFIG } from './repair-config.js';
export type { RepairConfig } from './repair-config.js';
export { buildDiagnosisPrompt, buildRepairPrompt, buildEscalationPrompt } from './repair-prompts.js';
export type { DiagnosisPromptContext, RepairPromptContext, EscalationPromptContext } from './repair-prompts.js';

export type {
  RepairState,
  RepairContext,
  RepairResult,
  RepairDiagnosis,
  RepairFixPlan,
  ClassifiedError,
  ErrorSeverity,
  StageResult as RepairStageResult,
  LoopDetectionResult,
  LoopType,
} from './repair-types.js';

export type {
  RepairTerminationReason,
  EscalationReport,
  RepairLoopEvents,
  RepairStartedEvent,
  RepairStateChangeEvent,
  RepairDiagnosisEvent,
  RepairFixPlannedEvent,
  RepairFixAppliedEvent,
  RepairValidationEvent,
  RepairResolvedEvent,
  RepairEscalatedEvent,
  RepairTerminatedEvent,
} from './repair-events.js';
