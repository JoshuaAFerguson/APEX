/**
 * @apexcli/browser/mocks - Scenario Builder Tests
 */

import { describe, it, expect } from 'vitest';
import { createMockScenario, commonScenarios } from '../scenario-builder.js';

describe('createMockScenario', () => {
  it('should create empty scenario', () => {
    const scenario = createMockScenario().build();

    expect(scenario).toEqual({
      operations: {},
      urlBehaviors: {},
      elementBehaviors: {},
    });
  });

  it('should configure URL behaviors', () => {
    const scenario = createMockScenario()
      .forUrl('https://example.com')
        .loadTime(1500)
        .withTitle('Example Page')
      .and()
      .build();

    expect(scenario.urlBehaviors).toEqual({
      'https://example.com': {
        loadTime: 1500,
        title: 'Example Page',
      },
    });
  });

  it('should configure URL failure behavior', () => {
    const scenario = createMockScenario()
      .forUrl('https://broken.com')
        .fails('Network timeout')
      .and()
      .build();

    expect(scenario.urlBehaviors).toEqual({
      'https://broken.com': {
        shouldFail: true,
        error: 'Network timeout',
      },
    });
  });

  it('should configure multiple URL behaviors', () => {
    const scenario = createMockScenario()
      .forUrl('https://fast.com')
        .loadTime(100)
      .and()
      .forUrl('https://slow.com')
        .loadTime(3000)
        .withTitle('Slow Page')
      .and()
      .build();

    expect(scenario.urlBehaviors).toEqual({
      'https://fast.com': {
        loadTime: 100,
      },
      'https://slow.com': {
        loadTime: 3000,
        title: 'Slow Page',
      },
    });
  });

  it('should configure element behaviors', () => {
    const scenario = createMockScenario()
      .forElement('#submit-button')
        .exists()
        .visible()
        .enabled()
        .withText('Submit')
      .and()
      .build();

    expect(scenario.elementBehaviors).toEqual({
      '#submit-button': {
        exists: true,
        visible: true,
        enabled: true,
        text: 'Submit',
      },
    });
  });

  it('should configure element non-existence', () => {
    const scenario = createMockScenario()
      .forElement('#missing-element')
        .exists(false)
      .and()
      .build();

    expect(scenario.elementBehaviors).toEqual({
      '#missing-element': {
        exists: false,
      },
    });
  });

  it('should configure disabled element', () => {
    const scenario = createMockScenario()
      .forElement('#disabled-input')
        .exists()
        .visible()
        .enabled(false)
        .withValue('disabled value')
      .and()
      .build();

    expect(scenario.elementBehaviors).toEqual({
      '#disabled-input': {
        exists: true,
        visible: true,
        enabled: false,
        value: 'disabled value',
      },
    });
  });

  it('should configure operation behaviors', () => {
    const scenario = createMockScenario()
      .forOperation('screenshot')
        .succeeds({ data: 'mock-screenshot-data' })
        .withDelay(500)
      .and()
      .build();

    expect(scenario.operations).toEqual({
      screenshot: {
        success: true,
        returnValue: { data: 'mock-screenshot-data' },
        delay: 500,
      },
    });
  });

  it('should configure operation failure', () => {
    const scenario = createMockScenario()
      .forOperation('navigate')
        .fails('Navigation blocked')
        .withDelay(1000)
      .and()
      .build();

    expect(scenario.operations).toEqual({
      navigate: {
        success: false,
        error: 'Navigation blocked',
        delay: 1000,
      },
    });
  });

  it('should chain multiple configurations fluently', () => {
    const scenario = createMockScenario()
      .forUrl('https://test.com')
        .loadTime(800)
        .withTitle('Test Page')
      .and()
      .forElement('#username')
        .exists()
        .visible()
        .enabled()
        .withValue('')
      .and()
      .forElement('#password')
        .exists()
        .visible()
        .enabled()
      .and()
      .forOperation('login')
        .succeeds()
        .withDelay(200)
      .and()
      .build();

    expect(scenario.urlBehaviors?.['https://test.com']).toBeDefined();
    expect(scenario.elementBehaviors?.['#username']).toBeDefined();
    expect(scenario.elementBehaviors?.['#password']).toBeDefined();
    expect(scenario.operations?.['login']).toBeDefined();
  });

  it('should merge overlapping configurations', () => {
    const scenario = createMockScenario()
      .forElement('#button')
        .exists()
        .visible()
      .and()
      .forElement('#button')
        .enabled()
        .withText('Click Me')
      .and()
      .build();

    expect(scenario.elementBehaviors).toEqual({
      '#button': {
        exists: true,
        visible: true,
        enabled: true,
        text: 'Click Me',
      },
    });
  });

  it('should handle default values correctly', () => {
    const scenario = createMockScenario()
      .forElement('#checkbox')
        .exists() // Should default to true
        .visible() // Should default to true
        .enabled() // Should default to true
      .and()
      .build();

    expect(scenario.elementBehaviors).toEqual({
      '#checkbox': {
        exists: true,
        visible: true,
        enabled: true,
      },
    });
  });
});

describe('commonScenarios', () => {
  it('should provide fast success scenario', () => {
    const scenario = commonScenarios.fastSuccess();

    expect(scenario.operations).toEqual({
      '*': {
        success: true,
        delay: 10,
      },
    });
  });

  it('should provide navigation failure scenario', () => {
    const scenario = commonScenarios.navigationFailure('Custom error');

    expect(scenario.operations).toEqual({
      navigate: {
        success: false,
        error: 'Custom error',
      },
      '*': {
        success: true,
      },
    });
  });

  it('should provide navigation failure with default error', () => {
    const scenario = commonScenarios.navigationFailure();

    expect(scenario.operations?.navigate?.error).toBe('Network error');
  });

  it('should provide slow network scenario', () => {
    const scenario = commonScenarios.slowNetwork();

    expect(scenario.operations).toEqual({
      navigate: {
        delay: 3000,
      },
      screenshot: {
        delay: 1000,
      },
    });

    expect(scenario.urlBehaviors).toEqual({
      '*': {
        loadTime: 2500,
      },
    });
  });

  it('should provide elements not found scenario', () => {
    const selectors = ['#missing1', '.missing2', 'button[missing]'];
    const scenario = commonScenarios.elementsNotFound(selectors);

    expect(scenario.elementBehaviors).toEqual({
      '#missing1': { exists: false },
      '.missing2': { exists: false },
      'button[missing]': { exists: false },
    });
  });

  it('should provide form interaction scenario', () => {
    const scenario = commonScenarios.formInteraction('#contact-form');

    expect(scenario.elementBehaviors).toEqual({
      '#contact-form input': {
        exists: true,
        visible: true,
        enabled: true,
      },
      '#contact-form button': {
        exists: true,
        visible: true,
        enabled: true,
        text: 'Submit',
      },
    });
  });
});

describe('scenario integration', () => {
  it('should create complex scenario with multiple types', () => {
    const scenario = createMockScenario()
      // URL behaviors
      .forUrl('https://app.example.com/login')
        .loadTime(1200)
        .withTitle('Login Page')
      .and()
      .forUrl('https://app.example.com/dashboard')
        .loadTime(800)
        .withTitle('Dashboard')
      .and()
      // Element behaviors
      .forElement('#login-form input[name="username"]')
        .exists()
        .visible()
        .enabled()
        .withValue('')
      .and()
      .forElement('#login-form input[name="password"]')
        .exists()
        .visible()
        .enabled()
      .and()
      .forElement('#login-form button[type="submit"]')
        .exists()
        .visible()
        .enabled()
        .withText('Sign In')
      .and()
      // Operation behaviors
      .forOperation('login')
        .succeeds()
        .withDelay(1500)
      .and()
      .forOperation('captureScreenshot')
        .succeeds({ format: 'png', quality: 90 })
        .withDelay(300)
      .and()
      .build();

    // Verify all configurations are present
    expect(Object.keys(scenario.urlBehaviors || {})).toHaveLength(2);
    expect(Object.keys(scenario.elementBehaviors || {})).toHaveLength(3);
    expect(Object.keys(scenario.operations || {})).toHaveLength(2);

    // Verify specific configurations
    expect(scenario.urlBehaviors?.['https://app.example.com/login']?.loadTime).toBe(1200);
    expect(scenario.elementBehaviors?.['#login-form button[type="submit"]']?.text).toBe('Sign In');
    expect(scenario.operations?.['login']?.delay).toBe(1500);
  });
});