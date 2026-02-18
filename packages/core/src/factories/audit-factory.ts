/**
 * Audit Factory - Mock factories for Audit logging and related domain types
 */

import type {
  AuditLogEntry,
  AuditEventType,
  AuditSeverity,
  AutoFixResult,
  AutoFixEvent,
  AutoFixEventType,
  AutoFixStatus,
  AutoFixIssueDetail,
} from '../types.js';

// ============================================================================
// Audit Log Entry Factory
// ============================================================================

export interface AuditLogEntryOverrides {
  id?: string;
  taskId?: string;
  eventType?: AuditEventType;
  severity?: AuditSeverity;
  timestamp?: Date;
  actor?: string;
  message?: string;
  stage?: string;
  agent?: string;
  metadata?: Record<string, unknown>;
  previousState?: string;
  newState?: string;
  durationMs?: number;
  success?: boolean;
  error?: string;
  correlationId?: string;
  sessionId?: string;
}

/**
 * Creates a mock AuditLogEntry with realistic default values
 *
 * @param overrides - Partial audit log properties to override defaults
 * @returns Complete AuditLogEntry object with valid type-safe properties
 *
 * @example
 * ```typescript
 * // Create audit log with defaults
 * const auditLog = createAuditLogEntry();
 *
 * // Create task completion audit log
 * const taskCompleted = createAuditLogEntry({
 *   eventType: 'task.completed',
 *   severity: 'info',
 *   message: 'Task completed successfully',
 *   durationMs: 45000
 * });
 * ```
 */
export function createAuditLogEntry(overrides: AuditLogEntryOverrides = {}): AuditLogEntry {
  const defaults: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    taskId: `task_${Math.random().toString(36).substr(2, 9)}`,
    eventType: 'task.created',
    severity: 'info',
    timestamp: new Date(),
    actor: 'system',
    message: 'Task created and queued for execution',
    stage: 'initialization',
    agent: 'orchestrator',
    metadata: {
      workflow: 'feature-development',
      priority: 'normal',
      estimatedCost: 0.50,
    },
    success: true,
    correlationId: `corr_${Math.random().toString(36).substr(2, 12)}`,
    sessionId: `sess_${Math.random().toString(36).substr(2, 12)}`,
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Auto-Fix Issue Detail Factory
// ============================================================================

export interface AutoFixIssueDetailOverrides {
  type?: string;
  description?: string;
  filePath?: string;
  line?: number;
  column?: number;
  severity?: 'error' | 'warning' | 'info';
}

/**
 * Creates a mock AutoFixIssueDetail for testing auto-fix functionality
 */
export function createAutoFixIssueDetail(overrides: AutoFixIssueDetailOverrides = {}): AutoFixIssueDetail {
  const defaults: AutoFixIssueDetail = {
    type: 'syntax-error',
    description: 'Missing semicolon at end of statement',
    filePath: '/src/components/LoginForm.tsx',
    line: 25,
    column: 32,
    severity: 'error',
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Auto-Fix Result Factory
// ============================================================================

export interface AutoFixResultOverrides {
  id?: string;
  taskId?: string;
  filePath?: string;
  fixType?: 'syntax' | 'imports' | 'formatting';
  success?: boolean;
  description?: string;
  issuesFixed?: number;
  error?: string;
  timestamp?: Date;
  originalContent?: string;
  fixedContent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a mock AutoFixResult for testing auto-fix operations
 */
export function createAutoFixResult(overrides: AutoFixResultOverrides = {}): AutoFixResult {
  const defaults: AutoFixResult = {
    id: `autofix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    taskId: `task_${Math.random().toString(36).substr(2, 9)}`,
    filePath: '/src/components/LoginForm.tsx',
    fixType: 'syntax',
    success: true,
    description: 'Fixed 3 syntax errors: added missing semicolons and corrected indentation',
    issuesFixed: 3,
    timestamp: new Date(),
    originalContent: 'const greeting = "Hello World"\nconsole.log(greeting)',
    fixedContent: 'const greeting = "Hello World";\nconsole.log(greeting);',
    metadata: {
      linter: 'eslint',
      rules: ['semi', 'indent'],
      duration: 150,
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Auto-Fix Event Factory
// ============================================================================

export interface AutoFixEventOverrides {
  id?: string;
  eventType?: AutoFixEventType;
  taskId?: string;
  filesModified?: string[];
  issuesFixed?: AutoFixIssueDetail[];
  iterationCount?: number;
  totalIterations?: number;
  currentFile?: string;
  status?: AutoFixStatus;
  timestamp?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a mock AutoFixEvent for testing auto-fix event tracking
 */
export function createAutoFixEvent(overrides: AutoFixEventOverrides = {}): AutoFixEvent {
  const defaults: AutoFixEvent = {
    id: `autofix_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    eventType: 'auto-fix-progress',
    taskId: `task_${Math.random().toString(36).substr(2, 9)}`,
    filesModified: [
      '/src/components/LoginForm.tsx',
      '/src/utils/validation.ts',
    ],
    issuesFixed: [
      createAutoFixIssueDetail(),
      createAutoFixIssueDetail({
        type: 'import-error',
        description: 'Unused import statement removed',
        line: 3,
      }),
    ],
    iterationCount: 1,
    totalIterations: 3,
    currentFile: '/src/components/LoginForm.tsx',
    status: 'running',
    timestamp: new Date(),
    metadata: {
      strategy: 'incremental',
      timeoutMs: 30000,
      maxIssuesPerFile: 50,
    },
  };

  return { ...defaults, ...overrides };
}

// ============================================================================
// Specialized Audit Factories
// ============================================================================

/**
 * Creates task lifecycle audit logs
 */
export function createTaskLifecycleAudits(taskId: string): {
  created: AuditLogEntry;
  started: AuditLogEntry;
  completed: AuditLogEntry;
} {
  const baseTimestamp = new Date();
  const correlationId = `task_lifecycle_${taskId}`;

  return {
    created: createAuditLogEntry({
      taskId,
      eventType: 'task.created',
      timestamp: baseTimestamp,
      message: 'New task created from user request',
      previousState: undefined,
      newState: 'pending',
      correlationId,
    }),
    started: createAuditLogEntry({
      taskId,
      eventType: 'task.started',
      timestamp: new Date(baseTimestamp.getTime() + 5000),
      message: 'Task execution started',
      previousState: 'pending',
      newState: 'in-progress',
      correlationId,
    }),
    completed: createAuditLogEntry({
      taskId,
      eventType: 'task.completed',
      timestamp: new Date(baseTimestamp.getTime() + 45000),
      message: 'Task completed successfully',
      previousState: 'in-progress',
      newState: 'completed',
      durationMs: 40000,
      correlationId,
    }),
  };
}

/**
 * Creates agent handoff audit logs
 */
export function createAgentHandoffAudits(): AuditLogEntry[] {
  const taskId = `task_${Math.random().toString(36).substr(2, 9)}`;
  const correlationId = `handoff_${taskId}`;
  const baseTimestamp = new Date();

  return [
    createAuditLogEntry({
      taskId,
      eventType: 'agent.started',
      agent: 'planner',
      stage: 'planning',
      timestamp: baseTimestamp,
      message: 'Planner agent started task analysis',
      correlationId,
    }),
    createAuditLogEntry({
      taskId,
      eventType: 'agent.completed',
      agent: 'planner',
      stage: 'planning',
      timestamp: new Date(baseTimestamp.getTime() + 15000),
      message: 'Planner agent completed task analysis',
      durationMs: 15000,
      correlationId,
    }),
    createAuditLogEntry({
      taskId,
      eventType: 'agent.handoff',
      agent: 'developer',
      stage: 'implementation',
      timestamp: new Date(baseTimestamp.getTime() + 16000),
      message: 'Task handed off from planner to developer agent',
      metadata: {
        previousAgent: 'planner',
        nextAgent: 'developer',
        handoffReason: 'stage_completion',
      },
      correlationId,
    }),
  ];
}

/**
 * Creates approval workflow audit logs
 */
export function createApprovalAudits(): {
  requested: AuditLogEntry;
  granted: AuditLogEntry;
  denied: AuditLogEntry;
  timeout: AuditLogEntry;
} {
  const taskId = `task_${Math.random().toString(36).substr(2, 9)}`;
  const correlationId = `approval_${taskId}`;
  const baseTimestamp = new Date();

  return {
    requested: createAuditLogEntry({
      taskId,
      eventType: 'approval.requested',
      actor: 'developer',
      timestamp: baseTimestamp,
      message: 'Approval requested for production deployment',
      metadata: {
        approvalType: 'deployment',
        requiredApprovers: ['tech-lead@company.com'],
        timeoutMinutes: 60,
      },
      correlationId,
    }),
    granted: createAuditLogEntry({
      taskId,
      eventType: 'approval.granted',
      actor: 'tech-lead@company.com',
      timestamp: new Date(baseTimestamp.getTime() + 300000), // 5 minutes later
      message: 'Deployment approval granted by tech lead',
      durationMs: 300000,
      metadata: {
        approvalReason: 'Code review passed, tests successful',
      },
      correlationId,
    }),
    denied: createAuditLogEntry({
      taskId: `${taskId}_denied`,
      eventType: 'approval.denied',
      actor: 'tech-lead@company.com',
      timestamp: new Date(baseTimestamp.getTime() + 180000), // 3 minutes later
      message: 'Deployment approval denied by tech lead',
      metadata: {
        denialReason: 'Security vulnerabilities detected in dependencies',
        blockers: ['CVE-2023-1234', 'CVE-2023-5678'],
      },
      correlationId: `${correlationId}_denied`,
    }),
    timeout: createAuditLogEntry({
      taskId: `${taskId}_timeout`,
      eventType: 'approval.timeout',
      actor: 'system',
      timestamp: new Date(baseTimestamp.getTime() + 3600000), // 1 hour later
      message: 'Approval request timed out after 60 minutes',
      success: false,
      metadata: {
        timeoutReason: 'No response from required approvers',
      },
      correlationId: `${correlationId}_timeout`,
    }),
  };
}

/**
 * Creates security-related audit logs
 */
export function createSecurityAudits(): AuditLogEntry[] {
  const taskId = `task_${Math.random().toString(36).substr(2, 9)}`;
  const correlationId = `security_${taskId}`;

  return [
    createAuditLogEntry({
      taskId,
      eventType: 'security.policy_violation',
      severity: 'critical',
      actor: 'security-scanner',
      message: 'Policy violation detected: Attempting to access restricted file',
      metadata: {
        violationType: 'file_access',
        attemptedPath: '/etc/passwd',
        policy: 'filesystem-access-control',
        blocked: true,
      },
      success: false,
      correlationId,
    }),
    createAuditLogEntry({
      taskId,
      eventType: 'security.rate_limited',
      severity: 'warn',
      actor: 'rate-limiter',
      message: 'API rate limit exceeded for task execution',
      metadata: {
        endpoint: '/api/v1/tasks',
        limit: 100,
        current: 150,
        resetTime: new Date(Date.now() + 3600000),
      },
      correlationId,
    }),
  ];
}

// ============================================================================
// Auto-Fix Scenario Collections
// ============================================================================

/**
 * Creates a complete auto-fix operation sequence
 */
export function createAutoFixSequence(): {
  start: AutoFixEvent;
  progress: AutoFixEvent;
  complete: AutoFixEvent;
  result: AutoFixResult;
} {
  const taskId = `task_${Math.random().toString(36).substr(2, 9)}`;
  const baseTimestamp = new Date();

  return {
    start: createAutoFixEvent({
      eventType: 'auto-fix-start',
      taskId,
      status: 'running',
      timestamp: baseTimestamp,
      iterationCount: 0,
      totalIterations: 3,
      filesModified: [],
      issuesFixed: [],
    }),
    progress: createAutoFixEvent({
      eventType: 'auto-fix-progress',
      taskId,
      status: 'running',
      timestamp: new Date(baseTimestamp.getTime() + 5000),
      iterationCount: 2,
      totalIterations: 3,
      currentFile: '/src/components/LoginForm.tsx',
    }),
    complete: createAutoFixEvent({
      eventType: 'auto-fix-complete',
      taskId,
      status: 'success',
      timestamp: new Date(baseTimestamp.getTime() + 15000),
      iterationCount: 3,
      totalIterations: 3,
    }),
    result: createAutoFixResult({
      taskId,
      success: true,
      timestamp: new Date(baseTimestamp.getTime() + 16000),
    }),
  };
}

/**
 * Creates failed auto-fix operation logs
 */
export function createFailedAutoFixSequence(): {
  start: AutoFixEvent;
  error: AutoFixEvent;
  result: AutoFixResult;
} {
  const taskId = `task_${Math.random().toString(36).substr(2, 9)}`;
  const baseTimestamp = new Date();

  return {
    start: createAutoFixEvent({
      eventType: 'auto-fix-start',
      taskId,
      status: 'running',
      timestamp: baseTimestamp,
    }),
    error: createAutoFixEvent({
      eventType: 'auto-fix-error',
      taskId,
      status: 'failed',
      timestamp: new Date(baseTimestamp.getTime() + 3000),
      error: 'Syntax parser failed: Unexpected token at line 15',
      metadata: {
        errorType: 'ParseError',
        failedFile: '/src/components/BrokenComponent.tsx',
      },
    }),
    result: createAutoFixResult({
      taskId,
      success: false,
      error: 'Auto-fix failed: Unable to parse file syntax',
      timestamp: new Date(baseTimestamp.getTime() + 4000),
      issuesFixed: 0,
    }),
  };
}

// ============================================================================
// Audit Collections
// ============================================================================

/**
 * Creates audit logs for different severity levels
 */
export function createSeverityAudits(): Record<AuditSeverity, AuditLogEntry[]> {
  return {
    debug: [
      createAuditLogEntry({
        severity: 'debug',
        eventType: 'tool.executed',
        message: 'Tool execution debug trace',
        metadata: { tool: 'Read', duration: 50 },
      }),
    ],
    info: [
      createAuditLogEntry({
        severity: 'info',
        eventType: 'task.started',
        message: 'Task execution began',
      }),
    ],
    warn: [
      createAuditLogEntry({
        severity: 'warn',
        eventType: 'security.rate_limited',
        message: 'Rate limit warning: approaching quota',
      }),
    ],
    error: [
      createAuditLogEntry({
        severity: 'error',
        eventType: 'task.failed',
        message: 'Task execution failed with errors',
        success: false,
      }),
    ],
    critical: [
      createAuditLogEntry({
        severity: 'critical',
        eventType: 'security.policy_violation',
        message: 'Critical security violation detected',
        success: false,
      }),
    ],
  };
}

/**
 * Creates audit test scenarios for comprehensive testing
 */
export function createAuditTestScenarios(): {
  validEntry: AuditLogEntry;
  missingRequired: Partial<AuditLogEntry>;
  invalidSeverity: any;
  futureTimestamp: AuditLogEntry;
  longRunningOperation: AuditLogEntry;
} {
  return {
    validEntry: createAuditLogEntry(),
    missingRequired: {
      // Missing required fields for validation testing
      id: 'test-audit-1',
      eventType: 'task.created',
      timestamp: new Date(),
    },
    invalidSeverity: createAuditLogEntry({
      severity: 'emergency' as any, // Invalid severity level
    }),
    futureTimestamp: createAuditLogEntry({
      timestamp: new Date(Date.now() + 86400000), // 1 day in future
    }),
    longRunningOperation: createAuditLogEntry({
      eventType: 'task.completed',
      durationMs: 7200000, // 2 hours
      metadata: {
        operationType: 'complex-analysis',
        resourcesUsed: { cpu: '95%', memory: '8GB' },
      },
    }),
  };
}