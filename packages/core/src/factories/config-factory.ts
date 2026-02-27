/**
 * Config Factory - Mock factories for Configuration and related domain types
 */

import type {
  ApexConfig,
  ProjectConfig,
  AutonomyConfig,
  AutonomyLevel,
  LimitsConfig,
  ModelsConfig,
  UIConfig,
  GitConfig,
  WorktreeConfig,
  ToolConfig,
  LoggingConfig,
  LogLevelType,
  ServiceConfig,
  DaemonConfig,
  AgentModel,
} from '../types.js';

// ============================================================================
// Project Config Factory
// ============================================================================

export interface ProjectConfigOverrides {
  name?: string;
  language?: string;
  framework?: string;
  testCommand?: string;
  lintCommand?: string;
  buildCommand?: string;
  typecheckCommand?: string;
}

/**
 * Creates a mock ProjectConfig with realistic default values
 */
export function createProjectConfig(overrides: ProjectConfigOverrides = {}): ProjectConfig {
  const defaults: ProjectConfig = {
    name: 'apex-test-project',
    framework: 'react',
    language: 'typescript',
    testCommand: 'npm test',
    lintCommand: 'npm run lint',
    buildCommand: 'npm run build',
    typecheckCommand: 'npm run typecheck',
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Autonomy Config Factory
// ============================================================================

export interface AutonomyConfigOverrides {
  level?: AutonomyLevel;
  stageOverrides?: Record<string, AutonomyLevel>;
  agentOverrides?: Record<string, AutonomyLevel>;
  approvalTimeout?: number;
}

/**
 * Creates a mock AutonomyConfig for testing autonomy levels
 */
export function createAutonomyConfig(overrides: AutonomyConfigOverrides = {}): AutonomyConfig {
  const defaults: AutonomyConfig = {
    level: 'review-before-commit',
    rejectionBehavior: 'abort',
    agentOverrides: {
      'developer': 'full-auto',
      'tester': 'review-before-commit',
      'reviewer': 'review-all',
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Limits Config Factory
// ============================================================================

export interface LimitsConfigOverrides {
  maxConcurrentTasks?: number;
  maxTokensPerTask?: number;
  maxCostPerTask?: number;
  maxExecutionTime?: number;
  maxFileChanges?: number;
  dailyBudget?: number;
  maxTurns?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  retryBackoffFactor?: number;
}

/**
 * Creates a mock LimitsConfig for testing resource limits
 */
export function createLimitsConfig(overrides: LimitsConfigOverrides = {}): LimitsConfig {
  const defaults: LimitsConfig = {
    maxConcurrentTasks: 5,
    maxTokensPerTask: 500000,
    maxCostPerTask: 10.0,
    dailyBudget: 100.0,
    maxRetries: 3,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Models Config Factory
// ============================================================================

export interface ModelsConfigOverrides {
  planning?: AgentModel;
  implementation?: AgentModel;
  review?: AgentModel;
}

/**
 * Creates a mock ModelsConfig for testing model assignments
 */
export function createModelsConfig(overrides: ModelsConfigOverrides = {}): ModelsConfig {
  const defaults: ModelsConfig = {
    planning: 'opus',
    implementation: 'sonnet',
    review: 'haiku',
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// UI Config Factory
// ============================================================================

export interface UIConfigOverrides {
  previewMode?: boolean;
  previewConfidence?: number;
  autoExecuteHighConfidence?: boolean;
  previewTimeout?: number;
  diffPreview?: boolean;
}

/**
 * Creates a mock UIConfig for testing UI preferences
 */
export function createUIConfig(overrides: UIConfigOverrides = {}): UIConfig {
  const defaults: UIConfig = {
    previewMode: true,
    previewConfidence: 0.7,
    autoExecuteHighConfidence: false,
    previewTimeout: 5000,
    diffPreview: true,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Git Config Factory
// ============================================================================

export interface GitConfigOverrides {
  branchPrefix?: string;
  commitFormat?: 'conventional' | 'simple';
  autoPush?: boolean;
  defaultBranch?: string;
  commitAfterSubtask?: boolean;
  pushAfterTask?: boolean;
  createPR?: 'always' | 'never' | 'ask';
  prDraft?: boolean;
  autoWorktree?: boolean;
  worktree?: WorktreeConfig;
}

/**
 * Creates a mock GitConfig for testing Git integration
 */
export function createGitConfig(overrides: GitConfigOverrides = {}): GitConfig {
  const defaults: GitConfig = {
    branchPrefix: 'apex/',
    commitFormat: 'conventional',
    autoPush: true,
    defaultBranch: 'main',
    commitAfterSubtask: true,
    pushAfterTask: true,
    createPR: 'always',
    prDraft: false,
    autoWorktree: false,
    worktree: createWorktreeConfig(),
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Worktree Config Factory
// ============================================================================

export interface WorktreeConfigOverrides {
  baseDir?: string;
  cleanupOnComplete?: boolean;
  maxWorktrees?: number;
  pruneStaleAfterDays?: number;
  preserveOnFailure?: boolean;
  cleanupDelayMs?: number;
}

/**
 * Creates a mock WorktreeConfig for testing worktree isolation
 */
export function createWorktreeConfig(overrides: WorktreeConfigOverrides = {}): WorktreeConfig {
  const defaults: WorktreeConfig = {
    cleanupOnComplete: true,
    maxWorktrees: 5,
    pruneStaleAfterDays: 7,
    preserveOnFailure: false,
    cleanupDelayMs: 0,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Tool Config Factory
// ============================================================================

export interface ToolConfigOverrides {
  [key: string]: {
    enabled?: boolean;
    timeout?: number;
    requireConfirmation?: boolean;
    rateLimitPerMinute?: number;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Creates a mock ToolConfig for testing tool permissions
 */
export function createToolConfig(overrides: ToolConfigOverrides = {}): ToolConfig {
  const defaults: ToolConfig = {
    Read: {
      enabled: true,
    },
    Write: {
      enabled: true,
      requireConfirmation: true,
    },
    Edit: {
      enabled: true,
      requireConfirmation: true,
    },
    Bash: {
      enabled: true,
      timeout: 30000,
    },
    WebSearch: {
      enabled: true,
    },
    WebFetch: {
      enabled: false,
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Logging Config Factory
// ============================================================================

export interface LoggingConfigOverrides {
  level?: LogLevelType;
  format?: 'json' | 'pretty' | 'auto';
  packageLevels?: Record<string, LogLevelType>;
  file?: {
    enabled?: boolean;
    path?: string;
  };
  timestamps?: boolean;
  stackTraces?: boolean;
}

/**
 * Creates a mock LoggingConfig for testing logging settings
 */
export function createLoggingConfig(overrides: LoggingConfigOverrides = {}): LoggingConfig {
  const defaults: LoggingConfig = {
    level: 'info',
    format: 'auto',
    file: {
      enabled: true,
      path: '.apex/apex.log',
    },
    timestamps: true,
    stackTraces: true,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Service Config Factory
// ============================================================================

export interface ServiceConfigOverrides {
  enableOnBoot?: boolean;
}

/**
 * Creates a mock ServiceConfig for testing API service settings
 */
export function createServiceConfig(overrides: ServiceConfigOverrides = {}): ServiceConfig {
  const defaults: ServiceConfig = {
    enableOnBoot: false,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Daemon Config Factory
// ============================================================================

export interface DaemonConfigOverrides {
  pollInterval?: number;
  autoStart?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  installAsService?: boolean;
  serviceName?: string;
  healthCheck?: {
    enabled?: boolean;
    interval?: number;
    timeout?: number;
    retries?: number;
  };
}

/**
 * Creates a mock DaemonConfig for testing daemon service
 */
export function createDaemonConfig(overrides: DaemonConfigOverrides = {}): DaemonConfig {
  const defaults: DaemonConfig = {
    pollInterval: 5000,
    autoStart: false,
    logLevel: 'info',
    installAsService: false,
    serviceName: 'apex-daemon',
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      retries: 3,
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// APEX Config Factory (Main)
// ============================================================================

export interface ApexConfigOverrides {
  version?: string;
  project?: ProjectConfig;
  autonomy?: AutonomyConfig;
  limits?: LimitsConfig;
  models?: ModelsConfig;
  ui?: UIConfig;
  git?: GitConfig;
  tools?: ToolConfig;
  logging?: LoggingConfig;
  daemon?: DaemonConfig;
}

/**
 * Creates a mock ApexConfig with realistic default values
 *
 * @param overrides - Partial config properties to override defaults
 * @returns Complete ApexConfig object with valid type-safe properties
 *
 * @example
 * ```typescript
 * // Create config with defaults
 * const config = createApexConfig();
 *
 * // Create custom config
 * const customConfig = createApexConfig({
 *   autonomy: createAutonomyConfig({ defaultLevel: 'full' }),
 *   limits: createLimitsConfig({ maxConcurrentTasks: 10 }),
 *   ui: createUIConfig({ theme: 'dark' })
 * });
 * ```
 */
export function createApexConfig(overrides: ApexConfigOverrides = {}): ApexConfig {
  const defaults: ApexConfig = {
    version: '1.0',
    project: createProjectConfig(),
    autonomy: createAutonomyConfig(),
    limits: createLimitsConfig(),
    models: createModelsConfig(),
    ui: createUIConfig(),
    git: createGitConfig(),
    tools: createToolConfig(),
    logging: createLoggingConfig(),
    daemon: createDaemonConfig(),
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Specialized Config Factories
// ============================================================================

/**
 * Creates a development-optimized config with permissive settings
 */
export function createDevelopmentConfig(overrides: ApexConfigOverrides = {}): ApexConfig {
  return createApexConfig({
    autonomy: createAutonomyConfig({
      level: 'full-auto',
    }),
    limits: createLimitsConfig({
      maxConcurrentTasks: 10,
      dailyBudget: 50.0,
    }),
    tools: createToolConfig({
      Bash: {
        enabled: true,
        timeout: 60000,
      },
      Write: {
        enabled: true,
      },
    }),
    logging: createLoggingConfig({
      level: 'debug',
    }),
    ...overrides,
  });
}

/**
 * Creates a production-optimized config with security restrictions
 */
export function createProductionConfig(overrides: ApexConfigOverrides = {}): ApexConfig {
  return createApexConfig({
    autonomy: createAutonomyConfig({
      level: 'review-all',
    }),
    limits: createLimitsConfig({
      maxConcurrentTasks: 2,
      maxCostPerTask: 5.0,
      maxTokensPerTask: 50000,
    }),
    tools: createToolConfig({
      Bash: {
        enabled: true,
        timeout: 10000,
      },
      Write: {
        enabled: true,
        requireConfirmation: true,
      },
    }),
    logging: createLoggingConfig({
      level: 'warn',
      file: {
        enabled: true,
        path: '/var/log/apex/apex.log',
      },
    }),
    ...overrides,
  });
}

/**
 * Creates a testing config optimized for CI/CD environments
 */
export function createTestingConfig(overrides: ApexConfigOverrides = {}): ApexConfig {
  return createApexConfig({
    autonomy: createAutonomyConfig({
      level: 'full-auto',
      approvalTimeout: 10,
    }),
    limits: createLimitsConfig({
      maxConcurrentTasks: 3,
      maxRetries: 1,
      maxExecutionTime: 600000, // 10 minutes in ms
    }),
    git: createGitConfig({
      autoPush: false,
      commitAfterSubtask: false,
    }),
    logging: createLoggingConfig({
      level: 'error',
      file: {
        enabled: false,
      },
    }),
    ...overrides,
  });
}

// ============================================================================
// Config Collections
// ============================================================================

/**
 * Creates configs for different environments
 */
export function createEnvironmentConfigs(): {
  development: ApexConfig;
  staging: ApexConfig;
  production: ApexConfig;
  testing: ApexConfig;
} {
  return {
    development: createDevelopmentConfig(),
    staging: createApexConfig({
      autonomy: createAutonomyConfig({ level: 'review-before-commit' }),
      limits: createLimitsConfig({ dailyBudget: 20.0 }),
    }),
    production: createProductionConfig(),
    testing: createTestingConfig(),
  };
}

/**
 * Creates configs with different autonomy levels for testing
 */
export function createAutonomyLevelConfigs(): {
  fullAuto: ApexConfig;
  reviewBeforeCommit: ApexConfig;
  reviewAll: ApexConfig;
} {
  const base = createApexConfig();

  return {
    fullAuto: {
      ...base,
      autonomy: createAutonomyConfig({ level: 'full-auto' }),
    },
    reviewBeforeCommit: {
      ...base,
      autonomy: createAutonomyConfig({ level: 'review-before-commit' }),
    },
    reviewAll: {
      ...base,
      autonomy: createAutonomyConfig({ level: 'review-all' }),
    },
  };
}

/**
 * Creates config validation test scenarios
 */
export function createConfigValidationScenarios(): {
  valid: ApexConfig;
  invalidLimits: ApexConfig;
  missingRequired: Partial<ApexConfig>;
  conflictingSettings: ApexConfig;
} {
  const baseConfig = createApexConfig();

  return {
    valid: baseConfig,
    invalidLimits: {
      ...baseConfig,
      limits: createLimitsConfig({
        maxConcurrentTasks: -1, // Invalid negative value
        maxCostPerTask: -10.0,
      }),
    },
    missingRequired: {
      // Missing required fields for testing validation
      version: '1.0',
    },
    conflictingSettings: {
      ...baseConfig,
      autonomy: createAutonomyConfig({
        level: 'review-all',
      }),
    },
  };
}