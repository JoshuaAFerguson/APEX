/**
 * @fileoverview Example Usage of Loading State Fixture
 *
 * This file demonstrates how to use the Loading State Fixture in various
 * testing scenarios. It serves as both documentation and validation.
 */

import {
  LoadingStateFixture,
  createLoadingFixtureHooks,
  withLoadingFixture,
  createMultiLoadingFixture,
  LOADING_SCENARIOS,
  type LoadingFixtureConfig,
  type PendingRequest,
  type LoadingStep,
} from '../loading-state-fixture.js';

// ============================================================================
// Basic Usage Examples
// ============================================================================

/**
 * Example 1: Basic fixture setup and usage
 */
export async function exampleBasicUsage() {
  const fixture = new LoadingStateFixture();

  const config: LoadingFixtureConfig = {
    name: 'API Request Test',
    description: 'Test API request loading state',
    scenario: 'api-request',
    expectedDuration: 1000,
    cancellable: true,
  };

  try {
    // Set up the fixture
    await fixture.setup(config);

    // Start loading
    fixture.startLoading({ message: 'Fetching user data...' });

    // Check loading state
    console.log('Is loading:', fixture.isLoading());
    console.log('Progress:', fixture.getLoadingProgress().percentage);

    // Simulate completion
    fixture.finishLoading({
      success: true,
      data: { users: ['Alice', 'Bob', 'Charlie'] },
    });

    // Validate final state
    const validation = await fixture.validate();
    console.log('Validation:', validation);

    return fixture.getBrowserState();
  } finally {
    // Always clean up
    await fixture.teardown();
  }
}

/**
 * Example 2: Using with predefined scenarios
 */
export async function examplePredefinedScenarios() {
  const fixture = new LoadingStateFixture();

  // Use a predefined scenario
  const scenarioConfig = LOADING_SCENARIOS['file-upload'];
  const config: LoadingFixtureConfig = {
    name: 'File Upload Example',
    description: 'Example file upload with progress',
    ...scenarioConfig,
  };

  try {
    await fixture.setup(config);

    // Start file upload simulation
    fixture.startLoading({ message: 'Uploading file...' });

    // Simulate progressive upload
    const uploadSteps: LoadingStep[] = [
      { name: 'prepare', duration: 100, progressAfter: 10, message: 'Preparing...' },
      { name: 'upload', duration: 2000, progressAfter: 90, message: 'Uploading...' },
      { name: 'process', duration: 300, progressAfter: 100, message: 'Processing...' },
    ];

    await fixture.simulateProgressiveLoading(uploadSteps);

    const finalProgress = fixture.getLoadingProgress();
    console.log('Final progress:', finalProgress);

    return finalProgress;
  } finally {
    await fixture.teardown();
  }
}

/**
 * Example 3: Handling multiple pending requests
 */
export async function exampleMultipleRequests() {
  const fixture = new LoadingStateFixture();

  const config: LoadingFixtureConfig = {
    name: 'Multiple Requests Test',
    description: 'Test multiple concurrent requests',
    scenario: 'multiple-requests',
    cancellable: true,
  };

  try {
    await fixture.setup(config);
    fixture.startLoading({ message: 'Loading dashboard...' });

    // Simulate multiple concurrent requests
    const requests: PendingRequest[] = [
      {
        id: 'user-profile',
        url: 'https://api.example.com/profile',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
      },
      {
        id: 'notifications',
        url: 'https://api.example.com/notifications',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
      },
      {
        id: 'settings',
        url: 'https://api.example.com/settings',
        method: 'GET',
        status: 'pending',
        startedAt: new Date(),
      },
    ];

    // Add all requests
    const cancelFunctions = requests.map(req => fixture.simulatePendingRequest(req));

    console.log('Pending requests:', fixture.getPendingRequests().length);

    // Simulate completion
    fixture.finishLoading({ success: true });

    return fixture.getBrowserState();
  } finally {
    await fixture.teardown();
  }
}

// ============================================================================
// Integration Helper Examples
// ============================================================================

/**
 * Example 4: Using setup/teardown hooks (for test suites)
 */
export function exampleTestHooks() {
  const { setup, teardown } = createLoadingFixtureHooks('page-load', {
    expectedDuration: 2000,
    indicatorType: 'spinner',
  });

  // In a real test suite, you'd use:
  // beforeEach(setup);
  // afterEach(teardown);

  return { setup, teardown };
}

/**
 * Example 5: Using higher-order function wrapper
 */
export const exampleWithWrapper = withLoadingFixture(
  'lazy-component',
  async (fixture) => {
    // Test logic here - fixture is automatically set up and torn down
    fixture.startLoading({ message: 'Loading component...' });

    // Simulate component loading
    await fixture.simulateDelayedResponse(500, { component: 'loaded' });

    fixture.finishLoading({ success: true });

    return fixture.getLoadingProgress();
  },
  { expectedDuration: 800, indicatorType: 'skeleton' }
);

/**
 * Example 6: Multi-scenario factory
 */
export async function exampleMultiScenario() {
  const scenarios = ['api-request', 'file-upload', 'auth-check'] as const;
  const createFixture = createMultiLoadingFixture([...scenarios]);

  const results = [];

  for (const scenario of scenarios) {
    const fixture = await createFixture(scenario);

    try {
      fixture.startLoading();
      fixture.finishLoading({ success: true });

      results.push({
        scenario,
        config: fixture.state.config,
        browserState: fixture.getBrowserState(),
      });
    } finally {
      await fixture.teardown();
    }
  }

  return results;
}

// ============================================================================
// Advanced Usage Examples
// ============================================================================

/**
 * Example 7: Error handling and timeout simulation
 */
export async function exampleErrorHandling() {
  const fixture = new LoadingStateFixture();

  const config: LoadingFixtureConfig = {
    name: 'Error Handling Test',
    description: 'Test error scenarios',
    scenario: 'api-request',
    timeout: 2000,
    useFakeTimers: true, // For deterministic testing
  };

  try {
    await fixture.setup(config);
    fixture.startLoading();

    // Simulate timeout
    const timeoutState = await fixture.simulateLoadingTimeout();
    console.log('Timeout state:', timeoutState.hasError);

    // Or simulate specific error
    const errorState = fixture.simulateLoadingError('Network connection failed');
    console.log('Error message:', fixture.getLoadingProgress().message);

    return errorState;
  } finally {
    await fixture.teardown();
  }
}

/**
 * Example 8: Request cancellation
 */
export async function exampleRequestCancellation() {
  const fixture = new LoadingStateFixture();

  const config: LoadingFixtureConfig = {
    name: 'Cancellation Test',
    description: 'Test request cancellation',
    scenario: 'api-request',
    cancellable: true,
  };

  try {
    await fixture.setup(config);
    fixture.startLoading();

    // Create a cancellable request
    const request: PendingRequest = {
      id: 'cancellable-request',
      url: 'https://api.example.com/slow-endpoint',
      method: 'GET',
      status: 'pending',
      startedAt: new Date(),
    };

    const cancelRequest = fixture.simulatePendingRequest(request);

    console.log('Request status before cancel:', request.status);

    // Cancel the request
    cancelRequest();

    console.log('Request status after cancel:', request.status);

    return fixture.getPendingRequests();
  } finally {
    await fixture.teardown();
  }
}

/**
 * Example 9: Custom validation
 */
export async function exampleCustomValidation() {
  const fixture = new LoadingStateFixture();

  const config: LoadingFixtureConfig = {
    name: 'Validation Test',
    description: 'Test custom validation',
    scenario: 'progressive-load',
    expectedDuration: 1000,
    timeout: 5000,
  };

  try {
    await fixture.setup(config);

    // Perform operations
    fixture.startLoading({ initialProgress: 25 });

    // Custom validation
    const validation = await fixture.validate();

    if (!validation.valid) {
      console.log('Validation errors:', validation.errors);
      throw new Error('Fixture validation failed');
    }

    console.log('Validation passed');
    return true;
  } finally {
    await fixture.teardown();
  }
}

// ============================================================================
// Performance and Memory Usage Examples
// ============================================================================

/**
 * Example 10: Performance testing
 */
export async function examplePerformanceTesting() {
  const iterations = 100;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    const fixture = new LoadingStateFixture();

    const config: LoadingFixtureConfig = {
      name: `Perf Test ${i}`,
      description: `Performance test iteration ${i}`,
      scenario: 'api-request',
      expectedDuration: 100,
    };

    try {
      await fixture.setup(config);
      fixture.startLoading();
      fixture.finishLoading({ success: true });
    } finally {
      await fixture.teardown();
    }
  }

  const endTime = Date.now();
  const avgTimePerIteration = (endTime - startTime) / iterations;

  console.log(`Performance test completed:`);
  console.log(`- Iterations: ${iterations}`);
  console.log(`- Total time: ${endTime - startTime}ms`);
  console.log(`- Average time per iteration: ${avgTimePerIteration.toFixed(2)}ms`);

  return {
    iterations,
    totalTime: endTime - startTime,
    avgTime: avgTimePerIteration,
  };
}

// ============================================================================
// Export all examples for easy testing
// ============================================================================

export const examples = {
  basicUsage: exampleBasicUsage,
  predefinedScenarios: examplePredefinedScenarios,
  multipleRequests: exampleMultipleRequests,
  testHooks: exampleTestHooks,
  withWrapper: exampleWithWrapper,
  multiScenario: exampleMultiScenario,
  errorHandling: exampleErrorHandling,
  requestCancellation: exampleRequestCancellation,
  customValidation: exampleCustomValidation,
  performanceTesting: examplePerformanceTesting,
};

/**
 * Run all examples (for validation)
 */
export async function runAllExamples() {
  console.log('Running LoadingStateFixture examples...\n');

  const results = [];

  try {
    console.log('1. Basic Usage');
    const basicResult = await exampleBasicUsage();
    results.push({ name: 'basicUsage', success: true, result: basicResult });
    console.log('✓ Basic usage example completed\n');

    console.log('2. Predefined Scenarios');
    const scenarioResult = await examplePredefinedScenarios();
    results.push({ name: 'predefinedScenarios', success: true, result: scenarioResult });
    console.log('✓ Predefined scenarios example completed\n');

    console.log('3. Multiple Requests');
    const multiResult = await exampleMultipleRequests();
    results.push({ name: 'multipleRequests', success: true, result: multiResult });
    console.log('✓ Multiple requests example completed\n');

    console.log('4. Multi-Scenario Factory');
    const factoryResult = await exampleMultiScenario();
    results.push({ name: 'multiScenario', success: true, result: factoryResult });
    console.log('✓ Multi-scenario example completed\n');

    console.log('5. Error Handling');
    const errorResult = await exampleErrorHandling();
    results.push({ name: 'errorHandling', success: true, result: errorResult });
    console.log('✓ Error handling example completed\n');

    console.log('6. Request Cancellation');
    const cancelResult = await exampleRequestCancellation();
    results.push({ name: 'requestCancellation', success: true, result: cancelResult });
    console.log('✓ Request cancellation example completed\n');

    console.log('7. Custom Validation');
    const validationResult = await exampleCustomValidation();
    results.push({ name: 'customValidation', success: true, result: validationResult });
    console.log('✓ Custom validation example completed\n');

    console.log('8. Performance Testing');
    const perfResult = await examplePerformanceTesting();
    results.push({ name: 'performanceTesting', success: true, result: perfResult });
    console.log('✓ Performance testing example completed\n');

    console.log('All examples completed successfully! ✨');
    return results;

  } catch (error) {
    console.error('Example failed:', error);
    throw error;
  }
}

// Default export for easy importing
export default {
  LoadingStateFixture,
  examples,
  runAllExamples,
};