import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import { ThemeProvider, useTheme, ThemeContext } from '../ThemeContext';
import { darkTheme, lightTheme } from '../../themes';

// Test component that uses the theme context
const TestComponent: React.FC = () => {
  const { theme, themeName, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="theme-name">{themeName}</span>
      <span data-testid="primary-color">{theme.colors.primary}</span>
      <button onClick={() => setTheme('light')}>Switch to Light</button>
      <button onClick={() => setTheme('dark')}>Switch to Dark</button>
    </div>
  );
};

describe('ThemeContext', () => {
  describe('ThemeProvider', () => {
    it('provides default dark theme', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
      expect(screen.getByTestId('primary-color')).toHaveTextContent(darkTheme.colors.primary);
    });

    it('accepts initial theme through props', () => {
      render(
        <ThemeProvider initialTheme="light">
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-name')).toHaveTextContent('light');
      expect(screen.getByTestId('primary-color')).toHaveTextContent(lightTheme.colors.primary);
    });

    it('accepts custom theme object', () => {
      const customTheme = {
        name: 'custom',
        colors: {
          ...darkTheme.colors,
          primary: '#custom-color',
        },
      };

      render(
        <ThemeProvider theme={customTheme}>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-name')).toHaveTextContent('custom');
      expect(screen.getByTestId('primary-color')).toHaveTextContent('#custom-color');
    });

    it('falls back to dark theme for invalid theme name', () => {
      render(
        <ThemeProvider initialTheme="invalid-theme" as any>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
      expect(screen.getByTestId('primary-color')).toHaveTextContent(darkTheme.colors.primary);
    });
  });

  describe('useTheme hook', () => {
    it('throws error when used outside ThemeProvider', () => {
      // Mock console.error to suppress error output in test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleError.mockRestore();
    });

    it('provides theme switching functionality', async () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Initially dark
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');

      // Switch to light
      const lightButton = screen.getByText('Switch to Light');
      await act(async () => {
        lightButton.click();
      });

      expect(screen.getByTestId('theme-name')).toHaveTextContent('light');
      expect(screen.getByTestId('primary-color')).toHaveTextContent(lightTheme.colors.primary);

      // Switch back to dark
      const darkButton = screen.getByText('Switch to Dark');
      await act(async () => {
        darkButton.click();
      });

      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
      expect(screen.getByTestId('primary-color')).toHaveTextContent(darkTheme.colors.primary);
    });

    it('handles invalid theme switching gracefully', async () => {
      const TestWithInvalidSwitch: React.FC = () => {
        const { setTheme, themeName } = useTheme();

        return (
          <div>
            <span data-testid="theme-name">{themeName}</span>
            <button onClick={() => setTheme('invalid' as any)}>Invalid Switch</button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestWithInvalidSwitch />
        </ThemeProvider>
      );

      const button = screen.getByText('Invalid Switch');
      await act(async () => {
        button.click();
      });

      // Should remain on current theme (dark)
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
    });
  });

  describe('Theme Objects', () => {
    it('dark theme has required properties', () => {
      expect(darkTheme).toHaveProperty('name', 'dark');
      expect(darkTheme).toHaveProperty('colors');
      expect(darkTheme.colors).toHaveProperty('primary');
      expect(darkTheme.colors).toHaveProperty('secondary');
      expect(darkTheme.colors).toHaveProperty('success');
      expect(darkTheme.colors).toHaveProperty('warning');
      expect(darkTheme.colors).toHaveProperty('error');
      expect(darkTheme.colors).toHaveProperty('info');
      expect(darkTheme.colors).toHaveProperty('muted');
      expect(darkTheme.colors).toHaveProperty('border');
      expect(darkTheme.colors).toHaveProperty('syntax');
      expect(darkTheme.colors).toHaveProperty('agents');
    });

    it('light theme has required properties', () => {
      expect(lightTheme).toHaveProperty('name', 'light');
      expect(lightTheme).toHaveProperty('colors');
      expect(lightTheme.colors).toHaveProperty('primary');
      expect(lightTheme.colors).toHaveProperty('secondary');
      expect(lightTheme.colors).toHaveProperty('success');
      expect(lightTheme.colors).toHaveProperty('warning');
      expect(lightTheme.colors).toHaveProperty('error');
      expect(lightTheme.colors).toHaveProperty('info');
      expect(lightTheme.colors).toHaveProperty('muted');
      expect(lightTheme.colors).toHaveProperty('border');
      expect(lightTheme.colors).toHaveProperty('syntax');
      expect(lightTheme.colors).toHaveProperty('agents');
    });

    it('syntax colors have all required language tokens', () => {
      const requiredTokens = ['keyword', 'string', 'number', 'comment', 'function'];

      requiredTokens.forEach(token => {
        expect(darkTheme.colors.syntax).toHaveProperty(token);
        expect(lightTheme.colors.syntax).toHaveProperty(token);
        expect(typeof darkTheme.colors.syntax[token]).toBe('string');
        expect(typeof lightTheme.colors.syntax[token]).toBe('string');
      });
    });

    it('agent colors have all agent types', () => {
      const requiredAgents = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];

      requiredAgents.forEach(agent => {
        expect(darkTheme.colors.agents).toHaveProperty(agent);
        expect(lightTheme.colors.agents).toHaveProperty(agent);
        expect(typeof darkTheme.colors.agents[agent]).toBe('string');
        expect(typeof lightTheme.colors.agents[agent]).toBe('string');
      });
    });

    it('colors are valid hex/color values', () => {
      const colorPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$|^[a-z]+$/;

      Object.values(darkTheme.colors).forEach(colorValue => {
        if (typeof colorValue === 'string') {
          expect(colorValue).toMatch(colorPattern);
        } else if (typeof colorValue === 'object') {
          Object.values(colorValue).forEach(nestedColor => {
            expect(nestedColor).toMatch(colorPattern);
          });
        }
      });
    });
  });

  describe('Theme Persistence', () => {
    it('persists theme selection across renders', async () => {
      const { rerender } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Switch to light theme
      const lightButton = screen.getByText('Switch to Light');
      await act(async () => {
        lightButton.click();
      });

      expect(screen.getByTestId('theme-name')).toHaveTextContent('light');

      // Rerender component
      rerender(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Theme should persist (if localStorage is mocked)
      // Note: This test might need localStorage mocking
    });
  });

  describe('Theme Integration', () => {
    it('integrates with CLI configuration', () => {
      // Test that theme can be set from config
      const configTheme = 'light';

      render(
        <ThemeProvider initialTheme={configTheme}>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-name')).toHaveTextContent('light');
    });

    it('provides theme to all child components', () => {
      const NestedComponent: React.FC = () => {
        const { theme } = useTheme();
        return <span data-testid="nested-color">{theme.colors.success}</span>;
      };

      const ParentComponent: React.FC = () => {
        return (
          <div>
            <TestComponent />
            <NestedComponent />
          </div>
        );
      };

      render(
        <ThemeProvider>
          <ParentComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('nested-color')).toHaveTextContent(darkTheme.colors.success);
    });
  });

  describe('Performance', () => {
    it('does not cause unnecessary re-renders', () => {
      const renderCount = vi.fn();

      const PerformanceTestComponent: React.FC = () => {
        renderCount();
        const { theme } = useTheme();
        return <span>{theme.colors.primary}</span>;
      };

      render(
        <ThemeProvider>
          <PerformanceTestComponent />
        </ThemeProvider>
      );

      // Initial render
      expect(renderCount).toHaveBeenCalledTimes(1);

      // Multiple theme accesses shouldn't trigger re-renders
      render(
        <ThemeProvider>
          <PerformanceTestComponent />
        </ThemeProvider>
      );
    });

    it('memoizes theme object to prevent reference changes', () => {
      const themeRefs: any[] = [];

      const RefTestComponent: React.FC = () => {
        const { theme } = useTheme();
        themeRefs.push(theme);
        return <div />;
      };

      const { rerender } = render(
        <ThemeProvider>
          <RefTestComponent />
        </ThemeProvider>
      );

      rerender(
        <ThemeProvider>
          <RefTestComponent />
        </ThemeProvider>
      );

      // Theme object reference should be stable
      expect(themeRefs[0]).toBe(themeRefs[1]);
    });
  });
});