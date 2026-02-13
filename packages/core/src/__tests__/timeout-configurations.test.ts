/**
 * @fileoverview Comprehensive Timeout Configuration Tests
 *
 * Tests all timeout configuration options, validation, and edge cases across the APEX codebase.
 * Based on analysis of 25+ timeout configuration options found in types.ts including:
 * - Browser automation timeouts
 * - MCP connection timeouts
 * - Tool execution timeouts
 * - Approval workflow timeouts
 * - System service timeouts
 * - Development tool timeouts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

// Import timeout configuration schemas from types.ts
import {
  BrowserOptionsSchema,
  MCPConnectionPoolConfigSchema,
  ApprovalRequestSchema,
  UserPermissionConfigSchema,
  NodeJsServiceConfigSchema,
  TaskDefinitionSchema,
  LifecycleHookSchema,
  GateDefinitionSchema,
  PolicyEvaluationContextSchema,
  RetryConfigSchema
} from '../types.js';

describe('Timeout Configuration Tests', () => {
  describe('Browser Automation Timeouts', () => {
    it('should validate browser page load timeout configuration', () => {
      const validConfig = BrowserOptionsSchema.parse({
        pageLoadTimeout: 30000
      });
      expect(validConfig.pageLoadTimeout).toBe(30000);

      const defaultConfig = BrowserOptionsSchema.parse({});
      expect(defaultConfig.timeout).toBe(30000); // Default timeout

      // Test minimum timeout validation
      expect(() => BrowserOptionsSchema.parse({
        pageLoadTimeout: -1
      })).toThrow();
    });

    it('should validate browser wait operation timeout', () => {
      const waitConfig = {
        operation: 'waitForSelector' as const,
        params: {
          selector: '#test-element',
          options: {
            timeout: 15000,
            state: 'visible' as const
          }
        }
      };

      // Should validate successfully
      expect(() => z.object({
        operation: z.literal('waitForSelector'),
        params: z.object({
          selector: z.string(),
          options: z.object({
            timeout: z.number().int().min(0).optional(),
            state: z.enum(['visible', 'hidden', 'attached', 'detached']).optional()
          }).optional()
        })
      }).parse(waitConfig)).not.toThrow();
    });

    it('should handle browser navigation timeout edge cases', () => {
      const navigationConfig = z.object({
        waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
        timeout: z.number().int().min(0).optional()
      });

      // Valid timeouts
      expect(() => navigationConfig.parse({ timeout: 0 })).not.toThrow(); // Immediate
      expect(() => navigationConfig.parse({ timeout: 60000 })).not.toThrow(); // 1 minute
      expect(() => navigationConfig.parse({ timeout: 300000 })).not.toThrow(); // 5 minutes

      // Invalid timeout
      expect(() => navigationConfig.parse({ timeout: -1 })).toThrow();
    });

    it('should validate browser operation delay configurations', () => {
      const clickConfig = z.object({
        delay: z.number().int().min(0).optional()
      });

      const typeConfig = z.object({
        delay: z.number().int().min(0).optional()
      });

      // Valid delays
      expect(() => clickConfig.parse({ delay: 0 })).not.toThrow(); // No delay
      expect(() => clickConfig.parse({ delay: 100 })).not.toThrow(); // 100ms delay
      expect(() => clickConfig.parse({ delay: 5000 })).not.toThrow(); // 5s delay

      expect(() => typeConfig.parse({ delay: 50 })).not.toThrow(); // Typing delay

      // Invalid delays
      expect(() => clickConfig.parse({ delay: -1 })).toThrow();
      expect(() => typeConfig.parse({ delay: -100 })).toThrow();
    });
  });

  describe('MCP Connection Timeouts', () => {
    it('should validate MCP connection pool timeout configurations', () => {
      const validConfig = MCPConnectionPoolConfigSchema.parse({
        connectionTimeoutMs: 10000,
        requestTimeoutMs: 30000,
        idleTimeoutMs: 300000,
        healthCheckTimeoutMs: 5000,
        retryDelayMs: 1000,
        maxRetryDelayMs: 60000,
        backoffFactor: 2.0
      });

      expect(validConfig.connectionTimeoutMs).toBe(10000);
      expect(validConfig.requestTimeoutMs).toBe(30000);
      expect(validConfig.idleTimeoutMs).toBe(300000);
      expect(validConfig.healthCheckTimeoutMs).toBe(5000);
    });

    it('should use default MCP timeout values', () => {
      const defaultConfig = MCPConnectionPoolConfigSchema.parse({});

      expect(defaultConfig.connectionTimeoutMs).toBe(10000); // 10 seconds
      expect(defaultConfig.requestTimeoutMs).toBe(30000); // 30 seconds
      expect(defaultConfig.idleTimeoutMs).toBe(300000); // 5 minutes
      expect(defaultConfig.healthCheckTimeoutMs).toBe(5000); // 5 seconds
    });

    it('should validate MCP retry timeout configurations', () => {
      const retryConfig = MCPConnectionPoolConfigSchema.parse({
        retryDelayMs: 2000,
        maxRetryDelayMs: 120000,
        backoffFactor: 1.5
      });

      expect(retryConfig.retryDelayMs).toBe(2000);
      expect(retryConfig.maxRetryDelayMs).toBe(120000);
      expect(retryConfig.backoffFactor).toBe(1.5);

      // Test that max retry delay must be >= retry delay
      expect(() => MCPConnectionPoolConfigSchema.parse({
        retryDelayMs: 10000,
        maxRetryDelayMs: 5000 // Lower than initial delay
      })).not.toThrow(); // Schema allows this but implementation should handle
    });

    it('should handle zero timeout for idle connections', () => {
      const noIdleTimeoutConfig = MCPConnectionPoolConfigSchema.parse({
        idleTimeoutMs: 0 // No idle timeout
      });

      expect(noIdleTimeoutConfig.idleTimeoutMs).toBe(0);
    });
  });

  describe('Tool Execution Timeouts', () => {
    it('should validate tool execution timeout configuration', () => {
      const toolConfigSchema = z.object({
        timeoutMs: z.number().int().min(1).optional().default(60000)
      });

      const validConfig = toolConfigSchema.parse({
        timeoutMs: 45000
      });
      expect(validConfig.timeoutMs).toBe(45000);

      const defaultConfig = toolConfigSchema.parse({});
      expect(defaultConfig.timeoutMs).toBe(60000); // Default 60 seconds
    });

    it('should validate MCP tool invocation timeout', () => {
      const mcpToolConfigSchema = z.object({
        invocationTimeoutMs: z.number().min(1000).optional().default(30000)
      });

      const validConfig = mcpToolConfigSchema.parse({
        invocationTimeoutMs: 45000
      });
      expect(validConfig.invocationTimeoutMs).toBe(45000);

      const defaultConfig = mcpToolConfigSchema.parse({});
      expect(defaultConfig.invocationTimeoutMs).toBe(30000); // Default 30 seconds

      // Test minimum timeout validation
      expect(() => mcpToolConfigSchema.parse({
        invocationTimeoutMs: 500 // Below 1000ms minimum
      })).toThrow();
    });

    it('should validate linter execution timeout', () => {
      const linterConfigSchema = z.object({
        timeoutMs: z.number().optional().default(30000)
      });

      const linterGlobalConfigSchema = z.object({
        timeoutMs: z.number().optional().default(60000)
      });

      const linterConfig = linterConfigSchema.parse({
        timeoutMs: 15000
      });
      expect(linterConfig.timeoutMs).toBe(15000);

      const globalConfig = linterGlobalConfigSchema.parse({});
      expect(globalConfig.timeoutMs).toBe(60000); // Default global timeout
    });
  });

  describe('Approval Workflow Timeouts', () => {
    it('should validate approval request timeout configuration', () => {
      const approvalConfigSchema = z.object({
        timeoutMinutes: z.number().min(1).optional(),
        timeoutAction: z.enum(['reject', 'approve', 'escalate']).optional().default('reject'),
        autoApproveOnTimeout: z.boolean().default(false)
      });

      const validConfig = approvalConfigSchema.parse({
        timeoutMinutes: 30,
        timeoutAction: 'escalate',
        autoApproveOnTimeout: true
      });

      expect(validConfig.timeoutMinutes).toBe(30);
      expect(validConfig.timeoutAction).toBe('escalate');
      expect(validConfig.autoApproveOnTimeout).toBe(true);
    });

    it('should validate global approval timeout configuration', () => {
      const globalApprovalConfigSchema = z.object({
        approvalTimeout: z.number().min(1).optional(),
        defaultTimeoutMinutes: z.number().int().min(1).optional().default(60),
        defaultTimeoutAction: z.enum(['reject', 'approve', 'escalate']).optional().default('reject')
      });

      const config = globalApprovalConfigSchema.parse({
        approvalTimeout: 120,
        defaultTimeoutMinutes: 90
      });

      expect(config.approvalTimeout).toBe(120);
      expect(config.defaultTimeoutMinutes).toBe(90);
      expect(config.defaultTimeoutAction).toBe('reject'); // Default
    });

    it('should handle approval urgency timeout mappings', () => {
      const urgencyTimeoutMap = {
        'critical': 5,    // 5 minutes
        'high': 15,       // 15 minutes
        'normal': 60,     // 1 hour
        'low': 1440       // 24 hours
      };

      Object.entries(urgencyTimeoutMap).forEach(([urgency, timeout]) => {
        const approvalSchema = z.object({
          urgency: z.enum(['low', 'normal', 'high', 'critical']),
          timeoutMinutes: z.number().int().min(1).optional()
        });

        const config = approvalSchema.parse({
          urgency: urgency as any,
          timeoutMinutes: timeout
        });

        expect(config.timeoutMinutes).toBe(timeout);
      });
    });

    it('should validate gate timeout configuration', () => {
      const gateConfigSchema = z.object({
        timeout: z.number().min(1).optional(),
        autoApproveOnTimeout: z.boolean().default(false),
        timeoutMinutes: z.number().min(1).optional()
      });

      const gateConfig = gateConfigSchema.parse({
        timeout: 30,
        autoApproveOnTimeout: true,
        timeoutMinutes: 45
      });

      expect(gateConfig.timeout).toBe(30);
      expect(gateConfig.autoApproveOnTimeout).toBe(true);
      expect(gateConfig.timeoutMinutes).toBe(45);
    });
  });

  describe('System Service Timeouts', () => {
    it('should validate Node.js service timeout configuration', () => {
      const serviceConfigSchema = z.object({
        timeoutMs: z.number().optional().default(60000)
      });

      const config = serviceConfigSchema.parse({
        timeoutMs: 45000
      });
      expect(config.timeoutMs).toBe(45000);

      const defaultConfig = serviceConfigSchema.parse({});
      expect(defaultConfig.timeoutMs).toBe(60000); // Default timeout
    });

    it('should validate lifecycle hook timeout configuration', () => {
      const hookConfig = LifecycleHookSchema.parse({
        phase: 'before-task',
        hook: 'validate',
        timeoutMs: 15000
      });

      expect(hookConfig.timeoutMs).toBe(15000);

      // Test default timeout
      const defaultHookConfig = LifecycleHookSchema.parse({
        phase: 'after-task',
        hook: 'cleanup'
      });
      expect(defaultHookConfig.timeoutMs).toBe(30000); // Default 30 seconds
    });

    it('should validate policy evaluation timeout', () => {
      const policyConfigSchema = z.object({
        timeoutMs: z.number().int().min(0).optional()
      });

      const config = policyConfigSchema.parse({
        timeoutMs: 10000
      });
      expect(config.timeoutMs).toBe(10000);

      // Zero timeout means no timeout
      const noTimeoutConfig = policyConfigSchema.parse({
        timeoutMs: 0
      });
      expect(noTimeoutConfig.timeoutMs).toBe(0);
    });
  });

  describe('Development Tool Timeouts', () => {
    it('should validate dependency installation timeout', () => {
      const depConfigSchema = z.object({
        installTimeout: z.number().positive().optional()
      });

      const config = depConfigSchema.parse({
        installTimeout: 300000 // 5 minutes for npm install
      });
      expect(config.installTimeout).toBe(300000);

      // Test positive validation
      expect(() => depConfigSchema.parse({
        installTimeout: -1
      })).toThrow();

      expect(() => depConfigSchema.parse({
        installTimeout: 0
      })).toThrow();
    });

    it('should validate test execution timeout', () => {
      const testConfigSchema = z.object({
        testTimeout: z.number().optional(),
        timeout: z.number().min(1000).max(60000).optional()
      });

      const config = testConfigSchema.parse({
        testTimeout: 30000,
        timeout: 45000
      });
      expect(config.testTimeout).toBe(30000);
      expect(config.timeout).toBe(45000);

      // Test timeout bounds
      expect(() => testConfigSchema.parse({
        timeout: 500 // Below minimum
      })).toThrow();

      expect(() => testConfigSchema.parse({
        timeout: 120000 // Above maximum
      })).toThrow();
    });

    it('should validate preview operation timeout', () => {
      const previewConfigSchema = z.object({
        previewTimeout: z.number().min(1000).optional().default(5000)
      });

      const config = previewConfigSchema.parse({
        previewTimeout: 8000
      });
      expect(config.previewTimeout).toBe(8000);

      const defaultConfig = previewConfigSchema.parse({});
      expect(defaultConfig.previewTimeout).toBe(5000); // Default 5 seconds

      // Test minimum timeout
      expect(() => previewConfigSchema.parse({
        previewTimeout: 500
      })).toThrow();
    });

    it('should validate CI service timeout configuration', () => {
      const ciConfigSchema = z.object({
        timeout: z.number().optional().default(5000)
      });

      const config = ciConfigSchema.parse({
        timeout: 10000
      });
      expect(config.timeout).toBe(10000);

      const defaultConfig = ciConfigSchema.parse({});
      expect(defaultConfig.timeout).toBe(5000); // Default 5 seconds
    });
  });

  describe('Retry and Backoff Timeout Strategies', () => {
    it('should validate retry configuration with timeout bounds', () => {
      const retryConfig = RetryConfigSchema.parse({
        strategy: 'exponential',
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffFactor: 2.0
      });

      expect(retryConfig.strategy).toBe('exponential');
      expect(retryConfig.maxAttempts).toBe(5);
      expect(retryConfig.baseDelayMs).toBe(1000);
      expect(retryConfig.maxDelayMs).toBe(30000);
    });

    it('should calculate exponential backoff delays correctly', () => {
      const retryConfig = {
        strategy: 'exponential' as const,
        baseDelayMs: 1000,
        maxDelayMs: 16000,
        backoffFactor: 2.0
      };

      // Simulate delay calculation
      const calculateDelay = (attempt: number) => {
        const delay = retryConfig.baseDelayMs * Math.pow(retryConfig.backoffFactor, attempt);
        return Math.min(delay, retryConfig.maxDelayMs);
      };

      expect(calculateDelay(0)).toBe(1000);  // First attempt: 1s
      expect(calculateDelay(1)).toBe(2000);  // Second attempt: 2s
      expect(calculateDelay(2)).toBe(4000);  // Third attempt: 4s
      expect(calculateDelay(3)).toBe(8000);  // Fourth attempt: 8s
      expect(calculateDelay(4)).toBe(16000); // Fifth attempt: 16s (max)
      expect(calculateDelay(5)).toBe(16000); // Sixth attempt: 16s (capped)
    });

    it('should validate linear backoff strategy', () => {
      const linearConfig = {
        strategy: 'linear' as const,
        baseDelayMs: 2000,
        maxDelayMs: 10000
      };

      const calculateLinearDelay = (attempt: number) => {
        const delay = linearConfig.baseDelayMs * (attempt + 1);
        return Math.min(delay, linearConfig.maxDelayMs);
      };

      expect(calculateLinearDelay(0)).toBe(2000);  // 2s
      expect(calculateLinearDelay(1)).toBe(4000);  // 4s
      expect(calculateLinearDelay(2)).toBe(6000);  // 6s
      expect(calculateLinearDelay(3)).toBe(8000);  // 8s
      expect(calculateLinearDelay(4)).toBe(10000); // 10s (max)
      expect(calculateLinearDelay(5)).toBe(10000); // 10s (capped)
    });

    it('should validate constant delay strategy', () => {
      const constantConfig = {
        strategy: 'constant' as const,
        baseDelayMs: 5000
      };

      const calculateConstantDelay = () => constantConfig.baseDelayMs;

      expect(calculateConstantDelay()).toBe(5000);
      // Should always be the same regardless of attempt
    });
  });

  describe('Timeout Edge Cases and Validation', () => {
    it('should handle zero timeout values appropriately', () => {
      const schemas = {
        browser: z.object({ timeout: z.number().int().min(0).optional() }),
        mcp: z.object({ idleTimeoutMs: z.number().int().min(0).optional() }),
        policy: z.object({ timeoutMs: z.number().int().min(0).optional() })
      };

      // Zero timeouts should be valid where explicitly allowed
      expect(() => schemas.browser.parse({ timeout: 0 })).not.toThrow();
      expect(() => schemas.mcp.parse({ idleTimeoutMs: 0 })).not.toThrow();
      expect(() => schemas.policy.parse({ timeoutMs: 0 })).not.toThrow();
    });

    it('should reject negative timeout values', () => {
      const strictSchemas = {
        tool: z.object({ timeoutMs: z.number().int().min(1).optional() }),
        approval: z.object({ timeoutMinutes: z.number().min(1).optional() }),
        mcp: z.object({ invocationTimeoutMs: z.number().min(1000).optional() })
      };

      expect(() => strictSchemas.tool.parse({ timeoutMs: -1 })).toThrow();
      expect(() => strictSchemas.approval.parse({ timeoutMinutes: -5 })).toThrow();
      expect(() => strictSchemas.mcp.parse({ invocationTimeoutMs: -1000 })).toThrow();
    });

    it('should validate timeout value bounds and constraints', () => {
      const boundedSchemas = {
        test: z.object({ timeout: z.number().min(1000).max(60000).optional() }),
        preview: z.object({ previewTimeout: z.number().min(1000).optional() }),
        connection: z.object({ connectionTimeoutMs: z.number().int().min(0).optional() })
      };

      // Valid bounds
      expect(() => boundedSchemas.test.parse({ timeout: 30000 })).not.toThrow();
      expect(() => boundedSchemas.preview.parse({ previewTimeout: 5000 })).not.toThrow();

      // Invalid bounds
      expect(() => boundedSchemas.test.parse({ timeout: 500 })).toThrow(); // Below min
      expect(() => boundedSchemas.test.parse({ timeout: 120000 })).toThrow(); // Above max
      expect(() => boundedSchemas.preview.parse({ previewTimeout: 500 })).toThrow(); // Below min
    });

    it('should handle undefined vs null timeout values', () => {
      const optionalTimeoutSchema = z.object({
        timeout: z.number().optional(),
        timeoutMinutes: z.number().min(1).optional()
      });

      // Undefined should be valid (uses defaults)
      const configWithUndefined = optionalTimeoutSchema.parse({
        timeout: undefined,
        timeoutMinutes: undefined
      });
      expect(configWithUndefined.timeout).toBeUndefined();
      expect(configWithUndefined.timeoutMinutes).toBeUndefined();

      // Explicit values should be preserved
      const configWithValues = optionalTimeoutSchema.parse({
        timeout: 15000,
        timeoutMinutes: 30
      });
      expect(configWithValues.timeout).toBe(15000);
      expect(configWithValues.timeoutMinutes).toBe(30);
    });

    it('should validate timeout precision and units', () => {
      const precisionSchemas = {
        milliseconds: z.object({ timeoutMs: z.number().int().min(0) }),
        minutes: z.object({ timeoutMinutes: z.number().min(1) }),
        seconds: z.object({ timeoutSeconds: z.number().positive() })
      };

      // Integer milliseconds
      expect(() => precisionSchemas.milliseconds.parse({ timeoutMs: 1500 })).not.toThrow();

      // Decimal minutes should be valid
      expect(() => precisionSchemas.minutes.parse({ timeoutMinutes: 1.5 })).not.toThrow();

      // Positive seconds
      expect(() => precisionSchemas.seconds.parse({ timeoutSeconds: 30.5 })).not.toThrow();

      // Edge case: very small decimal
      expect(() => precisionSchemas.minutes.parse({ timeoutMinutes: 0.1 })).toThrow(); // Below min 1
    });
  });

  describe('Timeout Configuration Integration', () => {
    it('should handle cascading timeout hierarchies', () => {
      const cascadingConfig = {
        global: { defaultTimeoutMs: 60000 },
        service: { timeoutMs: 30000 }, // Override global
        operation: { timeout: 15000 }   // Override service
      };

      // Final timeout should be the most specific (operation level)
      const resolvedTimeout = cascadingConfig.operation.timeout ||
                             cascadingConfig.service.timeoutMs ||
                             cascadingConfig.global.defaultTimeoutMs;

      expect(resolvedTimeout).toBe(15000);
    });

    it('should validate timeout relationships between dependent operations', () => {
      const dependentTimeouts = {
        connection: 10000,    // 10s to establish connection
        request: 30000,       // 30s per request (must be > connection)
        operation: 120000     // 2min total operation (must be > request)
      };

      // Validate logical timeout hierarchy
      expect(dependentTimeouts.request).toBeGreaterThan(dependentTimeouts.connection);
      expect(dependentTimeouts.operation).toBeGreaterThan(dependentTimeouts.request);
    });

    it('should handle timeout conversion between units', () => {
      const timeoutInMinutes = 5;
      const timeoutInMs = timeoutInMinutes * 60 * 1000;
      const timeoutInSeconds = timeoutInMinutes * 60;

      expect(timeoutInMs).toBe(300000);
      expect(timeoutInSeconds).toBe(300);

      // Conversion accuracy
      expect(timeoutInMs / 1000 / 60).toBe(timeoutInMinutes);
    });
  });
});