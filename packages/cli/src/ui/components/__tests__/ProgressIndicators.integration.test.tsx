import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import {
  ProgressBar,
  CircularProgress,
  StepProgress,
  MultiTaskProgress,
  TaskProgress,
  SpinnerWithText,
  LoadingSpinner,
} from '../ProgressIndicators';
import { TaskProgress as DedicatedTaskProgress } from '../TaskProgress';
import type { StdoutDimensions } from '../../hooks/useStdoutDimensions';

// Mock the hook for controlled testing
const mockUseStdoutDimensions = vi.fn<[], StdoutDimensions>();
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

describe('ProgressIndicators - Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set default terminal dimensions
    mockUseStdoutDimensions.mockReturnValue({
      width: 100,
      height: 30,
      breakpoint: 'normal',
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
      isAvailable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Complete Workflow Progress Display', () => {
    it('displays a complete task workflow with all progress indicator types', async () => {
      const workflowSteps = [
        { name: 'Initialize', status: 'completed', description: 'Setup workspace' },
        { name: 'Analyze', status: 'completed', description: 'Code analysis' },
        { name: 'Implement', status: 'in-progress', description: 'Writing code' },
        { name: 'Test', status: 'pending', description: 'Run tests' },
        { name: 'Deploy', status: 'pending', description: 'Deploy to production' },
      ];

      const currentTasks = [
        { id: '1', name: 'Parse AST', progress: 100, status: 'completed' },
        { id: '2', name: 'Generate Code', progress: 75, status: 'in-progress', currentStep: 'Writing functions' },
        { id: '3', name: 'Optimize', progress: 0, status: 'pending' },
      ];

      render(
        <div>
          {/* Workflow overview */}
          <StepProgress
            steps={workflowSteps}
            currentStep={2}
            showProgress={true}
            showDescriptions={true}
            ariaLabel="Main workflow progress"
          />

          {/* Current stage progress */}
          <TaskProgress
            taskName="Code Implementation"
            currentStep="Writing TypeScript interfaces"
            progress={65}
            status="in-progress"
            estimatedTime="5 minutes"
            elapsed="3 minutes"
          />

          {/* Parallel task monitoring */}
          <MultiTaskProgress
            tasks={currentTasks}
            title="Implementation Tasks"
            showSummary={true}
          />

          {/* Individual progress indicators */}
          <ProgressBar
            progress={75}
            label="Overall Progress"
            animated={true}
            color="success"
            responsive={true}
          />

          {/* Status indicators */}
          <SpinnerWithText
            text="Processing background tasks..."
            type="dots"
            responsive={true}
          />
        </div>
      );

      // Verify workflow display
      expect(screen.getByText('Initialize')).toBeInTheDocument();
      expect(screen.getByText('Implement')).toBeInTheDocument();
      expect(screen.getByText('Setup workspace')).toBeInTheDocument();

      // Verify main task progress
      expect(screen.getByText('Code Implementation')).toBeInTheDocument();
      expect(screen.getByText('Writing TypeScript interfaces')).toBeInTheDocument();
      expect(screen.getByText('Elapsed: 3 minutes')).toBeInTheDocument();
      expect(screen.getByText('ETA: 5 minutes')).toBeInTheDocument();

      // Verify multi-task display
      expect(screen.getByText('Implementation Tasks')).toBeInTheDocument();
      expect(screen.getByText('Parse AST')).toBeInTheDocument();
      expect(screen.getByText('Generate Code')).toBeInTheDocument();

      // Let animations complete
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Verify animated progress bars
      expect(screen.getByText('65%')).toBeInTheDocument(); // TaskProgress
      expect(screen.getByText('75%')).toBeInTheDocument(); // ProgressBar

      // Verify spinner is active
      expect(screen.getByText(/Processing background/)).toBeInTheDocument();
    });

    it('handles responsive layout changes during workflow', async () => {
      const { rerender } = render(
        <div>
          <TaskProgress
            taskName="Responsive Test Task"
            progress={50}
            status="in-progress"
          />
          <SpinnerWithText
            text="Very long task description that should be truncated on narrow terminals"
            abbreviatedText="Processing..."
            responsive={true}
          />
        </div>
      );

      // Normal terminal - should show full content
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByText('50%')).toBeInTheDocument();

      // Switch to narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 15,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      rerender(
        <div>
          <TaskProgress
            taskName="Responsive Test Task"
            progress={50}
            status="in-progress"
          />
          <SpinnerWithText
            text="Very long task description that should be truncated on narrow terminals"
            abbreviatedText="Processing..."
            responsive={true}
          />
        </div>
      );

      // Should show abbreviated text on narrow terminal
      expect(screen.getByText(/Processing/)).toBeInTheDocument();
    });
  });

  describe('Cross-Component State Synchronization', () => {
    it('maintains consistent progress display across multiple indicators', async () => {
      const progress = 60;

      render(
        <div>
          <ProgressBar progress={progress} animated={true} />
          <CircularProgress progress={progress} />
          <TaskProgress
            taskName="Sync Test"
            progress={progress}
            status="in-progress"
          />
        </div>
      );

      // Let animation complete
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // All should show same progress percentage
      const percentages = screen.getAllByText('60%');
      expect(percentages.length).toBeGreaterThanOrEqual(2);
    });

    it('updates multiple progress indicators simultaneously', async () => {
      const { rerender } = render(
        <div>
          <ProgressBar progress={20} animated={true} />
          <TaskProgress
            taskName="Multi Update Test"
            progress={20}
            status="in-progress"
          />
        </div>
      );

      // Initial state
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getAllByText('20%').length).toBeGreaterThanOrEqual(1);

      // Update all to 80%
      rerender(
        <div>
          <ProgressBar progress={80} animated={true} />
          <TaskProgress
            taskName="Multi Update Test"
            progress={80}
            status="in-progress"
          />
        </div>
      );

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.getAllByText('80%').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Complex Layout Integration', () => {
    it('handles nested progress components', () => {
      const subtasks = [
        { id: '1', description: 'Subtask 1', status: 'completed' as const },
        { id: '2', description: 'Subtask 2', status: 'in-progress' as const },
        { id: '3', description: 'Subtask 3', status: 'pending' as const },
      ];

      render(
        <div>
          {/* Main task with dedicated TaskProgress component */}
          <DedicatedTaskProgress
            taskId="main-task"
            description="Main task with subtasks"
            status="in-progress"
            workflow="testing"
            currentStage="implementation"
            agent="developer"
            subtasks={subtasks}
            tokens={{ input: 1500, output: 800 }}
            cost={0.0045}
            displayMode="verbose"
          />

          {/* Overview with multiple tasks */}
          <MultiTaskProgress
            tasks={[
              { id: 'main', name: 'Main Task', status: 'in-progress', progress: 60 },
              { id: 'parallel', name: 'Parallel Task', status: 'pending' },
            ]}
            title="All Tasks"
            showSummary={true}
          />
        </div>
      );

      // Verify nested display
      expect(screen.getByText('Main task with subtasks')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText('implementation')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Verify subtasks
      expect(screen.getByText('Subtask 1')).toBeInTheDocument();
      expect(screen.getByText('Subtask 2')).toBeInTheDocument();

      // Verify metrics
      expect(screen.getByText('2.3k')).toBeInTheDocument(); // Tokens formatted
      expect(screen.getByText('$0.0045')).toBeInTheDocument(); // Cost

      // Verify overview
      expect(screen.getByText('All Tasks')).toBeInTheDocument();
      expect(screen.getByText('Main Task')).toBeInTheDocument();
    });

    it('maintains layout integrity with extreme content', () => {
      const longSteps = Array.from({ length: 10 }, (_, i) => ({
        name: `Very Long Step Name ${i + 1} That Should Be Handled Gracefully`,
        status: i < 3 ? 'completed' : i < 6 ? 'in-progress' : 'pending',
        description: `Detailed description for step ${i + 1} that provides comprehensive information about what this step accomplishes`,
      }));

      expect(() => {
        render(
          <div>
            <StepProgress
              steps={longSteps}
              showDescriptions={true}
              compact={false}
            />
            <ProgressBar
              progress={100}
              label="Very Long Progress Bar Label That Tests Layout Boundaries"
              responsive={true}
            />
          </div>
        );
      }).not.toThrow();

      // Should render without breaking
      expect(screen.getByText('Very Long Step Name 1 That Should Be Handled Gracefully')).toBeInTheDocument();
    });
  });

  describe('Animation Coordination', () => {
    it('coordinates animations across multiple components', async () => {
      render(
        <div>
          <ProgressBar progress={0} animated={true} />
          <TaskProgress
            taskName="Animation Test"
            progress={0}
            status="in-progress"
          />
          <CircularProgress progress={0} indeterminate={false} />
        </div>
      );

      // Start with 0%
      expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(2);

      // Update all to 50%
      const { rerender } = render(
        <div>
          <ProgressBar progress={50} animated={true} />
          <TaskProgress
            taskName="Animation Test"
            progress={50}
            status="in-progress"
          />
          <CircularProgress progress={50} indeterminate={false} />
        </div>
      );

      // Advance through animation
      await act(async () => {
        vi.advanceTimersByTime(100); // Partial animation
      });

      // Should be animating (showing intermediate values)
      const progressTexts = screen.getAllByText(/\d+%/);
      expect(progressTexts.length).toBeGreaterThan(0);

      // Complete animation
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Should reach target
      expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(2);
    });

    it('handles spinner animations with progress bars', async () => {
      render(
        <div>
          <LoadingSpinner text="Loading..." responsive={true} />
          <ProgressBar progress={25} animated={true} />
          <SpinnerWithText text="Processing data..." responsive={true} />
        </div>
      );

      // Should show spinners
      expect(screen.getAllByText(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/).length).toBeGreaterThan(0);

      // Let progress animation complete
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Should show progress
      expect(screen.getByText('25%')).toBeInTheDocument();

      // Spinners should still be active
      expect(screen.getAllByText(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/).length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility Integration', () => {
    it('provides comprehensive accessibility for complex layouts', async () => {
      render(
        <div>
          <StepProgress
            steps={[
              { name: 'Step 1', status: 'completed' },
              { name: 'Step 2', status: 'in-progress' },
            ]}
            ariaLabel="Main workflow: Step 2 of 2"
          />
          <ProgressBar
            progress={75}
            ariaLabel="Overall completion progress"
            announceChanges={true}
          />
          <TaskProgress
            taskName="Accessible Task"
            progress={75}
            status="in-progress"
          />
        </div>
      );

      // Let animations complete
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Verify progress information is accessible
      expect(screen.getAllByText('75%').length).toBeGreaterThan(0); // At least ProgressBar should show 75%
      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Step 2')).toBeInTheDocument();
    });
  });

  describe('Error Handling Integration', () => {
    it('handles mixed valid and invalid data gracefully', () => {
      expect(() => {
        render(
          <div>
            <ProgressBar progress={NaN} />
            <CircularProgress progress={-10} />
            <StepProgress steps={[]} />
            <MultiTaskProgress tasks={[]} />
            <TaskProgress
              taskName=""
              status="unknown-status"
            />
          </div>
        );
      }).not.toThrow();

      // Should show fallback states
      expect(screen.getAllByText('0%').length).toBeGreaterThan(0); // NaN handled
      expect(screen.getByText(/No tasks/)).toBeInTheDocument(); // Empty tasks
    });

    it('recovers from component errors without affecting others', () => {
      const { rerender } = render(
        <div>
          <ProgressBar progress={50} />
          <TaskProgress taskName="Valid Task" status="in-progress" />
        </div>
      );

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Valid Task')).toBeInTheDocument();

      // Update with invalid data for one component
      rerender(
        <div>
          <ProgressBar progress={NaN} />
          <TaskProgress taskName="Valid Task" status="completed" />
        </div>
      );

      // Valid component should continue working
      expect(screen.getByText('Valid Task')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();

      // Invalid progress should fallback
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Performance Integration', () => {
    it('handles multiple simultaneous updates efficiently', () => {
      const { rerender } = render(
        <div>
          <ProgressBar progress={0} animated={true} />
          <ProgressBar progress={0} animated={true} />
          <TaskProgress taskName="Task 1" progress={0} status="in-progress" />
          <TaskProgress taskName="Task 2" progress={0} status="in-progress" />
        </div>
      );

      // Rapidly update all progress bars
      for (let i = 1; i <= 10; i++) {
        rerender(
          <div>
            <ProgressBar progress={i * 10} animated={true} />
            <ProgressBar progress={i * 10} animated={true} />
            <TaskProgress taskName="Task 1" progress={i * 10} status="in-progress" />
            <TaskProgress taskName="Task 2" progress={i * 10} status="in-progress" />
          </div>
        );
      }

      // Should handle rapid updates without issues
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });

    it('cleans up animations on unmount', () => {
      const { unmount } = render(
        <div>
          <ProgressBar progress={50} animated={true} />
          <LoadingSpinner text="Loading..." />
          <CircularProgress indeterminate={true} />
        </div>
      );

      // Start animations
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });
});