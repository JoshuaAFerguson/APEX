import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorDisplay, ErrorSummary, ValidationError } from '../ErrorDisplay';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('ErrorDisplay Components - Enhanced Responsive Width Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ErrorDisplay Responsive Behavior', () => {
    const longError = 'This is an extremely long error message that should be truncated based on the terminal width to ensure proper display across different screen sizes and terminal configurations';
    const complexContext = {
      longKey: 'This is a very long context value that should be truncated in narrow terminals',
      shortKey: 'short',
      nestedConfig: { feature: 'enabled', timeout: 5000 },
    };

    describe('Wide terminal (120+ chars)', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 40,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
          isAvailable: true,
        });
      });

      it('should display long messages with minimal truncation', () => {
        render(<ErrorDisplay error={longError} />);

        expect(screen.getByText(/This is an extremely long error message that should be truncated/)).toBeInTheDocument();
      });

      it('should display full context values', () => {
        render(<ErrorDisplay error="Test error" context={complexContext} />);

        expect(screen.getByText(/longKey: This is a very long context value/)).toBeInTheDocument();
        expect(screen.getByText('shortKey: short')).toBeInTheDocument();
      });

      it('should show full suggestion descriptions', () => {
        const suggestions = [{
          title: 'Long Suggestion',
          description: 'This is a very long suggestion description that provides detailed guidance on how to resolve the error',
          priority: 'high' as const,
        }];

        render(<ErrorDisplay error="Test error" suggestions={suggestions} showSuggestions={true} />);

        expect(screen.getByText(/This is a very long suggestion description that provides detailed guidance/)).toBeInTheDocument();
      });
    });

    describe('Normal terminal (80 chars)', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 24,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });
      });

      it('should truncate messages appropriately', () => {
        render(<ErrorDisplay error={longError} />);

        const messageElements = screen.getAllByText(/This is an extremely long error message/);
        expect(messageElements.some(el => el.textContent?.includes('...'))).toBe(true);
      });

      it('should truncate long context values', () => {
        render(<ErrorDisplay error="Test error" context={complexContext} />);

        const contextElements = screen.getAllByText(/longKey:/);
        expect(contextElements.some(el => el.textContent?.includes('...'))).toBe(true);
      });

      it('should truncate suggestion descriptions', () => {
        const suggestions = [{
          title: 'Long Suggestion',
          description: 'This is a very long suggestion description that should be truncated to fit within the available space',
          priority: 'medium' as const,
        }];

        render(<ErrorDisplay error="Test error" suggestions={suggestions} showSuggestions={true} />);

        const suggestionElements = screen.getAllByText(/This is a very long suggestion description/);
        expect(suggestionElements.some(el => el.textContent?.includes('...'))).toBe(true);
      });
    });

    describe('Narrow terminal (45 chars)', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 45,
          height: 20,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });
      });

      it('should aggressively truncate messages', () => {
        render(<ErrorDisplay error={longError} />);

        const messageElements = screen.getAllByText(/This is an extremely/);
        expect(messageElements.some(el => el.textContent?.includes('...'))).toBe(true);
      });

      it('should severely truncate context values', () => {
        render(<ErrorDisplay error="Test error" context={complexContext} />);

        const contextElements = screen.getAllByText(/longKey:/);
        expect(contextElements.some(el => {
          const truncatedLength = el.textContent?.split('...')[0].length || 0;
          return truncatedLength < 30; // Should be heavily truncated
        })).toBe(true);
      });

      it('should handle explicit width override', () => {
        render(<ErrorDisplay error={longError} width={60} />);

        // Should use explicit width (60) instead of terminal width (45)
        expect(mockUseStdoutDimensions).toHaveBeenCalled();
      });
    });
  });

  describe('ErrorSummary Responsive Behavior', () => {
    const mockErrors = [
      {
        id: '1',
        message: 'This is a very long error message that should be truncated based on terminal width for proper display',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        severity: 'error' as const,
        resolved: false,
      },
      {
        id: '2',
        message: 'Short error',
        timestamp: new Date('2023-01-01T10:05:30.123Z'),
        severity: 'warning' as const,
        resolved: true,
      },
    ];

    describe('Wide terminal behavior', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 40,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
          isAvailable: true,
        });
      });

      it('should display full timestamps', () => {
        render(<ErrorSummary errors={mockErrors} showTimestamps={true} />);

        expect(screen.getByText(/\[.*10:00:00.*\]/)).toBeInTheDocument();
        expect(screen.getByText(/\[.*10:05:30.*\]/)).toBeInTheDocument();
      });

      it('should not truncate error messages', () => {
        render(<ErrorSummary errors={mockErrors} />);

        expect(screen.getByText(/This is a very long error message that should be truncated/)).toBeInTheDocument();
      });
    });

    describe('Narrow terminal behavior', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 45,
          height: 20,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });
      });

      it('should abbreviate timestamps to HH:MM format', () => {
        render(<ErrorSummary errors={mockErrors} showTimestamps={true} />);

        expect(screen.getByText('[10:00]')).toBeInTheDocument();
        expect(screen.getByText('[10:05]')).toBeInTheDocument();
      });

      it('should aggressively truncate long error messages', () => {
        render(<ErrorSummary errors={mockErrors} />);

        const messageElements = screen.getAllByText(/This is a very long/);
        expect(messageElements.some(el => el.textContent?.includes('...'))).toBe(true);
      });

      it('should handle explicit width override', () => {
        render(<ErrorSummary errors={mockErrors} width={80} showTimestamps={true} />);

        // With explicit width of 80, should show full timestamps
        expect(screen.getByText(/\[.*10:00:00.*\]/)).toBeInTheDocument();
      });
    });
  });

  describe('ValidationError Responsive Behavior', () => {
    const longValue = 'This is a very long field value that should be truncated appropriately based on terminal width';
    const longErrors = [
      'This is a very long error message that should be truncated based on terminal width for proper display',
      'Another long validation error that also needs truncation for narrow terminals',
    ];
    const longSuggestions = [
      'This is a very long suggestion that should also be truncated appropriately for narrow displays',
      'Another suggestion with lots of helpful details that need to be truncated in compact modes',
    ];

    describe('Wide terminal behavior', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 120,
          height: 40,
          breakpoint: 'wide',
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
          isAvailable: true,
        });
      });

      it('should display full field values', () => {
        render(
          <ValidationError
            field="username"
            value={longValue}
            errors={['Invalid']}
          />
        );

        expect(screen.getByText(/"This is a very long field value that should be truncated appropriately/)).toBeInTheDocument();
      });

      it('should display full error and suggestion messages', () => {
        render(
          <ValidationError
            field="password"
            value="test"
            errors={longErrors}
            suggestions={longSuggestions}
          />
        );

        expect(screen.getByText(/This is a very long error message that should be truncated/)).toBeInTheDocument();
        expect(screen.getByText(/This is a very long suggestion that should also be truncated/)).toBeInTheDocument();
      });
    });

    describe('Normal terminal behavior', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 24,
          breakpoint: 'normal',
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          isAvailable: true,
        });
      });

      it('should truncate long field values', () => {
        render(
          <ValidationError
            field="username"
            value={longValue}
            errors={['Invalid']}
          />
        );

        const valueElements = screen.getAllByText(/"This is a very long field value/);
        expect(valueElements.some(el => el.textContent?.includes('...'))).toBe(true);
      });

      it('should truncate long error messages', () => {
        render(
          <ValidationError
            field="email"
            value="test@example.com"
            errors={longErrors}
          />
        );

        const errorElements = screen.getAllByText(/This is a very long error message/);
        expect(errorElements.some(el => el.textContent?.includes('...'))).toBe(true);
      });
    });

    describe('Narrow terminal behavior', () => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 45,
          height: 20,
          breakpoint: 'narrow',
          isNarrow: true,
          isCompact: false,
          isNormal: false,
          isWide: false,
          isAvailable: true,
        });
      });

      it('should severely truncate field values (20 chars vs 40)', () => {
        render(
          <ValidationError
            field="username"
            value={longValue}
            errors={['Invalid']}
          />
        );

        const valueElements = screen.getAllByText(/"This is a very/);
        expect(valueElements.some(el => {
          const beforeEllipsis = el.textContent?.split('...')[0] || '';
          return beforeEllipsis.length < 25; // Should be heavily truncated
        })).toBe(true);
      });

      it('should aggressively truncate error and suggestion messages', () => {
        render(
          <ValidationError
            field="password"
            value="test"
            errors={longErrors}
            suggestions={longSuggestions}
          />
        );

        const errorElements = screen.getAllByText(/This is a very long/);
        expect(errorElements.some(el => {
          const truncatedLength = el.textContent?.split('...')[0].length || 0;
          return truncatedLength < 30; // Should be heavily truncated
        })).toBe(true);
      });

      it('should handle explicit width override', () => {
        render(
          <ValidationError
            field="username"
            value={longValue}
            errors={longErrors}
            width={80}
          />
        );

        // Should use explicit width (80) instead of terminal width (45)
        expect(mockUseStdoutDimensions).toHaveBeenCalled();
      });
    });
  });

  describe('Cross-component responsive consistency', () => {
    const testData = {
      error: 'This is a long error message that should be consistently truncated across components',
      context: { longField: 'This is a long context value for consistency testing' },
      suggestions: [{
        title: 'Test Suggestion',
        description: 'This is a long suggestion description for consistency testing',
        priority: 'medium' as const,
      }],
    };

    it('should apply consistent truncation rules across all components', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 20,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <>
          <ErrorDisplay
            error={testData.error}
            context={testData.context}
            suggestions={testData.suggestions}
          />
          <ValidationError
            field="test"
            value={testData.error}
            errors={[testData.error]}
            suggestions={[testData.suggestions[0].description]}
          />
        </>
      );

      // All long messages should be truncated consistently
      const truncatedElements = screen.getAllByText(/This is a long/);
      expect(truncatedElements.length).toBeGreaterThan(0);
      expect(truncatedElements.some(el => el.textContent?.includes('...'))).toBe(true);
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle rapid width changes efficiently', () => {
      const widths = [120, 80, 45, 35, 80, 120];

      widths.forEach((width, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 24,
          breakpoint: width >= 80 ? 'normal' : width >= 60 ? 'compact' : 'narrow',
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 80,
          isNormal: width >= 80 && width < 120,
          isWide: width >= 120,
          isAvailable: true,
        });

        const { rerender } = render(
          <ErrorDisplay
            error="Test error message"
            key={index}
          />
        );

        expect(screen.getByText('Test error message')).toBeInTheDocument();

        rerender(<></>);
      });
    });

    it('should handle extremely long single words', () => {
      const veryLongWord = 'a'.repeat(100);

      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 20,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const { container } = render(
        <ErrorDisplay error={veryLongWord} />
      );

      expect(container).toBeInTheDocument();
    });

    it('should handle empty or minimal content gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 20,
        height: 10,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const { container } = render(
        <>
          <ErrorDisplay error="" />
          <ErrorSummary errors={[]} />
          <ValidationError field="test" value="" errors={[]} />
        </>
      );

      expect(container).toBeInTheDocument();
    });
  });
});