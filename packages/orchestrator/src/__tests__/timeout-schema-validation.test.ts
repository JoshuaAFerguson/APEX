/**
 * @fileoverview Timeout Configuration Schema Validation Tests
 *
 * Validates that all timeout configurations in types.ts work correctly
 * and that their validation rules are properly enforced.
 */

import { describe, it, expect } from 'vitest';
import {
  // Browser related schemas
  WaitOptionsSchema,
  NavigateParamsSchema,
  BrowserConfigSchema,

  // Tool related schemas
  CustomToolConfigSchema,
  MCPToolRequestSchema,
  MCPToolConfigSchema,

  // Workflow and approval schemas
  WorkflowGateConfigSchema,
  ApprovalGateSchema,
  ApprovalRequestSchema,
  ApprovalStateSchema,

  // Hook schemas
  WorkflowHookConfigSchema,
  ToolHookConfigSchema,

  // Linter schemas
  LinterPluginConfigSchema,
  LinterGlobalConfigSchema,
  LinterPostHookConfigSchema,

  // Policy and other schemas
  PolicyCheckOptionsSchema,
  QueryOptionsSchema,
  ScreenshotOptionsSchema,

  // Status and event schemas
  GateStatusSchema,
  ApprovalResolutionEventSchema,
  ApprovalRuleConfigSchema,
} from '@apexcli/core';

describe('Timeout Schema Validation Tests', () => {
  describe('Browser Timeout Schema Validation', () => {
    describe('WaitOptionsSchema', () => {
      it('should validate timeout field correctly', () => {
        const validOptions = {
          timeout: 30000,
          state: 'visible' as const,
        };

        const result = WaitOptionsSchema.safeParse(validOptions);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(30000);
        }
      });

      it('should reject negative timeout values', () => {
        const invalidOptions = {
          timeout: -5000,
          state: 'visible' as const,
        };

        const result = WaitOptionsSchema.safeParse(invalidOptions);
        expect(result.success).toBe(false);
      });

      it('should accept zero timeout', () => {
        const validOptions = {
          timeout: 0,
          state: 'hidden' as const,
        };

        const result = WaitOptionsSchema.safeParse(validOptions);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(0);
        }
      });

      it('should make timeout optional', () => {
        const validOptions = {
          state: 'visible' as const,
        };

        const result = WaitOptionsSchema.safeParse(validOptions);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBeUndefined();
        }
      });
    });

    describe('NavigateParamsSchema', () => {
      it('should validate navigation timeout', () => {
        const validParams = {
          url: 'https://example.com',
          waitUntil: 'load' as const,
          timeout: 60000,
        };

        const result = NavigateParamsSchema.safeParse(validParams);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(60000);
        }
      });

      it('should reject negative navigation timeout', () => {
        const invalidParams = {
          url: 'https://example.com',
          timeout: -10000,
        };

        const result = NavigateParamsSchema.safeParse(invalidParams);
        expect(result.success).toBe(false);
      });
    });

    describe('BrowserConfigSchema', () => {
      it('should validate browser config with timeout', () => {
        const validConfig = {
          headless: true,
          timeout: 45000,
          viewport: { width: 1920, height: 1080 },
        };

        const result = BrowserConfigSchema.safeParse(validConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(45000);
        }
      });

      it('should apply default timeout when not specified', () => {
        const configWithoutTimeout = {
          headless: true,
          viewport: { width: 1920, height: 1080 },
        };

        const result = BrowserConfigSchema.safeParse(configWithoutTimeout);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(30000);
        }
      });

      it('should enforce minimum timeout value', () => {
        const invalidConfig = {
          headless: true,
          timeout: 500, // Below minimum of 1000
          viewport: { width: 1920, height: 1080 },
        };

        const result = BrowserConfigSchema.safeParse(invalidConfig);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Tool Timeout Schema Validation', () => {
    describe('CustomToolConfigSchema', () => {
      it('should validate tool config with timeout', () => {
        const validConfig = {
          name: 'test-tool',
          implementation: 'internal' as const,
          timeoutMs: 120000,
        };

        const result = CustomToolConfigSchema.safeParse(validConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(120000);
        }
      });

      it('should apply default timeout for tools', () => {
        const configWithoutTimeout = {
          name: 'test-tool',
          implementation: 'internal' as const,
        };

        const result = CustomToolConfigSchema.safeParse(configWithoutTimeout);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(60000);
        }
      });

      it('should reject zero or negative timeout', () => {
        const invalidConfig = {
          name: 'test-tool',
          implementation: 'internal' as const,
          timeoutMs: 0,
        };

        const result = CustomToolConfigSchema.safeParse(invalidConfig);
        expect(result.success).toBe(false);
      });

      it('should reject non-integer timeout values', () => {
        const invalidConfig = {
          name: 'test-tool',
          implementation: 'internal' as const,
          timeoutMs: 1000.5,
        };

        const result = CustomToolConfigSchema.safeParse(invalidConfig);
        expect(result.success).toBe(false);
      });
    });

    describe('MCPToolRequestSchema', () => {
      it('should validate MCP tool request with timeout', () => {
        const validRequest = {
          method: 'test-method',
          parameters: { key: 'value' },
          timeout: 30000,
          requestId: 'req-123',
        };

        const result = MCPToolRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(30000);
        }
      });

      it('should allow zero timeout for MCP requests', () => {
        const validRequest = {
          method: 'test-method',
          parameters: { key: 'value' },
          timeout: 0,
        };

        const result = MCPToolRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(0);
        }
      });

      it('should reject negative timeout for MCP requests', () => {
        const invalidRequest = {
          method: 'test-method',
          parameters: { key: 'value' },
          timeout: -5000,
        };

        const result = MCPToolRequestSchema.safeParse(invalidRequest);
        expect(result.success).toBe(false);
      });
    });

    describe('MCPToolConfigSchema', () => {
      it('should validate MCP tool config with timeout', () => {
        const validConfig = {
          name: 'mcp-tool',
          description: 'Test MCP tool',
          timeout: 45000,
        };

        const result = MCPToolConfigSchema.safeParse(validConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(45000);
        }
      });

      it('should make timeout optional for MCP tools', () => {
        const validConfig = {
          name: 'mcp-tool',
          description: 'Test MCP tool',
        };

        const result = MCPToolConfigSchema.safeParse(validConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBeUndefined();
        }
      });
    });
  });

  describe('Approval and Gate Timeout Schema Validation', () => {
    describe('WorkflowGateConfigSchema', () => {
      it('should validate workflow gate with timeout', () => {
        const validGate = {
          id: 'test-gate',
          type: 'approval' as const,
          approvers: ['user1', 'user2'],
          timeout: 60,
        };

        const result = WorkflowGateConfigSchema.safeParse(validGate);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(60);
        }
      });

      it('should reject negative timeout for workflow gates', () => {
        const invalidGate = {
          id: 'test-gate',
          type: 'approval' as const,
          timeout: -30,
        };

        const result = WorkflowGateConfigSchema.safeParse(invalidGate);
        expect(result.success).toBe(false);
      });

      it('should make timeout optional for workflow gates', () => {
        const validGate = {
          id: 'test-gate',
          type: 'approval' as const,
        };

        const result = WorkflowGateConfigSchema.safeParse(validGate);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBeUndefined();
        }
      });
    });

    describe('ApprovalGateSchema', () => {
      it('should validate approval gate with timeout and auto-approve settings', () => {
        const validGate = {
          id: 'approval-gate',
          type: 'confirmation' as const,
          message: 'Approve this action?',
          timeout: 120,
          autoApproveOnTimeout: false,
          minApprovals: 2,
        };

        const result = ApprovalGateSchema.safeParse(validGate);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(120);
          expect(result.data.autoApproveOnTimeout).toBe(false);
        }
      });

      it('should enforce minimum value for timeout', () => {
        const invalidGate = {
          id: 'approval-gate',
          type: 'confirmation' as const,
          message: 'Approve?',
          timeout: 0, // Should be at least 1
        };

        const result = ApprovalGateSchema.safeParse(invalidGate);
        expect(result.success).toBe(false);
      });

      it('should apply default values for auto-approve settings', () => {
        const gateWithDefaults = {
          id: 'approval-gate',
          type: 'confirmation' as const,
          message: 'Approve?',
          timeout: 60,
        };

        const result = ApprovalGateSchema.safeParse(gateWithDefaults);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.autoApprove).toBe(false);
          expect(result.data.autoApproveOnTimeout).toBe(false);
        }
      });
    });

    describe('ApprovalRequestSchema', () => {
      it('should validate approval request with timeout minutes', () => {
        const validRequest = {
          id: 'req-123',
          message: 'Please approve',
          requestedAt: new Date(),
          timeoutMinutes: 30,
        };

        const result = ApprovalRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMinutes).toBe(30);
        }
      });

      it('should enforce minimum timeout minutes', () => {
        const invalidRequest = {
          id: 'req-123',
          message: 'Please approve',
          requestedAt: new Date(),
          timeoutMinutes: 0, // Should be at least 1
        };

        const result = ApprovalRequestSchema.safeParse(invalidRequest);
        expect(result.success).toBe(false);
      });
    });

    describe('ApprovalStateSchema', () => {
      it('should validate approval state with timeout configuration', () => {
        const validState = {
          id: 'state-123',
          status: 'pending' as const,
          message: 'Waiting for approval',
          requestedAt: new Date(),
          timeoutMinutes: 45,
          expiresAt: new Date(Date.now() + 45 * 60 * 1000),
        };

        const result = ApprovalStateSchema.safeParse(validState);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMinutes).toBe(45);
          expect(result.data.expiresAt).toBeDefined();
        }
      });
    });

    describe('ApprovalRuleConfigSchema', () => {
      it('should validate approval rule with timeout configuration', () => {
        const validRule = {
          id: 'rule-123',
          name: 'High Risk Operation',
          description: 'Requires approval for high-risk operations',
          urgency: 'high' as const,
          timeoutMinutes: 15,
          timeoutAction: 'reject' as const,
        };

        const result = ApprovalRuleConfigSchema.safeParse(validRule);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMinutes).toBe(15);
          expect(result.data.timeoutAction).toBe('reject');
        }
      });

      it('should apply default timeout action', () => {
        const ruleWithDefaults = {
          id: 'rule-123',
          name: 'Test Rule',
          urgency: 'normal' as const,
          timeoutMinutes: 60,
        };

        const result = ApprovalRuleConfigSchema.safeParse(ruleWithDefaults);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutAction).toBe('reject');
        }
      });
    });
  });

  describe('Hook Timeout Schema Validation', () => {
    describe('WorkflowHookConfigSchema', () => {
      it('should validate workflow hook with timeout', () => {
        const validHook = {
          name: 'pre-deployment',
          stage: 'pre' as const,
          script: 'npm run lint',
          timeoutMs: 90000,
          failOnError: true,
        };

        const result = WorkflowHookConfigSchema.safeParse(validHook);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(90000);
        }
      });

      it('should apply default timeout for workflow hooks', () => {
        const hookWithDefaults = {
          name: 'post-deployment',
          stage: 'post' as const,
          script: 'npm run test',
        };

        const result = WorkflowHookConfigSchema.safeParse(hookWithDefaults);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(30000);
        }
      });

      it('should enforce minimum timeout for workflow hooks', () => {
        const invalidHook = {
          name: 'quick-hook',
          stage: 'pre' as const,
          script: 'echo test',
          timeoutMs: 500, // Below minimum of 1000
        };

        const result = WorkflowHookConfigSchema.safeParse(invalidHook);
        expect(result.success).toBe(false);
      });
    });

    describe('ToolHookConfigSchema', () => {
      it('should validate tool hook with custom timeout', () => {
        const validHook = {
          name: 'tool-validator',
          stage: 'pre' as const,
          script: 'validate-tool.sh',
          timeoutMs: 45000,
          tools: ['custom-tool'],
        };

        const result = ToolHookConfigSchema.safeParse(validHook);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(45000);
        }
      });

      it('should apply default timeout for tool hooks', () => {
        const hookWithDefaults = {
          name: 'tool-cleanup',
          stage: 'post' as const,
          script: 'cleanup.sh',
        };

        const result = ToolHookConfigSchema.safeParse(hookWithDefaults);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(30000);
        }
      });

      it('should enforce minimum timeout for tool hooks', () => {
        const invalidHook = {
          name: 'instant-hook',
          stage: 'pre' as const,
          script: ':',
          timeoutMs: 50, // Below minimum
        };

        const result = ToolHookConfigSchema.safeParse(invalidHook);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Linter Timeout Schema Validation', () => {
    describe('LinterPluginConfigSchema', () => {
      it('should validate linter plugin with timeout', () => {
        const validConfig = {
          name: 'eslint',
          command: 'npx eslint',
          timeoutMs: 60000,
          enabled: true,
        };

        const result = LinterPluginConfigSchema.safeParse(validConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(60000);
        }
      });

      it('should apply default timeout for linter plugins', () => {
        const configWithDefaults = {
          name: 'prettier',
          command: 'npx prettier --check',
        };

        const result = LinterPluginConfigSchema.safeParse(configWithDefaults);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(30000);
        }
      });
    });

    describe('LinterGlobalConfigSchema', () => {
      it('should validate global linter config with timeout', () => {
        const validConfig = {
          enabled: true,
          maxConcurrency: 3,
          timeoutMs: 120000,
          workingDirectory: '/project',
        };

        const result = LinterGlobalConfigSchema.safeParse(validConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(120000);
        }
      });

      it('should apply default global timeout', () => {
        const configWithDefaults = {
          enabled: true,
          maxConcurrency: 5,
        };

        const result = LinterGlobalConfigSchema.safeParse(configWithDefaults);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(60000);
        }
      });
    });

    describe('LinterPostHookConfigSchema', () => {
      it('should validate linter post-hook with timeout', () => {
        const validConfig = {
          enabled: true,
          runAfterEdit: true,
          command: 'npm run format',
          timeoutMs: 90000,
        };

        const result = LinterPostHookConfigSchema.safeParse(validConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(90000);
        }
      });

      it('should apply default timeout for linter post-hooks', () => {
        const configWithDefaults = {
          enabled: true,
          runAfterEdit: false,
        };

        const result = LinterPostHookConfigSchema.safeParse(configWithDefaults);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(60000);
        }
      });
    });
  });

  describe('Miscellaneous Timeout Schema Validation', () => {
    describe('PolicyCheckOptionsSchema', () => {
      it('should validate policy check options with timeout', () => {
        const validOptions = {
          timeoutMs: 15000,
        };

        const result = PolicyCheckOptionsSchema.safeParse(validOptions);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(15000);
        }
      });

      it('should allow zero timeout for policy checks', () => {
        const validOptions = {
          timeoutMs: 0,
        };

        const result = PolicyCheckOptionsSchema.safeParse(validOptions);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(0);
        }
      });

      it('should make timeout optional for policy checks', () => {
        const validOptions = {};

        const result = PolicyCheckOptionsSchema.safeParse(validOptions);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBeUndefined();
        }
      });
    });

    describe('QueryOptionsSchema', () => {
      it('should validate query options with timeout', () => {
        const validOptions = {
          timeoutMs: 45000,
        };

        const result = QueryOptionsSchema.safeParse(validOptions);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(45000);
        }
      });

      it('should reject negative timeout for queries', () => {
        const invalidOptions = {
          timeoutMs: -5000,
        };

        const result = QueryOptionsSchema.safeParse(invalidOptions);
        expect(result.success).toBe(false);
      });
    });

    describe('ScreenshotOptionsSchema', () => {
      it('should validate screenshot options with timeout', () => {
        const validOptions = {
          fullPage: true,
          quality: 90,
          timeout: 10000,
          viewport: { width: 1920, height: 1080 },
        };

        const result = ScreenshotOptionsSchema.safeParse(validOptions);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(10000);
        }
      });

      it('should enforce timeout range for screenshots', () => {
        const invalidLowTimeout = {
          timeout: 500, // Below minimum of 1000
        };

        const invalidHighTimeout = {
          timeout: 120000, // Above maximum of 60000
        };

        expect(ScreenshotOptionsSchema.safeParse(invalidLowTimeout).success).toBe(false);
        expect(ScreenshotOptionsSchema.safeParse(invalidHighTimeout).success).toBe(false);
      });

      it('should accept timeout within valid range', () => {
        const validTimeout = {
          timeout: 30000, // Within 1000-60000 range
        };

        const result = ScreenshotOptionsSchema.safeParse(validTimeout);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeout).toBe(30000);
        }
      });
    });
  });

  describe('Status and Event Schema Validation', () => {
    describe('GateStatusSchema', () => {
      it('should include timeout status', () => {
        const timeoutStatus = 'timeout';
        const result = GateStatusSchema.safeParse(timeoutStatus);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe('timeout');
        }
      });

      it('should accept all valid gate statuses', () => {
        const validStatuses = ['pending', 'approved', 'rejected', 'skipped', 'timeout'];

        validStatuses.forEach(status => {
          const result = GateStatusSchema.safeParse(status);
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid gate status', () => {
        const invalidStatus = 'invalid-status';
        const result = GateStatusSchema.safeParse(invalidStatus);

        expect(result.success).toBe(false);
      });
    });

    describe('ApprovalResolutionEventSchema', () => {
      it('should validate approval resolution with timeout', () => {
        const validEvent = {
          id: 'event-123',
          resolution: 'timeout' as const,
          timestamp: new Date(),
        };

        const result = ApprovalResolutionEventSchema.safeParse(validEvent);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.resolution).toBe('timeout');
        }
      });

      it('should accept all valid resolution types', () => {
        const validResolutions = ['approved', 'denied', 'timeout', 'cancelled'];

        validResolutions.forEach(resolution => {
          const event = {
            id: 'event-123',
            resolution,
            timestamp: new Date(),
          };

          const result = ApprovalResolutionEventSchema.safeParse(event);
          expect(result.success).toBe(true);
        });
      });
    });
  });

  describe('Complex Timeout Configuration Scenarios', () => {
    it('should handle nested timeout configurations', () => {
      const complexConfig = {
        browser: {
          headless: true,
          timeout: 45000,
          viewport: { width: 1920, height: 1080 },
        },
        tools: {
          customTool: {
            name: 'complex-tool',
            implementation: 'internal' as const,
            timeoutMs: 120000,
          },
        },
        hooks: {
          pre: {
            name: 'pre-hook',
            stage: 'pre' as const,
            script: 'setup.sh',
            timeoutMs: 60000,
          },
        },
        approvals: {
          gate: {
            id: 'security-gate',
            type: 'confirmation' as const,
            message: 'Security review required',
            timeout: 240, // 4 hours
            autoApproveOnTimeout: false,
          },
        },
      };

      // Validate each component independently
      expect(BrowserConfigSchema.safeParse(complexConfig.browser).success).toBe(true);
      expect(CustomToolConfigSchema.safeParse(complexConfig.tools.customTool).success).toBe(true);
      expect(WorkflowHookConfigSchema.safeParse(complexConfig.hooks.pre).success).toBe(true);
      expect(ApprovalGateSchema.safeParse(complexConfig.approvals.gate).success).toBe(true);
    });

    it('should validate timeout consistency across related components', () => {
      // Tool execution timeout should be reasonable compared to hook timeout
      const toolConfig = {
        name: 'analysis-tool',
        implementation: 'internal' as const,
        timeoutMs: 300000, // 5 minutes
      };

      const hookConfig = {
        name: 'tool-preparation',
        stage: 'pre' as const,
        script: 'prepare.sh',
        timeoutMs: 60000, // 1 minute
      };

      const toolResult = CustomToolConfigSchema.safeParse(toolConfig);
      const hookResult = WorkflowHookConfigSchema.safeParse(hookConfig);

      expect(toolResult.success).toBe(true);
      expect(hookResult.success).toBe(true);

      if (toolResult.success && hookResult.success) {
        // Hook timeout should be less than tool timeout for logical consistency
        expect(hookResult.data.timeoutMs).toBeLessThan(toolResult.data.timeoutMs);
      }
    });

    it('should handle timeout configurations with environment variations', () => {
      const environmentConfigs = {
        development: {
          browser: { timeout: 15000 },
          tool: { timeoutMs: 30000 },
          approval: { timeout: 30 }, // 30 minutes
        },
        production: {
          browser: { timeout: 60000 },
          tool: { timeoutMs: 300000 },
          approval: { timeout: 240 }, // 4 hours
        },
      };

      Object.entries(environmentConfigs).forEach(([env, config]) => {
        // Each environment should have valid but different timeout values
        const browserSchema = BrowserConfigSchema.partial();
        const toolSchema = CustomToolConfigSchema.partial();
        const approvalSchema = ApprovalGateSchema.partial();

        expect(browserSchema.safeParse(config.browser).success).toBe(true);
        expect(toolSchema.safeParse(config.tool).success).toBe(true);
        expect(approvalSchema.safeParse(config.approval).success).toBe(true);

        if (env === 'production') {
          // Production timeouts should be more generous
          expect(config.browser.timeout).toBeGreaterThan(environmentConfigs.development.browser.timeout);
          expect(config.tool.timeoutMs).toBeGreaterThan(environmentConfigs.development.tool.timeoutMs);
          expect(config.approval.timeout).toBeGreaterThan(environmentConfigs.development.approval.timeout);
        }
      });
    });
  });
});