import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Text, Box } from 'ink';
import { CollapsibleSection } from '../CollapsibleSection.js';

// Mock dependencies
const mockUseInput = vi.fn();
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
  };
});

describe('CollapsibleSection Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseInput.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('ActivityLog Integration', () => {
    it('works as a container for activity log entries', () => {
      const mockLogEntries = [
        { id: '1', level: 'info', message: 'Task started', timestamp: new Date() },
        { id: '2', level: 'success', message: 'Task completed', timestamp: new Date() }
      ];

      const ActivityLogContent = () => (
        <Box flexDirection="column">
          {mockLogEntries.map(entry => (
            <Text key={entry.id} color={entry.level === 'success' ? 'green' : 'blue'}>
              [{entry.level.toUpperCase()}] {entry.message}
            </Text>
          ))}
        </Box>
      );

      render(
        <CollapsibleSection
          title="Activity Log"
          dimmed={false}
          defaultCollapsed={false}
          displayMode="normal"
        >
          <ActivityLogContent />
        </CollapsibleSection>
      );

      expect(screen.getByText('Activity Log')).toBeInTheDocument();
      expect(screen.getByText('[INFO] Task started')).toBeInTheDocument();
      expect(screen.getByText('[SUCCESS] Task completed')).toBeInTheDocument();
    });
  });

  describe('StatusBar Integration', () => {
    it('integrates with status information display', () => {
      const StatusContent = () => (
        <Box justifyContent="space-between">
          <Text>Connected: ●</Text>
          <Text>Agent: developer</Text>
          <Text>Branch: feature/test</Text>
        </Box>
      );

      render(
        <CollapsibleSection
          title="Status Information"
          borderStyle="single"
          borderColor="cyan"
          showArrow={true}
        >
          <StatusContent />
        </CollapsibleSection>
      );

      expect(screen.getByText('Status Information')).toBeInTheDocument();
      expect(screen.getByText('Connected: ●')).toBeInTheDocument();
      expect(screen.getByText('Agent: developer')).toBeInTheDocument();
      expect(screen.getByText('Branch: feature/test')).toBeInTheDocument();
    });
  });

  describe('Multi-Section Dashboard', () => {
    it('handles multiple collapsible sections as a dashboard layout', () => {
      const Dashboard = () => (
        <Box flexDirection="column">
          <CollapsibleSection
            title="Project Status"
            defaultCollapsed={false}
            dimmed={false}
          >
            <Text>Project is running smoothly</Text>
          </CollapsibleSection>

          <CollapsibleSection
            title="Recent Activity"
            defaultCollapsed={true}
            dimmed={false}
          >
            <Text>3 tasks completed today</Text>
          </CollapsibleSection>

          <CollapsibleSection
            title="System Resources"
            defaultCollapsed={true}
            dimmed={true}
          >
            <Text>CPU: 45%, Memory: 60%</Text>
          </CollapsibleSection>
        </Box>
      );

      render(<Dashboard />);

      expect(screen.getByText('Project Status')).toBeInTheDocument();
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('System Resources')).toBeInTheDocument();

      // Project status should be visible (expanded)
      expect(screen.getByText('Project is running smoothly')).toBeInTheDocument();

      // Other sections should be collapsed
      expect(screen.queryByText('3 tasks completed today')).not.toBeInTheDocument();
      expect(screen.queryByText('CPU: 45%, Memory: 60%')).not.toBeInTheDocument();
    });

    it('handles independent state management for multiple sections', () => {
      const onToggle1 = vi.fn();
      const onToggle2 = vi.fn();

      render(
        <Box flexDirection="column">
          <CollapsibleSection
            title="Section 1"
            onToggle={onToggle1}
            defaultCollapsed={true}
          >
            <Text>Content 1</Text>
          </CollapsibleSection>

          <CollapsibleSection
            title="Section 2"
            onToggle={onToggle2}
            defaultCollapsed={true}
          >
            <Text>Content 2</Text>
          </CollapsibleSection>
        </Box>
      );

      const section1Header = screen.getByText('Section 1').parentElement;
      const section2Header = screen.getByText('Section 2').parentElement;

      // Toggle section 1
      fireEvent.click(section1Header!);
      expect(onToggle1).toHaveBeenCalledWith(false); // expanding
      expect(onToggle2).not.toHaveBeenCalled();

      // Toggle section 2
      fireEvent.click(section2Header!);
      expect(onToggle2).toHaveBeenCalledWith(false); // expanding
      expect(onToggle1).toHaveBeenCalledTimes(1);
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to different display modes in a responsive layout', () => {
      const ResponsiveLayout = ({ mode }: { mode: 'normal' | 'compact' | 'verbose' }) => (
        <Box flexDirection="column">
          <CollapsibleSection
            title="Responsive Section With Long Title That Should Adapt"
            displayMode={mode}
            defaultCollapsed={false}
          >
            <Text>This content adapts to the display mode</Text>
          </CollapsibleSection>
        </Box>
      );

      // Test normal mode
      const { rerender } = render(<ResponsiveLayout mode="normal" />);
      expect(screen.getByText('Responsive Section With Long Title That Should Adapt')).toBeInTheDocument();

      // Test compact mode
      rerender(<ResponsiveLayout mode="compact" />);
      expect(screen.getByText(/Responsive Section/)).toBeInTheDocument();

      // Test verbose mode
      rerender(<ResponsiveLayout mode="verbose" />);
      expect(screen.getByText('Responsive Section With Long Title That Should Adapt')).toBeInTheDocument();
      expect(screen.getByText('[expanded]')).toBeInTheDocument();
    });
  });

  describe('Real-World Scenarios', () => {
    it('simulates agent workflow display', () => {
      const AgentWorkflow = () => (
        <Box flexDirection="column">
          <CollapsibleSection
            title="Planning Stage"
            dimmed={true}
            defaultCollapsed={true}
            borderColor="blue"
          >
            <Text>✓ Requirements analyzed</Text>
            <Text>✓ Architecture designed</Text>
          </CollapsibleSection>

          <CollapsibleSection
            title="Development Stage"
            dimmed={false}
            defaultCollapsed={false}
            borderColor="green"
          >
            <Text>⚡ Currently implementing features...</Text>
            <Text>• Feature A: Complete</Text>
            <Text>• Feature B: In Progress</Text>
          </CollapsibleSection>

          <CollapsibleSection
            title="Testing Stage"
            dimmed={true}
            defaultCollapsed={true}
            borderColor="yellow"
          >
            <Text>Waiting for development to complete</Text>
          </CollapsibleSection>
        </Box>
      );

      render(<AgentWorkflow />);

      expect(screen.getByText('Planning Stage')).toBeInTheDocument();
      expect(screen.getByText('Development Stage')).toBeInTheDocument();
      expect(screen.getByText('Testing Stage')).toBeInTheDocument();

      // Only development stage should be expanded
      expect(screen.getByText('⚡ Currently implementing features...')).toBeInTheDocument();
      expect(screen.queryByText('✓ Requirements analyzed')).not.toBeInTheDocument();
      expect(screen.queryByText('Waiting for development to complete')).not.toBeInTheDocument();
    });

    it('simulates error state handling in sections', () => {
      const ErrorStateSection = ({ hasError }: { hasError: boolean }) => (
        <CollapsibleSection
          title={hasError ? '❌ Build Failed' : '✅ Build Successful'}
          borderColor={hasError ? 'red' : 'green'}
          defaultCollapsed={false}
          dimmed={false}
        >
          {hasError ? (
            <Box flexDirection="column">
              <Text color="red">Error: Compilation failed</Text>
              <Text color="gray">src/component.ts:45 - Type error</Text>
            </Box>
          ) : (
            <Box flexDirection="column">
              <Text color="green">All tests passed</Text>
              <Text color="gray">Build completed in 2.3s</Text>
            </Box>
          )}
        </CollapsibleSection>
      );

      const { rerender } = render(<ErrorStateSection hasError={false} />);

      expect(screen.getByText('✅ Build Successful')).toBeInTheDocument();
      expect(screen.getByText('All tests passed')).toBeInTheDocument();

      // Switch to error state
      rerender(<ErrorStateSection hasError={true} />);

      expect(screen.getByText('❌ Build Failed')).toBeInTheDocument();
      expect(screen.getByText('Error: Compilation failed')).toBeInTheDocument();
    });
  });

  describe('Performance Under Load', () => {
    it('handles large content efficiently', () => {
      const LargeContent = () => (
        <Box flexDirection="column">
          {Array.from({ length: 100 }, (_, i) => (
            <Text key={i}>Log entry #{i + 1}: This is a sample log message</Text>
          ))}
        </Box>
      );

      render(
        <CollapsibleSection title="Large Log File" defaultCollapsed={false}>
          <LargeContent />
        </CollapsibleSection>
      );

      expect(screen.getByText('Large Log File')).toBeInTheDocument();
      expect(screen.getByText('Log entry #1: This is a sample log message')).toBeInTheDocument();
      expect(screen.getByText('Log entry #100: This is a sample log message')).toBeInTheDocument();

      // Test collapsing with large content
      const header = screen.getByText('Large Log File').parentElement;
      fireEvent.click(header!);

      expect(screen.queryByText('Log entry #1: This is a sample log message')).not.toBeInTheDocument();
    });

    it('handles rapid state changes under load', () => {
      const onToggle = vi.fn();

      render(
        <CollapsibleSection title="Stress Test" onToggle={onToggle} defaultCollapsed={false}>
          <Text>Content that gets toggled rapidly</Text>
        </CollapsibleSection>
      );

      const header = screen.getByText('Stress Test').parentElement;

      // Simulate rapid user interactions
      for (let i = 0; i < 20; i++) {
        fireEvent.click(header!);
        vi.advanceTimersByTime(10); // Small time increments
      }

      // Should handle all interactions
      expect(onToggle).toHaveBeenCalledTimes(20);
    });
  });

  describe('Accessibility Integration', () => {
    it('maintains accessibility when integrated with other components', () => {
      render(
        <Box flexDirection="column">
          <Text>Main Application Header</Text>
          <CollapsibleSection
            title="Accessible Section"
            allowKeyboardToggle={true}
            toggleKey="space"
          >
            <Box flexDirection="column">
              <Text>Accessible content</Text>
              <Text tabIndex={0}>Focusable element</Text>
            </Box>
          </CollapsibleSection>
          <Text>Footer content</Text>
        </Box>
      );

      expect(screen.getByText('Main Application Header')).toBeInTheDocument();
      expect(screen.getByText('Accessible Section')).toBeInTheDocument();
      expect(screen.getByText('Accessible content')).toBeInTheDocument();
      expect(screen.getByText('Footer content')).toBeInTheDocument();

      // Verify keyboard toggle is registered
      expect(mockUseInput).toHaveBeenCalledWith(
        expect.any(Function),
        { isActive: true }
      );
    });
  });
});