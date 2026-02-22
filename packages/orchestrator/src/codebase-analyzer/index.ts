/**
 * Codebase Analyzer Module
 *
 * Entry point for all codebase analysis functionality.
 * Exports analyzers and types for brownfield codebase analysis.
 */

export { ConventionAnalyzer } from './analyzers/convention-analyzer.js';
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
  OutputFormat
} from './types.js';

// Export enums
export { AnalysisPhase, OutputFormat } from './types.js';