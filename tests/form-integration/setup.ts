/**
 * @fileoverview Setup file for Form Controls Integration Tests
 *
 * This setup file provides:
 * - DOM environment configuration for form testing
 * - Mock setup for form validation libraries
 * - Test utilities for form interaction simulation
 * - Global test helpers for consistent form testing
 * - Cleanup utilities for test isolation
 *
 * Features:
 * - JSDom with form-specific polyfills
 * - Custom matchers for form validation testing
 * - Mock file upload capabilities
 * - Form state testing utilities
 * - Accessibility testing helpers
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi, expect } from 'vitest';

// Global DOM setup for form testing
beforeAll(async () => {
  // Configure JSDom with form-specific features
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver for responsive form components
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver for lazy-loaded form elements
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Enhanced FormData support for file upload testing
  global.File = class MockFile extends File {
    constructor(bits: BlobPart[], name: string, options?: FilePropertyBag) {
      super(bits, name, options);
    }
  };

  // Mock URL.createObjectURL for file preview testing
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  // Mock FileReader for file content testing
  global.FileReader = class MockFileReader {
    result: string | ArrayBuffer | null = null;
    error: DOMException | null = null;
    readyState: number = 0;
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

    readAsText(file: Blob): void {
      setTimeout(() => {
        this.result = 'Mock file content';
        this.readyState = 2; // DONE
        if (this.onload) {
          this.onload({} as ProgressEvent<FileReader>);
        }
      }, 10);
    }

    readAsDataURL(file: Blob): void {
      setTimeout(() => {
        this.result = 'data:text/plain;base64,TW9jayBmaWxlIGNvbnRlbnQ=';
        this.readyState = 2; // DONE
        if (this.onload) {
          this.onload({} as ProgressEvent<FileReader>);
        }
      }, 10);
    }

    readAsArrayBuffer(file: Blob): void {
      setTimeout(() => {
        this.result = new ArrayBuffer(16);
        this.readyState = 2; // DONE
        if (this.onload) {
          this.onload({} as ProgressEvent<FileReader>);
        }
      }, 10);
    }

    abort(): void {
      this.readyState = 2; // DONE
    }

    addEventListener(): void {}
    removeEventListener(): void {}
    dispatchEvent(): boolean { return true; }
  };

  // Mock clipboard API for copy/paste form functionality
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue('mock clipboard content'),
    },
    writable: true,
  });

  // Mock geolocation for address form testing
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: vi.fn().mockImplementation(success =>
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 10,
          },
        })
      ),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
    writable: true,
  });

  console.log('✅ Form integration test environment initialized');
});

afterAll(() => {
  console.log('🧹 Form integration test environment cleanup completed');
});

// Per-test setup and cleanup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();

  // Reset DOM to clean state
  document.body.innerHTML = '';

  // Reset any global form state
  if (window.localStorage) {
    window.localStorage.clear();
  }
  if (window.sessionStorage) {
    window.sessionStorage.clear();
  }
});

afterEach(() => {
  // Clear any remaining timers
  vi.clearAllTimers();

  // Reset scroll position if available
  if (typeof window !== 'undefined' && window.scrollTo) {
    window.scrollTo(0, 0);
  }
});

/**
 * Form Testing Utilities
 */

// Global form testing utilities
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeValidForm(): any;
      toHaveValidationError(field?: string, message?: string): any;
      toHaveFormData(expectedData: Record<string, any>): any;
      toBeAccessibleForm(): any;
    }
  }
}

// Custom matchers for form testing
expect.extend({
  toBeValidForm(received: HTMLFormElement) {
    const pass = received instanceof HTMLFormElement && received.checkValidity();

    return {
      message: () =>
        pass
          ? `Expected form to be invalid, but it was valid`
          : `Expected form to be valid, but it was invalid`,
      pass,
    };
  },

  toHaveValidationError(received: HTMLElement, field?: string, message?: string) {
    let errorElement: HTMLElement | null = null;

    if (field) {
      // Look for specific field error
      errorElement = received.querySelector(`[data-testid="${field}-error"], #${field}-error, .${field}-error`);
    } else {
      // Look for any error element
      errorElement = received.querySelector('[role="alert"], .error, .invalid');
    }

    const hasError = errorElement && errorElement.textContent && errorElement.textContent.trim() !== '';
    const errorText = errorElement?.textContent?.trim() || '';

    const messageMatches = message ? errorText.includes(message) : true;
    const pass = hasError && messageMatches;

    return {
      message: () =>
        pass
          ? `Expected no validation error${field ? ` for field "${field}"` : ''}${message ? ` with message "${message}"` : ''}, but found: "${errorText}"`
          : `Expected validation error${field ? ` for field "${field}"` : ''}${message ? ` with message "${message}"` : ''}, but ${hasError ? `found different message: "${errorText}"` : 'found none'}`,
      pass,
    };
  },

  toHaveFormData(received: HTMLFormElement, expectedData: Record<string, any>) {
    const formData = new FormData(received);
    const actualData: Record<string, any> = {};

    for (let [key, value] of formData.entries()) {
      if (actualData[key] !== undefined) {
        // Handle multiple values (like multi-select or checkboxes)
        if (Array.isArray(actualData[key])) {
          actualData[key].push(value);
        } else {
          actualData[key] = [actualData[key], value];
        }
      } else {
        actualData[key] = value;
      }
    }

    // Check if all expected data matches
    const mismatches: string[] = [];
    for (const [key, expectedValue] of Object.entries(expectedData)) {
      if (actualData[key] !== expectedValue) {
        mismatches.push(`${key}: expected "${expectedValue}", got "${actualData[key]}"`);
      }
    }

    const pass = mismatches.length === 0;

    return {
      message: () =>
        pass
          ? `Expected form data not to match ${JSON.stringify(expectedData)}`
          : `Expected form data to match ${JSON.stringify(expectedData)}, but found mismatches: ${mismatches.join(', ')}`,
      pass,
    };
  },

  toBeAccessibleForm(received: HTMLFormElement) {
    const issues: string[] = [];

    // Check for form label association
    const inputs = received.querySelectorAll('input, select, textarea');
    inputs.forEach((input: Element) => {
      const inputElement = input as HTMLInputElement;
      const id = inputElement.id;
      const name = inputElement.name;

      if (!id && !name) {
        issues.push(`Input element missing both id and name attributes`);
        return;
      }

      // Check for associated label
      const label = received.querySelector(`label[for="${id}"]`) ||
                   inputElement.closest('label');

      if (!label && inputElement.getAttribute('aria-label') === null &&
          inputElement.getAttribute('aria-labelledby') === null) {
        issues.push(`Input "${id || name}" has no associated label or aria-label`);
      }
    });

    // Check for required field indicators
    const requiredFields = received.querySelectorAll('[required]');
    requiredFields.forEach((field: Element) => {
      const fieldElement = field as HTMLInputElement;
      const id = fieldElement.id || fieldElement.name;

      const hasAriaRequired = fieldElement.getAttribute('aria-required') === 'true';
      const hasVisualIndicator = received.querySelector(`[aria-label*="required"], [title*="required"], .required`);

      if (!hasAriaRequired && !hasVisualIndicator) {
        issues.push(`Required field "${id}" lacks proper accessibility indicators`);
      }
    });

    // Check for error message accessibility
    const errorElements = received.querySelectorAll('.error, [role="alert"]');
    errorElements.forEach((error: Element) => {
      const errorElement = error as HTMLElement;
      if (!errorElement.getAttribute('aria-live') && !errorElement.getAttribute('role')) {
        issues.push(`Error message lacks proper ARIA attributes for screen readers`);
      }
    });

    const pass = issues.length === 0;

    return {
      message: () =>
        pass
          ? `Expected form to have accessibility issues`
          : `Expected form to be accessible, but found issues: ${issues.join('; ')}`,
      pass,
    };
  },
});

/**
 * Utility Functions for Form Testing
 */

/**
 * Simulates user typing in a form field with realistic delays
 */
export async function simulateTyping(
  element: HTMLElement,
  text: string,
  options: { delay?: number; clear?: boolean } = {}
): Promise<void> {
  const { delay = 50, clear = true } = options;

  if (clear && 'value' in element) {
    (element as HTMLInputElement).value = '';
  }

  for (const char of text) {
    if ('value' in element) {
      (element as HTMLInputElement).value += char;
    }

    // Dispatch input event for each character
    element.dispatchEvent(new Event('input', { bubbles: true }));

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Dispatch change event after typing is complete
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulates file selection for file input elements
 */
export function simulateFileSelection(
  fileInput: HTMLInputElement,
  files: File[]
): void {
  // Create FileList mock
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  };

  // Override files property
  Object.defineProperty(fileInput, 'files', {
    value: fileList,
    writable: false,
  });

  // Dispatch change event
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Creates mock files for testing file uploads
 */
export function createMockFile(
  name: string,
  content: string = 'mock content',
  type: string = 'text/plain'
): File {
  return new File([content], name, { type });
}

/**
 * Waits for form validation to complete
 */
export async function waitForValidation(
  form: HTMLFormElement,
  timeout: number = 1000
): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkValidation = () => {
      if (form.checkValidity()) {
        resolve(true);
        return;
      }

      if (Date.now() - startTime > timeout) {
        resolve(false);
        return;
      }

      setTimeout(checkValidation, 50);
    };

    checkValidation();
  });
}

/**
 * Fills a complete form with test data
 */
export async function fillFormWithTestData(
  form: HTMLFormElement,
  testData: Record<string, any>
): Promise<void> {
  for (const [name, value] of Object.entries(testData)) {
    const element = form.querySelector(`[name="${name}"], #${name}`) as HTMLElement;

    if (!element) continue;

    if (element.tagName === 'INPUT') {
      const input = element as HTMLInputElement;

      switch (input.type) {
        case 'text':
        case 'email':
        case 'password':
        case 'url':
        case 'tel':
          await simulateTyping(input, String(value));
          break;

        case 'checkbox':
        case 'radio':
          input.checked = Boolean(value);
          input.dispatchEvent(new Event('change', { bubbles: true }));
          break;

        case 'file':
          if (Array.isArray(value)) {
            simulateFileSelection(input, value);
          }
          break;

        case 'number':
        case 'range':
          input.value = String(value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          break;
      }
    } else if (element.tagName === 'SELECT') {
      const select = element as HTMLSelectElement;
      select.value = String(value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.tagName === 'TEXTAREA') {
      const textarea = element as HTMLTextAreaElement;
      await simulateTyping(textarea, String(value));
    }
  }
}

// Export test utilities for use in test files
export {
  vi,
  expect,
};