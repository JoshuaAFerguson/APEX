/**
 * Codebase Analysis Orchestrator Implementation
 *
 * Coordinates multiple analyzer phases and provides unified analysis results.
 * Supports tree-sitter parsing for enhanced code understanding.
 */

import { EventEmitter } from 'eventemitter3';
import {
  AnalysisPhase,
  type CodebaseAnalysisOrchestrator,
  type AnalysisOptions,
  type AnalysisProgress,
  type AnalysisError,
  type DomainAnalysisResult,
} from './types.js';
import { ConventionAnalyzer } from './analyzers/convention-analyzer.js';

/**
 * Default analysis options
 */
const DEFAULT_OPTIONS: Required<AnalysisOptions> = {
  includeDetails: true,
  maxDepth: 10,
  excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
  enableParsing: true
};

/**
 * Implementation of the codebase analysis orchestrator
 */
export class CodebaseAnalysisOrchestratorImpl extends EventEmitter implements CodebaseAnalysisOrchestrator {
  private progressCallback?: (progress: AnalysisProgress) => void;
  private errorCallback?: (error: AnalysisError) => void;

  async analyze(projectPath: string, options?: AnalysisOptions): Promise<DomainAnalysisResult[]> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const results: DomainAnalysisResult[] = [];

    try {
      // Convention analysis using tree-sitter
      await this.executePhase(
        AnalysisPhase.CONVENTIONS,
        async () => {
          const analyzer = new ConventionAnalyzer();
          const startTime = Date.now();

          this.reportProgress({
            phase: AnalysisPhase.CONVENTIONS,
            progress: 0,
            currentFile: 'Initializing convention analysis...'
          });

          const data = await analyzer.analyze(projectPath);
          const executionTime = Date.now() - startTime;

          this.reportProgress({
            phase: AnalysisPhase.CONVENTIONS,
            progress: 100
          });

          return {
            phase: AnalysisPhase.CONVENTIONS,
            success: true,
            data,
            executionTime
          };
        },
        results
      );

      // TODO: Add other analysis phases (stack, architecture, technical debt, documentation)
      // These would utilize the tree-sitter dependencies for enhanced parsing

      return results;
    } catch (error) {
      const analysisError: AnalysisError = {
        message: error instanceof Error ? error.message : 'Unknown analysis error',
        cause: error instanceof Error ? error : undefined
      };

      this.reportError(analysisError);
      throw error;
    }
  }

  getSupportedPhases(): AnalysisPhase[] {
    return [
      AnalysisPhase.CONVENTIONS,
      // TODO: Enable these as they are implemented
      // AnalysisPhase.STACK,
      // AnalysisPhase.ARCHITECTURE,
      // AnalysisPhase.TECHNICAL_DEBT,
      // AnalysisPhase.DOCUMENTATION
    ];
  }

  onProgress(callback: (progress: AnalysisProgress) => void): void {
    this.progressCallback = callback;
  }

  onError(callback: (error: AnalysisError) => void): void {
    this.errorCallback = callback;
  }

  private async executePhase<T>(
    phase: AnalysisPhase,
    executor: () => Promise<DomainAnalysisResult>,
    results: DomainAnalysisResult[]
  ): Promise<void> {
    try {
      const result = await executor();
      results.push(result);
    } catch (error) {
      const analysisError: AnalysisError = {
        message: `Error in ${phase} phase: ${error instanceof Error ? error.message : 'Unknown error'}`,
        phase,
        cause: error instanceof Error ? error : undefined
      };

      this.reportError(analysisError);

      // Add failed result
      results.push({
        phase,
        success: false,
        data: null,
        executionTime: 0,
        warnings: [analysisError.message]
      });
    }
  }

  private reportProgress(progress: AnalysisProgress): void {
    this.progressCallback?.(progress);
    this.emit('progress', progress);
  }

  private reportError(error: AnalysisError): void {
    this.errorCallback?.(error);
    this.emit('error', error);
  }
}

/**
 * Factory function to create a new codebase analysis orchestrator
 */
export function createCodebaseAnalyzer(): CodebaseAnalysisOrchestrator {
  return new CodebaseAnalysisOrchestratorImpl();
}