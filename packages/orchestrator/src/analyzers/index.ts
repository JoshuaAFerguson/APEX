/**
 * Strategy Analyzer barrel export
 *
 * Re-exports base types/classes from base-analyzer.ts and all analyzer implementations.
 * Types and BaseAnalyzer are in a separate file to avoid circular dependencies
 * (analyzers import BaseAnalyzer, and this file re-exports them).
 */

// Re-export base types and class
export {
  BaseAnalyzer,
  type RemediationActionType,
  type RemediationSuggestion,
  type TaskCandidate,
  type StrategyAnalyzer,
} from './base-analyzer';

// Re-export analyzer implementations
export { MaintenanceAnalyzer } from './maintenance-analyzer';
export { RefactoringAnalyzer } from './refactoring-analyzer';
export { DocsAnalyzer } from './docs-analyzer';
export { TestsAnalyzer } from './tests-analyzer';
export { TechnicalDebtAnalyzer } from './technical-debt-analyzer';
export { VersionMismatchDetector } from './version-mismatch-detector';
export { ConventionAnalyzer } from './convention-analyzer';
export {
  CrossReferenceValidator,
  type DocumentationReference,
  type SymbolInfo,
  type SymbolIndex,
  type SymbolExtractionOptions
} from './cross-reference-validator';
