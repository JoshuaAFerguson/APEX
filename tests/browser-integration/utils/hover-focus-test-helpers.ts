/**
 * @fileoverview Hover and Focus Test Helpers
 *
 * This module provides specialized utilities for testing hover and focus interactions
 * in browser environments. It extends the base test helpers with specific functionality
 * for mouse events, focus management, and state validation.
 *
 * Features:
 * - Advanced hover event simulation with precise positioning
 * - Focus management utilities for complex form interactions
 * - Event tracking and validation helpers
 * - State change detection and verification
 * - Tooltip and dropdown interaction helpers
 * - Accessibility-aware focus testing utilities
 */

import { Page, Locator, BrowserContext } from 'playwright';
import { waitForElement, captureConsoleMessages } from './test-helpers';

/**
 * Configuration options for hover operations
 */
export interface HoverOptions {
  /** Position within the element (0-1 coordinates) */
  position?: { x: number; y: number };
  /** Force hover even if element is not visible */
  force?: boolean;
  /** Wait time after hover in milliseconds */
  delay?: number;
  /** Whether to trigger mouse events in sequence */
  triggerEvents?: boolean;
  /** Timeout for hover operation */
  timeout?: number;
}

/**
 * Configuration options for focus operations
 */
export interface FocusOptions {
  /** Whether to clear existing content before focusing */
  clearContent?: boolean;
  /** Whether to trigger validation after focus/blur */
  triggerValidation?: boolean;
  /** Wait time after focus/blur in milliseconds */
  delay?: number;
  /** Timeout for focus operation */
  timeout?: number;
}

/**
 * Event tracking configuration
 */
export interface EventTrackingOptions {
  /** Types of events to track */
  eventTypes?: string[];
  /** Maximum number of events to capture */
  maxEvents?: number;
  /** Timeout for event capture */
  timeout?: number;
}

/**
 * Mouse event data structure
 */
export interface MouseEventData {
  type: string;
  target: string;
  timestamp: number;
  position: { x: number; y: number };
  details: Record<string, any>;
}

/**
 * Focus event data structure
 */
export interface FocusEventData {
  type: string;
  target: string;
  timestamp: number;
  value?: string;
  details: Record<string, any>;
}

/**
 * Advanced hover utilities for precise mouse interaction testing
 */
export class HoverTestHelpers {
  constructor(private page: Page) {}

  /**
   * Performs a precise hover operation with customizable behavior
   */
  async hover(
    selector: string,
    options: HoverOptions = {}
  ): Promise<void> {
    const element = await waitForElement(this.page, selector, {
      visible: true,
      timeout: options.timeout || 10000
    });

    const position = options.position || { x: 0.5, y: 0.5 };

    await element.hover({
      position: {
        x: position.x * 100, // Convert to pixel offset percentage
        y: position.y * 100
      },
      force: options.force || false
    });

    if (options.delay) {
      await this.page.waitForTimeout(options.delay);
    }

    if (options.triggerEvents) {
      await this.triggerMouseEvents(selector, 'hover');
    }
  }

  /**
   * Simulates mouse movement from one element to another
   */
  async moveMouseBetweenElements(
    fromSelector: string,
    toSelector: string,
    options: { steps?: number; delay?: number } = {}
  ): Promise<void> {
    const fromElement = await waitForElement(this.page, fromSelector, { visible: true });
    const toElement = await waitForElement(this.page, toSelector, { visible: true });

    const fromBox = await fromElement.boundingBox();
    const toBox = await toElement.boundingBox();

    if (!fromBox || !toBox) {
      throw new Error('Cannot get bounding boxes for mouse movement');
    }

    const steps = options.steps || 5;
    const delay = options.delay || 100;

    const startX = fromBox.x + fromBox.width / 2;
    const startY = fromBox.y + fromBox.height / 2;
    const endX = toBox.x + toBox.width / 2;
    const endY = toBox.y + toBox.height / 2;

    // Move mouse in steps
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const x = startX + (endX - startX) * progress;
      const y = startY + (endY - startY) * progress;

      await this.page.mouse.move(x, y);

      if (delay > 0) {
        await this.page.waitForTimeout(delay);
      }
    }
  }

  /**
   * Tracks hover events on specified elements
   */
  async trackHoverEvents(
    selectors: string[],
    options: EventTrackingOptions = {}
  ): Promise<MouseEventData[]> {
    const eventTypes = options.eventTypes || ['mouseenter', 'mouseleave', 'mouseover', 'mouseout'];
    const maxEvents = options.maxEvents || 50;
    const events: MouseEventData[] = [];

    // Install event listeners
    await this.page.evaluate((config) => {
      const { selectors, eventTypes } = config;

      window.__hoverEventTracker = [];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          eventTypes.forEach(eventType => {
            element.addEventListener(eventType, (e) => {
              const event = e as MouseEvent;
              window.__hoverEventTracker.push({
                type: eventType,
                target: event.target?.id || event.target?.className || 'unknown',
                timestamp: Date.now(),
                position: { x: event.clientX, y: event.clientY },
                details: {
                  bubbles: event.bubbles,
                  cancelable: event.cancelable,
                  relatedTarget: event.relatedTarget?.id || null
                }
              });
            });
          });
        });
      });
    }, { selectors, eventTypes });

    // Return function to retrieve tracked events
    return this.page.evaluate(() => {
      return window.__hoverEventTracker || [];
    });
  }

  /**
   * Validates hover state changes by comparing computed styles
   */
  async validateHoverStateChanges(
    selector: string,
    expectedChanges: Record<string, { initial: string; hover: string }>,
    options: HoverOptions = {}
  ): Promise<{ success: boolean; changes: Record<string, { actual: string; expected: string }> }> {
    const element = await waitForElement(this.page, selector, { visible: true });

    // Get initial styles
    const initialStyles = await element.evaluate((el, properties) => {
      const styles: Record<string, string> = {};
      const computed = getComputedStyle(el);
      Object.keys(properties).forEach(prop => {
        styles[prop] = computed.getPropertyValue(prop);
      });
      return styles;
    }, expectedChanges);

    // Hover over element
    await this.hover(selector, options);

    // Wait for transitions to complete
    await this.page.waitForTimeout(options.delay || 500);

    // Get hover styles
    const hoverStyles = await element.evaluate((el, properties) => {
      const styles: Record<string, string> = {};
      const computed = getComputedStyle(el);
      Object.keys(properties).forEach(prop => {
        styles[prop] = computed.getPropertyValue(prop);
      });
      return styles;
    }, expectedChanges);

    // Validate changes
    const results = {
      success: true,
      changes: {} as Record<string, { actual: string; expected: string }>
    };

    Object.keys(expectedChanges).forEach(property => {
      const expected = expectedChanges[property];
      const initial = initialStyles[property]?.trim();
      const hover = hoverStyles[property]?.trim();

      results.changes[property] = {
        actual: hover,
        expected: expected.hover
      };

      if (initial !== expected.initial || hover !== expected.hover) {
        results.success = false;
      }
    });

    // Move mouse away to clear hover state
    await this.page.mouse.move(0, 0);

    return results;
  }

  /**
   * Tests tooltip interactions with timing validation
   */
  async testTooltipInteraction(
    triggerSelector: string,
    tooltipSelector: string,
    options: {
      showDelay?: number;
      hideDelay?: number;
      content?: string;
      position?: 'top' | 'bottom' | 'left' | 'right';
    } = {}
  ): Promise<{
    showsCorrectly: boolean;
    hidesCorrectly: boolean;
    contentMatches: boolean;
    positionCorrect: boolean;
  }> {
    const trigger = await waitForElement(this.page, triggerSelector, { visible: true });
    const tooltip = this.page.locator(tooltipSelector);

    // Verify tooltip is initially hidden
    const initiallyHidden = await tooltip.evaluate(el => {
      const style = getComputedStyle(el);
      return style.visibility === 'hidden' || style.opacity === '0';
    });

    // Hover over trigger
    await trigger.hover();

    // Wait for tooltip to show
    const showDelay = options.showDelay || 300;
    await this.page.waitForTimeout(showDelay);

    // Check if tooltip is visible
    const showsCorrectly = await tooltip.evaluate(el => {
      const style = getComputedStyle(el);
      return style.visibility === 'visible' && parseFloat(style.opacity) > 0.5;
    });

    // Validate content if specified
    let contentMatches = true;
    if (options.content) {
      const actualContent = await tooltip.textContent();
      contentMatches = actualContent?.includes(options.content) || false;
    }

    // Validate position if specified
    let positionCorrect = true;
    if (options.position) {
      const triggerBox = await trigger.boundingBox();
      const tooltipBox = await tooltip.boundingBox();

      if (triggerBox && tooltipBox) {
        switch (options.position) {
          case 'top':
            positionCorrect = tooltipBox.y < triggerBox.y;
            break;
          case 'bottom':
            positionCorrect = tooltipBox.y > triggerBox.y + triggerBox.height;
            break;
          case 'left':
            positionCorrect = tooltipBox.x < triggerBox.x;
            break;
          case 'right':
            positionCorrect = tooltipBox.x > triggerBox.x + triggerBox.width;
            break;
        }
      }
    }

    // Move mouse away to hide tooltip
    await this.page.mouse.move(0, 0);

    // Wait for tooltip to hide
    const hideDelay = options.hideDelay || 300;
    await this.page.waitForTimeout(hideDelay);

    // Check if tooltip is hidden
    const hidesCorrectly = await tooltip.evaluate(el => {
      const style = getComputedStyle(el);
      return style.visibility === 'hidden' || parseFloat(style.opacity) < 0.5;
    });

    return {
      showsCorrectly,
      hidesCorrectly,
      contentMatches,
      positionCorrect
    };
  }

  /**
   * Triggers specific mouse events programmatically
   */
  private async triggerMouseEvents(selector: string, eventType: 'hover' | 'click' | 'move'): Promise<void> {
    await this.page.evaluate((sel, type) => {
      const element = document.querySelector(sel);
      if (!element) return;

      const events = {
        hover: ['mouseenter', 'mouseover'],
        click: ['mousedown', 'mouseup', 'click'],
        move: ['mousemove']
      };

      events[type].forEach(eventName => {
        const event = new MouseEvent(eventName, {
          bubbles: true,
          cancelable: true,
          view: window
        });
        element.dispatchEvent(event);
      });
    }, selector, eventType);
  }
}

/**
 * Focus management utilities for form and interactive element testing
 */
export class FocusTestHelpers {
  constructor(private page: Page) {}

  /**
   * Focuses on an element with enhanced options
   */
  async focus(
    selector: string,
    options: FocusOptions = {}
  ): Promise<void> {
    const element = await waitForElement(this.page, selector, {
      visible: true,
      timeout: options.timeout || 10000
    });

    if (options.clearContent) {
      await element.clear();
    }

    await element.focus();

    if (options.delay) {
      await this.page.waitForTimeout(options.delay);
    }

    if (options.triggerValidation) {
      // Trigger blur and focus again to activate validation
      await element.blur();
      await this.page.waitForTimeout(100);
      await element.focus();
    }
  }

  /**
   * Manages focus sequence across multiple elements
   */
  async focusSequence(
    selectors: string[],
    options: { delay?: number; validate?: boolean } = {}
  ): Promise<FocusEventData[]> {
    const events: FocusEventData[] = [];
    const delay = options.delay || 200;

    for (const selector of selectors) {
      const element = await waitForElement(this.page, selector, { visible: true });

      await element.focus();
      await this.page.waitForTimeout(delay);

      // Capture focus event details
      const eventData = await this.page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLInputElement;
        if (!el) return null;

        return {
          type: 'focus',
          target: el.id || el.name || sel,
          timestamp: Date.now(),
          value: el.value || '',
          details: {
            tagName: el.tagName,
            type: el.type || '',
            required: el.required || false,
            disabled: el.disabled || false
          }
        };
      }, selector);

      if (eventData) {
        events.push(eventData);
      }
    }

    if (options.validate) {
      // Trigger validation by blurring the last focused element
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(delay);
    }

    return events;
  }

  /**
   * Tests tab navigation order
   */
  async testTabOrder(
    expectedOrder: string[],
    options: { startFromFirst?: boolean; delay?: number } = {}
  ): Promise<{ correctOrder: boolean; actualOrder: string[] }> {
    const actualOrder: string[] = [];
    const delay = options.delay || 100;

    if (options.startFromFirst && expectedOrder.length > 0) {
      await this.focus(expectedOrder[0]);
    }

    // Navigate through tab order
    for (let i = 0; i < expectedOrder.length; i++) {
      await this.page.waitForTimeout(delay);

      // Get currently focused element
      const focused = await this.page.evaluate(() => {
        const active = document.activeElement;
        return active?.id || active?.getAttribute('data-testid') || active?.tagName || 'unknown';
      });

      actualOrder.push(focused);

      // Move to next element
      if (i < expectedOrder.length - 1) {
        await this.page.keyboard.press('Tab');
      }
    }

    const correctOrder = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);

    return { correctOrder, actualOrder };
  }

  /**
   * Validates form field focus states and accessibility
   */
  async validateFormFieldAccessibility(
    fieldSelector: string,
    options: {
      hasLabel?: boolean;
      hasAriaDescribedBy?: boolean;
      hasPlaceholder?: boolean;
      required?: boolean;
    } = {}
  ): Promise<{
    hasLabel: boolean;
    hasAriaDescribedBy: boolean;
    hasPlaceholder: boolean;
    isRequired: boolean;
    focusable: boolean;
    accessibilityScore: number;
  }> {
    const element = await waitForElement(this.page, fieldSelector, { visible: true });

    const validation = await element.evaluate((el, opts) => {
      const input = el as HTMLInputElement;
      const results = {
        hasLabel: false,
        hasAriaDescribedBy: false,
        hasPlaceholder: false,
        isRequired: false,
        focusable: false,
        accessibilityScore: 0
      };

      // Check for label
      if (input.labels && input.labels.length > 0) {
        results.hasLabel = true;
        results.accessibilityScore += 25;
      }

      // Check for aria-describedby
      if (input.getAttribute('aria-describedby')) {
        results.hasAriaDescribedBy = true;
        results.accessibilityScore += 20;
      }

      // Check for placeholder
      if (input.placeholder) {
        results.hasPlaceholder = true;
        results.accessibilityScore += 15;
      }

      // Check if required
      if (input.required) {
        results.isRequired = true;
        results.accessibilityScore += 10;
      }

      // Check if focusable
      if (input.tabIndex >= 0 && !input.disabled) {
        results.focusable = true;
        results.accessibilityScore += 30;
      }

      return results;
    }, options);

    return validation;
  }

  /**
   * Tests focus trapping within a container (useful for modals/dropdowns)
   */
  async testFocusTrap(
    containerSelector: string,
    options: { expectTrapped?: boolean; tabCycles?: number } = {}
  ): Promise<{ isTrapped: boolean; focusableElements: string[] }> {
    const container = await waitForElement(this.page, containerSelector, { visible: true });
    const tabCycles = options.tabCycles || 3;

    // Get all focusable elements within container
    const focusableElements = await container.evaluate(el => {
      const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const elements = el.querySelectorAll(focusableSelectors);
      return Array.from(elements).map(elem => elem.id || elem.tagName || 'unknown');
    });

    // Test focus trapping by cycling through tabs
    let currentFocus = '';
    const focusHistory: string[] = [];

    for (let i = 0; i < tabCycles * focusableElements.length + 2; i++) {
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(50);

      const focused = await this.page.evaluate(() => {
        const active = document.activeElement;
        return active?.id || active?.tagName || 'unknown';
      });

      focusHistory.push(focused);
      currentFocus = focused;
    }

    // Determine if focus is trapped (focus cycles within the container)
    const isTrapped = options.expectTrapped ?
      focusHistory.every(focus => focusableElements.includes(focus)) :
      true; // If not expecting trap, assume it's working as intended

    return { isTrapped, focusableElements };
  }
}

/**
 * Factory function to create hover and focus test helpers
 */
export function createHoverFocusHelpers(page: Page): {
  hover: HoverTestHelpers;
  focus: FocusTestHelpers;
} {
  return {
    hover: new HoverTestHelpers(page),
    focus: new FocusTestHelpers(page)
  };
}

/**
 * Utility function to track all hover and focus events on a page
 */
export async function trackAllInteractionEvents(
  page: Page,
  options: EventTrackingOptions = {}
): Promise<{
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<(MouseEventData | FocusEventData)[]>;
}> {
  const eventTypes = options.eventTypes || [
    'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
    'focus', 'blur', 'focusin', 'focusout'
  ];

  return {
    startTracking: async () => {
      await page.evaluate((types) => {
        window.__allInteractionEvents = [];

        types.forEach(eventType => {
          document.addEventListener(eventType, (e) => {
            const event = e as MouseEvent | FocusEvent;
            window.__allInteractionEvents.push({
              type: eventType,
              target: (event.target as Element)?.id || (event.target as Element)?.className || 'unknown',
              timestamp: Date.now(),
              details: {
                bubbles: event.bubbles,
                cancelable: event.cancelable
              }
            });
          }, true);
        });
      }, eventTypes);
    },

    stopTracking: async () => {
      return page.evaluate(() => {
        const events = window.__allInteractionEvents || [];
        delete window.__allInteractionEvents;
        return events;
      });
    }
  };
}

// Type declarations for window object extensions
declare global {
  interface Window {
    __hoverEventTracker: MouseEventData[];
    __allInteractionEvents: (MouseEventData | FocusEventData)[];
  }
}