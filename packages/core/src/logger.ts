/**
 * @fileoverview Unified logging system for APEX
 *
 * Provides structured logging with Pino backend, supporting:
 * - JSON format for production, pretty-print for development
 * - Child loggers with context (taskId, package, component)
 * - DEBUG environment variable for package filtering
 * - Log rotation for file-based logging
 */

import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';

// ============================================================================
// Types
// ============================================================================

/**
 * Supported log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Context for child loggers - propagated to all log entries
 */
export interface LoggerContext {
  /** Package name: core, cli, orchestrator, api */
  package?: string;
  /** Component within the package: daemon, runner, store, etc. */
  component?: string;
  /** Task ID for task-scoped logging */
  taskId?: string;
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Session ID for user session tracking */
  sessionId?: string;
  /** Allow additional arbitrary metadata */
  [key: string]: unknown;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level (default: 'info', or LOG_LEVEL env var) */
  level: LogLevel;
  /** Enable JSON format (default: true in production) */
  jsonFormat: boolean;
  /** Enable pretty printing (default: true in development) */
  prettyPrint: boolean;
  /** Default context applied to all log entries */
  defaultContext?: LoggerContext;
  /** Fields to redact from logs */
  redactFields?: string[];
}

// ============================================================================
// DEBUG Environment Variable Support
// ============================================================================

interface DebugPatterns {
  enabled: Set<string>;
  disabled: Set<string>;
}

/**
 * Parse DEBUG environment variable for package filtering
 *
 * Supports patterns like:
 * - DEBUG=* (all packages)
 * - DEBUG=apex:* (all apex packages)
 * - DEBUG=apex:orchestrator (specific package)
 * - DEBUG=apex:cli,apex:api (multiple packages)
 * - DEBUG=apex:*,-apex:core (exclude specific)
 */
function parseDebugPatterns(debug: string | undefined): DebugPatterns {
  const enabled = new Set<string>();
  const disabled = new Set<string>();

  if (!debug) return { enabled, disabled };

  const patterns = debug.split(',').map(p => p.trim()).filter(Boolean);

  for (const pattern of patterns) {
    if (pattern.startsWith('-')) {
      disabled.add(pattern.slice(1));
    } else {
      enabled.add(pattern);
    }
  }

  return { enabled, disabled };
}

/**
 * Check if a namespace matches the DEBUG patterns
 */
function matchPattern(namespace: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('*')) {
    return namespace.startsWith(pattern.slice(0, -1));
  }
  return namespace === pattern;
}

/**
 * Check if debug logging is enabled for a namespace
 */
function isDebugEnabledForNamespace(
  namespace: string,
  patterns: DebugPatterns
): boolean {
  // Check if explicitly disabled
  for (const pattern of patterns.disabled) {
    if (matchPattern(namespace, pattern)) return false;
  }

  // Check if explicitly enabled
  for (const pattern of patterns.enabled) {
    if (matchPattern(namespace, pattern)) return true;
  }

  return false;
}

// ============================================================================
// Logger Class
// ============================================================================

/**
 * Unified APEX Logger
 *
 * Provides structured logging with Pino backend, supporting:
 * - JSON/pretty format switching based on NODE_ENV
 * - Child loggers with context propagation
 * - DEBUG env var filtering for package-level control
 * - Sensitive field redaction
 *
 * @example
 * ```typescript
 * // Get singleton instance
 * const logger = Logger.getInstance();
 * logger.info('Application started');
 *
 * // Create child logger with context
 * const taskLogger = logger.child({ taskId: 'task_123', package: 'orchestrator' });
 * taskLogger.debug('Processing task');
 *
 * // Create package-specific logger
 * const cliLogger = createPackageLogger('cli');
 * cliLogger.warn('Configuration missing');
 * ```
 */
export class Logger {
  private pinoInstance: PinoLogger;
  private context: LoggerContext;
  private debugPatterns: DebugPatterns;
  private static instance: Logger | null = null;

  constructor(config: Partial<LoggerConfig> = {}, context: LoggerContext = {}) {
    this.context = context;
    this.debugPatterns = parseDebugPatterns(process.env.DEBUG);
    this.pinoInstance = this.createPinoInstance(config);
  }

  /**
   * Get or create singleton logger instance
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    Logger.instance = null;
  }

  /**
   * Create a child logger with additional context
   *
   * Child loggers inherit parent context and can add/override fields.
   * All log entries from child will include merged context.
   *
   * @param context - Additional context to merge with parent
   * @returns New Logger instance with merged context
   */
  child(context: LoggerContext): Logger {
    const mergedContext = { ...this.context, ...context };
    const childLogger = new Logger({}, mergedContext);
    childLogger.pinoInstance = this.pinoInstance.child(context);
    childLogger.debugPatterns = this.debugPatterns;
    return childLogger;
  }

  /**
   * Log a debug message
   *
   * Debug messages are only logged if:
   * 1. Log level is 'debug', OR
   * 2. DEBUG env var matches the package namespace
   *
   * @param msg - Log message
   * @param data - Optional additional data to include
   */
  debug(msg: string, data?: Record<string, unknown>): void {
    if (this.shouldLogDebug()) {
      this.pinoInstance.debug({ ...data }, msg);
    }
  }

  /**
   * Log an info message
   */
  info(msg: string, data?: Record<string, unknown>): void {
    this.pinoInstance.info({ ...data }, msg);
  }

  /**
   * Log a warning message
   */
  warn(msg: string, data?: Record<string, unknown>): void {
    this.pinoInstance.warn({ ...data }, msg);
  }

  /**
   * Log an error message
   *
   * @param msg - Error message
   * @param error - Optional Error object (will serialize stack trace)
   * @param data - Optional additional data
   */
  error(msg: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    if (error instanceof Error) {
      this.pinoInstance.error({ err: error, ...data }, msg);
    } else if (error !== undefined) {
      this.pinoInstance.error({ errorData: error, ...data }, msg);
    } else {
      this.pinoInstance.error({ ...data }, msg);
    }
  }

  /**
   * Log a fatal error message
   *
   * Use for unrecoverable errors that will cause the process to exit.
   */
  fatal(msg: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    if (error instanceof Error) {
      this.pinoInstance.fatal({ err: error, ...data }, msg);
    } else if (error !== undefined) {
      this.pinoInstance.fatal({ errorData: error, ...data }, msg);
    } else {
      this.pinoInstance.fatal({ ...data }, msg);
    }
  }

  /**
   * Get the underlying Pino instance for advanced use cases
   */
  getPinoInstance(): PinoLogger {
    return this.pinoInstance;
  }

  /**
   * Get the current context
   */
  getContext(): LoggerContext {
    return { ...this.context };
  }

  /**
   * Check if debug should be logged based on DEBUG env var
   */
  private shouldLogDebug(): boolean {
    // If pino level is already debug, always log
    if (this.pinoInstance.isLevelEnabled('debug')) {
      return true;
    }

    // Check DEBUG env var patterns
    const namespace = this.context.package
      ? `apex:${this.context.package}`
      : 'apex';

    return isDebugEnabledForNamespace(namespace, this.debugPatterns);
  }

  /**
   * Create Pino instance with appropriate configuration
   */
  private createPinoInstance(config: Partial<LoggerConfig>): PinoLogger {
    const isDev = process.env.NODE_ENV !== 'production';
    const level = config.level || (process.env.LOG_LEVEL as LogLevel) || 'info';

    const options: LoggerOptions = {
      level,
      base: {
        pid: process.pid,
        ...this.context,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Redact sensitive fields
      redact: config.redactFields || [
        'password',
        'token',
        'secret',
        'apiKey',
        'authorization',
        'ANTHROPIC_API_KEY',
      ],
    };

    // Pretty print for development
    if (isDev && (config.prettyPrint ?? true)) {
      return pino({
        ...options,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      });
    }

    // JSON format for production
    return pino(options);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a package-specific logger
 *
 * Convenience function to create a child logger pre-configured with
 * the package name. Use this at module level in each package.
 *
 * @param packageName - Name of the package (core, cli, orchestrator, api)
 * @returns Logger instance with package context
 *
 * @example
 * ```typescript
 * // At top of file in @apexcli/orchestrator
 * const logger = createPackageLogger('orchestrator');
 *
 * // Use throughout the module
 * logger.info('Task started', { taskId: '123' });
 * ```
 */
export function createPackageLogger(packageName: string): Logger {
  return Logger.getInstance().child({ package: packageName });
}

/**
 * Create a component-specific logger
 *
 * @param packageName - Name of the package
 * @param componentName - Name of the component within the package
 * @returns Logger instance with package and component context
 *
 * @example
 * ```typescript
 * const logger = createComponentLogger('orchestrator', 'daemon');
 * logger.debug('Daemon polling', { interval: 5000 });
 * ```
 */
export function createComponentLogger(packageName: string, componentName: string): Logger {
  return Logger.getInstance().child({
    package: packageName,
    component: componentName
  });
}

/**
 * Create a task-scoped logger
 *
 * @param taskId - Task identifier
 * @param baseLogger - Optional base logger to inherit from
 * @returns Logger instance with taskId in context
 */
export function createTaskLogger(taskId: string, baseLogger?: Logger): Logger {
  const base = baseLogger || Logger.getInstance();
  return base.child({ taskId });
}
