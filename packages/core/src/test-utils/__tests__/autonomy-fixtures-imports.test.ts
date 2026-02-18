/**
 * Simple import validation test for autonomy fixtures
 *
 * This test ensures that all exports from autonomy-fixtures can be imported
 * correctly and don't cause any module resolution issues.
 */

import { describe, it, expect } from 'vitest';

// Test that all exports can be imported without issues
import {
  AutonomyFixtures,
  createAutonomyConfig,
  createApprovalGate,
  createTaskResourceLimits,
  createAgentAutonomyOverride,
  createApexConfigWithAutonomy,
  getAutonomyConfigVariations,
  isValidAutonomyConfig,
} from '../autonomy-fixtures';

describe('Autonomy Fixtures Import Test', () => {
  it('should import AutonomyFixtures object', () => {
    expect(AutonomyFixtures).toBeDefined();
    expect(typeof AutonomyFixtures).toBe('object');
    expect(AutonomyFixtures.fullAuto).toBeDefined();
    expect(AutonomyFixtures.reviewBeforeCommit).toBeDefined();
    expect(AutonomyFixtures.reviewAll).toBeDefined();
  });

  it('should import factory functions', () => {
    expect(typeof createAutonomyConfig).toBe('function');
    expect(typeof createApprovalGate).toBe('function');
    expect(typeof createTaskResourceLimits).toBe('function');
    expect(typeof createAgentAutonomyOverride).toBe('function');
    expect(typeof createApexConfigWithAutonomy).toBe('function');
  });

  it('should import utility functions', () => {
    expect(typeof getAutonomyConfigVariations).toBe('function');
    expect(typeof isValidAutonomyConfig).toBe('function');
  });

  it('should be able to call functions without errors', () => {
    expect(() => createAutonomyConfig()).not.toThrow();
    expect(() => createApprovalGate()).not.toThrow();
    expect(() => createTaskResourceLimits()).not.toThrow();
    expect(() => createAgentAutonomyOverride()).not.toThrow();
    expect(() => createApexConfigWithAutonomy()).not.toThrow();
    expect(() => getAutonomyConfigVariations()).not.toThrow();
    expect(() => isValidAutonomyConfig({})).not.toThrow();
  });
});