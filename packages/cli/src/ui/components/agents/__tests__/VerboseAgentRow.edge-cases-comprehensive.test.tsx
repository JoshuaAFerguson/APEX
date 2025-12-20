import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { VerboseAgentRow, type VerboseAgentRowProps } from '../VerboseAgentRow';
import type { AgentInfo } from '../AgentPanel';

/**
 * Comprehensive edge case tests for VerboseAgentRow component
 * Tests boundary conditions, error scenarios, and edge cases
 */
describe('VerboseAgentRow - Comprehensive Edge Cases', () => {
  const mockUseElapsedTime = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));
    mockUseElapsedTime.mockReturnValue('05:30');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useElapsedTime.js');
  });

  const createTestProps = (agentOverrides: Partial<AgentInfo>, propsOverrides: Partial<VerboseAgentRowProps> = {}): VerboseAgentRowProps => ({
    agent: {
      name: 'test-agent',
      status: 'active',
      ...agentOverrides,
    },
    isActive: true,
    color: 'green',
    ...propsOverrides,
  });

  describe('Boundary Value Testing', () => {
    describe('Token Count Boundaries', () => {
      const tokenBoundaryTests = [
        { input: 0, output: 0, expected: '0→0' },
        { input: 1, output: 1, expected: '1→1' },
        { input: 999, output: 999, expected: '999→999' },
        { input: 1000, output: 1000, expected: '1.0k→1.0k' },
        { input: 1001, output: 1001, expected: '1.0k→1.0k' },
        { input: 999999, output: 999999, expected: '999.9k→999.9k' },
        { input: 1000000, output: 1000000, expected: '1.0M→1.0M' },
        { input: 1000001, output: 1000001, expected: '1.0M→1.0M' },
        { input: Number.MAX_SAFE_INTEGER, output: Number.MAX_SAFE_INTEGER - 1, expected: '' }, // Should handle gracefully
      ];

      tokenBoundaryTests.forEach(({ input, output, expected }) => {
        it(`handles token boundary: ${input}→${output}`, () => {
          const props = createTestProps({
            debugInfo: {
              tokensUsed: { input, output },
            },
          });

          render(<VerboseAgentRow {...props} />);

          if (expected) {
            expect(screen.getByText(`🔢 Tokens: ${expected}`)).toBeInTheDocument();
          } else {
            // Should not crash with very large numbers
            expect(screen.queryByText(/🔢 Tokens:/)).toBeInTheDocument();
          }
        });
      });
    });

    describe('Turn Count Boundaries', () => {
      const turnBoundaryTests = [
        { turnCount: 0, shouldShow: false },
        { turnCount: 1, shouldShow: true },
        { turnCount: 999, shouldShow: true },
        { turnCount: 1000, shouldShow: true },
        { turnCount: Number.MAX_SAFE_INTEGER, shouldShow: true },
      ];

      turnBoundaryTests.forEach(({ turnCount, shouldShow }) => {
        it(`handles turn count boundary: ${turnCount}`, () => {
          const props = createTestProps({
            debugInfo: { turnCount },
          });

          render(<VerboseAgentRow {...props} />);

          if (shouldShow && turnCount !== undefined) {
            expect(screen.getByText(`🔄 Turns: ${turnCount}`)).toBeInTheDocument();
          } else {
            expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
          }
        });
      });
    });

    describe('Error Count Boundaries', () => {
      const errorBoundaryTests = [
        { errorCount: 0, shouldShow: false },
        { errorCount: 1, shouldShow: true },
        { errorCount: 100, shouldShow: true },
        { errorCount: Number.MAX_SAFE_INTEGER, shouldShow: true },
      ];

      errorBoundaryTests.forEach(({ errorCount, shouldShow }) => {
        it(`handles error count boundary: ${errorCount}`, () => {
          const props = createTestProps({
            debugInfo: { errorCount },
          });

          render(<VerboseAgentRow {...props} />);

          if (shouldShow) {
            expect(screen.getByText(`❌ Errors: ${errorCount}`)).toBeInTheDocument();
          } else {
            expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
          }
        });
      });
    });

    describe('Progress Boundaries', () => {
      const progressBoundaryTests = [
        { progress: undefined, shouldShow: false },
        { progress: 0, shouldShow: false },
        { progress: 0.1, shouldShow: true },
        { progress: 1, shouldShow: true },
        { progress: 50, shouldShow: true },
        { progress: 99, shouldShow: true },
        { progress: 99.9, shouldShow: true },
        { progress: 100, shouldShow: false },
        { progress: 101, shouldShow: false }, // Invalid but should handle gracefully
      ];

      progressBoundaryTests.forEach(({ progress, shouldShow }) => {
        it(`handles progress boundary: ${progress}`, () => {
          const props = createTestProps({
            status: 'active',
            progress,
          });

          render(<VerboseAgentRow {...props} />);

          if (shouldShow) {
            expect(screen.getByText(`${Math.floor(progress!)}%`)).toBeInTheDocument();
          } else {
            expect(screen.queryByText(/%/)).not.toBeInTheDocument();
          }
        });
      });
    });
  });

  describe('Data Type Edge Cases', () => {
    it('handles NaN token values gracefully', () => {
      const props = createTestProps({
        debugInfo: {
          tokensUsed: { input: NaN, output: NaN },
        },
      });

      expect(() => render(<VerboseAgentRow {...props} />)).not.toThrow();
    });

    it('handles Infinity token values gracefully', () => {
      const props = createTestProps({
        debugInfo: {
          tokensUsed: { input: Infinity, output: -Infinity },
        },
      });

      expect(() => render(<VerboseAgentRow {...props} />)).not.toThrow();
    });

    it('handles negative token values gracefully', () => {
      const props = createTestProps({
        debugInfo: {
          tokensUsed: { input: -1000, output: -500 },
        },
      });

      render(<VerboseAgentRow {...props} />);

      // Should not crash, may or may not display (implementation dependent)
      expect(screen.getByText('test-agent')).toBeInTheDocument();
    });

    it('handles negative turn count gracefully', () => {
      const props = createTestProps({
        debugInfo: {
          turnCount: -5,
        },
      });

      expect(() => render(<VerboseAgentRow {...props} />)).not.toThrow();
    });

    it('handles negative error count gracefully', () => {
      const props = createTestProps({
        debugInfo: {
          errorCount: -1,
        },
      });

      render(<VerboseAgentRow {...props} />);

      // Negative error count should not be shown
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });

    it('handles decimal progress values correctly', () => {
      const props = createTestProps({
        status: 'active',
        progress: 45.7,
      });

      render(<VerboseAgentRow {...props} />);
      expect(screen.getByText('45%')).toBeInTheDocument(); // Should floor decimal
    });
  });

  describe('String Edge Cases', () => {
    describe('Agent Name Edge Cases', () => {
      const nameEdgeCases = [
        { name: '', description: 'empty string' },
        { name: ' ', description: 'whitespace' },
        { name: 'a', description: 'single character' },
        { name: 'agent-with-very-long-name-that-might-cause-layout-issues', description: 'very long name' },
        { name: 'agent\nwith\nnewlines', description: 'name with newlines' },
        { name: 'agent\twith\ttabs', description: 'name with tabs' },
        { name: 'agent with spaces', description: 'name with spaces' },
        { name: 'агент', description: 'unicode characters' },
        { name: '🤖 agent 🚀', description: 'emoji characters' },
        { name: 'agent_with_underscores', description: 'underscores' },
        { name: 'agent-with-hyphens', description: 'hyphens' },
        { name: 'AGENT_IN_CAPS', description: 'uppercase' },
        { name: 'agent.with.dots', description: 'dots' },
        { name: 'agent@domain.com', description: 'email-like' },
        { name: 'agent/path/like', description: 'path-like' },
      ];

      nameEdgeCases.forEach(({ name, description }) => {
        it(`handles agent name edge case: ${description}`, () => {
          const props = createTestProps({ name });

          expect(() => render(<VerboseAgentRow {...props} />)).not.toThrow();

          if (name.trim()) {
            expect(screen.getByText(name)).toBeInTheDocument();
          }
        });
      });
    });

    describe('Stage Name Edge Cases', () => {
      const stageEdgeCases = [
        { stage: undefined, shouldShow: false },
        { stage: '', shouldShow: false },
        { stage: ' ', shouldShow: true },
        { stage: 'implementation-with-very-long-stage-name', shouldShow: true },
        { stage: 'stage\nwith\nnewlines', shouldShow: true },
        { stage: '🔧 implementation 🚀', shouldShow: true },
      ];

      stageEdgeCases.forEach(({ stage, shouldShow }) => {
        it(`handles stage edge case: ${stage || 'undefined'}`, () => {
          const props = createTestProps({ stage });

          render(<VerboseAgentRow {...props} />);

          if (shouldShow && stage) {
            expect(screen.getByText(`(${stage})`)).toBeInTheDocument();
          } else {
            expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
          }
        });
      });
    });

    describe('Tool Name Edge Cases', () => {
      const toolEdgeCases = [
        { lastToolCall: '', shouldShow: false },
        { lastToolCall: ' ', shouldShow: true },
        { lastToolCall: 'Tool', shouldShow: true },
        { lastToolCall: 'VeryLongToolNameThatMightCauseLayoutIssues', shouldShow: true },
        { lastToolCall: 'Tool With Spaces', shouldShow: true },
        { lastToolCall: 'Tool\nWith\nNewlines', shouldShow: true },
        { lastToolCall: 'Tool@Version2.0', shouldShow: true },
        { lastToolCall: '🔧 SpecialTool 🎯', shouldShow: true },
        { lastToolCall: 'tool_with_underscores', shouldShow: true },
        { lastToolCall: 'tool-with-hyphens', shouldShow: true },
        { lastToolCall: 'TOOL_IN_CAPS', shouldShow: true },
      ];

      toolEdgeCases.forEach(({ lastToolCall, shouldShow }) => {
        it(`handles tool name edge case: ${lastToolCall || 'empty'}`, () => {
          const props = createTestProps({
            debugInfo: { lastToolCall },
          });

          render(<VerboseAgentRow {...props} />);

          if (shouldShow && lastToolCall.trim()) {
            expect(screen.getByText(`🔧 Last tool: ${lastToolCall}`)).toBeInTheDocument();
          } else {
            expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
          }
        });
      });
    });
  });

  describe('Date and Time Edge Cases', () => {
    it('handles invalid startedAt date', () => {
      const props = createTestProps({
        status: 'active',
        startedAt: new Date('invalid'),
      });

      expect(() => render(<VerboseAgentRow {...props} />)).not.toThrow();
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
    });

    it('handles very old startedAt date', () => {
      const props = createTestProps({
        status: 'active',
        startedAt: new Date('1970-01-01'),
      });

      render(<VerboseAgentRow {...props} />);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(expect.any(Date));
    });

    it('handles future startedAt date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const props = createTestProps({
        status: 'active',
        startedAt: futureDate,
      });

      render(<VerboseAgentRow {...props} />);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(futureDate);
    });

    it('handles null startedAt for inactive agents', () => {
      const props = createTestProps({
        status: 'completed',
        startedAt: new Date(),
      }, { isActive: false });

      render(<VerboseAgentRow {...props} />);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
    });
  });

  describe('Status Combinations', () => {
    const statusCombinations: Array<{
      status: AgentInfo['status'];
      isActive: boolean;
      shouldShowElapsed: boolean;
      shouldShowDebug: boolean;
      expectedIcon: string;
    }> = [
      { status: 'active', isActive: true, shouldShowElapsed: true, shouldShowDebug: true, expectedIcon: '⚡' },
      { status: 'active', isActive: false, shouldShowElapsed: false, shouldShowDebug: false, expectedIcon: '⚡' },
      { status: 'waiting', isActive: true, shouldShowElapsed: false, shouldShowDebug: true, expectedIcon: '○' },
      { status: 'waiting', isActive: false, shouldShowElapsed: false, shouldShowDebug: false, expectedIcon: '○' },
      { status: 'completed', isActive: true, shouldShowElapsed: false, shouldShowDebug: true, expectedIcon: '✓' },
      { status: 'completed', isActive: false, shouldShowElapsed: false, shouldShowDebug: false, expectedIcon: '✓' },
      { status: 'idle', isActive: true, shouldShowElapsed: false, shouldShowDebug: true, expectedIcon: '·' },
      { status: 'idle', isActive: false, shouldShowElapsed: false, shouldShowDebug: false, expectedIcon: '·' },
      { status: 'parallel', isActive: true, shouldShowElapsed: false, shouldShowDebug: true, expectedIcon: '⟂' },
      { status: 'parallel', isActive: false, shouldShowElapsed: false, shouldShowDebug: false, expectedIcon: '⟂' },
    ];

    statusCombinations.forEach(({ status, isActive, shouldShowElapsed, shouldShowDebug, expectedIcon }) => {
      it(`handles status combination: ${status} + isActive: ${isActive}`, () => {
        const props = createTestProps({
          status,
          startedAt: new Date(),
          debugInfo: {
            tokensUsed: { input: 1000, output: 800 },
            turnCount: 5,
            lastToolCall: 'Test',
            errorCount: 1,
          },
        }, { isActive });

        render(<VerboseAgentRow {...props} />);

        // Status icon should always be shown
        expect(screen.getByText(expectedIcon)).toBeInTheDocument();

        // Elapsed time logic
        if (shouldShowElapsed) {
          expect(screen.getByText(/\[05:30\]/)).toBeInTheDocument();
        } else {
          expect(screen.queryByText(/\[05:30\]/)).not.toBeInTheDocument();
        }

        // Debug info logic
        if (shouldShowDebug) {
          expect(screen.getByText('🔢 Tokens: 1.0k→800')).toBeInTheDocument();
          expect(screen.getByText('🔄 Turns: 5')).toBeInTheDocument();
          expect(screen.getByText('🔧 Last tool: Test')).toBeInTheDocument();
          expect(screen.getByText('❌ Errors: 1')).toBeInTheDocument();
        } else {
          expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
          expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
          expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
          expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
        }
      });
    });
  });

  describe('Complex Data Structure Edge Cases', () => {
    it('handles deeply nested undefined properties', () => {
      const props = createTestProps({
        debugInfo: {
          tokensUsed: undefined,
          turnCount: undefined,
          lastToolCall: undefined,
          errorCount: undefined,
        },
      });

      expect(() => render(<VerboseAgentRow {...props} />)).not.toThrow();
      expect(screen.queryByText(/🔢/)).not.toBeInTheDocument();
    });

    it('handles partial token object', () => {
      const props = createTestProps({
        debugInfo: {
          // @ts-expect-error Testing malformed data
          tokensUsed: { input: 1000 }, // Missing output
        },
      });

      expect(() => render(<VerboseAgentRow {...props} />)).not.toThrow();
      // Should not display incomplete token info
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
    });

    it('handles malformed debugInfo object', () => {
      const props = createTestProps({
        // @ts-expect-error Testing malformed data
        debugInfo: {
          tokensUsed: 'invalid',
          turnCount: 'not a number',
          lastToolCall: null,
          errorCount: {},
        },
      });

      expect(() => render(<VerboseAgentRow {...props} />)).not.toThrow();
      expect(screen.getByText('test-agent')).toBeInTheDocument();
    });

    it('handles completely invalid agent object', () => {
      // @ts-expect-error Testing malformed data
      const props: VerboseAgentRowProps = {
        agent: null,
        isActive: true,
        color: 'green',
      };

      expect(() => render(<VerboseAgentRow {...props} />)).toThrow();
    });
  });

  describe('Color Edge Cases', () => {
    const colorEdgeCases = [
      'red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 'white', 'gray',
      'invalid-color', '', '#ff0000', 'rgb(255,0,0)', 'transparent',
    ];

    colorEdgeCases.forEach(color => {
      it(`handles color: ${color}`, () => {
        const props = createTestProps({}, { color });

        expect(() => render(<VerboseAgentRow {...props} />)).not.toThrow();
        expect(screen.getByText('test-agent')).toBeInTheDocument();
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('handles rapid re-renders without memory leaks', () => {
      const props = createTestProps({
        debugInfo: {
          tokensUsed: { input: 1000, output: 800 },
          turnCount: 5,
        },
      });

      const { rerender } = render(<VerboseAgentRow {...props} />);

      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        rerender(<VerboseAgentRow {...{
          ...props,
          agent: {
            ...props.agent,
            debugInfo: {
              ...props.agent.debugInfo!,
              turnCount: i,
            },
          },
        }} />);
      }

      expect(screen.getByText('🔄 Turns: 99')).toBeInTheDocument();
    });

    it('handles large debug data structures efficiently', () => {
      const largeToolName = 'A'.repeat(10000);

      const props = createTestProps({
        debugInfo: {
          tokensUsed: { input: 999999999, output: 999999999 },
          turnCount: 999999,
          lastToolCall: largeToolName,
          errorCount: 999999,
        },
      });

      const startTime = performance.now();
      render(<VerboseAgentRow {...props} />);
      const endTime = performance.now();

      // Should render in reasonable time
      expect(endTime - startTime).toBeLessThan(100);

      // Should truncate or handle large strings appropriately
      expect(screen.getByText(/🔧 Last tool:/)).toBeInTheDocument();
    });
  });

  describe('Accessibility Edge Cases', () => {
    it('provides meaningful text content for screen readers', () => {
      const props = createTestProps({
        name: 'accessibility-test',
        stage: 'testing',
        debugInfo: {
          tokensUsed: { input: 1500, output: 1200 },
          turnCount: 8,
          lastToolCall: 'AccessibilityCheck',
          errorCount: 0,
        },
      });

      render(<VerboseAgentRow {...props} />);

      // All text should be accessible
      expect(screen.getByText('accessibility-test')).toBeInTheDocument();
      expect(screen.getByText(/testing/)).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 1.5k→1.2k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 8')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: AccessibilityCheck')).toBeInTheDocument();

      // Error count should not be shown when 0
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });

    it('handles special characters in accessible content', () => {
      const props = createTestProps({
        name: '🤖 AI Agent 🚀',
        stage: 'processing 📊 data',
        debugInfo: {
          lastToolCall: '🔧 Special Tool 🎯',
        },
      });

      render(<VerboseAgentRow {...props} />);

      expect(screen.getByText('🤖 AI Agent 🚀')).toBeInTheDocument();
      expect(screen.getByText(/processing 📊 data/)).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: 🔧 Special Tool 🎯')).toBeInTheDocument();
    });
  });
});