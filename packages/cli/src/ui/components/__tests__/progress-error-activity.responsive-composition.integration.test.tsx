import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, RenderResult } from '../../__tests__/test-utils';
import type { StdoutDimensions, Breakpoint } from '../../hooks/useStdoutDimensions';

// Component imports
import {
  ProgressBar,
  CircularProgress,
  SpinnerWithText,
  LoadingSpinner,
  StepProgress,
  TaskProgress,
  MultiTaskProgress
} from '../ProgressIndicators';
import {
  ErrorDisplay,
  ErrorSummary,
  ValidationError
} from '../ErrorDisplay';
import {
  ActivityLog,
  LogStream,
  CompactLog,
  type LogEntry
} from '../ActivityLog';

// =============================================================================
// SECTION 1: Terminal Width Mock Helper (Following established patterns)
// =============================================================================

/**
 * Standard terminal widths for responsive testing
 * Maps to breakpoints: 40→narrow, 60→compact, 80→compact, 120→normal, 180→wide
 */
export type TerminalWidth = 40 | 60 | 80 | 120 | 180;

/**
 * Terminal width to breakpoint mapping with full dimension context
 */
const TERMINAL_CONFIGS: Record<TerminalWidth, StdoutDimensions> = {
  40: {
    width: 40,
    height: 24,
    breakpoint: 'narrow',
    isNarrow: true,
    isCompact: false,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  60: {
    width: 60,
    height: 24,
    breakpoint: 'compact',
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  80: {
    width: 80,
    height: 24,
    breakpoint: 'compact',
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  120: {
    width: 120,
    height: 30,
    breakpoint: 'normal',
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
    isAvailable: true
  },
  180: {
    width: 180,
    height: 40,
    breakpoint: 'wide',
    isNarrow: false,
    isCompact: false,
    isNormal: false,
    isWide: true,
    isAvailable: true
  },
};

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../../hooks/index', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock Ink Spinner component
vi.mock('ink-spinner', () => ({
  default: ({ type }: { type: string }) => <span data-testid={`spinner-${type}`}>⠋</span>,
}));

/**
 * Helper to mock terminal width for responsive testing
 *
 * @param cols - Terminal width in columns (40, 60, 80, 120, or 180)
 * @param overrides - Optional overrides for specific dimension properties
 * @returns The mock return value for verification
 */
export function mockTerminalWidth(
  cols: TerminalWidth,
  overrides?: Partial<StdoutDimensions>
): StdoutDimensions {
  const config = { ...TERMINAL_CONFIGS[cols], ...overrides };
  mockUseStdoutDimensions.mockReturnValue(config);
  return config;
}

// =============================================================================
// SECTION 2: Component Composition Wrapper & Render Helper
// =============================================================================

export interface ResponsiveTestWrapperProps {
  children: React.ReactNode;
  /** Initial terminal width (default: 80) */
  initialWidth?: TerminalWidth;
}

/**
 * Wrapper component providing consistent test context for responsive components
 */
export const ResponsiveTestWrapper: React.FC<ResponsiveTestWrapperProps> = ({
  children,
  initialWidth = 80
}) => {
  // Set up initial terminal width
  React.useEffect(() => {
    mockTerminalWidth(initialWidth);
  }, [initialWidth]);

  return <div data-testid="responsive-test-wrapper">{children}</div>;
};

/**
 * Custom render function for responsive component testing
 *
 * @param ui - React element to render
 * @param options - Render options including terminal width
 * @returns Enhanced render result with responsive helpers
 */
export function renderResponsive(
  ui: React.ReactElement,
  options?: {
    width?: TerminalWidth;
  }
): RenderResult & {
  setWidth: (width: TerminalWidth) => void;
} {
  const { width = 80 } = options || {};

  mockTerminalWidth(width);

  const renderResult = render(
    <ResponsiveTestWrapper initialWidth={width}>
      {ui}
    </ResponsiveTestWrapper>
  );

  return {
    ...renderResult,
    setWidth: (newWidth: TerminalWidth) => {
      mockTerminalWidth(newWidth);
      renderResult.rerender(
        <ResponsiveTestWrapper initialWidth={newWidth}>
          {ui}
        </ResponsiveTestWrapper>
      );
    },
  };
}

// =============================================================================
// SECTION 3: Responsive Assertion Helpers
// =============================================================================

/**
 * Assert that text content does not overflow the specified width
 *
 * @param element - DOM element to check
 * @param maxWidth - Maximum allowed character width
 * @throws AssertionError if content exceeds maxWidth
 */
export function expectNoOverflow(
  element: HTMLElement,
  maxWidth: number
): void {
  const textContent = element.textContent || '';
  const lines = textContent.split('\n');

  lines.forEach((line, index) => {
    if (line.length > maxWidth) {
      throw new Error(
        `Line ${index + 1} exceeds max width of ${maxWidth} characters. ` +
        `Actual length: ${line.length}. Line: "${line.substring(0, 50)}..."`
      );
    }
  });
}

/**
 * Assert that stack trace text has been properly handled for narrow mode
 *
 * @param element - DOM element containing stack trace
 * @param maxWidth - Maximum allowed character width
 * @param expectedLines - Expected number of stack lines based on breakpoint
 */
export function expectStackTraceHandling(
  element: HTMLElement,
  maxWidth: number,
  expectedLines: number
): void {
  const textContent = element.textContent || '';

  // Check overall overflow
  expectNoOverflow(element, maxWidth);

  // Count actual stack lines (lines that look like stack trace entries)
  const stackLines = textContent.split('\n').filter(line =>
    line.trim().length > 0 &&
    (line.includes('at ') || line.includes('Error:') || line.includes('    '))
  );

  if (expectedLines === 0) {
    expect(stackLines.length).toBe(0);
  } else {
    expect(stackLines.length).toBeGreaterThanOrEqual(Math.min(expectedLines, 1));
    expect(stackLines.length).toBeLessThanOrEqual(expectedLines);
  }
}

// =============================================================================
// SECTION 4: Test Data Fixtures
// =============================================================================

const createTestError = (message: string = 'Test error message'): Error => {
  const error = new Error(message);
  error.stack = `Error: ${message}
    at testFunction (/path/to/test.js:10:5)
    at anotherFunction (/path/to/another.js:20:10)
    at deepFunction (/path/to/deep.js:30:15)
    at veryDeepFunction (/path/to/very-deep.js:40:20)
    at extremelyDeepFunction (/path/to/extremely-deep.js:50:25)
    at Module.run (/path/to/module.js:60:30)
    at Object.main (/path/to/main.js:70:35)
    at process.nextTick (/path/to/process.js:80:40)
    at Function.Module.runMain (module.js:90:45)
    at startup (node.js:100:50)`;
  return error;
};

const createTestLogEntries = (): LogEntry[] => [
  {
    id: '1',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    level: 'info',
    message: 'Starting task execution with detailed parameters and configuration',
    agent: 'planner',
    category: 'execution',
  },
  {
    id: '2',
    timestamp: new Date('2024-01-01T10:01:00Z'),
    level: 'warn',
    message: 'Warning about potentially long operation that might exceed timeout limits',
    agent: 'developer',
    category: 'performance',
  },
  {
    id: '3',
    timestamp: new Date('2024-01-01T10:02:00Z'),
    level: 'error',
    message: 'Error occurred during file processing operation with detailed context information',
    agent: 'developer',
    category: 'file-ops',
    data: {
      filename: '/very/long/path/to/some/file/that/might/cause/overflow/issues.txt',
      size: 1024576,
      error: 'ENOENT: no such file or directory'
    }
  },
  {
    id: '4',
    timestamp: new Date('2024-01-01T10:03:00Z'),
    level: 'success',
    message: 'Successfully completed operation with all requirements met',
    agent: 'tester',
    category: 'validation',
  }
];

const createTestSteps = () => [
  {
    name: 'Initialize',
    status: 'completed' as const,
    description: 'Set up initial configuration and environment'
  },
  {
    name: 'Process Data',
    status: 'in-progress' as const,
    description: 'Processing large dataset with complex transformations'
  },
  {
    name: 'Validate Results',
    status: 'pending' as const,
    description: 'Validate processed data against expected schema'
  },
  {
    name: 'Generate Report',
    status: 'pending' as const,
    description: 'Create comprehensive report with charts and metrics'
  }
];

// =============================================================================
// SECTION 5: Integration Tests - Progress Components Responsive Composition
// =============================================================================

describe('Progress and Error Components Responsive Composition Integration Tests', () => {
  beforeEach(() => {
    // Default terminal width
    mockTerminalWidth(80);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =============================================================================
  // Foundation Validation Tests
  // =============================================================================

  describe('Foundation Utilities', () => {
    describe('mockTerminalWidth helper', () => {
      it('correctly sets up all 5 terminal widths', () => {
        const widths: TerminalWidth[] = [40, 60, 80, 120, 180];

        widths.forEach(width => {
          const config = mockTerminalWidth(width);
          expect(config.width).toBe(width);
          expect(config.isAvailable).toBe(true);
        });
      });

      it('correctly maps widths to breakpoints', () => {
        expect(mockTerminalWidth(40).breakpoint).toBe('narrow');
        expect(mockTerminalWidth(60).breakpoint).toBe('compact');
        expect(mockTerminalWidth(80).breakpoint).toBe('compact');
        expect(mockTerminalWidth(120).breakpoint).toBe('normal');
        expect(mockTerminalWidth(180).breakpoint).toBe('wide');
      });

      it('correctly sets boolean helpers', () => {
        const narrow = mockTerminalWidth(40);
        expect(narrow.isNarrow).toBe(true);
        expect(narrow.isCompact).toBe(false);

        const compact = mockTerminalWidth(80);
        expect(compact.isCompact).toBe(true);
        expect(compact.isNormal).toBe(false);

        const normal = mockTerminalWidth(120);
        expect(normal.isNormal).toBe(true);
        expect(normal.isWide).toBe(false);

        const wide = mockTerminalWidth(180);
        expect(wide.isWide).toBe(true);
        expect(wide.isNormal).toBe(false);
      });
    });

    describe('Assertion helpers', () => {
      describe('expectNoOverflow', () => {
        it('passes when text is within width limit', () => {
          const element = document.createElement('div');
          element.textContent = 'Short text';

          expect(() => expectNoOverflow(element, 20)).not.toThrow();
        });

        it('throws when text exceeds width limit', () => {
          const element = document.createElement('div');
          element.textContent = 'This is a very long line that exceeds the width limit';

          expect(() => expectNoOverflow(element, 20)).toThrow(/exceeds max width/);
        });

        it('checks multiple lines', () => {
          const element = document.createElement('div');
          element.textContent = 'Short\nAnother short line\nThis is way too long for the specified limit';

          expect(() => expectNoOverflow(element, 25)).toThrow(/Line 3 exceeds max width/);
        });
      });
    });
  });

  // =============================================================================
  // ProgressIndicators Responsive Composition Tests
  // =============================================================================

  describe('ProgressIndicators Responsive Composition', () => {
    describe('ProgressBar overflow verification across all breakpoints', () => {
      const testWidths: TerminalWidth[] = [40, 60, 80, 120, 180];

      testWidths.forEach(width => {
        it(`adapts to ${width} columns without overflow`, () => {
          mockTerminalWidth(width);

          const { container } = render(
            <ProgressBar
              progress={75}
              label="Processing large dataset with detailed progress information"
              responsive={true}
              showPercentage={true}
            />
          );

          // Should not overflow terminal width
          expectNoOverflow(container, width);

          // Should display progress elements
          expect(screen.getByText(/Processing large dataset/)).toBeInTheDocument();
          expect(screen.getByText(/75%/)).toBeInTheDocument();
        });
      });

      it('handles very long labels gracefully', () => {
        mockTerminalWidth(40);

        const longLabel = 'This is an extremely long label that would definitely overflow in narrow terminals and needs proper handling';

        const { container } = render(
          <ProgressBar
            progress={50}
            label={longLabel}
            responsive={true}
            showPercentage={true}
          />
        );

        expectNoOverflow(container, 40);
      });
    });

    describe('TaskProgress container composition', () => {
      it('renders complex task progress without overflow in narrow terminals', () => {
        mockTerminalWidth(40);

        const { container } = render(
          <TaskProgress
            taskName="Processing large data transformation with multiple validation steps"
            currentStep="Validating input schema and performing complex data transformations"
            progress={65}
            status="in-progress"
            estimatedTime="5 minutes remaining"
            elapsed="2 minutes 30 seconds"
            showSpinner={true}
          />
        );

        expectNoOverflow(container, 40);
        expect(screen.getByText(/Processing large data/)).toBeInTheDocument();
        expect(screen.getByText(/65%/)).toBeInTheDocument();
      });

      it('adapts task progress layout for wide terminals', () => {
        mockTerminalWidth(180);

        const { container } = render(
          <TaskProgress
            taskName="Complex data processing task with detailed progress tracking"
            currentStep="Performing advanced analytics and generating comprehensive reports"
            progress={80}
            status="in-progress"
            estimatedTime="2 minutes remaining"
            elapsed="8 minutes 45 seconds"
            showSpinner={true}
          />
        );

        expectNoOverflow(container, 180);
        expect(screen.getByText(/Complex data processing/)).toBeInTheDocument();
      });
    });

    describe('MultiTaskProgress responsive layout', () => {
      it('handles multiple tasks without overflow across all breakpoints', () => {
        const testWidths: TerminalWidth[] = [40, 60, 80, 120, 180];

        const tasks = [
          {
            id: '1',
            name: 'Data Processing Task with Long Name',
            status: 'completed' as const,
            progress: 100,
            currentStep: 'Finished'
          },
          {
            id: '2',
            name: 'Validation and Testing Phase',
            status: 'in-progress' as const,
            progress: 60,
            currentStep: 'Running comprehensive validation tests'
          },
          {
            id: '3',
            name: 'Report Generation and Export',
            status: 'pending' as const,
          }
        ];

        testWidths.forEach(width => {
          mockTerminalWidth(width);

          const { container } = render(
            <MultiTaskProgress
              tasks={tasks}
              title="Complex Multi-Stage Processing Pipeline"
              compact={false}
            />
          );

          expectNoOverflow(container, width);
          expect(screen.getByText(/Complex Multi-Stage/)).toBeInTheDocument();
        });
      });
    });

    describe('StepProgress horizontal/vertical adaptation', () => {
      const steps = createTestSteps();

      it('adapts step progress for narrow terminals (vertical layout)', () => {
        mockTerminalWidth(40);

        const { container } = render(
          <StepProgress
            steps={steps}
            orientation="vertical"
            showDescriptions={true}
            compact={false}
          />
        );

        expectNoOverflow(container, 40);
        expect(screen.getByText(/Initialize/)).toBeInTheDocument();
        expect(screen.getByText(/Process Data/)).toBeInTheDocument();
      });

      it('uses horizontal layout for wide terminals', () => {
        mockTerminalWidth(180);

        const { container } = render(
          <StepProgress
            steps={steps}
            orientation="horizontal"
            showDescriptions={true}
            compact={false}
          />
        );

        expectNoOverflow(container, 180);
        expect(screen.getByText(/Initialize/)).toBeInTheDocument();
      });
    });

    describe('SpinnerWithText responsive truncation', () => {
      it('truncates text appropriately for narrow terminals', () => {
        mockTerminalWidth(40);

        const longText = 'This is extremely long spinner text that would overflow in narrow terminals and needs truncation';

        const { container } = render(
          <SpinnerWithText
            type="dots"
            text={longText}
            responsive={true}
            color="cyan"
          />
        );

        expectNoOverflow(container, 40);
        expect(screen.getByText(/\.\.\./)).toBeInTheDocument(); // Should be truncated
      });

      it('shows full text in wide terminals', () => {
        mockTerminalWidth(180);

        const mediumText = 'Processing data with detailed information';

        const { container } = render(
          <SpinnerWithText
            type="dots"
            text={mediumText}
            responsive={true}
            color="cyan"
          />
        );

        expectNoOverflow(container, 180);
        expect(screen.getByText(mediumText)).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // ErrorDisplay Responsive Composition Tests
  // =============================================================================

  describe('ErrorDisplay Responsive Composition', () => {
    describe('ErrorDisplay overflow verification across all breakpoints', () => {
      const testWidths: TerminalWidth[] = [40, 60, 80, 120, 180];

      testWidths.forEach(width => {
        it(`adapts to ${width} columns without overflow`, () => {
          mockTerminalWidth(width);

          const error = createTestError('This is a comprehensive error message with detailed context information about what went wrong');
          const suggestions = [
            {
              title: 'Check Configuration',
              description: 'Verify that all configuration parameters are correctly set in the config file',
              command: 'apex config validate',
              priority: 'high' as const
            },
            {
              title: 'Retry Operation',
              description: 'The operation might have failed due to temporary issues. Try running it again.',
              action: 'retry',
              priority: 'medium' as const
            }
          ];

          const { container } = render(
            <ErrorDisplay
              error={error}
              title="Configuration Error"
              suggestions={suggestions}
              showStack={false}
              verbose={false}
              showSuggestions={true}
              context={{
                configFile: '/path/to/very/long/config/file/name/that/might/overflow.yaml',
                operation: 'data-processing',
                timestamp: '2024-01-01T10:00:00Z'
              }}
            />
          );

          expectNoOverflow(container, width);
          expect(screen.getByText(/Configuration Error/)).toBeInTheDocument();
        });
      });
    });

    describe('Stack trace narrow mode handling', () => {
      // Test matrix for stack trace display based on breakpoint and verbose mode
      const testMatrix: Array<[Breakpoint, TerminalWidth, boolean, { shouldShow: boolean; maxLines: number }]> = [
        ['narrow', 40, false, { shouldShow: false, maxLines: 0 }],
        ['narrow', 40, true, { shouldShow: true, maxLines: 3 }],
        ['compact', 60, false, { shouldShow: false, maxLines: 0 }],
        ['compact', 60, true, { shouldShow: true, maxLines: 5 }],
        ['compact', 80, false, { shouldShow: false, maxLines: 0 }],
        ['compact', 80, true, { shouldShow: true, maxLines: 5 }],
        ['normal', 120, false, { shouldShow: true, maxLines: 5 }],
        ['normal', 120, true, { shouldShow: true, maxLines: 10 }],
        ['wide', 180, false, { shouldShow: true, maxLines: 8 }],
        ['wide', 180, true, { shouldShow: true, maxLines: Infinity }],
      ];

      testMatrix.forEach(([breakpoint, width, verbose, expected]) => {
        it(`${breakpoint} (${width}px, verbose=${verbose}): ${expected.maxLines} lines`, () => {
          mockTerminalWidth(width);

          const error = createTestError('Error with stack trace for testing responsive behavior');

          const { container } = render(
            <ErrorDisplay
              error={error}
              title="Stack Trace Test"
              showStack={true}
              verbose={verbose}
              showSuggestions={false}
            />
          );

          // Should not overflow
          expectNoOverflow(container, width);

          if (expected.shouldShow) {
            // Stack trace should be visible
            expect(screen.getByText(/Stack Trace/)).toBeInTheDocument();

            // Check stack trace handling
            const stackSection = screen.getByText(/Stack Trace/).parentElement;
            if (stackSection) {
              expectStackTraceHandling(stackSection, width - 4, expected.maxLines);
            }
          } else {
            // Stack trace should not be visible in non-verbose narrow mode
            expect(screen.queryByText(/Stack Trace/)).not.toBeInTheDocument();
          }
        });
      });
    });

    describe('ErrorSummary responsive truncation', () => {
      it('truncates error messages in narrow terminals', () => {
        mockTerminalWidth(40);

        const errors = [
          {
            id: '1',
            message: 'This is a very long error message that would definitely overflow in narrow terminal displays',
            timestamp: new Date('2024-01-01T10:00:00Z'),
            severity: 'error' as const,
            resolved: false
          },
          {
            id: '2',
            message: 'Another lengthy error with extensive details about what went wrong',
            timestamp: new Date('2024-01-01T10:01:00Z'),
            severity: 'warning' as const,
            resolved: true
          }
        ];

        const { container } = render(
          <ErrorSummary
            errors={errors}
            title="Recent Issues"
            maxErrors={5}
            showTimestamps={true}
          />
        );

        expectNoOverflow(container, 40);
        expect(screen.getByText(/Recent Issues/)).toBeInTheDocument();
      });
    });

    describe('ValidationError width adaptation', () => {
      it('adapts validation errors for different terminal widths', () => {
        const testWidths: TerminalWidth[] = [40, 60, 80, 120, 180];

        testWidths.forEach(width => {
          mockTerminalWidth(width);

          const { container } = render(
            <ValidationError
              field="configuration.database.connectionString"
              value="postgresql://username:password@localhost:5432/database_name_that_is_very_long"
              errors={[
                'Connection string format is invalid and does not match expected pattern',
                'Database name contains invalid characters that are not supported',
                'Connection timeout value exceeds maximum allowed limit'
              ]}
              suggestions={[
                'Use the format: postgresql://user:pass@host:port/dbname',
                'Ensure database name only contains alphanumeric characters and underscores',
                'Set connection timeout to a value between 5 and 300 seconds'
              ]}
            />
          );

          expectNoOverflow(container, width);
          expect(screen.getByText(/Invalid configuration/)).toBeInTheDocument();
        });
      });
    });
  });

  // =============================================================================
  // ActivityLog Responsive Composition Tests
  // =============================================================================

  describe('ActivityLog Responsive Composition', () => {
    const testEntries = createTestLogEntries();

    describe('ActivityLog overflow verification across all breakpoints', () => {
      const testWidths: TerminalWidth[] = [40, 60, 80, 120, 180];

      testWidths.forEach(width => {
        it(`adapts to ${width} columns without overflow`, () => {
          mockTerminalWidth(width);

          const { container } = render(
            <ActivityLog
              entries={testEntries}
              maxEntries={10}
              showTimestamps={true}
              showAgents={true}
              allowCollapse={true}
              title="Comprehensive Activity Log with Detailed Information"
              autoScroll={true}
              displayMode="normal"
              height={20}
            />
          );

          expectNoOverflow(container, width);
          expect(screen.getByText(/Comprehensive Activity Log/)).toBeInTheDocument();
        });
      });
    });

    describe('LogStream responsive streaming', () => {
      it('handles real-time log streaming without overflow in narrow terminals', () => {
        mockTerminalWidth(40);

        const { container } = render(
          <LogStream
            entries={testEntries}
            realTime={true}
            bufferSize={50}
            height={15}
          />
        );

        expectNoOverflow(container, 40);
        expect(screen.getByText(/Live Log Stream/)).toBeInTheDocument();
      });

      it('displays full streaming interface in wide terminals', () => {
        mockTerminalWidth(180);

        const { container } = render(
          <LogStream
            entries={testEntries}
            realTime={true}
            bufferSize={100}
            height={25}
          />
        );

        expectNoOverflow(container, 180);
        expect(screen.getByText(/Live Log Stream/)).toBeInTheDocument();
        expect(screen.getByText(/Space: pause/)).toBeInTheDocument();
      });
    });

    describe('CompactLog minimal display', () => {
      it('provides compact log display for constrained spaces', () => {
        mockTerminalWidth(40);

        const { container } = render(
          <CompactLog
            entries={testEntries}
            maxLines={3}
            showIcons={true}
            showTimestamps={false}
          />
        );

        expectNoOverflow(container, 40);
      });
    });

    describe('ActivityLog display mode integration', () => {
      it('handles verbose mode with detailed information', () => {
        mockTerminalWidth(120);

        const { container } = render(
          <ActivityLog
            entries={testEntries}
            displayMode="verbose"
            showTimestamps={true}
            showAgents={true}
            filterLevel="debug"
            height={25}
          />
        );

        expectNoOverflow(container, 120);
        expect(screen.getByText(/verbose/)).toBeInTheDocument();
      });

      it('uses compact mode for narrow terminals', () => {
        mockTerminalWidth(40);

        const { container } = render(
          <ActivityLog
            entries={testEntries}
            displayMode="compact"
            showTimestamps={false}
            showAgents={false}
            height={15}
          />
        );

        expectNoOverflow(container, 40);
      });
    });
  });

  // =============================================================================
  // Cross-Component Composition Tests
  // =============================================================================

  describe('Cross-Component Composition Scenarios', () => {
    describe('Combined progress + error displays', () => {
      it('handles task progress with error display in narrow terminals', () => {
        mockTerminalWidth(40);

        const error = createTestError('Task execution failed due to configuration error');

        const { container } = render(
          <div>
            <TaskProgress
              taskName="Data Processing Pipeline"
              currentStep="Validation Phase"
              progress={45}
              status="failed"
              estimatedTime="N/A"
              elapsed="3 minutes"
              showSpinner={false}
            />
            <ErrorDisplay
              error={error}
              title="Task Error"
              showStack={false}
              suggestions={[
                {
                  title: 'Check Input Data',
                  description: 'Verify input data format',
                  priority: 'high'
                }
              ]}
            />
          </div>
        );

        expectNoOverflow(container, 40);
        expect(screen.getByText(/Data Processing Pipeline/)).toBeInTheDocument();
        expect(screen.getByText(/Task Error/)).toBeInTheDocument();
      });
    });

    describe('Progress + activity log integration', () => {
      it('combines multi-task progress with activity log', () => {
        mockTerminalWidth(120);

        const tasks = [
          {
            id: '1',
            name: 'Initialize System',
            status: 'completed' as const,
            progress: 100
          },
          {
            id: '2',
            name: 'Process Data',
            status: 'in-progress' as const,
            progress: 75,
            currentStep: 'Data validation'
          }
        ];

        const { container } = render(
          <div>
            <MultiTaskProgress
              tasks={tasks}
              title="System Processing Pipeline"
              compact={false}
            />
            <ActivityLog
              entries={testEntries}
              title="Processing Log"
              displayMode="normal"
              height={15}
              showTimestamps={true}
            />
          </div>
        );

        expectNoOverflow(container, 120);
        expect(screen.getByText(/System Processing Pipeline/)).toBeInTheDocument();
        expect(screen.getByText(/Processing Log/)).toBeInTheDocument();
      });
    });

    describe('Error + activity log integration', () => {
      it('displays error with related activity log entries', () => {
        mockTerminalWidth(80);

        const error = createTestError('System operation failed with multiple issues');

        const { container } = render(
          <div>
            <ErrorDisplay
              error={error}
              title="System Error"
              showStack={true}
              verbose={false}
              suggestions={[
                {
                  title: 'Review Logs',
                  description: 'Check activity log for details',
                  priority: 'high'
                }
              ]}
            />
            <CompactLog
              entries={testEntries}
              maxLines={3}
              showIcons={true}
              showTimestamps={true}
            />
          </div>
        );

        expectNoOverflow(container, 80);
        expect(screen.getByText(/System Error/)).toBeInTheDocument();
      });
    });

    describe('Full stack composition scenarios', () => {
      it('handles complex UI composition with all component types', () => {
        mockTerminalWidth(180);

        const error = createTestError('Complex operation encountered multiple issues');
        const tasks = createTestSteps().map((step, index) => ({
          id: String(index + 1),
          name: step.name,
          status: step.status,
          progress: step.status === 'completed' ? 100 : step.status === 'in-progress' ? 60 : undefined
        }));

        const { container } = render(
          <div>
            <MultiTaskProgress
              tasks={tasks}
              title="Complex Processing Pipeline"
              compact={false}
            />
            <StepProgress
              steps={createTestSteps()}
              orientation="horizontal"
              showDescriptions={false}
              compact={true}
            />
            <ErrorDisplay
              error={error}
              title="Processing Error"
              showStack={true}
              verbose={true}
              showSuggestions={true}
            />
            <ActivityLog
              entries={testEntries}
              title="Execution Log"
              displayMode="verbose"
              height={20}
              showTimestamps={true}
              showAgents={true}
            />
          </div>
        );

        expectNoOverflow(container, 180);
        expect(screen.getByText(/Complex Processing Pipeline/)).toBeInTheDocument();
        expect(screen.getByText(/Processing Error/)).toBeInTheDocument();
        expect(screen.getByText(/Execution Log/)).toBeInTheDocument();
      });

      it('handles full composition in narrow terminal gracefully', () => {
        mockTerminalWidth(40);

        const error = createTestError('Operation failed');

        const { container } = render(
          <div>
            <ProgressBar
              progress={85}
              label="Processing"
              responsive={true}
            />
            <ErrorSummary
              errors={[
                {
                  id: '1',
                  message: 'Configuration error',
                  timestamp: new Date(),
                  severity: 'error',
                  resolved: false
                }
              ]}
              title="Issues"
              maxErrors={2}
            />
            <CompactLog
              entries={testEntries.slice(0, 2)}
              maxLines={2}
              showIcons={false}
              showTimestamps={false}
            />
          </div>
        );

        expectNoOverflow(container, 40);
        expect(screen.getByText(/Processing/)).toBeInTheDocument();
        expect(screen.getByText(/Issues/)).toBeInTheDocument();
      });
    });

    describe('Responsive transition behavior', () => {
      it('handles width changes dynamically without breaking layout', () => {
        const { container, setWidth } = renderResponsive(
          <div>
            <TaskProgress
              taskName="Adaptive Task Processing"
              currentStep="Processing phase"
              progress={60}
              status="in-progress"
              showSpinner={true}
            />
            <ErrorSummary
              errors={[
                {
                  id: '1',
                  message: 'Warning during processing',
                  timestamp: new Date(),
                  severity: 'warning',
                  resolved: false
                }
              ]}
              title="Status Summary"
            />
          </div>,
          { width: 180 }
        );

        // Start with wide terminal
        expectNoOverflow(container, 180);
        expect(screen.getByText(/Adaptive Task Processing/)).toBeInTheDocument();

        // Transition to narrow
        setWidth(40);
        expectNoOverflow(container, 40);
        expect(screen.getByText(/Adaptive Task Processing/)).toBeInTheDocument();

        // Back to wide
        setWidth(180);
        expectNoOverflow(container, 180);
        expect(screen.getByText(/Adaptive Task Processing/)).toBeInTheDocument();
      });
    });

    describe('Edge cases and error handling', () => {
      it('handles terminal dimensions not available', () => {
        mockTerminalWidth(80, { isAvailable: false });

        const { container } = render(
          <div>
            <ProgressBar progress={50} responsive={true} />
            <ErrorDisplay
              error={createTestError('Fallback test')}
              title="Fallback Mode"
            />
          </div>
        );

        // Should work with fallback dimensions
        expect(screen.getByText(/50%/)).toBeInTheDocument();
        expect(screen.getByText(/Fallback Mode/)).toBeInTheDocument();
      });

      it('handles extremely narrow terminals gracefully', () => {
        // Test with even narrower than standard (simulating unusual terminals)
        mockTerminalWidth(40, { width: 20 });

        const { container } = render(
          <ProgressBar
            progress={75}
            responsive={true}
            label="Test"
          />
        );

        // Should enforce minimum width constraints
        expect(screen.getByText(/Test/)).toBeInTheDocument();
      });
    });
  });
});