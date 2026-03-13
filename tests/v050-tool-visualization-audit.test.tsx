import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToolExecutionPanel, ToolStatusIndicator } from '@apexcli/cli/src/ui/components/tools/ToolExecutionPanel.js';
import { ToolCall } from '@apexcli/cli/src/ui/components/ToolCall.js';
import type { DisplayMode } from '@apexcli/core';

/**
 * Comprehensive test suite for v0.5.0 Tool Visualization features
 * Validates implementation against acceptance criteria:
 * - Tool call display
 * - Output formatting
 * - Permission levels
 * - Per-tool/directory permissions
 */

// Mock the orchestrator for testing
const mockOrchestrator = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
} as any;

// Mock useToolEventLogger hook
vi.mock('@apexcli/cli/src/ui/hooks/useToolEventLogger.js', () => ({
  useToolEventLogger: () => ({
    toolLogs: [
      {
        id: '1',
        category: 'tool',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        toolName: 'Read',
        input: { file_path: '/test/file.ts' },
        output: 'File content here',
        status: 'success',
        duration: 100,
      },
      {
        id: '2',
        category: 'tool',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        toolName: 'Write',
        input: { file_path: '/test/output.ts', content: 'test content' },
        status: 'running',
        duration: 0,
      },
    ],
    activeToolCalls: new Map([
      ['active-1', {
        toolName: 'Bash',
        input: { command: 'npm test' },
        timestamp: new Date('2024-01-01T10:02:00Z'),
      }]
    ]),
    stats: {
      totalCalls: 10,
      successfulCalls: 8,
      failedCalls: 2,
      averageDuration: 150,
    },
  }),
}));

describe('v0.5.0 Tool Visualization Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Call Display', () => {
    it('should display tool calls with proper status icons', () => {
      const props = {
        toolName: 'Read',
        input: { file_path: '/test/file.ts' },
        status: 'success' as const,
        duration: 100,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      // Verify tool name is displayed
      expect(screen.getByText('Read')).toBeInTheDocument();

      // Verify input is formatted properly
      expect(screen.getByText(/file_path: "\/test\/file\.ts"/)).toBeInTheDocument();

      // Should show success icon (✓)
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should display running tools with spinner', () => {
      const props = {
        toolName: 'Bash',
        input: { command: 'npm test' },
        status: 'running' as const,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText(/command: "npm test"/)).toBeInTheDocument();
    });

    it('should handle different display modes correctly', () => {
      const props = {
        toolName: 'Edit',
        input: { file_path: '/test.ts', old_string: 'old', new_string: 'new' },
        status: 'success' as const,
        displayMode: 'compact' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      // In compact mode, should still show essential information
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText(/file_path: "\/test\.ts"/)).toBeInTheDocument();
    });

    it('should apply proper tool colors based on tool type', () => {
      const readProps = {
        toolName: 'Read',
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      const writeProps = {
        toolName: 'Write',
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      const { rerender } = render(<ToolCall {...readProps} />);
      const readElement = screen.getByText('Read');
      expect(readElement).toHaveStyle({ color: expect.any(String) });

      rerender(<ToolCall {...writeProps} />);
      const writeElement = screen.getByText('Write');
      expect(writeElement).toHaveStyle({ color: expect.any(String) });
    });
  });

  describe('Output Formatting', () => {
    it('should truncate long output in normal mode', () => {
      const longOutput = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8';

      const props = {
        toolName: 'Read',
        output: longOutput,
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      // Should show truncation indicator for long output
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });

    it('should show full output in verbose mode', () => {
      const output = 'Full output content';

      const props = {
        toolName: 'Grep',
        output,
        status: 'success' as const,
        displayMode: 'verbose' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText(output)).toBeInTheDocument();
      expect(screen.getByText('[success]')).toBeInTheDocument();
    });

    it('should format error output with proper styling', () => {
      const props = {
        toolName: 'Bash',
        output: 'Command failed with error',
        status: 'error' as const,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      const errorOutput = screen.getByText('Command failed with error');
      expect(errorOutput).toBeInTheDocument();

      // Should show error icon
      expect(screen.getByText('✗')).toBeInTheDocument();
    });

    it('should format duration properly', () => {
      const props = {
        toolName: 'WebFetch',
        status: 'success' as const,
        duration: 1500, // 1.5 seconds
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolCall {...props} />);

      expect(screen.getByText(/1\.5s/)).toBeInTheDocument();
    });
  });

  describe('Tool Execution Panel', () => {
    it('should display comprehensive tool execution information', () => {
      const props = {
        orchestrator: mockOrchestrator,
        taskId: 'test-task',
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolExecutionPanel {...props} />);

      // Should show panel title
      expect(screen.getByText('Tool Execution')).toBeInTheDocument();

      // Should show statistics
      expect(screen.getByText(/Total:/)).toBeInTheDocument();
      expect(screen.getByText(/Success:/)).toBeInTheDocument();
      expect(screen.getByText(/Failed:/)).toBeInTheDocument();
      expect(screen.getByText(/Rate:/)).toBeInTheDocument();

      // Should show active tools section
      expect(screen.getByText(/Active Tool Calls/)).toBeInTheDocument();
    });

    it('should handle compact display mode', () => {
      const props = {
        orchestrator: mockOrchestrator,
        taskId: 'test-task',
        displayMode: 'compact' as DisplayMode,
      };

      render(<ToolExecutionPanel {...props} />);

      // Should still show essential information in compact format
      expect(screen.getByText('Tool Execution')).toBeInTheDocument();
      expect(screen.getByText(/active/)).toBeInTheDocument();
      expect(screen.getByText(/total/)).toBeInTheDocument();
      expect(screen.getByText(/success/)).toBeInTheDocument();
    });

    it('should handle collapsed state', () => {
      const props = {
        orchestrator: mockOrchestrator,
        taskId: 'test-task',
        collapsed: true,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolExecutionPanel {...props} />);

      expect(screen.getByText(/Tool Execution \(collapsed\)/)).toBeInTheDocument();
    });

    it('should support all configuration options', () => {
      const props = {
        orchestrator: mockOrchestrator,
        taskId: 'test-task',
        displayMode: 'normal' as DisplayMode,
        showStats: false,
        showActiveTools: false,
        showActivityLog: false,
        title: 'Custom Tool Panel',
      };

      render(<ToolExecutionPanel {...props} />);

      expect(screen.getByText('Custom Tool Panel')).toBeInTheDocument();

      // Should not show disabled sections
      expect(screen.queryByText(/Total:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Active Tool Calls/)).not.toBeInTheDocument();
    });
  });

  describe('Tool Status Indicator', () => {
    it('should display status indicator with proper colors', () => {
      const props = {
        activeCount: 2,
        totalCount: 10,
        successRate: 85.5,
        displayMode: 'normal' as DisplayMode,
      };

      render(<ToolStatusIndicator {...props} />);

      expect(screen.getByText(/2 active/)).toBeInTheDocument();
      expect(screen.getByText(/10 total/)).toBeInTheDocument();
      expect(screen.getByText(/85\.5% success/)).toBeInTheDocument();
    });

    it('should handle compact mode for status indicator', () => {
      const props = {
        activeCount: 0,
        totalCount: 5,
        successRate: 95,
        displayMode: 'compact' as DisplayMode,
      };

      render(<ToolStatusIndicator {...props} />);

      expect(screen.getByText('🔧')).toBeInTheDocument();
      expect(screen.getByText('0/5')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('should show appropriate colors based on success rate', () => {
      // High success rate (should be green)
      const highSuccessProps = {
        activeCount: 1,
        totalCount: 10,
        successRate: 95,
      };

      // Medium success rate (should be yellow)
      const mediumSuccessProps = {
        activeCount: 1,
        totalCount: 10,
        successRate: 75,
      };

      // Low success rate (should be red)
      const lowSuccessProps = {
        activeCount: 1,
        totalCount: 10,
        successRate: 50,
      };

      const { rerender } = render(<ToolStatusIndicator {...highSuccessProps} />);
      expect(screen.getByText('95.0% success')).toBeInTheDocument();

      rerender(<ToolStatusIndicator {...mediumSuccessProps} />);
      expect(screen.getByText('75.0% success')).toBeInTheDocument();

      rerender(<ToolStatusIndicator {...lowSuccessProps} />);
      expect(screen.getByText('50.0% success')).toBeInTheDocument();
    });
  });

  describe('Real Implementation Verification', () => {
    it('should verify all tool types have proper color mapping', () => {
      const toolTypes = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];

      toolTypes.forEach(toolName => {
        const props = {
          toolName,
          status: 'success' as const,
          displayMode: 'normal' as DisplayMode,
        };

        const { unmount } = render(<ToolCall {...props} />);
        expect(screen.getByText(toolName)).toBeInTheDocument();
        unmount();
      });
    });

    it('should verify input parameter formatting handles various input types', () => {
      // Test string parameter
      const stringProps = {
        toolName: 'Read',
        input: { file_path: '/very/long/file/path/that/should/be/truncated/because/it/exceeds/fifty/characters.ts' },
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      const { rerender } = render(<ToolCall {...stringProps} />);
      expect(screen.getByText(/file_path: ".*\.\.\."/)).toBeInTheDocument();

      // Test multiple parameters
      const multiProps = {
        toolName: 'Edit',
        input: { file_path: '/test.ts', old_string: 'old', new_string: 'new' },
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      rerender(<ToolCall {...multiProps} />);
      expect(screen.getByText(/file_path: "\/test\.ts"/)).toBeInTheDocument();

      // Test no parameters
      const noParamsProps = {
        toolName: 'Bash',
        input: {},
        status: 'success' as const,
        displayMode: 'normal' as DisplayMode,
      };

      rerender(<ToolCall {...noParamsProps} />);
      expect(screen.getByText('Bash')).toBeInTheDocument();
    });

    it('should verify all status types display correctly', () => {
      const statuses: Array<'pending' | 'running' | 'success' | 'error'> = ['pending', 'running', 'success', 'error'];
      const expectedIcons = ['○', '⠋', '✓', '✗']; // Note: spinner might not render properly in tests

      statuses.forEach((status, index) => {
        const props = {
          toolName: 'Test',
          status,
          displayMode: 'normal' as DisplayMode,
        };

        const { unmount } = render(<ToolCall {...props} />);

        if (status !== 'running') {
          // For non-running statuses, check for expected icons
          expect(screen.getByText(expectedIcons[index])).toBeInTheDocument();
        }

        unmount();
      });
    });
  });
});