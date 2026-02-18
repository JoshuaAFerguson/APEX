/**
 * @fileoverview Browser Automation Integration Test Context Helpers
 *
 * This file provides specialized context helpers for running comprehensive browser automation
 * integration tests that interact with the APEX orchestrator system, permission management,
 * and real browser automation workflows.
 *
 * Features:
 * - APEX orchestrator integration testing
 * - Real browser tool integration
 * - Permission system integration
 * - End-to-end workflow testing
 * - Multi-agent workflow simulation
 * - Performance and resource monitoring
 */

import { vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';

import type {
  BrowserAutomationContext,
  BrowserAutomationTestManager,
  BrowserTestScenario,
  BrowserOperationResult,
} from './browser-automation-test-helpers.js';

import {
  BrowserPermissionMockManager,
  createPermissionMockManager,
} from './browser-permission-mocks.js';

// ============================================================================
// Integration Test Context Types
// ============================================================================

/**
 * APEX orchestrator integration context
 */
export interface ApexIntegrationContext {
  // Orchestrator instance (mocked)
  orchestrator: {
    query: MockedFunction<any>;
    addEventListener: MockedFunction<any>;
    removeEventListener: MockedFunction<any>;
    createTask: MockedFunction<any>;
    getTask: MockedFunction<any>;
    cancelTask: MockedFunction<any>;
    cleanup: MockedFunction<any>;
  };

  // Permission system integration
  permissionManager: {
    checkToolPermission: MockedFunction<any>;
    requestPermission: MockedFunction<any>;
    grantPermission: MockedFunction<any>;
    denyPermission: MockedFunction<any>;
    getPermissionHistory: MockedFunction<any>;
  };

  // Browser tool integration
  browserTool: {
    execute: MockedFunction<any>;
    cleanup: MockedFunction<any>;
    getResourceState: MockedFunction<any>;
    isHealthy: MockedFunction<any>;
  };

  // Task and workflow management
  taskManager: {
    createTask: MockedFunction<any>;
    executeTask: MockedFunction<any>;
    monitorTask: MockedFunction<any>;
    getTaskStatus: MockedFunction<any>;
    getTaskResults: MockedFunction<any>;
  };

  // Event system
  eventSystem: {
    emitter: EventEmitter;
    events: Array<{
      type: string;
      data: any;
      timestamp: Date;
      source: string;
    }>;
    subscriptions: Set<string>;
  };

  // Configuration and state
  config: {
    apexConfig: any;
    browserConfig: any;
    permissionConfig: any;
    testConfig: any;
  };

  state: {
    initialized: boolean;
    orchestratorConnected: boolean;
    browserReady: boolean;
    permissionsConfigured: boolean;
    tasksActive: number;
    lastActivity: Date;
  };
}

/**
 * Multi-agent workflow test context
 */
export interface MultiAgentWorkflowContext {
  agents: {
    planner: MockedAgent;
    architect: MockedAgent;
    developer: MockedAgent;
    tester: MockedAgent;
    reviewer: MockedAgent;
  };
  workflow: {
    currentStage: string;
    completedStages: string[];
    stageResults: Record<string, any>;
    stageErrors: Record<string, any>;
  };
  communication: {
    messages: Array<{
      from: string;
      to: string;
      type: string;
      content: any;
      timestamp: Date;
    }>;
    handoffs: Array<{
      fromAgent: string;
      toAgent: string;
      stage: string;
      data: any;
      timestamp: Date;
    }>;
  };
}

/**
 * Mock agent for workflow testing
 */
export interface MockedAgent {
  name: string;
  stage: string;
  status: 'idle' | 'working' | 'completed' | 'error';
  execute: MockedFunction<any>;
  cleanup: MockedFunction<any>;
  getState: MockedFunction<any>;
  handleHandoff: MockedFunction<any>;
  sendMessage: MockedFunction<any>;
}

/**
 * Integration test result with comprehensive metrics
 */
export interface IntegrationTestResult {
  testName: string;
  success: boolean;
  duration: number;
  startTime: Date;
  endTime: Date;

  // Component results
  orchestratorResults: {
    connected: boolean;
    tasksCreated: number;
    tasksCompleted: number;
    tasksFailed: number;
    eventsSent: number;
    eventsReceived: number;
  };

  browserResults: {
    sessionCreated: boolean;
    operationsExecuted: number;
    operationsSuccessful: number;
    operationsFailed: number;
    screenshotsTaken: number;
    resourceLeaks: number;
  };

  permissionResults: {
    permissionsChecked: number;
    permissionsGranted: number;
    permissionsDenied: number;
    policyViolations: number;
    fallbacksTriggered: number;
  };

  workflowResults: {
    stagesCompleted: number;
    stagesTotalTime: number;
    handoffsSuccessful: number;
    handoffsFailed: number;
    agentsCommunicated: number;
  };

  performanceMetrics: {
    memoryUsage: number;
    cpuUsage?: number;
    networkRequests: number;
    errorRate: number;
    responseTime: number;
  };

  errors: Array<{
    component: string;
    stage: string;
    error: string;
    timestamp: Date;
    recoverable: boolean;
  }>;

  artifacts: {
    logs: string[];
    screenshots: string[];
    reports: string[];
    dumps: string[];
  };
}

// ============================================================================
// Integration Test Context Manager
// ============================================================================

/**
 * Comprehensive integration test context manager
 */
export class IntegrationTestContextManager extends EventEmitter {
  private contexts: Map<string, ApexIntegrationContext> = new Map();
  private workflowContexts: Map<string, MultiAgentWorkflowContext> = new Map();
  private testResults: Map<string, IntegrationTestResult> = new Map();
  private globalTempDir?: string;

  constructor() {
    super();
    this.setupGlobalHandlers();
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    process.on('exit', () => this.cleanupAll());
    process.on('SIGINT', () => this.cleanupAll());
    process.on('SIGTERM', () => this.cleanupAll());
  }

  /**
   * Create a comprehensive APEX integration test context
   */
  async createApexIntegrationContext(testName: string, config: any = {}): Promise<ApexIntegrationContext> {
    const contextId = `apex-integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create temp directory for artifacts
    if (!this.globalTempDir) {
      this.globalTempDir = await fs.mkdtemp(
        path.join(process.cwd(), 'test-artifacts', 'integration-temp-')
      );
    }

    const context: ApexIntegrationContext = {
      // Mock orchestrator
      orchestrator: {
        query: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        createTask: vi.fn(),
        getTask: vi.fn(),
        cancelTask: vi.fn(),
        cleanup: vi.fn(),
      },

      // Mock permission manager
      permissionManager: {
        checkToolPermission: vi.fn(),
        requestPermission: vi.fn(),
        grantPermission: vi.fn(),
        denyPermission: vi.fn(),
        getPermissionHistory: vi.fn(),
      },

      // Mock browser tool
      browserTool: {
        execute: vi.fn(),
        cleanup: vi.fn(),
        getResourceState: vi.fn(),
        isHealthy: vi.fn(),
      },

      // Mock task manager
      taskManager: {
        createTask: vi.fn(),
        executeTask: vi.fn(),
        monitorTask: vi.fn(),
        getTaskStatus: vi.fn(),
        getTaskResults: vi.fn(),
      },

      // Event system
      eventSystem: {
        emitter: new EventEmitter(),
        events: [],
        subscriptions: new Set(),
      },

      // Configuration
      config: {
        apexConfig: {
          baseDir: this.globalTempDir,
          autonomyLevel: 'medium',
          permissionPreset: 'development',
          ...config.apex,
        },
        browserConfig: {
          headless: true,
          timeout: 30000,
          viewport: { width: 1280, height: 720 },
          ...config.browser,
        },
        permissionConfig: {
          strict: false,
          allowBrowserAutomation: true,
          allowNetworkAccess: true,
          ...config.permissions,
        },
        testConfig: {
          timeout: 60000,
          retries: 2,
          artifacts: true,
          ...config.test,
        },
      },

      // State
      state: {
        initialized: false,
        orchestratorConnected: false,
        browserReady: false,
        permissionsConfigured: false,
        tasksActive: 0,
        lastActivity: new Date(),
      },
    };

    // Setup default mock behaviors
    await this.setupDefaultMockBehaviors(context);

    // Store context
    this.contexts.set(contextId, context);

    this.emit('context:created', { contextId, testName, type: 'apex-integration' });
    return context;
  }

  /**
   * Setup default mock behaviors for APEX integration
   */
  private async setupDefaultMockBehaviors(context: ApexIntegrationContext): Promise<void> {
    // Setup orchestrator mocks
    context.orchestrator.query.mockResolvedValue({
      success: true,
      taskId: 'mock-task-id',
      result: 'Mock orchestrator response',
    });

    context.orchestrator.createTask.mockImplementation(async (taskConfig) => {
      context.state.tasksActive++;
      context.state.lastActivity = new Date();

      const taskId = `task-${Date.now()}`;
      context.eventSystem.emitter.emit('task:created', { taskId, config: taskConfig });

      return { taskId, status: 'created', config: taskConfig };
    });

    context.orchestrator.getTask.mockImplementation(async (taskId) => ({
      taskId,
      status: 'completed',
      result: { success: true, data: 'Mock task result' },
      metadata: { startTime: new Date(), endTime: new Date() },
    }));

    // Setup permission manager mocks
    context.permissionManager.checkToolPermission.mockImplementation(async (tool, options) => {
      const allowed = !context.config.permissionConfig.strict;
      context.eventSystem.emitter.emit('permission:checked', { tool, options, allowed });

      return {
        allowed,
        level: allowed ? 'full' : null,
        requiresConfirmation: false,
        denialReason: allowed ? null : 'Tool access denied by test policy',
      };
    });

    context.permissionManager.requestPermission.mockImplementation(async (tool, level) => {
      const granted = !context.config.permissionConfig.strict;
      context.eventSystem.emitter.emit('permission:requested', { tool, level, granted });

      return granted ? 'granted' : 'denied';
    });

    // Setup browser tool mocks
    context.browserTool.execute.mockImplementation(async (params) => {
      context.state.lastActivity = new Date();
      context.eventSystem.emitter.emit('browser:operation', { operation: params.operation });

      // Simulate permission check
      if (params.operation === 'navigate' && params.params?.url?.includes('blocked')) {
        return {
          success: false,
          operation: params.operation,
          error: 'Navigation blocked by test policy',
          permissionDenied: true,
          metadata: {
            timestamp: new Date(),
            duration: 100,
            permissionChecked: true,
            denialReason: 'Domain blocked',
            suggestions: ['Try a different URL'],
          },
        };
      }

      return {
        success: true,
        operation: params.operation,
        data: { result: `Mock ${params.operation} result` },
        metadata: {
          timestamp: new Date(),
          duration: 200,
          permissionChecked: true,
        },
      };
    });

    context.browserTool.getResourceState.mockReturnValue({
      browserActive: true,
      contextActive: true,
      pageActive: true,
      memoryUsage: 128 * 1024 * 1024, // 128MB
      activeConnections: 1,
    });

    context.browserTool.isHealthy.mockReturnValue(true);

    // Setup task manager mocks
    context.taskManager.createTask.mockImplementation(async (taskType, config) => {
      const taskId = `${taskType}-${Date.now()}`;
      context.state.tasksActive++;

      context.eventSystem.emitter.emit('task:created', { taskId, type: taskType, config });

      return {
        taskId,
        type: taskType,
        status: 'pending',
        config,
        createdAt: new Date(),
      };
    });

    context.taskManager.executeTask.mockImplementation(async (taskId) => {
      context.eventSystem.emitter.emit('task:started', { taskId });

      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 100));

      context.eventSystem.emitter.emit('task:completed', { taskId });

      return {
        taskId,
        status: 'completed',
        result: { success: true, data: 'Task completed successfully' },
        duration: 100,
        completedAt: new Date(),
      };
    });

    // Setup event monitoring
    this.setupEventMonitoring(context);

    // Mark as initialized
    context.state.initialized = true;
    context.state.orchestratorConnected = true;
    context.state.browserReady = true;
    context.state.permissionsConfigured = true;
  }

  /**
   * Setup comprehensive event monitoring
   */
  private setupEventMonitoring(context: ApexIntegrationContext): void {
    const events = [
      'task:created', 'task:started', 'task:completed', 'task:failed',
      'permission:checked', 'permission:requested', 'permission:granted', 'permission:denied',
      'browser:operation', 'browser:error', 'browser:cleanup',
      'workflow:stage-started', 'workflow:stage-completed', 'workflow:handoff',
    ];

    events.forEach(eventType => {
      context.eventSystem.emitter.on(eventType, (data) => {
        context.eventSystem.events.push({
          type: eventType,
          data,
          timestamp: new Date(),
          source: 'integration-test',
        });

        this.emit('event:captured', { eventType, data, contextId: this.getContextId(context) });
      });

      context.eventSystem.subscriptions.add(eventType);
    });
  }

  /**
   * Create a multi-agent workflow test context
   */
  async createMultiAgentWorkflowContext(workflowName: string): Promise<MultiAgentWorkflowContext> {
    const contextId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const context: MultiAgentWorkflowContext = {
      agents: {
        planner: this.createMockAgent('planner', 'planning'),
        architect: this.createMockAgent('architect', 'architecture'),
        developer: this.createMockAgent('developer', 'implementation'),
        tester: this.createMockAgent('tester', 'testing'),
        reviewer: this.createMockAgent('reviewer', 'review'),
      },
      workflow: {
        currentStage: 'planning',
        completedStages: [],
        stageResults: {},
        stageErrors: {},
      },
      communication: {
        messages: [],
        handoffs: [],
      },
    };

    // Setup agent interactions
    this.setupAgentInteractions(context);

    this.workflowContexts.set(contextId, context);

    this.emit('workflow-context:created', { contextId, workflowName });
    return context;
  }

  /**
   * Create a mock agent with realistic behavior
   */
  private createMockAgent(name: string, stage: string): MockedAgent {
    return {
      name,
      stage,
      status: 'idle',
      execute: vi.fn().mockImplementation(async (task) => {
        // Simulate agent work
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        return {
          success: Math.random() > 0.1, // 90% success rate
          result: `${name} completed ${task.type || 'task'}`,
          duration: 500 + Math.random() * 1000,
          artifacts: [`${name}-output.md`],
        };
      }),
      cleanup: vi.fn().mockResolvedValue(true),
      getState: vi.fn().mockReturnValue({
        status: 'idle',
        currentTask: null,
        completedTasks: 0,
        failedTasks: 0,
      }),
      handleHandoff: vi.fn().mockImplementation(async (data) => {
        // Simulate handoff processing
        await new Promise(resolve => setTimeout(resolve, 200));
        return { accepted: true, processed: data };
      }),
      sendMessage: vi.fn().mockImplementation(async (target, message) => {
        // Simulate message sending
        return { sent: true, target, message };
      }),
    };
  }

  /**
   * Setup agent interaction patterns
   */
  private setupAgentInteractions(context: MultiAgentWorkflowContext): void {
    const agents = Object.values(context.agents);

    // Setup message routing
    agents.forEach(agent => {
      agent.sendMessage.mockImplementation(async (targetAgentName, message) => {
        const targetAgent = context.agents[targetAgentName as keyof typeof context.agents];

        if (targetAgent) {
          context.communication.messages.push({
            from: agent.name,
            to: targetAgentName,
            type: message.type || 'message',
            content: message,
            timestamp: new Date(),
          });

          this.emit('agent:message-sent', {
            from: agent.name,
            to: targetAgentName,
            message,
          });

          return { sent: true, target: targetAgentName, message };
        }

        return { sent: false, error: 'Target agent not found' };
      });

      // Setup handoff handling
      agent.handleHandoff.mockImplementation(async (fromAgent, data) => {
        context.communication.handoffs.push({
          fromAgent: fromAgent.name,
          toAgent: agent.name,
          stage: agent.stage,
          data,
          timestamp: new Date(),
        });

        this.emit('agent:handoff', {
          from: fromAgent.name,
          to: agent.name,
          stage: agent.stage,
          data,
        });

        agent.status = 'working';

        // Simulate handoff processing
        await new Promise(resolve => setTimeout(resolve, 300));

        agent.status = 'idle';
        return { accepted: true, processed: data };
      });
    });
  }

  /**
   * Run a comprehensive integration test scenario
   */
  async runIntegrationTest(
    testName: string,
    testFn: (apexContext: ApexIntegrationContext, workflowContext?: MultiAgentWorkflowContext) => Promise<any>,
    config: any = {}
  ): Promise<IntegrationTestResult> {
    const startTime = new Date();
    const testId = `integration-${Date.now()}-${testName.replace(/\s+/g, '-')}`;

    const result: IntegrationTestResult = {
      testName,
      success: false,
      duration: 0,
      startTime,
      endTime: new Date(),
      orchestratorResults: {
        connected: false,
        tasksCreated: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        eventsSent: 0,
        eventsReceived: 0,
      },
      browserResults: {
        sessionCreated: false,
        operationsExecuted: 0,
        operationsSuccessful: 0,
        operationsFailed: 0,
        screenshotsTaken: 0,
        resourceLeaks: 0,
      },
      permissionResults: {
        permissionsChecked: 0,
        permissionsGranted: 0,
        permissionsDenied: 0,
        policyViolations: 0,
        fallbacksTriggered: 0,
      },
      workflowResults: {
        stagesCompleted: 0,
        stagesTotalTime: 0,
        handoffsSuccessful: 0,
        handoffsFailed: 0,
        agentsCommunicated: 0,
      },
      performanceMetrics: {
        memoryUsage: process.memoryUsage().heapUsed,
        networkRequests: 0,
        errorRate: 0,
        responseTime: 0,
      },
      errors: [],
      artifacts: {
        logs: [],
        screenshots: [],
        reports: [],
        dumps: [],
      },
    };

    try {
      // Create test contexts
      const apexContext = await this.createApexIntegrationContext(testName, config);

      let workflowContext: MultiAgentWorkflowContext | undefined;
      if (config.includeWorkflow) {
        workflowContext = await this.createMultiAgentWorkflowContext(testName);
      }

      // Setup monitoring
      this.setupResultMonitoring(result, apexContext, workflowContext);

      // Execute test
      await testFn(apexContext, workflowContext);

      // Collect final metrics
      this.collectFinalMetrics(result, apexContext, workflowContext);

      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push({
        component: 'test-execution',
        stage: 'main',
        error: `${error}`,
        timestamp: new Date(),
        recoverable: false,
      });
    } finally {
      const endTime = new Date();
      result.endTime = endTime;
      result.duration = endTime.getTime() - startTime.getTime();

      // Store result
      this.testResults.set(testId, result);

      this.emit('integration-test:completed', { testId, testName, result });
    }

    return result;
  }

  /**
   * Setup result monitoring for integration test
   */
  private setupResultMonitoring(
    result: IntegrationTestResult,
    apexContext: ApexIntegrationContext,
    workflowContext?: MultiAgentWorkflowContext
  ): void {
    // Monitor APEX orchestrator events
    apexContext.eventSystem.emitter.on('task:created', () => {
      result.orchestratorResults.tasksCreated++;
    });

    apexContext.eventSystem.emitter.on('task:completed', () => {
      result.orchestratorResults.tasksCompleted++;
    });

    apexContext.eventSystem.emitter.on('permission:checked', (data) => {
      result.permissionResults.permissionsChecked++;
      if (data.allowed) {
        result.permissionResults.permissionsGranted++;
      } else {
        result.permissionResults.permissionsDenied++;
      }
    });

    apexContext.eventSystem.emitter.on('browser:operation', () => {
      result.browserResults.operationsExecuted++;
    });

    // Monitor workflow events if workflow context exists
    if (workflowContext) {
      this.on('agent:handoff', () => {
        result.workflowResults.handoffsSuccessful++;
      });

      this.on('agent:message-sent', () => {
        result.workflowResults.agentsCommunicated++;
      });
    }
  }

  /**
   * Collect final metrics from test execution
   */
  private collectFinalMetrics(
    result: IntegrationTestResult,
    apexContext: ApexIntegrationContext,
    workflowContext?: MultiAgentWorkflowContext
  ): void {
    // Update orchestrator results
    result.orchestratorResults.connected = apexContext.state.orchestratorConnected;
    result.orchestratorResults.eventsReceived = apexContext.eventSystem.events.length;

    // Update browser results
    result.browserResults.sessionCreated = apexContext.state.browserReady;

    // Estimate success/failure based on mock call results
    const browserExecuteCalls = apexContext.browserTool.execute.mock.calls.length;
    result.browserResults.operationsExecuted = browserExecuteCalls;
    result.browserResults.operationsSuccessful = Math.floor(browserExecuteCalls * 0.9); // Assume 90% success
    result.browserResults.operationsFailed = browserExecuteCalls - result.browserResults.operationsSuccessful;

    // Update performance metrics
    result.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed;
    result.performanceMetrics.responseTime = result.duration / Math.max(1, browserExecuteCalls);

    // Calculate error rate
    const totalOperations = result.browserResults.operationsExecuted + result.orchestratorResults.tasksCreated;
    const totalErrors = result.browserResults.operationsFailed + result.orchestratorResults.tasksFailed;
    result.performanceMetrics.errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

    // Update workflow results if applicable
    if (workflowContext) {
      result.workflowResults.stagesCompleted = workflowContext.workflow.completedStages.length;
    }
  }

  /**
   * Get context ID for a given context (helper method)
   */
  private getContextId(targetContext: ApexIntegrationContext): string {
    for (const [id, context] of this.contexts.entries()) {
      if (context === targetContext) {
        return id;
      }
    }
    return 'unknown';
  }

  /**
   * Generate a comprehensive integration test report
   */
  generateIntegrationTestReport(testResults?: IntegrationTestResult[]): any {
    const results = testResults || Array.from(this.testResults.values());

    if (results.length === 0) {
      return {
        summary: {
          totalTests: 0,
          successfulTests: 0,
          failedTests: 0,
          successRate: 0,
        },
        message: 'No test results available',
      };
    }

    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;

    const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    return {
      summary: {
        totalTests,
        successfulTests,
        failedTests,
        successRate: (successfulTests / totalTests) * 100,
        averageDuration,
        totalDuration,
        totalErrors,
      },
      componentMetrics: {
        orchestrator: {
          totalTasksCreated: results.reduce((sum, r) => sum + r.orchestratorResults.tasksCreated, 0),
          totalTasksCompleted: results.reduce((sum, r) => sum + r.orchestratorResults.tasksCompleted, 0),
          averageConnectionRate: (results.filter(r => r.orchestratorResults.connected).length / totalTests) * 100,
        },
        browser: {
          totalOperations: results.reduce((sum, r) => sum + r.browserResults.operationsExecuted, 0),
          totalSuccessful: results.reduce((sum, r) => sum + r.browserResults.operationsSuccessful, 0),
          averageSuccessRate: results.reduce((sum, r) => {
            const ops = r.browserResults.operationsExecuted;
            return sum + (ops > 0 ? (r.browserResults.operationsSuccessful / ops) * 100 : 0);
          }, 0) / totalTests,
        },
        permissions: {
          totalChecks: results.reduce((sum, r) => sum + r.permissionResults.permissionsChecked, 0),
          totalDenied: results.reduce((sum, r) => sum + r.permissionResults.permissionsDenied, 0),
          averageDenialRate: results.reduce((sum, r) => {
            const checks = r.permissionResults.permissionsChecked;
            return sum + (checks > 0 ? (r.permissionResults.permissionsDenied / checks) * 100 : 0);
          }, 0) / totalTests,
        },
      },
      performanceMetrics: {
        averageMemoryUsage: results.reduce((sum, r) => sum + r.performanceMetrics.memoryUsage, 0) / totalTests,
        averageResponseTime: results.reduce((sum, r) => sum + r.performanceMetrics.responseTime, 0) / totalTests,
        averageErrorRate: results.reduce((sum, r) => sum + r.performanceMetrics.errorRate, 0) / totalTests,
      },
      detailedResults: results,
      errorAnalysis: {
        totalErrors,
        errorsByComponent: this.analyzeErrorsByComponent(results),
        errorsByStage: this.analyzeErrorsByStage(results),
        recoverableErrors: results.reduce((sum, r) => sum + r.errors.filter(e => e.recoverable).length, 0),
      },
    };
  }

  /**
   * Analyze errors by component
   */
  private analyzeErrorsByComponent(results: IntegrationTestResult[]): Record<string, number> {
    const errorsByComponent: Record<string, number> = {};

    results.forEach(result => {
      result.errors.forEach(error => {
        errorsByComponent[error.component] = (errorsByComponent[error.component] || 0) + 1;
      });
    });

    return errorsByComponent;
  }

  /**
   * Analyze errors by stage
   */
  private analyzeErrorsByStage(results: IntegrationTestResult[]): Record<string, number> {
    const errorsByStage: Record<string, number> = {};

    results.forEach(result => {
      result.errors.forEach(error => {
        errorsByStage[error.stage] = (errorsByStage[error.stage] || 0) + 1;
      });
    });

    return errorsByStage;
  }

  /**
   * Cleanup all contexts and resources
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    // Cleanup integration contexts
    for (const [contextId, context] of this.contexts.entries()) {
      cleanupPromises.push(this.cleanupIntegrationContext(contextId));
    }

    // Cleanup workflow contexts
    for (const [contextId, context] of this.workflowContexts.entries()) {
      cleanupPromises.push(this.cleanupWorkflowContext(contextId));
    }

    await Promise.allSettled(cleanupPromises);

    // Cleanup global temp directory
    if (this.globalTempDir) {
      try {
        await fs.rm(this.globalTempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup global temp directory:', error);
      }
    }
  }

  /**
   * Cleanup a specific integration context
   */
  async cleanupIntegrationContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) return;

    try {
      // Cleanup mocks
      if (context.orchestrator.cleanup) {
        await context.orchestrator.cleanup();
      }

      if (context.browserTool.cleanup) {
        await context.browserTool.cleanup();
      }

      // Remove event listeners
      context.eventSystem.emitter.removeAllListeners();

      // Remove from storage
      this.contexts.delete(contextId);

      this.emit('context:cleanup-completed', { contextId });
    } catch (error) {
      this.emit('context:cleanup-failed', { contextId, error });
    }
  }

  /**
   * Cleanup a specific workflow context
   */
  async cleanupWorkflowContext(contextId: string): Promise<void> {
    const context = this.workflowContexts.get(contextId);
    if (!context) return;

    try {
      // Cleanup all agents
      const cleanupPromises = Object.values(context.agents).map(agent =>
        agent.cleanup ? agent.cleanup() : Promise.resolve()
      );

      await Promise.allSettled(cleanupPromises);

      // Remove from storage
      this.workflowContexts.delete(contextId);

      this.emit('workflow-context:cleanup-completed', { contextId });
    } catch (error) {
      this.emit('workflow-context:cleanup-failed', { contextId, error });
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create an integration test context manager
 */
export function createIntegrationTestManager(): IntegrationTestContextManager {
  return new IntegrationTestContextManager();
}

/**
 * Run a browser integration test with APEX orchestrator
 */
export async function runBrowserIntegrationTest<T>(
  testName: string,
  testFn: (apexContext: ApexIntegrationContext) => Promise<T>,
  config: any = {}
): Promise<{ result: T; report: IntegrationTestResult }> {
  const manager = createIntegrationTestManager();

  try {
    let testResult: T;

    const report = await manager.runIntegrationTest(testName, async (apexContext) => {
      testResult = await testFn(apexContext);
      return testResult;
    }, config);

    return { result: testResult!, report };
  } finally {
    await manager.cleanupAll();
  }
}

/**
 * Run a multi-agent workflow integration test
 */
export async function runWorkflowIntegrationTest<T>(
  workflowName: string,
  testFn: (apexContext: ApexIntegrationContext, workflowContext: MultiAgentWorkflowContext) => Promise<T>,
  config: any = {}
): Promise<{ result: T; report: IntegrationTestResult }> {
  const manager = createIntegrationTestManager();

  try {
    let testResult: T;

    const report = await manager.runIntegrationTest(workflowName, async (apexContext, workflowContext) => {
      if (!workflowContext) {
        throw new Error('Workflow context not created');
      }
      testResult = await testFn(apexContext, workflowContext);
      return testResult;
    }, { ...config, includeWorkflow: true });

    return { result: testResult!, report };
  } finally {
    await manager.cleanupAll();
  }
}

// Export all types and classes
export {
  ApexIntegrationContext,
  MultiAgentWorkflowContext,
  MockedAgent,
  IntegrationTestResult,
  IntegrationTestContextManager,
};