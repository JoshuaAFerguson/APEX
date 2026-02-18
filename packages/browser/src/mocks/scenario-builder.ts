/**
 * @apexcli/browser/mocks - Mock Scenario Builder
 *
 * Builder pattern for creating complex mock scenarios with fluent API
 */

import type {
  MockScenarioConfig,
  MockScenarioBuilder,
  MockUrlBehavior,
  MockElementBehavior,
  MockOperationBehavior,
} from './types.js';

/**
 * Implementation of MockUrlBehavior
 */
class MockUrlBehaviorImpl implements MockUrlBehavior {
  constructor(
    private url: string,
    private builder: MockScenarioBuilderImpl
  ) {}

  loadTime(ms: number): MockUrlBehavior {
    this.builder.addUrlBehavior(this.url, { loadTime: ms });
    return this;
  }

  fails(error = 'Navigation failed'): MockUrlBehavior {
    this.builder.addUrlBehavior(this.url, { shouldFail: true, error });
    return this;
  }

  withContent(content: string): MockUrlBehavior {
    // Store content for later use (could be extended)
    this.builder.addUrlBehavior(this.url, { content } as any);
    return this;
  }

  withTitle(title: string): MockUrlBehavior {
    // Store title for later use (could be extended)
    this.builder.addUrlBehavior(this.url, { title } as any);
    return this;
  }

  and(): MockScenarioBuilder {
    return this.builder;
  }
}

/**
 * Implementation of MockElementBehavior
 */
class MockElementBehaviorImpl implements MockElementBehavior {
  constructor(
    private selector: string,
    private builder: MockScenarioBuilderImpl
  ) {}

  exists(exists = true): MockElementBehavior {
    this.builder.addElementBehavior(this.selector, { exists });
    return this;
  }

  visible(visible = true): MockElementBehavior {
    this.builder.addElementBehavior(this.selector, { visible });
    return this;
  }

  enabled(enabled = true): MockElementBehavior {
    this.builder.addElementBehavior(this.selector, { enabled });
    return this;
  }

  withText(text: string): MockElementBehavior {
    this.builder.addElementBehavior(this.selector, { text });
    return this;
  }

  withValue(value: string): MockElementBehavior {
    this.builder.addElementBehavior(this.selector, { value });
    return this;
  }

  and(): MockScenarioBuilder {
    return this.builder;
  }
}

/**
 * Implementation of MockOperationBehavior
 */
class MockOperationBehaviorImpl implements MockOperationBehavior {
  constructor(
    private operationName: string,
    private builder: MockScenarioBuilderImpl
  ) {}

  succeeds(returnValue?: any): MockOperationBehavior {
    this.builder.addOperationBehavior(this.operationName, {
      success: true,
      returnValue,
    });
    return this;
  }

  fails(error: string): MockOperationBehavior {
    this.builder.addOperationBehavior(this.operationName, {
      success: false,
      error,
    });
    return this;
  }

  withDelay(ms: number): MockOperationBehavior {
    this.builder.addOperationBehavior(this.operationName, { delay: ms });
    return this;
  }

  and(): MockScenarioBuilder {
    return this.builder;
  }
}

/**
 * Implementation of MockScenarioBuilder
 */
class MockScenarioBuilderImpl implements MockScenarioBuilder {
  private config: MockScenarioConfig = {
    operations: {},
    urlBehaviors: {},
    elementBehaviors: {},
  };

  forUrl(url: string): MockUrlBehavior {
    return new MockUrlBehaviorImpl(url, this);
  }

  forElement(selector: string): MockElementBehavior {
    return new MockElementBehaviorImpl(selector, this);
  }

  forOperation(operationName: string): MockOperationBehavior {
    return new MockOperationBehaviorImpl(operationName, this);
  }

  build(): MockScenarioConfig {
    return { ...this.config };
  }

  // Internal methods for behavior implementations
  addUrlBehavior(url: string, behavior: any): void {
    this.config.urlBehaviors = this.config.urlBehaviors || {};
    this.config.urlBehaviors[url] = {
      ...this.config.urlBehaviors[url],
      ...behavior,
    };
  }

  addElementBehavior(selector: string, behavior: any): void {
    this.config.elementBehaviors = this.config.elementBehaviors || {};
    this.config.elementBehaviors[selector] = {
      ...this.config.elementBehaviors[selector],
      ...behavior,
    };
  }

  addOperationBehavior(operationName: string, behavior: any): void {
    this.config.operations = this.config.operations || {};
    this.config.operations[operationName] = {
      ...this.config.operations[operationName],
      ...behavior,
    };
  }
}

/**
 * Creates a new mock scenario builder
 *
 * @returns A new scenario builder instance
 *
 * @example
 * ```typescript
 * const scenario = createMockScenario()
 *   .forUrl('https://example.com')
 *     .loadTime(1000)
 *     .withTitle('Example Page')
 *   .and()
 *   .forElement('#submit-button')
 *     .exists()
 *     .visible()
 *     .enabled()
 *   .and()
 *   .forOperation('screenshot')
 *     .succeeds({ data: 'mock-image-data' })
 *     .withDelay(500)
 *   .build();
 * ```
 */
export function createMockScenario(): MockScenarioBuilder {
  return new MockScenarioBuilderImpl();
}

/**
 * Predefined common scenarios for quick setup
 */
export const commonScenarios = {
  /**
   * Scenario where all operations succeed quickly
   */
  fastSuccess: (): MockScenarioConfig =>
    createMockScenario()
      .forOperation('*')
        .succeeds()
        .withDelay(10)
      .build(),

  /**
   * Scenario where navigation fails but other operations succeed
   */
  navigationFailure: (error = 'Network error'): MockScenarioConfig =>
    createMockScenario()
      .forOperation('navigate')
        .fails(error)
      .and()
      .forOperation('*')
        .succeeds()
      .build(),

  /**
   * Scenario simulating slow network conditions
   */
  slowNetwork: (): MockScenarioConfig =>
    createMockScenario()
      .forOperation('navigate')
        .withDelay(3000)
      .and()
      .forOperation('screenshot')
        .withDelay(1000)
      .and()
      .forUrl('*')
        .loadTime(2500)
      .build(),

  /**
   * Scenario where elements are not found
   */
  elementsNotFound: (selectors: string[]): MockScenarioConfig => {
    const builder = createMockScenario();
    selectors.forEach(selector => {
      builder.forElement(selector).exists(false);
    });
    return builder.build();
  },

  /**
   * Scenario for form interactions
   */
  formInteraction: (formSelector: string): MockScenarioConfig =>
    createMockScenario()
      .forElement(`${formSelector} input`)
        .exists()
        .visible()
        .enabled()
      .and()
      .forElement(`${formSelector} button`)
        .exists()
        .visible()
        .enabled()
        .withText('Submit')
      .build(),
};