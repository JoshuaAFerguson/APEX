/**
 * Mock page object utilities for browser testing scenarios
 *
 * This module provides lightweight mock page objects and elements for unit testing
 * browser interactions without requiring a real browser runtime.
 */

/**
 * Mock element state interface representing a DOM element
 */
export interface MockElementState {
  /** CSS selector for the element */
  selector: string;
  /** Whether the element is visible */
  visible: boolean;
  /** Whether the element is enabled/interactive */
  enabled: boolean;
  /** Text content of the element */
  text: string;
  /** Input value (for form elements) */
  value: string;
  /** Element attributes */
  attributes: Record<string, string>;
  /** HTML tag name */
  tagName: string;
  /** Child elements */
  children: MockElementState[];
}

/**
 * Mock page object interface representing a web page state
 */
export interface MockPageObject {
  /** Current page URL */
  url: string;
  /** Page title */
  title: string;
  /** Page content/HTML */
  content: string;
  /** Map of elements by selector */
  elements: Map<string, MockElementState>;
  /** Console messages logged */
  consoleMessages: Array<{ level: string; text: string; timestamp?: number }>;
  /** JavaScript errors that occurred */
  errors: string[];
  /** Page cookies */
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>;
  /** LocalStorage contents */
  localStorage: Map<string, string>;
  /** SessionStorage contents */
  sessionStorage: Map<string, string>;
  /** Page loading state */
  loading: boolean;
  /** Page ready state */
  readyState: 'loading' | 'interactive' | 'complete';
}

/**
 * Form configuration interface
 */
export interface FormConfig {
  /** Form action URL */
  action?: string;
  /** Form method (GET/POST) */
  method?: string;
  /** Form fields */
  fields: FormField[];
  /** Submit button label */
  submitLabel?: string;
  /** Form id */
  id?: string;
}

/**
 * Form field interface
 */
export interface FormField {
  /** Field name attribute */
  name: string;
  /** Field type */
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio';
  /** Field label */
  label: string;
  /** Whether field is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Options for select/radio fields */
  options?: string[];
  /** Current value */
  value?: string;
  /** Field id */
  id?: string;
}

/**
 * Navigation link interface
 */
export interface NavLink {
  /** Link text */
  text: string;
  /** Link URL */
  href: string;
  /** Link title attribute */
  title?: string;
  /** Whether link opens in new window */
  target?: string;
  /** CSS classes */
  className?: string;
}

/**
 * Creates a mock element with default values
 */
export function createMockElement(
  selector: string,
  overrides: Partial<MockElementState> = {}
): MockElementState {
  return {
    selector,
    visible: true,
    enabled: true,
    text: '',
    value: '',
    attributes: {},
    tagName: 'div',
    children: [],
    ...overrides
  };
}

/**
 * Creates a mock page object with default values
 */
export function createMockPage(overrides: Partial<MockPageObject> = {}): MockPageObject {
  return {
    url: 'http://localhost:3000',
    title: 'Test Page',
    content: '<html><body><h1>Test Page</h1></body></html>',
    elements: new Map(),
    consoleMessages: [],
    errors: [],
    cookies: [],
    localStorage: new Map(),
    sessionStorage: new Map(),
    loading: false,
    readyState: 'complete',
    ...overrides
  };
}

/**
 * Creates a mock page with a form
 */
export function createMockPageWithForm(formConfig: FormConfig): MockPageObject {
  const page = createMockPage({
    title: 'Form Test Page',
    content: `<html><body><h1>Form Test</h1><form id="${formConfig.id || 'test-form'}"></form></body></html>`
  });

  // Add form element
  const formElement = createMockElement(`#${formConfig.id || 'test-form'}`, {
    tagName: 'form',
    attributes: {
      action: formConfig.action || '',
      method: formConfig.method || 'POST',
      id: formConfig.id || 'test-form'
    }
  });

  // Add form fields
  formConfig.fields.forEach((field, index) => {
    const fieldElement = createMockElement(`#${field.id || field.name}`, {
      tagName: field.type === 'textarea' ? 'textarea' : 'input',
      value: field.value || '',
      attributes: {
        name: field.name,
        type: field.type,
        id: field.id || field.name,
        placeholder: field.placeholder || '',
        required: field.required ? 'true' : 'false'
      }
    });

    formElement.children.push(fieldElement);
    page.elements.set(fieldElement.selector, fieldElement);
  });

  // Add submit button
  const submitButton = createMockElement('#submit-btn', {
    tagName: 'button',
    text: formConfig.submitLabel || 'Submit',
    attributes: {
      type: 'submit',
      id: 'submit-btn'
    }
  });

  formElement.children.push(submitButton);
  page.elements.set(formElement.selector, formElement);
  page.elements.set(submitButton.selector, submitButton);

  return page;
}

/**
 * Creates a mock page with navigation links
 */
export function createMockPageWithNavigation(links: NavLink[]): MockPageObject {
  const page = createMockPage({
    title: 'Navigation Test Page',
    content: '<html><body><nav id="nav-menu"></nav></body></html>'
  });

  // Add navigation container
  const navElement = createMockElement('#nav-menu', {
    tagName: 'nav',
    attributes: { id: 'nav-menu' }
  });

  // Add navigation links
  links.forEach((link, index) => {
    const linkElement = createMockElement(`#nav-link-${index}`, {
      tagName: 'a',
      text: link.text,
      attributes: {
        href: link.href,
        title: link.title || '',
        target: link.target || '',
        class: link.className || '',
        id: `nav-link-${index}`
      }
    });

    navElement.children.push(linkElement);
    page.elements.set(linkElement.selector, linkElement);
  });

  page.elements.set(navElement.selector, navElement);
  return page;
}

/**
 * Adds an element to a mock page
 */
export function addElementToPage(
  page: MockPageObject,
  element: MockElementState
): MockPageObject {
  page.elements.set(element.selector, element);
  return page;
}

/**
 * Simulates a console message on a mock page
 */
export function addConsoleMessage(
  page: MockPageObject,
  level: string,
  text: string
): MockPageObject {
  page.consoleMessages.push({
    level,
    text,
    timestamp: Date.now()
  });
  return page;
}

/**
 * Simulates an error on a mock page
 */
export function addErrorToPage(
  page: MockPageObject,
  error: string
): MockPageObject {
  page.errors.push(error);
  return page;
}

/**
 * Sets a cookie on a mock page
 */
export function setCookieOnPage(
  page: MockPageObject,
  name: string,
  value: string,
  options: { domain?: string; path?: string } = {}
): MockPageObject {
  page.cookies.push({
    name,
    value,
    domain: options.domain,
    path: options.path
  });
  return page;
}

/**
 * Sets a localStorage item on a mock page
 */
export function setLocalStorageItem(
  page: MockPageObject,
  key: string,
  value: string
): MockPageObject {
  page.localStorage.set(key, value);
  return page;
}