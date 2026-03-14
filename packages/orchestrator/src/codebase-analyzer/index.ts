/**
 * Codebase Analyzer Module
 *
 * Entry point for all codebase analysis functionality.
 * Exports analyzers and types for brownfield codebase analysis.
 */

export { ConventionAnalyzer } from './analyzers/convention-analyzer.js';
export { StackAnalyzer } from './analyzers/stack-analyzer.js';
export { ArchitectureAnalyzer } from './analyzers/architecture-analyzer.js';
export { TestingPatternAnalyzer } from './analyzers/testing-analyzer.js';
export { IntegrationAnalyzer } from './analyzers/integration-analyzer.js';
export { TechnicalDebtAnalyzer } from './analyzers/debt-analyzer.js';
export {
  createCodebaseAnalyzer,
  CodebaseAnalysisOrchestratorImpl
} from './orchestrator.js';

// Export types
export type {
  CodebaseAnalyzer,
  CodebaseAnalysisOrchestrator,
  AnalysisOptions,
  AnalysisProgress,
  AnalysisError,
  AnalysisContext,
  FileInfo,
  DomainAnalysisResult,
  CodebaseAnalyzerBase,
  AnalysisOutputWriter,
} from './types.js';

// Export enums
export { AnalysisPhase, OutputFormat } from './types.js';