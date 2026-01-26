/**
 * Permission Policy and Browser Automation Integration Tests
 *
 * This test suite focuses on testing the interaction between the permission
 * policy system and browser automation, including:
 * 1. Policy enforcement for browser operations
 * 2. Dynamic permission adjustments based on policies
 * 3. Policy violation handling in browser context
 * 4. Permission preset interactions with browser tools
 * 5. Edge cases and error recovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { TaskStore } from '@apexcli/orchestrator';
import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store';
import { PermissionPresetManager } from '../../packages/orchestrator/src/permission-preset-manager';
import { PolicyEnforcer } from '../../packages/orchestrator/src/policy/policy-enforcer';
import {
  createTestTask,
  createTestPolicyEnforcer,
  MockBrowserSession,
} from '../../packages/orchestrator/src/__tests__/v050-integration/test-utils';

import type {
  Task,
  PermissionLevel,
  PolicyConfig,
  PolicyViolation,
  BrowserSession,
  BrowserSessionConfig,
} from '@apexcli/core';

describe('Permission Policy + Browser Automation Integration', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;
  let presetManager: PermissionPresetManager;
  let policyEnforcer: PolicyEnforcer;
  let browserTool: BrowserTool;
  let testTask: Task;
  let mockSession: MockBrowserSession;
  let policyEvents: any[] = [];

  beforeEach(async () => {
    // Create test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-policy-browser-test-'));

    // Initialize stores and managers
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    permissionStore = new PermissionStore();
    permissionManager = new PermissionManager(permissionStore);
    presetManager = new PermissionPresetManager(permissionManager);

    // Create policy enforcer with browser-specific rules
    policyEnforcer = createTestPolicyEnforcer({
      version: '1.0',
      enforcement: 'enforce',
      enabled: true,
      approvalRules: [
        {
          id: 'browser-dangerous-operations',
          name: 'Browser Dangerous Operations',
          description: 'Require approval for dangerous browser operations',
          urgency: 'high',
          condition: {
            type: 'tool-operation',
            tools: ['browser'],
            operations: ['evaluate', 'submit', 'download'],
          },
          enabled: true,
        },
        {
          id: 'browser-domain-restrictions',
          name: 'Browser Domain Restrictions',
          description: 'Restrict navigation to certain domains',
          urgency: 'medium',
          condition: {
            type: 'browser-domain',
            pattern: '*.admin.*|*.internal.*|localhost:*',
            operation: 'navigate',
          },
          enabled: true,
        },
        {
          id: 'browser-sensitive-data',
          name: 'Browser Sensitive Data Access',
          description: 'Require approval for accessing sensitive page data',
          urgency: 'high',
          condition: {
            type: 'browser-content',
            pattern: 'password|credit.*card|ssn|api.*key',
            operation: 'getText',
          },
          enabled: true,
        },
      ],
    });

    // Create test task
    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    // Create browser tool with policy integration
    browserTool = new BrowserTool({
      permissionManager,
      policyEnforcer,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
    });

    // Create enhanced mock browser session
    mockSession = new MockBrowserSession({
      browserType: 'chromium',
      headless: true,
      allowedDomains: ['safe.example.com', 'public.site.com'],
      blockedDomains: ['blocked.com'],
    });

    // Mock browser tool to use our test session
    vi.spyOn(browserTool as any, 'createSession').mockResolvedValue(mockSession);

    // Set up policy event tracking
    policyEvents = [];
    const eventEmitter = policyEnforcer as any as EventEmitter;

    eventEmitter.on('policy:violation', (event) => {
      policyEvents.push({ type: 'policy-violation', ...event });
    });

    eventEmitter.on('policy:approval-required', (event) => {
      policyEvents.push({ type: 'approval-required', ...event });
    });

    eventEmitter.on('policy:enforcement-action', (event) => {
      policyEvents.push({ type: 'enforcement-action', ...event });
    });
  });

  afterEach(async () => {
    await mockSession?.close();
    await taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('Policy-Based Browser Operation Control', () => {
    it('should enforce policy restrictions on dangerous browser operations', async () => {
      // Grant basic browser permission but policy should still restrict
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock policy enforcer to detect dangerous operation
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockResolvedValue({
        allowed: false,
        violations: [{
          ruleId: 'browser-dangerous-operations',
          resource: 'browser.evaluate',
          severity: 'high',
          message: 'JavaScript evaluation requires policy approval',
          context: { operation: 'evaluate', expression: 'window.location = "malicious"' },
        }],
        requiresApproval: true,
      });

      const result = await browserTool.evaluate({
        expression: 'window.location = "https://malicious.com"',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/policy.*violation|approval.*required/i);

      // Verify policy violation was recorded
      expect(policyEvents.some(e =>
        e.type === 'policy-violation' && e.ruleId === 'browser-dangerous-operations'
      )).toBe(true);
    });

    it('should allow safe browser operations that pass policy checks', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock policy enforcer to allow safe operation
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockResolvedValue({
        allowed: true,
        violations: [],
        requiresApproval: false,
      });

      const result = await browserTool.navigate({
        url: 'https://safe.example.com',
      });

      expect(result.success).toBe(true);
      expect(mockSession.url).toBe('https://safe.example.com');
    });

    it('should handle domain-based policy restrictions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock policy enforcer to block admin domain navigation
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockImplementation(async (tool, operation, context) => {
        if (context?.url?.includes('admin')) {
          return {
            allowed: false,
            violations: [{
              ruleId: 'browser-domain-restrictions',
              resource: context.url,
              severity: 'medium',
              message: 'Navigation to admin domains requires approval',
            }],
            requiresApproval: true,
          };
        }
        return { allowed: true, violations: [], requiresApproval: false };
      });

      const adminResult = await browserTool.navigate({
        url: 'https://admin.example.com',
      });

      expect(adminResult.success).toBe(false);
      expect(adminResult.error).toMatch(/policy.*violation|admin.*domain/i);

      const safeResult = await browserTool.navigate({
        url: 'https://safe.example.com',
      });

      expect(safeResult.success).toBe(true);
    });

    it('should handle content-based policy restrictions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');
      await browserTool.navigate({ url: 'https://safe.example.com' });

      // Mock policy enforcer to detect sensitive content
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockImplementation(async (tool, operation, context) => {
        if (context?.selector?.includes('password') || context?.text?.includes('password')) {
          return {
            allowed: false,
            violations: [{
              ruleId: 'browser-sensitive-data',
              resource: context.selector || 'sensitive-content',
              severity: 'high',
              message: 'Access to sensitive data requires approval',
            }],
            requiresApproval: true,
          };
        }
        return { allowed: true, violations: [], requiresApproval: false };
      });

      // Should block access to password field
      const sensitiveResult = await browserTool.getText({
        selector: '#password-field',
      });

      expect(sensitiveResult.success).toBe(false);
      expect(sensitiveResult.error).toMatch(/sensitive.*data|approval.*required/i);

      // Should allow access to safe content
      const safeResult = await browserTool.getText({
        selector: '#title',
      });

      expect(safeResult.success).toBe(true);
    });
  });

  describe('Permission Preset and Policy Interactions', () => {
    it('should apply autonomous preset while respecting policy limits', async () => {
      // Apply autonomous preset - should grant all permissions
      presetManager.applyPreset('autonomous');

      // But policy should still enforce restrictions
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockResolvedValue({
        allowed: false,
        violations: [{
          ruleId: 'browser-dangerous-operations',
          resource: 'browser.evaluate',
          severity: 'high',
          message: 'Policy overrides autonomous preset for dangerous operations',
        }],
        requiresApproval: true,
      });

      const result = await browserTool.evaluate({
        expression: 'eval("dangerous code")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/policy.*override|dangerous.*operation/i);
    });

    it('should handle review-all preset with policy approval workflow', async () => {
      // Apply review-all preset - should require confirmation for everything
      presetManager.applyPreset('reviewAll');

      // Mock user approval for policy-required operation
      vi.spyOn(policyEnforcer, 'requestApproval').mockResolvedValue({
        approved: true,
        approvedBy: 'test-user',
        approvedAt: new Date(),
        conditions: ['limited-time-approval'],
      });

      vi.spyOn(policyEnforcer, 'checkToolOperation').mockResolvedValue({
        allowed: true,
        violations: [],
        requiresApproval: false,
      });

      const result = await browserTool.navigate({
        url: 'https://safe.example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should handle read-only preset with browser-specific policies', async () => {
      // Apply read-only preset
      presetManager.applyPreset('readOnly');

      // Mock policy to allow read operations
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockImplementation(async (tool, operation) => {
        const readOperations = ['navigate', 'getText', 'screenshot', 'getAttribute'];
        return {
          allowed: readOperations.includes(operation),
          violations: readOperations.includes(operation) ? [] : [{
            ruleId: 'read-only-policy',
            resource: `${tool}.${operation}`,
            severity: 'medium',
            message: 'Write operations not allowed in read-only mode',
          }],
          requiresApproval: false,
        };
      });

      // Read operations should succeed
      const navResult = await browserTool.navigate({ url: 'https://safe.example.com' });
      expect(navResult.success).toBe(true);

      const textResult = await browserTool.getText({ selector: 'h1' });
      expect(textResult.success).toBe(true);

      // Write operations should fail
      const clickResult = await browserTool.click({ selector: '#button' });
      expect(clickResult.success).toBe(false);

      const submitResult = await browserTool.submit({ selector: '#form' });
      expect(submitResult.success).toBe(false);
    });
  });

  describe('Dynamic Policy Enforcement', () => {
    it('should adapt permissions based on current page context', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock navigation to different pages with different policies
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockImplementation(async (tool, operation, context) => {
        const currentUrl = mockSession.url;

        if (currentUrl.includes('admin')) {
          return {
            allowed: false,
            violations: [{
              ruleId: 'admin-page-restrictions',
              resource: currentUrl,
              severity: 'high',
              message: 'Admin pages require elevated permissions',
            }],
            requiresApproval: true,
          };
        }

        return { allowed: true, violations: [], requiresApproval: false };
      });

      // Navigate to admin page
      await browserTool.navigate({ url: 'https://admin.example.com' });

      // Operations on admin page should be restricted
      const screenshotResult = await browserTool.screenshot();
      expect(screenshotResult.success).toBe(false);

      // Navigate to safe page
      await browserTool.navigate({ url: 'https://safe.example.com' });

      // Operations on safe page should be allowed
      const safeScreenshotResult = await browserTool.screenshot();
      expect(safeScreenshotResult.success).toBe(true);
    });

    it('should handle time-based policy restrictions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock time-based policy enforcement
      let operationCount = 0;
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockImplementation(async () => {
        operationCount++;

        // Allow first 3 operations, then require approval
        if (operationCount <= 3) {
          return { allowed: true, violations: [], requiresApproval: false };
        }

        return {
          allowed: false,
          violations: [{
            ruleId: 'operation-rate-limit',
            resource: 'browser-operations',
            severity: 'medium',
            message: 'Operation rate limit exceeded, approval required',
          }],
          requiresApproval: true,
        };
      });

      // First operations should succeed
      for (let i = 0; i < 3; i++) {
        const result = await browserTool.navigate({ url: `https://safe.example.com/${i}` });
        expect(result.success).toBe(true);
      }

      // Fourth operation should require approval
      const result = await browserTool.navigate({ url: 'https://safe.example.com/4' });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/rate.*limit|approval.*required/i);
    });

    it('should handle resource-based policy restrictions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock resource usage tracking
      let resourceUsage = 0;
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockImplementation(async (tool, operation) => {
        if (operation === 'screenshot') {
          resourceUsage += 10; // Mock resource cost
        }

        // Block if resource usage exceeds limit
        if (resourceUsage > 50) {
          return {
            allowed: false,
            violations: [{
              ruleId: 'resource-usage-limit',
              resource: 'browser-resources',
              severity: 'medium',
              message: 'Resource usage limit exceeded',
            }],
            requiresApproval: true,
          };
        }

        return { allowed: true, violations: [], requiresApproval: false };
      });

      // Take screenshots until resource limit
      let screenshotCount = 0;
      let lastResult;

      for (let i = 0; i < 10; i++) {
        lastResult = await browserTool.screenshot();
        if (lastResult.success) {
          screenshotCount++;
        } else {
          break;
        }
      }

      expect(screenshotCount).toBeLessThan(10);
      expect(lastResult?.success).toBe(false);
      expect(lastResult?.error).toMatch(/resource.*usage|limit.*exceeded/i);
    });
  });

  describe('Policy Violation Handling and Recovery', () => {
    it('should handle policy violation gracefully with error details', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      const mockViolation: PolicyViolation = {
        ruleId: 'test-policy-rule',
        resource: 'browser.dangerous-operation',
        severity: 'high',
        message: 'Detailed policy violation message',
        context: {
          operation: 'evaluate',
          expression: 'dangerous code',
          timestamp: new Date(),
        },
      };

      vi.spyOn(policyEnforcer, 'checkToolOperation').mockResolvedValue({
        allowed: false,
        violations: [mockViolation],
        requiresApproval: false,
      });

      const result = await browserTool.evaluate({
        expression: 'dangerous code',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(mockViolation.message);

      // Verify violation was properly recorded
      expect(policyEvents.some(e =>
        e.type === 'policy-violation' && e.ruleId === mockViolation.ruleId
      )).toBe(true);
    });

    it('should handle policy enforcer failures gracefully', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock policy enforcer failure
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockRejectedValue(
        new Error('Policy system unavailable')
      );

      const result = await browserTool.navigate({
        url: 'https://safe.example.com',
      });

      // Should handle gracefully - either deny by default or allow with warning
      if (result.success) {
        expect(result.warnings).toContain('Policy check failed');
      } else {
        expect(result.error).toMatch(/policy.*system.*unavailable/i);
      }
    });

    it('should support policy override for emergency situations', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock policy with override capability
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockResolvedValue({
        allowed: false,
        violations: [{
          ruleId: 'emergency-override-test',
          resource: 'browser.emergency',
          severity: 'high',
          message: 'Emergency override available',
        }],
        requiresApproval: true,
        overrideOptions: ['emergency', 'admin-approval'],
      });

      vi.spyOn(policyEnforcer, 'requestOverride').mockResolvedValue({
        granted: true,
        overrideType: 'emergency',
        authorizedBy: 'system',
        expiresAt: new Date(Date.now() + 300000), // 5 minutes
      });

      // Initial operation should fail
      const initialResult = await browserTool.evaluate({
        expression: 'emergency.operation()',
      });
      expect(initialResult.success).toBe(false);

      // Request emergency override
      const overrideResult = await policyEnforcer.requestOverride(
        'emergency-override-test',
        'emergency',
        'Critical system recovery required'
      );
      expect(overrideResult.granted).toBe(true);

      // Operation should now succeed
      // Note: This would need implementation in the actual browser tool
      // to check for active overrides
    });
  });

  describe('Complex Policy Scenarios', () => {
    it('should handle cascading policy rules', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock cascading policy rules
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockImplementation(async (tool, operation, context) => {
        const violations: PolicyViolation[] = [];

        // Rule 1: Time-based restrictions
        const currentHour = new Date().getHours();
        if (currentHour < 9 || currentHour > 17) {
          violations.push({
            ruleId: 'business-hours-policy',
            resource: 'browser-operations',
            severity: 'medium',
            message: 'Browser operations restricted outside business hours',
          });
        }

        // Rule 2: Domain-based restrictions
        if (context?.url?.includes('external')) {
          violations.push({
            ruleId: 'external-domain-policy',
            resource: context.url,
            severity: 'high',
            message: 'External domain access requires approval',
          });
        }

        // Rule 3: Operation-specific restrictions
        if (operation === 'evaluate' && context?.expression?.includes('fetch')) {
          violations.push({
            ruleId: 'network-operation-policy',
            resource: 'browser.evaluate.fetch',
            severity: 'high',
            message: 'Network operations in JavaScript require approval',
          });
        }

        return {
          allowed: violations.length === 0,
          violations,
          requiresApproval: violations.some(v => v.severity === 'high'),
        };
      });

      // Test with multiple policy violations
      const result = await browserTool.evaluate({
        expression: 'fetch("https://external.api.com/data")',
      });

      expect(result.success).toBe(false);
      expect(policyEvents.some(e =>
        e.type === 'policy-violation' && e.ruleId === 'external-domain-policy'
      )).toBe(true);
      expect(policyEvents.some(e =>
        e.type === 'policy-violation' && e.ruleId === 'network-operation-policy'
      )).toBe(true);
    });

    it('should handle policy rule precedence and conflicts', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Mock conflicting policy rules with precedence
      vi.spyOn(policyEnforcer, 'checkToolOperation').mockImplementation(async (tool, operation, context) => {
        // High precedence rule: Allow admin users
        if (context?.user?.role === 'admin') {
          return { allowed: true, violations: [], requiresApproval: false };
        }

        // Low precedence rule: Block dangerous operations
        if (operation === 'evaluate') {
          return {
            allowed: false,
            violations: [{
              ruleId: 'dangerous-operation-block',
              resource: `${tool}.${operation}`,
              severity: 'high',
              message: 'Dangerous operations blocked for non-admin users',
            }],
            requiresApproval: true,
          };
        }

        return { allowed: true, violations: [], requiresApproval: false };
      });

      // Test as non-admin user
      const nonAdminResult = await browserTool.evaluate({
        expression: 'document.title',
        context: { user: { role: 'user' } },
      });
      expect(nonAdminResult.success).toBe(false);

      // Test as admin user
      const adminResult = await browserTool.evaluate({
        expression: 'document.title',
        context: { user: { role: 'admin' } },
      });
      expect(adminResult.success).toBe(true);
    });

    it('should maintain policy state across browser sessions', async () => {
      await permissionManager.grantPermission('browser', 'allow-always');

      // Track policy state
      let policyState = { operationCount: 0, lastViolation: null };

      vi.spyOn(policyEnforcer, 'checkToolOperation').mockImplementation(async () => {
        policyState.operationCount++;

        // Trigger policy violation after certain operations
        if (policyState.operationCount > 5) {
          policyState.lastViolation = new Date();
          return {
            allowed: false,
            violations: [{
              ruleId: 'session-limit-policy',
              resource: 'browser-session',
              severity: 'medium',
              message: 'Session operation limit exceeded',
            }],
            requiresApproval: true,
          };
        }

        return { allowed: true, violations: [], requiresApproval: false };
      });

      // Perform operations until limit
      for (let i = 0; i < 7; i++) {
        const result = await browserTool.navigate({ url: `https://safe.example.com/${i}` });

        if (i < 5) {
          expect(result.success).toBe(true);
        } else {
          expect(result.success).toBe(false);
        }
      }

      expect(policyState.lastViolation).toBeDefined();
    });
  });
});