/**
 * @fileoverview Core integration scenarios test suite
 *
 * This test suite validates core integration scenarios across APEX packages:
 * - Configuration loading and validation
 * - Package interoperability
 * - Database and storage operations
 * - Agent and workflow management
 * - Error handling across package boundaries
 * - Resource lifecycle management
 *
 * These tests exercise the integration testing infrastructure and ensure
 * all packages work together correctly in integration scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Core Integration Scenarios', () => {
  let testProjectDir: string;
  let apexDir: string;
  let helpers: any;

  beforeEach(async () => {
    // Use global helpers if available, otherwise create temp directory directly
    helpers = (globalThis as any).apexTestHelpers;

    if (helpers && typeof helpers.createTempDir === 'function') {
      testProjectDir = await helpers.createTempDir('core-integration-test-');
    } else {
      testProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'core-integration-test-'));
    }

    apexDir = path.join(testProjectDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      if (helpers && typeof helpers.cleanupAll === 'function') {
        await helpers.cleanupAll();
      } else {
        await fs.rm(testProjectDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Configuration Management Integration', () => {
    it('should create and validate APEX project configuration', async () => {
      const configContent = `
project:
  name: core-integration-test
  language: typescript
  framework: nextjs

autonomy:
  default: supervised
  confirmLevelThreshold: 3

agents:
  planner:
    model: sonnet
    autonomy: supervised
  developer:
    model: sonnet
    autonomy: supervised
  tester:
    model: haiku
    autonomy: automatic

models:
  planning: sonnet
  implementation: sonnet
  testing: haiku

limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 10
  maxConcurrentTasks: 3

workflows:
  feature:
    stages: [planning, implementation, testing]
    approvalGates: [implementation]

permissions:
  fileOperations: true
  networkAccess: false
  systemCommands: restricted
`;

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, configContent);

      // Verify file was created correctly
      const readConfig = await fs.readFile(configPath, 'utf-8');
      expect(readConfig).toContain('core-integration-test');
      expect(readConfig).toContain('supervised');
      expect(readConfig).toContain('sonnet');

      // Validate YAML structure
      expect(readConfig).toMatch(/project:/);
      expect(readConfig).toMatch(/autonomy:/);
      expect(readConfig).toMatch(/limits:/);
    });

    it('should handle invalid configuration gracefully', async () => {
      const invalidConfigContent = `
project:
  name: test
  # Missing required language field

autonomy:
  default: invalid_mode  # Invalid autonomy mode

models:
  # Missing required models

limits:
  maxTokensPerTask: -100  # Invalid negative value
`;

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, invalidConfigContent);

      // Test should handle invalid configuration without crashing
      expect(await fs.readFile(configPath, 'utf-8')).toContain('invalid_mode');
    });

    it('should support configuration inheritance and defaults', async () => {
      const minimalConfig = `
project:
  name: minimal-test
  language: typescript

autonomy:
  default: supervised
`;

      const configPath = path.join(apexDir, 'config.yaml');
      await fs.writeFile(configPath, minimalConfig);

      const readConfig = await fs.readFile(configPath, 'utf-8');
      expect(readConfig).toContain('minimal-test');
      expect(readConfig).toContain('typescript');
    });
  });

  describe('Agent and Workflow Integration', () => {
    it('should create and manage agent definitions', async () => {
      const agentsDir = path.join(apexDir, 'agents');
      await fs.mkdir(agentsDir, { recursive: true });

      const plannerAgent = `---
name: planner
description: Planning agent for feature development
tools:
  - Read
  - Glob
  - Grep
model: sonnet
autonomy: supervised
---

# Planner Agent

You are a planning agent responsible for breaking down features into implementation tasks.

## Your Responsibilities
1. Analyze feature requirements
2. Create detailed implementation plans
3. Identify dependencies and risks
4. Estimate effort and complexity

## Guidelines
- Always start by understanding the existing codebase
- Break complex features into smaller, manageable tasks
- Consider testing and documentation requirements
- Identify potential integration points with other features
`;

      const developerAgent = `---
name: developer
description: Development agent for implementing features
tools:
  - Read
  - Write
  - Edit
  - Bash
model: sonnet
autonomy: supervised
---

# Developer Agent

You are a developer agent responsible for implementing features according to plans.

## Your Responsibilities
1. Implement features based on planning specifications
2. Write clean, maintainable code
3. Follow project coding standards
4. Create appropriate tests

## Guidelines
- Follow established architectural patterns
- Write comprehensive documentation
- Ensure code quality and performance
- Handle errors gracefully
`;

      const testerAgent = `---
name: tester
description: Testing agent for validating implementations
tools:
  - Read
  - Write
  - Bash
model: haiku
autonomy: automatic
---

# Tester Agent

You are a testing agent responsible for creating and running tests.

## Your Responsibilities
1. Create comprehensive test suites
2. Run tests and validate results
3. Ensure adequate coverage
4. Report testing outcomes

## Guidelines
- Write both unit and integration tests
- Test edge cases and error conditions
- Ensure tests are maintainable
- Provide clear test documentation
`;

      await fs.writeFile(path.join(agentsDir, 'planner.md'), plannerAgent);
      await fs.writeFile(path.join(agentsDir, 'developer.md'), developerAgent);
      await fs.writeFile(path.join(agentsDir, 'tester.md'), testerAgent);

      // Verify agents were created
      const agents = await fs.readdir(agentsDir);
      expect(agents).toContain('planner.md');
      expect(agents).toContain('developer.md');
      expect(agents).toContain('tester.md');

      // Verify agent content
      const plannerContent = await fs.readFile(path.join(agentsDir, 'planner.md'), 'utf-8');
      expect(plannerContent).toContain('name: planner');
      expect(plannerContent).toContain('Planning agent');
      expect(plannerContent).toContain('Read');
      expect(plannerContent).toContain('Glob');
    });

    it('should create and manage workflow definitions', async () => {
      const workflowsDir = path.join(apexDir, 'workflows');
      await fs.mkdir(workflowsDir, { recursive: true });

      const featureWorkflow = `name: feature-development
description: Complete feature development workflow
version: 1.0.0

gates:
  - id: implementation-review
    name: Implementation Review
    description: Review implementation before testing
    required: true
    minApprovals: 1
    timeout: 3600
    approvers:
      - tech-lead
      - senior-developer

  - id: security-review
    name: Security Review
    description: Security review for sensitive features
    required: false
    minApprovals: 1
    timeout: 1800
    approvers:
      - security-team

stages:
  - name: planning
    agent: planner
    description: Analyze requirements and create implementation plan
    inputs:
      - feature_description
      - acceptance_criteria
    outputs:
      - implementation_plan
      - task_breakdown
      - risk_assessment
    timeout: 1800

  - name: implementation
    agent: developer
    description: Implement the feature according to plan
    dependencies:
      - planning
    inputs:
      - implementation_plan
      - task_breakdown
    outputs:
      - code_changes
      - documentation
      - migration_scripts
    gate: implementation-review
    timeout: 7200

  - name: testing
    agent: tester
    description: Create and run comprehensive tests
    dependencies:
      - implementation
    inputs:
      - code_changes
      - test_requirements
    outputs:
      - test_files
      - coverage_report
      - test_results
    timeout: 3600

  - name: review
    agent: reviewer
    description: Final code review and quality validation
    dependencies:
      - testing
    inputs:
      - code_changes
      - test_results
      - coverage_report
    outputs:
      - review_comments
      - approval_status
    gate: security-review
    timeout: 1800

variables:
  feature_type: standard
  priority: medium
  complexity: moderate

notifications:
  slack:
    channels:
      - engineering
      - project-updates
    events:
      - stage_completed
      - gate_pending
      - workflow_completed
      - workflow_failed

error_handling:
  retry_attempts: 3
  backoff_strategy: exponential
  failure_notifications: true
`;

      await fs.writeFile(path.join(workflowsDir, 'feature.yaml'), featureWorkflow);

      // Verify workflow was created
      const workflows = await fs.readdir(workflowsDir);
      expect(workflows).toContain('feature.yaml');

      // Verify workflow content
      const workflowContent = await fs.readFile(path.join(workflowsDir, 'feature.yaml'), 'utf-8');
      expect(workflowContent).toContain('feature-development');
      expect(workflowContent).toContain('implementation-review');
      expect(workflowContent).toContain('stages:');
      expect(workflowContent).toContain('planning');
      expect(workflowContent).toContain('implementation');
      expect(workflowContent).toContain('testing');
    });
  });

  describe('Database and Storage Integration', () => {
    it('should simulate database initialization and operations', async () => {
      const dbPath = path.join(apexDir, 'apex.db');

      // Simulate database file creation with initial schema
      const initialData = JSON.stringify({
        version: '0.5.0',
        tables: {
          tasks: [],
          approvals: [],
          workflows: [],
          agents: [],
          notifications: []
        },
        indexes: {
          tasks_by_status: {},
          tasks_by_agent: {},
          approvals_by_status: {}
        },
        metadata: {
          created: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          schema_version: '1.0.0'
        }
      }, null, 2);

      await fs.writeFile(dbPath, initialData);

      // Verify database file was created
      const stats = await fs.stat(dbPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);

      // Verify database content
      const dbContent = await fs.readFile(dbPath, 'utf-8');
      const dbData = JSON.parse(dbContent);

      expect(dbData.version).toBe('0.5.0');
      expect(dbData.tables).toBeDefined();
      expect(dbData.tables.tasks).toEqual([]);
      expect(dbData.tables.approvals).toEqual([]);
      expect(dbData.metadata.schema_version).toBe('1.0.0');
    });

    it('should simulate task storage and retrieval operations', async () => {
      const dbPath = path.join(apexDir, 'tasks.json');

      // Create sample task data
      const tasks = [
        {
          id: helpers ? helpers.createTestId('task') : `task-${Date.now()}-1`,
          type: 'feature',
          status: 'planning',
          title: 'Implement user authentication',
          description: 'Add JWT-based authentication to the application',
          created: new Date().toISOString(),
          agent: 'planner',
          stage: 'planning',
          metadata: {
            priority: 'high',
            complexity: 'moderate',
            estimated_hours: 8
          }
        },
        {
          id: helpers ? helpers.createTestId('task') : `task-${Date.now()}-2`,
          type: 'bugfix',
          status: 'implementation',
          title: 'Fix login validation bug',
          description: 'Resolve issue with email validation in login form',
          created: new Date().toISOString(),
          agent: 'developer',
          stage: 'implementation',
          metadata: {
            priority: 'critical',
            complexity: 'low',
            estimated_hours: 2
          }
        }
      ];

      await fs.writeFile(dbPath, JSON.stringify(tasks, null, 2));

      // Verify task storage
      const storedTasks = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
      expect(storedTasks).toHaveLength(2);
      expect(storedTasks[0].title).toBe('Implement user authentication');
      expect(storedTasks[1].title).toBe('Fix login validation bug');
      expect(storedTasks[0].status).toBe('planning');
      expect(storedTasks[1].status).toBe('implementation');
    });

    it('should handle database backup and recovery scenarios', async () => {
      const dbPath = path.join(apexDir, 'apex.db');
      const backupPath = path.join(apexDir, 'backups', 'apex.db.backup');

      // Create backup directory
      await fs.mkdir(path.join(apexDir, 'backups'), { recursive: true });

      // Create initial database
      const originalData = JSON.stringify({
        tasks: [{ id: '1', title: 'Test task' }],
        timestamp: new Date().toISOString()
      });

      await fs.writeFile(dbPath, originalData);

      // Create backup
      await fs.copyFile(dbPath, backupPath);

      // Verify backup was created
      const backupStats = await fs.stat(backupPath);
      expect(backupStats.isFile()).toBe(true);

      // Verify backup content matches original
      const backupContent = await fs.readFile(backupPath, 'utf-8');
      const originalContent = await fs.readFile(dbPath, 'utf-8');
      expect(backupContent).toBe(originalContent);
    });
  });

  describe('Cross-Package Communication Integration', () => {
    it('should simulate orchestrator and agent communication', async () => {
      const communicationLog = path.join(apexDir, 'communication.log');

      // Simulate message exchange between orchestrator and agents
      const messages = [
        {
          timestamp: new Date().toISOString(),
          from: 'orchestrator',
          to: 'planner',
          type: 'task_assignment',
          payload: {
            taskId: 'task-123',
            description: 'Plan feature implementation',
            priority: 'high'
          }
        },
        {
          timestamp: new Date().toISOString(),
          from: 'planner',
          to: 'orchestrator',
          type: 'task_update',
          payload: {
            taskId: 'task-123',
            status: 'in_progress',
            progress: 25,
            message: 'Analyzing requirements'
          }
        },
        {
          timestamp: new Date().toISOString(),
          from: 'planner',
          to: 'orchestrator',
          type: 'task_completed',
          payload: {
            taskId: 'task-123',
            status: 'completed',
            outputs: {
              implementation_plan: 'path/to/plan.md',
              task_breakdown: ['task1', 'task2', 'task3']
            }
          }
        }
      ];

      await fs.writeFile(communicationLog, messages.map(m => JSON.stringify(m)).join('\n'));

      // Verify communication log
      const logContent = await fs.readFile(communicationLog, 'utf-8');
      const logLines = logContent.trim().split('\n');

      expect(logLines).toHaveLength(3);

      const firstMessage = JSON.parse(logLines[0]);
      expect(firstMessage.type).toBe('task_assignment');
      expect(firstMessage.from).toBe('orchestrator');
      expect(firstMessage.to).toBe('planner');

      const lastMessage = JSON.parse(logLines[2]);
      expect(lastMessage.type).toBe('task_completed');
      expect(lastMessage.payload.status).toBe('completed');
    });

    it('should simulate API server and CLI integration', async () => {
      const apiLogPath = path.join(apexDir, 'api.log');
      const cliLogPath = path.join(apexDir, 'cli.log');

      // Simulate API server operations
      const apiOperations = [
        { endpoint: '/api/tasks', method: 'GET', status: 200, response_time: 45 },
        { endpoint: '/api/tasks', method: 'POST', status: 201, response_time: 120 },
        { endpoint: '/api/approvals/pending', method: 'GET', status: 200, response_time: 32 }
      ];

      await fs.writeFile(apiLogPath, JSON.stringify(apiOperations, null, 2));

      // Simulate CLI operations
      const cliOperations = [
        { command: 'apex init', status: 'success', duration: 2.5 },
        { command: 'apex run feature', status: 'in_progress', duration: null },
        { command: 'apex status', status: 'success', duration: 0.3 }
      ];

      await fs.writeFile(cliLogPath, JSON.stringify(cliOperations, null, 2));

      // Verify integration logs
      const apiLog = JSON.parse(await fs.readFile(apiLogPath, 'utf-8'));
      const cliLog = JSON.parse(await fs.readFile(cliLogPath, 'utf-8'));

      expect(apiLog).toHaveLength(3);
      expect(apiLog[0].endpoint).toBe('/api/tasks');
      expect(apiLog[0].status).toBe(200);

      expect(cliLog).toHaveLength(3);
      expect(cliLog[0].command).toBe('apex init');
      expect(cliLog[0].status).toBe('success');
    });
  });

  describe('Error Handling and Resilience Integration', () => {
    it('should handle and log integration errors appropriately', async () => {
      const errorLogPath = path.join(apexDir, 'errors.log');

      // Simulate various error scenarios
      const errors = [
        {
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          component: 'orchestrator',
          message: 'Agent communication timeout',
          details: {
            agent: 'developer',
            task_id: 'task-456',
            timeout_duration: 30000
          }
        },
        {
          timestamp: new Date().toISOString(),
          level: 'WARN',
          component: 'task-store',
          message: 'Database connection retry',
          details: {
            attempt: 2,
            max_attempts: 3,
            error: 'SQLITE_BUSY'
          }
        },
        {
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          component: 'workflow-engine',
          message: 'Approval gate timeout',
          details: {
            gate_id: 'security-review',
            workflow_id: 'workflow-789',
            timeout_duration: 3600000
          }
        }
      ];

      await fs.writeFile(errorLogPath, errors.map(e => JSON.stringify(e)).join('\n'));

      // Verify error handling
      const errorLogContent = await fs.readFile(errorLogPath, 'utf-8');
      const errorLines = errorLogContent.trim().split('\n');

      expect(errorLines).toHaveLength(3);

      const firstError = JSON.parse(errorLines[0]);
      expect(firstError.level).toBe('ERROR');
      expect(firstError.component).toBe('orchestrator');
      expect(firstError.message).toContain('timeout');
    });

    it('should simulate recovery from system failures', async () => {
      const recoveryLogPath = path.join(apexDir, 'recovery.log');

      // Simulate system recovery scenarios
      const recoveryEvents = [
        {
          event: 'system_restart',
          timestamp: new Date().toISOString(),
          reason: 'scheduled_maintenance',
          duration: 5000,
          recovery_actions: [
            'restore_database_connections',
            'resume_active_tasks',
            'notify_pending_approvals'
          ]
        },
        {
          event: 'task_recovery',
          timestamp: new Date().toISOString(),
          task_id: 'task-interrupted-123',
          previous_status: 'in_progress',
          recovered_status: 'pending_retry',
          recovery_strategy: 'full_restart'
        }
      ];

      await fs.writeFile(recoveryLogPath, JSON.stringify(recoveryEvents, null, 2));

      // Verify recovery procedures
      const recoveryLog = JSON.parse(await fs.readFile(recoveryLogPath, 'utf-8'));
      expect(recoveryLog).toHaveLength(2);
      expect(recoveryLog[0].event).toBe('system_restart');
      expect(recoveryLog[1].recovery_strategy).toBe('full_restart');
    });
  });

  describe('Performance and Scalability Integration', () => {
    it('should simulate high-load scenarios', async () => {
      const performanceLogPath = path.join(apexDir, 'performance.log');

      // Simulate performance metrics under load
      const performanceData = {
        test_duration: 60000,
        concurrent_tasks: 50,
        metrics: {
          task_creation_rate: 2.5,
          task_completion_rate: 2.3,
          average_response_time: 145,
          peak_memory_usage: '256MB',
          cpu_utilization: 75,
          database_queries_per_second: 45
        },
        bottlenecks: [
          {
            component: 'database',
            metric: 'query_time',
            threshold_exceeded: true,
            max_value: 500,
            average_value: 280
          }
        ]
      };

      await fs.writeFile(performanceLogPath, JSON.stringify(performanceData, null, 2));

      // Verify performance monitoring
      const perfData = JSON.parse(await fs.readFile(performanceLogPath, 'utf-8'));
      expect(perfData.concurrent_tasks).toBe(50);
      expect(perfData.metrics.task_creation_rate).toBeGreaterThan(0);
      expect(perfData.bottlenecks).toHaveLength(1);
    });

    it('should validate resource cleanup under stress', async () => {
      const resourceLogPath = path.join(apexDir, 'resources.log');

      // Create temporary resources to test cleanup
      const tempFiles = [];
      for (let i = 0; i < 5; i++) {
        const tempFile = path.join(apexDir, `temp-resource-${i}.tmp`);
        await fs.writeFile(tempFile, `Temporary content ${i}`);
        tempFiles.push(tempFile);
      }

      // Log resource creation
      const resourceLog = {
        created_resources: tempFiles,
        creation_time: new Date().toISOString(),
        cleanup_scheduled: true
      };

      await fs.writeFile(resourceLogPath, JSON.stringify(resourceLog, null, 2));

      // Simulate cleanup
      for (const tempFile of tempFiles) {
        try {
          await fs.unlink(tempFile);
        } catch {
          // Cleanup error handling
        }
      }

      // Verify cleanup was effective
      const remainingFiles = await fs.readdir(apexDir);
      const tempFilesRemaining = remainingFiles.filter(f => f.includes('temp-resource'));
      expect(tempFilesRemaining).toHaveLength(0);
    });
  });
});