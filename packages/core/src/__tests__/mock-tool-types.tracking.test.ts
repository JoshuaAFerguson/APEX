/**
 * @fileoverview Tool invocation tracking and validation tests for Mock Tool Types
 *
 * This test file focuses on:
 * - Tool invocation tracking and metrics
 * - Parameter validation and error handling
 * - Tool registry management
 * - Event tracking and monitoring
 * - Performance metrics and analytics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  ToolInvocationContext,
  MockToolExecutor,
  MockToolValidationResult,
  MockToolRegistryEntry,
  MockToolInvocationEvent,
} from '../test-utils/mock-tool-types.js';

import {
  ToolInvocationSchema,
  MockToolResponseSchema,
} from '../test-utils/mock-tool-types.js';

describe('Mock Tool Tracking and Validation', () => {
  describe('Invocation tracking', () => {
    it('should create detailed invocation records', () => {
      const invocation: ToolInvocation = {
        id: 'tracking_test_001',
        toolName: 'TestTool',
        parameters: {
          input: 'test data',
          options: {
            verbose: true,
            retries: 3,
          },
          metadata: {
            source: 'unit_test',
            priority: 'normal',
          },
        },
        invokedAt: new Date('2024-01-01T10:00:00Z'),
        context: {
          taskId: 'task_123',
          agentName: 'test_agent',
          stageName: 'testing',
          workingDirectory: '/test/workspace',
          requestId: 'req_456',
        },
      };

      expect(invocation.id).toBe('tracking_test_001');
      expect(invocation.toolName).toBe('TestTool');
      expect(invocation.parameters.input).toBe('test data');
      expect(invocation.context?.taskId).toBe('task_123');
      expect(invocation.invokedAt).toBeInstanceOf(Date);

      // Validate with Zod schema
      const validation = ToolInvocationSchema.safeParse(invocation);
      expect(validation.success).toBe(true);
    });

    it('should track execution metrics', async () => {
      class MetricsTrackingExecutor implements MockToolExecutor {
        private metrics = {
          totalInvocations: 0,
          successfulInvocations: 0,
          failedInvocations: 0,
          totalDuration: 0,
          averageDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          parametersHistogram: new Map<string, number>(),
        };

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const startTime = Date.now();
          this.metrics.totalInvocations++;

          // Track parameter usage
          Object.keys(params).forEach(key => {
            const current = this.metrics.parametersHistogram.get(key) || 0;
            this.metrics.parametersHistogram.set(key, current + 1);
          });

          // Simulate work with variable duration
          const complexity = (params.complexity as number) || 1;
          const baseDuration = 10;
          const duration = baseDuration * complexity + Math.random() * 20;

          await new Promise(resolve => setTimeout(resolve, duration));

          const actualDuration = Date.now() - startTime;

          // Update metrics
          this.metrics.totalDuration += actualDuration;
          this.metrics.minDuration = Math.min(this.metrics.minDuration, actualDuration);
          this.metrics.maxDuration = Math.max(this.metrics.maxDuration, actualDuration);
          this.metrics.averageDuration = this.metrics.totalDuration / this.metrics.totalInvocations;

          const isSuccess = Math.random() > 0.1; // 90% success rate

          if (isSuccess) {
            this.metrics.successfulInvocations++;
            return {
              success: true,
              content: [
                {
                  type: 'text',
                  text: `Operation completed in ${actualDuration}ms`,
                },
              ],
              duration: actualDuration,
              metadata: {
                complexity,
                metrics: { ...this.metrics },
              },
            };
          } else {
            this.metrics.failedInvocations++;
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Simulated failure for testing',
                  code: 'SIMULATED_FAILURE',
                },
              ],
              duration: actualDuration,
            };
          }
        }

        getMetrics() {
          return {
            ...this.metrics,
            parametersHistogram: Object.fromEntries(this.metrics.parametersHistogram),
          };
        }

        reset() {
          this.metrics = {
            totalInvocations: 0,
            successfulInvocations: 0,
            failedInvocations: 0,
            totalDuration: 0,
            averageDuration: 0,
            minDuration: Infinity,
            maxDuration: 0,
            parametersHistogram: new Map(),
          };
        }
      }

      const executor = new MetricsTrackingExecutor();

      // Run multiple invocations with different parameters
      const invocations = [
        { complexity: 1, operation: 'simple' },
        { complexity: 2, operation: 'moderate', debug: true },
        { complexity: 3, operation: 'complex', debug: true, validate: true },
        { complexity: 1, operation: 'simple' },
        { complexity: 2, operation: 'moderate' },
      ];

      vi.useFakeTimers();

      const promises = invocations.map((params, index) => {
        vi.advanceTimersByTime(50 * (params.complexity || 1));
        return executor.execute(params);
      });

      const results = await Promise.all(promises);
      vi.useRealTimers();

      const metrics = executor.getMetrics();

      expect(metrics.totalInvocations).toBe(5);
      expect(metrics.successfulInvocations + metrics.failedInvocations).toBe(5);
      expect(metrics.parametersHistogram.complexity).toBe(5);
      expect(metrics.parametersHistogram.operation).toBe(5);
      expect(metrics.parametersHistogram.debug).toBe(3);
      expect(metrics.parametersHistogram.validate).toBe(1);
      expect(metrics.averageDuration).toBeGreaterThan(0);
      expect(metrics.maxDuration).toBeGreaterThanOrEqual(metrics.minDuration);
    });

    it('should track invocation context patterns', () => {
      const invocationHistory: ToolInvocation[] = [];

      const createInvocation = (
        toolName: string,
        params: Record<string, unknown>,
        context: Partial<ToolInvocationContext> = {}
      ): ToolInvocation => {
        const invocation: ToolInvocation = {
          id: `inv_${toolName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          toolName,
          parameters: params,
          invokedAt: new Date(),
          context: {
            taskId: 'pattern_test_task',
            agentName: 'pattern_agent',
            stageName: 'testing',
            ...context,
          },
        };

        invocationHistory.push(invocation);
        return invocation;
      };

      // Simulate various invocation patterns
      createInvocation('Read', { file_path: '/src/index.ts' }, { stageName: 'analysis' });
      createInvocation('Write', { file_path: '/src/output.ts', content: 'code' }, { stageName: 'implementation' });
      createInvocation('Execute', { command: 'npm test' }, { stageName: 'testing' });
      createInvocation('Read', { file_path: '/src/config.json' }, { stageName: 'analysis' });
      createInvocation('WebFetch', { url: 'https://api.example.com' }, { stageName: 'research' });

      // Analyze patterns
      const stageDistribution = invocationHistory.reduce((acc, inv) => {
        const stage = inv.context?.stageName || 'unknown';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const toolDistribution = invocationHistory.reduce((acc, inv) => {
        acc[inv.toolName] = (acc[inv.toolName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const fileOperations = invocationHistory
        .filter(inv => inv.parameters.file_path)
        .map(inv => ({ tool: inv.toolName, file: inv.parameters.file_path }));

      expect(stageDistribution.analysis).toBe(2);
      expect(stageDistribution.implementation).toBe(1);
      expect(stageDistribution.testing).toBe(1);
      expect(stageDistribution.research).toBe(1);

      expect(toolDistribution.Read).toBe(2);
      expect(toolDistribution.Write).toBe(1);
      expect(toolDistribution.Execute).toBe(1);
      expect(toolDistribution.WebFetch).toBe(1);

      expect(fileOperations).toHaveLength(3);
      expect(fileOperations.find(op => op.file === '/src/index.ts')?.tool).toBe('Read');
    });
  });

  describe('Parameter validation', () => {
    it('should validate required parameters', () => {
      class ValidatingExecutor implements MockToolExecutor {
        validate(params: Record<string, unknown>): MockToolValidationResult {
          const errors: string[] = [];
          const warnings: string[] = [];

          // Check required parameters
          if (!params.input) {
            errors.push('input parameter is required');
          }

          if (!params.operation) {
            errors.push('operation parameter is required');
          }

          // Type validation
          if (params.input && typeof params.input !== 'string') {
            errors.push('input must be a string');
          }

          if (params.timeout && (typeof params.timeout !== 'number' || params.timeout <= 0)) {
            errors.push('timeout must be a positive number');
          }

          // Business logic validation
          if (params.operation && !['create', 'read', 'update', 'delete'].includes(params.operation as string)) {
            errors.push('operation must be one of: create, read, update, delete');
          }

          // Warnings for potentially problematic values
          if (params.timeout && (params.timeout as number) > 30000) {
            warnings.push('timeout exceeds recommended maximum of 30000ms');
          }

          if (params.input && (params.input as string).length > 10000) {
            warnings.push('input exceeds recommended maximum length of 10000 characters');
          }

          return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
          };
        }

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const validation = this.validate(params);

          if (!validation.valid) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: `Validation failed: ${validation.errors?.join(', ')}`,
                  code: 'VALIDATION_ERROR',
                  details: { validation },
                },
              ],
            };
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Valid execution: ${params.operation} with input: ${params.input}`,
              },
            ],
            metadata: {
              validation,
              parameters: params,
            },
          };
        }

        reset() {
          // No state to reset
        }
      }

      const executor = new ValidatingExecutor();

      // Test missing required parameters
      const missingParamsValidation = executor.validate({});
      expect(missingParamsValidation.valid).toBe(false);
      expect(missingParamsValidation.errors).toContain('input parameter is required');
      expect(missingParamsValidation.errors).toContain('operation parameter is required');

      // Test invalid types
      const invalidTypesValidation = executor.validate({
        input: 123,
        operation: 'read',
        timeout: 'invalid',
      });
      expect(invalidTypesValidation.valid).toBe(false);
      expect(invalidTypesValidation.errors).toContain('input must be a string');
      expect(invalidTypesValidation.errors).toContain('timeout must be a positive number');

      // Test invalid business logic
      const invalidOperationValidation = executor.validate({
        input: 'test',
        operation: 'invalid_op',
      });
      expect(invalidOperationValidation.valid).toBe(false);
      expect(invalidOperationValidation.errors).toContain('operation must be one of: create, read, update, delete');

      // Test warnings
      const warningsValidation = executor.validate({
        input: 'x'.repeat(15000),
        operation: 'read',
        timeout: 60000,
      });
      expect(warningsValidation.valid).toBe(true);
      expect(warningsValidation.warnings).toContain('timeout exceeds recommended maximum of 30000ms');
      expect(warningsValidation.warnings).toContain('input exceeds recommended maximum length of 10000 characters');

      // Test valid parameters
      const validValidation = executor.validate({
        input: 'test input',
        operation: 'create',
        timeout: 5000,
      });
      expect(validValidation.valid).toBe(true);
      expect(validValidation.errors).toBeUndefined();
      expect(validValidation.warnings).toBeUndefined();
    });

    it('should validate complex nested parameters', () => {
      class ComplexValidatingExecutor implements MockToolExecutor {
        validate(params: Record<string, unknown>): MockToolValidationResult {
          const errors: string[] = [];

          // Validate configuration object
          if (params.config) {
            const config = params.config as Record<string, unknown>;

            if (!config.apiUrl || typeof config.apiUrl !== 'string') {
              errors.push('config.apiUrl is required and must be a string');
            }

            if (config.retries !== undefined) {
              if (typeof config.retries !== 'number' || config.retries < 0 || config.retries > 10) {
                errors.push('config.retries must be a number between 0 and 10');
              }
            }

            if (config.headers && typeof config.headers !== 'object') {
              errors.push('config.headers must be an object');
            }
          }

          // Validate array parameters
          if (params.tags) {
            if (!Array.isArray(params.tags)) {
              errors.push('tags must be an array');
            } else {
              const tags = params.tags as unknown[];
              if (tags.some(tag => typeof tag !== 'string')) {
                errors.push('all tags must be strings');
              }
              if (tags.length > 5) {
                errors.push('maximum 5 tags allowed');
              }
            }
          }

          return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
          };
        }

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const validation = this.validate(params);

          if (!validation.valid) {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Complex validation failed',
                  code: 'COMPLEX_VALIDATION_ERROR',
                  details: { validation },
                },
              ],
            };
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: 'Complex validation passed',
              },
            ],
          };
        }

        reset() {}
      }

      const executor = new ComplexValidatingExecutor();

      // Test valid complex parameters
      const validResult = executor.validate({
        config: {
          apiUrl: 'https://api.example.com',
          retries: 3,
          headers: { 'Authorization': 'Bearer token' },
        },
        tags: ['urgent', 'api', 'production'],
      });
      expect(validResult.valid).toBe(true);

      // Test invalid nested configuration
      const invalidConfigResult = executor.validate({
        config: {
          apiUrl: null,
          retries: 15,
          headers: 'invalid',
        },
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'],
      });
      expect(invalidConfigResult.valid).toBe(false);
      expect(invalidConfigResult.errors).toContain('config.apiUrl is required and must be a string');
      expect(invalidConfigResult.errors).toContain('config.retries must be a number between 0 and 10');
      expect(invalidConfigResult.errors).toContain('config.headers must be an object');
      expect(invalidConfigResult.errors).toContain('maximum 5 tags allowed');

      // Test invalid tags
      const invalidTagsResult = executor.validate({
        tags: [1, 2, 3],
      });
      expect(invalidTagsResult.valid).toBe(false);
      expect(invalidTagsResult.errors).toContain('all tags must be strings');
    });
  });

  describe('Event tracking', () => {
    it('should emit and track tool invocation events', () => {
      const eventLog: MockToolInvocationEvent[] = [];

      const emitEvent = (event: MockToolInvocationEvent) => {
        eventLog.push(event);
      };

      const executeWithEventTracking = async (
        tool: MockTool,
        params: Record<string, unknown>,
        context?: ToolInvocationContext
      ) => {
        const invocation: ToolInvocation = {
          id: `event_${Date.now()}`,
          toolName: tool.name,
          parameters: params,
          invokedAt: new Date(),
          context,
        };

        // Emit start event
        emitEvent({
          type: 'tool:invoked',
          toolName: tool.name,
          invocation,
          timestamp: new Date(),
        });

        try {
          const response = await (tool.execute as Function)(params, context);

          invocation.response = response;
          invocation.completedAt = new Date();
          invocation.duration = response.duration || 0;

          // Emit completion event
          emitEvent({
            type: response.success ? 'tool:completed' : 'tool:error',
            toolName: tool.name,
            invocation,
            response,
            timestamp: new Date(),
          });

          return { invocation, response };
        } catch (error) {
          invocation.error = error as Error;
          invocation.completedAt = new Date();

          emitEvent({
            type: 'tool:error',
            toolName: tool.name,
            invocation,
            error: error as Error,
            timestamp: new Date(),
          });

          throw error;
        }
      };

      const testTool: MockTool = {
        name: 'EventTestTool',
        description: 'Tool for testing event emission',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string' },
          },
        },
        execute: async (params) => {
          const action = params.action as string;

          if (action === 'error') {
            return {
              success: false,
              isError: true,
              content: [
                {
                  type: 'error',
                  message: 'Intentional test error',
                  code: 'TEST_ERROR',
                },
              ],
            };
          }

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Action ${action} completed`,
              },
            ],
            duration: 50,
          };
        },
      };

      // Test successful execution with events
      await executeWithEventTracking(testTool, { action: 'success' });

      expect(eventLog).toHaveLength(2);
      expect(eventLog[0].type).toBe('tool:invoked');
      expect(eventLog[1].type).toBe('tool:completed');

      // Test error execution with events
      await executeWithEventTracking(testTool, { action: 'error' });

      expect(eventLog).toHaveLength(4);
      expect(eventLog[2].type).toBe('tool:invoked');
      expect(eventLog[3].type).toBe('tool:error');

      // Verify event structure
      const completionEvent = eventLog[1];
      expect(completionEvent.toolName).toBe('EventTestTool');
      expect(completionEvent.invocation.parameters.action).toBe('success');
      expect(completionEvent.response?.success).toBe(true);
      expect(completionEvent.timestamp).toBeInstanceOf(Date);

      const errorEvent = eventLog[3];
      expect(errorEvent.toolName).toBe('EventTestTool');
      expect(errorEvent.response?.success).toBe(false);
      expect(errorEvent.response?.content[0].code).toBe('TEST_ERROR');
    });

    it('should aggregate event statistics', () => {
      const events: MockToolInvocationEvent[] = [];

      // Simulate various events
      const toolNames = ['Read', 'Write', 'Execute', 'WebFetch'];
      const eventTypes: MockToolInvocationEvent['type'][] = ['tool:invoked', 'tool:completed', 'tool:error'];

      toolNames.forEach((toolName, toolIndex) => {
        for (let i = 0; i < 10; i++) {
          const invocation: ToolInvocation = {
            id: `agg_${toolName}_${i}`,
            toolName,
            parameters: { index: i },
            invokedAt: new Date(Date.now() - (100 - i) * 1000),
          };

          // Invoked event
          events.push({
            type: 'tool:invoked',
            toolName,
            invocation,
            timestamp: invocation.invokedAt,
          });

          // Completion/error event (90% success rate)
          const isSuccess = i < 9;
          events.push({
            type: isSuccess ? 'tool:completed' : 'tool:error',
            toolName,
            invocation: {
              ...invocation,
              response: {
                success: isSuccess,
                isError: !isSuccess,
                content: isSuccess
                  ? [{ type: 'text', text: `${toolName} ${i} completed` }]
                  : [{ type: 'error', message: `${toolName} ${i} failed`, code: 'TEST_FAILURE' }],
                duration: 50 + Math.random() * 100,
              },
            },
            timestamp: new Date(invocation.invokedAt.getTime() + 50 + Math.random() * 100),
          });
        }
      });

      // Analyze aggregated statistics
      const analyzeEvents = (events: MockToolInvocationEvent[]) => {
        const stats = {
          totalInvocations: 0,
          completedInvocations: 0,
          errorInvocations: 0,
          toolStats: {} as Record<string, { invoked: number; completed: number; errors: number }>,
          averageDuration: 0,
          totalDuration: 0,
        };

        events.forEach(event => {
          const toolName = event.toolName;

          if (!stats.toolStats[toolName]) {
            stats.toolStats[toolName] = { invoked: 0, completed: 0, errors: 0 };
          }

          switch (event.type) {
            case 'tool:invoked':
              stats.totalInvocations++;
              stats.toolStats[toolName].invoked++;
              break;
            case 'tool:completed':
              stats.completedInvocations++;
              stats.toolStats[toolName].completed++;
              if (event.response?.duration) {
                stats.totalDuration += event.response.duration;
              }
              break;
            case 'tool:error':
              stats.errorInvocations++;
              stats.toolStats[toolName].errors++;
              break;
          }
        });

        stats.averageDuration = stats.totalDuration / stats.completedInvocations;

        return stats;
      };

      const stats = analyzeEvents(events);

      expect(stats.totalInvocations).toBe(40); // 4 tools × 10 invocations
      expect(stats.completedInvocations).toBe(36); // 4 tools × 9 successes
      expect(stats.errorInvocations).toBe(4); // 4 tools × 1 error
      expect(stats.averageDuration).toBeGreaterThan(50);
      expect(stats.averageDuration).toBeLessThan(150);

      // Check per-tool stats
      Object.values(stats.toolStats).forEach(toolStat => {
        expect(toolStat.invoked).toBe(10);
        expect(toolStat.completed).toBe(9);
        expect(toolStat.errors).toBe(1);
      });
    });
  });

  describe('Performance monitoring', () => {
    it('should track performance metrics over time', async () => {
      class PerformanceMonitoringExecutor implements MockToolExecutor {
        private metrics = {
          invocations: [] as Array<{
            timestamp: Date;
            duration: number;
            success: boolean;
            memoryUsage: number;
          }>,
        };

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const startTime = Date.now();
          const startMemory = process.memoryUsage().heapUsed;

          // Simulate varying workload
          const workload = (params.workload as number) || 1;
          const delay = workload * 10 + Math.random() * 20;

          await new Promise(resolve => setTimeout(resolve, delay));

          const endTime = Date.now();
          const endMemory = process.memoryUsage().heapUsed;
          const duration = endTime - startTime;

          const success = Math.random() > 0.05; // 95% success rate

          this.metrics.invocations.push({
            timestamp: new Date(startTime),
            duration,
            success,
            memoryUsage: endMemory - startMemory,
          });

          return {
            success,
            isError: !success,
            content: success
              ? [{ type: 'text', text: `Workload ${workload} completed` }]
              : [{ type: 'error', message: 'Performance test failure', code: 'PERF_ERROR' }],
            duration,
            metadata: {
              workload,
              memoryDelta: endMemory - startMemory,
            },
          };
        }

        getPerformanceReport() {
          const invocations = this.metrics.invocations;

          if (invocations.length === 0) {
            return {
              totalInvocations: 0,
              averageDuration: 0,
              successRate: 0,
              throughput: 0,
            };
          }

          const totalDuration = invocations.reduce((sum, inv) => sum + inv.duration, 0);
          const successCount = invocations.filter(inv => inv.success).length;
          const timeSpan = invocations[invocations.length - 1].timestamp.getTime() - invocations[0].timestamp.getTime();

          return {
            totalInvocations: invocations.length,
            averageDuration: totalDuration / invocations.length,
            successRate: successCount / invocations.length,
            throughput: invocations.length / (timeSpan / 1000), // invocations per second
            minDuration: Math.min(...invocations.map(inv => inv.duration)),
            maxDuration: Math.max(...invocations.map(inv => inv.duration)),
            totalMemoryUsage: invocations.reduce((sum, inv) => sum + inv.memoryUsage, 0),
          };
        }

        reset() {
          this.metrics.invocations = [];
        }
      }

      const executor = new PerformanceMonitoringExecutor();

      vi.useFakeTimers();

      // Simulate varying workloads
      const workloads = [1, 2, 3, 1, 2, 4, 1, 3, 2, 1];
      const promises = workloads.map((workload, index) => {
        vi.advanceTimersByTime(workload * 10 + 20);
        return executor.execute({ workload });
      });

      await Promise.all(promises);

      vi.useRealTimers();

      const report = executor.getPerformanceReport();

      expect(report.totalInvocations).toBe(10);
      expect(report.averageDuration).toBeGreaterThan(0);
      expect(report.successRate).toBeGreaterThanOrEqual(0.8); // At least 80% success rate
      expect(report.throughput).toBeGreaterThan(0);
      expect(report.maxDuration).toBeGreaterThanOrEqual(report.minDuration);
      expect(typeof report.totalMemoryUsage).toBe('number');
    });

    it('should detect performance regressions', async () => {
      const performanceHistory: Array<{ duration: number; timestamp: Date }> = [];

      class RegressionDetectionExecutor implements MockToolExecutor {
        private baselinePerformance = 100; // ms

        async execute(params: Record<string, unknown>): Promise<MockToolResponse> {
          const startTime = Date.now();

          // Simulate performance degradation over time
          const degradationFactor = performanceHistory.length * 0.1;
          const actualDuration = this.baselinePerformance + degradationFactor;

          await new Promise(resolve => setTimeout(resolve, actualDuration));

          const endTime = Date.now();
          const duration = endTime - startTime;

          performanceHistory.push({
            duration,
            timestamp: new Date(startTime),
          });

          // Detect regression
          const isRegression = this.detectRegression();

          return {
            success: true,
            content: [
              {
                type: 'text',
                text: `Execution completed in ${duration}ms${isRegression ? ' [REGRESSION DETECTED]' : ''}`,
              },
            ],
            duration,
            metadata: {
              isRegression,
              performanceScore: this.calculatePerformanceScore(),
              trend: this.calculateTrend(),
            },
          };
        }

        private detectRegression(): boolean {
          if (performanceHistory.length < 5) return false;

          const recent = performanceHistory.slice(-5);
          const baseline = performanceHistory.slice(0, 5);

          const recentAvg = recent.reduce((sum, h) => sum + h.duration, 0) / recent.length;
          const baselineAvg = baseline.reduce((sum, h) => sum + h.duration, 0) / baseline.length;

          return recentAvg > baselineAvg * 1.2; // 20% slower is considered regression
        }

        private calculatePerformanceScore(): number {
          if (performanceHistory.length === 0) return 100;

          const latestDuration = performanceHistory[performanceHistory.length - 1].duration;
          return Math.max(0, 100 - (latestDuration - this.baselinePerformance));
        }

        private calculateTrend(): 'improving' | 'stable' | 'degrading' {
          if (performanceHistory.length < 3) return 'stable';

          const recent = performanceHistory.slice(-3);
          const durations = recent.map(h => h.duration);

          const trend = durations[2] - durations[0];

          if (trend > 10) return 'degrading';
          if (trend < -10) return 'improving';
          return 'stable';
        }

        reset() {
          performanceHistory.length = 0;
        }
      }

      const executor = new RegressionDetectionExecutor();

      vi.useFakeTimers();

      // Execute multiple times to build history and detect regression
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(100 + i * 10);
        await executor.execute({});
      }

      vi.useRealTimers();

      const lastResponse = await executor.execute({});

      expect(lastResponse.metadata?.isRegression).toBe(true);
      expect(lastResponse.metadata?.trend).toBe('degrading');
      expect(lastResponse.metadata?.performanceScore).toBeLessThan(100);
      expect(lastResponse.content[0].text).toContain('[REGRESSION DETECTED]');
    });
  });
});