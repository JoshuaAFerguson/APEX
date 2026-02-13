import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PermissionPrompt, PermissionHistory, type PermissionRequest, type PermissionHistoryEntry, type PermissionLevel } from '../PermissionPrompt.js';

/**
 * Test Suite: Permission Notification Display Components
 *
 * Tests the visual components that display permission notifications
 * to verify proper rendering and user interaction handling.
 */
describe('Permission Notification Display Components', () => {
  beforeEach(() => {
    // Mock Date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('PermissionPrompt Component', () => {
    const mockOnDecision = vi.fn();

    const defaultRequest: PermissionRequest = {
      id: 'test-permission-123',
      tool: 'Write',
      operation: 'Creating new React component',
      isDangerous: false,
      scope: '/project/src/components/UserProfile.tsx',
      context: 'Adding new feature component',
      parameters: {
        filePath: '/project/src/components/UserProfile.tsx',
        content: 'React component code...'
      },
      timestamp: new Date()
    };

    beforeEach(() => {
      mockOnDecision.mockClear();
    });

    it('should render permission request with all details in normal mode', () => {
      render(
        <PermissionPrompt
          request={defaultRequest}
          onDecision={mockOnDecision}
          displayMode="normal"
          showDetails={true}
        />
      );

      // Verify main permission request elements
      expect(screen.getByText(/Permission Request/)).toBeInTheDocument();
      expect(screen.getByText(/Tool:/)).toBeInTheDocument();
      expect(screen.getByText('Write')).toBeInTheDocument();
      expect(screen.getByText(/Operation:/)).toBeInTheDocument();
      expect(screen.getByText('Creating new React component')).toBeInTheDocument();
      expect(screen.getByText(/Scope:/)).toBeInTheDocument();
      expect(screen.getByText('/project/src/components/UserProfile.tsx')).toBeInTheDocument();
      expect(screen.getByText(/10:30:00/)).toBeInTheDocument();

      // Verify permission options are displayed
      expect(screen.getByText(/Allow Always/)).toBeInTheDocument();
      expect(screen.getByText(/Allow Once/)).toBeInTheDocument();
      expect(screen.getByText(/Deny/)).toBeInTheDocument();

      // Verify help text
      expect(screen.getByText(/Navigate • Enter: Confirm • Esc: Deny/)).toBeInTheDocument();
    });

    it('should render dangerous operation warning appropriately', () => {
      const dangerousRequest: PermissionRequest = {
        ...defaultRequest,
        id: 'dangerous-permission-456',
        tool: 'Bash',
        operation: 'Deleting system files',
        isDangerous: true,
        dangerLevel: 'critical',
        context: 'System maintenance operation'
      };

      render(
        <PermissionPrompt
          request={dangerousRequest}
          onDecision={mockOnDecision}
          displayMode="normal"
        />
      );

      // Verify dangerous operation indicators
      expect(screen.getByText(/🚨/)).toBeInTheDocument();
      expect(screen.getByText(/CRITICAL - May cause irreversible damage/)).toBeInTheDocument();
      expect(screen.getByText(/⚠️.*WARNING.*irreversible changes/)).toBeInTheDocument();

      // Verify border color changes for dangerous operations
      const container = screen.getByText(/Permission Request/).closest('div');
      expect(container).toHaveStyle({ borderColor: 'red' });
    });

    it('should render compact mode correctly', () => {
      render(
        <PermissionPrompt
          request={defaultRequest}
          onDecision={mockOnDecision}
          displayMode="compact"
        />
      );

      // In compact mode, should show minimal information
      expect(screen.getByText('Write')).toBeInTheDocument();
      expect(screen.getByText('Creating new React component')).toBeInTheDocument();
      expect(screen.getByText(/A=Allow Always.*O=Allow Once.*D=Deny/)).toBeInTheDocument();

      // Should not show detailed information in compact mode
      expect(screen.queryByText(/Permission Request/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Tool:/)).not.toBeInTheDocument();
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalRequest: PermissionRequest = {
        id: 'minimal-permission',
        tool: 'TestTool',
        operation: 'Test operation',
        isDangerous: false,
        timestamp: new Date()
        // No scope, context, parameters
      };

      render(
        <PermissionPrompt
          request={minimalRequest}
          onDecision={mockOnDecision}
          displayMode="normal"
          showDetails={true}
        />
      );

      // Should render available fields
      expect(screen.getByText('TestTool')).toBeInTheDocument();
      expect(screen.getByText('Test operation')).toBeInTheDocument();

      // Should not render sections for missing fields
      expect(screen.queryByText(/Scope:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Parameters:/)).not.toBeInTheDocument();
    });

    it('should display parameters when showDetails is enabled', () => {
      const requestWithParams: PermissionRequest = {
        ...defaultRequest,
        parameters: {
          filePath: '/test/path.ts',
          content: 'Some content...',
          mode: 'write',
          backup: true
        }
      };

      render(
        <PermissionPrompt
          request={requestWithParams}
          onDecision={mockOnDecision}
          showDetails={true}
        />
      );

      expect(screen.getByText(/Parameters:/)).toBeInTheDocument();
      expect(screen.getByText(/filePath.*\/test\/path.ts/)).toBeInTheDocument();
      expect(screen.getByText(/content.*Some content/)).toBeInTheDocument();
      expect(screen.getByText(/mode.*write/)).toBeInTheDocument();
    });

    it('should hide parameters when showDetails is disabled', () => {
      const requestWithParams: PermissionRequest = {
        ...defaultRequest,
        parameters: {
          filePath: '/test/path.ts',
          content: 'Some content...'
        }
      };

      render(
        <PermissionPrompt
          request={requestWithParams}
          onDecision={mockOnDecision}
          showDetails={false}
        />
      );

      expect(screen.queryByText(/Parameters:/)).not.toBeInTheDocument();
    });

    it('should format danger levels correctly', () => {
      const dangerLevels: Array<{ level: 'low' | 'medium' | 'high' | 'critical'; icon: string; description: string }> = [
        { level: 'low', icon: '⚠️', description: 'LOW RISK' },
        { level: 'medium', icon: '⚡', description: 'MEDIUM RISK' },
        { level: 'high', icon: '⚠️', description: 'HIGH RISK' },
        { level: 'critical', icon: '🚨', description: 'CRITICAL' }
      ];

      dangerLevels.forEach(({ level, icon, description }) => {
        const { unmount } = render(
          <PermissionPrompt
            request={{
              ...defaultRequest,
              id: `danger-${level}`,
              isDangerous: true,
              dangerLevel: level
            }}
            onDecision={mockOnDecision}
          />
        );

        expect(screen.getByText(icon)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(description))).toBeInTheDocument();

        unmount();
      });
    });

    it('should truncate long parameter values appropriately', () => {
      const longContent = 'A'.repeat(100); // 100 character string

      const requestWithLongParams: PermissionRequest = {
        ...defaultRequest,
        parameters: {
          shortParam: 'short',
          longParam: longContent,
          anotherParam: 'another'
        }
      };

      render(
        <PermissionPrompt
          request={requestWithLongParams}
          onDecision={mockOnDecision}
          showDetails={true}
        />
      );

      // Short parameter should be displayed fully
      expect(screen.getByText(/shortParam.*short/)).toBeInTheDocument();

      // Long parameter should be truncated with ellipsis
      expect(screen.getByText(/longParam.*A{40,50}\.{3}/)).toBeInTheDocument();

      // Should show first 3 parameters and indicate more if applicable
      expect(screen.getByText(/anotherParam.*another/)).toBeInTheDocument();
    });
  });

  describe('PermissionHistory Component', () => {
    const mockHistoryEntries: PermissionHistoryEntry[] = [
      {
        request: {
          id: 'history-1',
          tool: 'Write',
          operation: 'Creating component',
          isDangerous: false,
          timestamp: new Date('2024-01-15T09:00:00Z'),
          scope: '/src/Component1.tsx'
        },
        decision: 'allow-once',
        decidedAt: new Date('2024-01-15T09:01:00Z')
      },
      {
        request: {
          id: 'history-2',
          tool: 'Edit',
          operation: 'Modifying config',
          isDangerous: true,
          dangerLevel: 'medium',
          timestamp: new Date('2024-01-15T09:30:00Z'),
          scope: '/config/app.yaml'
        },
        decision: 'allow-always',
        decidedAt: new Date('2024-01-15T09:31:00Z'),
        comment: 'Approved by admin'
      },
      {
        request: {
          id: 'history-3',
          tool: 'Bash',
          operation: 'Running tests',
          isDangerous: false,
          timestamp: new Date('2024-01-15T10:00:00Z')
        },
        decision: 'deny',
        decidedAt: new Date('2024-01-15T10:00:30Z')
      }
    ];

    it('should render permission history in normal mode', () => {
      render(
        <PermissionHistory
          entries={mockHistoryEntries}
          displayMode="normal"
          maxEntries={10}
        />
      );

      expect(screen.getByText('Permission History')).toBeInTheDocument();
      expect(screen.getByText('3 entries')).toBeInTheDocument();

      // Verify each entry is displayed
      expect(screen.getByText('Write')).toBeInTheDocument();
      expect(screen.getByText('Creating component')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Modifying config')).toBeInTheDocument();
      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText('Running tests')).toBeInTheDocument();

      // Verify decisions are shown with appropriate colors
      expect(screen.getByText('allow-once')).toBeInTheDocument();
      expect(screen.getByText('allow-always')).toBeInTheDocument();
      expect(screen.getByText('deny')).toBeInTheDocument();
    });

    it('should render permission history in compact mode', () => {
      render(
        <PermissionHistory
          entries={mockHistoryEntries}
          displayMode="compact"
          maxEntries={10}
        />
      );

      expect(screen.getByText(/Permission History \(3\)/)).toBeInTheDocument();

      // In compact mode, should show minimal information
      expect(screen.getByText('Write')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Bash')).toBeInTheDocument();

      // Should not show detailed information
      expect(screen.queryByText('Creating component')).not.toBeInTheDocument();
    });

    it('should limit entries according to maxEntries parameter', () => {
      const manyEntries = Array.from({ length: 20 }, (_, i) => ({
        request: {
          id: `entry-${i}`,
          tool: `Tool${i}`,
          operation: `Operation ${i}`,
          isDangerous: false,
          timestamp: new Date()
        },
        decision: 'allow-once' as PermissionLevel,
        decidedAt: new Date()
      }));

      render(
        <PermissionHistory
          entries={manyEntries}
          displayMode="normal"
          maxEntries={5}
        />
      );

      // Should show total count
      expect(screen.getByText('20 entries')).toBeInTheDocument();

      // Should only show last 5 entries (15-19)
      expect(screen.getByText('Tool15')).toBeInTheDocument();
      expect(screen.getByText('Tool19')).toBeInTheDocument();
      expect(screen.queryByText('Tool0')).not.toBeInTheDocument();
      expect(screen.queryByText('Tool14')).not.toBeInTheDocument();
    });

    it('should handle empty history gracefully', () => {
      render(
        <PermissionHistory
          entries={[]}
          displayMode="normal"
        />
      );

      expect(screen.getByText('Permission History')).toBeInTheDocument();
      expect(screen.getByText('0 entries')).toBeInTheDocument();
      expect(screen.getByText('No permission history')).toBeInTheDocument();
    });

    it('should format timestamps correctly', () => {
      render(
        <PermissionHistory
          entries={[mockHistoryEntries[0]]}
          displayMode="normal"
        />
      );

      // Should display time in locale format
      expect(screen.getByText(/09:01:00/)).toBeInTheDocument();
    });

    it('should display scope information when available', () => {
      render(
        <PermissionHistory
          entries={[mockHistoryEntries[0]]}
          displayMode="normal"
        />
      );

      expect(screen.getByText('/src/Component1.tsx')).toBeInTheDocument();
    });

    it('should use appropriate colors for different decision types', () => {
      render(
        <PermissionHistory
          entries={mockHistoryEntries}
          displayMode="normal"
        />
      );

      const allowOnce = screen.getByText('allow-once');
      const allowAlways = screen.getByText('allow-always');
      const deny = screen.getByText('deny');

      // These should have appropriate color styling (tested via style attributes)
      expect(allowOnce).toHaveStyle({ color: 'yellow' });
      expect(allowAlways).toHaveStyle({ color: 'green' });
      expect(deny).toHaveStyle({ color: 'red' });
    });
  });

  describe('Permission Component Integration', () => {
    it('should integrate PermissionPrompt and PermissionHistory components', () => {
      const currentRequest: PermissionRequest = {
        id: 'current-request',
        tool: 'Write',
        operation: 'Current operation',
        isDangerous: false,
        timestamp: new Date()
      };

      const mockOnDecision = vi.fn();

      render(
        <div>
          <PermissionPrompt
            request={currentRequest}
            onDecision={mockOnDecision}
            displayMode="normal"
          />
          <PermissionHistory
            entries={[]}
            displayMode="normal"
          />
        </div>
      );

      // Both components should render together
      expect(screen.getByText(/Permission Request/)).toBeInTheDocument();
      expect(screen.getByText('Permission History')).toBeInTheDocument();
      expect(screen.getByText('Current operation')).toBeInTheDocument();
      expect(screen.getByText('No permission history')).toBeInTheDocument();
    });

    it('should handle real-world permission workflow', () => {
      const workflowRequest: PermissionRequest = {
        id: 'workflow-permission',
        tool: 'Edit',
        operation: 'Modifying critical system configuration',
        isDangerous: true,
        dangerLevel: 'high',
        scope: '/etc/nginx/nginx.conf',
        context: 'Updating server configuration for performance optimization',
        parameters: {
          configFile: '/etc/nginx/nginx.conf',
          changes: ['worker_processes auto', 'client_max_body_size 50M'],
          backup: true,
          validateSyntax: true
        },
        timestamp: new Date()
      };

      const relatedHistory: PermissionHistoryEntry[] = [
        {
          request: {
            id: 'related-1',
            tool: 'Read',
            operation: 'Reading nginx config',
            isDangerous: false,
            timestamp: new Date(Date.now() - 300000), // 5 minutes ago
            scope: '/etc/nginx/nginx.conf'
          },
          decision: 'allow-once',
          decidedAt: new Date(Date.now() - 299000)
        }
      ];

      const mockOnDecision = vi.fn();

      render(
        <div>
          <PermissionPrompt
            request={workflowRequest}
            onDecision={mockOnDecision}
            displayMode="normal"
            showDetails={true}
          />
          <PermissionHistory
            entries={relatedHistory}
            displayMode="normal"
            maxEntries={5}
          />
        </div>
      );

      // Verify workflow permission request details
      expect(screen.getByText('Modifying critical system configuration')).toBeInTheDocument();
      expect(screen.getByText(/HIGH RISK/)).toBeInTheDocument();
      expect(screen.getByText('/etc/nginx/nginx.conf')).toBeInTheDocument();
      expect(screen.getByText(/worker_processes auto/)).toBeInTheDocument();

      // Verify related history
      expect(screen.getByText('Reading nginx config')).toBeInTheDocument();
      expect(screen.getByText('allow-once')).toBeInTheDocument();

      // Verify dangerous operation warning
      expect(screen.getByText(/⚠️.*WARNING.*irreversible changes/)).toBeInTheDocument();
    });
  });
});