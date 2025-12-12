import type { Theme } from '../../types/theme.js';

/**
 * Light theme configuration - alternative for light terminal backgrounds
 * Uses darker colors for text on light backgrounds
 */
export const lightTheme: Theme = {
  name: 'light',
  colors: {
    // Primary UI colors - adapted for light backgrounds
    primary: 'blue',      // Main accent - readable on light background
    secondary: 'cyan',    // Secondary accent
    success: 'green',     // Success states
    warning: 'red',       // Warning states (darker red for visibility)
    error: 'red',         // Error states
    info: 'blue',         // Informational
    muted: 'gray',        // De-emphasized text
    border: 'gray',       // Borders and separators

    // Background variants
    background: 'white',  // Light background
    backgroundMuted: 'gray', // Slightly darker for panels

    // Text colors - inverted from dark theme
    text: 'black',        // Primary text
    textMuted: 'gray',    // Secondary text
    textInverted: 'white', // Text on dark backgrounds

    // Syntax highlighting colors - adapted for light background
    syntax: {
      keyword: 'magenta',    // Language keywords
      string: 'green',       // String literals
      comment: 'gray',       // Comments
      number: 'blue',        // Numeric values
      function: 'blue',      // Function names
      variable: 'cyan',      // Variables
      type: 'magenta',       // Type annotations
      operator: 'black',     // Operators
    },

    // Agent-specific colors - adjusted for light theme
    agents: {
      planner: 'blue',       // Planning phase
      architect: 'cyan',     // Architecture/design
      developer: 'green',    // Development/coding
      reviewer: 'magenta',   // Review/QA
      tester: 'blue',        // Testing
      devops: 'red',         // Deployment/operations
    },
  },
};