/**
 * Codebase Analysis Types and Enums
 *
 * Defines the analysis phases and result types for brownfield codebase analysis.
 * Each analyzer returns structured data conforming to these schemas.
 */

/** Analysis phases for brownfield codebase examination */
export enum AnalysisPhase {
  /** Technology stack and framework identification */
  STACK = 'stack',

  /** Architecture patterns and design analysis */
  ARCHITECTURE = 'architecture',

  /** Coding conventions and style analysis */
  CONVENTIONS = 'conventions',

  /** Technical debt identification and categorization */
  TECHNICAL_DEBT = 'technical-debt',

  /** Documentation quality and coverage analysis */
  DOCUMENTATION = 'documentation'
}

/**
 * Base interface for all codebase analyzers
 */
export interface CodebaseAnalyzer<T> {
  /**
   * Analyze a codebase directory and return structured analysis
   *
   * @param projectPath - Absolute path to the project root directory
   * @returns Promise resolving to analysis result conforming to schema
   */
  analyze(projectPath: string): Promise<T>;
}

/**
 * Analysis options for codebase examination
 */
export interface AnalysisOptions {
  /** Include detailed file-level analysis */
  includeDetails?: boolean;
  /** Maximum depth for directory traversal */
  maxDepth?: number;
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Enable tree-sitter parsing */
  enableParsing?: boolean;
}

/**
 * Progress information during analysis
 */
export interface AnalysisProgress {
  /** Current phase being executed */
  phase: AnalysisPhase;
  /** Percentage complete (0-100) */
  progress: number;
  /** Currently processed file or operation */
  currentFile?: string;
  /** Total files to process */
  totalFiles?: number;
  /** Files processed so far */
  processedFiles?: number;
}

/**
 * Analysis error information
 */
export interface AnalysisError {
  /** Error message */
  message: string;
  /** File path where error occurred */
  filePath?: string;
  /** Analysis phase where error occurred */
  phase?: AnalysisPhase;
  /** Underlying error cause */
  cause?: Error;
}

/**
 * File information structure
 */
export interface FileInfo {
  /** Absolute file path */
  path: string;
  /** Relative path from project root */
  relativePath: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  modified: Date;
  /** File extension */
  extension: string;
  /** Detected language */
  language?: string;
}

/**
 * Analysis context passed to analyzers
 */
export interface AnalysisContext {
  /** Project root path */
  projectPath: string;
  /** Analysis options */
  options: AnalysisOptions;
  /** Progress callback */
  onProgress?: (progress: AnalysisProgress) => void;
  /** Error callback */
  onError?: (error: AnalysisError) => void;
}

/**
 * Domain-specific analysis result
 */
export interface DomainAnalysisResult {
  /** Analysis phase */
  phase: AnalysisPhase;
  /** Analysis success status */
  success: boolean;
  /** Analysis results data */
  data: any;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Any warnings generated */
  warnings?: string[];
}

/**
 * Base class for codebase analyzers
 */
export abstract class CodebaseAnalyzerBase<T> implements CodebaseAnalyzer<T> {
  abstract analyze(projectPath: string): Promise<T>;
}

/**
 * Output format options
 */
export enum OutputFormat {
  JSON = 'json',
  YAML = 'yaml',
  MARKDOWN = 'markdown'
}

/**
 * Analysis output writer interface
 */
export interface AnalysisOutputWriter {
  /** Write analysis results to file */
  write(results: any, outputPath: string, format: OutputFormat): Promise<void>;
}

/**
 * Main codebase analysis orchestrator interface
 */
export interface CodebaseAnalysisOrchestrator {
  /** Execute analysis with given options */
  analyze(projectPath: string, options?: AnalysisOptions): Promise<DomainAnalysisResult[]>;

  /** Get supported analysis phases */
  getSupportedPhases(): AnalysisPhase[];

  /** Register progress callback */
  onProgress(callback: (progress: AnalysisProgress) => void): void;

  /** Register error callback */
  onError(callback: (error: AnalysisError) => void): void;
}