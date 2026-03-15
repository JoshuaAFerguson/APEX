import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import { render as rawRender } from '@testing-library/react';
import { ThemeProvider, useTheme, useThemeColors } from '../ThemeContext';
import { getTheme, getThemeNames, isValidThemeName } from '../../themes';
import { darkTheme, lightTheme } from '../../themes';

// Test component for useThemeColors hook
const ThemeColorsTestComponent: React.FC = () => {
  const colors = useThemeColors();

  return (
    <div>
      <span data-testid="syntax-keyword">{colors.syntax.keyword}</span>
      <span data-testid="agent-developer">{colors.agents.developer}</span>
      <span data-testid="primary-color">{colors.primary}</span>
    </div>
  );
};

describe('ThemeContext Edge Cases and Additional Coverage', () => {
  describe('useThemeColors hook', () => {
    it('provides direct access to theme colors', () => {
      render(
        <ThemeProvider>
          <ThemeColorsTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('syntax-keyword')).toHaveTextContent(darkTheme.colors.syntax.keyword);
      expect(screen.getByTestId('agent-developer')).toHaveTextContent(darkTheme.colors.agents.developer);
      expect(screen.getByTestId('primary-color')).toHaveTextContent(darkTheme.colors.primary);
    });

    it('updates when theme changes', async () => {
      const TestWithToggle: React.FC = () => {
        const { setTheme } = useTheme();
        const colors = useThemeColors();

        return (
          <div>
            <span data-testid="primary-color">{colors.primary}</span>
            <button onClick={() => setTheme('light')}>Switch</button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestWithToggle />
        </ThemeProvider>
      );

      // Initially dark theme
      expect(screen.getByTestId('primary-color')).toHaveTextContent(darkTheme.colors.primary);

      // Switch to light
      const button = screen.getByText('Switch');
      await act(async () => {
        button.click();
      });

      expect(screen.getByTestId('primary-color')).toHaveTextContent(lightTheme.colors.primary);
    });

    it('throws error when used outside ThemeProvider', () => {
      // Mock console.error to suppress error output in test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        rawRender(<ThemeColorsTestComponent />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleError.mockRestore();
    });
  });

  describe('Theme utility functions', () => {
    it('getTheme returns correct theme for valid name', () => {
      expect(getTheme('dark')).toEqual(darkTheme);
      expect(getTheme('light')).toEqual(lightTheme);
    });

    it('getTheme falls back to dark theme for invalid name', () => {
      expect(getTheme('invalid')).toEqual(darkTheme);
      expect(getTheme('')).toEqual(darkTheme);
      expect(getTheme()).toEqual(darkTheme);
    });

    it('getThemeNames returns all available themes', () => {
      const names = getThemeNames();
      expect(names).toContain('dark');
      expect(names).toContain('light');
      expect(names).toHaveLength(2);
    });

    it('isValidThemeName validates theme names correctly', () => {
      expect(isValidThemeName('dark')).toBe(true);
      expect(isValidThemeName('light')).toBe(true);
      expect(isValidThemeName('invalid')).toBe(false);
      expect(isValidThemeName('')).toBe(false);
    });
  });

  describe('Theme provider prop combinations', () => {
    it('defaultTheme prop works correctly', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeColorsTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('primary-color')).toHaveTextContent(lightTheme.colors.primary);
    });

    it('initialTheme overrides defaultTheme', () => {
      render(
        <ThemeProvider defaultTheme="dark" initialTheme="light">
          <ThemeColorsTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('primary-color')).toHaveTextContent(lightTheme.colors.primary);
    });

    it('custom theme overrides both defaultTheme and initialTheme', () => {
      const customTheme = {
        name: 'custom',
        colors: {
          ...darkTheme.colors,
          primary: '#custom-primary',
          syntax: {
            ...darkTheme.colors.syntax,
            keyword: '#custom-keyword',
          },
          agents: {
            ...darkTheme.colors.agents,
            developer: '#custom-developer',
          },
        },
      };

      render(
        <ThemeProvider defaultTheme="light" initialTheme="dark" theme={customTheme}>
          <ThemeColorsTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('primary-color')).toHaveTextContent('#custom-primary');
      expect(screen.getByTestId('syntax-keyword')).toHaveTextContent('#custom-keyword');
      expect(screen.getByTestId('agent-developer')).toHaveTextContent('#custom-developer');
    });

    it('handles invalid defaultTheme gracefully', () => {
      render(
        <ThemeProvider defaultTheme="invalid" as any>
          <ThemeColorsTestComponent />
        </ThemeProvider>
      );

      // Should fallback to dark theme
      expect(screen.getByTestId('primary-color')).toHaveTextContent(darkTheme.colors.primary);
    });
  });

  describe('Theme switching validation', () => {
    it('ignores setTheme calls with empty string', async () => {
      const TestWithInvalidSwitch: React.FC = () => {
        const { setTheme, themeName } = useTheme();

        return (
          <div>
            <span data-testid="theme-name">{themeName}</span>
            <button onClick={() => setTheme('' as any)}>Empty Switch</button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestWithInvalidSwitch />
        </ThemeProvider>
      );

      const button = screen.getByText('Empty Switch');
      await act(async () => {
        button.click();
      });

      // Should remain on current theme (dark)
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
    });

    it('ignores setTheme calls with null/undefined', async () => {
      const TestWithNullSwitch: React.FC = () => {
        const { setTheme, themeName } = useTheme();

        return (
          <div>
            <span data-testid="theme-name">{themeName}</span>
            <button onClick={() => setTheme(null as any)}>Null Switch</button>
            <button onClick={() => setTheme(undefined as any)}>Undefined Switch</button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestWithNullSwitch />
        </ThemeProvider>
      );

      // Try null
      await act(async () => {
        screen.getByText('Null Switch').click();
      });
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');

      // Try undefined
      await act(async () => {
        screen.getByText('Undefined Switch').click();
      });
      expect(screen.getByTestId('theme-name')).toHaveTextContent('dark');
    });
  });

  describe('Custom theme edge cases', () => {
    it('handles partial custom themes correctly', () => {
      const partialTheme = {
        name: 'partial',
        colors: {
          primary: '#partial-primary',
          // Missing other required properties
        } as any,
      };

      render(
        <ThemeProvider theme={partialTheme}>
          <div data-testid="theme-name">{JSON.stringify(partialTheme.name)}</div>
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-name')).toHaveTextContent('"partial"');
    });

    it('updates theme name correctly for custom themes', () => {
      const customTheme1 = {
        name: 'custom1',
        colors: darkTheme.colors,
      };

      const customTheme2 = {
        name: 'custom2',
        colors: lightTheme.colors,
      };

      const TestWithCustomThemes: React.FC = () => {
        const [currentTheme, setCurrentTheme] = React.useState(customTheme1);

        return (
          <ThemeProvider theme={currentTheme}>
            <div>
              <span data-testid="theme-name">{currentTheme.name}</span>
              <button onClick={() => setCurrentTheme(customTheme2)}>Switch Custom</button>
            </div>
          </ThemeProvider>
        );
      };

      render(<TestWithCustomThemes />);

      expect(screen.getByTestId('theme-name')).toHaveTextContent('custom1');

      act(() => {
        screen.getByText('Switch Custom').click();
      });

      expect(screen.getByTestId('theme-name')).toHaveTextContent('custom2');
    });
  });

  describe('Context stability and memoization', () => {
    it('maintains stable theme object reference when not switching', () => {
      let renderCount = 0;
      const capturedRefs: any[] = [];

      const StabilityTestComponent: React.FC = () => {
        renderCount++;
        const { theme } = useTheme();
        capturedRefs.push(theme);
        return <div>{theme.name}</div>;
      };

      const { rerender } = render(
        <ThemeProvider>
          <StabilityTestComponent />
        </ThemeProvider>
      );

      // Force re-render
      rerender(
        <ThemeProvider>
          <StabilityTestComponent />
        </ThemeProvider>
      );

      expect(renderCount).toBe(2);
      // Theme references should be the same
      expect(capturedRefs[0]).toBe(capturedRefs[1]);
    });

    it('provides stable setTheme function reference', () => {
      const setThemeFunctions: any[] = [];

      const SetThemeRefTestComponent: React.FC = () => {
        const { setTheme } = useTheme();
        setThemeFunctions.push(setTheme);
        return <div />;
      };

      const { rerender } = render(
        <ThemeProvider>
          <SetThemeRefTestComponent />
        </ThemeProvider>
      );

      rerender(
        <ThemeProvider>
          <SetThemeRefTestComponent />
        </ThemeProvider>
      );

      // setTheme function reference should be stable
      expect(setThemeFunctions[0]).toBe(setThemeFunctions[1]);
    });
  });
});