/**
 * @fileoverview Export validation test for Loading State Fixture
 *
 * Quick test to verify all exports are working correctly
 */

import { describe, it, expect } from 'vitest';

describe('LoadingStateFixture Exports', () => {
  it('should export main class and types', async () => {
    const {
      LoadingStateFixture,
      createLoadingFixtureHooks,
      withLoadingFixture,
      createMultiLoadingFixture,
      LOADING_SCENARIOS,
    } = await import('../loading-state-fixture.js');

    // Check main class
    expect(LoadingStateFixture).toBeDefined();
    expect(typeof LoadingStateFixture).toBe('function');

    // Check integration helpers
    expect(createLoadingFixtureHooks).toBeDefined();
    expect(typeof createLoadingFixtureHooks).toBe('function');

    expect(withLoadingFixture).toBeDefined();
    expect(typeof withLoadingFixture).toBe('function');

    expect(createMultiLoadingFixture).toBeDefined();
    expect(typeof createMultiLoadingFixture).toBe('function');

    // Check predefined scenarios
    expect(LOADING_SCENARIOS).toBeDefined();
    expect(typeof LOADING_SCENARIOS).toBe('object');

    // Check some scenario examples
    expect(LOADING_SCENARIOS['api-request']).toBeDefined();
    expect(LOADING_SCENARIOS['file-upload']).toBeDefined();
    expect(LOADING_SCENARIOS['page-load']).toBeDefined();
  });

  it('should export from main index', async () => {
    const exports = await import('../index.js');

    // Should be able to import from main index
    expect(exports.LoadingStateFixture).toBeDefined();
    expect(exports.createLoadingFixtureHooks).toBeDefined();
    expect(exports.withLoadingFixture).toBeDefined();
    expect(exports.LOADING_SCENARIOS).toBeDefined();
  });

  it('should have correct scenario types', () => {
    const {
      LOADING_SCENARIOS,
    } = require('../loading-state-fixture.js');

    const expectedScenarios = [
      'page-load',
      'api-request',
      'multiple-requests',
      'progressive-load',
      'lazy-component',
      'infinite-scroll',
      'file-upload',
      'background-sync',
      'auth-check',
      'data-refresh',
    ];

    expectedScenarios.forEach(scenario => {
      expect(LOADING_SCENARIOS[scenario]).toBeDefined();
      expect(LOADING_SCENARIOS[scenario].scenario).toBe(scenario);
    });
  });

  it('should instantiate main class without errors', () => {
    const { LoadingStateFixture } = require('../loading-state-fixture.js');

    expect(() => {
      const fixture = new LoadingStateFixture();
      expect(fixture.isSetup()).toBe(false);
      expect(fixture.isLoading()).toBe(false);
    }).not.toThrow();
  });
});