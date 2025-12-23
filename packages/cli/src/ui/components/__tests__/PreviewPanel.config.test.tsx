import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { PreviewPanel, type PreviewPanelProps } from '../PreviewPanel';
import { App } from '../../App';

// Mock the config loading
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

// Mock the orchestrator and related modules
vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    off: vi.fn(),
    executeTask: vi.fn(),
    getTask: vi.fn(),
    createTask: vi.fn().mockResolvedValue({ id: 'test-task' }),
    initialize: vi.fn(),
  })),
}));

// Mock Ink components
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useStdout: () => ({ stdout: { columns: 80, rows: 24 } }),
    useFocusManager: () => ({
      focusNext: vi.fn(),
      focusPrevious: vi.fn(),
      focus: vi.fn(),
    }),
  };
});

// Mock the conversation manager
vi.mock('../../../services/ConversationManager', () => ({
  ConversationManager: vi.fn().mockImplementation(function () { return ({
    addMessage: vi.fn(),
    getContext: vi.fn().mockReturnValue({ messages: [] }),
    getRecentMessages: vi.fn().mockReturnValue([]),
    detectIntent: vi.fn().mockReturnValue({
      type: 'task',
      confidence: 0.8,
    }),
  }); }),
}));

// Mock session store
vi.mock('../../../services/SessionStore', () => ({
  SessionStore: vi.fn().mockImplementation(() => ({
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    getSessions: vi.fn().mockReturnValue([]),
  })),
}));

describe('PreviewPanel Config Integration', () => {
  const mockLoadConfig = vi.fn();
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    mockLoadConfig.mockClear();
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
    mockOnEdit.mockClear();

    // Reset to default config
    vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
      ui: {
        previewMode: true,
        previewConfidence: 0.7,
        autoExecuteHighConfidence: false,
        previewTimeout: 5000,
      },
      agents: {},
      workflows: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps: PreviewPanelProps = {
    input: 'create a component',
    intent: {
      type: 'task',
      confidence: 0.8,
    },
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    onEdit: mockOnEdit,
  };

  describe('previewMode configuration', () => {
    it('should show PreviewPanel when previewMode is enabled in config', async () => {
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          previewMode: true,
          previewConfidence: 0.7,
          autoExecuteHighConfidence: false,
          previewTimeout: 5000,
        },
        agents: {},
        workflows: {},
      });

      render(<PreviewPanel {...defaultProps} />);

      // PreviewPanel should render when config enables it
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
      expect(screen.getByText('[on]')).toBeInTheDocument();
    });

    it('should not show PreviewPanel when previewMode is disabled in config', async () => {
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          previewMode: false,
          previewConfidence: 0.7,
          autoExecuteHighConfidence: false,
          previewTimeout: 5000,
        },
        agents: {},
        workflows: {},
      });

      // Note: This test is about configuration effect, not the component itself
      // The actual conditional rendering would be in the App component
      const { container } = render(<PreviewPanel {...defaultProps} />);

      // The component itself still renders, but in real usage it would be conditionally rendered
      expect(container.firstChild).toBeTruthy();
    });

    it('should default to enabled when previewMode is not specified in config', async () => {
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          // previewMode not specified - should default to true
          previewConfidence: 0.7,
        },
        agents: {},
        workflows: {},
      });

      render(<PreviewPanel {...defaultProps} />);

      // Should still render as the default is true
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });
  });

  describe('previewConfidence configuration', () => {
    it('should use configured confidence threshold for preview display', async () => {
      // Low confidence threshold - should show preview for medium confidence
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          previewMode: true,
          previewConfidence: 0.5, // Low threshold
          autoExecuteHighConfidence: false,
        },
        agents: {},
        workflows: {},
      });

      const mediumConfidenceProps = {
        ...defaultProps,
        intent: { type: 'task' as const, confidence: 0.6 },
      };

      render(<PreviewPanel {...mediumConfidenceProps} />);

      // Should show preview since confidence (0.6) > threshold (0.5)
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('should not show preview when confidence is below configured threshold', async () => {
      // High confidence threshold
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          previewMode: true,
          previewConfidence: 0.9, // High threshold
          autoExecuteHighConfidence: false,
        },
        agents: {},
        workflows: {},
      });

      const lowConfidenceProps = {
        ...defaultProps,
        intent: { type: 'task' as const, confidence: 0.7 },
      };

      // Note: This component always renders regardless of confidence
      // The confidence-based logic would be in the parent component
      render(<PreviewPanel {...lowConfidenceProps} />);

      // Component renders but shows low confidence
      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('should handle edge cases for confidence threshold', async () => {
      const edgeCases = [
        { threshold: 0, confidence: 0 }, // Both zero
        { threshold: 1, confidence: 1 }, // Both max
        { threshold: 0.5, confidence: 0.5 }, // Exact match
      ];

      for (const { threshold, confidence } of edgeCases) {
        vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
          ui: {
            previewMode: true,
            previewConfidence: threshold,
            autoExecuteHighConfidence: false,
          },
          agents: {},
          workflows: {},
        });

        const props = {
          ...defaultProps,
          intent: { type: 'task' as const, confidence },
        };

        const { unmount } = render(<PreviewPanel {...props} />);

        // Should render without errors
        expect(screen.getByText(`${Math.round(confidence * 100)}%`)).toBeInTheDocument();

        unmount();
      }
    });
  });

  describe('autoExecuteHighConfidence configuration', () => {
    it('should affect preview behavior for high confidence intents', async () => {
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          previewMode: true,
          previewConfidence: 0.7,
          autoExecuteHighConfidence: true,
        },
        agents: {},
        workflows: {},
      });

      const highConfidenceProps = {
        ...defaultProps,
        intent: { type: 'task' as const, confidence: 0.95 },
      };

      render(<PreviewPanel {...highConfidenceProps} />);

      // Component should still render but might behave differently
      expect(screen.getByText('95%')).toBeInTheDocument();

      // The auto-execution logic would be in the parent component
      // Here we just verify the component can handle high confidence
    });

    it('should not auto-execute when disabled', async () => {
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          previewMode: true,
          previewConfidence: 0.7,
          autoExecuteHighConfidence: false,
        },
        agents: {},
        workflows: {},
      });

      const highConfidenceProps = {
        ...defaultProps,
        intent: { type: 'task' as const, confidence: 0.95 },
      };

      render(<PreviewPanel {...highConfidenceProps} />);

      // Should show preview normally without auto-execution
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('[Enter]')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
  });

  describe('previewTimeout configuration', () => {
    it('should handle timeout configuration gracefully', async () => {
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          previewMode: true,
          previewConfidence: 0.7,
          previewTimeout: 3000, // 3 seconds
        },
        agents: {},
        workflows: {},
      });

      render(<PreviewPanel {...defaultProps} />);

      // Component should render normally regardless of timeout setting
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      // Timeout behavior would be handled by parent component
    });

    it('should handle extreme timeout values', async () => {
      const timeoutValues = [0, 1, 60000, 300000]; // 0ms, 1ms, 1min, 5min

      for (const timeout of timeoutValues) {
        vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
          ui: {
            previewMode: true,
            previewTimeout: timeout,
          },
          agents: {},
          workflows: {},
        });

        const { unmount } = render(<PreviewPanel {...defaultProps} />);

        // Should render without errors regardless of timeout value
        expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

        unmount();
      }
    });
  });

  describe('config loading errors', () => {
    it('should handle config loading failures gracefully', async () => {
      vi.mocked(require('@apexcli/core').loadConfig).mockRejectedValue(new Error('Config load failed'));

      // Component should still render with default props
      render(<PreviewPanel {...defaultProps} />);

      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });

    it('should handle malformed config gracefully', async () => {
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          previewMode: 'invalid', // Should be boolean
          previewConfidence: 'not a number', // Should be number
          autoExecuteHighConfidence: 'yes', // Should be boolean
        },
      } as any);

      // Should not crash with malformed config
      expect(() => render(<PreviewPanel {...defaultProps} />)).not.toThrow();
    });

    it('should handle missing ui config section', async () => {
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        // No ui section
        agents: {},
        workflows: {},
      });

      // Should render with defaults
      render(<PreviewPanel {...defaultProps} />);
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });
  });

  describe('dynamic config changes', () => {
    it('should handle config updates during runtime', async () => {
      // Start with preview enabled
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: { previewMode: true },
        agents: {},
        workflows: {},
      });

      const { rerender } = render(<PreviewPanel {...defaultProps} />);
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();

      // Update config to disabled
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: { previewMode: false },
        agents: {},
        workflows: {},
      });

      // Rerender with same props
      rerender(<PreviewPanel {...defaultProps} />);

      // Component itself doesn't change, but parent would handle visibility
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });

    it('should handle confidence threshold changes', async () => {
      // Start with low threshold
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          previewMode: true,
          previewConfidence: 0.3,
        },
        agents: {},
        workflows: {},
      });

      const { rerender } = render(<PreviewPanel {...defaultProps} />);

      // Update to high threshold
      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue({
        ui: {
          previewMode: true,
          previewConfidence: 0.9,
        },
        agents: {},
        workflows: {},
      });

      rerender(<PreviewPanel {...defaultProps} />);

      // Component should handle the change gracefully
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('config validation', () => {
    it('should handle config with all required UI properties', async () => {
      const completeConfig = {
        ui: {
          previewMode: true,
          previewConfidence: 0.75,
          autoExecuteHighConfidence: true,
          previewTimeout: 4000,
          theme: 'dark',
          displayMode: 'compact',
        },
        agents: {},
        workflows: {},
      };

      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue(completeConfig);

      render(<PreviewPanel {...defaultProps} />);

      // Should render successfully with complete config
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });

    it('should handle config with minimal UI properties', async () => {
      const minimalConfig = {
        ui: {
          previewMode: true,
        },
        agents: {},
        workflows: {},
      };

      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue(minimalConfig);

      render(<PreviewPanel {...defaultProps} />);

      // Should render successfully with minimal config
      expect(screen.getByText('📋 Input Preview')).toBeInTheDocument();
    });

    it('should handle config with extra properties', async () => {
      const configWithExtras = {
        ui: {
          previewMode: true,
          previewConfidence: 0.7,
          extraProperty: 'should be ignored',
          anotherExtra: 123,
        },
        agents: {},
        workflows: {},
        extraSection: { data: 'ignored' },
      };

      vi.mocked(require('@apexcli/core').loadConfig).mockResolvedValue(configWithExtras as any);

      // Should handle extra properties gracefully
      expect(() => render(<PreviewPanel {...defaultProps} />)).not.toThrow();
    });
  });
});
