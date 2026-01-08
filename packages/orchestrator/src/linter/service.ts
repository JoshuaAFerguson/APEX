/**
 * LinterService - Orchestration Layer for Linter Plugins
 *
 * This module provides a unified service for managing, executing, and coordinating
 * multiple linter plugins. It supports both sequential and parallel execution modes,
 * aggregates results from all linters, and coordinates auto-fix operations.
 *
 * Key features:
 * - Plugin registration with priority-based ordering
 * - Sequential or parallel linter execution
 * - Result aggregation across multiple linters
 * - Fix conflict detection and safe fix application
 * - Comprehensive event emission for progress tracking
 *
 * @module orchestrator/linter/service
 *
 * @example
 * ```typescript
 * const service = new LinterService({
 *   projectPath: '/path/to/project',
 *   maxConcurrency: 4,
 * });
 *
 * await service.initialize();
 *
 * // Register plugins
 * service.register(new ESLintPlugin(), { priority: 1 });
 * service.register(new PrettierPlugin(), { priority: 2 });
 *
 * // Execute all linters
 * const result = await service.execute({
 *   mode: 'parallel',
 *   files: ['src/**\/*.ts'],
 * });
 *
 * console.log(`Found ${result.summary.totalIssues} issues`);
 * ```
 */

import { EventEmitter } from 'eventemitter3';
import { randomUUID } from 'crypto';
import {
  ILinterPlugin,
  LintResult,
  LintIssue,
  LintSeverity,
  FixResult,
  LinterExecuteOptions,
  LintStartedEvent,
  LintCompletedEvent,
  LintIssueEvent,
  FixAppliedEvent,
} from './plugin';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Options for initializing the LinterService
 */
export interface LinterServiceOptions {
  /** Working directory for linter execution */
  projectPath: string;

  /** Default timeout for linter execution in milliseconds (default: 60000) */
  defaultTimeout?: number;

  /** Maximum concurrent linters when running in parallel (default: 4) */
  maxConcurrency?: number;

  /** Auto-fix configuration */
  autoFix?: AutoFixConfig;
}

/**
 * Configuration for auto-fix behavior
 */
export interface AutoFixConfig {
  /** Whether auto-fix is enabled globally */
  enabled: boolean;

  /** Maximum retry attempts for failed fixes (default: 3) */
  maxAttempts?: number;

  /** Backoff time between retry attempts in ms (default: 1000) */
  backoffMs?: number;
}

/**
 * Per-plugin configuration options
 */
export interface LinterPluginConfig {
  /** Priority for execution order (lower = higher priority, default: 100) */
  priority?: number;

  /** Whether the plugin is enabled (default: true) */
  enabled?: boolean;

  /** Override timeout for this specific linter */
  timeout?: number;

  /** File patterns to include (overrides plugin defaults) */
  include?: string[];

  /** File patterns to exclude */
  exclude?: string[];

  /** Whether to enable auto-fix for this linter (default: true) */
  autoFix?: boolean;

  /** Additional linter-specific configuration */
  extraConfig?: Record<string, unknown>;
}

/**
 * Internal representation of a registered plugin
 */
export interface RegisteredPlugin {
  /** The plugin instance */
  plugin: ILinterPlugin;

  /** Whether the plugin is currently enabled */
  enabled: boolean;

  /** Execution priority (lower = higher priority) */
  priority: number;

  /** Plugin-specific configuration */
  config: LinterPluginConfig;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Execution mode for running linters
 */
export type ExecutionMode = 'sequential' | 'parallel';

/**
 * Options for executing linters
 */
export interface ExecuteOptions {
  /** Execution mode (default: 'sequential') */
  mode?: ExecutionMode;

  /** Specific files to lint */
  files?: string[];

  /** File patterns to lint */
  patterns?: string[];

  /** Whether to apply auto-fixes (default: false) */
  fix?: boolean;

  /** Run only specific linters by ID */
  linterIds?: string[];

  /** Stop execution on first linter failure (default: false) */
  stopOnError?: boolean;

  /** Timeout override in milliseconds */
  timeout?: number;

  /** Environment variables to pass to linter processes */
  env?: Record<string, string>;
}

/**
 * Options for applying fixes
 */
export interface FixOptions {
  /** Working directory */
  cwd?: string;

  /** Timeout for fix operations */
  timeout?: number;

  /** Whether to skip conflict detection (not recommended) */
  skipConflictDetection?: boolean;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Aggregated result from running multiple linters
 */
export interface AggregatedLintResult {
  /** Overall success (all linters succeeded) */
  success: boolean;

  /** Combined issues from all linters */
  issues: LintIssue[];

  /** Per-linter results for detailed analysis */
  linterResults: Map<string, LintResult>;

  /** Summary statistics */
  summary: LintSummary;

  /** Issues grouped by file for efficient display */
  issuesByFile: Map<string, LintIssue[]>;

  /** Issues grouped by severity */
  issuesBySeverity: Record<LintSeverity, LintIssue[]>;
}

/**
 * Summary statistics for a linting run
 */
export interface LintSummary {
  /** Total number of issues found */
  totalIssues: number;

  /** Number of error-level issues */
  errorCount: number;

  /** Number of warning-level issues */
  warningCount: number;

  /** Number of info-level issues */
  infoCount: number;

  /** Number of hint-level issues */
  hintCount: number;

  /** Number of unique files checked */
  filesChecked: number;

  /** Number of files with at least one issue */
  filesWithIssues: number;

  /** Number of linters that were run */
  lintersRun: number;

  /** Number of linters that succeeded */
  lintersSucceeded: number;

  /** Number of linters that failed */
  lintersFailed: number;

  /** Total duration across all linters in milliseconds */
  totalDuration: number;
}

/**
 * Represents a potential conflict between fixes
 */
export interface FixConflict {
  /** File path where conflict exists */
  filePath: string;

  /** Issues that conflict with each other */
  issues: LintIssue[];

  /** Reason for the conflict */
  reason: 'overlapping-range' | 'same-location' | 'mutual-exclusion';
}

/**
 * A batch of fixes to apply for a single file
 */
export interface FixBatch {
  /** File path to fix */
  filePath: string;

  /** Issues to fix in this batch */
  issues: LintIssue[];

  /** Linter that will apply the fixes */
  linterId: string;
}

/**
 * Plan for applying fixes across all files
 */
export interface FixPlan {
  /** Fixes that can be applied safely */
  safeToApply: LintIssue[];

  /** Fixes with potential conflicts */
  conflicts: FixConflict[];

  /** Order of application */
  applicationOrder: FixBatch[];
}

/**
 * Aggregated result from applying fixes
 */
export interface AggregatedFixResult {
  /** Overall success */
  success: boolean;

  /** Total number of files that were fixed */
  totalFilesFixed: number;

  /** Total number of issues that were fixed */
  totalIssuesFixed: number;

  /** Fix results per linter */
  fixResultsByLinter: Map<string, FixResult>;

  /** Conflicts that prevented fixes */
  conflicts: FixConflict[];

  /** Issues that could not be fixed */
  unfixedIssues: LintIssue[];

  /** Error message if operation failed */
  error?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by LinterService
 */
export interface LinterServiceEvents {
  // Lifecycle events
  'service:initialized': () => void;
  'service:disposed': () => void;

  // Plugin events
  'plugin:registered': (event: PluginRegisteredEvent) => void;
  'plugin:unregistered': (event: PluginUnregisteredEvent) => void;
  'plugin:enabled': (event: PluginStateChangedEvent) => void;
  'plugin:disabled': (event: PluginStateChangedEvent) => void;

  // Execution events
  'execution:started': (event: ExecutionStartedEvent) => void;
  'execution:progress': (event: ExecutionProgressEvent) => void;
  'execution:completed': (event: ExecutionCompletedEvent) => void;
  'execution:error': (event: ExecutionErrorEvent) => void;

  // Per-linter events (forwarded from plugins)
  'linter:started': (event: LinterStartedEvent) => void;
  'linter:completed': (event: LinterCompletedEvent) => void;
  'linter:issue': (event: LinterIssueEvent) => void;

  // Fix events
  'fix:started': (event: FixStartedEvent) => void;
  'fix:progress': (event: FixProgressEvent) => void;
  'fix:completed': (event: FixCompletedEvent) => void;
  'fix:conflict': (event: FixConflictEvent) => void;
}

export interface PluginRegisteredEvent {
  linterId: string;
  pluginName: string;
  priority: number;
  timestamp: Date;
}

export interface PluginUnregisteredEvent {
  linterId: string;
  timestamp: Date;
}

export interface PluginStateChangedEvent {
  linterId: string;
  enabled: boolean;
  timestamp: Date;
}

export interface ExecutionStartedEvent {
  executionId: string;
  mode: ExecutionMode;
  linters: string[];
  files: string[];
  timestamp: Date;
}

export interface ExecutionProgressEvent {
  executionId: string;
  completedLinters: number;
  totalLinters: number;
  currentLinter?: string;
  issuesSoFar: number;
}

export interface ExecutionCompletedEvent {
  executionId: string;
  result: AggregatedLintResult;
  timestamp: Date;
}

export interface ExecutionErrorEvent {
  executionId: string;
  linterId: string;
  error: Error;
  timestamp: Date;
}

export interface LinterStartedEvent {
  executionId: string;
  linterId: string;
  files: string[];
  timestamp: Date;
}

export interface LinterCompletedEvent {
  executionId: string;
  linterId: string;
  result: LintResult;
  timestamp: Date;
}

export interface LinterIssueEvent {
  executionId: string;
  linterId: string;
  issue: LintIssue;
}

export interface FixStartedEvent {
  executionId: string;
  totalIssues: number;
  totalFiles: number;
  timestamp: Date;
}

export interface FixProgressEvent {
  executionId: string;
  fixedIssues: number;
  totalIssues: number;
  currentFile?: string;
}

export interface FixCompletedEvent {
  executionId: string;
  result: AggregatedFixResult;
  timestamp: Date;
}

export interface FixConflictEvent {
  executionId: string;
  conflict: FixConflict;
  timestamp: Date;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<LinterServiceOptions, 'projectPath'>> = {
  defaultTimeout: 60000,
  maxConcurrency: 4,
  autoFix: {
    enabled: false,
    maxAttempts: 3,
    backoffMs: 1000,
  },
};

const DEFAULT_PLUGIN_CONFIG: Required<LinterPluginConfig> = {
  priority: 100,
  enabled: true,
  timeout: 60000,
  include: [],
  exclude: [],
  autoFix: true,
  extraConfig: {},
};

// ============================================================================
// LinterService Implementation
// ============================================================================

/**
 * Orchestration service for managing and executing multiple linter plugins
 *
 * The LinterService provides a unified interface for:
 * - Registering and managing linter plugins
 * - Executing linters in sequential or parallel mode
 * - Aggregating results from multiple linters
 * - Coordinating auto-fix operations with conflict detection
 *
 * @example
 * ```typescript
 * const service = new LinterService({ projectPath: '/my/project' });
 * await service.initialize();
 *
 * service.register(new ESLintPlugin());
 * const result = await service.execute({ files: ['src/*.ts'] });
 * ```
 */
export class LinterService extends EventEmitter<LinterServiceEvents> {
  // ==========================================================================
  // State
  // ==========================================================================

  /** Registered plugins by linter ID */
  private plugins: Map<string, RegisteredPlugin> = new Map();

  /** Service configuration */
  private options: Required<LinterServiceOptions>;

  /** Whether the service has been initialized */
  private initialized = false;

  /** Counter for generating execution IDs */
  private executionCounter = 0;

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Create a new LinterService instance
   *
   * @param options - Service configuration options
   */
  constructor(options: LinterServiceOptions) {
    super();
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      autoFix: {
        ...DEFAULT_OPTIONS.autoFix,
        ...options.autoFix,
      },
    };
  }

  /**
   * Initialize the linter service
   *
   * This method prepares the service for use. It should be called before
   * registering plugins or executing linters.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Future: Load persisted plugin configurations, validate project path, etc.
    this.initialized = true;
    this.emit('service:initialized');
  }

  /**
   * Dispose of the linter service and clean up resources
   *
   * This method should be called when the service is no longer needed.
   * It cleans up event listeners and releases resources.
   */
  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Clean up plugin event listeners
    for (const [linterId, registered] of this.plugins) {
      this.removePluginEventListeners(registered.plugin, linterId);
    }

    this.plugins.clear();
    this.initialized = false;
    this.emit('service:disposed');
  }

  // ==========================================================================
  // Plugin Management
  // ==========================================================================

  /**
   * Register a linter plugin with the service
   *
   * @param plugin - The linter plugin to register
   * @param config - Optional configuration for the plugin
   * @throws Error if a plugin with the same ID is already registered
   *
   * @example
   * ```typescript
   * service.register(new ESLintPlugin(), { priority: 1, autoFix: true });
   * ```
   */
  register(plugin: ILinterPlugin, config?: LinterPluginConfig): void {
    const linterId = plugin.metadata.id;

    if (this.plugins.has(linterId)) {
      throw new Error(`Plugin with ID '${linterId}' is already registered`);
    }

    const mergedConfig: LinterPluginConfig = {
      ...DEFAULT_PLUGIN_CONFIG,
      ...config,
      timeout: config?.timeout ?? this.options.defaultTimeout,
    };

    const registered: RegisteredPlugin = {
      plugin,
      enabled: mergedConfig.enabled ?? true,
      priority: mergedConfig.priority ?? 100,
      config: mergedConfig,
    };

    this.plugins.set(linterId, registered);
    this.forwardPluginEvents(plugin, linterId);

    this.emit('plugin:registered', {
      linterId,
      pluginName: plugin.metadata.name,
      priority: registered.priority,
      timestamp: new Date(),
    });
  }

  /**
   * Unregister a linter plugin from the service
   *
   * @param linterId - The ID of the linter to unregister
   * @returns true if the plugin was unregistered, false if not found
   */
  unregister(linterId: string): boolean {
    const registered = this.plugins.get(linterId);
    if (!registered) {
      return false;
    }

    this.removePluginEventListeners(registered.plugin, linterId);
    this.plugins.delete(linterId);

    this.emit('plugin:unregistered', {
      linterId,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Enable a registered plugin
   *
   * @param linterId - The ID of the linter to enable
   * @throws Error if the plugin is not registered
   */
  enable(linterId: string): void {
    const registered = this.plugins.get(linterId);
    if (!registered) {
      throw new Error(`Plugin with ID '${linterId}' is not registered`);
    }

    if (!registered.enabled) {
      registered.enabled = true;
      this.emit('plugin:enabled', {
        linterId,
        enabled: true,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Disable a registered plugin
   *
   * @param linterId - The ID of the linter to disable
   * @throws Error if the plugin is not registered
   */
  disable(linterId: string): void {
    const registered = this.plugins.get(linterId);
    if (!registered) {
      throw new Error(`Plugin with ID '${linterId}' is not registered`);
    }

    if (registered.enabled) {
      registered.enabled = false;
      this.emit('plugin:disabled', {
        linterId,
        enabled: false,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get a registered plugin by ID
   *
   * @param linterId - The ID of the linter
   * @returns The plugin instance or undefined if not found
   */
  getPlugin(linterId: string): ILinterPlugin | undefined {
    return this.plugins.get(linterId)?.plugin;
  }

  /**
   * Get all registered plugins
   *
   * @returns Array of registered plugins with their configuration
   */
  getRegisteredPlugins(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin's underlying tool is available
   *
   * @param linterId - The ID of the linter to check
   * @returns true if the tool is available, false otherwise
   */
  async isPluginAvailable(linterId: string): Promise<boolean> {
    const registered = this.plugins.get(linterId);
    if (!registered) {
      return false;
    }
    return registered.plugin.isAvailable();
  }

  /**
   * Get all file extensions supported by registered plugins
   *
   * @returns Array of unique file extensions
   */
  getSupportedExtensions(): string[] {
    const extensions = new Set<string>();
    for (const registered of this.plugins.values()) {
      for (const ext of registered.plugin.metadata.supportedExtensions) {
        extensions.add(ext);
      }
    }
    return Array.from(extensions);
  }

  // ==========================================================================
  // Execution
  // ==========================================================================

  /**
   * Execute all enabled linters on the specified files
   *
   * @param options - Execution options
   * @returns Aggregated results from all linters
   *
   * @example
   * ```typescript
   * // Run all linters sequentially
   * const result = await service.execute({
   *   files: ['src/**\/*.ts'],
   *   mode: 'sequential'
   * });
   *
   * // Run specific linters in parallel
   * const result = await service.execute({
   *   linterIds: ['eslint', 'prettier'],
   *   mode: 'parallel'
   * });
   * ```
   */
  async execute(options: ExecuteOptions = {}): Promise<AggregatedLintResult> {
    const executionId = this.generateExecutionId();
    const mode = options.mode ?? 'sequential';

    // Get plugins to run
    const pluginsToRun = this.getPluginsToRun(options.linterIds);

    if (pluginsToRun.length === 0) {
      return this.createEmptyResult();
    }

    const files = options.files ?? options.patterns ?? [];

    // Emit start event
    this.emit('execution:started', {
      executionId,
      mode,
      linters: pluginsToRun.map(p => p.plugin.metadata.id),
      files,
      timestamp: new Date(),
    });

    try {
      const result = mode === 'parallel'
        ? await this.executeParallel(executionId, pluginsToRun, options)
        : await this.executeSequential(executionId, pluginsToRun, options);

      // Apply fixes if requested
      if (options.fix && this.options.autoFix.enabled) {
        const fixableIssues = result.issues.filter(issue => issue.fix);
        if (fixableIssues.length > 0) {
          await this.fix(fixableIssues, { cwd: this.options.projectPath });
        }
      }

      this.emit('execution:completed', {
        executionId,
        result,
        timestamp: new Date(),
      });

      return result;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('execution:error', {
        executionId,
        linterId: 'unknown',
        error: err,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Apply fixes for the given issues
   *
   * @param issues - Issues to fix
   * @param options - Fix options
   * @returns Aggregated fix results
   */
  async fix(issues: LintIssue[], options: FixOptions = {}): Promise<AggregatedFixResult> {
    const executionId = this.generateExecutionId();

    if (issues.length === 0) {
      return {
        success: true,
        totalFilesFixed: 0,
        totalIssuesFixed: 0,
        fixResultsByLinter: new Map(),
        conflicts: [],
        unfixedIssues: [],
      };
    }

    // Plan fixes and detect conflicts
    const plan = options.skipConflictDetection
      ? this.createSimpleFixPlan(issues)
      : this.planFixes(issues);

    // Emit conflict events
    for (const conflict of plan.conflicts) {
      this.emit('fix:conflict', {
        executionId,
        conflict,
        timestamp: new Date(),
      });
    }

    const uniqueFiles = new Set(issues.map(i => i.filePath));
    this.emit('fix:started', {
      executionId,
      totalIssues: issues.length,
      totalFiles: uniqueFiles.size,
      timestamp: new Date(),
    });

    const fixResultsByLinter = new Map<string, FixResult>();
    let totalFilesFixed = 0;
    let totalIssuesFixed = 0;
    const unfixedIssues: LintIssue[] = [...plan.conflicts.flatMap(c => c.issues)];

    // Apply fixes by linter
    for (const batch of plan.applicationOrder) {
      const registered = this.plugins.get(batch.linterId);
      if (!registered || !registered.enabled) {
        unfixedIssues.push(...batch.issues);
        continue;
      }

      try {
        const result = await registered.plugin.fix(batch.issues, {
          cwd: options.cwd ?? this.options.projectPath,
          timeout: options.timeout ?? registered.config.timeout,
        });

        fixResultsByLinter.set(batch.linterId, result);
        totalFilesFixed += result.filesFixed;
        totalIssuesFixed += result.issuesFixed;
        unfixedIssues.push(...result.unfixedIssues);

        this.emit('fix:progress', {
          executionId,
          fixedIssues: totalIssuesFixed,
          totalIssues: issues.length,
          currentFile: batch.filePath,
        });
      } catch (error) {
        unfixedIssues.push(...batch.issues);
      }
    }

    const result: AggregatedFixResult = {
      success: unfixedIssues.length === 0,
      totalFilesFixed,
      totalIssuesFixed,
      fixResultsByLinter,
      conflicts: plan.conflicts,
      unfixedIssues,
    };

    this.emit('fix:completed', {
      executionId,
      result,
      timestamp: new Date(),
    });

    return result;
  }

  // ==========================================================================
  // Private: Execution Helpers
  // ==========================================================================

  /**
   * Execute linters sequentially in priority order
   */
  private async executeSequential(
    executionId: string,
    plugins: RegisteredPlugin[],
    options: ExecuteOptions
  ): Promise<AggregatedLintResult> {
    const results = new Map<string, LintResult>();
    let issuesSoFar = 0;

    // Sort by priority (lower = higher priority)
    const sortedPlugins = [...plugins].sort((a, b) => a.priority - b.priority);

    for (let i = 0; i < sortedPlugins.length; i++) {
      const registered = sortedPlugins[i];
      const linterId = registered.plugin.metadata.id;

      this.emit('execution:progress', {
        executionId,
        completedLinters: i,
        totalLinters: sortedPlugins.length,
        currentLinter: linterId,
        issuesSoFar,
      });

      try {
        const result = await this.executeSingleLinter(executionId, registered, options);
        results.set(linterId, result);
        issuesSoFar += result.issues.length;

        if (!result.success && options.stopOnError) {
          break;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('execution:error', {
          executionId,
          linterId,
          error: err,
          timestamp: new Date(),
        });

        if (options.stopOnError) {
          throw error;
        }

        results.set(linterId, {
          success: false,
          issues: [],
          filesChecked: 0,
          filesWithIssues: 0,
          duration: 0,
          error: err.message,
        });
      }
    }

    return this.aggregateResults(results);
  }

  /**
   * Execute linters in parallel with concurrency control
   */
  private async executeParallel(
    executionId: string,
    plugins: RegisteredPlugin[],
    options: ExecuteOptions
  ): Promise<AggregatedLintResult> {
    const results = new Map<string, LintResult>();
    let completedCount = 0;
    let issuesSoFar = 0;

    // Semaphore for concurrency control
    const maxConcurrency = this.options.maxConcurrency;
    let activeCount = 0;
    const queue: (() => Promise<void>)[] = [];

    const runNext = async () => {
      while (queue.length > 0 && activeCount < maxConcurrency) {
        activeCount++;
        const task = queue.shift()!;
        try {
          await task();
        } finally {
          activeCount--;
          runNext();
        }
      }
    };

    const promises: Promise<void>[] = [];

    for (const registered of plugins) {
      const linterId = registered.plugin.metadata.id;

      const task = async () => {
        try {
          const result = await this.executeSingleLinter(executionId, registered, options);
          results.set(linterId, result);
          issuesSoFar += result.issues.length;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.emit('execution:error', {
            executionId,
            linterId,
            error: err,
            timestamp: new Date(),
          });

          results.set(linterId, {
            success: false,
            issues: [],
            filesChecked: 0,
            filesWithIssues: 0,
            duration: 0,
            error: err.message,
          });
        } finally {
          completedCount++;
          this.emit('execution:progress', {
            executionId,
            completedLinters: completedCount,
            totalLinters: plugins.length,
            issuesSoFar,
          });
        }
      };

      const promise = new Promise<void>((resolve) => {
        queue.push(async () => {
          await task();
          resolve();
        });
      });

      promises.push(promise);
    }

    // Start execution
    runNext();

    // Wait for all to complete
    await Promise.all(promises);

    return this.aggregateResults(results);
  }

  /**
   * Execute a single linter
   */
  private async executeSingleLinter(
    executionId: string,
    registered: RegisteredPlugin,
    options: ExecuteOptions
  ): Promise<LintResult> {
    const linterId = registered.plugin.metadata.id;
    const files = options.files ?? options.patterns ?? [];

    this.emit('linter:started', {
      executionId,
      linterId,
      files,
      timestamp: new Date(),
    });

    const executeOptions: LinterExecuteOptions = {
      cwd: this.options.projectPath,
      files: options.files,
      patterns: options.patterns,
      fix: options.fix && registered.config.autoFix,
      timeout: options.timeout ?? registered.config.timeout,
      env: options.env,
    };

    const result = await registered.plugin.execute(executeOptions);

    this.emit('linter:completed', {
      executionId,
      linterId,
      result,
      timestamp: new Date(),
    });

    return result;
  }

  // ==========================================================================
  // Private: Result Aggregation
  // ==========================================================================

  /**
   * Aggregate results from multiple linters into a unified result
   */
  private aggregateResults(results: Map<string, LintResult>): AggregatedLintResult {
    const allIssues: LintIssue[] = [];
    let totalDuration = 0;
    let lintersSucceeded = 0;
    let lintersFailed = 0;
    const filesCheckedSet = new Set<string>();

    for (const [, result] of results) {
      allIssues.push(...result.issues);
      totalDuration += result.duration;

      if (result.success) {
        lintersSucceeded++;
      } else {
        lintersFailed++;
      }

      // Track files checked (approximation from issues)
      for (const issue of result.issues) {
        filesCheckedSet.add(issue.filePath);
      }
    }

    // Group issues by file
    const issuesByFile = new Map<string, LintIssue[]>();
    for (const issue of allIssues) {
      const existing = issuesByFile.get(issue.filePath) ?? [];
      existing.push(issue);
      issuesByFile.set(issue.filePath, existing);
    }

    // Group issues by severity
    const issuesBySeverity: Record<LintSeverity, LintIssue[]> = {
      error: [],
      warning: [],
      info: [],
      hint: [],
    };
    for (const issue of allIssues) {
      issuesBySeverity[issue.severity].push(issue);
    }

    const summary: LintSummary = {
      totalIssues: allIssues.length,
      errorCount: issuesBySeverity.error.length,
      warningCount: issuesBySeverity.warning.length,
      infoCount: issuesBySeverity.info.length,
      hintCount: issuesBySeverity.hint.length,
      filesChecked: filesCheckedSet.size,
      filesWithIssues: issuesByFile.size,
      lintersRun: results.size,
      lintersSucceeded,
      lintersFailed,
      totalDuration,
    };

    return {
      success: lintersFailed === 0,
      issues: allIssues,
      linterResults: results,
      summary,
      issuesByFile,
      issuesBySeverity,
    };
  }

  /**
   * Create an empty result when no linters are run
   */
  private createEmptyResult(): AggregatedLintResult {
    return {
      success: true,
      issues: [],
      linterResults: new Map(),
      summary: {
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        hintCount: 0,
        filesChecked: 0,
        filesWithIssues: 0,
        lintersRun: 0,
        lintersSucceeded: 0,
        lintersFailed: 0,
        totalDuration: 0,
      },
      issuesByFile: new Map(),
      issuesBySeverity: {
        error: [],
        warning: [],
        info: [],
        hint: [],
      },
    };
  }

  // ==========================================================================
  // Private: Fix Planning
  // ==========================================================================

  /**
   * Plan fixes across all files, detecting conflicts
   */
  private planFixes(issues: LintIssue[]): FixPlan {
    const conflicts = this.detectFixConflicts(issues);
    const conflictingIssues = new Set(conflicts.flatMap(c => c.issues));

    const safeToApply = issues.filter(
      issue => issue.fix && !conflictingIssues.has(issue)
    );

    // Group safe issues by file and linter for batch application
    const batchMap = new Map<string, FixBatch>();
    for (const issue of safeToApply) {
      // Extract linter ID from ruleId prefix or default to 'unknown'
      const linterId = this.getLinterIdForIssue(issue);
      const key = `${issue.filePath}:${linterId}`;

      if (!batchMap.has(key)) {
        batchMap.set(key, {
          filePath: issue.filePath,
          issues: [],
          linterId,
        });
      }
      batchMap.get(key)!.issues.push(issue);
    }

    // Sort batches by file path for deterministic ordering
    const applicationOrder = Array.from(batchMap.values()).sort(
      (a, b) => a.filePath.localeCompare(b.filePath)
    );

    return {
      safeToApply,
      conflicts,
      applicationOrder,
    };
  }

  /**
   * Create a simple fix plan without conflict detection
   */
  private createSimpleFixPlan(issues: LintIssue[]): FixPlan {
    const batchMap = new Map<string, FixBatch>();

    for (const issue of issues) {
      if (!issue.fix) continue;

      const linterId = this.getLinterIdForIssue(issue);
      const key = `${issue.filePath}:${linterId}`;

      if (!batchMap.has(key)) {
        batchMap.set(key, {
          filePath: issue.filePath,
          issues: [],
          linterId,
        });
      }
      batchMap.get(key)!.issues.push(issue);
    }

    return {
      safeToApply: issues.filter(i => i.fix),
      conflicts: [],
      applicationOrder: Array.from(batchMap.values()),
    };
  }

  /**
   * Detect potential conflicts between fixes
   */
  private detectFixConflicts(issues: LintIssue[]): FixConflict[] {
    const conflicts: FixConflict[] = [];
    const issuesByFile = new Map<string, LintIssue[]>();

    // Group issues by file
    for (const issue of issues) {
      if (!issue.fix) continue;

      const existing = issuesByFile.get(issue.filePath) ?? [];
      existing.push(issue);
      issuesByFile.set(issue.filePath, existing);
    }

    // Check each file for conflicts
    for (const [filePath, fileIssues] of issuesByFile) {
      // Check for overlapping ranges
      for (let i = 0; i < fileIssues.length; i++) {
        for (let j = i + 1; j < fileIssues.length; j++) {
          const a = fileIssues[i];
          const b = fileIssues[j];

          if (this.fixesOverlap(a, b)) {
            conflicts.push({
              filePath,
              issues: [a, b],
              reason: 'overlapping-range',
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two issues have overlapping fix ranges
   */
  private fixesOverlap(a: LintIssue, b: LintIssue): boolean {
    if (!a.fix || !b.fix) return false;

    for (const replA of a.fix.replacements) {
      for (const replB of b.fix.replacements) {
        // Check if ranges overlap
        if (replA.startOffset < replB.endOffset && replB.startOffset < replA.endOffset) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get the linter ID for an issue based on registered plugins
   */
  private getLinterIdForIssue(issue: LintIssue): string {
    // Try to match based on ruleId pattern (e.g., "eslint/no-unused-vars")
    const slashIndex = issue.ruleId.indexOf('/');
    if (slashIndex > 0) {
      const prefix = issue.ruleId.substring(0, slashIndex);
      if (this.plugins.has(prefix)) {
        return prefix;
      }
    }

    // Fall back to first enabled plugin that supports this file type
    const ext = this.getFileExtension(issue.filePath);
    for (const [linterId, registered] of this.plugins) {
      if (registered.enabled && registered.plugin.metadata.supportedExtensions.includes(ext)) {
        return linterId;
      }
    }

    return 'unknown';
  }

  /**
   * Get file extension from a path
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot > 0 ? filePath.substring(lastDot) : '';
  }

  // ==========================================================================
  // Private: Plugin Helpers
  // ==========================================================================

  /**
   * Get the list of plugins to run based on options
   */
  private getPluginsToRun(linterIds?: string[]): RegisteredPlugin[] {
    const result: RegisteredPlugin[] = [];

    for (const [id, registered] of this.plugins) {
      if (!registered.enabled) continue;

      if (linterIds && linterIds.length > 0) {
        if (!linterIds.includes(id)) continue;
      }

      result.push(registered);
    }

    return result;
  }

  /**
   * Set up event forwarding from a plugin
   */
  private forwardPluginEvents(plugin: ILinterPlugin, linterId: string): void {
    // Forward lint:issue events
    plugin.on('lint:issue', (event: LintIssueEvent) => {
      this.emit('linter:issue', {
        executionId: 'unknown', // Will be overwritten by actual execution
        linterId,
        issue: event.issue,
      });
    });
  }

  /**
   * Remove event listeners from a plugin
   */
  private removePluginEventListeners(plugin: ILinterPlugin, linterId: string): void {
    plugin.removeAllListeners('lint:issue');
    plugin.removeAllListeners('lint:started');
    plugin.removeAllListeners('lint:completed');
    plugin.removeAllListeners('lint:progress');
    plugin.removeAllListeners('fix:applied');
  }

  /**
   * Generate a unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${++this.executionCounter}-${randomUUID().substring(0, 8)}`;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default LinterService;
