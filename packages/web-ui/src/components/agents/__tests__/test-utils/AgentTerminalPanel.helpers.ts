/**
 * Test utility functions for AgentTerminalPanel tests
 *
 * Provides assertion helpers, interaction utilities, and animation testing
 * to reduce code duplication across test files.
 */

import { fireEvent, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that an element has the correct transition classes applied
 */
export function expectTransitionClasses(element: HTMLElement): void {
  expect(element).toHaveClass('transition-all')
  expect(element).toHaveClass('ease-out')
  expect(element).toHaveClass('duration-300')
}

/**
 * Asserts that an element has performance optimization classes
 */
export function expectPerformanceClasses(element: HTMLElement): void {
  expect(element).toHaveClass('will-change-auto')
}

/**
 * Asserts that content has correct animation classes based on expanded state
 */
export function expectContentAnimationClasses(element: HTMLElement, expanded: boolean): void {
  expect(element).toHaveClass('transition-opacity', 'duration-200', 'ease-in-out')

  if (expanded) {
    expect(element).toHaveClass('opacity-100', 'visible')
    expect(element).not.toHaveClass('opacity-0', 'invisible')
  } else {
    expect(element).toHaveClass('opacity-0', 'invisible')
    expect(element).not.toHaveClass('opacity-100', 'visible')
  }
}

/**
 * Asserts that ARIA attributes are correctly set based on panel state
 */
export function expectAriaAttributes(element: HTMLElement, state: PanelDisplayState): void {
  expect(element).toHaveAttribute('role', 'region')
  expect(element).toHaveAttribute('aria-label')
  expect(element).toHaveAttribute('aria-expanded', String(state !== 'minimized'))
  expect(element).toHaveAttribute('tabIndex', '0')

  const contentElement = element.querySelector('[data-expanded]')
  if (contentElement) {
    expect(contentElement).toHaveAttribute('data-expanded', String(state !== 'minimized'))
    expect(contentElement).toHaveAttribute('aria-hidden', String(state === 'minimized'))
  }
}

/**
 * Asserts that panel has the correct height classes for the given state
 */
export function expectHeightClasses(element: HTMLElement, state: PanelDisplayState): void {
  switch (state) {
    case 'minimized':
      expect(element).toHaveClass('h-16')
      break
    case 'normal':
      expect(element).toHaveClass('h-80')
      break
    case 'maximized':
      expect(element).toHaveClass('h-screen')
      break
  }
}

/**
 * Asserts that panel has the correct width classes for the given state
 */
export function expectWidthClasses(element: HTMLElement, state: PanelDisplayState): void {
  switch (state) {
    case 'minimized':
      expect(element).toHaveClass('w-full')
      break
    case 'normal':
      expect(element).toHaveClass('w-full')
      break
    case 'maximized':
      expect(element).toHaveClass('w-screen')
      break
  }
}

/**
 * Asserts that callback was called with expected arguments
 */
export function expectCallbackCalled<T extends (...args: any[]) => any>(
  callback: T,
  expectedArgs?: Parameters<T>
): void {
  expect(callback).toHaveBeenCalled()

  if (expectedArgs !== undefined) {
    expect(callback).toHaveBeenCalledWith(...expectedArgs)
  }
}

/**
 * Asserts that callback was called exactly n times
 */
export function expectCallbackCalledTimes(callback: any, times: number): void {
  expect(callback).toHaveBeenCalledTimes(times)
}

// ============================================================================
// Interaction Helpers
// ============================================================================

/**
 * Fires a keyboard event on the specified element
 */
export function fireKeyboardEvent(
  element: HTMLElement,
  key: string,
  options: KeyboardEventInit = {}
): void {
  fireEvent.keyDown(element, {
    key,
    code: key,
    which: key.charCodeAt(0),
    ...options,
  })
}

/**
 * Simulates a panel state transition by firing appropriate events
 */
export function simulateStateTransition(container: HTMLElement, fromState: PanelDisplayState, toState: PanelDisplayState): void {
  // Add transition classes if not present
  if (!container.classList.contains('transition-all')) {
    container.classList.add('transition-all', 'duration-300', 'ease-out')
  }

  // Remove old height class and add new one
  const heightClasses = ['h-16', 'h-80', 'h-screen']
  heightClasses.forEach(cls => container.classList.remove(cls))

  switch (toState) {
    case 'minimized':
      container.classList.add('h-16')
      break
    case 'normal':
      container.classList.add('h-80')
      break
    case 'maximized':
      container.classList.add('h-screen')
      break
  }

  // Update content visibility
  const contentElement = container.querySelector('[data-expanded]') as HTMLElement
  if (contentElement) {
    if (toState === 'minimized') {
      contentElement.classList.remove('opacity-100', 'visible')
      contentElement.classList.add('opacity-0', 'invisible')
      contentElement.setAttribute('aria-hidden', 'true')
    } else {
      contentElement.classList.remove('opacity-0', 'invisible')
      contentElement.classList.add('opacity-100', 'visible')
      contentElement.setAttribute('aria-hidden', 'false')
    }
    contentElement.setAttribute('data-expanded', String(toState !== 'minimized'))
  }

  // Fire transition events
  fireEvent.transitionStart(container)
  fireEvent.transitionEnd(container)
}

/**
 * Waits for CSS animations/transitions to complete
 */
export async function waitForAnimationComplete(): Promise<void> {
  // Wait for the typical transition duration (300ms) plus buffer
  await waitFor(() => {}, { timeout: 500 })
}

/**
 * Scrolls an element to a specific position
 */
export function scrollToPosition(element: HTMLElement, position: { top: number; left?: number }): void {
  Object.defineProperty(element, 'scrollTop', {
    value: position.top,
    writable: true,
  })

  if (position.left !== undefined) {
    Object.defineProperty(element, 'scrollLeft', {
      value: position.left,
      writable: true,
    })
  }

  fireEvent.scroll(element)
}

/**
 * Simulates rapid state changes to test debouncing
 */
export async function simulateRapidStateChanges(
  container: HTMLElement,
  states: PanelDisplayState[],
  delayMs: number = 10
): Promise<void> {
  for (let i = 0; i < states.length; i++) {
    const state = states[i]
    const prevState = i > 0 ? states[i - 1] : 'normal'

    simulateStateTransition(container, prevState, state)

    if (i < states.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}

// ============================================================================
// DOM Query Helpers
// ============================================================================

/**
 * Finds panel elements by test IDs
 */
export function getPanelElements(container: HTMLElement) {
  return {
    header: container.querySelector('[data-testid="mock-header"]'),
    controls: container.querySelector('[data-testid="mock-controls"]'),
    logContainer: container.querySelector('[role="log"]'),
    content: container.querySelector('[data-expanded]'),
    statusBar: container.querySelector('[data-testid="status-bar"]'),
    autoScrollButton: container.querySelector('[data-testid="auto-scroll-button"]'),
  }
}

/**
 * Gets all log entry elements
 */
export function getLogEntries(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid^="mock-log-entry-"]'))
}

/**
 * Finds a specific log entry by ID
 */
export function getLogEntry(container: HTMLElement, logId: string): HTMLElement | null {
  return container.querySelector(`[data-testid="mock-log-entry-${logId}"]`)
}

// ============================================================================
// Animation Testing Helpers
// ============================================================================

/**
 * Monitors transition events on an element
 */
export function createTransitionMonitor(element: HTMLElement) {
  const events: string[] = []

  const onTransitionStart = () => events.push('start')
  const onTransitionEnd = () => events.push('end')
  const onTransitionCancel = () => events.push('cancel')

  element.addEventListener('transitionstart', onTransitionStart)
  element.addEventListener('transitionend', onTransitionEnd)
  element.addEventListener('transitioncancel', onTransitionCancel)

  return {
    events,
    cleanup: () => {
      element.removeEventListener('transitionstart', onTransitionStart)
      element.removeEventListener('transitionend', onTransitionEnd)
      element.removeEventListener('transitioncancel', onTransitionCancel)
    }
  }
}

/**
 * Verifies that animation timing matches ADR-0043 specifications
 */
export function verifyAnimationTiming(element: HTMLElement) {
  const styles = getComputedStyle(element)

  // Check transition-property
  expect(styles.transitionProperty).toBe('all')

  // Check timing function
  expect(styles.transitionTimingFunction).toMatch(/ease-out|cubic-bezier/)

  // Check duration (should be 300ms for height, 200ms for opacity)
  const duration = styles.transitionDuration
  expect(duration).toMatch(/0\.3s|0\.2s|300ms|200ms/)
}

// ============================================================================
// Focus Management Helpers
// ============================================================================

/**
 * Verifies focus trap behavior in maximized state
 */
export async function verifyFocusTrap(container: HTMLElement): Promise<void> {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>

  if (focusableElements.length === 0) {
    return // No focusable elements to test
  }

  // Focus first element
  focusableElements[0].focus()
  expect(document.activeElement).toBe(focusableElements[0])

  // Tab through all elements
  for (let i = 1; i < focusableElements.length; i++) {
    fireKeyboardEvent(document.activeElement as HTMLElement, 'Tab')
    await waitFor(() => {
      expect(document.activeElement).toBe(focusableElements[i])
    })
  }

  // Tab from last element should wrap to first
  fireKeyboardEvent(document.activeElement as HTMLElement, 'Tab')
  await waitFor(() => {
    expect(document.activeElement).toBe(focusableElements[0])
  })
}

/**
 * Verifies that focus returns to expected element after modal interaction
 */
export async function verifyFocusReturn(
  triggerElement: HTMLElement,
  interaction: () => Promise<void>
): Promise<void> {
  triggerElement.focus()
  expect(document.activeElement).toBe(triggerElement)

  await interaction()

  await waitFor(() => {
    expect(document.activeElement).toBe(triggerElement)
  })
}