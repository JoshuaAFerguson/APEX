import { describe, it, expect } from 'vitest';
import { darkTheme, lightTheme, getTheme, getThemeNames, isValidThemeName, themes } from '../index';
import type { Theme, ThemeName } from '../../../types/theme';

describe('Theme System', () => {
  describe('Theme Objects Structure', () => {
    const validateThemeStructure = (theme: Theme, expectedName: string) => {
      // Basic structure
      expect(theme).toHaveProperty('name', expectedName);
      expect(theme).toHaveProperty('colors');

      const { colors } = theme;

      // Primary UI colors
      expect(colors).toHaveProperty('primary');
      expect(colors).toHaveProperty('secondary');
      expect(colors).toHaveProperty('success');
      expect(colors).toHaveProperty('warning');
      expect(colors).toHaveProperty('error');
      expect(colors).toHaveProperty('info');
      expect(colors).toHaveProperty('muted');
      expect(colors).toHaveProperty('border');

      // Background colors
      expect(colors).toHaveProperty('background');
      expect(colors).toHaveProperty('backgroundMuted');

      // Text colors
      expect(colors).toHaveProperty('text');
      expect(colors).toHaveProperty('textMuted');
      expect(colors).toHaveProperty('textInverted');

      // Syntax colors
      expect(colors).toHaveProperty('syntax');
      expect(colors.syntax).toHaveProperty('keyword');
      expect(colors.syntax).toHaveProperty('string');
      expect(colors.syntax).toHaveProperty('comment');
      expect(colors.syntax).toHaveProperty('number');
      expect(colors.syntax).toHaveProperty('function');
      expect(colors.syntax).toHaveProperty('variable');
      expect(colors.syntax).toHaveProperty('type');
      expect(colors.syntax).toHaveProperty('operator');

      // Agent colors
      expect(colors).toHaveProperty('agents');
      expect(colors.agents).toHaveProperty('planner');
      expect(colors.agents).toHaveProperty('architect');
      expect(colors.agents).toHaveProperty('developer');
      expect(colors.agents).toHaveProperty('tester');
      expect(colors.agents).toHaveProperty('reviewer');
      expect(colors.agents).toHaveProperty('devops');

      // All color values should be strings
      Object.values(colors).forEach(colorValue => {
        if (typeof colorValue === 'string') {
          expect(typeof colorValue).toBe('string');
          expect(colorValue.length).toBeGreaterThan(0);
        } else if (typeof colorValue === 'object') {
          Object.values(colorValue).forEach(nestedColor => {
            expect(typeof nestedColor).toBe('string');
            expect(nestedColor.length).toBeGreaterThan(0);
          });
        }
      });
    };

    it('dark theme has correct structure', () => {
      validateThemeStructure(darkTheme, 'dark');
    });

    it('light theme has correct structure', () => {
      validateThemeStructure(lightTheme, 'light');
    });
  });

  describe('Theme Color Validation', () => {
    const validateColorFormat = (color: string, colorName: string) => {
      // Should be either a named color or hex color
      const isNamedColor = /^[a-zA-Z]+$/.test(color);
      const isHexColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);

      expect(isNamedColor || isHexColor).toBe(true);
    };

    it('dark theme colors are valid', () => {
      Object.entries(darkTheme.colors).forEach(([key, value]) => {
        if (typeof value === 'string') {
          validateColorFormat(value, key);
        } else if (typeof value === 'object') {
          Object.entries(value).forEach(([nestedKey, nestedValue]) => {
            validateColorFormat(nestedValue, `${key}.${nestedKey}`);
          });
        }
      });
    });

    it('light theme colors are valid', () => {
      Object.entries(lightTheme.colors).forEach(([key, value]) => {
        if (typeof value === 'string') {
          validateColorFormat(value, key);
        } else if (typeof value === 'object') {
          Object.entries(value).forEach(([nestedKey, nestedValue]) => {
            validateColorFormat(nestedValue, `${key}.${nestedKey}`);
          });
        }
      });
    });

    it('themes have different color values for contrast', () => {
      // Themes should have different values for key colors
      expect(darkTheme.colors.background).not.toBe(lightTheme.colors.background);
      expect(darkTheme.colors.text).not.toBe(lightTheme.colors.text);

      // Some colors might be the same (like success/error), but most should differ
      const differentColorCount = Object.keys(darkTheme.colors).reduce((count, key) => {
        const darkValue = darkTheme.colors[key as keyof typeof darkTheme.colors];
        const lightValue = lightTheme.colors[key as keyof typeof lightTheme.colors];

        if (typeof darkValue === 'string' && typeof lightValue === 'string') {
          return darkValue !== lightValue ? count + 1 : count;
        }
        return count;
      }, 0);

      expect(differentColorCount).toBeGreaterThan(2); // At least background and text should be different
    });
  });

  describe('Theme Registry', () => {
    it('contains all expected themes', () => {
      expect(themes).toHaveProperty('dark');
      expect(themes).toHaveProperty('light');
      expect(themes.dark).toEqual(darkTheme);
      expect(themes.light).toEqual(lightTheme);
    });

    it('theme registry keys match theme names', () => {
      Object.entries(themes).forEach(([key, theme]) => {
        expect(theme.name).toBe(key);
      });
    });
  });

  describe('Theme Utility Functions', () => {
    describe('getTheme', () => {
      it('returns correct theme for valid names', () => {
        expect(getTheme('dark')).toEqual(darkTheme);
        expect(getTheme('light')).toEqual(lightTheme);
      });

      it('returns dark theme for invalid names', () => {
        expect(getTheme('invalid')).toEqual(darkTheme);
        expect(getTheme('nonexistent')).toEqual(darkTheme);
        expect(getTheme('')).toEqual(darkTheme);
      });

      it('returns dark theme when no name provided', () => {
        expect(getTheme()).toEqual(darkTheme);
        expect(getTheme(undefined)).toEqual(darkTheme);
      });

      it('is case sensitive', () => {
        expect(getTheme('Dark')).toEqual(darkTheme); // Should fallback to dark
        expect(getTheme('DARK')).toEqual(darkTheme); // Should fallback to dark
        expect(getTheme('Light')).toEqual(darkTheme); // Should fallback to dark
      });
    });

    describe('getThemeNames', () => {
      it('returns all available theme names', () => {
        const names = getThemeNames();
        expect(names).toContain('dark');
        expect(names).toContain('light');
        expect(names).toHaveLength(2);
      });

      it('returns theme names as array of strings', () => {
        const names = getThemeNames();
        names.forEach(name => {
          expect(typeof name).toBe('string');
          expect(name.length).toBeGreaterThan(0);
        });
      });

      it('returned names are valid theme names', () => {
        const names = getThemeNames();
        names.forEach(name => {
          expect(isValidThemeName(name)).toBe(true);
          expect(getTheme(name)).toBeDefined();
        });
      });
    });

    describe('isValidThemeName', () => {
      it('validates correct theme names', () => {
        expect(isValidThemeName('dark')).toBe(true);
        expect(isValidThemeName('light')).toBe(true);
      });

      it('rejects invalid theme names', () => {
        expect(isValidThemeName('invalid')).toBe(false);
        expect(isValidThemeName('nonexistent')).toBe(false);
        expect(isValidThemeName('')).toBe(false);
        expect(isValidThemeName('Dark')).toBe(false); // Case sensitive
        expect(isValidThemeName('DARK')).toBe(false);
      });

      it('handles edge cases', () => {
        expect(isValidThemeName(null as any)).toBe(false);
        expect(isValidThemeName(undefined as any)).toBe(false);
        expect(isValidThemeName(123 as any)).toBe(false);
        expect(isValidThemeName({} as any)).toBe(false);
        expect(isValidThemeName([] as any)).toBe(false);
      });

      it('provides type guard functionality', () => {
        const testName: string = 'dark';
        if (isValidThemeName(testName)) {
          // TypeScript should recognize testName as ThemeName here
          const theme = themes[testName]; // This should not have TypeScript errors
          expect(theme).toBeDefined();
        }
      });
    });
  });

  describe('Theme Consistency', () => {
    it('both themes have identical structure', () => {
      const darkKeys = Object.keys(darkTheme.colors).sort();
      const lightKeys = Object.keys(lightTheme.colors).sort();
      expect(darkKeys).toEqual(lightKeys);

      // Check nested objects too
      const darkSyntaxKeys = Object.keys(darkTheme.colors.syntax).sort();
      const lightSyntaxKeys = Object.keys(lightTheme.colors.syntax).sort();
      expect(darkSyntaxKeys).toEqual(lightSyntaxKeys);

      const darkAgentKeys = Object.keys(darkTheme.colors.agents).sort();
      const lightAgentKeys = Object.keys(lightTheme.colors.agents).sort();
      expect(darkAgentKeys).toEqual(lightAgentKeys);
    });

    it('agent colors cover all required agent types', () => {
      const requiredAgents: (keyof typeof darkTheme.colors.agents)[] = [
        'planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'
      ];

      requiredAgents.forEach(agent => {
        expect(darkTheme.colors.agents).toHaveProperty(agent);
        expect(lightTheme.colors.agents).toHaveProperty(agent);
        expect(typeof darkTheme.colors.agents[agent]).toBe('string');
        expect(typeof lightTheme.colors.agents[agent]).toBe('string');
      });
    });

    it('syntax colors cover required programming language elements', () => {
      const requiredSyntaxElements: (keyof typeof darkTheme.colors.syntax)[] = [
        'keyword', 'string', 'comment', 'number', 'function', 'variable', 'type', 'operator'
      ];

      requiredSyntaxElements.forEach(element => {
        expect(darkTheme.colors.syntax).toHaveProperty(element);
        expect(lightTheme.colors.syntax).toHaveProperty(element);
        expect(typeof darkTheme.colors.syntax[element]).toBe('string');
        expect(typeof lightTheme.colors.syntax[element]).toBe('string');
      });
    });
  });

  describe('Theme Accessibility', () => {
    it('dark theme uses appropriate dark theme colors', () => {
      // Dark theme should have light text on dark background
      expect(darkTheme.colors.background).toMatch(/black|dark/i);
      expect(darkTheme.colors.text).toMatch(/white|light/i);
    });

    it('light theme uses appropriate light theme colors', () => {
      // Light theme should have dark text on light background
      expect(lightTheme.colors.background).toMatch(/white|light/i);
      expect(lightTheme.colors.text).toMatch(/black|dark/i);
    });

    it('both themes have contrasting text and background', () => {
      // Text and background should be different
      expect(darkTheme.colors.text).not.toBe(darkTheme.colors.background);
      expect(lightTheme.colors.text).not.toBe(lightTheme.colors.background);

      // Inverted text should be different from regular text
      expect(darkTheme.colors.textInverted).not.toBe(darkTheme.colors.text);
      expect(lightTheme.colors.textInverted).not.toBe(lightTheme.colors.text);
    });
  });

  describe('TypeScript Type Safety', () => {
    it('theme names are properly typed', () => {
      // This test primarily validates at compile time
      const validNames: ThemeName[] = ['dark', 'light'];
      validNames.forEach(name => {
        expect(isValidThemeName(name)).toBe(true);
      });
    });

    it('theme objects match Theme interface', () => {
      // This test validates at compile time that themes implement Theme interface
      const testTheme: Theme = darkTheme;
      expect(testTheme.name).toBe('dark');

      const testTheme2: Theme = lightTheme;
      expect(testTheme2.name).toBe('light');
    });
  });
});