/**
 * Comprehensive Integration Test Utilities for APEX
 *
 * This module provides a complete set of utilities for integration testing across
 * the APEX platform, including:
 * - End-to-end test environment setup
 * - Mock factories for all system components
 * - Test data fixtures and scenarios
 * - Browser automation test helpers
 * - Permission and tool integration testing
 * - Multi-agent workflow testing
 */

import { vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type {
  Task,
  AgentDefinition,
  WorkflowDefinition,
  ApexConfig,
  Permission,
  PermissionLevel,
  AgentTool,
  TaskStatus,
  Autonomy,
  Priority,
} from '@apexcli/core';
import {
  initializeApex,
  isApexInitialized,
  loadConfig,
  loadAgents,
  loadWorkflows,
} from '@apexcli/core';
import { ApexOrchestrator, TaskStore } from '@apexcli/orchestrator';

// Re-export commonly used testing utilities
export * from './tool-integration-fixtures';
export * from './permission-integration-fixtures';
export * from './browser-automation-test-setup';

// ============================================================================
// Core Integration Test Environment
// ============================================================================

export interface IntegrationTestEnvironment {
  // Test directory and cleanup
  testDir: string;
  cleanup: () => Promise<void>;

  // APEX components
  orchestrator: ApexOrchestrator;
  taskStore: TaskStore;
  config: ApexConfig;
  agents: Record<string, AgentDefinition>;
  workflows: Record<string, WorkflowDefinition>;

  // Test utilities
  createTask: (overrides?: Partial<Task>) => Task;
  createAgent: (name: string, overrides?: Partial<AgentDefinition>) => AgentDefinition;
  createWorkflow: (name: string, overrides?: Partial<WorkflowDefinition>) => WorkflowDefinition;

  // Event monitoring
  events: IntegrationEventMonitor;

  // Browser testing (if enabled)
  browser?: BrowserTestEnvironment;

  // Permission testing
  permissions: PermissionTestEnvironment;

  // Tool mocking
  tools: ToolMockRegistry;
}

export interface IntegrationTestOptions {
  projectName?: string;
  language?: 'typescript' | 'javascript' | 'python' | 'go';
  framework?: string;
  enableBrowser?: boolean;
  enablePermissions?: boolean;
  customAgents?: Array<{ name: string; definition: Partial<AgentDefinition> }>;
  customWorkflows?: Array<{ name: string; definition: Partial<WorkflowDefinition> }>;
  mockClaudeAPI?: boolean;
  isolation?: {
    filesystem?: boolean;
    network?: boolean;
    environment?: boolean;
  };
}

/**
 * Creates a complete integration test environment with all necessary components
 */
export async function createIntegrationTestEnvironment(
  options: IntegrationTestOptions = {}
): Promise<IntegrationTestEnvironment> {
  const {
    projectName = 'integration-test-project',
    language = 'typescript',
    framework,
    enableBrowser = false,
    enablePermissions = true,
    customAgents = [],
    customWorkflows = [],
    mockClaudeAPI = true,
    isolation = { filesystem: true, network: false, environment: true },
  } = options;

  // Create temporary test directory
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), `apex-integration-${Date.now()}-`));

  // Initialize APEX project
  await initializeApex(testDir, {
    projectName,
    language,
    framework,
  });

  // Create custom agents
  const agentsDir = path.join(testDir, '.apex', 'agents');
  for (const { name, definition } of customAgents) {
    const agentContent = createAgentFileContent(name, definition);
    await fs.writeFile(path.join(agentsDir, `${name}.md`), agentContent);
  }

  // Create custom workflows
  const workflowsDir = path.join(testDir, '.apex', 'workflows');
  for (const { name, definition } of customWorkflows) {
    const workflowContent = createWorkflowFileContent(name, definition);
    await fs.writeFile(path.join(workflowsDir, `${name}.yaml`), workflowContent);
  }

  // Load configurations
  const config = await loadConfig(testDir);
  const agents = await loadAgents(testDir);
  const workflows = await loadWorkflows(testDir);

  // Create orchestrator and task store
  const orchestrator = new ApexOrchestrator({ projectPath: testDir });
  await orchestrator.initialize();

  const taskStore = new TaskStore(testDir);
  await taskStore.initialize();

  // Set up event monitoring
  const events = new IntegrationEventMonitor(orchestrator);

  // Set up permission testing environment
  const permissions = await createPermissionTestEnvironment({
    initialPermissions: [],
    defaultResponse: 'allow-once',
  });

  // Set up tool mocking
  const tools = createToolMockRegistry();

  // Set up browser testing if enabled
  let browser: BrowserTestEnvironment | undefined;
  if (enableBrowser) {
    const { createBrowserTestEnvironment } = await import('./browser-automation-test-setup');
    browser = await createBrowserTestEnvironment();
  }

  // Mock Claude API if requested
  if (mockClaudeAPI) {
    setupClaudeAPIMocks();
  }

  // Set up isolation
  if (isolation.filesystem) {
    await setupFilesystemIsolation(testDir);
  }
  if (isolation.environment) {
    setupEnvironmentIsolation();
  }

  const environment: IntegrationTestEnvironment = {
    testDir,
    orchestrator,
    taskStore,
    config,
    agents,
    workflows,
    events,
    permissions,
    tools,
    browser,

    createTask: (overrides = {}) => createTestTask({ projectPath: testDir, ...overrides }),
    createAgent: (name, overrides = {}) => createTestAgent(name, overrides),
    createWorkflow: (name, overrides = {}) => createTestWorkflow(name, overrides),

    cleanup: async () => {
      // Clean up orchestrator
      if (orchestrator) {
        await orchestrator.cleanup?.();
      }

      // Close task store
      if (taskStore) {
        taskStore.close();
      }

      // Clean up browser
      if (browser) {
        await browser.cleanup();
      }

      // Clean up permissions
      permissions.cleanup();

      // Clean up tools
      tools.resetAllMocks();

      // Clean up events
      events.cleanup();

      // Remove test directory
      await fs.rm(testDir, { recursive: true, force: true });

      // Reset mocks
      vi.clearAllMocks();
    },
  };

  return environment;
}

// ============================================================================
// Event Monitoring for Integration Tests
// ============================================================================

export class IntegrationEventMonitor extends EventEmitter {
  private events: Array<{
    type: string;
    data: unknown;
    timestamp: Date;
  }> = [];

  private subscriptions = new Map<string, MockedFunction<any>>();

  constructor(orchestrator: ApexOrchestrator) {
    super();

    // Subscribe to orchestrator events
    const orchestratorEvents = [
      'task:created',
      'task:updated',
      'task:completed',
      'task:failed',
      'agent:started',
      'agent:completed',
      'stage:started',
      'stage:completed',
    ];

    orchestratorEvents.forEach(eventType => {
      const handler = vi.fn((data) => {
        this.recordEvent(eventType, data);
      });

      orchestrator.on(eventType, handler);
      this.subscriptions.set(eventType, handler);
    });
  }

  private recordEvent(type: string, data: unknown) {
    const event = {
      type,
      data,
      timestamp: new Date(),
    };
    this.events.push(event);
    this.emit('event', event);
  }

  /**
   * Get all recorded events
   */
  getEvents(): typeof this.events {
    return [...this.events];
  }

  /**
   * Get events of a specific type
   */
  getEventsByType(type: string): typeof this.events {
    return this.events.filter(event => event.type === type);
  }

  /**
   * Get events within a time range
   */
  getEventsInRange(start: Date, end: Date): typeof this.events {
    return this.events.filter(
      event => event.timestamp >= start && event.timestamp <= end
    );
  }

  /**
   * Wait for a specific event type
   */
  waitForEvent(type: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${type}`));
      }, timeout);

      const handler = (event: any) => {
        if (event.type === type) {
          clearTimeout(timeoutHandle);
          this.off('event', handler);
          resolve(event.data);
        }
      };

      this.on('event', handler);
    });
  }

  /**
   * Wait for multiple events
   */
  waitForEvents(types: string[], timeout = 5000): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      const results: Record<string, any> = {};
      const remaining = new Set(types);

      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Timeout waiting for events: ${Array.from(remaining).join(', ')}`));
      }, timeout);

      const handler = (event: any) => {
        if (remaining.has(event.type)) {
          results[event.type] = event.data;
          remaining.delete(event.type);

          if (remaining.size === 0) {
            clearTimeout(timeoutHandle);
            this.off('event', handler);
            resolve(results);
          }
        }
      };

      this.on('event', handler);
    });
  }

  /**
   * Clear all recorded events
   */
  clearEvents() {
    this.events = [];
  }

  /**
   * Get event statistics
   */
  getEventStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const event of this.events) {
      stats[event.type] = (stats[event.type] || 0) + 1;
    }
    return stats;
  }

  /**
   * Cleanup event monitoring
   */
  cleanup() {
    this.clearEvents();
    this.removeAllListeners();
    this.subscriptions.clear();
  }
}

// ============================================================================
// Browser Test Environment
// ============================================================================

export interface BrowserTestEnvironment {
  page: any; // Playwright page instance
  browser: any; // Browser instance
  context: any; // Browser context
  cleanup: () => Promise<void>;

  // Convenience methods
  navigateTo: (url: string) => Promise<void>;
  screenshot: (name?: string) => Promise<string>;
  waitForSelector: (selector: string, timeout?: number) => Promise<void>;
  click: (selector: string) => Promise<void>;
  type: (selector: string, text: string) => Promise<void>;
  evaluate: (fn: Function, ...args: any[]) => Promise<any>;
}

// ============================================================================
// Permission Test Environment
// ============================================================================

export interface PermissionTestEnvironment {
  approvalSystem: any; // From permission-integration-fixtures
  mcpServer?: any; // From permission-integration-fixtures

  // Convenience methods
  simulatePermissionWorkflow: (tool: AgentTool, scope?: string) => Promise<any>;
  grantPermission: (tool: AgentTool, scope?: string, level?: PermissionLevel) => Promise<void>;
  denyPermission: (tool: AgentTool, scope?: string) => Promise<void>;
  clearPermissions: () => Promise<void>;

  // Cleanup
  cleanup: () => void;
}

// ============================================================================
// Tool Mock Registry
// ============================================================================

export interface ToolMockRegistry {
  tools: Record<AgentTool, any>;
  getAllMocks: () => any[];
  resetAllMocks: () => void;
  getToolMock: (toolName: AgentTool) => any;
  getCallHistory: () => Record<AgentTool, any[]>;

  // Convenience methods
  mockToolSuccess: (toolName: AgentTool, responseData?: unknown) => void;
  mockToolFailure: (toolName: AgentTool, error?: Error) => void;
  mockToolDelay: (toolName: AgentTool, delayMs: number) => void;
}

// ============================================================================
// Test Data Factory Functions
// ============================================================================

/**
 * Create a test task with sensible defaults
 */
export function createTestTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();

  return {
    id: `test_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for integration testing',
    workflow: 'feature',
    status: 'pending',
    autonomy: 'full',
    priority: 'normal',
    projectPath: '/tmp/test-project',
    branchName: `test-branch-${Date.now()}`,
    retryCount: 0,
    maxRetries: 3,
    dependsOn: [],
    blockedBy: [],
    createdAt: now,
    updatedAt: now,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  };
}

/**
 * Create a test agent definition
 */
export function createTestAgent(name: string, overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name,
    description: `Test agent: ${name}`,
    tools: ['Read', 'Write', 'Edit'],
    model: 'sonnet',
    prompt: `You are the ${name} agent for testing.`,
    ...overrides,
  };
}

/**
 * Create a test workflow definition
 */
export function createTestWorkflow(name: string, overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    name,
    description: `Test workflow: ${name}`,
    stages: [
      {
        name: 'planning',
        agent: 'planner',
        description: 'Plan the task',
      },
      {
        name: 'implementation',
        agent: 'developer',
        description: 'Implement the task',
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// Test Scenario Builders
// ============================================================================

/**
 * Predefined integration test scenarios
 */
export const integrationScenarios = {
  /**
   * Basic task creation and execution
   */
  basicTaskExecution: async (env: IntegrationTestEnvironment) => {
    const task = await env.orchestrator.createTask({
      description: 'Basic integration test task',
      workflow: 'feature',
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');

    return { task };
  },

  /**
   * Multi-stage workflow execution
   */
  multiStageWorkflow: async (env: IntegrationTestEnvironment) => {
    // Ensure we have a multi-stage workflow
    const workflow = env.createWorkflow('multi-stage', {
      stages: [
        { name: 'planning', agent: 'planner', description: 'Plan' },
        { name: 'implementation', agent: 'developer', description: 'Implement' },
        { name: 'testing', agent: 'tester', description: 'Test' },
        { name: 'review', agent: 'reviewer', description: 'Review' },
      ],
    });

    const task = await env.orchestrator.createTask({
      description: 'Multi-stage workflow test',
      workflow: 'multi-stage',
    });

    return { task, workflow };
  },

  /**
   * Permission-protected tool usage
   */
  permissionProtectedTools: async (env: IntegrationTestEnvironment) => {
    // Set up strict permissions
    env.permissions.denyPermission('Bash', '*');
    env.permissions.grantPermission('Read', '/project/**', 'allow-always');

    const task = await env.orchestrator.createTask({
      description: 'Permission test task',
      workflow: 'feature',
    });

    return { task };
  },

  /**
   * Browser automation workflow
   */
  browserAutomation: async (env: IntegrationTestEnvironment) => {
    if (!env.browser) {
      throw new Error('Browser environment not enabled');
    }

    await env.browser.navigateTo('https://example.com');
    const screenshot = await env.browser.screenshot('browser-test');

    const task = await env.orchestrator.createTask({
      description: 'Browser automation test',
      workflow: 'feature',
    });

    return { task, screenshot };
  },

  /**
   * Error handling and recovery
   */
  errorHandlingAndRecovery: async (env: IntegrationTestEnvironment) => {
    // Mock tool failures
    env.tools.mockToolFailure('Read', new Error('Simulated read failure'));

    const task = await env.orchestrator.createTask({
      description: 'Error handling test',
      workflow: 'feature',
    });

    return { task };
  },

  /**
   * Concurrent task execution
   */
  concurrentTaskExecution: async (env: IntegrationTestEnvironment) => {
    const tasks = await Promise.all([
      env.orchestrator.createTask({ description: 'Concurrent task 1', workflow: 'feature' }),
      env.orchestrator.createTask({ description: 'Concurrent task 2', workflow: 'feature' }),
      env.orchestrator.createTask({ description: 'Concurrent task 3', workflow: 'feature' }),
    ]);

    return { tasks };
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function createAgentFileContent(name: string, definition: Partial<AgentDefinition>): string {
  const tools = definition.tools || ['Read', 'Write', 'Edit'];
  const model = definition.model || 'sonnet';
  const description = definition.description || `Test agent: ${name}`;

  return `---
name: ${name}
description: ${description}
tools:
${tools.map(tool => `  - ${tool}`).join('\n')}
model: ${model}
---

${definition.prompt || `You are the ${name} agent for testing.`}`;
}

function createWorkflowFileContent(name: string, definition: Partial<WorkflowDefinition>): string {
  const stages = definition.stages || [
    { name: 'implementation', agent: 'developer', description: 'Implement' },
  ];

  return `name: ${name}
description: ${definition.description || `Test workflow: ${name}`}
stages:
${stages.map(stage => `  - name: ${stage.name}
    agent: ${stage.agent}
    description: ${stage.description}`).join('\n')}`;
}

function setupClaudeAPIMocks() {
  // Mock Claude API calls to prevent actual API requests during testing
  vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
    ClaudeSDK: vi.fn().mockImplementation(() => ({
      query: vi.fn().mockResolvedValue({
        content: 'Mocked Claude response',
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    })),
  }));
}

async function setupFilesystemIsolation(testDir: string) {
  // Ensure test operations are contained within test directory
  process.chdir(testDir);
}

function setupEnvironmentIsolation() {
  // Save original environment
  const originalEnv = { ...process.env };

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.CI = 'true';

  // Restore on cleanup (this would be called by the cleanup function)
  return () => {
    process.env = originalEnv;
  };
}

// ============================================================================
// Integration Test Assertions
// ============================================================================

export const integrationAssertions = {
  /**
   * Assert task was created successfully
   */
  taskCreated: (task: Task) => {
    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');
    expect(task.createdAt).toBeInstanceOf(Date);
  },

  /**
   * Assert task progressed through expected stages
   */
  taskProgressedThroughStages: (events: any[], expectedStages: string[]) => {
    const stageEvents = events.filter(e => e.type === 'stage:started');
    const completedStages = stageEvents.map(e => e.data.stageName);

    expectedStages.forEach(stage => {
      expect(completedStages).toContain(stage);
    });
  },

  /**
   * Assert permissions were checked
   */
  permissionsChecked: (permissionEnv: PermissionTestEnvironment, tool: AgentTool) => {
    const history = permissionEnv.approvalSystem.getApprovalHistory();
    const wasChecked = history.some((req: any) => req.tool === tool);
    expect(wasChecked).toBe(true);
  },

  /**
   * Assert tools were called
   */
  toolsCalled: (toolRegistry: ToolMockRegistry, expectedTools: AgentTool[]) => {
    const callHistory = toolRegistry.getCallHistory();

    expectedTools.forEach(tool => {
      expect(callHistory[tool]?.length).toBeGreaterThan(0);
    });
  },

  /**
   * Assert event sequence occurred
   */
  eventSequence: (events: any[], expectedSequence: string[]) => {
    const eventTypes = events.map(e => e.type);
    let sequenceIndex = 0;

    for (const eventType of eventTypes) {
      if (eventType === expectedSequence[sequenceIndex]) {
        sequenceIndex++;
        if (sequenceIndex === expectedSequence.length) {
          break;
        }
      }
    }

    expect(sequenceIndex).toBe(expectedSequence.length);
  },
};

// Helper function to import expect for assertions
const expect = (global as any).expect;

// Export integration test helper
export default {
  createIntegrationTestEnvironment,
  integrationScenarios,
  integrationAssertions,
  createTestTask,
  createTestAgent,
  createTestWorkflow,
};