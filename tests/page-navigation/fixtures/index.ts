/**
 * @fileoverview Navigation test fixtures module
 *
 * This module exports all navigation test fixtures and scenarios:
 * - Navigation scenarios (basic, history, redirect, error handling)
 * - Test page generators
 * - Scenario runners
 *
 * @example
 * ```typescript
 * import {
 *   // Scenarios
 *   NAVIGATION_SCENARIOS,
 *   PERFORMANCE_NAVIGATION_SCENARIOS,
 *
 *   // Runners
 *   runNavigationScenario,
 *
 *   // Page generators
 *   createNavigationTestPage,
 *
 *   // Validation
 *   verifyNavigationState,
 * } from '../fixtures';
 * ```
 */

// Navigation scenarios and utilities
export {
  // Scenario collections
  NAVIGATION_SCENARIOS,
  PERFORMANCE_NAVIGATION_SCENARIOS,
  ALL_NAVIGATION_SCENARIOS,

  // Scenario execution
  runNavigationScenario,

  // Test page creation
  createNavigationTestPage,

  // State verification
  verifyNavigationState,

  // Types
  type NavigationScenario,
  type NavigationStep,
  type ExpectedOutcome,
} from './navigation-scenarios';
