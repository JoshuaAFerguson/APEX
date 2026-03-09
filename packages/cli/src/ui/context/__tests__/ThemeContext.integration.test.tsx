import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import { ThemeProvider, useTheme } from '../ThemeContext';
import { darkTheme, lightTheme } from '../../themes';

// Mock UI component that consumes theme
const MockUserInterface: React.FC = () => {
  const { theme, themeName, setTheme } = useTheme();

  return (
    <div data-testid="mock-ui" style={{
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      borderColor: theme.colors.border
    }}>
      <header style={{ color: theme.colors.primary }}>
        APEX CLI - {themeName} theme
      </header>

      <div data-testid="syntax-section">
        <span style={{ color: theme.colors.syntax.keyword }} data-testid="keyword">function</span>
        <span style={{ color: theme.colors.syntax.string }} data-testid="string">"hello"</span>
        <span style={{ color: theme.colors.syntax.comment }} data-testid="comment">// comment</span>
      </div>

      <div data-testid="agents-section">
        <div style={{ color: theme.colors.agents.planner }} data-testid="planner">Planner Agent</div>
        <div style={{ color: theme.colors.agents.architect }} data-testid="architect">Architect Agent</div>
        <div style={{ color: theme.colors.agents.developer }} data-testid="developer">Developer Agent</div>
        <div style={{ color: theme.colors.agents.tester }} data-testid="tester">Tester Agent</div>
        <div style={{ color: theme.colors.agents.reviewer }} data-testid="reviewer">Reviewer Agent</div>
        <div style={{ color: theme.colors.agents.devops }} data-testid="devops">DevOps Agent</div>
      </div>

      <div data-testid="status-section">
        <span style={{ color: theme.colors.success }} data-testid="success">✓ Success</span>
        <span style={{ color: theme.colors.warning }} data-testid="warning">⚠ Warning</span>
        <span style={{ color: theme.colors.error }} data-testid="error">✗ Error</span>
        <span style={{ color: theme.colors.info }} data-testid="info">ℹ Info</span>
      </div>

      <button
        onClick={() => setTheme(themeName === 'dark' ? 'light' : 'dark')}
        data-testid="theme-toggle"
      >
        Toggle Theme
      </button>
    </div>
  );
};

// Complex nested component to test context propagation
const NestedComponentTree: React.FC = () => {
  const Level1: React.FC = () => (
    <div>
      <Level2 />
    </div>
  );

  const Level2: React.FC = () => (
    <div>
      <Level3 />
    </div>
  );

  const Level3: React.FC = () => {
    const { theme, themeName } = useTheme();
    return (
      <div data-testid="deeply-nested">
        <span data-testid="nested-theme">{themeName}</span>
        <span data-testid="nested-primary">{theme.colors.primary}</span>
      </div>
    );
  };

  return <Level1 />;
};

describe('ThemeContext Integration Tests', () => {
  describe('Real UI Component Integration', () => {
    it('integrates correctly with styled components', () => {
      render(
        <ThemeProvider>
          <MockUserInterface />
        </ThemeProvider>
      );

      // Check header text
      expect(screen.getByText('APEX CLI - dark theme')).toBeInTheDocument();

      // Check syntax highlighting colors are applied
      expect(screen.getByTestId('keyword')).toBeInTheDocument();
      expect(screen.getByTestId('string')).toBeInTheDocument();
      expect(screen.getByTestId('comment')).toBeInTheDocument();

      // Check all agent colors are applied
      expect(screen.getByTestId('planner')).toBeInTheDocument();
      expect(screen.getByTestId('architect')).toBeInTheDocument();
      expect(screen.getByTestId('developer')).toBeInTheDocument();
      expect(screen.getByTestId('tester')).toBeInTheDocument();
      expect(screen.getByTestId('reviewer')).toBeInTheDocument();
      expect(screen.getByTestId('devops')).toBeInTheDocument();

      // Check status colors are applied
      expect(screen.getByTestId('success')).toBeInTheDocument();
      expect(screen.getByTestId('warning')).toBeInTheDocument();
      expect(screen.getByTestId('error')).toBeInTheDocument();
      expect(screen.getByTestId('info')).toBeInTheDocument();
    });

    it('updates all UI elements when theme changes', async () => {
      render(
        <ThemeProvider>
          <MockUserInterface />
        </ThemeProvider>
      );

      // Initially dark theme
      expect(screen.getByText('APEX CLI - dark theme')).toBeInTheDocument();

      // Toggle to light theme
      const toggleButton = screen.getByTestId('theme-toggle');
      await act(async () => {
        toggleButton.click();
      });

      // Verify UI updates
      expect(screen.getByText('APEX CLI - light theme')).toBeInTheDocument();

      // Toggle back to dark
      await act(async () => {
        toggleButton.click();
      });

      expect(screen.getByText('APEX CLI - dark theme')).toBeInTheDocument();
    });
  });

  describe('Context Propagation', () => {
    it('provides theme context to deeply nested components', () => {
      render(
        <ThemeProvider initialTheme="light">
          <NestedComponentTree />
        </ThemeProvider>
      );

      expect(screen.getByTestId('nested-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('nested-primary')).toHaveTextContent(lightTheme.colors.primary);
    });

    it('propagates theme changes to all nested components', async () => {
      const TestWithNesting: React.FC = () => {
        const { setTheme } = useTheme();
        return (
          <div>
            <button onClick={() => setTheme('light')} data-testid="change-theme">
              Change Theme
            </button>
            <NestedComponentTree />
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestWithNesting />
        </ThemeProvider>
      );

      // Initially dark
      expect(screen.getByTestId('nested-theme')).toHaveTextContent('dark');

      // Change theme
      await act(async () => {
        screen.getByTestId('change-theme').click();
      });

      // Nested component should update
      expect(screen.getByTestId('nested-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('nested-primary')).toHaveTextContent(lightTheme.colors.primary);
    });
  });

  describe('Multiple Provider Scenarios', () => {
    it('handles multiple theme providers with different themes', () => {
      const InnerProvider: React.FC = () => {
        const { theme, themeName } = useTheme();
        return (
          <div data-testid="inner-theme">
            <span data-testid="inner-name">{themeName}</span>
            <span data-testid="inner-primary">{theme.colors.primary}</span>
          </div>
        );
      };

      const OuterProvider: React.FC = () => {
        const { theme, themeName } = useTheme();
        return (
          <div data-testid="outer-theme">
            <span data-testid="outer-name">{themeName}</span>
            <span data-testid="outer-primary">{theme.colors.primary}</span>
            <ThemeProvider initialTheme="light">
              <InnerProvider />
            </ThemeProvider>
          </div>
        );
      };

      render(
        <ThemeProvider initialTheme="dark">
          <OuterProvider />
        </ThemeProvider>
      );

      // Outer should be dark
      expect(screen.getByTestId('outer-name')).toHaveTextContent('dark');
      expect(screen.getByTestId('outer-primary')).toHaveTextContent(darkTheme.colors.primary);

      // Inner should be light (overridden)
      expect(screen.getByTestId('inner-name')).toHaveTextContent('light');
      expect(screen.getByTestId('inner-primary')).toHaveTextContent(lightTheme.colors.primary);
    });
  });

  describe('Performance with Complex UI', () => {
    it('handles complex UI updates efficiently', async () => {
      let renderCount = 0;

      const ComplexComponent: React.FC = () => {
        renderCount++;
        const { theme, setTheme } = useTheme();

        return (
          <div>
            {/* Many theme-consuming elements */}
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} style={{
                color: theme.colors.primary,
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border
              }}>
                Item {i} - {theme.colors.agents.developer}
              </div>
            ))}
            <button onClick={() => setTheme('light')} data-testid="complex-toggle">
              Switch
            </button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <ComplexComponent />
        </ThemeProvider>
      );

      const initialRenderCount = renderCount;

      // Change theme - should only cause one additional render
      await act(async () => {
        screen.getByTestId('complex-toggle').click();
      });

      // Should not cause excessive re-renders
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Boundaries with Theme Context', () => {
    it('continues to provide theme even when child components error', () => {
      const ErrorComponent: React.FC = () => {
        throw new Error('Test error');
      };

      const SafeComponent: React.FC = () => {
        const { theme } = useTheme();
        return <div data-testid="safe-component">{theme.colors.primary}</div>;
      };

      class ErrorBoundary extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: React.ReactNode }) {
          super(props);
          this.state = { hasError: false };
        }

        static getDerivedStateFromError() {
          return { hasError: true };
        }

        render() {
          if (this.state.hasError) {
            return <div data-testid="error-fallback">Error occurred</div>;
          }
          return this.props.children;
        }
      }

      render(
        <ThemeProvider>
          <SafeComponent />
          <ErrorBoundary>
            <ErrorComponent />
          </ErrorBoundary>
        </ThemeProvider>
      );

      // Safe component should still work
      expect(screen.getByTestId('safe-component')).toHaveTextContent(darkTheme.colors.primary);
      expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
    });
  });
});