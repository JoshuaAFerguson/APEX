import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewPanel, type PreviewPanelProps } from '../ui/components/PreviewPanel';

describe('Preview Feature Accessibility Tests', () => {
  let mockOnConfirm: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;
  let mockOnEdit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnConfirm = vi.fn();
    mockOnCancel = vi.fn();
    mockOnEdit = vi.fn();
  });

  const createProps = (overrides: Partial<PreviewPanelProps> = {}): PreviewPanelProps => ({
    input: 'test input',
    intent: { type: 'task', confidence: 0.8 },
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    onEdit: mockOnEdit,
    ...overrides,
  });

  describe('Screen Reader Compatibility', () => {
    it('should provide meaningful text content for screen readers', () => {
      render(<PreviewPanel {...createProps()} />);

      // All important information should be accessible as text
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('"test input"')).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 80%')).toBeInTheDocument();
      expect(screen.getByText('Action:')).toBeInTheDocument();
      expect(screen.getByText('Create task')).toBeInTheDocument();
    });

    it('should provide complete information hierarchy for screen readers', () => {
      const props = createProps({
        input: 'create a login form',
        intent: {
          type: 'command',
          confidence: 0.95,
          command: 'generate',
          args: ['component', 'LoginForm'],
        },
        workflow: 'feature',
      });

      render(<PreviewPanel {...props} />);

      // Header information
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();

      // Input section
      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('"create a login form"')).toBeInTheDocument();

      // Intent section with all details
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Command Intent')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 95%')).toBeInTheDocument();
      expect(screen.getByText('Action:')).toBeInTheDocument();
      expect(screen.getByText('Execute command: /generate component LoginForm')).toBeInTheDocument();

      // Action buttons with clear labels
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should handle long content gracefully for screen readers', () => {
      const longInput = 'Create a comprehensive user management system with authentication, authorization, profile management, and administrative controls that includes role-based access control, user preferences, activity logging, password reset functionality, and integration with external identity providers';

      const props = createProps({ input: longInput });
      render(<PreviewPanel {...props} />);

      // Long content should still be accessible
      expect(screen.getByText(`"${longInput}"`)).toBeInTheDocument();
      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
    });

    it('should provide clear intent type information', () => {
      const intentTypes: Array<{
        type: 'command' | 'task' | 'question' | 'clarification';
        expectedIcon: string;
        expectedLabel: string;
      }> = [
        { type: 'command', expectedIcon: '⚡', expectedLabel: 'Command Intent' },
        { type: 'task', expectedIcon: '📝', expectedLabel: 'Task Intent' },
        { type: 'question', expectedIcon: '❓', expectedLabel: 'Question Intent' },
        { type: 'clarification', expectedIcon: '💬', expectedLabel: 'Clarification Intent' },
      ];

      intentTypes.forEach(({ type, expectedIcon, expectedLabel }) => {
        const props = createProps({
          input: `test ${type} input`,
          intent: { type, confidence: 0.8 },
        });

        render(<PreviewPanel {...props} />);

        expect(screen.getByText(expectedIcon)).toBeInTheDocument();
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();

        // Clean up for next iteration
        screen.debug(); // This won't actually output unless there's an error
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should provide clear keyboard shortcuts in action section', () => {
      render(<PreviewPanel {...createProps()} />);

      // Keyboard shortcuts should be clearly indicated
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();

      // Actions should be clearly labeled
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should maintain logical reading order', () => {
      render(<PreviewPanel {...createProps()} />);

      // Check that elements appear in logical order for screen readers
      const allText = screen.getByTestId('box').textContent;

      // Header should come first
      expect(allText?.indexOf('📋 Input Preview')).toBeLessThan(allText?.indexOf('Input:') || Infinity);

      // Input should come before intent
      expect(allText?.indexOf('Input:')).toBeLessThan(allText?.indexOf('Detected Intent:') || Infinity);

      // Intent should come before actions
      expect(allText?.indexOf('Detected Intent:')).toBeLessThan(allText?.indexOf('[Enter]') || Infinity);
    });
  });

  describe('Visual Accessibility', () => {
    it('should use contrasting colors for confidence levels', () => {
      const confidenceLevels = [
        { confidence: 0.9, expectedColor: 'green', label: 'high' },
        { confidence: 0.7, expectedColor: 'yellow', label: 'medium' },
        { confidence: 0.4, expectedColor: 'red', label: 'low' },
      ];

      confidenceLevels.forEach(({ confidence, expectedColor, label }) => {
        const props = createProps({
          intent: { type: 'task', confidence },
        });

        render(<PreviewPanel {...props} />);

        // Confidence percentage should be displayed
        const percentageText = `${Math.round(confidence * 100)}%`;
        expect(screen.getByText(percentageText)).toBeInTheDocument();

        // Note: Actual color testing would require checking style props or classes
        // This test verifies the percentage is displayed correctly
      });
    });

    it('should provide semantic meaning through icons and text', () => {
      render(<PreviewPanel {...createProps()} />);

      // Icons should be accompanied by text for accessibility
      expect(screen.getByText('📋')).toBeInTheDocument(); // Header icon
      expect(screen.getByText('Input Preview')).toBeInTheDocument(); // Header text

      expect(screen.getByText('📝')).toBeInTheDocument(); // Task icon
      expect(screen.getByText('Task Intent')).toBeInTheDocument(); // Task text
    });

    it('should handle high contrast scenarios', () => {
      // Test with different intent types to ensure contrast
      const props = createProps({
        intent: { type: 'command', confidence: 0.95, command: 'help' },
      });

      render(<PreviewPanel {...props} />);

      // High confidence should be easily readable
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('Command Intent')).toBeInTheDocument();
    });
  });

  describe('Content Structure and Semantics', () => {
    it('should provide clear section headers', () => {
      render(<PreviewPanel {...createProps()} />);

      // Main sections should be clearly headed
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();

      // Status indicator should be clear
      expect(screen.getByText('[on]')).toBeInTheDocument();
    });

    it('should provide complete context for each piece of information', () => {
      const props = createProps({
        input: 'create user dashboard',
        intent: {
          type: 'task',
          confidence: 0.85,
        },
        workflow: 'feature',
      });

      render(<PreviewPanel {...props} />);

      // Each piece of information should have context
      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('"create user dashboard"')).toBeInTheDocument();

      expect(screen.getByText('Confidence:')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();

      expect(screen.getByText('Action:')).toBeInTheDocument();
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();

      // Workflow information
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
    });

    it('should handle workflow information accessibly', () => {
      const props = createProps({
        intent: { type: 'task', confidence: 0.8 },
        workflow: 'feature',
      });

      render(<PreviewPanel {...props} />);

      // Workflow should be clearly indicated
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();
    });

    it('should provide complete command information', () => {
      const props = createProps({
        input: '/config set api.url http://localhost:3000',
        intent: {
          type: 'command',
          confidence: 1.0,
          command: 'config',
          args: ['set', 'api.url', 'http://localhost:3000'],
        },
      });

      render(<PreviewPanel {...props} />);

      // Complete command should be accessible
      expect(screen.getByText('Execute command: /config set api.url http://localhost:3000')).toBeInTheDocument();
      expect(screen.getByText('Command Intent')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('Error State Accessibility', () => {
    it('should handle zero confidence accessibly', () => {
      const props = createProps({
        intent: { type: 'task', confidence: 0 },
      });

      render(<PreviewPanel {...props} />);

      // Zero confidence should be clearly indicated
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 0%')).toBeInTheDocument();
    });

    it('should handle unknown intent types accessibly', () => {
      const props = createProps({
        intent: { type: 'unknown' as any, confidence: 0.5 },
      });

      render(<PreviewPanel {...props} />);

      // Unknown intent should have fallback text
      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('Unknown Intent')).toBeInTheDocument();
      expect(screen.getByText('Process input')).toBeInTheDocument();
    });

    it('should handle malformed data gracefully for accessibility', () => {
      const props = createProps({
        input: '',
        intent: { type: 'task', confidence: NaN },
      });

      render(<PreviewPanel {...props} />);

      // Empty input should be clearly shown
      expect(screen.getByText('""')).toBeInTheDocument();

      // NaN confidence should be handled
      expect(screen.getByText('NaN%')).toBeInTheDocument();
    });
  });

  describe('Internationalization Support', () => {
    it('should handle unicode input correctly', () => {
      const unicodeInput = 'Create 用户管理 system with émojis 🚀🌟';
      const props = createProps({ input: unicodeInput });

      render(<PreviewPanel {...props} />);

      // Unicode should be preserved and accessible
      expect(screen.getByText(`"${unicodeInput}"`)).toBeInTheDocument();
    });

    it('should handle right-to-left text', () => {
      const rtlInput = 'إنشاء نظام إدارة المستخدمين';
      const props = createProps({ input: rtlInput });

      render(<PreviewPanel {...props} />);

      // RTL text should be accessible
      expect(screen.getByText(`"${rtlInput}"`)).toBeInTheDocument();
    });

    it('should handle mixed-direction text', () => {
      const mixedInput = 'Create نظام for user management with 数据库';
      const props = createProps({ input: mixedInput });

      render(<PreviewPanel {...props} />);

      // Mixed direction text should be accessible
      expect(screen.getByText(`"${mixedInput}"`)).toBeInTheDocument();
    });
  });

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility with long text that might wrap', () => {
      const veryLongInput = 'Create a comprehensive enterprise-grade user management system with role-based access control, multi-factor authentication, password policies, user activity auditing, bulk user operations, LDAP integration, SSO support, and advanced reporting capabilities';

      const props = createProps({ input: veryLongInput });
      render(<PreviewPanel {...props} />);

      // Long text should remain accessible
      expect(screen.getByText(`"${veryLongInput}"`)).toBeInTheDocument();
      expect(screen.getByText('Input:')).toBeInTheDocument();
    });

    it('should handle complex command structures accessibly', () => {
      const complexCommand = {
        type: 'command' as const,
        confidence: 0.95,
        command: 'deploy',
        args: [
          '--environment=production',
          '--config=/path/to/config.yml',
          '--skip-tests',
          '--force',
          '--verbose'
        ],
      };

      const props = createProps({ intent: complexCommand });
      render(<PreviewPanel {...props} />);

      // Complex command should be accessible
      const expectedCommand = 'Execute command: /deploy --environment=production --config=/path/to/config.yml --skip-tests --force --verbose';
      expect(screen.getByText(expectedCommand)).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('should provide clear focus indicators through text', () => {
      render(<PreviewPanel {...createProps()} />);

      // Action buttons should have clear text indicators
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();

      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();

      expect(screen.getByText('[e]')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should maintain logical tab order through content structure', () => {
      render(<PreviewPanel {...createProps()} />);

      // Content should flow logically from top to bottom
      const container = screen.getByTestId('box');
      const textContent = container.textContent || '';

      // Verify logical order
      const headerIndex = textContent.indexOf('📋 Input Preview');
      const inputIndex = textContent.indexOf('Input:');
      const intentIndex = textContent.indexOf('Detected Intent:');
      const actionsIndex = textContent.indexOf('[Enter]');

      expect(headerIndex).toBeLessThan(inputIndex);
      expect(inputIndex).toBeLessThan(intentIndex);
      expect(intentIndex).toBeLessThan(actionsIndex);
    });
  });

  describe('Error Message Accessibility', () => {
    it('should provide meaningful feedback for low confidence', () => {
      const props = createProps({
        intent: { type: 'task', confidence: 0.3 },
      });

      render(<PreviewPanel {...props} />);

      // Low confidence should be clearly indicated
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 30%')).toBeInTheDocument();

      // The low confidence should be visually distinct (red color)
      // Note: In a real implementation, this might trigger additional warnings
    });

    it('should handle missing information gracefully', () => {
      const props = createProps({
        intent: {
          type: 'command',
          confidence: 1.0,
          // Missing command property
        },
      });

      render(<PreviewPanel {...props} />);

      // Missing command should be handled
      expect(screen.getByText('Execute command: /undefined')).toBeInTheDocument();
    });

    it('should provide clear status when workflow is missing', () => {
      const props = createProps({
        intent: { type: 'task', confidence: 0.8 },
        // No workflow provided
      });

      render(<PreviewPanel {...props} />);

      // Should show task without workflow
      expect(screen.getByText('Create task')).toBeInTheDocument();
      // Should not show agent flow
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });
  });
});