/**
 * Log Factory - Mock factories for Logging and related domain types
 */

import type {
  TaskLog,
  LogLevelType,
  LogRotationConfig,
  LoggingConfig,
} from '../types.js';

// ============================================================================
// Task Log Factory (Enhanced)
// ============================================================================

export interface TaskLogOverrides {
  timestamp?: Date;
  level?: 'debug' | 'info' | 'warn' | 'error';
  stage?: string;
  agent?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a mock TaskLog with realistic default values
 *
 * @param overrides - Partial log properties to override defaults
 * @returns Complete TaskLog object with valid type-safe properties
 *
 * @example
 * ```typescript
 * // Create log with defaults
 * const log = createTaskLog();
 *
 * // Create error log
 * const errorLog = createTaskLog({
 *   level: 'error',
 *   message: 'Build failed: TypeScript compilation errors',
 *   metadata: { exitCode: 1, errorCount: 5 }
 * });
 * ```
 */
export function createTaskLog(overrides: TaskLogOverrides = {}): TaskLog {
  const defaults: TaskLog = {
    timestamp: new Date(),
    level: 'info',
    stage: 'implementation',
    agent: 'developer',
    message: 'Task execution in progress',
    metadata: {
      step: 1,
      total: 3,
      progress: 0.33,
      duration: 1500,
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Log Rotation Config Factory
// ============================================================================

export interface LogRotationConfigOverrides {
  maxSize?: string;
  maxFiles?: number;
  compress?: boolean;
  datePattern?: string;
}

/**
 * Creates a mock LogRotationConfig for testing log rotation settings
 */
export function createLogRotationConfig(overrides: LogRotationConfigOverrides = {}): LogRotationConfig {
  const defaults: LogRotationConfig = {
    maxSize: '10MB',
    maxFiles: 5,
    compress: true,
    datePattern: 'YYYY-MM-DD',
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Logging Config Factory (Enhanced)
// ============================================================================

export interface LoggingConfigOverrides {
  level?: LogLevelType;
  file?: {
    enabled?: boolean;
    path?: string;
    rotation?: LogRotationConfig;
  };
  console?: {
    enabled?: boolean;
    colorize?: boolean;
    timestamp?: boolean;
    format?: string;
  };
  structured?: {
    enabled?: boolean;
    format?: 'json' | 'logfmt';
    fields?: Record<string, unknown>;
  };
  remote?: {
    enabled?: boolean;
    endpoint?: string;
    apiKey?: string;
    batchSize?: number;
  };
}

/**
 * Creates a mock LoggingConfig with realistic default values
 */
export function createLoggingConfig(overrides: LoggingConfigOverrides = {}): LoggingConfig {
  const defaults: LoggingConfig = {
    level: 'info',
    file: {
      enabled: true,
      path: '.apex/logs/apex.log',
      rotation: createLogRotationConfig(),
    },
    console: {
      enabled: true,
      colorize: true,
      timestamp: true,
      format: '[{timestamp}] {level}: {message}',
    },
    structured: {
      enabled: false,
      format: 'json',
      fields: {
        service: 'apex',
        version: '0.5.0',
        environment: 'development',
      },
    },
    remote: {
      enabled: false,
      endpoint: 'https://logs.example.com/v1/logs',
      batchSize: 100,
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Specialized Log Factories
// ============================================================================

/**
 * Creates debug-level logs for detailed tracing
 */
export function createDebugLog(overrides: TaskLogOverrides = {}): TaskLog {
  return createTaskLog({
    level: 'debug',
    message: 'Entering function processTask with parameters: {taskId: "task-123"}',
    metadata: {
      function: 'processTask',
      parameters: { taskId: 'task-123' },
      stackTrace: 'processTask@/src/orchestrator.ts:45',
    },
    ...overrides,
  });
}

/**
 * Creates info-level logs for general information
 */
export function createInfoLog(overrides: TaskLogOverrides = {}): TaskLog {
  return createTaskLog({
    level: 'info',
    message: 'Task execution started successfully',
    metadata: {
      taskId: 'task-123',
      workflow: 'feature-development',
      estimatedDuration: 1800000,
    },
    ...overrides,
  });
}

/**
 * Creates warning-level logs for potential issues
 */
export function createWarnLog(overrides: TaskLogOverrides = {}): TaskLog {
  return createTaskLog({
    level: 'warn',
    message: 'API rate limit approaching: 90% of hourly quota used',
    metadata: {
      quotaUsed: 1800,
      quotaLimit: 2000,
      resetTime: new Date(Date.now() + 600000), // 10 minutes
      severity: 'medium',
    },
    ...overrides,
  });
}

/**
 * Creates error-level logs for failures and exceptions
 */
export function createErrorLog(overrides: TaskLogOverrides = {}): TaskLog {
  return createTaskLog({
    level: 'error',
    message: 'Task execution failed: Build process encountered errors',
    metadata: {
      error: 'BuildError',
      exitCode: 1,
      errorDetails: [
        'TypeScript compilation failed: 5 errors found',
        'ESLint found 3 violations',
      ],
      failedStage: 'implementation',
      retryCount: 2,
      maxRetries: 3,
    },
    ...overrides,
  });
}

// ============================================================================
// Log Sequence Factories
// ============================================================================

/**
 * Creates a sequence of logs representing a complete task execution
 */
export function createTaskExecutionLogs(): TaskLog[] {
  const taskId = 'task-123';
  const startTime = new Date();

  return [
    createTaskLog({
      timestamp: new Date(startTime.getTime()),
      level: 'info',
      message: 'Task queued for execution',
      metadata: { taskId, status: 'queued' },
    }),
    createTaskLog({
      timestamp: new Date(startTime.getTime() + 1000),
      level: 'info',
      stage: 'planning',
      agent: 'planner',
      message: 'Starting planning phase',
      metadata: { taskId, phase: 'planning' },
    }),
    createTaskLog({
      timestamp: new Date(startTime.getTime() + 30000),
      level: 'info',
      stage: 'planning',
      agent: 'planner',
      message: 'Planning completed successfully',
      metadata: { taskId, phase: 'planning', duration: 30000 },
    }),
    createTaskLog({
      timestamp: new Date(startTime.getTime() + 31000),
      level: 'info',
      stage: 'implementation',
      agent: 'developer',
      message: 'Starting implementation phase',
      metadata: { taskId, phase: 'implementation' },
    }),
    createTaskLog({
      timestamp: new Date(startTime.getTime() + 45000),
      level: 'warn',
      stage: 'implementation',
      agent: 'developer',
      message: 'Deprecated API detected, using legacy compatibility layer',
      metadata: { taskId, deprecatedApi: 'oldFunction', replacement: 'newFunction' },
    }),
    createTaskLog({
      timestamp: new Date(startTime.getTime() + 120000),
      level: 'info',
      stage: 'implementation',
      agent: 'developer',
      message: 'Implementation completed successfully',
      metadata: { taskId, phase: 'implementation', duration: 90000, linesChanged: 150 },
    }),
    createTaskLog({
      timestamp: new Date(startTime.getTime() + 121000),
      level: 'info',
      message: 'Task execution completed',
      metadata: { taskId, status: 'completed', totalDuration: 121000 },
    }),
  ];
}

/**
 * Creates a sequence of logs showing a failed task execution
 */
export function createFailedTaskLogs(): TaskLog[] {
  const taskId = 'task-456';
  const startTime = new Date();

  return [
    createTaskLog({
      timestamp: new Date(startTime.getTime()),
      level: 'info',
      message: 'Task execution started',
      metadata: { taskId, status: 'in-progress' },
    }),
    createTaskLog({
      timestamp: new Date(startTime.getTime() + 30000),
      level: 'error',
      stage: 'implementation',
      agent: 'developer',
      message: 'Build failed: TypeScript compilation errors',
      metadata: {
        taskId,
        error: 'TypeScriptError',
        errorCount: 5,
        errors: [
          'Property "name" does not exist on type "User"',
          'Type "string" is not assignable to type "number"',
        ],
      },
    }),
    createTaskLog({
      timestamp: new Date(startTime.getTime() + 31000),
      level: 'info',
      message: 'Attempting retry (1/3)',
      metadata: { taskId, retryCount: 1, maxRetries: 3 },
    }),
    createTaskLog({
      timestamp: new Date(startTime.getTime() + 60000),
      level: 'error',
      stage: 'implementation',
      agent: 'developer',
      message: 'Build failed again: Same TypeScript compilation errors',
      metadata: {
        taskId,
        error: 'TypeScriptError',
        retryCount: 1,
        persistentErrors: true,
      },
    }),
    createTaskLog({
      timestamp: new Date(startTime.getTime() + 61000),
      level: 'error',
      message: 'Task execution failed after 2 attempts',
      metadata: {
        taskId,
        status: 'failed',
        totalDuration: 61000,
        finalError: 'Build process failed with TypeScript errors',
      },
    }),
  ];
}

/**
 * Creates logs with different levels for testing log filtering
 */
export function createMixedLevelLogs(count: number): TaskLog[] {
  const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];
  const stages = ['planning', 'implementation', 'testing', 'review'];
  const agents = ['planner', 'developer', 'tester', 'reviewer'];

  return Array.from({ length: count }, (_, index) => {
    const level = levels[index % levels.length];
    const stage = stages[index % stages.length];
    const agent = agents[index % agents.length];

    return createTaskLog({
      timestamp: new Date(Date.now() + index * 1000), // 1 second apart
      level,
      stage,
      agent,
      message: `${level.toUpperCase()}: ${stage} progress update from ${agent}`,
      metadata: {
        sequenceId: index,
        progress: (index + 1) / count,
      },
    });
  });
}

// ============================================================================
// Log Configuration Collections
// ============================================================================

/**
 * Creates logging configurations for different environments
 */
export function createLoggingConfigs(): {
  development: LoggingConfig;
  testing: LoggingConfig;
  production: LoggingConfig;
  debug: LoggingConfig;
} {
  return {
    development: createLoggingConfig({
      level: 'debug',
      console: {
        enabled: true,
        colorize: true,
        timestamp: true,
      },
      file: {
        enabled: true,
        path: '.apex/logs/dev.log',
      },
    }),

    testing: createLoggingConfig({
      level: 'warn',
      console: {
        enabled: false,
        colorize: false,
      },
      file: {
        enabled: false,
      },
    }),

    production: createLoggingConfig({
      level: 'info',
      console: {
        enabled: true,
        colorize: false,
        timestamp: true,
        format: 'json',
      },
      file: {
        enabled: true,
        path: '/var/log/apex/production.log',
        rotation: createLogRotationConfig({
          maxSize: '100MB',
          maxFiles: 10,
          compress: true,
        }),
      },
      structured: {
        enabled: true,
        format: 'json',
        fields: {
          service: 'apex',
          environment: 'production',
        },
      },
      remote: {
        enabled: true,
        endpoint: 'https://logs.company.com/v1/ingest',
        batchSize: 500,
      },
    }),

    debug: createLoggingConfig({
      level: 'debug',
      console: {
        enabled: true,
        colorize: true,
        timestamp: true,
      },
      file: {
        enabled: true,
        path: '.apex/logs/debug.log',
      },
      structured: {
        enabled: true,
        format: 'json',
        fields: {
          debug: true,
          verbose: true,
        },
      },
    }),
  };
}

/**
 * Creates log validation test scenarios
 */
export function createLogTestScenarios(): {
  validLog: TaskLog;
  emptyMessage: TaskLog;
  futureTimestamp: TaskLog;
  invalidLevel: any;
  missingRequired: Partial<TaskLog>;
} {
  return {
    validLog: createTaskLog(),
    emptyMessage: createTaskLog({ message: '' }),
    futureTimestamp: createTaskLog({
      timestamp: new Date(Date.now() + 86400000), // 1 day in future
    }),
    invalidLevel: createTaskLog({ level: 'critical' as any }), // Invalid level
    missingRequired: {
      // Missing required fields for validation testing
      timestamp: new Date(),
      level: 'info',
    },
  };
}