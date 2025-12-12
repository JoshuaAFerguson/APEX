import type { Theme } from '../../types/theme.js';

/**
 * Dark theme configuration - the default APEX theme
 * Optimized for terminal usage with high contrast and readability
 */
export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    // Primary UI colors
    primary: 'cyan',      // Main accent - used for prompts, highlights
    secondary: 'blue',    // Secondary accent - used for metadata
    success: 'green',     // Success states - completed tasks, positive feedback
    warning: 'yellow',    // Warning states - cautions, pending items
    error: 'red',         // Error states - failures, problems
    info: 'blue',         // Informational - tips, context
    muted: 'gray',        // De-emphasized text - labels, descriptions
    border: 'gray',       // Borders and separators

    // Background variants
    background: 'black',  // Default background (terminal default)
    backgroundMuted: 'blackBright', // Slightly lighter for panels

    // Text colors
    text: 'white',        // Primary text
    textMuted: 'gray',    // Secondary text
    textInverted: 'black', // Text on light backgrounds

    // Syntax highlighting colors
    syntax: {
      keyword: 'magenta',    // Language keywords
      string: 'green',       // String literals
      comment: 'gray',       // Comments
      number: 'yellow',      // Numeric values
      function: 'blue',      // Function names
      variable: 'cyan',      // Variables
      type: 'yellow',        // Type annotations
      operator: 'white',     // Operators
    },

    // Agent-specific colors for visual distinction
    agents: {
      planner: 'yellow',     // Planning phase
      architect: 'blue',     // Architecture/design
      developer: 'green',    // Development/coding
      reviewer: 'magenta',   // Review/QA
      tester: 'cyan',        // Testing
      devops: 'red',         // Deployment/operations
    },
  },
};