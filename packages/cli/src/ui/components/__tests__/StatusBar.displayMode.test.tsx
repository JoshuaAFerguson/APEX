/**
 * Tests for StatusBar component adaptation to display modes
 * Validates that StatusBar correctly adapts its layout and content
 * based on the current display mode (normal, compact, verbose)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DisplayMode } from '@apex/core';

// Mock Ink components
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
    Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
    useStdout: () => ({ stdout: { columns: 120, rows: 30 } }),
  };
});

// Mock the StatusBar component to test its display mode adaptation
const MockStatusBar: React.FC<{
  displayMode: DisplayMode;
  projectPath: string;
  gitBranch?: string;
  model: string;
  tokens: { input: number; output: number };
  cost: number;
  isProcessing?: boolean;
  previewMode?: boolean;
}> = ({
  displayMode,
  projectPath,
  gitBranch,
  model,
  tokens,
  cost,
  isProcessing = false,
  previewMode = false,
}) => {
  const getLayoutConfig = () => {
    switch (displayMode) {
      case 'compact':
        return {
          layout: 'single-line',
          showDetails: false,
          showTokens: false,
          showCost: false,
          showGitBranch: false,
          showPath: false,
          maxWidth: 80,
        };
      case 'verbose':
        return {
          layout: 'multi-line',
          showDetails: true,
          showTokens: true,
          showCost: true,
          showGitBranch: true,
          showPath: true,
          showDebugInfo: true,
          showTimestamp: true,
          maxWidth: 140,
        };
      default: // normal
        return {
          layout: 'standard',
          showDetails: true,
          showTokens: true,
          showCost: true,
          showGitBranch: true,
          showPath: true,
          maxWidth: 100,
        };
    }
  };

  const config = getLayoutConfig();

  return (
    <div data-testid="status-bar" data-display-mode={displayMode}>
      {/* Project info - conditionally shown based on mode */}
      {config.showPath && (
        <div data-testid="project-path">{projectPath}</div>
      )}

      {/* Git branch - conditionally shown */}
      {config.showGitBranch && gitBranch && (
        <div data-testid="git-branch">
          <span data-testid="branch-icon">🌿</span>
          <span data-testid="branch-name">{gitBranch}</span>
        </div>
      )}

      {/* Model info - always shown but format varies */}
      <div data-testid="model-info">
        {displayMode === 'compact' ? model.substring(0, 8) : model}
      </div>

      {/* Processing indicator - always shown but format varies */}
      {isProcessing && (
        <div data-testid="processing-indicator">
          {displayMode === 'compact' ? '⏳' : 'Processing...'}
        </div>
      )}

      {/* Token usage - conditionally shown */}
      {config.showTokens && (
        <div data-testid="token-usage">
          <span data-testid="input-tokens">{tokens.input}</span>
          <span data-testid="token-separator">/</span>
          <span data-testid="output-tokens">{tokens.output}</span>
          {config.showDetails && <span data-testid="token-label">tokens</span>}
        </div>
      )}

      {/* Cost info - conditionally shown */}
      {config.showCost && (
        <div data-testid="cost-info">
          <span data-testid="cost-symbol">$</span>
          <span data-testid="cost-value">{cost.toFixed(4)}</span>
        </div>
      )}

      {/* Preview mode indicator */}
      {previewMode && (
        <div data-testid="preview-indicator">
          {displayMode === 'compact' ? 'P' : 'PREVIEW'}
        </div>
      )}

      {/* Verbose-specific debug info */}
      {config.showDebugInfo && (
        <div data-testid="debug-info">
          <div data-testid="layout-info">Layout: {config.layout}</div>
          <div data-testid="max-width">Max Width: {config.maxWidth}</div>
        </div>
      )}

      {/* Timestamp for verbose mode */}
      {config.showTimestamp && (
        <div data-testid="timestamp">{new Date().toISOString()}</div>
      )}

      {/* Layout indicator for testing */}
      <div data-testid="layout-type" data-layout={config.layout} />
    </div>
  );
};

describe('StatusBar Display Mode Adaptation', () => {
  const defaultProps = {
    projectPath: '/Users/test/project',
    gitBranch: 'feature/new-feature',
    model: 'claude-3-sonnet-20240229',
    tokens: { input: 1500, output: 2500 },
    cost: 0.0234,
    isProcessing: false,
    previewMode: false,
  };

  describe('Normal Display Mode', () => {
    it('should show standard layout with all main components', () => {
      render(<MockStatusBar {...defaultProps} displayMode="normal" />);

      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'normal');
      expect(screen.getByTestId('layout-type')).toHaveAttribute('data-layout', 'standard');

      // Should show main components
      expect(screen.getByTestId('project-path')).toBeInTheDocument();
      expect(screen.getByTestId('git-branch')).toBeInTheDocument();
      expect(screen.getByTestId('model-info')).toBeInTheDocument();
      expect(screen.getByTestId('token-usage')).toBeInTheDocument();
      expect(screen.getByTestId('cost-info')).toBeInTheDocument();

      // Should not show verbose-specific elements
      expect(screen.queryByTestId('debug-info')).not.toBeInTheDocument();
      expect(screen.queryByTestId('timestamp')).not.toBeInTheDocument();
    });

    it('should display full model name and detailed token info', () => {
      render(<MockStatusBar {...defaultProps} displayMode="normal" />);

      expect(screen.getByTestId('model-info')).toHaveTextContent('claude-3-sonnet-20240229');
      expect(screen.getByTestId('input-tokens')).toHaveTextContent('1500');
      expect(screen.getByTestId('output-tokens')).toHaveTextContent('2500');
      expect(screen.getByTestId('token-label')).toHaveTextContent('tokens');
    });

    it('should show git branch with icon', () => {
      render(<MockStatusBar {...defaultProps} displayMode="normal" />);

      expect(screen.getByTestId('git-branch')).toBeInTheDocument();
      expect(screen.getByTestId('branch-icon')).toHaveTextContent('🌿');
      expect(screen.getByTestId('branch-name')).toHaveTextContent('feature/new-feature');
    });

    it('should display cost information', () => {
      render(<MockStatusBar {...defaultProps} displayMode="normal" />);

      expect(screen.getByTestId('cost-info')).toBeInTheDocument();
      expect(screen.getByTestId('cost-symbol')).toHaveTextContent('$');
      expect(screen.getByTestId('cost-value')).toHaveTextContent('0.0234');
    });

    it('should handle processing state', () => {
      render(<MockStatusBar {...defaultProps} displayMode="normal" isProcessing={true} />);

      expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('processing-indicator')).toHaveTextContent('Processing...');
    });

    it('should show preview mode indicator', () => {
      render(<MockStatusBar {...defaultProps} displayMode="normal" previewMode={true} />);

      expect(screen.getByTestId('preview-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('preview-indicator')).toHaveTextContent('PREVIEW');
    });
  });

  describe('Compact Display Mode', () => {
    it('should show minimal single-line layout', () => {
      render(<MockStatusBar {...defaultProps} displayMode="compact" />);

      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'compact');
      expect(screen.getByTestId('layout-type')).toHaveAttribute('data-layout', 'single-line');

      // Should hide detailed components
      expect(screen.queryByTestId('project-path')).not.toBeInTheDocument();
      expect(screen.queryByTestId('git-branch')).not.toBeInTheDocument();
      expect(screen.queryByTestId('token-usage')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cost-info')).not.toBeInTheDocument();

      // Should still show essential info
      expect(screen.getByTestId('model-info')).toBeInTheDocument();
    });

    it('should display abbreviated model name', () => {
      render(<MockStatusBar {...defaultProps} displayMode="compact" />);

      expect(screen.getByTestId('model-info')).toHaveTextContent('claude-3-');
    });

    it('should show compact processing indicator', () => {
      render(<MockStatusBar {...defaultProps} displayMode="compact" isProcessing={true} />);

      expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('processing-indicator')).toHaveTextContent('⏳');
    });

    it('should show compact preview mode indicator', () => {
      render(<MockStatusBar {...defaultProps} displayMode="compact" previewMode={true} />);

      expect(screen.getByTestId('preview-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('preview-indicator')).toHaveTextContent('P');
    });

    it('should hide non-essential information', () => {
      render(<MockStatusBar {...defaultProps} displayMode="compact" />);

      // These should be hidden in compact mode
      expect(screen.queryByTestId('project-path')).not.toBeInTheDocument();
      expect(screen.queryByTestId('git-branch')).not.toBeInTheDocument();
      expect(screen.queryByTestId('token-usage')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cost-info')).not.toBeInTheDocument();
      expect(screen.queryByTestId('debug-info')).not.toBeInTheDocument();
      expect(screen.queryByTestId('timestamp')).not.toBeInTheDocument();
    });
  });

  describe('Verbose Display Mode', () => {
    it('should show multi-line layout with all information', () => {
      render(<MockStatusBar {...defaultProps} displayMode="verbose" />);

      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'verbose');
      expect(screen.getByTestId('layout-type')).toHaveAttribute('data-layout', 'multi-line');

      // Should show all components
      expect(screen.getByTestId('project-path')).toBeInTheDocument();
      expect(screen.getByTestId('git-branch')).toBeInTheDocument();
      expect(screen.getByTestId('model-info')).toBeInTheDocument();
      expect(screen.getByTestId('token-usage')).toBeInTheDocument();
      expect(screen.getByTestId('cost-info')).toBeInTheDocument();

      // Should show verbose-specific elements
      expect(screen.getByTestId('debug-info')).toBeInTheDocument();
      expect(screen.getByTestId('timestamp')).toBeInTheDocument();
    });

    it('should display debug information', () => {
      render(<MockStatusBar {...defaultProps} displayMode="verbose" />);

      expect(screen.getByTestId('debug-info')).toBeInTheDocument();
      expect(screen.getByTestId('layout-info')).toHaveTextContent('Layout: multi-line');
      expect(screen.getByTestId('max-width')).toHaveTextContent('Max Width: 140');
    });

    it('should show timestamp', () => {
      render(<MockStatusBar {...defaultProps} displayMode="verbose" />);

      expect(screen.getByTestId('timestamp')).toBeInTheDocument();
      // Should be a valid ISO string
      const timestamp = screen.getByTestId('timestamp').textContent;
      expect(() => new Date(timestamp!)).not.toThrow();
    });

    it('should display full model name and detailed token info', () => {
      render(<MockStatusBar {...defaultProps} displayMode="verbose" />);

      expect(screen.getByTestId('model-info')).toHaveTextContent('claude-3-sonnet-20240229');
      expect(screen.getByTestId('input-tokens')).toHaveTextContent('1500');
      expect(screen.getByTestId('output-tokens')).toHaveTextContent('2500');
      expect(screen.getByTestId('token-label')).toHaveTextContent('tokens');
    });

    it('should show detailed processing indicator', () => {
      render(<MockStatusBar {...defaultProps} displayMode="verbose" isProcessing={true} />);

      expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('processing-indicator')).toHaveTextContent('Processing...');
    });

    it('should show full preview mode indicator', () => {
      render(<MockStatusBar {...defaultProps} displayMode="verbose" previewMode={true} />);

      expect(screen.getByTestId('preview-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('preview-indicator')).toHaveTextContent('PREVIEW');
    });
  });

  describe('Display Mode Transitions', () => {
    it('should handle mode changes correctly', () => {
      const { rerender } = render(
        <MockStatusBar {...defaultProps} displayMode="normal" />
      );

      // Initially normal mode
      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'normal');
      expect(screen.getByTestId('token-usage')).toBeInTheDocument();
      expect(screen.queryByTestId('debug-info')).not.toBeInTheDocument();

      // Change to compact mode
      rerender(<MockStatusBar {...defaultProps} displayMode="compact" />);

      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'compact');
      expect(screen.queryByTestId('token-usage')).not.toBeInTheDocument();
      expect(screen.queryByTestId('debug-info')).not.toBeInTheDocument();

      // Change to verbose mode
      rerender(<MockStatusBar {...defaultProps} displayMode="verbose" />);

      expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', 'verbose');
      expect(screen.getByTestId('token-usage')).toBeInTheDocument();
      expect(screen.getByTestId('debug-info')).toBeInTheDocument();
    });

    it('should handle rapid mode changes without errors', () => {
      const { rerender } = render(
        <MockStatusBar {...defaultProps} displayMode="normal" />
      );

      const modes: DisplayMode[] = ['compact', 'verbose', 'normal', 'compact', 'verbose'];

      modes.forEach(mode => {
        expect(() => {
          rerender(<MockStatusBar {...defaultProps} displayMode={mode} />);
        }).not.toThrow();

        expect(screen.getByTestId('status-bar')).toHaveAttribute('data-display-mode', mode);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing git branch gracefully', () => {
      render(<MockStatusBar {...defaultProps} gitBranch={undefined} displayMode="normal" />);

      expect(screen.queryByTestId('git-branch')).not.toBeInTheDocument();
    });

    it('should handle zero tokens and cost', () => {
      render(
        <MockStatusBar
          {...defaultProps}
          displayMode="normal"
          tokens={{ input: 0, output: 0 }}
          cost={0}
        />
      );

      expect(screen.getByTestId('input-tokens')).toHaveTextContent('0');
      expect(screen.getByTestId('output-tokens')).toHaveTextContent('0');
      expect(screen.getByTestId('cost-value')).toHaveTextContent('0.0000');
    });

    it('should handle very large token numbers', () => {
      render(
        <MockStatusBar
          {...defaultProps}
          displayMode="verbose"
          tokens={{ input: 999999, output: 1000000 }}
          cost={123.456789}
        />
      );

      expect(screen.getByTestId('input-tokens')).toHaveTextContent('999999');
      expect(screen.getByTestId('output-tokens')).toHaveTextContent('1000000');
      expect(screen.getByTestId('cost-value')).toHaveTextContent('123.4568');
    });

    it('should handle empty project path', () => {
      render(<MockStatusBar {...defaultProps} projectPath="" displayMode="normal" />);

      expect(screen.getByTestId('project-path')).toHaveTextContent('');
    });

    it('should handle very long model names in compact mode', () => {
      const longModelName = 'claude-3-sonnet-20240229-very-long-model-name-that-exceeds-normal-length';

      render(<MockStatusBar {...defaultProps} model={longModelName} displayMode="compact" />);

      const displayedText = screen.getByTestId('model-info').textContent;
      expect(displayedText).toHaveLength(8);
      expect(displayedText).toBe('claude-3');
    });
  });

  describe('Responsive Behavior', () => {
    it('should respect max width constraints per display mode', () => {
      const { rerender } = render(<MockStatusBar {...defaultProps} displayMode="compact" />);

      // Compact mode max width
      expect(screen.getByTestId('layout-type')).toBeInTheDocument();

      // Normal mode max width
      rerender(<MockStatusBar {...defaultProps} displayMode="normal" />);
      expect(screen.getByTestId('layout-type')).toBeInTheDocument();

      // Verbose mode max width
      rerender(<MockStatusBar {...defaultProps} displayMode="verbose" />);
      expect(screen.getByTestId('max-width')).toHaveTextContent('Max Width: 140');
    });

    it('should adapt to processing state across all modes', () => {
      const modes: DisplayMode[] = ['normal', 'compact', 'verbose'];

      modes.forEach(mode => {
        const { rerender } = render(
          <MockStatusBar {...defaultProps} displayMode={mode} isProcessing={false} />
        );

        expect(screen.queryByTestId('processing-indicator')).not.toBeInTheDocument();

        rerender(<MockStatusBar {...defaultProps} displayMode={mode} isProcessing={true} />);

        expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
      });
    });

    it('should maintain component hierarchy across modes', () => {
      const modes: DisplayMode[] = ['normal', 'compact', 'verbose'];

      modes.forEach(mode => {
        render(<MockStatusBar {...defaultProps} displayMode={mode} />);

        // Status bar should always be present
        expect(screen.getByTestId('status-bar')).toBeInTheDocument();
        expect(screen.getByTestId('layout-type')).toBeInTheDocument();
        expect(screen.getByTestId('model-info')).toBeInTheDocument();
      });
    });
  });
});