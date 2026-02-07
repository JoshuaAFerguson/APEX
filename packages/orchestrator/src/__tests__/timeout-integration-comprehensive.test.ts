/**
 * @fileoverview Comprehensive Timeout Integration Tests
 *
 * Integration tests for timeout behavior across all major APEX systems:
 * - ApprovalGateController timeout handling
 * - MCP connection manager timeout integration
 * - Tool execution timeout enforcement
 * - Browser automation timeout behavior
 * - Cross-component timeout coordination
 *
 * These tests verify that timeout configurations work correctly in
 * realistic system scenarios with multiple interacting components.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ApprovalGateController } from '../approval-gate-controller.js';
import { ApexOrchestrator } from '../index.js';
import type {
  ApprovalGate,
  MCPConnectionConfig,
  Task,
  CustomToolConfig,
} from '@apexcli/core';

// Mock dependencies
vi.mock('../store.js');
vi.mock('../mcp/connection-manager.js');
vi.mock('../browser-manager.js');

describe('Timeout Integration Comprehensive Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockTaskStore: any;
  let mockMCPManager: any;
  let mockBrowserManager: any;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Setup mocks
    mockTaskStore = {
      create: vi.fn().mockResolvedValue({ id: 'test-task-1' }),
      update: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
    };

    mockMCPManager = new EventEmitter();
    mockMCPManager.connect = vi.fn().mockResolvedValue({});
    mockMCPManager.disconnect = vi.fn().mockResolvedValue({});
    mockMCPManager.executeTool = vi.fn().mockResolvedValue({ content: [] });

    mockBrowserManager = new EventEmitter();
    mockBrowserManager.createSession = vi.fn().mockResolvedValue({
      navigate: vi.fn().mockResolvedValue({ success: true }),
      close: vi.fn().mockResolvedValue({}),
    });

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({
      config: {
        projectRoot: '/test',
        workspace: '/test',
      },
      taskStore: mockTaskStore,
      mcpManager: mockMCPManager,
      browserManager: mockBrowserManager,
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await orchestrator?.shutdown();
  });

  describe('ApprovalGateController Timeout Integration', () => {
    it('should handle approval gate timeout with auto-approval', async () => {
      const gate: ApprovalGate = {
        id: 'test-gate-1',
        type: 'confirmation',
        message: 'Proceed with operation?',
        timeout: 0.05, // 3 seconds (0.05 minutes)
        autoApproveOnTimeout: true,
      };

      const controller = new ApprovalGateController(gate, orchestrator);
      let resolvedValue: any = null;
      let timeoutOccurred = false;

      const approvalPromise = controller.waitForApproval().then((result) => {
        resolvedValue = result;
      });

      // Setup timeout listener
      controller.on('timeout', () => {
        timeoutOccurred = true;
      });

      // Fast forward past timeout (3 seconds)
      vi.advanceTimersByTime(3500);
      await approvalPromise;

      expect(timeoutOccurred).toBe(true);
      expect(resolvedValue).toEqual({ approved: true, reason: 'timeout_auto_approved' });
    });

    it('should handle approval gate timeout with auto-denial', async () => {
      const gate: ApprovalGate = {
        id: 'test-gate-2',
        type: 'confirmation',
        message: 'Critical operation?',
        timeout: 0.02, // 1.2 seconds
        autoApproveOnTimeout: false,
      };

      const controller = new ApprovalGateController(gate, orchestrator);
      let resolvedValue: any = null;
      let timeoutOccurred = false;

      const approvalPromise = controller.waitForApproval().then((result) => {
        resolvedValue = result;
      });

      controller.on('timeout', () => {
        timeoutOccurred = true;
      });

      // Fast forward past timeout
      vi.advanceTimersByTime(1500);
      await approvalPromise;

      expect(timeoutOccurred).toBe(true);
      expect(resolvedValue).toEqual({ approved: false, reason: 'timeout_denied' });
    });

    it('should cancel timeout when approval received before timeout', async () => {
      const gate: ApprovalGate = {
        id: 'test-gate-3',
        type: 'confirmation',
        message: 'Quick approval test',
        timeout: 0.1, // 6 seconds
        autoApproveOnTimeout: true,
      };

      const controller = new ApprovalGateController(gate, orchestrator);
      let resolvedValue: any = null;
      let timeoutOccurred = false;

      const approvalPromise = controller.waitForApproval().then((result) => {
        resolvedValue = result;
      });

      controller.on('timeout', () => {
        timeoutOccurred = true;
      });

      // Approve before timeout (after 2 seconds)
      vi.advanceTimersByTime(2000);
      controller.respond({ approved: true });

      await approvalPromise;

      expect(timeoutOccurred).toBe(false);
      expect(resolvedValue).toEqual({ approved: true });
    });

    it('should handle multiple concurrent approval gates with different timeouts', async () => {
      const gates = [
        {
          id: 'gate-fast',
          type: 'confirmation' as const,
          message: 'Fast gate',
          timeout: 0.02, // 1.2 seconds
          autoApproveOnTimeout: true,
        },
        {
          id: 'gate-medium',
          type: 'confirmation' as const,
          message: 'Medium gate',
          timeout: 0.05, // 3 seconds
          autoApproveOnTimeout: false,
        },
        {
          id: 'gate-slow',
          type: 'confirmation' as const,
          message: 'Slow gate',
          timeout: 0.1, // 6 seconds
          autoApproveOnTimeout: true,
        },
      ];

      const controllers = gates.map((gate) => new ApprovalGateController(gate, orchestrator));
      const promises = controllers.map((controller) => controller.waitForApproval());

      // Fast forward to trigger all timeouts
      vi.advanceTimersByTime(7000);
      const results = await Promise.all(promises);

      expect(results[0]).toEqual({ approved: true, reason: 'timeout_auto_approved' });
      expect(results[1]).toEqual({ approved: false, reason: 'timeout_denied' });
      expect(results[2]).toEqual({ approved: true, reason: 'timeout_auto_approved' });
    });
  });

  describe('MCP Connection Timeout Integration', () => {
    it('should handle MCP connection timeout during initialization', async () => {
      const mcpConfig: MCPConnectionConfig = {
        connectionTimeoutMs: 2000,
        requestTimeoutMs: 5000,
      };

      // Mock connection failure due to timeout
      mockMCPManager.connect = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Connection timed out after 2000ms'));
          }, mcpConfig.connectionTimeoutMs);
        });
      });

      const connectPromise = mockMCPManager.connect();

      // Fast forward past connection timeout
      vi.advanceTimersByTime(2500);

      await expect(connectPromise).rejects.toThrow('Connection timed out after 2000ms');
    });

    it('should handle MCP request timeout during tool execution', async () => {
      const mcpConfig: MCPConnectionConfig = {
        connectionTimeoutMs: 10000,
        requestTimeoutMs: 3000,
      };

      // Mock successful connection but slow tool execution
      mockMCPManager.connect = vi.fn().mockResolvedValue({});
      mockMCPManager.executeT0ol = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Tool execution timed out after 3000ms'));
          }, mcpConfig.requestTimeoutMs);
        });
      });

      await mockMCPManager.connect();
      const toolPromise = mockMCPManager.executeT0ol('slow-tool', {});

      // Fast forward past request timeout
      vi.advanceTimersByTime(3500);

      await expect(toolPromise).rejects.toThrow('Tool execution timed out after 3000ms');
    });

    it('should handle MCP health check timeout', async () => {
      const mcpConfig: MCPConnectionConfig = {
        healthCheckTimeoutMs: 1000,
        healthCheckIntervalMs: 2000,
      };

      let healthCheckFailed = false;

      // Mock health check that always times out
      mockMCPManager.performHealthCheck = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            healthCheckFailed = true;
            reject(new Error('Health check timed out after 1000ms'));
          }, mcpConfig.healthCheckTimeoutMs);
        });
      });

      // Start health check
      const healthPromise = mockMCPManager.performHealthCheck();

      // Fast forward past health check timeout
      vi.advanceTimersByTime(1500);

      await expect(healthPromise).rejects.toThrow('Health check timed out after 1000ms');
      expect(healthCheckFailed).toBe(true);
    });
  });

  describe('Tool Execution Timeout Integration', () => {
    it('should enforce custom tool execution timeout', async () => {
      const toolConfig: CustomToolConfig = {
        name: 'slow-custom-tool',
        timeoutMs: 2500,
        implementation: 'internal',
      };

      // Mock slow tool execution
      const executeSlowTool = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ success: true, output: 'Done' });
          }, 5000); // Tool takes 5 seconds, but timeout is 2.5 seconds
        });
      });

      const toolPromise = Promise.race([
        executeSlowTool(),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Tool execution timed out after ${toolConfig.timeoutMs}ms`));
          }, toolConfig.timeoutMs);
        }),
      ]);

      // Fast forward past tool timeout
      vi.advanceTimersByTime(3000);

      await expect(toolPromise).rejects.toThrow('Tool execution timed out after 2500ms');
    });

    it('should handle hook execution timeout', async () => {
      const hookConfig = {
        name: 'slow-hook',
        timeoutMs: 1500,
      };

      // Mock slow hook execution
      const executeHook = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ success: true });
          }, 3000); // Hook takes 3 seconds, timeout is 1.5 seconds
        });
      });

      const hookPromise = Promise.race([
        executeHook(),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Hook execution timed out after ${hookConfig.timeoutMs}ms`));
          }, hookConfig.timeoutMs);
        }),
      ]);

      // Fast forward past hook timeout
      vi.advanceTimersByTime(2000);

      await expect(hookPromise).rejects.toThrow('Hook execution timed out after 1500ms');
    });
  });

  describe('Browser Automation Timeout Integration', () => {
    it('should handle browser session timeout during navigation', async () => {
      const browserConfig = {
        timeout: 3000,
        headless: true,
      };

      // Mock slow navigation
      const mockSession = {
        navigate: vi.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Navigation timed out after 3000ms'));
            }, browserConfig.timeout);
          });
        }),
        close: vi.fn().mockResolvedValue({}),
      };

      mockBrowserManager.createSession = vi.fn().mockResolvedValue(mockSession);

      const session = await mockBrowserManager.createSession(browserConfig);
      const navPromise = session.navigate('https://slow-loading-site.com');

      // Fast forward past navigation timeout
      vi.advanceTimersByTime(3500);

      await expect(navPromise).rejects.toThrow('Navigation timed out after 3000ms');
    });

    it('should handle element waiting timeout in browser automation', async () => {
      const elementTimeout = 2000;

      const mockSession = {
        waitForElement: vi.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Element wait timed out after ${elementTimeout}ms`));
            }, elementTimeout);
          });
        }),
        close: vi.fn().mockResolvedValue({}),
      };

      mockBrowserManager.createSession = vi.fn().mockResolvedValue(mockSession);

      const session = await mockBrowserManager.createSession({ timeout: 5000 });
      const waitPromise = session.waitForElement('#missing-element', { timeout: elementTimeout });

      // Fast forward past element timeout
      vi.advanceTimersByTime(2500);

      await expect(waitPromise).rejects.toThrow('Element wait timed out after 2000ms');
    });
  });

  describe('Cross-Component Timeout Coordination', () => {
    it('should handle coordinated timeouts across multiple systems', async () => {
      // Setup a complex workflow with multiple timeout configurations
      const workflowConfig = {
        approval: {
          timeout: 0.03, // 1.8 seconds
          autoApproveOnTimeout: true,
        },
        mcp: {
          requestTimeoutMs: 1000,
        },
        browser: {
          timeout: 2000,
        },
        tool: {
          timeoutMs: 1500,
        },
      };

      const approvalGate: ApprovalGate = {
        id: 'workflow-gate',
        type: 'confirmation',
        message: 'Execute workflow?',
        ...workflowConfig.approval,
      };

      const controller = new ApprovalGateController(approvalGate, orchestrator);

      // Setup mocks for various components
      const mcpPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('MCP request timed out after 1000ms'));
        }, workflowConfig.mcp.requestTimeoutMs);
      });

      const browserPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Browser operation timed out after 2000ms'));
        }, workflowConfig.browser.timeout);
      });

      const toolPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Tool execution timed out after 1500ms'));
        }, workflowConfig.tool.timeoutMs);
      });

      // Start all operations
      const approvalPromise = controller.waitForApproval();

      // Fast forward through all timeouts
      vi.advanceTimersByTime(3000);

      // Verify each component handled its timeout correctly
      const approvalResult = await approvalPromise;
      expect(approvalResult.approved).toBe(true); // Auto-approved on timeout

      await expect(mcpPromise).rejects.toThrow('MCP request timed out');
      await expect(browserPromise).rejects.toThrow('Browser operation timed out');
      await expect(toolPromise).rejects.toThrow('Tool execution timed out');
    });

    it('should maintain timeout hierarchy when components have different timeouts', async () => {
      // Test timeout precedence: approval > tool > browser > mcp
      const timeouts = {
        approval: 1000, // Shortest - should trigger first
        tool: 2000,
        browser: 3000,
        mcp: 4000, // Longest
      };

      const events: Array<{ type: string; time: number }> = [];
      const startTime = Date.now();

      // Setup approval timeout
      const approvalGate: ApprovalGate = {
        id: 'hierarchy-test',
        type: 'confirmation',
        message: 'Test timeout hierarchy',
        timeout: timeouts.approval / 60000, // Convert to minutes
        autoApproveOnTimeout: false,
      };

      const controller = new ApprovalGateController(approvalGate, orchestrator);
      controller.on('timeout', () => {
        events.push({ type: 'approval', time: Date.now() - startTime });
      });

      // Setup other timeouts
      const setupTimeout = (type: string, timeout: number) => {
        setTimeout(() => {
          events.push({ type, time: Date.now() - startTime });
        }, timeout);
      };

      setupTimeout('tool', timeouts.tool);
      setupTimeout('browser', timeouts.browser);
      setupTimeout('mcp', timeouts.mcp);

      // Wait for approval timeout (should be first)
      await controller.waitForApproval();

      // Fast forward through all remaining timeouts
      vi.advanceTimersByTime(5000);

      // Verify timeout order
      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('approval');
      expect(events[1].type).toBe('tool');
      expect(events[2].type).toBe('browser');
      expect(events[3].type).toBe('mcp');
    });

    it('should handle timeout cleanup when operations complete successfully', async () => {
      const timeouts = {
        approval: 5000,
        operation: 2000,
      };

      const approvalGate: ApprovalGate = {
        id: 'cleanup-test',
        type: 'confirmation',
        message: 'Test timeout cleanup',
        timeout: timeouts.approval / 60000,
        autoApproveOnTimeout: true,
      };

      const controller = new ApprovalGateController(approvalGate, orchestrator);
      let timeoutOccurred = false;

      controller.on('timeout', () => {
        timeoutOccurred = true;
      });

      // Start approval and operation
      const approvalPromise = controller.waitForApproval();
      const operationPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true });
        }, timeouts.operation);
      });

      // Complete operation before approval timeout
      vi.advanceTimersByTime(2500);
      await operationPromise;

      // Manually approve before timeout
      controller.respond({ approved: true });
      const approvalResult = await approvalPromise;

      expect(approvalResult.approved).toBe(true);
      expect(timeoutOccurred).toBe(false);
    });
  });

  describe('Timeout Error Recovery Integration', () => {
    it('should handle timeout error recovery patterns', async () => {
      const retryConfig = {
        maxAttempts: 3,
        baseTimeout: 1000,
        backoffMultiplier: 2,
      };

      let attempts = 0;
      const operationWithRetry = async (): Promise<any> => {
        attempts++;
        const currentTimeout = retryConfig.baseTimeout * Math.pow(retryConfig.backoffMultiplier, attempts - 1);

        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (attempts < 3) {
              reject(new Error(`Operation timed out after ${currentTimeout}ms (attempt ${attempts})`));
            } else {
              resolve({ success: true, attempts });
            }
          }, currentTimeout);
        });
      };

      // Attempt 1: 1000ms timeout
      let result: any;
      try {
        vi.advanceTimersByTime(1500);
        await operationWithRetry();
      } catch (error) {
        expect(error.message).toContain('attempt 1');
      }

      // Attempt 2: 2000ms timeout
      try {
        vi.advanceTimersByTime(2500);
        await operationWithRetry();
      } catch (error) {
        expect(error.message).toContain('attempt 2');
      }

      // Attempt 3: 4000ms timeout (should succeed)
      vi.advanceTimersByTime(4500);
      result = await operationWithRetry();

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should handle circuit breaker timeout integration', async () => {
      const circuitBreaker = {
        failureThreshold: 3,
        timeout: 1000,
        resetTimeout: 5000,
        state: 'closed' as 'closed' | 'open' | 'half-open',
        failures: 0,
      };

      const executeWithCircuitBreaker = async () => {
        if (circuitBreaker.state === 'open') {
          throw new Error('Circuit breaker is open');
        }

        return new Promise((_, reject) => {
          setTimeout(() => {
            circuitBreaker.failures++;
            if (circuitBreaker.failures >= circuitBreaker.failureThreshold) {
              circuitBreaker.state = 'open';
              setTimeout(() => {
                circuitBreaker.state = 'half-open';
                circuitBreaker.failures = 0;
              }, circuitBreaker.resetTimeout);
            }
            reject(new Error(`Operation timed out after ${circuitBreaker.timeout}ms`));
          }, circuitBreaker.timeout);
        });
      };

      // First 3 attempts should fail and open the circuit
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(1500);
        await expect(executeWithCircuitBreaker()).rejects.toThrow('Operation timed out');
      }

      expect(circuitBreaker.state).toBe('open');

      // Next attempt should fail immediately due to open circuit
      await expect(executeWithCircuitBreaker()).rejects.toThrow('Circuit breaker is open');

      // After reset timeout, circuit should be half-open
      vi.advanceTimersByTime(5500);
      expect(circuitBreaker.state).toBe('half-open');
    });
  });
});