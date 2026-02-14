/**
 * @fileoverview Integration Tests for Tool Mocking Utilities
 *
 * This test suite validates real-world usage patterns of the tool mocking utilities,
 * demonstrating how they integrate with typical development workflows and testing scenarios.
 * Tests cover end-to-end scenarios, cross-tool interactions, and complex workflow simulations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MockToolsExecutor, createMockToolsExecutor } from '../test-utils/mock-tools-executor';
import { createMockToolScenario, MockToolExecution } from '../test-utils/claude-sdk-mock';
import type {
  MockTool,
  ToolInvocation,
  MockToolInvocationEvent
} from '../test-utils/mock-tool-types';

describe('Tool Mocking Integration Tests', () => {
  describe('Development Workflow Simulation', () => {
    let executor: MockToolsExecutor;
    let events: MockToolInvocationEvent[] = [];

    beforeEach(() => {
      executor = createMockToolsExecutor();
      events = [];

      // Listen to all tool events
      executor.on('tool:event', (event) => {
        events.push(event);
      });
    });

    afterEach(() => {
      executor.reset();
    });

    it('should simulate a complete feature development workflow', async () => {
      // Simulate reading existing code
      let response = await executor.executeTool('Read', {
        file_path: '/src/components/UserProfile.tsx'
      });
      expect(response.success).toBe(true);

      // Simulate creating a new test file
      response = await executor.executeTool('Write', {
        file_path: '/src/components/__tests__/UserProfile.test.tsx',
        content: 'import { render } from "@testing-library/react";\n// Test content...'
      });
      expect(response.success).toBe(true);

      // Simulate editing the component
      response = await executor.executeTool('Edit', {
        file_path: '/src/components/UserProfile.tsx',
        old_string: 'export const UserProfile = () => {',
        new_string: 'export const UserProfile: React.FC<UserProfileProps> = () => {'
      });
      expect(response.success).toBe(true);

      // Simulate running tests
      response = await executor.executeTool('Bash', {
        command: 'npm test UserProfile.test.tsx'
      });
      expect(response.success).toBe(true);

      // Verify workflow
      const invocations = executor.getInvocations();
      expect(invocations).toHaveLength(4);

      const toolNames = invocations.map(inv => inv.toolName);
      expect(toolNames).toEqual(['Read', 'Write', 'Edit', 'Bash']);

      // Verify events were emitted
      expect(events.filter(e => e.type === 'tool:invoked')).toHaveLength(4);
      expect(events.filter(e => e.type === 'tool:completed')).toHaveLength(4);
    });

    it('should simulate debugging workflow with file searches', async () => {
      // Search for error patterns
      let response = await executor.executeTool('Grep', {
        pattern: 'ERROR.*database',
        path: '/logs'
      });
      expect(response.success).toBe(true);

      // Find relevant configuration files
      response = await executor.executeTool('Glob', {
        pattern: '**/config/*.{js,json,yml}'
      });
      expect(response.success).toBe(true);

      // Read configuration
      response = await executor.executeTool('Read', {
        file_path: '/config/database.yml'
      });
      expect(response.success).toBe(true);

      // Check system status
      response = await executor.executeTool('Bash', {
        command: 'systemctl status database'
      });
      expect(response.success).toBe(true);

      // Verify the debugging sequence
      const stats = executor.getStats();
      expect(stats.totalInvocations).toBe(4);
      expect(stats.successfulExecutions).toBe(4);
    });

    it('should simulate CI/CD pipeline workflow', async () => {
      // Checkout code (simulated)
      let response = await executor.executeTool('Bash', {
        command: 'git checkout main'
      });
      expect(response.success).toBe(true);

      // Install dependencies
      response = await executor.executeTool('Bash', {
        command: 'npm ci'
      });
      expect(response.success).toBe(true);

      // Run tests
      response = await executor.executeTool('Bash', {
        command: 'npm test'
      });
      expect(response.success).toBe(true);

      // Build project
      response = await executor.executeTool('Bash', {
        command: 'npm run build'
      });
      expect(response.success).toBe(true);

      // Deploy (simulated)
      response = await executor.executeTool('Bash', {
        command: 'kubectl apply -f deployment.yml'
      });
      expect(response.success).toBe(true);

      // Verify pipeline execution
      const bashInvocations = executor.getInvocations('Bash');
      expect(bashInvocations).toHaveLength(5);

      const commands = bashInvocations.map(inv => inv.parameters.command);
      expect(commands).toEqual([
        'git checkout main',
        'npm ci',
        'npm test',
        'npm run build',
        'kubectl apply -f deployment.yml'
      ]);
    });
  });

  describe('Error Handling and Recovery Scenarios', () => {
    let mockExecution: MockToolExecution;

    beforeEach(() => {
      mockExecution = createMockToolScenario()
        .withSuccessTool('Read', { content: 'file content' })
        .withFailingTool('Write', 'Permission denied')
        .withRetryTool('Deploy', 2, { deployed: true }, 'Deployment failed')
        .build();
    });

    afterEach(() => {
      mockExecution.reset();
    });

    it('should handle file operation failures gracefully', async () => {
      // Successful read
      let execution = await mockExecution.executeTool('Read', {
        file_path: '/src/config.js'
      });
      expect(execution.result.success).toBe(true);

      // Failed write (permission denied)
      execution = await mockExecution.executeTool('Write', {
        file_path: '/etc/hosts',
        content: '127.0.0.1 localhost'
      });
      expect(execution.result.success).toBe(false);
      expect(execution.error).toBe('Permission denied');

      // Verify error handling
      const writeInvocations = mockExecution.getCallsForTool('Write');
      expect(writeInvocations).toHaveLength(1);
      expect(mockExecution.wasToolCalled('Read')).toBe(true);
      expect(mockExecution.wasToolCalled('Write')).toBe(true);
    });

    it('should simulate deployment retry scenarios', async () => {
      // First deployment attempts (should fail)
      let execution = await mockExecution.executeTool('Deploy', { service: 'api' });
      expect(execution.result.success).toBe(false);
      expect(execution.result.error).toBe('Deployment failed');

      execution = await mockExecution.executeTool('Deploy', { service: 'api' });
      expect(execution.result.success).toBe(false);

      // Final deployment (should succeed)
      execution = await mockExecution.executeTool('Deploy', { service: 'api' });
      expect(execution.result.success).toBe(true);
      expect(execution.result.output).toEqual({ deployed: true });

      // Verify retry pattern
      expect(mockExecution.getCallCount('Deploy')).toBe(3);
    });
  });

  describe('Complex Multi-Tool Interactions', () => {
    let executor: MockToolsExecutor;

    beforeEach(() => {
      // Configure complex scenario with custom tools
      executor = new MockToolsExecutor();

      // Database migration tool
      const migrationTool: MockTool = {
        name: 'DbMigrate',
        description: 'Run database migrations',
        parameters: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['up', 'down'] },
            target: { type: 'string' },
          },
          required: ['direction']
        },
        execute: async (params) => {
          const direction = params.direction as string;
          if (direction === 'up') {
            return {
              success: true,
              content: [{ type: 'text', text: 'Migrations applied successfully' }],
              metadata: { migrationsRun: 3 }
            };
          } else {
            return {
              success: true,
              content: [{ type: 'text', text: 'Migrations rolled back' }],
              metadata: { migrationsRolledBack: 2 }
            };
          }
        }
      };

      // API health check tool
      const healthCheckTool: MockTool = {
        name: 'HealthCheck',
        description: 'Check service health',
        parameters: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            timeout: { type: 'number', default: 5000 }
          },
          required: ['service']
        },
        execute: async (params) => ({
          success: true,
          content: [{
            type: 'text',
            text: `Service ${params.service} is healthy`
          }],
          metadata: {
            status: 'healthy',
            responseTime: 120,
            checks: ['database', 'cache', 'queue']
          }
        })
      };

      executor.registerTool(migrationTool);
      executor.registerTool(healthCheckTool);
      executor.registerTools([...require('../test-utils/mock-tools-executor').createDefaultMockTools()]);
    });

    afterEach(() => {
      executor.reset();
    });

    it('should coordinate database deployment workflow', async () => {
      // Read current database schema
      let response = await executor.executeTool('Read', {
        file_path: '/db/schema.sql'
      });
      expect(response.success).toBe(true);

      // Backup current database
      response = await executor.executeTool('Bash', {
        command: 'pg_dump -f backup.sql myapp_db'
      });
      expect(response.success).toBe(true);

      // Run migrations
      response = await executor.executeTool('DbMigrate', {
        direction: 'up',
        target: 'latest'
      });
      expect(response.success).toBe(true);
      expect(response.metadata?.migrationsRun).toBe(3);

      // Check service health
      response = await executor.executeTool('HealthCheck', {
        service: 'api',
        timeout: 10000
      });
      expect(response.success).toBe(true);
      expect(response.metadata?.status).toBe('healthy');

      // Verify complex workflow
      const invocations = executor.getInvocations();
      expect(invocations).toHaveLength(4);

      const workflow = invocations.map(inv => inv.toolName);
      expect(workflow).toEqual(['Read', 'Bash', 'DbMigrate', 'HealthCheck']);
    });

    it('should handle rollback scenario', async () => {
      // Simulate failed deployment requiring rollback
      executor.setToolEnabled('HealthCheck', false);

      // Try health check (will fail because disabled)
      await expect(executor.executeTool('HealthCheck', { service: 'api' }))
        .rejects.toThrow("Tool 'HealthCheck' is disabled");

      // Rollback migrations
      const response = await executor.executeTool('DbMigrate', {
        direction: 'down'
      });
      expect(response.success).toBe(true);
      expect(response.metadata?.migrationsRolledBack).toBe(2);

      // Verify rollback execution
      const migrationInvocations = executor.getInvocations('DbMigrate');
      expect(migrationInvocations).toHaveLength(1);
      expect(migrationInvocations[0].parameters.direction).toBe('down');
    });

    it('should track cross-tool data flow', async () => {
      // Simulate data extraction and processing workflow

      // Extract data
      let response = await executor.executeTool('Bash', {
        command: 'mysqldump --where="created_at > \'2023-01-01\'" users > users.sql'
      });
      expect(response.success).toBe(true);

      // Process extracted data
      response = await executor.executeTool('Read', {
        file_path: 'users.sql'
      });
      expect(response.success).toBe(true);

      // Transform data
      response = await executor.executeTool('Edit', {
        file_path: 'users.sql',
        old_string: 'CREATE TABLE users',
        new_string: 'CREATE TABLE users_backup'
      });
      expect(response.success).toBe(true);

      // Load to target
      response = await executor.executeTool('Bash', {
        command: 'mysql target_db < users.sql'
      });
      expect(response.success).toBe(true);

      // Verify data pipeline
      const stats = executor.getStats();
      expect(stats.totalInvocations).toBe(4);
      expect(stats.perTool['Bash'].invocations).toBe(2);
      expect(stats.perTool['Read'].invocations).toBe(1);
      expect(stats.perTool['Edit'].invocations).toBe(1);
    });
  });

  describe('Performance and Concurrency Testing', () => {
    let executor: MockToolsExecutor;

    beforeEach(() => {
      executor = new MockToolsExecutor({
        maxConcurrentExecutions: 3,
        defaultTimeout: 1000
      });

      // Tool that simulates slow execution
      const slowTool: MockTool = {
        name: 'SlowTool',
        description: 'Simulates slow execution',
        parameters: {
          type: 'object',
          properties: {
            duration: { type: 'number', default: 100 }
          }
        },
        responseDelay: 200,
        execute: async (params) => ({
          success: true,
          content: [{ type: 'text', text: `Completed after ${params.duration}ms` }]
        })
      };

      executor.registerTool(slowTool);
    });

    afterEach(() => {
      executor.reset();
    });

    it('should handle concurrent tool execution limits', async () => {
      // Start multiple slow executions
      const executions = [
        executor.executeTool('SlowTool', { id: 1 }),
        executor.executeTool('SlowTool', { id: 2 }),
        executor.executeTool('SlowTool', { id: 3 }),
      ];

      // This should fail due to concurrency limit
      await expect(executor.executeTool('SlowTool', { id: 4 }))
        .rejects.toThrow('Maximum concurrent executions (3) reached');

      // Wait for executions to complete
      const results = await Promise.all(executions);
      expect(results.every(r => r.success)).toBe(true);

      // Now this should succeed
      const finalResult = await executor.executeTool('SlowTool', { id: 4 });
      expect(finalResult.success).toBe(true);
    });

    it('should track execution timing accurately', async () => {
      const startTime = Date.now();

      // Execute slow tool
      const result = await executor.executeTool('SlowTool', { duration: 200 });

      const endTime = Date.now();
      const wallClockTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(wallClockTime).toBeGreaterThanOrEqual(200);
      expect(result.duration).toBeDefined();
      expect(result.duration!).toBeGreaterThanOrEqual(200);
    });

    it('should provide accurate performance statistics', async () => {
      // Execute multiple tools with different durations
      await executor.executeTool('SlowTool', { duration: 100 });
      await executor.executeTool('SlowTool', { duration: 200 });
      await executor.executeTool('SlowTool', { duration: 300 });

      const stats = executor.getStats();

      expect(stats.totalInvocations).toBe(3);
      expect(stats.successfulExecutions).toBe(3);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.perTool['SlowTool'].invocations).toBe(3);
      expect(stats.perTool['SlowTool'].averageDuration).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Real-World Integration Patterns', () => {
    it('should support test setup and teardown patterns', async () => {
      const mockExecution = createMockToolScenario()
        .withSuccessTool('Setup', { initialized: true })
        .withDynamicTool('Test', (params) => ({
          success: true,
          output: {
            testName: params.name,
            passed: true,
            duration: Math.random() * 1000
          }
        }))
        .withSuccessTool('Teardown', { cleaned: true })
        .build();

      // Setup phase
      let execution = await mockExecution.executeTool('Setup', { environment: 'test' });
      expect(execution.result.success).toBe(true);

      // Test execution phase
      const testCases = ['user_registration', 'user_login', 'user_logout'];
      for (const testCase of testCases) {
        execution = await mockExecution.executeTool('Test', {
          name: testCase,
          suite: 'integration'
        });
        expect(execution.result.success).toBe(true);
        expect(execution.result.output.testName).toBe(testCase);
      }

      // Teardown phase
      execution = await mockExecution.executeTool('Teardown', { environment: 'test' });
      expect(execution.result.success).toBe(true);

      // Verify test pattern
      mockExecution.assertToolsCalledInOrder(['Setup', 'Test', 'Teardown']);
      expect(mockExecution.getCallCount('Test')).toBe(3);
    });

    it('should support feature flag testing patterns', async () => {
      const executor = new MockToolsExecutor();

      // Feature flag configuration tool
      const featureFlagTool: MockTool = {
        name: 'FeatureFlag',
        description: 'Configure feature flags',
        parameters: {
          type: 'object',
          properties: {
            flag: { type: 'string' },
            enabled: { type: 'boolean' },
            userGroup: { type: 'string' }
          },
          required: ['flag', 'enabled']
        },
        execute: async (params) => ({
          success: true,
          content: [{
            type: 'text',
            text: `Feature ${params.flag} ${params.enabled ? 'enabled' : 'disabled'}`
          }],
          metadata: {
            flag: params.flag,
            enabled: params.enabled,
            userGroup: params.userGroup || 'default'
          }
        })
      };

      executor.registerTool(featureFlagTool);
      executor.registerTools([...require('../test-utils/mock-tools-executor').createDefaultMockTools()]);

      // Test with feature flag disabled
      let response = await executor.executeTool('FeatureFlag', {
        flag: 'new_checkout_flow',
        enabled: false
      });
      expect(response.metadata?.enabled).toBe(false);

      // Run tests with flag disabled
      response = await executor.executeTool('Bash', {
        command: 'npm test -- --grep="checkout flow"'
      });
      expect(response.success).toBe(true);

      // Enable feature flag
      response = await executor.executeTool('FeatureFlag', {
        flag: 'new_checkout_flow',
        enabled: true,
        userGroup: 'beta_users'
      });
      expect(response.metadata?.enabled).toBe(true);

      // Run tests with flag enabled
      response = await executor.executeTool('Bash', {
        command: 'npm test -- --grep="checkout flow" --env=beta'
      });
      expect(response.success).toBe(true);

      // Verify feature flag testing workflow
      const flagInvocations = executor.getInvocations('FeatureFlag');
      expect(flagInvocations).toHaveLength(2);
      expect(flagInvocations[0].parameters.enabled).toBe(false);
      expect(flagInvocations[1].parameters.enabled).toBe(true);
    });

    it('should support microservices testing orchestration', async () => {
      const executor = new MockToolsExecutor();

      // Service control tool
      const serviceControlTool: MockTool = {
        name: 'ServiceControl',
        description: 'Control microservice lifecycle',
        parameters: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            action: { type: 'string', enum: ['start', 'stop', 'restart', 'status'] },
            port: { type: 'number' }
          },
          required: ['service', 'action']
        },
        execute: async (params) => {
          const service = params.service as string;
          const action = params.action as string;

          return {
            success: true,
            content: [{
              type: 'text',
              text: `Service ${service} ${action} completed`
            }],
            metadata: {
              service,
              action,
              port: params.port,
              status: action === 'start' ? 'running' : 'stopped'
            }
          };
        }
      };

      executor.registerTool(serviceControlTool);

      const services = [
        { name: 'user-service', port: 3001 },
        { name: 'order-service', port: 3002 },
        { name: 'payment-service', port: 3003 },
      ];

      // Start all services
      for (const service of services) {
        const response = await executor.executeTool('ServiceControl', {
          service: service.name,
          action: 'start',
          port: service.port
        });
        expect(response.success).toBe(true);
        expect(response.metadata?.status).toBe('running');
      }

      // Check all services are running
      for (const service of services) {
        const response = await executor.executeTool('ServiceControl', {
          service: service.name,
          action: 'status'
        });
        expect(response.success).toBe(true);
      }

      // Stop all services
      for (const service of services) {
        const response = await executor.executeTool('ServiceControl', {
          service: service.name,
          action: 'stop'
        });
        expect(response.success).toBe(true);
      }

      // Verify orchestration
      const stats = executor.getStats();
      expect(stats.totalInvocations).toBe(9); // 3 services × 3 operations
      expect(stats.successfulExecutions).toBe(9);

      const invocations = executor.getInvocations('ServiceControl');
      const startInvocations = invocations.filter(inv => inv.parameters.action === 'start');
      const statusInvocations = invocations.filter(inv => inv.parameters.action === 'status');
      const stopInvocations = invocations.filter(inv => inv.parameters.action === 'stop');

      expect(startInvocations).toHaveLength(3);
      expect(statusInvocations).toHaveLength(3);
      expect(stopInvocations).toHaveLength(3);
    });
  });
});