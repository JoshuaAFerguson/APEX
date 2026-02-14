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
  WorktreeStatus,
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
  description?: string;
  version?: string;
  repository?: string;
  framework?: string;
  language?: string;
  packageManager?: string;
}

/**
 * Creates a mock ProjectConfig with realistic default values
 */
export function createProjectConfig(overrides: ProjectConfigOverrides = {}): ProjectConfig {
  const defaults: ProjectConfig = {
    name: 'apex-test-project',
    description: 'Test project for APEX development workflows',
    version: '1.0.0',
    repository: 'https://github.com/example/apex-test-project.git',
    framework: 'react',
    language: 'typescript',
    packageManager: 'npm',
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Autonomy Config Factory
// ============================================================================

export interface AutonomyConfigOverrides {
  defaultLevel?: AutonomyLevel;
  requireApproval?: boolean;
  allowUpgrade?: boolean;
  maxCostPerTask?: number;
  maxTokensPerTask?: number;
  timeoutMinutes?: number;
  agentOverrides?: Record<string, AutonomyLevel>;
  workflowOverrides?: Record<string, AutonomyLevel>;
}

/**
 * Creates a mock AutonomyConfig for testing autonomy levels
 */
export function createAutonomyConfig(overrides: AutonomyConfigOverrides = {}): AutonomyConfig {
  const defaults: AutonomyConfig = {
    defaultLevel: 'supervised',
    requireApproval: true,
    allowUpgrade: false,
    maxCostPerTask: 1.0,
    maxTokensPerTask: 50000,
    timeoutMinutes: 60,
    agentOverrides: {
      'developer': 'full',
      'tester': 'supervised',
      'reviewer': 'ask-first',
    },
    workflowOverrides: {
      'feature-development': 'supervised',
      'bug-fix': 'full',
      'research': 'full',
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Limits Config Factory
// ============================================================================

export interface LimitsConfigOverrides {
  maxConcurrentTasks?: number;
  maxTasksPerHour?: number;
  maxCostPerHour?: number;
  maxTokensPerHour?: number;
  maxRetries?: number;
  timeoutSeconds?: number;
}

/**
 * Creates a mock LimitsConfig for testing resource limits
 */
export function createLimitsConfig(overrides: LimitsConfigOverrides = {}): LimitsConfig {
  const defaults: LimitsConfig = {
    maxConcurrentTasks: 5,
    maxTasksPerHour: 20,
    maxCostPerHour: 10.0,
    maxTokensPerHour: 200000,
    maxRetries: 3,
    timeoutSeconds: 3600,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Models Config Factory
// ============================================================================

export interface ModelsConfigOverrides {
  defaultModel?: AgentModel;
  planningModel?: AgentModel;
  codingModel?: AgentModel;
  reviewModel?: AgentModel;
}

/**
 * Creates a mock ModelsConfig for testing model assignments
 */
export function createModelsConfig(overrides: ModelsConfigOverrides = {}): ModelsConfig {
  const defaults: ModelsConfig = {
    defaultModel: 'sonnet',
    planningModel: 'opus',
    codingModel: 'sonnet',
    reviewModel: 'opus',
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// UI Config Factory
// ============================================================================

export interface UIConfigOverrides {
  theme?: 'light' | 'dark' | 'auto';
  showProgress?: boolean;
  showThoughts?: boolean;
  verboseLogging?: boolean;
  autoScroll?: boolean;
}

/**
 * Creates a mock UIConfig for testing UI preferences
 */
export function createUIConfig(overrides: UIConfigOverrides = {}): UIConfig {
  const defaults: UIConfig = {
    theme: 'auto',
    showProgress: true,
    showThoughts: false,
    verboseLogging: false,
    autoScroll: true,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Git Config Factory
// ============================================================================

export interface GitConfigOverrides {
  enabled?: boolean;
  autoCommit?: boolean;
  branchPrefix?: string;
  commitMessage?: string;
  pushOnComplete?: boolean;
  createPR?: boolean;
  worktree?: WorktreeConfig;
}

/**
 * Creates a mock GitConfig for testing Git integration
 */
export function createGitConfig(overrides: GitConfigOverrides = {}): GitConfig {
  const defaults: GitConfig = {
    enabled: true,
    autoCommit: true,
    branchPrefix: 'apex',
    commitMessage: 'feat: implement {description}\\n\\n🤖 Generated with APEX',
    pushOnComplete: false,
    createPR: false,
    worktree: createWorktreeConfig(),
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Worktree Config Factory
// ============================================================================

export interface WorktreeConfigOverrides {
  enabled?: boolean;
  basePath?: string;
  cleanup?: boolean;
  isolation?: boolean;
  status?: WorktreeStatus;
}

/**
 * Creates a mock WorktreeConfig for testing worktree isolation
 */
export function createWorktreeConfig(overrides: WorktreeConfigOverrides = {}): WorktreeConfig {
  const defaults: WorktreeConfig = {
    enabled: true,
    basePath: '.apex/worktrees',
    cleanup: true,
    isolation: true,
    status: 'available',
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Tool Config Factory
// ============================================================================

export interface ToolConfigOverrides {
  Read?: {
    enabled?: boolean;
    permissions?: string[];
  };
  Write?: {
    enabled?: boolean;
    permissions?: string[];
    backupEnabled?: boolean;
  };
  Bash?: {
    enabled?: boolean;
    allowedCommands?: string[];
    timeout?: number;
  };
}

/**
 * Creates a mock ToolConfig for testing tool permissions
 */
export function createToolConfig(overrides: ToolConfigOverrides = {}): ToolConfig {
  const defaults: ToolConfig = {
    Read: {
      enabled: true,
      permissions: ['allow-always'],
    },
    Write: {
      enabled: true,
      permissions: ['allow-once'],
      backupEnabled: true,
    },
    Edit: {
      enabled: true,
      permissions: ['allow-once'],
      validateSyntax: true,
    },
    Bash: {
      enabled: true,
      allowedCommands: ['ls', 'cat', 'grep', 'find'],
      timeout: 30000,
    },
    WebSearch: {
      enabled: true,
      permissions: ['allow-always'],
    },
    WebFetch: {
      enabled: false,
      permissions: ['deny'],
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Logging Config Factory
// ============================================================================

export interface LoggingConfigOverrides {
  level?: LogLevelType;
  file?: {
    enabled?: boolean;
    path?: string;
    maxSize?: string;
    maxFiles?: number;
  };
  console?: {
    enabled?: boolean;
    colorize?: boolean;
    timestamp?: boolean;
  };
  structured?: {
    enabled?: boolean;
    format?: 'json' | 'logfmt';
  };
}

/**
 * Creates a mock LoggingConfig for testing logging settings
 */
export function createLoggingConfig(overrides: LoggingConfigOverrides = {}): LoggingConfig {
  const defaults: LoggingConfig = {
    level: 'info',
    file: {
      enabled: true,
      path: '.apex/logs/apex.log',
      maxSize: '10MB',
      maxFiles: 5,
    },
    console: {
      enabled: true,
      colorize: true,
      timestamp: true,
    },
    structured: {
      enabled: false,
      format: 'json',
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Service Config Factory
// ============================================================================

export interface ServiceConfigOverrides {
  port?: number;
  host?: string;
  cors?: boolean;
}

/**
 * Creates a mock ServiceConfig for testing API service settings
 */
export function createServiceConfig(overrides: ServiceConfigOverrides = {}): ServiceConfig {
  const defaults: ServiceConfig = {
    port: 3000,
    host: 'localhost',
    cors: true,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Daemon Config Factory
// ============================================================================

export interface DaemonConfigOverrides {
  enabled?: boolean;
  port?: number;
  maxTasks?: number;
  idleTimeout?: number;
  healthCheck?: {
    enabled?: boolean;
    interval?: number;
  };
}

/**
 * Creates a mock DaemonConfig for testing daemon service
 */
export function createDaemonConfig(overrides: DaemonConfigOverrides = {}): DaemonConfig {
  const defaults: DaemonConfig = {
    enabled: false,
    port: 3001,
    maxTasks: 10,
    idleTimeout: 300000, // 5 minutes
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
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
  service?: ServiceConfig;
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
    version: '0.5.0',
    project: createProjectConfig(),
    autonomy: createAutonomyConfig(),
    limits: createLimitsConfig(),
    models: createModelsConfig(),
    ui: createUIConfig(),
    git: createGitConfig(),
    tools: createToolConfig(),
    logging: createLoggingConfig(),
    service: createServiceConfig(),
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
      defaultLevel: 'full',
      requireApproval: false,
      allowUpgrade: true,
    }),
    limits: createLimitsConfig({
      maxConcurrentTasks: 10,
      maxCostPerHour: 50.0,
    }),
    tools: createToolConfig({
      Bash: {
        enabled: true,
        allowedCommands: ['ls', 'cat', 'grep', 'find', 'npm', 'git'],
        timeout: 60000,
      },
      Write: {
        enabled: true,
        permissions: ['allow-always'],
        backupEnabled: false,
      },
    }),
    logging: createLoggingConfig({
      level: 'debug',
      console: {
        enabled: true,
        colorize: true,
        timestamp: true,
      },
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
      defaultLevel: 'ask-first',
      requireApproval: true,
      allowUpgrade: false,
      maxCostPerTask: 0.1,
    }),
    limits: createLimitsConfig({
      maxConcurrentTasks: 2,
      maxCostPerHour: 5.0,
      maxTokensPerHour: 50000,
    }),
    tools: createToolConfig({
      Bash: {
        enabled: true,
        allowedCommands: ['ls', 'cat', 'grep'],
        timeout: 10000,
      },
      Write: {
        enabled: true,
        permissions: ['allow-once'],
        backupEnabled: true,
      },
    }),
    logging: createLoggingConfig({
      level: 'warn',
      file: {
        enabled: true,
        path: '/var/log/apex/apex.log',
        maxSize: '100MB',
        maxFiles: 10,
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
      defaultLevel: 'full',
      requireApproval: false,
      timeoutMinutes: 10,
    }),
    limits: createLimitsConfig({
      maxConcurrentTasks: 3,
      maxRetries: 1,
      timeoutSeconds: 600, // 10 minutes
    }),
    git: createGitConfig({
      enabled: false,
      autoCommit: false,
    }),
    logging: createLoggingConfig({
      level: 'error',
      console: {
        enabled: false,
        colorize: false,
      },
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
      autonomy: createAutonomyConfig({ defaultLevel: 'supervised' }),
      limits: createLimitsConfig({ maxCostPerHour: 20.0 }),
    }),
    production: createProductionConfig(),
    testing: createTestingConfig(),
  };
}

/**
 * Creates configs with different autonomy levels for testing
 */
export function createAutonomyLevelConfigs(): {
  full: ApexConfig;
  supervised: ApexConfig;
  askFirst: ApexConfig;
} {
  const base = createApexConfig();

  return {
    full: {
      ...base,
      autonomy: createAutonomyConfig({ defaultLevel: 'full' }),
    },
    supervised: {
      ...base,
      autonomy: createAutonomyConfig({ defaultLevel: 'supervised' }),
    },
    askFirst: {
      ...base,
      autonomy: createAutonomyConfig({ defaultLevel: 'ask-first' }),
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
        maxCostPerHour: -10.0,
      }),
    },
    missingRequired: {
      // Missing required fields for testing validation
      version: '0.5.0',
    },
    conflictingSettings: {
      ...baseConfig,
      autonomy: createAutonomyConfig({
        defaultLevel: 'ask-first',
        requireApproval: false, // Conflicting: ask-first should require approval
      }),
    },
  };
}