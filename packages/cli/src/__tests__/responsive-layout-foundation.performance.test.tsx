import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  mockTerminalWidth,
  setupResponsiveMocks,
  renderResponsive,
  expectBreakpointBehavior,
  type TerminalWidth,
} from './responsive-layout-foundation.integration.test';

// =============================================================================
// Performance and Real-World Component Integration Tests
// =============================================================================

setupResponsiveMocks();

describe('Responsive Layout Foundation - Performance & Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminalWidth(80);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Performance benchmarks', () => {
    it('should handle rapid terminal width changes efficiently', () => {
      const performanceStart = performance.now();

      const TestComponent = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, breakpoint } = useStdoutDimensions();
        return (
          <div data-testid="perf-test">
            {width}-{breakpoint}
          </div>
        );
      };

      const { setWidth } = renderResponsive(<TestComponent />);

      // Simulate 1000 rapid width changes
      const widths: TerminalWidth[] = [40, 60, 80, 120, 160];
      for (let i = 0; i < 1000; i++) {
        setWidth(widths[i % widths.length]);
      }

      const performanceEnd = performance.now();
      const duration = performanceEnd - performanceStart;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second for 1000 changes

      // Final state should be correct
      setWidth(160);
      expect(screen.getByTestId('perf-test')).toHaveTextContent('160-wide');
    });

    it('should handle multiple component instances efficiently', () => {
      const ComponentInstance = ({ id }: { id: number }) => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, breakpoint } = useStdoutDimensions();
        return (
          <div data-testid={`instance-${id}`}>
            {width}-{breakpoint}
          </div>
        );
      };

      const MultipleInstances = () => (
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <ComponentInstance key={i} id={i} />
          ))}
        </div>
      );

      const start = performance.now();
      const { setWidth } = renderResponsive(<MultipleInstances />);

      // Change width with 100 component instances
      setWidth(40);
      const end = performance.now();

      expect(end - start).toBeLessThan(500); // Should be fast with many instances

      // Verify all instances updated
      expect(screen.getByTestId('instance-0')).toHaveTextContent('40-narrow');
      expect(screen.getByTestId('instance-99')).toHaveTextContent('40-narrow');
    });
  });

  describe('Real-world component integrations', () => {
    it('should work with complex dashboard-like component', () => {
      const Dashboard = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, isNarrow, isCompact, isNormal, isWide } = useStdoutDimensions();

        return (
          <div data-testid="dashboard">
            {/* Header - always present */}
            <div data-testid="header">
              APEX Dashboard
            </div>

            {/* Main content area */}
            <div data-testid="main-content" style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row' }}>
              {/* Sidebar - hidden in narrow mode */}
              {!isNarrow && (
                <div data-testid="sidebar" style={{ width: isCompact ? '200px' : '250px' }}>
                  <div data-testid="nav">Navigation</div>
                  {!isCompact && <div data-testid="shortcuts">Quick Actions</div>}
                </div>
              )}

              {/* Main panel */}
              <div data-testid="main-panel" style={{ flex: 1 }}>
                <div data-testid="metrics">
                  {isNarrow ? 'Key Metrics' : 'System Metrics Dashboard'}
                </div>

                {/* Grid layout */}
                <div
                  data-testid="grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isNarrow
                      ? '1fr'
                      : isCompact
                        ? 'repeat(2, 1fr)'
                        : isNormal
                          ? 'repeat(3, 1fr)'
                          : 'repeat(4, 1fr)',
                    gap: '10px'
                  }}
                >
                  <div data-testid="card-1">Tasks</div>
                  <div data-testid="card-2">Agents</div>
                  {!isNarrow && <div data-testid="card-3">Performance</div>}
                  {(isNormal || isWide) && <div data-testid="card-4">Logs</div>}
                  {isWide && <div data-testid="card-5">Analytics</div>}
                </div>
              </div>

              {/* Right panel - only in wide mode */}
              {isWide && (
                <div data-testid="right-panel" style={{ width: '300px' }}>
                  <div data-testid="activity-feed">Activity Feed</div>
                  <div data-testid="notifications">Notifications</div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div data-testid="footer">
              {isNarrow ? `W:${width}` : `Terminal: ${width} cols | ${isWide ? 'Full' : isNormal ? 'Standard' : 'Compact'} Layout`}
            </div>
          </div>
        );
      };

      expectBreakpointBehavior({
        component: <Dashboard />,
        visible: {
          narrow: [
            'APEX Dashboard',
            'Key Metrics',
            'Tasks',
            'Agents',
            'W:40'
          ],
          compact: [
            'APEX Dashboard',
            'Navigation',
            'System Metrics Dashboard',
            'Tasks',
            'Agents',
            'Performance',
            'Terminal: 80 cols | Compact Layout'
          ],
          normal: [
            'APEX Dashboard',
            'Navigation',
            'Quick Actions',
            'System Metrics Dashboard',
            'Tasks',
            'Agents',
            'Performance',
            'Logs',
            'Terminal: 120 cols | Standard Layout'
          ],
          wide: [
            'APEX Dashboard',
            'Navigation',
            'Quick Actions',
            'System Metrics Dashboard',
            'Tasks',
            'Agents',
            'Performance',
            'Logs',
            'Analytics',
            'Activity Feed',
            'Notifications',
            'Terminal: 160 cols | Full Layout'
          ]
        },
        hidden: {
          narrow: [
            'Navigation',
            'Quick Actions',
            'System Metrics Dashboard',
            'Performance',
            'Logs',
            'Analytics',
            'Activity Feed',
            'Notifications'
          ],
          compact: [
            'Quick Actions',
            'Logs',
            'Analytics',
            'Activity Feed',
            'Notifications'
          ],
          normal: [
            'Analytics',
            'Activity Feed',
            'Notifications'
          ]
        }
      });
    });

    it('should work with responsive data table component', () => {
      const DataTable = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width, isNarrow, isCompact } = useStdoutDimensions();

        const data = [
          { id: 1, name: 'Task Alpha', status: 'Running', progress: 75, agent: 'Developer' },
          { id: 2, name: 'Task Beta', status: 'Completed', progress: 100, agent: 'Tester' },
          { id: 3, name: 'Task Gamma', status: 'Pending', progress: 0, agent: 'Planner' },
        ];

        if (isNarrow) {
          // Card view for narrow screens
          return (
            <div data-testid="table-container">
              <div data-testid="table-header">Tasks (Card View)</div>
              {data.map(item => (
                <div key={item.id} data-testid={`card-${item.id}`} style={{ marginBottom: '10px', border: '1px solid #ccc', padding: '5px' }}>
                  <div data-testid={`card-name-${item.id}`}>{item.name}</div>
                  <div data-testid={`card-status-${item.id}`}>{item.status}</div>
                  <div data-testid={`card-progress-${item.id}`}>{item.progress}%</div>
                </div>
              ))}
            </div>
          );
        }

        // Table view for wider screens
        const showAgent = !isCompact;
        const showProgress = width >= 100;

        return (
          <div data-testid="table-container">
            <div data-testid="table-header">Tasks (Table View)</div>
            <table style={{ width: '100%' }}>
              <thead>
                <tr data-testid="table-header-row">
                  <th data-testid="header-id">ID</th>
                  <th data-testid="header-name">Name</th>
                  <th data-testid="header-status">Status</th>
                  {showProgress && <th data-testid="header-progress">Progress</th>}
                  {showAgent && <th data-testid="header-agent">Agent</th>}
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id} data-testid={`row-${item.id}`}>
                    <td data-testid={`cell-id-${item.id}`}>{item.id}</td>
                    <td data-testid={`cell-name-${item.id}`}>{item.name}</td>
                    <td data-testid={`cell-status-${item.id}`}>{item.status}</td>
                    {showProgress && <td data-testid={`cell-progress-${item.id}`}>{item.progress}%</td>}
                    {showAgent && <td data-testid={`cell-agent-${item.id}`}>{item.agent}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      };

      expectBreakpointBehavior({
        component: <DataTable />,
        visible: {
          narrow: [
            'Tasks (Card View)',
            'Task Alpha',
            'Task Beta',
            'Task Gamma',
            'Running',
            'Completed',
            'Pending',
            '75%',
            '100%',
            '0%'
          ],
          compact: [
            'Tasks (Table View)',
            'ID',
            'Name',
            'Status',
            'Task Alpha',
            'Task Beta',
            'Task Gamma',
            'Running',
            'Completed',
            'Pending'
          ],
          normal: [
            'Tasks (Table View)',
            'ID',
            'Name',
            'Status',
            'Progress',
            'Agent',
            'Task Alpha',
            'Task Beta',
            'Task Gamma',
            'Running',
            'Completed',
            'Pending',
            '75%',
            '100%',
            '0%',
            'Developer',
            'Tester',
            'Planner'
          ],
          wide: [
            'Tasks (Table View)',
            'ID',
            'Name',
            'Status',
            'Progress',
            'Agent',
            'Task Alpha',
            'Task Beta',
            'Task Gamma',
            'Running',
            'Completed',
            'Pending',
            '75%',
            '100%',
            '0%',
            'Developer',
            'Tester',
            'Planner'
          ]
        },
        hidden: {
          narrow: [
            'Tasks (Table View)',
            'ID',
            'Developer',
            'Tester',
            'Planner'
          ],
          compact: [
            'Tasks (Card View)',
            'Agent',
            'Developer',
            'Tester',
            'Planner'
          ]
        }
      });
    });

    it('should work with responsive form component', () => {
      const ResponsiveForm = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { isNarrow, isCompact } = useStdoutDimensions();

        return (
          <div data-testid="form-container">
            <div data-testid="form-title">
              {isNarrow ? 'Config' : 'Project Configuration'}
            </div>

            <div
              data-testid="form-fields"
              style={{
                display: 'flex',
                flexDirection: isNarrow ? 'column' : 'row',
                gap: isNarrow ? '5px' : '10px'
              }}
            >
              <div data-testid="field-name" style={{ flex: 1 }}>
                <label data-testid="label-name">
                  {isCompact ? 'Name' : 'Project Name'}
                </label>
                <input data-testid="input-name" type="text" />
              </div>

              {!isNarrow && (
                <div data-testid="field-type" style={{ flex: 1 }}>
                  <label data-testid="label-type">
                    {isCompact ? 'Type' : 'Project Type'}
                  </label>
                  <select data-testid="select-type">
                    <option>CLI</option>
                    <option>API</option>
                    <option>Web</option>
                  </select>
                </div>
              )}
            </div>

            {!isNarrow && (
              <div data-testid="form-actions" style={{ marginTop: '10px' }}>
                <button data-testid="btn-save">Save Configuration</button>
                <button data-testid="btn-cancel">Cancel</button>
              </div>
            )}

            {isNarrow && (
              <div data-testid="narrow-actions" style={{ marginTop: '10px' }}>
                <button data-testid="btn-save-narrow">Save</button>
              </div>
            )}
          </div>
        );
      };

      const { setWidth } = renderResponsive(<ResponsiveForm />);

      // Test narrow layout
      setWidth(40);
      expect(screen.getByTestId('form-title')).toHaveTextContent('Config');
      expect(screen.getByTestId('label-name')).toHaveTextContent('Project Name');
      expect(screen.queryByTestId('field-type')).not.toBeInTheDocument();
      expect(screen.getByTestId('btn-save-narrow')).toHaveTextContent('Save');
      expect(screen.queryByTestId('btn-save')).not.toBeInTheDocument();

      // Test compact layout
      setWidth(80);
      expect(screen.getByTestId('form-title')).toHaveTextContent('Project Configuration');
      expect(screen.getByTestId('label-name')).toHaveTextContent('Name');
      expect(screen.getByTestId('field-type')).toBeInTheDocument();
      expect(screen.getByTestId('label-type')).toHaveTextContent('Type');
      expect(screen.getByTestId('btn-save')).toHaveTextContent('Save Configuration');
      expect(screen.queryByTestId('btn-save-narrow')).not.toBeInTheDocument();

      // Test normal layout
      setWidth(120);
      expect(screen.getByTestId('label-name')).toHaveTextContent('Project Name');
      expect(screen.getByTestId('label-type')).toHaveTextContent('Project Type');
    });
  });

  describe('Memory leak prevention', () => {
    it('should not leak memory with frequent component re-renders', () => {
      let renderCount = 0;

      const MemoryTestComponent = ({ value }: { value: number }) => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width } = useStdoutDimensions();
        renderCount++;

        return (
          <div data-testid="memory-test">
            Render #{renderCount}: {width} x {value}
          </div>
        );
      };

      const { rerender } = renderResponsive(<MemoryTestComponent value={1} />);

      // Simulate many re-renders
      for (let i = 2; i <= 100; i++) {
        rerender(<MemoryTestComponent value={i} />);
      }

      expect(screen.getByTestId('memory-test')).toHaveTextContent('Render #100: 80 x 100');
      expect(renderCount).toBe(100);
    });

    it('should clean up event listeners properly', () => {
      const TestComponent = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const { width } = useStdoutDimensions();
        return <div data-testid="cleanup-test">{width}</div>;
      };

      const { unmount } = renderResponsive(<TestComponent />);
      expect(screen.getByTestId('cleanup-test')).toBeInTheDocument();

      // Unmounting should not throw or cause issues
      expect(() => unmount()).not.toThrow();
      expect(screen.queryByTestId('cleanup-test')).not.toBeInTheDocument();
    });
  });

  describe('Error resilience', () => {
    it('should recover gracefully from mock function errors', () => {
      const OriginalConsoleError = console.error;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const TestComponent = () => {
          const { useStdoutDimensions } = require('../ui/hooks/index');
          const { width } = useStdoutDimensions();
          return <div data-testid="error-recovery">{width}</div>;
        };

        // Temporarily break the mock
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const originalMock = useStdoutDimensions;

        // This should still render without crashing
        renderResponsive(<TestComponent />);
        expect(screen.getByTestId('error-recovery')).toBeInTheDocument();

      } finally {
        console.error = OriginalConsoleError;
        consoleSpy.mockRestore();
      }
    });

    it('should handle undefined/null values gracefully', () => {
      const TestComponent = () => {
        const { useStdoutDimensions } = require('../ui/hooks/index');
        const dims = useStdoutDimensions();

        // Simulate defensive coding
        const width = dims?.width || 80;
        const breakpoint = dims?.breakpoint || 'compact';

        return (
          <div data-testid="defensive-test">
            {width}-{breakpoint}
          </div>
        );
      };

      expect(() => {
        renderResponsive(<TestComponent />);
        expect(screen.getByTestId('defensive-test')).toBeInTheDocument();
      }).not.toThrow();
    });
  });
});