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
import { StackAnalyzer } from './analyzers/stack-analyzer.js';
import { ArchitectureAnalyzer } from './analyzers/architecture-analyzer.js';
import { TestingPatternAnalyzer } from './analyzers/testing-analyzer.js';
import { IntegrationAnalyzer } from './analyzers/integration-analyzer.js';
import { TechnicalDebtAnalyzer } from './analyzers/debt-analyzer.js';

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
      // Stack analysis
      await this.executePhase(
        AnalysisPhase.STACK,
        async () => {
          const analyzer = new StackAnalyzer();
          const startTime = Date.now();

          this.reportProgress({
            phase: AnalysisPhase.STACK,
            progress: 0,
            currentFile: 'Initializing stack analysis...'
          });

          const data = await analyzer.analyze(projectPath);
          const executionTime = Date.now() - startTime;

          this.reportProgress({
            phase: AnalysisPhase.STACK,
            progress: 100
          });

          return {
            phase: AnalysisPhase.STACK,
            success: true,
            data,
            executionTime
          };
        },
        results
      );

      // Architecture analysis
      await this.executePhase(
        AnalysisPhase.ARCHITECTURE,
        async () => {
          const analyzer = new ArchitectureAnalyzer();
          const startTime = Date.now();

          this.reportProgress({
            phase: AnalysisPhase.ARCHITECTURE,
            progress: 0,
            currentFile: 'Initializing architecture analysis...'
          });

          const data = await analyzer.analyze(projectPath);
          const executionTime = Date.now() - startTime;

          this.reportProgress({
            phase: AnalysisPhase.ARCHITECTURE,
            progress: 100
          });

          return {
            phase: AnalysisPhase.ARCHITECTURE,
            success: true,
            data,
            executionTime
          };
        },
        results
      );

      // Convention analysis
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

      // Testing pattern analysis
      await this.executePhase(
        AnalysisPhase.TESTING_PATTERNS,
        async () => {
          const analyzer = new TestingPatternAnalyzer();
          const startTime = Date.now();

          this.reportProgress({
            phase: AnalysisPhase.TESTING_PATTERNS,
            progress: 0,
            currentFile: 'Initializing testing pattern analysis...'
          });

          const data = await analyzer.analyze(projectPath);
          const executionTime = Date.now() - startTime;

          this.reportProgress({
            phase: AnalysisPhase.TESTING_PATTERNS,
            progress: 100
          });

          return {
            phase: AnalysisPhase.TESTING_PATTERNS,
            success: true,
            data,
            executionTime
          };
        },
        results
      );

      // Integration analysis
      await this.executePhase(
        AnalysisPhase.INTEGRATIONS,
        async () => {
          const analyzer = new IntegrationAnalyzer();
          const startTime = Date.now();

          this.reportProgress({
            phase: AnalysisPhase.INTEGRATIONS,
            progress: 0,
            currentFile: 'Initializing integration analysis...'
          });

          const data = await analyzer.analyze(projectPath);
          const executionTime = Date.now() - startTime;

          this.reportProgress({
            phase: AnalysisPhase.INTEGRATIONS,
            progress: 100
          });

          return {
            phase: AnalysisPhase.INTEGRATIONS,
            success: true,
            data,
            executionTime
          };
        },
        results
      );

      // Technical debt analysis
      await this.executePhase(
        AnalysisPhase.TECHNICAL_DEBT,
        async () => {
          const analyzer = new TechnicalDebtAnalyzer();
          const startTime = Date.now();

          this.reportProgress({
            phase: AnalysisPhase.TECHNICAL_DEBT,
            progress: 0,
            currentFile: 'Initializing technical debt analysis...'
          });

          const data = await analyzer.analyze(projectPath);
          const executionTime = Date.now() - startTime;

          this.reportProgress({
            phase: AnalysisPhase.TECHNICAL_DEBT,
            progress: 100
          });

          return {
            phase: AnalysisPhase.TECHNICAL_DEBT,
            success: true,
            data,
            executionTime
          };
        },
        results
      );

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
      AnalysisPhase.STACK,
      AnalysisPhase.ARCHITECTURE,
      AnalysisPhase.CONVENTIONS,
      AnalysisPhase.TESTING_PATTERNS,
      AnalysisPhase.INTEGRATIONS,
      AnalysisPhase.TECHNICAL_DEBT,
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