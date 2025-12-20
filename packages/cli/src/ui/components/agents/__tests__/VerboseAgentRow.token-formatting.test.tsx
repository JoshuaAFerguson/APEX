import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { VerboseAgentRow, type VerboseAgentRowProps } from '../VerboseAgentRow';
import type { AgentInfo } from '../AgentPanel';

/**
 * Comprehensive tests for token formatting functionality in VerboseAgentRow
 * Tests the formatTokens utility function through component integration
 */
describe('VerboseAgentRow - Token Formatting', () => {
  // Mock the useElapsedTime hook
  const mockUseElapsedTime = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));
    mockUseElapsedTime.mockReturnValue('02:30');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useElapsedTime.js');
  });

  const createAgentWithTokens = (input: number, output: number): AgentInfo => ({
    name: 'test-agent',
    status: 'active',
    debugInfo: {
      tokensUsed: { input, output },
    },
  });

  const renderAgentWithTokens = (input: number, output: number) => {
    const agent = createAgentWithTokens(input, output);
    const props: VerboseAgentRowProps = {
      agent,
      isActive: true,
      color: 'green',
    };

    return render(<VerboseAgentRow {...props} />);
  };

  describe('basic token formatting', () => {
    it('formats small numbers without suffix', () => {
      renderAgentWithTokens(500, 300);
      expect(screen.getByText('🔢 Tokens: 500→300')).toBeInTheDocument();
    });

    it('formats exactly 1000 tokens as 1.0k', () => {
      renderAgentWithTokens(1000, 1000);
      expect(screen.getByText('🔢 Tokens: 1.0k→1.0k')).toBeInTheDocument();
    });

    it('formats numbers just under 1000 without suffix', () => {
      renderAgentWithTokens(999, 999);
      expect(screen.getByText('🔢 Tokens: 999→999')).toBeInTheDocument();
    });

    it('formats numbers just over 1000 with k suffix', () => {
      renderAgentWithTokens(1001, 1001);
      expect(screen.getByText('🔢 Tokens: 1.0k→1.0k')).toBeInTheDocument();
    });
  });

  describe('thousands formatting (k suffix)', () => {
    const thousandsTests = [
      { input: 1500, output: 2500, expected: '1.5k→2.5k' },
      { input: 1100, output: 1200, expected: '1.1k→1.2k' },
      { input: 10000, output: 15000, expected: '10.0k→15.0k' },
      { input: 12345, output: 67890, expected: '12.3k→67.9k' },
      { input: 99900, output: 99950, expected: '99.9k→99.9k' },
      { input: 123456, output: 654321, expected: '123.4k→654.3k' },
      { input: 999999, output: 999000, expected: '999.9k→999.0k' },
    ];

    thousandsTests.forEach(({ input, output, expected }) => {
      it(`formats ${input}→${output} as ${expected}`, () => {
        renderAgentWithTokens(input, output);
        expect(screen.getByText(`🔢 Tokens: ${expected}`)).toBeInTheDocument();
      });
    });
  });

  describe('millions formatting (M suffix)', () => {
    const millionsTests = [
      { input: 1000000, output: 2000000, expected: '1.0M→2.0M' },
      { input: 1500000, output: 2500000, expected: '1.5M→2.5M' },
      { input: 1234567, output: 2345678, expected: '1.2M→2.3M' },
      { input: 10000000, output: 15000000, expected: '10.0M→15.0M' },
      { input: 123456789, output: 987654321, expected: '123.4M→987.6M' },
      { input: 999999999, output: 1000000000, expected: '999.9M→1000.0M' },
    ];

    millionsTests.forEach(({ input, output, expected }) => {
      it(`formats ${input}→${output} as ${expected}`, () => {
        renderAgentWithTokens(input, output);
        expect(screen.getByText(`🔢 Tokens: ${expected}`)).toBeInTheDocument();
      });
    });
  });

  describe('edge cases and boundaries', () => {
    it('handles zero tokens', () => {
      renderAgentWithTokens(0, 0);
      expect(screen.getByText('🔢 Tokens: 0→0')).toBeInTheDocument();
    });

    it('handles single digit tokens', () => {
      renderAgentWithTokens(1, 9);
      expect(screen.getByText('🔢 Tokens: 1→9')).toBeInTheDocument();
    });

    it('handles exactly one million tokens', () => {
      renderAgentWithTokens(1000000, 1000000);
      expect(screen.getByText('🔢 Tokens: 1.0M→1.0M')).toBeInTheDocument();
    });

    it('handles just under one million tokens', () => {
      renderAgentWithTokens(999999, 999999);
      expect(screen.getByText('🔢 Tokens: 999.9k→999.9k')).toBeInTheDocument();
    });

    it('handles very large numbers', () => {
      renderAgentWithTokens(999999999999, 1000000000000);
      expect(screen.getByText('🔢 Tokens: 999999.9M→1000000.0M')).toBeInTheDocument();
    });
  });

  describe('asymmetric token patterns', () => {
    it('handles high input, low output', () => {
      renderAgentWithTokens(50000, 100);
      expect(screen.getByText('🔢 Tokens: 50.0k→100')).toBeInTheDocument();
    });

    it('handles low input, high output', () => {
      renderAgentWithTokens(100, 50000);
      expect(screen.getByText('🔢 Tokens: 100→50.0k')).toBeInTheDocument();
    });

    it('handles mixed units (k and M)', () => {
      renderAgentWithTokens(500000, 2000000);
      expect(screen.getByText('🔢 Tokens: 500.0k→2.0M')).toBeInTheDocument();
    });

    it('handles reversed mixed units (M and k)', () => {
      renderAgentWithTokens(2000000, 500000);
      expect(screen.getByText('🔢 Tokens: 2.0M→500.0k')).toBeInTheDocument();
    });
  });

  describe('precision and rounding', () => {
    it('rounds to one decimal place for thousands', () => {
      renderAgentWithTokens(1234, 5678);
      expect(screen.getByText('🔢 Tokens: 1.2k→5.7k')).toBeInTheDocument();
    });

    it('rounds to one decimal place for millions', () => {
      renderAgentWithTokens(1234567, 5678901);
      expect(screen.getByText('🔢 Tokens: 1.2M→5.7M')).toBeInTheDocument();
    });

    it('handles numbers that round up to next unit', () => {
      renderAgentWithTokens(999500, 999500);
      expect(screen.getByText('🔢 Tokens: 999.5k→999.5k')).toBeInTheDocument();
    });

    it('handles rounding at million boundary', () => {
      renderAgentWithTokens(999950, 999950);
      expect(screen.getByText('🔢 Tokens: 999.9k→999.9k')).toBeInTheDocument();
    });
  });

  describe('formatting consistency across different scenarios', () => {
    it('maintains consistent formatting in mixed agent scenarios', () => {
      const multipleAgents: AgentInfo[] = [
        createAgentWithTokens(1500, 2500),    // 1.5k→2.5k
        createAgentWithTokens(1000000, 500000), // 1.0M→500.0k
        createAgentWithTokens(999, 1001),     // 999→1.0k
      ];

      multipleAgents.forEach((agent, index) => {
        const props: VerboseAgentRowProps = {
          agent: { ...agent, name: `agent-${index}` },
          isActive: true,
          color: 'green',
        };

        const { unmount } = render(<VerboseAgentRow {...props} />);

        if (index === 0) {
          expect(screen.getByText('🔢 Tokens: 1.5k→2.5k')).toBeInTheDocument();
        } else if (index === 1) {
          expect(screen.getByText('🔢 Tokens: 1.0M→500.0k')).toBeInTheDocument();
        } else if (index === 2) {
          expect(screen.getByText('🔢 Tokens: 999→1.0k')).toBeInTheDocument();
        }

        unmount();
      });
    });

    it('handles rapid token count changes', () => {
      const tokenProgression = [
        { input: 0, output: 0 },
        { input: 500, output: 300 },
        { input: 1500, output: 1200 },
        { input: 15000, output: 12000 },
        { input: 150000, output: 120000 },
        { input: 1500000, output: 1200000 },
      ];

      const expectedFormats = [
        '0→0',
        '500→300',
        '1.5k→1.2k',
        '15.0k→12.0k',
        '150.0k→120.0k',
        '1.5M→1.2M',
      ];

      tokenProgression.forEach(({ input, output }, index) => {
        const agent = createAgentWithTokens(input, output);
        const props: VerboseAgentRowProps = {
          agent,
          isActive: true,
          color: 'green',
        };

        const { unmount } = render(<VerboseAgentRow {...props} />);

        expect(screen.getByText(`🔢 Tokens: ${expectedFormats[index]}`)).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('special number scenarios', () => {
    it('handles very large asymmetric differences', () => {
      renderAgentWithTokens(1, 1000000);
      expect(screen.getByText('🔢 Tokens: 1→1.0M')).toBeInTheDocument();
    });

    it('handles maximum JavaScript integer values', () => {
      const maxSafeInteger = Number.MAX_SAFE_INTEGER;
      const halfMax = Math.floor(maxSafeInteger / 2);

      renderAgentWithTokens(halfMax, maxSafeInteger);

      // Should handle very large numbers without crashing
      expect(screen.getByText(/🔢 Tokens:/)).toBeInTheDocument();
    });

    it('handles numbers with many decimal places after conversion', () => {
      renderAgentWithTokens(1111, 2222);
      expect(screen.getByText('🔢 Tokens: 1.1k→2.2k')).toBeInTheDocument();
    });

    it('handles numbers that would round to .0', () => {
      renderAgentWithTokens(1000, 2000);
      expect(screen.getByText('🔢 Tokens: 1.0k→2.0k')).toBeInTheDocument();
    });
  });

  describe('integration with other debug fields', () => {
    it('formats tokens correctly alongside other debug info', () => {
      const fullDebugAgent: AgentInfo = {
        name: 'test-agent',
        status: 'active',
        debugInfo: {
          tokensUsed: { input: 12500, output: 8750 },
          turnCount: 15,
          lastToolCall: 'ComplexEdit',
          errorCount: 2,
        },
      };

      const props: VerboseAgentRowProps = {
        agent: fullDebugAgent,
        isActive: true,
        color: 'green',
      };

      render(<VerboseAgentRow {...props} />);

      // Token formatting should work correctly with other fields
      expect(screen.getByText('🔢 Tokens: 12.5k→8.8k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 15')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: ComplexEdit')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 2')).toBeInTheDocument();
    });

    it('maintains formatting when only token info is present', () => {
      const tokenOnlyAgent: AgentInfo = {
        name: 'test-agent',
        status: 'active',
        debugInfo: {
          tokensUsed: { input: 3500, output: 2100 },
          // No other debug fields
        },
      };

      const props: VerboseAgentRowProps = {
        agent: tokenOnlyAgent,
        isActive: true,
        color: 'green',
      };

      render(<VerboseAgentRow {...props} />);

      expect(screen.getByText('🔢 Tokens: 3.5k→2.1k')).toBeInTheDocument();
      expect(screen.queryByText(/🔄 Turns:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🔧 Last tool:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/❌ Errors:/)).not.toBeInTheDocument();
    });
  });

  describe('error handling in token formatting', () => {
    it('handles missing output tokens', () => {
      const partialTokenAgent: AgentInfo = {
        name: 'test-agent',
        status: 'active',
        debugInfo: {
          // @ts-expect-error Testing missing output
          tokensUsed: { input: 1500 },
        },
      };

      const props: VerboseAgentRowProps = {
        agent: partialTokenAgent,
        isActive: true,
        color: 'green',
      };

      render(<VerboseAgentRow {...props} />);

      // Should not display token info when data is incomplete
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
    });

    it('handles missing input tokens', () => {
      const partialTokenAgent: AgentInfo = {
        name: 'test-agent',
        status: 'active',
        debugInfo: {
          // @ts-expect-error Testing missing input
          tokensUsed: { output: 2500 },
        },
      };

      const props: VerboseAgentRowProps = {
        agent: partialTokenAgent,
        isActive: true,
        color: 'green',
      };

      render(<VerboseAgentRow {...props} />);

      // Should not display token info when data is incomplete
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
    });

    it('handles null token values', () => {
      const nullTokenAgent: AgentInfo = {
        name: 'test-agent',
        status: 'active',
        debugInfo: {
          // @ts-expect-error Testing null values
          tokensUsed: { input: null, output: null },
        },
      };

      const props: VerboseAgentRowProps = {
        agent: nullTokenAgent,
        isActive: true,
        color: 'green',
      };

      render(<VerboseAgentRow {...props} />);

      // Should not crash with null values
      expect(screen.queryByText(/🔢 Tokens:/)).not.toBeInTheDocument();
    });
  });
});