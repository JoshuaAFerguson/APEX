import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { TaskProgress, MultiTaskProgress, StepProgress } from '../ProgressIndicators';
import type { StdoutDimensions } from '../../hooks/useStdoutDimensions';

// Mock the hook to control terminal dimensions
const mockUseStdoutDimensions = vi.fn<[], StdoutDimensions>();
vi.mock('../../hooks/useStdoutDimensions', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

describe('ProgressIndicators - Container Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('TaskProgress Container', () => {
    it('adapts to narrow terminals by using responsive ProgressBar', () => {
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

      render(
        <TaskProgress
          taskName="Database Migration"
          currentStep="Migrating user tables"
          progress={75}
          status="in-progress"
          estimatedTime="2 minutes"
          elapsed="30 seconds"
          showSpinner={true}
        />
      );

      // Should display progress percentage
      expect(screen.getByText('75%')).toBeInTheDocument();

      // Should display task information
      expect(screen.getByText('Database Migration')).toBeInTheDocument();
      expect(screen.getByText('Migrating user tables')).toBeInTheDocument();

      // Should handle time information in narrow mode
      expect(screen.getByText('30 seconds')).toBeInTheDocument();
      expect(screen.getByText('2 minutes')).toBeInTheDocument();
    });

    it('uses responsive LoadingSpinner for current step in narrow mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 10,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const longStepName = 'Processing very long operation with detailed description that should be truncated';

      render(
        <TaskProgress
          taskName="Long Task"
          currentStep={longStepName}
          status="in-progress"
          showSpinner={true}
        />
      );

      // Should show truncated step name when spinner uses responsive mode
      expect(screen.queryByText(longStepName)).not.toBeInTheDocument();
      expect(screen.getByText(/Processing/)).toBeInTheDocument();
    });

    it('provides appropriate reservedSpace to ProgressBar accounting for border and padding', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 20,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      render(
        <TaskProgress
          taskName="API Integration"
          progress={60}
          status="in-progress"
        />
      );

      // Should account for border, padding when calculating progress bar width
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('adjusts display in wide terminals with optimal spacing', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 40,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      render(
        <TaskProgress
          taskName="Large Dataset Processing"
          currentStep="Analyzing performance metrics and generating comprehensive reports"
          progress={45}
          status="in-progress"
          estimatedTime="15 minutes"
          elapsed="5 minutes"
          showSpinner={true}
        />
      );

      // Should show full step description in wide mode
      expect(screen.getByText(/Analyzing performance metrics and generating comprehensive reports/)).toBeInTheDocument();

      // Progress bar should utilize more space efficiently
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('handles status transitions with consistent responsive behavior', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 70,
        height: 20,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const { rerender } = render(
        <TaskProgress
          taskName="File Processing"
          progress={25}
          status="in-progress"
        />
      );

      expect(screen.getByText('25%')).toBeInTheDocument();

      // Transition to completed
      rerender(
        <TaskProgress
          taskName="File Processing"
          progress={100}
          status="completed"
        />
      );

      // Should not show progress bar for completed status
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });
  });

  describe('MultiTaskProgress Container', () => {
    const sampleTasks = [
      { id: '1', name: 'Initialize Project', status: 'completed' as const, progress: 100 },
      { id: '2', name: 'Setup Database Connection', status: 'completed' as const, progress: 100 },
      { id: '3', name: 'Configure API Endpoints', status: 'in-progress' as const, progress: 65, currentStep: 'Creating authentication middleware' },
      { id: '4', name: 'Write Unit Tests', status: 'pending' as const, progress: 0 },
      { id: '5', name: 'Deploy to Production', status: 'pending' as const, progress: 0 },
    ];

    it('adapts overall progress bar to narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 12,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(<MultiTaskProgress tasks={sampleTasks} title="Project Setup" compact={false} />);

      // Should show overall progress (2 completed out of 5 = 40%)
      expect(screen.getByText('40%')).toBeInTheDocument();

      // Should show task count
      expect(screen.getByText('2/5 completed')).toBeInTheDocument();

      // Should display all task names
      expect(screen.getByText('Initialize Project')).toBeInTheDocument();
      expect(screen.getByText('Setup Database Connection')).toBeInTheDocument();
      expect(screen.getByText('Configure API Endpoints')).toBeInTheDocument();
    });

    it('handles compact mode appropriately in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 35,
        height: 8,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(<MultiTaskProgress tasks={sampleTasks} title="Setup" compact={true} />);

      // Should not show overall progress bar in compact mode
      expect(screen.queryByText('40%')).not.toBeInTheDocument();

      // Should still show completion count
      expect(screen.getByText('2/5 completed')).toBeInTheDocument();

      // Should not show detailed progress information
      expect(screen.queryByText('Creating authentication middleware')).not.toBeInTheDocument();
    });

    it('provides optimal spacing for overall ProgressBar in wide terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 150,
        height: 30,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      render(<MultiTaskProgress tasks={sampleTasks} title="Comprehensive Project Setup" compact={false} />);

      // Should show overall progress with good spacing
      expect(screen.getByText('40%')).toBeInTheDocument();

      // Should display full title
      expect(screen.getByText('Comprehensive Project Setup')).toBeInTheDocument();

      // Should show detailed task information including current steps
      expect(screen.getByText('Creating authentication middleware')).toBeInTheDocument();
    });

    it('handles dynamic task list updates with consistent responsive behavior', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 20,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      const { rerender } = render(<MultiTaskProgress tasks={sampleTasks} />);

      expect(screen.getByText('40%')).toBeInTheDocument(); // 2/5 = 40%
      expect(screen.getByText('2/5 completed')).toBeInTheDocument();

      // Update task progress
      const updatedTasks = [...sampleTasks];
      updatedTasks[2] = { ...updatedTasks[2], progress: 100, status: 'completed' };

      rerender(<MultiTaskProgress tasks={updatedTasks} />);

      // Should update overall progress (3/5 = 60%)
      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText('3/5 completed')).toBeInTheDocument();
    });

    it('accounts for border space when calculating progress bar width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 15,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(<MultiTaskProgress tasks={sampleTasks} />);

      // Progress bar should account for border space (reservedSpace=4)
      expect(screen.getByText('40%')).toBeInTheDocument();
    });
  });

  describe('StepProgress Container', () => {
    const sampleSteps = [
      { name: 'Planning', status: 'completed' as const, description: 'Define project requirements and architecture' },
      { name: 'Development', status: 'in-progress' as const, description: 'Implement core functionality and features' },
      { name: 'Testing', status: 'pending' as const, description: 'Write and execute comprehensive test suites' },
      { name: 'Deployment', status: 'pending' as const, description: 'Deploy to production environment' },
    ];

    it('uses responsive LoadingSpinner for in-progress steps in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 12,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(<StepProgress steps={sampleSteps} orientation="vertical" showDescriptions={true} compact={false} />);

      // Should show steps with appropriate icons
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument(); // Completed icon

      // Should show descriptions (may be truncated)
      expect(screen.getByText(/Define project requirements/)).toBeInTheDocument();
    });

    it('adapts horizontal orientation to terminal width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 15,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      render(<StepProgress steps={sampleSteps} orientation="horizontal" showDescriptions={false} compact={false} />);

      // Should display steps horizontally with icons
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('Testing')).toBeInTheDocument();
      expect(screen.getByText('Deployment')).toBeInTheDocument();
    });

    it('enables compact mode for narrow terminals automatically', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 8,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(<StepProgress steps={sampleSteps} orientation="vertical" showDescriptions={true} compact={true} />);

      // Should not show descriptions in compact mode
      expect(screen.queryByText('Define project requirements and architecture')).not.toBeInTheDocument();

      // Should show step names and status icons
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });

    it('handles long step names and descriptions in narrow mode', () => {
      const longSteps = [
        {
          name: 'Initialize Complex Database Schema',
          status: 'completed' as const,
          description: 'Create comprehensive database schema with relationships, indexes, and constraints for optimal performance'
        },
        {
          name: 'Implement Advanced Authentication System',
          status: 'in-progress' as const,
          description: 'Develop multi-factor authentication with OAuth integration, JWT tokens, and role-based access control'
        },
      ];

      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 10,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(<StepProgress steps={longSteps} orientation="vertical" showDescriptions={true} compact={false} />);

      // Should show truncated or adapted step names
      expect(screen.getByText(/Initialize/)).toBeInTheDocument();
      expect(screen.getByText(/Implement/)).toBeInTheDocument();

      // Should handle long descriptions appropriately
      expect(screen.getByText(/Create comprehensive/)).toBeInTheDocument();
    });

    it('optimally displays in wide terminals with full information', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 160,
        height: 35,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      render(<StepProgress steps={sampleSteps} orientation="vertical" showDescriptions={true} compact={false} />);

      // Should show full step information with descriptions
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Define project requirements and architecture')).toBeInTheDocument();
      expect(screen.getByText('Implement core functionality and features')).toBeInTheDocument();

      // Should show responsive spinner for in-progress step
      expect(screen.getByText('Development')).toBeInTheDocument();
    });

    it('handles step status changes with consistent responsive behavior', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 75,
        height: 20,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const { rerender } = render(<StepProgress steps={sampleSteps} />);

      expect(screen.getByText('Development')).toBeInTheDocument();

      // Complete the development step
      const updatedSteps = [...sampleSteps];
      updatedSteps[1] = { ...updatedSteps[1], status: 'completed' };
      updatedSteps[2] = { ...updatedSteps[2], status: 'in-progress' };

      rerender(<StepProgress steps={updatedSteps} />);

      // Should update status appropriately
      expect(screen.getByText('Testing')).toBeInTheDocument();
      // Should have two completed checkmarks now
      const checkmarks = screen.getAllByText('✅');
      expect(checkmarks).toHaveLength(2);
    });
  });

  describe('Cross-Container Integration', () => {
    it('handles multiple responsive containers simultaneously', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 90,
        height: 25,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const tasks = [
        { id: '1', name: 'Setup', status: 'completed' as const, progress: 100 },
        { id: '2', name: 'Development', status: 'in-progress' as const, progress: 60 },
      ];

      const steps = [
        { name: 'Init', status: 'completed' as const },
        { name: 'Build', status: 'in-progress' as const },
        { name: 'Test', status: 'pending' as const },
      ];

      render(
        <div>
          <TaskProgress taskName="Main Task" progress={75} status="in-progress" />
          <MultiTaskProgress tasks={tasks} title="Subtasks" />
          <StepProgress steps={steps} />
        </div>
      );

      // All components should render with appropriate responsive behavior
      expect(screen.getByText('75%')).toBeInTheDocument(); // TaskProgress
      expect(screen.getByText('50%')).toBeInTheDocument(); // MultiTaskProgress (1/2 = 50%)
      expect(screen.getByText('Init')).toBeInTheDocument(); // StepProgress
      expect(screen.getByText('Build')).toBeInTheDocument();
    });

    it('maintains consistent responsive behavior across breakpoint changes', () => {
      const { rerender } = render(
        <div>
          <TaskProgress taskName="Task" progress={50} status="in-progress" />
        </div>
      );

      // Start narrow
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
          <TaskProgress taskName="Task" progress={50} status="in-progress" />
        </div>
      );

      expect(screen.getByText('50%')).toBeInTheDocument();

      // Expand to wide
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 30,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      rerender(
        <div>
          <TaskProgress taskName="Task" progress={50} status="in-progress" />
        </div>
      );

      // Should maintain functionality across breakpoints
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });
});