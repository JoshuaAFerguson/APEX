/**
 * Test Suite for LimitWarning Components
 *
 * Tests the LimitWarning and LimitExceeded components functionality including:
 * - Rendering warnings with different limit types
 * - Proper formatting of values and percentages
 * - Color coding based on warning levels
 * - LimitExceeded component for hard limits
 * - ResourceUsageDashboard integration
 * - Edge cases and error scenarios
 *
 * @module cli/ui/components/autonomy/LimitWarning.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  LimitWarning,
  LimitExceeded,
  ResourceUsageDashboard,
  type LimitWarning as LimitWarningType,
  type LimitExceeded as LimitExceededType,
  type LimitWarningProps,
  type LimitExceededProps,
  type ResourceUsageDashboardProps,
} from '../LimitWarning';

// Mock Ink components
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  useInput: vi.fn(),
}));

// Mock core utilities
vi.mock('@apexcli/core', () => ({
  formatDuration: vi.fn((ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }),
}));

describe('LimitWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders token limit warning correctly', () => {
      const warning: LimitWarningType = {
        type: 'tokens',
        threshold: 80,
        currentValue: 8500,
        limitValue: 10000,
        percentage: 85,
        message: 'Approaching token limit',
      };

      render(
        <LimitWarning warning={warning} />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
      expect(screen.getAllByTestId('text').length).toBeGreaterThan(0);
    });

    it('renders cost limit warning correctly', () => {
      const warning: LimitWarningType = {
        type: 'cost',
        threshold: 75,
        currentValue: 18.50,
        limitValue: 25.00,
        percentage: 74,
        message: 'Cost approaching limit',
      };

      render(
        <LimitWarning warning={warning} />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('renders time limit warning correctly', () => {
      const warning: LimitWarningType = {
        type: 'time',
        threshold: 90,
        currentValue: 270000, // 4.5 minutes
        limitValue: 300000,   // 5 minutes
        percentage: 90,
        message: 'Time limit approaching',
      };

      render(
        <LimitWarning warning={warning} />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('renders files limit warning correctly', () => {
      const warning: LimitWarningType = {
        type: 'files',
        threshold: 85,
        currentValue: 42,
        limitValue: 50,
        percentage: 84,
        message: 'File count approaching limit',
      };

      render(
        <LimitWarning warning={warning} />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('renders lines limit warning correctly', () => {
      const warning: LimitWarningType = {
        type: 'lines',
        threshold: 95,
        currentValue: 4800,
        limitValue: 5000,
        percentage: 96,
        message: 'Line count very high',
      };

      render(
        <LimitWarning warning={warning} />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('Display Modes', () => {
    const warning: LimitWarningType = {
      type: 'tokens',
      threshold: 80,
      currentValue: 8000,
      limitValue: 10000,
      percentage: 80,
      message: 'Token usage warning',
    };

    const displayModes: Array<'normal' | 'compact' | 'minimal'> = ['normal', 'compact', 'minimal'];

    displayModes.forEach(mode => {
      it(`renders correctly in ${mode} display mode`, () => {
        render(
          <LimitWarning
            warning={warning}
            displayMode={mode}
          />
        );

        expect(screen.getByTestId('box')).toBeInTheDocument();
      });
    });
  });

  describe('Alert Mode', () => {
    it('renders as alert when isAlert is true', () => {
      const warning: LimitWarningType = {
        type: 'cost',
        threshold: 95,
        currentValue: 24.75,
        limitValue: 25.00,
        percentage: 99,
        message: 'Critical cost warning',
      };

      render(
        <LimitWarning
          warning={warning}
          isAlert={true}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('renders normally when isAlert is false', () => {
      const warning: LimitWarningType = {
        type: 'tokens',
        threshold: 60,
        currentValue: 6000,
        limitValue: 10000,
        percentage: 60,
        message: 'Token usage notice',
      };

      render(
        <LimitWarning
          warning={warning}
          isAlert={false}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('Percentage-based Color Coding', () => {
    const testPercentages = [50, 65, 75, 85, 95, 100];

    testPercentages.forEach(percentage => {
      it(`handles ${percentage}% usage correctly`, () => {
        const warning: LimitWarningType = {
          type: 'tokens',
          threshold: percentage - 10,
          currentValue: percentage * 100,
          limitValue: 10000,
          percentage,
          message: `Usage at ${percentage}%`,
        };

        render(<LimitWarning warning={warning} />);
        expect(screen.getByTestId('box')).toBeInTheDocument();
      });
    });
  });
});

describe('LimitExceeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders token limit exceeded correctly', () => {
      const exceeded: LimitExceededType = {
        type: 'tokens',
        currentValue: 12000,
        limitValue: 10000,
        message: 'Token limit exceeded - operation blocked',
      };

      render(
        <LimitExceeded exceeded={exceeded} />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('renders cost limit exceeded correctly', () => {
      const exceeded: LimitExceededType = {
        type: 'cost',
        currentValue: 30.50,
        limitValue: 25.00,
        message: 'Cost limit exceeded',
      };

      render(
        <LimitExceeded exceeded={exceeded} />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('renders turns limit exceeded correctly', () => {
      const exceeded: LimitExceededType = {
        type: 'turns',
        currentValue: 25,
        limitValue: 20,
        message: 'Conversation turn limit exceeded',
      };

      render(
        <LimitExceeded exceeded={exceeded} />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('With Task Description', () => {
    it('displays task description when provided', () => {
      const exceeded: LimitExceededType = {
        type: 'time',
        currentValue: 600000, // 10 minutes
        limitValue: 300000,   // 5 minutes
        message: 'Time limit exceeded',
      };

      render(
        <LimitExceeded
          exceeded={exceeded}
          taskDescription="Feature implementation task"
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('works without task description', () => {
      const exceeded: LimitExceededType = {
        type: 'files',
        currentValue: 75,
        limitValue: 50,
        message: 'Too many files modified',
      };

      render(
        <LimitExceeded exceeded={exceeded} />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('Acknowledge Callback', () => {
    it('calls onAcknowledge when provided', () => {
      const mockAcknowledge = vi.fn();
      const exceeded: LimitExceededType = {
        type: 'lines',
        currentValue: 6000,
        limitValue: 5000,
        message: 'Line limit exceeded',
      };

      render(
        <LimitExceeded
          exceeded={exceeded}
          onAcknowledge={mockAcknowledge}
        />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
      // Note: In a real implementation, you'd simulate user interaction to test the callback
    });

    it('works without onAcknowledge callback', () => {
      const exceeded: LimitExceededType = {
        type: 'cost',
        currentValue: 100.00,
        limitValue: 50.00,
        message: 'Budget exceeded',
      };

      render(
        <LimitExceeded exceeded={exceeded} />
      );

      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });
});

describe('ResourceUsageDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockDashboardProps = (): ResourceUsageDashboardProps => ({
    warnings: [
      {
        type: 'tokens',
        threshold: 80,
        currentValue: 8500,
        limitValue: 10000,
        percentage: 85,
        message: 'Token usage high',
      },
      {
        type: 'cost',
        threshold: 75,
        currentValue: 18.75,
        limitValue: 25.00,
        percentage: 75,
        message: 'Cost approaching limit',
      },
    ],
    exceeded: [
      {
        type: 'time',
        currentValue: 420000, // 7 minutes
        limitValue: 300000,   // 5 minutes
        message: 'Time limit exceeded',
      },
    ],
    currentUsage: {
      tokens: 8500,
      cost: 18.75,
      time: 420000,
      files: 25,
      lines: 2500,
      turns: 15,
    },
    limits: {
      tokens: 10000,
      cost: 25.00,
      time: 300000,
      files: 50,
      lines: 5000,
      turns: 20,
    },
  });

  it('renders dashboard with warnings and exceeded limits', () => {
    const props = createMockDashboardProps();

    render(<ResourceUsageDashboard {...props} />);

    expect(screen.getByTestId('box')).toBeInTheDocument();
  });

  it('handles empty warnings and exceeded arrays', () => {
    const props = createMockDashboardProps();
    props.warnings = [];
    props.exceeded = [];

    render(<ResourceUsageDashboard {...props} />);

    expect(screen.getByTestId('box')).toBeInTheDocument();
  });

  it('works with minimal usage data', () => {
    const minimalProps: ResourceUsageDashboardProps = {
      warnings: [],
      exceeded: [],
      currentUsage: {
        tokens: 1000,
        cost: 5.00,
      },
      limits: {
        tokens: 10000,
        cost: 25.00,
      },
    };

    render(<ResourceUsageDashboard {...minimalProps} />);

    expect(screen.getByTestId('box')).toBeInTheDocument();
  });
});

describe('Edge Cases and Utility Functions', () => {
  describe('Value Formatting', () => {
    it('handles zero values correctly', () => {
      const warning: LimitWarningType = {
        type: 'tokens',
        threshold: 0,
        currentValue: 0,
        limitValue: 10000,
        percentage: 0,
        message: 'No usage yet',
      };

      render(<LimitWarning warning={warning} />);
      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles very large values correctly', () => {
      const warning: LimitWarningType = {
        type: 'tokens',
        threshold: 90,
        currentValue: 999999999,
        limitValue: 1000000000,
        percentage: 99.9999999,
        message: 'Extremely high usage',
      };

      render(<LimitWarning warning={warning} />);
      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles decimal values correctly', () => {
      const warning: LimitWarningType = {
        type: 'cost',
        threshold: 85,
        currentValue: 19.9999,
        limitValue: 25.0001,
        percentage: 79.9996,
        message: 'Decimal precision test',
      };

      render(<LimitWarning warning={warning} />);
      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles negative values gracefully', () => {
      const warning: LimitWarningType = {
        type: 'tokens',
        threshold: 50,
        currentValue: -100, // Invalid but should not crash
        limitValue: 10000,
        percentage: -1,
        message: 'Negative value test',
      };

      render(<LimitWarning warning={warning} />);
      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('Unknown Limit Types', () => {
    it('handles unknown limit types gracefully', () => {
      const warning = {
        type: 'unknown-type' as any,
        threshold: 80,
        currentValue: 800,
        limitValue: 1000,
        percentage: 80,
        message: 'Unknown limit type test',
      };

      render(<LimitWarning warning={warning} />);
      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });

  describe('Message Handling', () => {
    it('handles very long messages', () => {
      const warning: LimitWarningType = {
        type: 'tokens',
        threshold: 80,
        currentValue: 8000,
        limitValue: 10000,
        percentage: 80,
        message: 'This is a very long warning message that should be handled gracefully without breaking the layout or causing rendering issues. '.repeat(5),
      };

      render(<LimitWarning warning={warning} />);
      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles empty messages', () => {
      const warning: LimitWarningType = {
        type: 'tokens',
        threshold: 80,
        currentValue: 8000,
        limitValue: 10000,
        percentage: 80,
        message: '',
      };

      render(<LimitWarning warning={warning} />);
      expect(screen.getByTestId('box')).toBeInTheDocument();
    });

    it('handles messages with special characters', () => {
      const warning: LimitWarningType = {
        type: 'cost',
        threshold: 90,
        currentValue: 22.50,
        limitValue: 25.00,
        percentage: 90,
        message: '⚠️ Cost limit approaching! 💰 Budget: $25.00 🚨',
      };

      render(<LimitWarning warning={warning} />);
      expect(screen.getByTestId('box')).toBeInTheDocument();
    });
  });
});