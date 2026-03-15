/**
 * Logging utility for application-wide logging
 * Provides structured logging with different levels and formatting
 */

/**
 * Available log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log level priority mapping
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Timestamp of log entry */
  timestamp: Date;
  /** Log level */
  level: LogLevel;
  /** Logger name/category */
  category: string;
  /** Log message */
  message: string;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Error object if applicable */
  error?: Error;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include timestamps */
  includeTimestamp: boolean;
  /** Whether to include category in output */
  includeCategory: boolean;
  /** Custom formatting function */
  formatter?: (entry: LogEntry) => string;
  /** Custom output function */
  output?: (formatted: string) => void;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'info',
  includeTimestamp: true,
  includeCategory: true,
  formatter: defaultFormatter,
  output: defaultOutput,
};

/**
 * Global logger configuration
 */
let globalConfig: LoggerConfig = { ...DEFAULT_CONFIG };

/**
 * Logger class for structured logging
 */
export class Logger {
  /** Logger category/name */
  private readonly category: string;

  /** Logger-specific configuration */
  private config: Partial<LoggerConfig>;

  /**
   * Create new logger instance
   * @param category - Logger category/name
   * @param config - Logger-specific configuration
   */
  constructor(category: string, config: Partial<LoggerConfig> = {}) {
    this.category = category;
    this.config = config;
  }

  /**
   * Log debug message
   * @param message - Debug message
   * @param context - Additional context data
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   * @param message - Info message
   * @param context - Additional context data
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   * @param message - Warning message
   * @param context - Additional context data
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   * @param message - Error message
   * @param error - Error object
   * @param context - Additional context data
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  /**
   * Log fatal error message
   * @param message - Fatal error message
   * @param error - Error object
   * @param context - Additional context data
   */
  fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('fatal', message, context, error);
  }

  /**
   * Log message with specified level
   * @param level - Log level
   * @param message - Log message
   * @param context - Additional context data
   * @param error - Error object
   * @private
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    const effectiveConfig = this.getEffectiveConfig();

    // Check if log level meets minimum threshold
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[effectiveConfig.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category: this.category,
      message,
      context,
      error,
    };

    const formatted = effectiveConfig.formatter!(entry);
    effectiveConfig.output!(formatted);
  }

  /**
   * Get effective configuration by merging global and instance configs
   * @returns Effective configuration
   * @private
   */
  private getEffectiveConfig(): LoggerConfig {
    return {
      ...globalConfig,
      ...this.config,
    } as LoggerConfig;
  }

  /**
   * Create child logger with additional category context
   * @param childCategory - Child category to append
   * @param config - Additional configuration
   * @returns New child logger
   */
  child(childCategory: string, config: Partial<LoggerConfig> = {}): Logger {
    const fullCategory = `${this.category}:${childCategory}`;
    const mergedConfig = { ...this.config, ...config };
    return new Logger(fullCategory, mergedConfig);
  }

  /**
   * Start performance timer
   * @param label - Timer label
   * @returns Timer function to end timing
   */
  time(label: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.debug(`Timer ${label}`, { durationMs: duration });
    };
  }

  /**
   * Log with performance timing
   * @param label - Operation label
   * @param operation - Operation to time
   * @returns Operation result
   */
  async timeAsync<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const endTimer = this.time(label);

    try {
      const result = await operation();
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      this.error(`Operation ${label} failed`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

/**
 * Set global logger configuration
 * @param config - Global configuration to set
 */
export function setGlobalLoggerConfig(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get current global logger configuration
 * @returns Current global configuration
 */
export function getGlobalLoggerConfig(): LoggerConfig {
  return { ...globalConfig };
}

/**
 * Create logger instance
 * @param category - Logger category
 * @param config - Logger configuration
 * @returns New logger instance
 */
export function createLogger(category: string, config: Partial<LoggerConfig> = {}): Logger {
  return new Logger(category, config);
}

/**
 * Default log entry formatter
 * @param entry - Log entry to format
 * @returns Formatted string
 */
function defaultFormatter(entry: LogEntry): string {
  const parts: string[] = [];

  // Add timestamp
  if (globalConfig.includeTimestamp) {
    parts.push(entry.timestamp.toISOString());
  }

  // Add level
  parts.push(`[${entry.level.toUpperCase()}]`);

  // Add category
  if (globalConfig.includeCategory) {
    parts.push(`(${entry.category})`);
  }

  // Add message
  parts.push(entry.message);

  // Add context
  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context));
  }

  // Add error details
  if (entry.error) {
    parts.push(`\\nError: ${entry.error.message}`);
    if (entry.error.stack) {
      parts.push(`\\nStack: ${entry.error.stack}`);
    }
  }

  return parts.join(' ');
}

/**
 * Default output function
 * @param formatted - Formatted log string
 */
function defaultOutput(formatted: string): void {
  console.log(formatted);
}

/**
 * Singleton logger for quick access
 */
export const logger = new Logger('app');

/**
 * Logger utility functions
 */
export const LoggerUtils = {
  /**
   * Check if log level is enabled
   * @param level - Level to check
   * @param minLevel - Minimum level
   * @returns True if level is enabled
   */
  isLevelEnabled(level: LogLevel, minLevel: LogLevel = globalConfig.minLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
  },

  /**
   * Get log level priority
   * @param level - Log level
   * @returns Priority number
   */
  getLevelPriority(level: LogLevel): number {
    return LOG_LEVEL_PRIORITY[level];
  },

  /**
   * Sanitize context data for logging
   * @param context - Raw context data
   * @returns Sanitized context
   */
  sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      // Remove sensitive fields
      if (key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = LoggerUtils.sanitizeContext(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
};

// Constants for external use
export const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
export const DEFAULT_LOG_LEVEL: LogLevel = 'info';