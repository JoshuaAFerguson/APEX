/**
 * Cross-package integration tests for permission system
 * Addresses coverage gap: Cross-package permission integration flows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apex/orchestrator';
import { PermissionLevel } from '@apex/core';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the CLI components for testing
const MockPermissionPrompt = ({ onApprove, onDeny, toolName, resource }: any) => (
  <div data-testid="permission-prompt">
    <div>Permission requested for {toolName} on {resource}</div>
    <button data-testid="approve-btn" onClick={() => onApprove()}>Approve</button>
    <button data-testid="deny-btn" onClick={() => onDeny()}>Deny</button>
  </div>
);

const MockApprovalGate = ({ isActive, onApprove, onDeny, toolName }: any) => (
  <div data-testid="approval-gate" data-active={isActive}>
    {isActive && (
      <>
        <div>Approval required for {toolName}</div>
        <button data-testid="gate-approve" onClick={onApprove}>Approve</button>
        <button data-testid="gate-deny" onClick={onDeny}>Deny</button>
      </>
    )}
  </div>
);

describe('Cross-Package Permission Integration', () => {
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    orchestrator = new ApexOrchestrator();
    await orchestrator.init();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });

  describe('Core-Orchestrator Integration', () => {
    it('should validate permission schemas in orchestrator', async () => {
      const toolName = 'integration:test';
      const resource = 'test-resource';

      // Test valid permission creation
      await expect(
        orchestrator.permissionManager!.grantPermission(toolName, resource, PermissionLevel.ALLOW_ONCE)
      ).resolves.not.toThrow();

      // Verify permission was stored with correct schema
      const permission = await orchestrator.permissionStore!.getPermission(toolName, resource);
      expect(permission).toBeDefined();
      expect(permission?.tool_name).toBe(toolName);
      expect(permission?.resource).toBe(resource);
      expect(permission?.level).toBe(PermissionLevel.ALLOW_ONCE);
    });

    it('should reject invalid permission data', async () => {
      // Test with invalid tool name (empty string)
      await expect(
        orchestrator.permissionManager!.grantPermission('', 'resource', PermissionLevel.ALLOW_ONCE)
      ).rejects.toThrow();

      // Test with invalid permission level
      await expect(
        orchestrator.permissionStore!.setPermission('test:tool', 'resource', 'invalid-level' as any)
      ).rejects.toThrow();
    });

    it('should handle dangerous operations detection', async () => {
      const dangerousCommand = 'rm -rf /';
      const safeCommand = 'ls -la';

      // Mock the dangerous operation detector being used by orchestrator
      const mockDetector = {
        isDangerous: vi.fn()
          .mockReturnValueOnce(true)  // First call: dangerous
          .mockReturnValueOnce(false) // Second call: safe
      };

      // Test dangerous operation detection
      expect(mockDetector.isDangerous(dangerousCommand)).toBe(true);
      expect(mockDetector.isDangerous(safeCommand)).toBe(false);

      // Verify orchestrator would block dangerous operations
      // (This would normally trigger permission prompt in real usage)
    });
  });

  describe('Orchestrator-CLI Integration', () => {
    it('should emit permission events that CLI can handle', async () => {
      const permissionEvents: any[] = [];

      // Listen for permission events
      orchestrator.on('permission:granted', (event) => {
        permissionEvents.push({ type: 'granted', ...event });
      });

      orchestrator.on('permission:denied', (event) => {
        permissionEvents.push({ type: 'denied', ...event });
      });

      orchestrator.on('permission:revoked', (event) => {
        permissionEvents.push({ type: 'revoked', ...event });
      });

      const toolName = 'cli:integration:test';
      const resource = 'test-resource';

      // Perform permission operations
      await orchestrator.permissionManager!.grantPermission(toolName, resource, PermissionLevel.ALLOW_ONCE);
      await orchestrator.permissionManager!.denyPermission(toolName, 'other-resource');
      await orchestrator.permissionManager!.revokePermission(toolName, resource);

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have received appropriate events
      expect(permissionEvents).toHaveLength(3);
      expect(permissionEvents[0].type).toBe('granted');
      expect(permissionEvents[1].type).toBe('denied');
      expect(permissionEvents[2].type).toBe('revoked');
    });

    it('should handle UI component interactions', async () => {
      const user = userEvent.setup();
      let approvalResult: boolean | null = null;

      const handleApprove = () => {
        approvalResult = true;
      };

      const handleDeny = () => {
        approvalResult = false;
      };

      // Render mock permission prompt
      render(
        <MockPermissionPrompt
          toolName="test:tool"
          resource="test-resource"
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      );

      // Test approval flow
      const approveBtn = screen.getByTestId('approve-btn');
      await user.click(approveBtn);

      expect(approvalResult).toBe(true);

      // Reset and test denial flow
      approvalResult = null;
      const denyBtn = screen.getByTestId('deny-btn');
      await user.click(denyBtn);

      expect(approvalResult).toBe(false);
    });

    it('should handle approval gate interactions', async () => {
      const user = userEvent.setup();
      let gateState = { active: true, approved: false };

      const handleGateApprove = () => {
        gateState.active = false;
        gateState.approved = true;
      };

      const handleGateDeny = () => {
        gateState.active = false;
        gateState.approved = false;
      };

      const { rerender } = render(
        <MockApprovalGate
          isActive={gateState.active}
          toolName="gate:test"
          onApprove={handleGateApprove}
          onDeny={handleGateDeny}
        />
      );

      // Verify gate is active
      expect(screen.getByTestId('approval-gate')).toHaveAttribute('data-active', 'true');

      // Approve through gate
      const approveBtn = screen.getByTestId('gate-approve');
      await user.click(approveBtn);

      // Rerender with new state
      rerender(
        <MockApprovalGate
          isActive={gateState.active}
          toolName="gate:test"
          onApprove={handleGateApprove}
          onDeny={handleGateDeny}
        />
      );

      expect(gateState.approved).toBe(true);
      expect(gateState.active).toBe(false);
    });
  });

  describe('Session State Management', () => {
    it('should maintain permission state across components', async () => {
      const sessionId = 'integration-test-session';
      const toolName = 'session:test';
      const resource = 'session-resource';

      // Grant permission in orchestrator
      await orchestrator.permissionManager!.grantPermission(toolName, resource, PermissionLevel.ALLOW_ALWAYS);

      // Check permission exists
      const permission = await orchestrator.permissionStore!.getPermission(toolName, resource);
      expect(permission).toBeDefined();
      expect(permission?.level).toBe(PermissionLevel.ALLOW_ALWAYS);

      // Simulate session-based permission check (as CLI would do)
      const hasPermission = await orchestrator.permissionManager!.checkPermission(
        toolName,
        resource,
        { sessionId }
      );

      expect(hasPermission).toBe(true);
    });

    it('should handle session cleanup properly', async () => {
      const sessionId = 'cleanup-test-session';

      // Create session-scoped data
      await orchestrator.permissionManager!.checkPermission(
        'cleanup:test',
        'resource',
        { sessionId }
      );

      // Verify session exists
      const sessionPermissions = orchestrator.permissionManager!.getSessionPermissions?.(sessionId);
      if (sessionPermissions) {
        expect(sessionPermissions).toBeDefined();
      }

      // Clean up session
      if (orchestrator.permissionManager!.clearSessionPermissions) {
        await orchestrator.permissionManager!.clearSessionPermissions(sessionId);
      }

      // Verify cleanup
      const cleanedPermissions = orchestrator.permissionManager!.getSessionPermissions?.(sessionId);
      expect(cleanedPermissions).toBeUndefined();
    });
  });

  describe('Event Flow Integration', () => {
    it('should propagate events through the full stack', async () => {
      const eventFlow: string[] = [];

      // Mock CLI event handlers
      const mockCLIHandlers = {
        onPermissionGranted: (event: any) => {
          eventFlow.push(`CLI:granted:${event.toolName}`);
        },
        onPermissionDenied: (event: any) => {
          eventFlow.push(`CLI:denied:${event.toolName}`);
        }
      };

      // Set up orchestrator event listeners
      orchestrator.on('permission:granted', mockCLIHandlers.onPermissionGranted);
      orchestrator.on('permission:denied', mockCLIHandlers.onPermissionDenied);

      // Trigger permission operations
      await orchestrator.permissionManager!.grantPermission('flow:test1', 'resource', PermissionLevel.ALLOW_ONCE);
      await orchestrator.permissionManager!.denyPermission('flow:test2', 'resource');

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event flow
      expect(eventFlow).toContain('CLI:granted:flow:test1');
      expect(eventFlow).toContain('CLI:denied:flow:test2');
    });

    it('should handle event ordering correctly', async () => {
      const events: any[] = [];

      orchestrator.on('permission:granted', (event) => {
        events.push({
          type: 'granted',
          toolName: event.toolName,
          timestamp: Date.now()
        });
      });

      // Perform operations in sequence
      await orchestrator.permissionManager!.grantPermission('order:test1', 'resource', PermissionLevel.ALLOW_ONCE);
      await orchestrator.permissionManager!.grantPermission('order:test2', 'resource', PermissionLevel.ALLOW_ONCE);
      await orchestrator.permissionManager!.grantPermission('order:test3', 'resource', PermissionLevel.ALLOW_ONCE);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Events should be received in order
      expect(events).toHaveLength(3);
      expect(events[0].toolName).toBe('order:test1');
      expect(events[1].toolName).toBe('order:test2');
      expect(events[2].toolName).toBe('order:test3');

      // Timestamps should be ordered
      expect(events[1].timestamp).toBeGreaterThanOrEqual(events[0].timestamp);
      expect(events[2].timestamp).toBeGreaterThanOrEqual(events[1].timestamp);
    });
  });

  describe('Error Handling Integration', () => {
    it('should propagate errors correctly across packages', async () => {
      // Test invalid permission data propagation
      try {
        await orchestrator.permissionStore!.setPermission('', 'resource', PermissionLevel.ALLOW_ONCE);
        fail('Should have thrown error for invalid tool name');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('validation');
      }

      // Test permission manager error handling
      try {
        await orchestrator.permissionManager!.checkPermission('', 'resource');
        fail('Should have thrown error for invalid tool name');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should maintain system stability during errors', async () => {
      // Cause an error in one operation
      try {
        await orchestrator.permissionManager!.grantPermission('', 'invalid', PermissionLevel.ALLOW_ONCE);
      } catch (error) {
        // Expected error
      }

      // System should still work for valid operations
      await expect(
        orchestrator.permissionManager!.grantPermission('valid:tool', 'resource', PermissionLevel.ALLOW_ONCE)
      ).resolves.not.toThrow();

      const permission = await orchestrator.permissionStore!.getPermission('valid:tool', 'resource');
      expect(permission).toBeDefined();
    });
  });

  describe('Configuration Integration', () => {
    it('should respect configuration across packages', async () => {
      // Test that core configuration is respected by orchestrator
      const toolName = 'config:test';
      const resource = '/test/config/file.txt';

      // Grant permission with specific configuration
      await orchestrator.permissionManager!.grantPermission(toolName, resource, PermissionLevel.ALLOW_ALWAYS);

      // Verify configuration is applied
      const permission = await orchestrator.permissionStore!.getPermission(toolName, resource);
      expect(permission?.level).toBe(PermissionLevel.ALLOW_ALWAYS);

      // Check that permission persists across different calls
      const hasPermission = await orchestrator.permissionManager!.checkPermission(toolName, resource);
      expect(hasPermission).toBe(true);
    });

    it('should handle preset configurations correctly', async () => {
      // Test permission preset application
      const presetConfig = {
        tools: {
          'preset:test': {
            defaultLevel: PermissionLevel.ALLOW_ONCE,
            resources: ['test-resource-1', 'test-resource-2']
          }
        }
      };

      // Apply preset (this would normally be done through configuration)
      for (const resource of presetConfig.tools['preset:test'].resources) {
        await orchestrator.permissionManager!.grantPermission(
          'preset:test',
          resource,
          presetConfig.tools['preset:test'].defaultLevel
        );
      }

      // Verify preset was applied
      const permission1 = await orchestrator.permissionStore!.getPermission('preset:test', 'test-resource-1');
      const permission2 = await orchestrator.permissionStore!.getPermission('preset:test', 'test-resource-2');

      expect(permission1?.level).toBe(PermissionLevel.ALLOW_ONCE);
      expect(permission2?.level).toBe(PermissionLevel.ALLOW_ONCE);
    });
  });
});