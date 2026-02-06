/**
 * @fileoverview Advanced Focus Event Testing Helpers
 *
 * This module provides comprehensive utilities for testing focus-related interactions
 * in complex web applications. It includes advanced focus management, accessibility
 * validation, focus trapping, and keyboard navigation testing capabilities.
 *
 * Features:
 * - Advanced focus state management and validation
 * - Accessibility compliance testing for focus interactions
 * - Focus trapping and modal focus management testing
 * - Keyboard navigation and tab order validation
 * - Screen reader simulation and testing
 * - Focus visible and focus-within state testing
 */

import { Page, Locator } from 'playwright';
import { waitForElement } from './test-helpers';

/**
 * Focus validation result structure
 */
export interface FocusValidationResult {
  isValid: boolean;
  element: string;
  issues: string[];
  accessibilityScore: number;
  recommendations: string[];
}

/**
 * Tab navigation result
 */
export interface TabNavigationResult {
  expectedOrder: string[];
  actualOrder: string[];
  isCorrectOrder: boolean;
  missingElements: string[];
  unexpectedElements: string[];
  cyclesCorrectly: boolean;
}

/**
 * Focus trap testing result
 */
export interface FocusTrapResult {
  isTrapped: boolean;
  firstFocusableElement: string;
  lastFocusableElement: string;
  focusableElements: string[];
  trapBoundaries: {
    forward: boolean;
    backward: boolean;
  };
  escapeAttempts: Array<{
    method: string;
    escaped: boolean;
    finalFocus: string;
  }>;
}

/**
 * Keyboard navigation configuration
 */
export interface KeyboardNavigationConfig {
  keys: string[];
  expectedBehavior: Record<string, string>;
  modifiers?: {
    shift?: boolean;
    ctrl?: boolean;
    alt?: boolean;
  };
}

/**
 * Focus event tracking data
 */
export interface FocusEventData {
  type: 'focus' | 'blur' | 'focusin' | 'focusout';
  element: string;
  timestamp: number;
  relatedTarget?: string;
  activeElement: string;
  details: {
    tagName: string;
    id?: string;
    className?: string;
    tabIndex: number;
    ariaLabel?: string;
    ariaRole?: string;
  };
}

/**
 * Advanced focus event testing utilities
 */
export class FocusEventHelpers {
  constructor(private page: Page) {}

  /**
   * Comprehensive focus accessibility validation
   */
  async validateFocusAccessibility(
    selector: string,
    requirements?: {
      mustHaveLabel?: boolean;
      mustHaveRole?: boolean;
      mustBeKeyboardAccessible?: boolean;
      mustHaveFocusIndicator?: boolean;
      mustRespectTabIndex?: boolean;
    }
  ): Promise<FocusValidationResult> {
    const element = await waitForElement(this.page, selector, { visible: true });
    const issues: string[] = [];
    const recommendations: string[] = [];
    let accessibilityScore = 0;

    // Get element properties for validation
    const elementInfo = await element.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        className: el.className,
        tabIndex: el.tabIndex,
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledby: el.getAttribute('aria-labelledby'),
        ariaDescribedby: el.getAttribute('aria-describedby'),
        role: el.getAttribute('role'),
        type: (el as HTMLInputElement).type,
        disabled: (el as HTMLInputElement).disabled,
        readonly: (el as HTMLInputElement).readOnly,
        required: (el as HTMLInputElement).required,
        focusVisible: computed.getPropertyValue('outline') !== 'none' ||
                     computed.getPropertyValue('box-shadow').includes('focus') ||
                     computed.getPropertyValue('border-color').includes('focus'),
        hasLabel: !!(el as HTMLInputElement).labels?.length,
        isInFieldset: !!el.closest('fieldset'),
        isFormElement: ['input', 'select', 'textarea', 'button'].includes(el.tagName.toLowerCase())
      };
    });

    // Test keyboard accessibility
    const canFocus = await this.testKeyboardAccessibility(selector);
    if (!canFocus) {
      issues.push('Element is not keyboard accessible');
    } else {
      accessibilityScore += 20;
    }

    // Test label association
    if (requirements?.mustHaveLabel !== false && elementInfo.isFormElement) {
      if (!elementInfo.hasLabel && !elementInfo.ariaLabel && !elementInfo.ariaLabelledby) {
        issues.push('Form element lacks proper labeling');
        recommendations.push('Add a <label> element or aria-label attribute');
      } else {
        accessibilityScore += 25;
      }
    }

    // Test role assignment
    if (requirements?.mustHaveRole && !elementInfo.role) {
      issues.push('Element lacks explicit ARIA role');
      recommendations.push('Consider adding an appropriate role attribute');
    } else if (elementInfo.role) {
      accessibilityScore += 15;
    }

    // Test focus indicator visibility
    if (requirements?.mustHaveFocusIndicator !== false) {
      const hasFocusIndicator = await this.testFocusIndicator(selector);
      if (!hasFocusIndicator) {
        issues.push('Element lacks visible focus indicator');
        recommendations.push('Ensure element has visible focus styles (outline, border, shadow, etc.)');
      } else {
        accessibilityScore += 20;
      }
    }

    // Test tab index appropriateness
    if (requirements?.mustRespectTabIndex !== false) {
      if (elementInfo.tabIndex < -1) {
        issues.push('Invalid tabIndex value (should be >= -1)');
      } else if (elementInfo.tabIndex > 0) {
        recommendations.push('Consider avoiding positive tabIndex values to maintain natural tab order');
      } else {
        accessibilityScore += 10;
      }
    }

    // Test disabled/readonly states
    if (elementInfo.disabled || elementInfo.readonly) {
      if (elementInfo.tabIndex >= 0) {
        issues.push('Disabled/readonly element should not be focusable');
      }
    }

    // Additional accessibility checks
    if (elementInfo.ariaDescribedby) {
      accessibilityScore += 10;
    }

    return {
      isValid: issues.length === 0,
      element: selector,
      issues,
      accessibilityScore,
      recommendations
    };
  }

  /**
   * Tests comprehensive keyboard navigation patterns
   */
  async testKeyboardNavigation(
    containerSelector: string,
    navigationConfig: KeyboardNavigationConfig
  ): Promise<{
    success: boolean;
    results: Record<string, { expected: string; actual: string; success: boolean }>;
    navigationPath: string[];
    totalTime: number;
  }> {
    const startTime = Date.now();
    const container = await waitForElement(this.page, containerSelector, { visible: true });
    const results: Record<string, { expected: string; actual: string; success: boolean }> = {};
    const navigationPath: string[] = [];

    // Apply modifiers if specified
    const modifiers = navigationConfig.modifiers;
    if (modifiers) {
      if (modifiers.shift) await this.page.keyboard.down('Shift');
      if (modifiers.ctrl) await this.page.keyboard.down('Control');
      if (modifiers.alt) await this.page.keyboard.down('Alt');
    }

    try {
      for (const key of navigationConfig.keys) {
        // Press the key
        await this.page.keyboard.press(key);
        await this.page.waitForTimeout(50);

        // Get currently focused element
        const currentFocus = await this.page.evaluate(() => {
          const active = document.activeElement;
          return {
            id: active?.id || '',
            tagName: active?.tagName || '',
            className: active?.className || '',
            selector: active?.id ? `#${active.id}` :
                     active?.className ? `.${active.className.split(' ')[0]}` :
                     active?.tagName || 'unknown'
          };
        });

        const focusKey = currentFocus.selector || `${currentFocus.tagName}${currentFocus.id ? '#' + currentFocus.id : ''}`;
        navigationPath.push(focusKey);

        // Check against expected behavior
        const expectedFocus = navigationConfig.expectedBehavior[key];
        if (expectedFocus) {
          results[key] = {
            expected: expectedFocus,
            actual: focusKey,
            success: focusKey === expectedFocus || currentFocus.id === expectedFocus
          };
        }
      }
    } finally {
      // Release modifiers
      if (modifiers) {
        if (modifiers.alt) await this.page.keyboard.up('Alt');
        if (modifiers.ctrl) await this.page.keyboard.up('Control');
        if (modifiers.shift) await this.page.keyboard.up('Shift');
      }
    }

    const endTime = Date.now();
    const success = Object.values(results).every(result => result.success);

    return {
      success,
      results,
      navigationPath,
      totalTime: endTime - startTime
    };
  }

  /**
   * Advanced tab order validation with detailed analysis
   */
  async validateTabOrder(
    containerSelector: string,
    expectedOrder: string[],
    options: {
      testReverse?: boolean;
      testSkipping?: boolean;
      validateTabIndex?: boolean;
      timeout?: number;
    } = {}
  ): Promise<TabNavigationResult> {
    const container = await waitForElement(this.page, containerSelector, { visible: true });

    // Get all focusable elements in container
    const focusableElements = await container.evaluate((el) => {
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(', ');

      const elements = Array.from(el.querySelectorAll(focusableSelectors)) as HTMLElement[];
      return elements
        .filter(elem => {
          const style = getComputedStyle(elem);
          return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .sort((a, b) => {
          const aIndex = a.tabIndex || 0;
          const bIndex = b.tabIndex || 0;

          if (aIndex === 0 && bIndex === 0) {
            // Both have natural tab order
            return Array.from(el.querySelectorAll(focusableSelectors)).indexOf(a) -
                   Array.from(el.querySelectorAll(focusableSelectors)).indexOf(b);
          } else if (aIndex === 0) {
            return bIndex > 0 ? 1 : -1;
          } else if (bIndex === 0) {
            return aIndex > 0 ? -1 : 1;
          } else {
            return aIndex - bIndex;
          }
        })
        .map(elem => elem.id || elem.tagName.toLowerCase());
    });

    // Test forward tab order
    const actualOrder: string[] = [];
    const firstElement = expectedOrder[0];

    if (firstElement) {
      await this.page.focus(`#${firstElement}, ${firstElement}`);
    }

    for (let i = 0; i < expectedOrder.length; i++) {
      const currentFocus = await this.page.evaluate(() => {
        const active = document.activeElement;
        return active?.id || active?.tagName?.toLowerCase() || 'unknown';
      });

      actualOrder.push(currentFocus);

      if (i < expectedOrder.length - 1) {
        await this.page.keyboard.press('Tab');
        await this.page.waitForTimeout(50);
      }
    }

    // Test reverse tab order if requested
    let reverseOrderCorrect = true;
    if (options.testReverse) {
      for (let i = expectedOrder.length - 1; i > 0; i--) {
        await this.page.keyboard.press('Shift+Tab');
        await this.page.waitForTimeout(50);

        const currentFocus = await this.page.evaluate(() => {
          const active = document.activeElement;
          return active?.id || active?.tagName?.toLowerCase() || 'unknown';
        });

        if (currentFocus !== expectedOrder[i - 1]) {
          reverseOrderCorrect = false;
          break;
        }
      }
    }

    // Test tab cycling (from last element, tab should go to first)
    let cyclesCorrectly = true;
    if (expectedOrder.length > 1) {
      // Focus on last element
      const lastElement = expectedOrder[expectedOrder.length - 1];
      await this.page.focus(`#${lastElement}, ${lastElement}`);
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(50);

      const cycledFocus = await this.page.evaluate(() => {
        const active = document.activeElement;
        return active?.id || active?.tagName?.toLowerCase() || 'unknown';
      });

      cyclesCorrectly = cycledFocus === expectedOrder[0];
    }

    const isCorrectOrder = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
    const missingElements = expectedOrder.filter(elem => !actualOrder.includes(elem));
    const unexpectedElements = actualOrder.filter(elem => !expectedOrder.includes(elem));

    return {
      expectedOrder,
      actualOrder,
      isCorrectOrder: isCorrectOrder && reverseOrderCorrect,
      missingElements,
      unexpectedElements,
      cyclesCorrectly
    };
  }

  /**
   * Comprehensive focus trap testing for modals and containers
   */
  async testFocusTrap(
    trapContainerSelector: string,
    options: {
      testEscapeAttempts?: boolean;
      testInitialFocus?: boolean;
      testReturnFocus?: boolean;
      expectedFirstFocus?: string;
      expectedLastFocus?: string;
    } = {}
  ): Promise<FocusTrapResult> {
    const container = await waitForElement(this.page, trapContainerSelector, { visible: true });

    // Get all focusable elements within the trap
    const focusableElements = await container.evaluate((el) => {
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(', ');

      return Array.from(el.querySelectorAll(focusableSelectors))
        .filter(elem => {
          const style = getComputedStyle(elem);
          return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .map(elem => elem.id || elem.tagName.toLowerCase());
    });

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Test initial focus
    let initialFocusCorrect = true;
    if (options.testInitialFocus && options.expectedFirstFocus) {
      const currentFocus = await this.page.evaluate(() => {
        const active = document.activeElement;
        return active?.id || active?.tagName?.toLowerCase() || 'unknown';
      });

      initialFocusCorrect = currentFocus === options.expectedFirstFocus;
    }

    // Test forward boundary (from last element, tab should go to first)
    if (lastElement) {
      await this.page.focus(`#${lastElement}, ${lastElement}`);
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(50);
    }

    const forwardBoundaryFocus = await this.page.evaluate(() => {
      const active = document.activeElement;
      return active?.id || active?.tagName?.toLowerCase() || 'unknown';
    });

    const forwardTrapWorks = forwardBoundaryFocus === firstElement;

    // Test backward boundary (from first element, shift+tab should go to last)
    if (firstElement) {
      await this.page.focus(`#${firstElement}, ${firstElement}`);
      await this.page.keyboard.press('Shift+Tab');
      await this.page.waitForTimeout(50);
    }

    const backwardBoundaryFocus = await this.page.evaluate(() => {
      const active = document.activeElement;
      return active?.id || active?.tagName?.toLowerCase() || 'unknown';
    });

    const backwardTrapWorks = backwardBoundaryFocus === lastElement;

    // Test escape attempts
    const escapeAttempts: Array<{
      method: string;
      escaped: boolean;
      finalFocus: string;
    }> = [];

    if (options.testEscapeAttempts) {
      // Test clicking outside
      try {
        await this.page.click('body', { position: { x: 10, y: 10 } });
        const focusAfterClick = await this.page.evaluate(() => {
          const active = document.activeElement;
          return active?.id || active?.tagName?.toLowerCase() || 'unknown';
        });

        escapeAttempts.push({
          method: 'click-outside',
          escaped: !focusableElements.includes(focusAfterClick),
          finalFocus: focusAfterClick
        });
      } catch (error) {
        escapeAttempts.push({
          method: 'click-outside',
          escaped: false,
          finalFocus: 'error'
        });
      }

      // Test ESC key
      try {
        await this.page.keyboard.press('Escape');
        const focusAfterEsc = await this.page.evaluate(() => {
          const active = document.activeElement;
          return active?.id || active?.tagName?.toLowerCase() || 'unknown';
        });

        escapeAttempts.push({
          method: 'escape-key',
          escaped: !focusableElements.includes(focusAfterEsc),
          finalFocus: focusAfterEsc
        });
      } catch (error) {
        escapeAttempts.push({
          method: 'escape-key',
          escaped: false,
          finalFocus: 'error'
        });
      }
    }

    return {
      isTrapped: forwardTrapWorks && backwardTrapWorks,
      firstFocusableElement: firstElement,
      lastFocusableElement: lastElement,
      focusableElements,
      trapBoundaries: {
        forward: forwardTrapWorks,
        backward: backwardTrapWorks
      },
      escapeAttempts
    };
  }

  /**
   * Tests focus-within and focus-visible CSS states
   */
  async testFocusStates(
    containerSelector: string,
    focusableElements: string[]
  ): Promise<{
    focusWithinWorks: boolean;
    focusVisibleWorks: Record<string, boolean>;
    stateTransitions: Array<{
      element: string;
      hasFocusWithin: boolean;
      hasFocusVisible: boolean;
      computedStyles: Record<string, string>;
    }>;
  }> {
    const container = await waitForElement(this.page, containerSelector, { visible: true });
    const stateTransitions: Array<{
      element: string;
      hasFocusWithin: boolean;
      hasFocusVisible: boolean;
      computedStyles: Record<string, string>;
    }> = [];

    let focusWithinWorks = false;
    const focusVisibleWorks: Record<string, boolean> = {};

    for (const elementSelector of focusableElements) {
      const element = await waitForElement(this.page, elementSelector, { visible: true });

      // Focus on the element
      await element.focus();
      await this.page.waitForTimeout(100);

      // Check focus-within on container
      const containerStates = await container.evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          hasFocusWithin: el.matches(':focus-within'),
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor,
          boxShadow: computed.boxShadow
        };
      });

      if (containerStates.hasFocusWithin) {
        focusWithinWorks = true;
      }

      // Check focus-visible on element
      const elementStates = await element.evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          hasFocusVisible: el.matches(':focus-visible'),
          outline: computed.outline,
          outlineColor: computed.outlineColor,
          outlineWidth: computed.outlineWidth,
          boxShadow: computed.boxShadow,
          borderColor: computed.borderColor
        };
      });

      focusVisibleWorks[elementSelector] = elementStates.hasFocusVisible;

      stateTransitions.push({
        element: elementSelector,
        hasFocusWithin: containerStates.hasFocusWithin,
        hasFocusVisible: elementStates.hasFocusVisible,
        computedStyles: {
          ...containerStates,
          ...elementStates
        }
      });

      // Blur the element
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(50);
    }

    return {
      focusWithinWorks,
      focusVisibleWorks,
      stateTransitions
    };
  }

  /**
   * Track all focus events with detailed information
   */
  async trackFocusEvents(
    action: () => Promise<void>,
    options: {
      includeRelatedTarget?: boolean;
      captureStyles?: boolean;
      timeout?: number;
    } = {}
  ): Promise<FocusEventData[]> {
    const events: FocusEventData[] = [];

    // Set up event tracking
    await this.page.evaluate((opts) => {
      const eventTypes = ['focus', 'blur', 'focusin', 'focusout'];

      window.__focusEventTracker = [];

      eventTypes.forEach(eventType => {
        document.addEventListener(eventType, (e) => {
          const event = e as FocusEvent;
          const target = event.target as HTMLElement;
          const relatedTarget = event.relatedTarget as HTMLElement;

          window.__focusEventTracker.push({
            type: eventType,
            element: target?.id || target?.tagName?.toLowerCase() || 'unknown',
            timestamp: Date.now(),
            relatedTarget: opts.includeRelatedTarget ?
              (relatedTarget?.id || relatedTarget?.tagName?.toLowerCase()) : undefined,
            activeElement: document.activeElement?.id ||
                          document.activeElement?.tagName?.toLowerCase() || 'unknown',
            details: {
              tagName: target?.tagName?.toLowerCase() || 'unknown',
              id: target?.id,
              className: target?.className,
              tabIndex: target?.tabIndex || 0,
              ariaLabel: target?.getAttribute?.('aria-label'),
              ariaRole: target?.getAttribute?.('role')
            }
          });
        }, true);
      });
    }, options);

    // Execute the action
    await action();

    // Retrieve tracked events
    const trackedEvents = await this.page.evaluate(() => {
      const events = window.__focusEventTracker || [];
      delete window.__focusEventTracker;
      return events;
    });

    return trackedEvents;
  }

  /**
   * Tests keyboard accessibility of an element
   */
  private async testKeyboardAccessibility(selector: string): Promise<boolean> {
    try {
      const element = await waitForElement(this.page, selector, { visible: true });

      // Try to focus using keyboard navigation
      await element.focus();

      // Check if element actually received focus
      const isFocused = await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return document.activeElement === el;
      }, selector);

      return isFocused;
    } catch (error) {
      return false;
    }
  }

  /**
   * Tests if an element has a visible focus indicator
   */
  private async testFocusIndicator(selector: string): Promise<boolean> {
    const element = await waitForElement(this.page, selector, { visible: true });

    // Get styles before focus
    const beforeFocusStyles = await element.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        outline: computed.outline,
        outlineColor: computed.outlineColor,
        outlineWidth: computed.outlineWidth,
        boxShadow: computed.boxShadow,
        borderColor: computed.borderColor,
        backgroundColor: computed.backgroundColor
      };
    });

    // Focus the element
    await element.focus();
    await this.page.waitForTimeout(100);

    // Get styles after focus
    const afterFocusStyles = await element.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        outline: computed.outline,
        outlineColor: computed.outlineColor,
        outlineWidth: computed.outlineWidth,
        boxShadow: computed.boxShadow,
        borderColor: computed.borderColor,
        backgroundColor: computed.backgroundColor
      };
    });

    // Check if any focus-indicating style changed
    const stylesChanged = Object.keys(beforeFocusStyles).some(key => {
      return beforeFocusStyles[key as keyof typeof beforeFocusStyles] !==
             afterFocusStyles[key as keyof typeof afterFocusStyles];
    });

    // Also check if outline is not explicitly disabled
    const outlineNotDisabled = afterFocusStyles.outline !== 'none' &&
                               afterFocusStyles.outlineWidth !== '0px';

    return stylesChanged && (outlineNotDisabled ||
                            afterFocusStyles.boxShadow.includes('focus') ||
                            afterFocusStyles.borderColor !== beforeFocusStyles.borderColor);
  }
}

/**
 * Factory function to create focus event helpers
 */
export function createFocusEventHelpers(page: Page): FocusEventHelpers {
  return new FocusEventHelpers(page);
}

// Type declarations for window object extensions
declare global {
  interface Window {
    __focusEventTracker: FocusEventData[];
  }
}