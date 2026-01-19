/**
 * Shared Test Utilities for v0.5.0 Integration Tests
 *
 * Provides common mocks, fixtures, and helper functions for testing
 * the integration between Tool System, Permissions, and Browser Automation.
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';

import { TaskStore, ToolActionStore } from '../../store';
import { PermissionManager } from '../../permission-manager';
import { PermissionStore } from '../../permission-store';
import { PolicyEnforcer } from '../../policy/policy-enforcer';
import { BrowserTool } from '../../tools/browser-tool';
import { PermissionPresetManager } from '../../permission-preset-manager';
import { AutonomyController } from '../../autonomy-controller';

import type {
  Task,
  PolicyConfig,
  PermissionLevel,
  ToolPermissionResult,
  PolicyViolation,
  ToolDefinition,
  TaskResourceLimits,
  PermissionPreset,
  ToolAction,
  BrowserSession,
  BrowserSessionConfig,
  MCPServerConfig,
} from '@apexcli/core';

// ============================================================================
// Test Configuration Factories
// ============================================================================

/**
 * Creates a test permission manager with optional preset
 */
export function createTestPermissionManager(presetName?: keyof typeof PermissionPreset): PermissionManager {
  const store = new PermissionStore();
  const manager = new PermissionManager(store);

  if (presetName) {
    const presetManager = new PermissionPresetManager(manager);
    presetManager.applyPreset(presetName);
  }

  return manager;
}

/**
 * Creates a test policy enforcer with configurable rules
 */
export function createTestPolicyEnforcer(config?: Partial<PolicyConfig>): PolicyEnforcer {
  const defaultConfig: PolicyConfig = {
    version: '1.0',
    enforcement: 'enforce',
    enabled: true,
    allowedPaths: {
      mode: 'allowlist',
      allow: ['src/**/*.{js,ts,tsx,jsx}', 'test/**/*.{js,ts}'],
      block: ['node_modules/**', '.git/**', 'dist/**'],
      sensitive: ['config/**', 'scripts/**'],
    },
    approvalRules: [
      {
        id: 'dangerous-operations',
        name: 'Dangerous Operations',
        description: 'Require approval for dangerous operations',
        urgency: 'high',
        condition: {
          type: 'tool-operation',
          tools: ['bash', 'evaluate'],
        },
        enabled: true,
      },
      {
        id: 'file-modifications',
        name: 'File Modifications',
        description: 'Require approval for sensitive file modifications',
        urgency: 'medium',
        condition: {
          type: 'file-pattern',
          pattern: '**/*.{json,yaml,config}',
          operation: 'write',
        },
        enabled: true,
      },
    ],
  };

  const mergedConfig = { ...defaultConfig, ...config };
  return new PolicyEnforcer(mergedConfig);
}

/**
 * Creates a test browser tool with permission manager integration
 */
export function createTestBrowserTool(permissionManager: PermissionManager): BrowserTool {
  return new BrowserTool({
    permissionManager,
    backend: 'playwright',
    engine: 'chromium',
    headless: true,
  });
}

/**
 * Creates a test tool action store
 */
export function createTestToolActionStore(taskStore: TaskStore): ToolActionStore {
  return new ToolActionStore(taskStore, {
    maxActionsPerTask: 100,
    maxAgeDays: 7,
    keepUndoneSnapshots: true,
    maxSnapshotStorageMB: 10,
  });
}

/**
 * Creates a test autonomy controller with configurable limits
 */
export function createTestAutonomyController(limits: Partial<TaskResourceLimits> = {}): AutonomyController {
  const defaultLimits: TaskResourceLimits = {
    budgetLimit: 10.0,
    tokenLimit: 50000,
    timeLimit: 3600000, // 1 hour
    changeLimit: { files: 10, lines: 500 },
    ...limits,
  };

  return new AutonomyController({
    enabled: true,
    limits: defaultLimits,
    warningThreshold: 0.8,
    approvalGates: ['budget', 'changes'],
  });
}

/**
 * Creates a comprehensive test task
 */
export function createTestTask(projectPath: string, overrides: Partial<Task> = {}): Task {
  return {
    id: `test-task-${randomUUID()}`,
    description: 'Integration test task for v0.5.0',
    workflow: 'feature',
    autonomy: 'supervised',
    status: 'running',
    priority: 'normal',
    projectPath,
    branchName: `test/integration-${Date.now()}`,
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 0.05,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  };
}

// ============================================================================
// Mock Implementations
// ============================================================================

/**
 * Mock browser session for testing without real browser automation
 */
export class MockBrowserSession implements BrowserSession {
  public isConnected = true;
  public url = 'about:blank';
  private responses = new Map<string, any>();
  private screenshots = new Map<string, Buffer>();

  constructor(private config: BrowserSessionConfig) {}

  /**
   * Configure mock responses for specific operations
   */
  setMockResponse(operation: string, response: any): void {
    this.responses.set(operation, response);
  }

  /**
   * Set mock screenshot data
   */
  setMockScreenshot(filename: string, imageData: Buffer): void {
    this.screenshots.set(filename, imageData);
  }

  async navigate(url: string): Promise<{ success: boolean; url: string; error?: string }> {
    if (url.includes('blocked.com')) {
      return { success: false, url, error: 'Domain blocked' };
    }

    this.url = url;
    return { success: true, url };
  }

  async click(selector: string): Promise<{ success: boolean; element?: string; error?: string }> {
    const response = this.responses.get(`click:${selector}`);
    return response || { success: true, element: selector };
  }

  async type(selector: string, text: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async screenshot(filename?: string): Promise<{ success: boolean; path?: string; error?: string }> {
    if (filename && this.screenshots.has(filename)) {
      return { success: true, path: `/tmp/screenshots/${filename}` };
    }
    return { success: true, path: `/tmp/screenshots/mock-${Date.now()}.png` };
  }

  async compareScreenshot(baseline: string, current?: string): Promise<{
    success: boolean;
    identical: boolean;
    difference?: number;
    diffPath?: string;
    error?: string;
  }> {
    return {
      success: true,
      identical: true,
      difference: 0,
    };
  }

  async evaluate(expression: string): Promise<{ success: boolean; result?: any; error?: string }> {
    if (expression.includes('throw')) {
      return { success: false, error: 'Script execution failed' };
    }
    return { success: true, result: 'mock evaluation result' };
  }

  async waitForSelector(selector: string, timeout?: number): Promise<{
    success: boolean;
    found: boolean;
    error?: string;
  }> {
    return { success: true, found: true };
  }

  async getAttribute(selector: string, attribute: string): Promise<{
    success: boolean;
    value?: string;
    error?: string;
  }> {
    return { success: true, value: `mock-${attribute}` };
  }

  async getText(selector: string): Promise<{ success: boolean; text?: string; error?: string }> {
    return { success: true, text: 'Mock element text' };
  }

  async getHtml(selector?: string): Promise<{ success: boolean; html?: string; error?: string }> {
    return { success: true, html: '<html><body>Mock HTML</body></html>' };
  }

  async scroll(x: number, y: number): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async hover(selector: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async submit(selector: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async close(): Promise<void> {
    this.isConnected = false;
  }
}

/**
 * Mock MCP server for tool discovery tests
 */
export class MockMCPServer extends EventEmitter {
  public isRunning = false;
  public tools: ToolDefinition[] = [];

  constructor(tools: ToolDefinition[] = []) {
    super();
    this.tools = tools;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.emit('server:started');

    // Emit tool discovery after a brief delay
    setTimeout(() => {
      this.tools.forEach(tool => {
        this.emit('tool:discovered', tool);
      });
    }, 10);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.emit('server:stopped');
  }

  async discoverTools(): Promise<ToolDefinition[]> {
    return this.tools;
  }

  async executeTool(toolName: string, params: any): Promise<any> {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Mock execution
    return {
      success: true,
      result: `Mock execution of ${toolName} with params: ${JSON.stringify(params)}`,
    };
  }
}

/**
 * Creates default test MCP tools
 */
export function createTestMCPTools(): ToolDefinition[] {
  return [
    {
      name: 'test-file-reader',
      description: 'Read files from filesystem',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
        },
        required: ['path'],
      },
      category: 'file',
      permissions: ['read'],
    },
    {
      name: 'test-api-client',
      description: 'Make HTTP API calls',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'API endpoint URL' },
          method: { type: 'string', description: 'HTTP method' },
        },
        required: ['url'],
      },
      category: 'network',
      permissions: ['network'],
    },
  ];
}

// ============================================================================
// Test Assertion Helpers
// ============================================================================

/**
 * Assert that permission was granted
 */
export function expectPermissionGranted(result: ToolPermissionResult): void {
  if (!result.granted) {
    throw new Error(`Expected permission to be granted, but was denied: ${result.reason}`);
  }
}

/**
 * Assert that permission was denied
 */
export function expectPermissionDenied(result: ToolPermissionResult): void {
  if (result.granted) {
    throw new Error('Expected permission to be denied, but was granted');
  }
}

/**
 * Assert that policy violation occurred with specific pattern
 */
export function expectPolicyViolation(
  violations: PolicyViolation[],
  expectedPattern: string | RegExp
): void {
  const pattern = typeof expectedPattern === 'string'
    ? new RegExp(expectedPattern, 'i')
    : expectedPattern;

  const matchingViolation = violations.find(v =>
    pattern.test(v.resource) || pattern.test(v.message || '')
  );

  if (!matchingViolation) {
    throw new Error(
      `Expected policy violation matching "${pattern}", but found: ${violations.map(v => v.resource).join(', ')}`
    );
  }
}

/**
 * Assert that tool action is undoable
 */
export function expectToolActionUndoable(action: ToolAction): void {
  if (!action.canUndo) {
    throw new Error('Expected tool action to be undoable, but canUndo is false');
  }

  if (!action.beforeSnapshots || action.beforeSnapshots.length === 0) {
    throw new Error('Expected tool action to have before snapshots for undo');
  }
}

/**
 * Assert that tool action is not undoable
 */
export function expectToolActionNotUndoable(action: ToolAction): void {
  if (action.canUndo) {
    throw new Error('Expected tool action to not be undoable, but canUndo is true');
  }
}

// ============================================================================
// Test Environment Setup
// ============================================================================

/**
 * Creates a complete test environment with temporary directory
 */
export async function createTestEnvironment(): Promise<{
  testDir: string;
  taskStore: TaskStore;
  permissionManager: PermissionManager;
  policyEnforcer: PolicyEnforcer;
  browserTool: BrowserTool;
  toolActionStore: ToolActionStore;
  autonomyController: AutonomyController;
  cleanup: () => Promise<void>;
}> {
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-v050-integration-'));

  // Initialize core components
  const taskStore = new TaskStore(testDir);
  await taskStore.initialize();

  const permissionManager = createTestPermissionManager();
  const policyEnforcer = createTestPolicyEnforcer();
  const browserTool = createTestBrowserTool(permissionManager);
  const toolActionStore = createTestToolActionStore(taskStore);
  const autonomyController = createTestAutonomyController();

  // Create basic project structure
  await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'test'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'screenshots'), { recursive: true });

  const cleanup = async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  };

  return {
    testDir,
    taskStore,
    permissionManager,
    policyEnforcer,
    browserTool,
    toolActionStore,
    autonomyController,
    cleanup,
  };
}

/**
 * Creates sample files for testing
 */
export async function createTestFiles(testDir: string): Promise<{
  sourceFile: string;
  testFile: string;
  configFile: string;
}> {
  const sourceFile = path.join(testDir, 'src', 'example.ts');
  const testFile = path.join(testDir, 'test', 'example.test.ts');
  const configFile = path.join(testDir, 'src', 'config.json');

  await fs.writeFile(sourceFile, `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export const unused = 'variable'; // This should trigger linting
`.trim(), 'utf8');

  await fs.writeFile(testFile, `
import { greet } from '../src/example';

test('greet function', () => {
  expect(greet('World')).toBe('Hello, World!');
});
`.trim(), 'utf8');

  await fs.writeFile(configFile, JSON.stringify({
    version: '1.0.0',
    name: 'test-project',
    features: ['browser-automation', 'permissions']
  }, null, 2), 'utf8');

  return { sourceFile, testFile, configFile };
}

// ============================================================================
// Enhanced Test Utilities for Combined System Integration (ADR-051)
// ============================================================================

/**
 * Multi-system workflow builder for complex integration testing
 */
export class IntegrationWorkflowBuilder {
  private steps: WorkflowStep[] = [];

  addBrowserStep(operation: BrowserOperation): this {
    this.steps.push({
      type: 'browser',
      operation,
      system: 'browser',
    });
    return this;
  }

  addFileStep(operation: FileOperation): this {
    this.steps.push({
      type: 'file',
      operation,
      system: 'tool',
    });
    return this;
  }

  addMCPStep(operation: MCPOperation): this {
    this.steps.push({
      type: 'mcp',
      operation,
      system: 'tool',
    });
    return this;
  }

  addPermissionGate(permission: PermissionConfig): this {
    this.steps.push({
      type: 'permission',
      operation: permission,
      system: 'permission',
    });
    return this;
  }

  async execute(testEnv: TestEnvironment): Promise<WorkflowResult> {
    const results: StepResult[] = [];
    let success = true;
    let errorStep: number | null = null;

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      try {
        const result = await this.executeStep(step, testEnv);
        results.push(result);

        if (!result.success) {
          success = false;
          errorStep = i;
          break;
        }
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stepIndex: i,
        });
        success = false;
        errorStep = i;
        break;
      }
    }

    return {
      success,
      errorStep,
      results,
      completedSteps: results.length,
      totalSteps: this.steps.length,
    };
  }

  private async executeStep(step: WorkflowStep, testEnv: TestEnvironment): Promise<StepResult> {
    switch (step.type) {
      case 'browser':
        return this.executeBrowserStep(step.operation as BrowserOperation, testEnv);
      case 'file':
        return this.executeFileStep(step.operation as FileOperation, testEnv);
      case 'mcp':
        return this.executeMCPStep(step.operation as MCPOperation, testEnv);
      case 'permission':
        return this.executePermissionStep(step.operation as PermissionConfig, testEnv);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async executeBrowserStep(
    operation: BrowserOperation,
    testEnv: TestEnvironment
  ): Promise<StepResult> {
    const session = await testEnv.browserTool.createSession({
      taskId: 'test-task',
      url: operation.url,
    });

    let result;
    switch (operation.action) {
      case 'navigate':
        result = await session.navigate(operation.url);
        break;
      case 'click':
        result = await session.click(operation.selector!);
        break;
      case 'getText':
        result = await session.getText(operation.selector!);
        break;
      case 'screenshot':
        result = await session.screenshot(operation.filename);
        break;
      default:
        throw new Error(`Unknown browser action: ${operation.action}`);
    }

    return {
      success: result.success,
      data: result,
      stepIndex: 0, // Will be set by execute method
    };
  }

  private async executeFileStep(
    operation: FileOperation,
    testEnv: TestEnvironment
  ): Promise<StepResult> {
    switch (operation.action) {
      case 'read':
        const content = await fs.readFile(operation.path, 'utf8');
        return { success: true, data: { content }, stepIndex: 0 };
      case 'write':
        await fs.writeFile(operation.path, operation.content!, 'utf8');
        return { success: true, data: { path: operation.path }, stepIndex: 0 };
      default:
        throw new Error(`Unknown file action: ${operation.action}`);
    }
  }

  private async executeMCPStep(
    operation: MCPOperation,
    testEnv: TestEnvironment
  ): Promise<StepResult> {
    // Mock MCP execution for testing
    return {
      success: true,
      data: { tool: operation.tool, result: 'mock-mcp-result' },
      stepIndex: 0,
    };
  }

  private async executePermissionStep(
    permission: PermissionConfig,
    testEnv: TestEnvironment
  ): Promise<StepResult> {
    await testEnv.permissionManager.grantPermission(
      permission.tool,
      permission.level,
      permission.scope
    );

    return { success: true, data: { granted: true }, stepIndex: 0 };
  }

  async verify(expectations: WorkflowExpectations): Promise<void> {
    // Verification logic would be implemented here
    // For now, this is a placeholder for the interface
  }
}

/**
 * Cross-system event tracker for integration testing
 */
export class IntegrationEventTracker {
  private events = new Map<string, IntegrationEvent[]>();

  trackPermission(event: TestPermissionEvent): void {
    this.addEvent('permission', {
      type: event.type,
      system: 'permission',
      timestamp: Date.now(),
      data: event,
    });
  }

  trackPolicy(event: TestPolicyEvent): void {
    this.addEvent('policy', {
      type: event.type,
      system: 'policy',
      timestamp: Date.now(),
      data: event,
    });
  }

  trackToolAction(event: any): void {
    this.addEvent('tool', {
      type: event.type,
      system: 'tool',
      timestamp: Date.now(),
      data: event,
    });
  }

  trackBrowser(event: TestBrowserEvent): void {
    this.addEvent('browser', {
      type: event.type,
      system: 'browser',
      timestamp: Date.now(),
      data: event,
    });
  }

  private addEvent(category: string, event: IntegrationEvent): void {
    if (!this.events.has(category)) {
      this.events.set(category, []);
    }
    this.events.get(category)!.push(event);
  }

  getTimeline(): TimelineEvent[] {
    const allEvents: TimelineEvent[] = [];

    for (const [category, events] of this.events) {
      for (const event of events) {
        allEvents.push({
          ...event,
          category,
        });
      }
    }

    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  verifyEventOrder(expected: string[]): void {
    const timeline = this.getTimeline();
    const actualOrder = timeline.map(e => e.type);

    for (let i = 0; i < expected.length; i++) {
      if (actualOrder[i] !== expected[i]) {
        throw new Error(
          `Event order mismatch at position ${i}: expected ${expected[i]}, got ${actualOrder[i]}`
        );
      }
    }
  }

  verifyEventContent(matcher: EventMatcher): void {
    const timeline = this.getTimeline();
    const matchingEvents = timeline.filter(event => {
      return matcher.type ? event.type === matcher.type : true &&
             matcher.system ? event.system === matcher.system : true;
    });

    if (matchingEvents.length === 0) {
      throw new Error(`No events found matching: ${JSON.stringify(matcher)}`);
    }

    if (matcher.count !== undefined && matchingEvents.length !== matcher.count) {
      throw new Error(
        `Expected ${matcher.count} matching events, found ${matchingEvents.length}`
      );
    }
  }

  clear(): void {
    this.events.clear();
  }
}

// ============================================================================
// Type Definitions for Enhanced Utilities
// ============================================================================

interface WorkflowStep {
  type: 'browser' | 'file' | 'mcp' | 'permission';
  operation: BrowserOperation | FileOperation | MCPOperation | PermissionConfig;
  system: 'browser' | 'tool' | 'permission' | 'policy';
}

interface BrowserOperation {
  action: 'navigate' | 'click' | 'getText' | 'screenshot';
  url: string;
  selector?: string;
  filename?: string;
}

interface FileOperation {
  action: 'read' | 'write';
  path: string;
  content?: string;
}

interface MCPOperation {
  tool: string;
  parameters: any;
}

interface PermissionConfig {
  tool: string;
  level: PermissionLevel;
  scope?: string;
}

interface StepResult {
  success: boolean;
  data?: any;
  error?: string;
  stepIndex: number;
}

interface WorkflowResult {
  success: boolean;
  errorStep: number | null;
  results: StepResult[];
  completedSteps: number;
  totalSteps: number;
}

interface WorkflowExpectations {
  successfulSteps?: number;
  failureStep?: number;
  expectedResults?: any[];
}

interface IntegrationEvent {
  type: string;
  system: 'permission' | 'browser' | 'tool' | 'policy';
  timestamp: number;
  data: any;
}

interface TimelineEvent extends IntegrationEvent {
  category: string;
}

interface EventMatcher {
  type?: string;
  system?: 'permission' | 'browser' | 'tool' | 'policy';
  count?: number;
}

interface TestEnvironment {
  testDir: string;
  taskStore: TaskStore;
  permissionManager: PermissionManager;
  policyEnforcer: PolicyEnforcer;
  browserTool: BrowserTool;
  toolActionStore: ToolActionStore;
  autonomyController: AutonomyController;
  cleanup: () => Promise<void>;
}

// Event type definitions for integration testing
interface TestPermissionEvent {
  type: string;
  tool?: string;
  scope?: string;
  level?: PermissionLevel;
}

interface TestPolicyEvent {
  type: string;
  resource?: string;
  violation?: PolicyViolation;
}

interface TestBrowserEvent {
  type: string;
  url?: string;
  action?: string;
}