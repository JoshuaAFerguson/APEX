import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';
import { useInput } from 'ink';

// Mock Ink's useInput hook
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

// Mock the orchestrator for workflow testing
vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    off: vi.fn(),
    executeTask: vi.fn().mockResolvedValue({ id: 'test-task', status: 'completed' }),
    getTask: vi.fn().mockResolvedValue({ id: 'test-task', status: 'running' }),
    createTask: vi.fn().mockResolvedValue({ id: 'test-task' }),
    initialize: vi.fn().mockResolvedValue(true),
    getWorkflows: vi.fn().mockReturnValue(['feature', 'bugfix', 'hotfix', 'experiment']),
    getAgents: vi.fn().mockReturnValue(['planner', 'architect', 'developer', 'tester', 'reviewer']),
  })),
}));

describe('PreviewPanel Workflow Integration Tests', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();
  const mockUseInput = vi.mocked(useInput);

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
    mockOnEdit.mockClear();
    mockUseInput.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = {
    input: 'create a login component',
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    onEdit: mockOnEdit,
  };

  describe('workflow display integration', () => {
    it('should display feature workflow agent flow correctly', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.9 },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
    });

    it('should display bugfix workflow information', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.85 },
        workflow: 'bugfix',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task (bugfix workflow)')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      // All workflows show same agent flow in this implementation
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();
    });

    it('should display hotfix workflow information', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.95 },
        workflow: 'hotfix',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task (hotfix workflow)')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
    });

    it('should display experiment workflow information', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.75 },
        workflow: 'experiment',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task (experiment workflow)')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
    });

    it('should not display agent flow for non-task intents', () => {
      const commandProps: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'command', confidence: 1.0, command: 'status' },
        workflow: 'feature',
      };

      render(<PreviewPanel {...commandProps} />);

      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
      expect(screen.queryByText('planner → architect → developer → tester')).not.toBeInTheDocument();
    });

    it('should not display agent flow when no workflow is specified', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.8 },
        // No workflow specified
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task')).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });
  });

  describe('end-to-end user flow simulations', () => {
    it('should handle complete feature development workflow preview', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        input: 'add user authentication with JWT tokens and role-based access control',
        intent: { type: 'task', confidence: 0.92 },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      // Verify preview displays correctly
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
      expect(screen.getByText('"add user authentication with JWT tokens and role-based access control"')).toBeInTheDocument();

      // Verify intent detection
      expect(screen.getByText('📝')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();

      // Verify workflow information
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
      expect(screen.getByText('planner → architect → developer → tester')).toBeInTheDocument();

      // Verify action buttons
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should handle bugfix workflow with medium confidence', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        input: 'fix memory leak in component unmounting',
        intent: { type: 'task', confidence: 0.78 },
        workflow: 'bugfix',
      };

      render(<PreviewPanel {...props} />);

      // Should show medium confidence with yellow color indication
      expect(screen.getByText('78%')).toBeInTheDocument();
      expect(screen.getByText('Create task (bugfix workflow)')).toBeInTheDocument();
    });

    it('should handle question intent without workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        input: 'How do I implement authentication in React?',
        intent: { type: 'question', confidence: 0.85 },
        // No workflow for questions
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('❓')).toBeInTheDocument();
      expect(screen.getByText('Question Intent')).toBeInTheDocument();
      expect(screen.getByText('Answer question')).toBeInTheDocument();
      expect(screen.queryByText('Agent Flow:')).not.toBeInTheDocument();
    });

    it('should handle command intent with high confidence', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        input: '/status all',
        intent: {
          type: 'command',
          confidence: 1.0,
          command: 'status',
          args: ['all']
        },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('Command Intent')).toBeInTheDocument();
      expect(screen.getByText('Execute command: /status all')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle clarification intent', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        input: 'What do you mean by "component"?',
        intent: { type: 'clarification', confidence: 0.82 },
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('💬')).toBeInTheDocument();
      expect(screen.getByText('Clarification Intent')).toBeInTheDocument();
      expect(screen.getByText('Provide clarification')).toBeInTheDocument();
    });
  });

  describe('keyboard interaction workflow', () => {
    it('should handle complete confirm workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.9 },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      // Verify preview is shown
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      // Get input handler and simulate Enter key
      const inputHandler = mockUseInput.mock.calls[0][0];
      inputHandler('', { key: { name: 'return' } });

      // Verify confirm callback was called
      expect(mockOnConfirm).toHaveBeenCalledOnce();
      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });

    it('should handle complete cancel workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.9 },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      // Get input handler and simulate Escape key
      const inputHandler = mockUseInput.mock.calls[0][0];
      inputHandler('', { key: { name: 'escape' } });

      // Verify cancel callback was called
      expect(mockOnCancel).toHaveBeenCalledOnce();
      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnEdit).not.toHaveBeenCalled();
    });

    it('should handle complete edit workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.9 },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      // Get input handler and simulate 'e' key
      const inputHandler = mockUseInput.mock.calls[0][0];
      inputHandler('e', { key: {} });

      // Verify edit callback was called
      expect(mockOnEdit).toHaveBeenCalledOnce();
      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should handle rapid key combinations in workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.9 },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      const inputHandler = mockUseInput.mock.calls[0][0];

      // Simulate rapid user interaction
      inputHandler('e', { key: {} }); // Edit
      inputHandler('', { key: { name: 'escape' } }); // Cancel
      inputHandler('', { key: { name: 'return' } }); // Confirm

      // All callbacks should have been called
      expect(mockOnEdit).toHaveBeenCalledOnce();
      expect(mockOnCancel).toHaveBeenCalledOnce();
      expect(mockOnConfirm).toHaveBeenCalledOnce();
    });
  });

  describe('confidence level workflow impacts', () => {
    it('should handle high confidence task workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.95 },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      // High confidence should show green color
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();
    });

    it('should handle medium confidence task workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.65 },
        workflow: 'bugfix',
      };

      render(<PreviewPanel {...props} />);

      // Medium confidence should show yellow color
      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText('Create task (bugfix workflow)')).toBeInTheDocument();
    });

    it('should handle low confidence task workflow', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.45 },
        workflow: 'experiment',
      };

      render(<PreviewPanel {...props} />);

      // Low confidence should show red color
      expect(screen.getByText('45%')).toBeInTheDocument();
      expect(screen.getByText('Create task (experiment workflow)')).toBeInTheDocument();
    });
  });

  describe('workflow error handling', () => {
    it('should handle invalid workflow names gracefully', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.8 },
        workflow: 'non-existent-workflow',
      };

      render(<PreviewPanel {...props} />);

      // Should display the workflow name even if invalid
      expect(screen.getByText('Create task (non-existent-workflow workflow)')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
    });

    it('should handle workflow with special characters', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.8 },
        workflow: 'feature-v2.1_beta',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task (feature-v2.1_beta workflow)')).toBeInTheDocument();
    });

    it('should handle empty workflow string', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.8 },
        workflow: '',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Create task ( workflow)')).toBeInTheDocument();
      // Empty workflow should still show agent flow
      expect(screen.getByText('Agent Flow:')).toBeInTheDocument();
    });
  });

  describe('complex workflow scenarios', () => {
    it('should handle long task description with complex workflow', () => {
      const longInput = 'Implement a comprehensive user management system with role-based access control, JWT authentication, password reset functionality, email verification, multi-factor authentication support, and audit logging';

      const props: PreviewPanelProps = {
        ...baseProps,
        input: longInput,
        intent: { type: 'task', confidence: 0.88 },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText(`"${longInput}"`)).toBeInTheDocument();
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();
    });

    it('should handle workflow with metadata-rich intent', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: {
          type: 'task',
          confidence: 0.87,
          metadata: {
            estimatedComplexity: 'high',
            estimatedTime: '4-6 hours',
            requiredAgents: ['planner', 'architect', 'developer', 'tester', 'reviewer'],
            dependencies: ['authentication-service', 'user-database'],
          },
        },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      // Component should handle complex metadata without issues
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('87%')).toBeInTheDocument();
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();
    });

    it('should handle workflow with command-like input that detected as task', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        input: '/create component Button --type functional --with-props',
        intent: { type: 'task', confidence: 0.73 }, // Lower confidence due to command-like syntax
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      expect(screen.getByText('📝')).toBeInTheDocument(); // Task icon, not command
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('73%')).toBeInTheDocument();
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();
    });
  });

  describe('accessibility in workflow context', () => {
    it('should provide accessible workflow information', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.9 },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      // All important workflow information should be accessible
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('Detected Intent:')).toBeInTheDocument();
      expect(screen.getByText('Task Intent')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 90%')).toBeInTheDocument();
      expect(screen.getByText('Action: Create task (feature workflow)')).toBeInTheDocument();
      expect(screen.getByText('Agent Flow: planner → architect → developer → tester')).toBeInTheDocument();
    });

    it('should provide clear keyboard shortcut information', () => {
      const props: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.9 },
        workflow: 'feature',
      };

      render(<PreviewPanel {...props} />);

      // Keyboard shortcuts should be clearly labeled
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('[Esc]')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('[e]')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('performance with complex workflows', () => {
    it('should handle rapid workflow changes efficiently', () => {
      const { rerender } = render(<PreviewPanel {...baseProps} intent={{ type: 'task', confidence: 0.8 }} workflow="feature" />);

      // Rapidly change workflows
      const workflows = ['feature', 'bugfix', 'hotfix', 'experiment'];

      workflows.forEach(workflow => {
        rerender(<PreviewPanel {...baseProps} intent={{ type: 'task', confidence: 0.8 }} workflow={workflow} />);
        expect(screen.getByText(`Create task (${workflow} workflow)`)).toBeInTheDocument();
      });
    });

    it('should handle multiple preview panels with different workflows', () => {
      const props1: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.9 },
        workflow: 'feature',
      };

      const props2: PreviewPanelProps = {
        ...baseProps,
        intent: { type: 'task', confidence: 0.7 },
        workflow: 'bugfix',
      };

      // This test verifies that multiple instances can coexist
      const { unmount, rerender } = render(<PreviewPanel {...props1} />);
      expect(screen.getByText('Create task (feature workflow)')).toBeInTheDocument();

      rerender(<PreviewPanel {...props2} />);
      expect(screen.getByText('Create task (bugfix workflow)')).toBeInTheDocument();

      unmount();
    });
  });
});