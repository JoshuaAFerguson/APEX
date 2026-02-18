/**
 * @fileoverview CLI Interactive Permission Testing
 *
 * High Priority Gap: CLI Interactive Permission Testing
 * Risk Level: Medium-High - Poor user experience, permission bypasses
 *
 * Tests cover:
 * - Permission prompt timeout handling
 * - User approval/denial flows
 * - Error state display and recovery
 * - Accessibility compliance testing
 * - Cross-platform CLI behavior validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventEmitter } from 'events';
import React from 'react';

// Import CLI components for testing
import { PermissionPrompt } from '../ui/components/permissions/PermissionPrompt';
import { PermissionNotificationDisplay } from '../ui/components/permissions/PermissionNotificationDisplay';
import { PermissionHistory } from '../ui/components/permissions/PermissionHistory';
import { useOrchestratorEvents } from '../ui/hooks/useOrchestratorEvents';

// Mock orchestrator events
const mockEventEmitter = new EventEmitter();

vi.mock('../ui/hooks/useOrchestratorEvents', () => ({
  useOrchestratorEvents: vi.fn(() => mockEventEmitter),
}));

describe('CLI Interactive Permission Testing', () => {
  let mockOnApprove: ReturnType<typeof vi.fn>;
  let mockOnDeny: ReturnType<typeof vi.fn>;
  let mockOnTimeout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnApprove = vi.fn();
    mockOnDeny = vi.fn();
    mockOnTimeout = vi.fn();

    // Reset event emitter
    mockEventEmitter.removeAllListeners();

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockEventEmitter.removeAllListeners();
  });

  describe('Permission Prompt Timeout Handling', () => {
    it('should handle prompt timeout gracefully', async () => {
      const mockRequest = {
        id: 'timeout-test-1',
        tool: 'Write',
        scope: '/test/file.txt',
        reason: 'File write operation',
        timeoutMs: 1000, // 1 second timeout
        dangerLevel: 'medium' as const,
      };

      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
        />
      );

      // Verify prompt is displayed
      expect(screen.getByText(/File write operation/)).toBeInTheDocument();
      expect(screen.getByText(/Write/)).toBeInTheDocument();

      // Wait for timeout
      await waitFor(
        () => {
          expect(mockOnTimeout).toHaveBeenCalledWith(mockRequest.id);
        },
        { timeout: 1500 }
      );

      // Verify timeout was called and handlers not called
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
      expect(mockOnApprove).not.toHaveBeenCalled();
      expect(mockOnDeny).not.toHaveBeenCalled();
    });

    it('should show timeout countdown to user', async () => {
      const mockRequest = {
        id: 'countdown-test',
        tool: 'Execute',
        scope: '/bin/script.sh',
        reason: 'Script execution',
        timeoutMs: 5000, // 5 second timeout
        dangerLevel: 'high' as const,
      };

      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          showCountdown={true}
        />
      );

      // Should show initial countdown
      expect(screen.getByText(/5/)).toBeInTheDocument();
      expect(screen.getByText(/seconds remaining/)).toBeInTheDocument();

      // Wait for countdown to update
      await waitFor(
        () => {
          expect(screen.getByText(/4/)).toBeInTheDocument();
        },
        { timeout: 1500 }
      );
    });

    it('should allow cancellation of timeout', async () => {
      const mockRequest = {
        id: 'cancel-timeout-test',
        tool: 'Delete',
        scope: '/important/file.txt',
        reason: 'File deletion',
        timeoutMs: 3000,
        dangerLevel: 'critical' as const,
      };

      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
        />
      );

      // Click deny before timeout
      const denyButton = screen.getByRole('button', { name: /deny/i });
      fireEvent.click(denyButton);

      // Wait a bit to ensure timeout doesn't fire
      await new Promise(resolve => setTimeout(resolve, 3500));

      expect(mockOnDeny).toHaveBeenCalledTimes(1);
      expect(mockOnTimeout).not.toHaveBeenCalled();
    });
  });

  describe('User Approval/Denial Flows', () => {
    it('should handle user approval with proper validation', async () => {
      const mockRequest = {
        id: 'approval-test',
        tool: 'Write',
        scope: '/user/document.txt',
        reason: 'Save document',
        timeoutMs: 30000,
        dangerLevel: 'low' as const,
        metadata: {
          fileSize: 1024,
          operation: 'save',
        },
      };

      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
        />
      );

      // Verify request details are displayed
      expect(screen.getByText(/Save document/)).toBeInTheDocument();
      expect(screen.getByText(/1024/)).toBeInTheDocument(); // File size
      expect(screen.getByText(/low/i)).toBeInTheDocument(); // Danger level

      // Click approve
      const approveButton = screen.getByRole('button', { name: /approve/i });
      fireEvent.click(approveButton);

      expect(mockOnApprove).toHaveBeenCalledWith(mockRequest.id, {
        level: 'allow-once',
        scope: mockRequest.scope,
        reason: 'User approved via CLI prompt',
      });
    });

    it('should handle user denial with reason collection', async () => {
      const mockRequest = {
        id: 'denial-test',
        tool: 'Execute',
        scope: '/suspicious/script.sh',
        reason: 'Execute suspicious script',
        timeoutMs: 30000,
        dangerLevel: 'high' as const,
      };

      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          collectDenialReason={true}
        />
      );

      // Click deny
      const denyButton = screen.getByRole('button', { name: /deny/i });
      fireEvent.click(denyButton);

      // Should show reason input
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/reason for denial/i)).toBeInTheDocument();
      });

      // Enter denial reason
      const reasonInput = screen.getByPlaceholderText(/reason for denial/i);
      fireEvent.change(reasonInput, { target: { value: 'Suspicious script execution' } });

      // Confirm denial
      const confirmButton = screen.getByRole('button', { name: /confirm denial/i });
      fireEvent.click(confirmButton);

      expect(mockOnDeny).toHaveBeenCalledWith(mockRequest.id, {
        reason: 'Suspicious script execution',
      });
    });

    it('should handle remember choice functionality', async () => {
      const mockRequest = {
        id: 'remember-test',
        tool: 'Read',
        scope: '/safe/config.json',
        reason: 'Read configuration',
        timeoutMs: 30000,
        dangerLevel: 'low' as const,
      };

      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          allowRememberChoice={true}
        />
      );

      // Check remember choice option
      const rememberCheckbox = screen.getByRole('checkbox', { name: /remember/i });
      fireEvent.click(rememberCheckbox);

      // Approve with remember choice
      const approveButton = screen.getByRole('button', { name: /approve/i });
      fireEvent.click(approveButton);

      expect(mockOnApprove).toHaveBeenCalledWith(mockRequest.id, {
        level: 'allow-always', // Should be always when remembered
        scope: mockRequest.scope,
        reason: 'User approved with remember choice',
        remember: true,
      });
    });
  });

  describe('Error State Display and Recovery', () => {
    it('should display network error states gracefully', async () => {
      const mockRequest = {
        id: 'network-error-test',
        tool: 'HTTP',
        scope: 'https://api.example.com',
        reason: 'API request',
        timeoutMs: 30000,
        dangerLevel: 'medium' as const,
      };

      const { rerender } = render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
        />
      );

      // Simulate network error
      rerender(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          error={{
            type: 'network',
            message: 'Failed to connect to permission service',
            recoverable: true,
          }}
        />
      );

      // Should show error message
      expect(screen.getByText(/Failed to connect/)).toBeInTheDocument();

      // Should show retry option for recoverable errors
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should handle permission service unavailable', async () => {
      const mockRequest = {
        id: 'service-unavailable-test',
        tool: 'Write',
        scope: '/test/file.txt',
        reason: 'File write',
        timeoutMs: 30000,
        dangerLevel: 'low' as const,
      };

      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          error={{
            type: 'service_unavailable',
            message: 'Permission service is temporarily unavailable',
            recoverable: false,
          }}
        />
      );

      // Should show error and disable actions
      expect(screen.getByText(/temporarily unavailable/)).toBeInTheDocument();

      const approveButton = screen.getByRole('button', { name: /approve/i });
      const denyButton = screen.getByRole('button', { name: /deny/i });

      expect(approveButton).toBeDisabled();
      expect(denyButton).toBeDisabled();
    });

    it('should recover from transient errors', async () => {
      const mockRequest = {
        id: 'recovery-test',
        tool: 'Read',
        scope: '/data/file.json',
        reason: 'Read data file',
        timeoutMs: 30000,
        dangerLevel: 'low' as const,
      };

      const { rerender } = render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          error={{
            type: 'network',
            message: 'Connection timeout',
            recoverable: true,
          }}
        />
      );

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Simulate recovery
      rerender(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          error={null}
        />
      );

      // Should be back to normal state
      expect(screen.queryByText(/Connection timeout/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /deny/i })).toBeEnabled();
    });
  });

  describe('Accessibility Compliance Testing', () => {
    it('should have proper ARIA labels and roles', async () => {
      const mockRequest = {
        id: 'aria-test',
        tool: 'Write',
        scope: '/test/file.txt',
        reason: 'File write operation',
        timeoutMs: 30000,
        dangerLevel: 'medium' as const,
      };

      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
        />
      );

      // Check ARIA roles
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /deny/i })).toBeInTheDocument();

      // Check ARIA labels
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');

      // Check danger level is announced
      expect(screen.getByText(/medium/i)).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation', async () => {
      const mockRequest = {
        id: 'keyboard-test',
        tool: 'Execute',
        scope: '/bin/script.sh',
        reason: 'Script execution',
        timeoutMs: 30000,
        dangerLevel: 'high' as const,
      };

      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
        />
      );

      // Tab should focus first button (approve)
      fireEvent.keyDown(document.body, { key: 'Tab' });
      expect(screen.getByRole('button', { name: /approve/i })).toHaveFocus();

      // Tab again should focus deny button
      fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
      expect(screen.getByRole('button', { name: /deny/i })).toHaveFocus();

      // Enter should trigger the focused button
      fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
      expect(mockOnDeny).toHaveBeenCalled();
    });

    it('should support screen reader announcements', async () => {
      const mockRequest = {
        id: 'screen-reader-test',
        tool: 'Delete',
        scope: '/important/data.db',
        reason: 'Database deletion',
        timeoutMs: 10000,
        dangerLevel: 'critical' as const,
      };

      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
        />
      );

      // Check for live region for announcements
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveTextContent(/critical/i);

      // Danger level should be announced
      expect(screen.getByText(/critical/i)).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Cross-Platform CLI Behavior Validation', () => {
    it('should handle Windows-specific path formatting', async () => {
      const windowsMockRequest = {
        id: 'windows-test',
        tool: 'Write',
        scope: 'C:\\Users\\Test\\Documents\\file.txt',
        reason: 'File write on Windows',
        timeoutMs: 30000,
        dangerLevel: 'low' as const,
      };

      // Mock Windows platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      render(
        <PermissionPrompt
          request={windowsMockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
        />
      );

      // Should display Windows path correctly
      expect(screen.getByText(/C:\\Users\\Test/)).toBeInTheDocument();

      // Should not show Unix-style path separators
      expect(screen.queryByText(/C:\/Users\/Test/)).not.toBeInTheDocument();

      // Restore platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle Unix-style paths on Unix systems', async () => {
      const unixMockRequest = {
        id: 'unix-test',
        tool: 'Read',
        scope: '/home/user/.config/app.conf',
        reason: 'Read configuration file',
        timeoutMs: 30000,
        dangerLevel: 'low' as const,
      };

      // Mock Unix platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      render(
        <PermissionPrompt
          request={unixMockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
        />
      );

      // Should display Unix path correctly
      expect(screen.getByText(/\/home\/user/)).toBeInTheDocument();

      // Restore platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle terminal width constraints', async () => {
      const longPathRequest = {
        id: 'long-path-test',
        tool: 'Write',
        scope: '/very/long/path/to/some/deeply/nested/directory/structure/file.txt',
        reason: 'Write to file with very long path name that exceeds typical terminal width',
        timeoutMs: 30000,
        dangerLevel: 'medium' as const,
      };

      render(
        <PermissionPrompt
          request={longPathRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          terminalWidth={80} // Simulate 80-column terminal
        />
      );

      // Should truncate or wrap long paths appropriately
      const pathElement = screen.getByText(/very.*long.*path/);
      expect(pathElement).toBeInTheDocument();

      // Should not overflow terminal width (this is a simplified check)
      expect(pathElement.textContent!.length).toBeLessThan(200);
    });

    it('should adapt to color support capabilities', async () => {
      const mockRequest = {
        id: 'color-test',
        tool: 'Delete',
        scope: '/critical/system/file',
        reason: 'Critical file deletion',
        timeoutMs: 30000,
        dangerLevel: 'critical' as const,
      };

      // Test with color support
      render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          supportsColor={true}
        />
      );

      // Should use colored styling for critical danger level
      const dangerIndicator = screen.getByText(/critical/i);
      expect(dangerIndicator).toHaveClass('danger-critical-color');

      // Test without color support
      const { rerender } = render(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          supportsColor={false}
        />
      );

      rerender(
        <PermissionPrompt
          request={mockRequest}
          onApprove={mockOnApprove}
          onDeny={mockOnDeny}
          onTimeout={mockOnTimeout}
          supportsColor={false}
        />
      );

      // Should use text-based indicators instead of colors
      const textIndicator = screen.getByText(/\[CRITICAL\]/);
      expect(textIndicator).toBeInTheDocument();
    });
  });

  describe('Permission History and Audit Trail', () => {
    it('should display permission history with filtering', async () => {
      const mockHistoryData = [
        {
          id: '1',
          tool: 'Write',
          scope: '/file1.txt',
          level: 'allow-once' as const,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          status: 'approved' as const,
        },
        {
          id: '2',
          tool: 'Read',
          scope: '/file2.txt',
          level: 'allow-always' as const,
          timestamp: new Date('2024-01-01T11:00:00Z'),
          status: 'denied' as const,
        },
        {
          id: '3',
          tool: 'Execute',
          scope: '/script.sh',
          level: 'deny' as const,
          timestamp: new Date('2024-01-01T12:00:00Z'),
          status: 'timeout' as const,
        },
      ];

      render(
        <PermissionHistory
          permissions={mockHistoryData}
          onFilter={() => {}}
          onExport={() => {}}
        />
      );

      // Should display all permissions
      expect(screen.getByText('Write')).toBeInTheDocument();
      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText('Execute')).toBeInTheDocument();

      // Should show status indicators
      expect(screen.getByText('approved')).toBeInTheDocument();
      expect(screen.getByText('denied')).toBeInTheDocument();
      expect(screen.getByText('timeout')).toBeInTheDocument();
    });

    it('should support export functionality', async () => {
      const mockHistoryData = [
        {
          id: '1',
          tool: 'Test',
          scope: '/test',
          level: 'allow-once' as const,
          timestamp: new Date(),
          status: 'approved' as const,
        },
      ];

      const mockOnExport = vi.fn();

      render(
        <PermissionHistory
          permissions={mockHistoryData}
          onFilter={() => {}}
          onExport={mockOnExport}
        />
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      expect(mockOnExport).toHaveBeenCalledWith(mockHistoryData, 'csv');
    });
  });
});