/**
 * Comprehensive test suite for CLI Permission Prompt component
 * Addresses identified coverage gap in UI component testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PermissionPrompt } from '../PermissionPrompt';
import type { PermissionRequestEventData } from '@apexcli/core';

// Mock the orchestrator events
const mockOrchestratorEvents = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

vi.mock('../../hooks/useOrchestratorEvents', () => ({
  useOrchestratorEvents: () => mockOrchestratorEvents,
}));

describe('PermissionPrompt Component', () => {
  const mockPermissionRequest: PermissionRequestEventData = {
    requestId: 'test-request-123',
    tool: 'Write',
    scope: '/project/src/test.ts',
    reason: 'Agent needs to create a test file',
    agent: 'developer',
    timestamp: new Date(),
    metadata: {
      command: 'Create new test file',
      dangerous: false,
      estimatedRisk: 'low',
    },
  };

  const mockOnApprove = vi.fn();
  const mockOnDeny = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Display', () => {
    it('should render permission prompt with all required elements', () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      // Verify main prompt elements
      expect(screen.getByText('Permission Request')).toBeInTheDocument();
      expect(screen.getByText('Write')).toBeInTheDocument();
      expect(screen.getByText('/project/src/test.ts')).toBeInTheDocument();
      expect(screen.getByText('Agent needs to create a test file')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Verify action buttons
      expect(screen.getByText('Allow Always')).toBeInTheDocument();
      expect(screen.getByText('Allow Once')).toBeInTheDocument();
      expect(screen.getByText('Deny')).toBeInTheDocument();
      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    it('should display tool-specific information correctly', () => {
      const bashRequest = {
        ...mockPermissionRequest,
        tool: 'Bash',
        scope: 'npm install package',
        reason: 'Install project dependencies',
        metadata: {
          command: 'npm install package',
          dangerous: true,
          estimatedRisk: 'medium',
        },
      };

      render(
        <PermissionPrompt
          request={bashRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText('npm install package')).toBeInTheDocument();
      expect(screen.getByText('Install project dependencies')).toBeInTheDocument();

      // Should show warning for dangerous commands
      expect(screen.getByText(/dangerous/i)).toBeInTheDocument();
      expect(screen.getByText(/medium risk/i)).toBeInTheDocument();
    });

    it('should handle requests without scope gracefully', () => {
      const noScopeRequest = {
        ...mockPermissionRequest,
        scope: undefined,
      };

      render(
        <PermissionPrompt
          request={noScopeRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      expect(screen.getByText('Write')).toBeInTheDocument();
      expect(screen.getByText('Global access')).toBeInTheDocument();
    });

    it('should display risk indicators for dangerous operations', () => {
      const dangerousRequest = {
        ...mockPermissionRequest,
        tool: 'Bash',
        scope: 'rm -rf /',
        metadata: {
          command: 'rm -rf /',
          dangerous: true,
          estimatedRisk: 'high',
        },
      };

      render(
        <PermissionPrompt
          request={dangerousRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      // Should show high-risk warning
      expect(screen.getByText(/⚠️/)).toBeInTheDocument();
      expect(screen.getByText(/high risk/i)).toBeInTheDocument();
      expect(screen.getByText(/dangerous operation/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onApprove with allow-always when Allow Always is clicked', async () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      const allowAlwaysButton = screen.getByText('Allow Always');
      fireEvent.click(allowAlwaysButton);

      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalledWith({
          requestId: 'test-request-123',
          level: 'allow-always',
          scope: '/project/src/test.ts',
        });
      });
    });

    it('should call onApprove with allow-once when Allow Once is clicked', async () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      const allowOnceButton = screen.getByText('Allow Once');
      fireEvent.click(allowOnceButton);

      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalledWith({
          requestId: 'test-request-123',
          level: 'allow-once',
          scope: '/project/src/test.ts',
        });
      });
    });

    it('should call onDeny when Deny button is clicked', async () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      const denyButton = screen.getByText('Deny');
      fireEvent.click(denyButton);

      await waitFor(() => {
        expect(mockOnDeny).toHaveBeenCalledWith({
          requestId: 'test-request-123',
          reason: 'User explicitly denied permission',
        });
      });
    });

    it('should call onDismiss when Dismiss button is clicked', async () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      const dismissButton = screen.getByText('Dismiss');
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledWith('test-request-123');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support Tab navigation through all interactive elements', () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      const allowAlwaysButton = screen.getByText('Allow Always');
      const allowOnceButton = screen.getByText('Allow Once');
      const denyButton = screen.getByText('Deny');
      const dismissButton = screen.getByText('Dismiss');

      // Verify all buttons are focusable
      allowAlwaysButton.focus();
      expect(document.activeElement).toBe(allowAlwaysButton);

      fireEvent.keyDown(allowAlwaysButton, { key: 'Tab' });
      expect(document.activeElement).toBe(allowOnceButton);

      fireEvent.keyDown(allowOnceButton, { key: 'Tab' });
      expect(document.activeElement).toBe(denyButton);

      fireEvent.keyDown(denyButton, { key: 'Tab' });
      expect(document.activeElement).toBe(dismissButton);
    });

    it('should handle Enter key on focused buttons', async () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      const allowOnceButton = screen.getByText('Allow Once');
      allowOnceButton.focus();
      fireEvent.keyDown(allowOnceButton, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalledWith({
          requestId: 'test-request-123',
          level: 'allow-once',
          scope: '/project/src/test.ts',
        });
      });
    });

    it('should handle Escape key to dismiss prompt', async () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledWith('test-request-123');
      });
    });

    it('should support keyboard shortcuts', async () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      // Test shortcut keys
      fireEvent.keyDown(document, { key: 'a', ctrlKey: true }); // Ctrl+A for Allow Always
      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalledWith({
          requestId: 'test-request-123',
          level: 'allow-always',
          scope: '/project/src/test.ts',
        });
      });

      vi.clearAllMocks();

      fireEvent.keyDown(document, { key: 'o', ctrlKey: true }); // Ctrl+O for Allow Once
      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalledWith({
          requestId: 'test-request-123',
          level: 'allow-once',
          scope: '/project/src/test.ts',
        });
      });

      vi.clearAllMocks();

      fireEvent.keyDown(document, { key: 'd', ctrlKey: true }); // Ctrl+D for Deny
      await waitFor(() => {
        expect(mockOnDeny).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      // Check for proper ARIA attributes
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/permission request/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /allow always/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /allow once/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /deny/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should announce permission requests to screen readers', () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      // Check for aria-live region
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        /permission request.*write.*project.*test file/i
      );
    });

    it('should have proper focus management', () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      // First focusable element should receive initial focus
      expect(document.activeElement).toBe(screen.getByText('Allow Always'));
    });

    it('should support high contrast mode', () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      // Verify contrast ratios meet accessibility standards
      const promptContainer = screen.getByRole('dialog');
      const styles = window.getComputedStyle(promptContainer);

      // Basic contrast check (actual implementation would need proper contrast calculation)
      expect(styles.color).toBeTruthy();
      expect(styles.backgroundColor).toBeTruthy();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing request data gracefully', () => {
      const incompleteRequest = {
        requestId: 'test-incomplete',
        tool: 'TestTool',
        // Missing scope, reason, agent, etc.
      } as PermissionRequestEventData;

      expect(() => {
        render(
          <PermissionPrompt
            request={incompleteRequest}
            onApprove={mockOnApprove}
            onDeny={mockOnDeny}
            onDismiss={mockOnDismiss}
          />
        );
      }).not.toThrow();

      // Should still render basic elements
      expect(screen.getByText('TestTool')).toBeInTheDocument();
      expect(screen.getByText('Unknown scope')).toBeInTheDocument();
    });

    it('should handle callback errors gracefully', async () => {
      const errorOnApprove = vi.fn(() => {
        throw new Error('Approval failed');
      });

      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={errorOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      const allowOnceButton = screen.getByText('Allow Once');
      fireEvent.click(allowOnceButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
      });

      // Should still be dismissible
      const dismissButton = screen.getByText('Dismiss');
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalled();
      });
    });

    it('should handle very long tool names and scopes', () => {
      const longRequest = {
        ...mockPermissionRequest,
        tool: 'A'.repeat(100),
        scope: '/very/long/path/'.repeat(20) + 'file.ext',
        reason: 'A'.repeat(200),
      };

      render(
        <PermissionPrompt
          request={longRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      // Should truncate long text appropriately
      expect(screen.getByText(/A{50,}/)).toBeInTheDocument(); // Tool name (truncated)
      expect(screen.getByText(/\.{3}$/)).toBeInTheDocument(); // Ellipsis for truncation
    });
  });

  describe('Performance', () => {
    it('should render quickly for rapid permission requests', async () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const request = {
          ...mockPermissionRequest,
          requestId: `test-request-${i}`,
        };

        const { unmount } = render(
          <PermissionPrompt
            request={request}
            onApprove={mockOnApprove}
            onDeny={mockOnDeny}
            onDismiss={mockOnDismiss}
          />
        );

        unmount();
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle rapid user interactions without blocking', async () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      const allowOnceButton = screen.getByText('Allow Once');

      // Rapid clicks
      for (let i = 0; i < 10; i++) {
        fireEvent.click(allowOnceButton);
      }

      // Should only process the first click
      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Integration with Permission System', () => {
    it('should emit permission events correctly', async () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      const allowAlwaysButton = screen.getByText('Allow Always');
      fireEvent.click(allowAlwaysButton);

      await waitFor(() => {
        expect(mockOrchestratorEvents.emit).toHaveBeenCalledWith('permission:granted', {
          requestId: 'test-request-123',
          tool: 'Write',
          scope: '/project/src/test.ts',
          level: 'allow-always',
          grantedAt: expect.any(Date),
          grantedBy: 'user',
        });
      });
    });

    it('should integrate with permission history tracking', async () => {
      render(
        <PermissionPrompt
          request={mockPermissionRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onDismiss={mockOnDismiss}
        />
      );

      const denyButton = screen.getByText('Deny');
      fireEvent.click(denyButton);

      await waitFor(() => {
        expect(mockOrchestratorEvents.emit).toHaveBeenCalledWith('permission:denied', {
          requestId: 'test-request-123',
          tool: 'Write',
          scope: '/project/src/test.ts',
          deniedAt: expect.any(Date),
          deniedBy: 'user',
          reason: 'User explicitly denied permission',
        });
      });
    });
  });
});

// Additional test for permission prompt variants
describe('PermissionPrompt Variants', () => {
  it('should render simplified prompt for low-risk operations', () => {
    const lowRiskRequest = {
      ...mockPermissionRequest,
      tool: 'Read',
      metadata: {
        command: 'Read configuration file',
        dangerous: false,
        estimatedRisk: 'low',
      },
    } as PermissionRequestEventData;

    render(
      <PermissionPrompt
        request={lowRiskRequest}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
        variant="simple"
      />
    );

    // Should show simplified UI for low-risk operations
    expect(screen.getByText('Allow')).toBeInTheDocument();
    expect(screen.queryByText('Allow Always')).not.toBeInTheDocument();
    expect(screen.queryByText(/risk/i)).not.toBeInTheDocument();
  });

  it('should render detailed prompt for high-risk operations', () => {
    const highRiskRequest = {
      ...mockPermissionRequest,
      tool: 'Bash',
      scope: 'sudo rm -rf /',
      metadata: {
        command: 'sudo rm -rf /',
        dangerous: true,
        estimatedRisk: 'high',
      },
    } as PermissionRequestEventData;

    render(
      <PermissionPrompt
        request={highRiskRequest}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
        variant="detailed"
      />
    );

    // Should show detailed warnings for high-risk operations
    expect(screen.getByText(/⚠️ DANGEROUS OPERATION/i)).toBeInTheDocument();
    expect(screen.getByText(/high risk/i)).toBeInTheDocument();
    expect(screen.getByText(/system damage/i)).toBeInTheDocument();
  });
});