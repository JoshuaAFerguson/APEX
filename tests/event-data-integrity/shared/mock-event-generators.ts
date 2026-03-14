/**
 * Factory functions for generating mock event data
 *
 * Provides type-safe mock data generators for all APEX event types
 */

import { generateTestId, createTestTimestamp } from './event-test-utils';

// ============================================================================
// Task Event Generators
// ============================================================================

export interface TaskCreatedEventData {
  taskId: string;
  description: string;
  workflow?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  effort?: 'trivial' | 'small' | 'medium' | 'large' | 'epic';
  autonomy?: 'suggest' | 'auto-apply' | 'full';
  projectPath?: string;
  branchName?: string;
  timestamp: Date;
}

export function createTaskCreatedEvent(
  overrides: Partial<TaskCreatedEventData> = {}
): TaskCreatedEventData {
  return {
    taskId: generateTestId('task'),
    description: 'Test task description',
    workflow: 'feature',
    priority: 'normal',
    effort: 'medium',
    autonomy: 'suggest',
    projectPath: '/test/project',
    branchName: 'apex/test-task',
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface TaskStartedEventData {
  taskId: string;
  stage?: string;
  agent?: string;
  timestamp: Date;
}

export function createTaskStartedEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<TaskStartedEventData> = {}
): TaskStartedEventData {
  return {
    taskId,
    stage: 'planning',
    agent: 'planner',
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface TaskStageChangedEventData {
  taskId: string;
  oldStage: string;
  newStage: string;
  oldAgent?: string;
  newAgent?: string;
  timestamp: Date;
}

export function createTaskStageChangedEvent(
  taskId: string = generateTestId('task'),
  oldStage: string = 'planning',
  newStage: string = 'implementation',
  overrides: Partial<TaskStageChangedEventData> = {}
): TaskStageChangedEventData {
  return {
    taskId,
    oldStage,
    newStage,
    oldAgent: 'planner',
    newAgent: 'developer',
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface TaskCompletedEventData {
  taskId: string;
  result?: unknown;
  duration?: number;
  artifactsCreated?: string[];
  timestamp: Date;
}

export function createTaskCompletedEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<TaskCompletedEventData> = {}
): TaskCompletedEventData {
  return {
    taskId,
    result: { success: true, message: 'Task completed successfully' },
    duration: 30000,
    artifactsCreated: [],
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface TaskFailedEventData {
  taskId: string;
  error: string;
  errorCode?: string;
  stage?: string;
  retryable?: boolean;
  retryCount?: number;
  maxRetries?: number;
  timestamp: Date;
}

export function createTaskFailedEvent(
  taskId: string = generateTestId('task'),
  error: string = 'Test error',
  overrides: Partial<TaskFailedEventData> = {}
): TaskFailedEventData {
  return {
    taskId,
    error,
    errorCode: 'TEST_ERROR',
    stage: 'implementation',
    retryable: true,
    retryCount: 0,
    maxRetries: 3,
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface TaskPausedEventData {
  taskId: string;
  reason: string;
  stage?: string;
  pausedAt: Date;
  resumable?: boolean;
}

export function createTaskPausedEvent(
  taskId: string = generateTestId('task'),
  reason: string = 'User requested pause',
  overrides: Partial<TaskPausedEventData> = {}
): TaskPausedEventData {
  return {
    taskId,
    reason,
    stage: 'implementation',
    pausedAt: createTestTimestamp(),
    resumable: true,
    ...overrides,
  };
}

// ============================================================================
// Agent Event Generators
// ============================================================================

export interface AgentMessageEventData {
  taskId: string;
  agent: string;
  message: string;
  role: 'assistant' | 'user' | 'system';
  tokens?: number;
  timestamp: Date;
}

export function createAgentMessageEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<AgentMessageEventData> = {}
): AgentMessageEventData {
  return {
    taskId,
    agent: 'developer',
    message: 'Processing the task...',
    role: 'assistant',
    tokens: 150,
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface AgentThinkingEventData {
  taskId: string;
  agent: string;
  content: string;
  timestamp: Date;
}

export function createAgentThinkingEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<AgentThinkingEventData> = {}
): AgentThinkingEventData {
  return {
    taskId,
    agent: 'developer',
    content: 'Analyzing the codebase...',
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface AgentToolUseEventData {
  taskId: string;
  agent: string;
  tool: string;
  input: Record<string, unknown>;
  callId?: string;
  timestamp: Date;
}

export function createAgentToolUseEvent(
  taskId: string = generateTestId('task'),
  tool: string = 'Read',
  overrides: Partial<AgentToolUseEventData> = {}
): AgentToolUseEventData {
  return {
    taskId,
    agent: 'developer',
    tool,
    input: { file_path: '/src/index.ts' },
    callId: generateTestId('call'),
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface AgentToolResultEventData {
  taskId: string;
  agent: string;
  tool: string;
  result: unknown;
  callId?: string;
  success: boolean;
  duration?: number;
  timestamp: Date;
}

export function createAgentToolResultEvent(
  taskId: string = generateTestId('task'),
  tool: string = 'Read',
  overrides: Partial<AgentToolResultEventData> = {}
): AgentToolResultEventData {
  return {
    taskId,
    agent: 'developer',
    tool,
    result: { content: 'File content here...' },
    callId: generateTestId('call'),
    success: true,
    duration: 45,
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

// ============================================================================
// Tool Event Generators
// ============================================================================

export interface ToolStartEventData {
  taskId: string;
  toolName: string;
  callId: string;
  input: Record<string, unknown>;
  timestamp: Date;
}

export function createToolStartEvent(
  taskId: string = generateTestId('task'),
  toolName: string = 'Read',
  overrides: Partial<ToolStartEventData> = {}
): ToolStartEventData {
  return {
    taskId,
    toolName,
    callId: generateTestId('call'),
    input: { file_path: '/src/index.ts' },
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface ToolProgressEventData {
  taskId: string;
  toolName: string;
  callId: string;
  progress: {
    message: string;
    percentage?: number;
  };
  timestamp: Date;
}

export function createToolProgressEvent(
  taskId: string = generateTestId('task'),
  toolName: string = 'WebFetch',
  callId: string = generateTestId('call'),
  overrides: Partial<ToolProgressEventData> = {}
): ToolProgressEventData {
  return {
    taskId,
    toolName,
    callId,
    progress: {
      message: 'Downloading...',
      percentage: 50,
    },
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface ToolCompleteEventData {
  taskId: string;
  toolName: string;
  callId: string;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  timing: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  timestamp: Date;
}

export function createToolCompleteEvent(
  taskId: string = generateTestId('task'),
  toolName: string = 'Read',
  callId: string = generateTestId('call'),
  overrides: Partial<ToolCompleteEventData> = {}
): ToolCompleteEventData {
  const startTime = createTestTimestamp(-100);
  const endTime = createTestTimestamp();

  return {
    taskId,
    toolName,
    callId,
    result: {
      success: true,
      output: { content: 'File content' },
    },
    timing: {
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
    },
    timestamp: endTime,
    ...overrides,
  };
}

// ============================================================================
// Approval/Gate Event Generators
// ============================================================================

export interface ApprovalRequiredEventData {
  approvalId: string;
  taskId: string;
  gateName?: string;
  gateType?: 'before-commit' | 'before-deploy' | 'before-destructive' | 'deployment' | 'custom';
  description?: string;
  approvers?: string[];
  minApprovals?: number;
  timeoutMinutes?: number;
  requestedAt?: Date;
  stage?: string;
  agent?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export function createApprovalRequiredEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<ApprovalRequiredEventData> = {}
): ApprovalRequiredEventData {
  return {
    approvalId: generateTestId('approval'),
    taskId,
    gateName: 'Test Gate',
    gateType: 'before-deploy',
    description: 'Approval required for deployment',
    approvers: ['admin'],
    minApprovals: 1,
    timeoutMinutes: 60,
    requestedAt: createTestTimestamp(),
    stage: 'deployment',
    agent: 'deployer',
    priority: 'normal',
    ...overrides,
  };
}

export interface ApprovalResolvedEventData {
  approvalId: string;
  taskId: string;
  gateName: string;
  resolution: 'approved' | 'denied' | 'timeout' | 'cancelled';
  resolvedBy?: string;
  resolvedAt?: Date;
  finalComment?: string;
  approvalsReceived?: number;
  approvalsRequired?: number;
}

export function createApprovalResolvedEvent(
  approvalId: string = generateTestId('approval'),
  taskId: string = generateTestId('task'),
  resolution: 'approved' | 'denied' | 'timeout' | 'cancelled' = 'approved',
  overrides: Partial<ApprovalResolvedEventData> = {}
): ApprovalResolvedEventData {
  return {
    approvalId,
    taskId,
    gateName: 'Test Gate',
    resolution,
    resolvedBy: 'admin@test.com',
    resolvedAt: createTestTimestamp(),
    finalComment: `Request ${resolution}`,
    approvalsReceived: resolution === 'approved' ? 1 : 0,
    approvalsRequired: 1,
    ...overrides,
  };
}

// ============================================================================
// Container Event Generators
// ============================================================================

export interface ContainerCreatedEventData {
  containerId: string;
  containerName: string;
  image: string;
  taskId?: string;
  timestamp: Date;
  config?: Record<string, unknown>;
  labels?: Record<string, string>;
}

export function createContainerCreatedEvent(
  overrides: Partial<ContainerCreatedEventData> = {}
): ContainerCreatedEventData {
  return {
    containerId: generateTestId('container'),
    containerName: 'test-container',
    image: 'node:20',
    taskId: generateTestId('task'),
    timestamp: createTestTimestamp(),
    config: { image: 'node:20' },
    labels: { 'apex.task': 'test' },
    ...overrides,
  };
}

export interface ContainerStartedEventData {
  containerId: string;
  containerName: string;
  image: string;
  taskId?: string;
  timestamp: Date;
  pid?: number;
  ports?: Record<string, string>;
  networkMode?: 'bridge' | 'host' | 'none' | 'container';
}

export function createContainerStartedEvent(
  containerId: string = generateTestId('container'),
  overrides: Partial<ContainerStartedEventData> = {}
): ContainerStartedEventData {
  return {
    containerId,
    containerName: 'test-container',
    image: 'node:20',
    taskId: generateTestId('task'),
    timestamp: createTestTimestamp(),
    pid: 12345,
    ports: { '3000': '3000' },
    networkMode: 'bridge',
    ...overrides,
  };
}

export interface ContainerStoppedEventData {
  containerId: string;
  containerName: string;
  image: string;
  taskId?: string;
  timestamp: Date;
  exitCode: number;
  graceful: boolean;
  duration?: number;
}

export function createContainerStoppedEvent(
  containerId: string = generateTestId('container'),
  overrides: Partial<ContainerStoppedEventData> = {}
): ContainerStoppedEventData {
  return {
    containerId,
    containerName: 'test-container',
    image: 'node:20',
    taskId: generateTestId('task'),
    timestamp: createTestTimestamp(),
    exitCode: 0,
    graceful: true,
    duration: 30000,
    ...overrides,
  };
}

export interface ContainerHealthEventData {
  containerId: string;
  containerName: string;
  image: string;
  taskId?: string;
  timestamp: Date;
  status: 'starting' | 'healthy' | 'unhealthy' | 'none';
  previousStatus?: 'starting' | 'healthy' | 'unhealthy' | 'none';
  failingStreak?: number;
}

export function createContainerHealthEvent(
  containerId: string = generateTestId('container'),
  status: 'starting' | 'healthy' | 'unhealthy' | 'none' = 'healthy',
  overrides: Partial<ContainerHealthEventData> = {}
): ContainerHealthEventData {
  return {
    containerId,
    containerName: 'test-container',
    image: 'node:20',
    taskId: generateTestId('task'),
    timestamp: createTestTimestamp(),
    status,
    previousStatus: 'starting',
    failingStreak: status === 'unhealthy' ? 3 : 0,
    ...overrides,
  };
}

// ============================================================================
// Permission Event Generators
// ============================================================================

export interface PermissionRequestEventData {
  requestId: string;
  tool: string;
  scope?: string;
  description: string;
  isDangerous: boolean;
  agent: string;
  taskId?: string;
  timestamp: Date;
}

export function createPermissionRequestEvent(
  tool: string = 'Bash',
  overrides: Partial<PermissionRequestEventData> = {}
): PermissionRequestEventData {
  return {
    requestId: generateTestId('permission'),
    tool,
    scope: '*',
    description: `Request to use ${tool}`,
    isDangerous: tool === 'Bash',
    agent: 'developer',
    taskId: generateTestId('task'),
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface PermissionGrantedEventData {
  requestId: string;
  tool: string;
  scope?: string;
  level: 'allow-always' | 'allow-once' | 'deny';
  grantedBy: string;
  timestamp: Date;
}

export function createPermissionGrantedEvent(
  requestId: string = generateTestId('permission'),
  overrides: Partial<PermissionGrantedEventData> = {}
): PermissionGrantedEventData {
  return {
    requestId,
    tool: 'Bash',
    scope: '*',
    level: 'allow-once',
    grantedBy: 'user',
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

// ============================================================================
// Auto-fix Event Generators
// ============================================================================

export interface AutofixRequestedEventData {
  taskId: string;
  filePath: string;
  fixTypes: string[];
  triggeredBy: 'hook' | 'manual' | 'batch' | 'auto';
  timestamp: Date;
}

export function createAutofixRequestedEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<AutofixRequestedEventData> = {}
): AutofixRequestedEventData {
  return {
    taskId,
    filePath: '/src/components/Button.tsx',
    fixTypes: ['eslint', 'prettier'],
    triggeredBy: 'hook',
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface AutofixCompletedEventData {
  taskId: string;
  filePath: string;
  fixType: string;
  issuesDetected: number;
  issuesFixed: number;
  duration: number;
  timestamp: Date;
}

export function createAutofixCompletedEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<AutofixCompletedEventData> = {}
): AutofixCompletedEventData {
  return {
    taskId,
    filePath: '/src/components/Button.tsx',
    fixType: 'eslint',
    issuesDetected: 5,
    issuesFixed: 5,
    duration: 250,
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

// ============================================================================
// TDD Event Generators
// ============================================================================

export interface TDDStartedEventData {
  taskId: string;
  testCommand: string;
  maxIterations: number;
  targetFiles: string[];
  timestamp: Date;
}

export function createTDDStartedEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<TDDStartedEventData> = {}
): TDDStartedEventData {
  return {
    taskId,
    testCommand: 'npm test',
    maxIterations: 10,
    targetFiles: ['/src/utils/helpers.ts'],
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface TDDCompletedEventData {
  taskId: string;
  summary: {
    iterations: number;
    issuesFixed: number;
    success: boolean;
  };
  totalDuration: number;
  timestamp: Date;
}

export function createTDDCompletedEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<TDDCompletedEventData> = {}
): TDDCompletedEventData {
  return {
    taskId,
    summary: {
      iterations: 3,
      issuesFixed: 5,
      success: true,
    },
    totalDuration: 45000,
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

// ============================================================================
// Browser Event Generators
// ============================================================================

export interface BrowserConsoleEventData {
  taskId: string;
  sessionId: string;
  message: string;
  severity: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
  sourceUrl?: string;
  lineNumber?: number;
  timestamp: Date;
}

export function createBrowserConsoleEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<BrowserConsoleEventData> = {}
): BrowserConsoleEventData {
  return {
    taskId,
    sessionId: generateTestId('session'),
    message: 'Console message',
    severity: 'log',
    sourceUrl: 'https://example.com/app.js',
    lineNumber: 42,
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}

export interface BrowserErrorEventData {
  taskId: string;
  sessionId: string;
  name: string;
  message: string;
  sourceUrl?: string;
  lineNumber?: number;
  stackTrace?: Array<{
    functionName?: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  }>;
  timestamp: Date;
}

export function createBrowserErrorEvent(
  taskId: string = generateTestId('task'),
  overrides: Partial<BrowserErrorEventData> = {}
): BrowserErrorEventData {
  return {
    taskId,
    sessionId: generateTestId('session'),
    name: 'TypeError',
    message: 'Cannot read property of undefined',
    sourceUrl: 'https://example.com/app.js',
    lineNumber: 42,
    stackTrace: [
      {
        functionName: 'handleClick',
        url: 'https://example.com/app.js',
        lineNumber: 42,
        columnNumber: 15,
      },
    ],
    timestamp: createTestTimestamp(),
    ...overrides,
  };
}
