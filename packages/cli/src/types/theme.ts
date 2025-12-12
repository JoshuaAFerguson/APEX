/**
 * Theme system for the APEX CLI interface
 * Provides consistent color schemes across all UI components
 */

export interface SyntaxColors {
  keyword: string;      // Keywords and reserved words
  string: string;       // String literals
  comment: string;      // Comments
  number: string;       // Numbers
  function: string;     // Function names
  variable: string;     // Variables
  type: string;         // Type annotations
  operator: string;     // Operators
}

export interface AgentColors {
  planner: string;      // Planner agent
  architect: string;    // Architect agent
  developer: string;    // Developer agent
  reviewer: string;     // Reviewer agent
  tester: string;       // Tester agent
  devops: string;       // DevOps agent
}

export interface Theme {
  name: string;
  colors: {
    // Primary UI colors
    primary: string;      // Main accent color
    secondary: string;    // Secondary accent
    success: string;      // Success states
    warning: string;      // Warning states
    error: string;        // Error states
    info: string;         // Informational
    muted: string;        // De-emphasized text
    border: string;       // Borders and separators

    // Background variants (for boxed elements)
    background: string;   // Default background
    backgroundMuted: string; // Muted background

    // Text colors
    text: string;         // Primary text
    textMuted: string;    // Secondary text
    textInverted: string; // Text on colored backgrounds

    // Specialized color schemes
    syntax: SyntaxColors;
    agents: AgentColors;
  };
}

export interface ThemeConfig {
  name: string;
  customTheme?: Partial<Theme>;
}

export type ThemeName = 'dark' | 'light';