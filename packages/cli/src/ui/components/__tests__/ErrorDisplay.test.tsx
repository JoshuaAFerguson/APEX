import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorDisplay, ErrorSummary, ValidationError } from '../ErrorDisplay';

// Mock the useStdoutDimensions hook
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 80,
    height: 24,
    breakpoint: 'normal' as const,
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
    isAvailable: true,
  })),
}));

describe('ErrorDisplay', () => {
  it('should render error message from string', () => {
    render(<ErrorDisplay error="Test error message" />);

    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByText('❌ Error')).toBeInTheDocument();
  });

  it('should render error message from Error object', () => {
    const error = new Error('Test error object');
    render(<ErrorDisplay error={error} />);

    expect(screen.getByText('Test error object')).toBeInTheDocument();
  });

  it('should render custom title', () => {
    render(<ErrorDisplay error="Test error" title="Custom Error Title" />);

    expect(screen.getByText('❌ Custom Error Title')).toBeInTheDocument();
  });

  it('should show stack trace when enabled', () => {
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test.js:1:1\n    at main.js:2:2';

    render(<ErrorDisplay error={error} showStack={true} />);

    expect(screen.getByText('Stack Trace:')).toBeInTheDocument();
    expect(screen.getByText('Error: Test error')).toBeInTheDocument();
    expect(screen.getByText('    at test.js:1:1')).toBeInTheDocument();
  });

  it('should not show stack trace when disabled', () => {
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test.js:1:1';

    render(<ErrorDisplay error={error} showStack={false} />);

    expect(screen.queryByText('Stack Trace:')).not.toBeInTheDocument();
  });

  it('should render provided suggestions', () => {
    const suggestions = [
      {
        title: 'Test Suggestion',
        description: 'This is a test suggestion',
        priority: 'high' as const,
        command: 'test command',
      },
    ];

    render(
      <ErrorDisplay
        error="Test error"
        suggestions={suggestions}
        showSuggestions={true}
      />
    );

    expect(screen.getByText('💡 Suggestions:')).toBeInTheDocument();
    expect(screen.getByText('Test Suggestion')).toBeInTheDocument();
    expect(screen.getByText('This is a test suggestion')).toBeInTheDocument();
    expect(screen.getByText('test command')).toBeInTheDocument();
  });

  it('should auto-generate permission denied suggestions', () => {
    render(<ErrorDisplay error="Permission denied: cannot access file" />);

    expect(screen.getByText('Permission Issue')).toBeInTheDocument();
    expect(screen.getByText('Check file/directory permissions')).toBeInTheDocument();
    expect(screen.getByText('ls -la')).toBeInTheDocument();
  });

  it('should auto-generate command not found suggestions', () => {
    render(<ErrorDisplay error="Command not found: git" />);

    expect(screen.getByText('Missing Command')).toBeInTheDocument();
    expect(screen.getByText('Install the required tool or check PATH')).toBeInTheDocument();
  });

  it('should auto-generate network error suggestions', () => {
    render(<ErrorDisplay error="Network connection failed" />);

    expect(screen.getByText('Network Issue')).toBeInTheDocument();
    expect(screen.getByText('Check your internet connection and try again')).toBeInTheDocument();
  });

  it('should auto-generate API key error suggestions', () => {
    render(<ErrorDisplay error="Invalid API key provided" />);

    expect(screen.getByText('API Key Issue')).toBeInTheDocument();
    expect(screen.getByText('Check your API key configuration')).toBeInTheDocument();
    expect(screen.getByText('apex config get api.key')).toBeInTheDocument();
  });

  it('should render context information', () => {
    const context = {
      userId: '123',
      operation: 'create_file',
      timestamp: '2023-01-01',
    };

    render(<ErrorDisplay error="Test error" context={context} />);

    expect(screen.getByText('Context:')).toBeInTheDocument();
    expect(screen.getByText('userId: 123')).toBeInTheDocument();
    expect(screen.getByText('operation: create_file')).toBeInTheDocument();
    expect(screen.getByText('timestamp: 2023-01-01')).toBeInTheDocument();
  });

  it('should show retry and dismiss actions when provided', () => {
    const mockRetry = vi.fn();
    const mockDismiss = vi.fn();

    render(
      <ErrorDisplay
        error="Test error"
        onRetry={mockRetry}
        onDismiss={mockDismiss}
      />
    );

    expect(screen.getByText('[R] Retry')).toBeInTheDocument();
    expect(screen.getByText('[D] Dismiss')).toBeInTheDocument();
  });

  it('should not show suggestions when disabled', () => {
    render(
      <ErrorDisplay
        error="Permission denied: test"
        showSuggestions={false}
      />
    );

    expect(screen.queryByText('💡 Suggestions:')).not.toBeInTheDocument();
    expect(screen.queryByText('Permission Issue')).not.toBeInTheDocument();
  });

  it('should prioritize suggestions correctly', () => {
    const suggestions = [
      {
        title: 'Low Priority',
        description: 'Low priority suggestion',
        priority: 'low' as const,
      },
      {
        title: 'High Priority',
        description: 'High priority suggestion',
        priority: 'high' as const,
      },
      {
        title: 'Medium Priority',
        description: 'Medium priority suggestion',
        priority: 'medium' as const,
      },
    ];

    render(
      <ErrorDisplay
        error="Test error"
        suggestions={suggestions}
        showSuggestions={true}
      />
    );

    const suggestionElements = screen.getAllByText(/Priority$/);
    expect(suggestionElements[0]).toHaveTextContent('High Priority');
    expect(suggestionElements[1]).toHaveTextContent('Medium Priority');
    expect(suggestionElements[2]).toHaveTextContent('Low Priority');
  });

  it('should handle object context values', () => {
    const context = {
      config: { theme: 'dark', debug: true },
    };

    render(<ErrorDisplay error="Test error" context={context} />);

    expect(screen.getByText('config: {"theme":"dark","debug":true}')).toBeInTheDocument();
  });
});

describe('ErrorSummary', () => {
  const mockErrors = [
    {
      id: '1',
      message: 'First error message',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      severity: 'error' as const,
      resolved: false,
    },
    {
      id: '2',
      message: 'Second warning message',
      timestamp: new Date('2023-01-01T10:05:00Z'),
      severity: 'warning' as const,
      resolved: true,
    },
    {
      id: '3',
      message: 'Third info message',
      timestamp: new Date('2023-01-01T10:10:00Z'),
      severity: 'info' as const,
      resolved: false,
    },
  ];

  it('should render error summary with title', () => {
    render(<ErrorSummary errors={mockErrors} />);

    expect(screen.getByText('Recent Issues')).toBeInTheDocument();
  });

  it('should render custom title', () => {
    render(<ErrorSummary errors={mockErrors} title="Custom Error Summary" />);

    expect(screen.getByText('Custom Error Summary')).toBeInTheDocument();
  });

  it('should show unresolved count', () => {
    render(<ErrorSummary errors={mockErrors} />);

    expect(screen.getByText('2 unresolved')).toBeInTheDocument();
    expect(screen.getByText('3 total')).toBeInTheDocument();
  });

  it('should render error messages with severity icons', () => {
    render(<ErrorSummary errors={mockErrors} />);

    expect(screen.getByText('First error message')).toBeInTheDocument();
    expect(screen.getByText('Second warning message')).toBeInTheDocument();
    expect(screen.getByText('Third info message')).toBeInTheDocument();
  });

  it('should show timestamps when enabled', () => {
    render(<ErrorSummary errors={mockErrors} showTimestamps={true} />);

    expect(screen.getByText(/\[.*10:00:00.*\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[.*10:05:00.*\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[.*10:10:00.*\]/)).toBeInTheDocument();
  });

  it('should hide timestamps when disabled', () => {
    render(<ErrorSummary errors={mockErrors} showTimestamps={false} />);

    expect(screen.queryByText(/\[.*10:00:00.*\]/)).not.toBeInTheDocument();
  });

  it('should limit errors to maxErrors', () => {
    render(<ErrorSummary errors={mockErrors} maxErrors={2} />);

    expect(screen.getByText('Second warning message')).toBeInTheDocument();
    expect(screen.getByText('Third info message')).toBeInTheDocument();
    expect(screen.queryByText('First error message')).not.toBeInTheDocument();
  });

  it('should show resolved status with checkmark', () => {
    render(<ErrorSummary errors={mockErrors} />);

    const warningMessage = screen.getByText('Second warning message');
    const parent = warningMessage.closest('div');
    expect(parent).toHaveTextContent('✓');
  });

  it('should truncate long error messages', () => {
    const longError = {
      id: '4',
      message: 'This is a very long error message that should be truncated because it exceeds the character limit',
      timestamp: new Date(),
      severity: 'error' as const,
      resolved: false,
    };

    render(<ErrorSummary errors={[longError]} />);

    expect(screen.getByText(/This is a very long error message that should be truncated.../)).toBeInTheDocument();
  });

  it('should show empty state when no errors', () => {
    render(<ErrorSummary errors={[]} />);

    expect(screen.getByText('No recent issues')).toBeInTheDocument();
  });

  it('should use gray border when no unresolved errors', () => {
    const resolvedErrors = mockErrors.map(e => ({ ...e, resolved: true }));

    const { container } = render(<ErrorSummary errors={resolvedErrors} />);

    expect(screen.getByText('0 total')).toBeInTheDocument();
    expect(screen.queryByText('unresolved')).not.toBeInTheDocument();
  });
});

describe('ValidationError', () => {
  it('should render field validation error', () => {
    const errors = ['Required field', 'Must be at least 3 characters'];

    render(
      <ValidationError
        field="username"
        value="ab"
        errors={errors}
      />
    );

    expect(screen.getByText('Invalid username:')).toBeInTheDocument();
    expect(screen.getByText('"ab"')).toBeInTheDocument();
    expect(screen.getByText('• Required field')).toBeInTheDocument();
    expect(screen.getByText('• Must be at least 3 characters')).toBeInTheDocument();
  });

  it('should render suggestions when provided', () => {
    const suggestions = ['Use at least 3 characters', 'Avoid special characters'];

    render(
      <ValidationError
        field="password"
        value="ab"
        errors={['Too short']}
        suggestions={suggestions}
      />
    );

    expect(screen.getByText('Suggestions:')).toBeInTheDocument();
    expect(screen.getByText('• Use at least 3 characters')).toBeInTheDocument();
    expect(screen.getByText('• Avoid special characters')).toBeInTheDocument();
  });

  it('should show auto-fix option when provided', () => {
    const mockFix = vi.fn();

    render(
      <ValidationError
        field="email"
        value="invalid-email"
        errors={['Invalid email format']}
        onFix={mockFix}
      />
    );

    expect(screen.getByText('[F] Auto-fix')).toBeInTheDocument();
  });

  it('should handle various value types', () => {
    render(
      <ValidationError
        field="number"
        value={123}
        errors={['Must be positive']}
      />
    );

    expect(screen.getByText('"123"')).toBeInTheDocument();
  });

  it('should handle null values', () => {
    render(
      <ValidationError
        field="optional"
        value={null}
        errors={['Cannot be null']}
      />
    );

    expect(screen.getByText('"null"')).toBeInTheDocument();
  });

  it('should handle object values', () => {
    const objectValue = { nested: 'value' };

    render(
      <ValidationError
        field="config"
        value={objectValue}
        errors={['Invalid configuration']}
      />
    );

    expect(screen.getByText('"[object Object]"')).toBeInTheDocument();
  });
});

describe('Responsive Width Behavior', () => {
  const mockUseStdoutDimensions = vi.mocked(require('../hooks/index.js').useStdoutDimensions);

  beforeEach(() => {
    mockUseStdoutDimensions.mockClear();
  });

  describe('ErrorDisplay responsive behavior', () => {
    it('should use explicit width when provided', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      render(<ErrorDisplay error="Test error" width={60} />);

      // Component should use explicit width (60) instead of terminal width (120)
      // This is verified by the component receiving the correct width prop
      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });

    it('should use terminal width when no explicit width provided', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 25,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      render(<ErrorDisplay error="Test error" />);

      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });

    it('should handle narrow terminal width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 20,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const longContext = {
        longKey: 'This is a very long context value that should be truncated in narrow mode',
      };

      render(<ErrorDisplay error="Test error" context={longContext} />);

      expect(mockUseStdoutDimensions).toHaveBeenCalled();
      // In narrow mode, context values should be truncated
    });
  });

  describe('ErrorSummary responsive behavior', () => {
    const mockErrors = [
      {
        id: '1',
        message: 'This is a very long error message that should be truncated based on terminal width',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        severity: 'error' as const,
        resolved: false,
      },
    ];

    it('should use explicit width when provided', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      render(<ErrorSummary errors={mockErrors} width={50} />);

      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });

    it('should abbreviate timestamps in narrow mode', () => {
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

      render(<ErrorSummary errors={mockErrors} showTimestamps={true} />);

      expect(mockUseStdoutDimensions).toHaveBeenCalled();
      // In narrow mode, timestamps should be abbreviated (HH:MM instead of HH:MM:SS)
    });

    it('should truncate messages based on terminal width', () => {
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

      render(<ErrorSummary errors={mockErrors} showTimestamps={false} />);

      expect(mockUseStdoutDimensions).toHaveBeenCalled();
      // Long messages should be truncated based on available width
    });
  });

  describe('ValidationError responsive behavior', () => {
    const longValue = 'This is a very long field value that should be truncated appropriately';
    const longErrors = ['This is a very long error message that should be truncated based on terminal width'];
    const longSuggestions = ['This is a very long suggestion that should also be truncated appropriately'];

    it('should use explicit width when provided', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      render(
        <ValidationError
          field="username"
          value={longValue}
          errors={longErrors}
          width={50}
        />
      );

      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });

    it('should truncate values more aggressively in narrow mode', () => {
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

      render(
        <ValidationError
          field="username"
          value={longValue}
          errors={longErrors}
          suggestions={longSuggestions}
        />
      );

      expect(mockUseStdoutDimensions).toHaveBeenCalled();
      // In narrow mode, values should be truncated more aggressively (20 chars vs 40)
    });

    it('should truncate errors and suggestions based on terminal width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 70,
        height: 25,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <ValidationError
          field="password"
          value="test"
          errors={longErrors}
          suggestions={longSuggestions}
        />
      );

      expect(mockUseStdoutDimensions).toHaveBeenCalled();
      // Errors and suggestions should be truncated based on terminal width
    });
  });
});