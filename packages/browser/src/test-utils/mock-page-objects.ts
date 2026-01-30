/**
 * @apexcli/browser - Mock Page Objects
 *
 * Lightweight mock page factories for unit tests (simpler than full MockBrowserSession)
 */

export interface MockElementState {
  selector: string;
  visible: boolean;
  enabled: boolean;
  text: string;
  value: string;
  attributes: Record<string, string>;
  tagName: string;
  children: MockElementState[];
}

export interface MockPageObject {
  url: string;
  title: string;
  content: string;
  elements: Map<string, MockElementState>;
  consoleMessages: Array<{ level: string; text: string }>;
  errors: string[];
  cookies: Array<{ name: string; value: string; domain?: string }>;
  localStorage: Map<string, string>;
}

export interface FormConfig {
  action?: string;
  method?: string;
  fields: FormField[];
  submitLabel?: string;
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio';
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // for select/radio
  value?: string;
}

export interface NavLink {
  href: string;
  text: string;
  target?: string;
}

/**
 * Create a lightweight mock page object for unit tests
 */
export function createMockPage(overrides: Partial<MockPageObject> = {}): MockPageObject {
  return {
    url: 'about:blank',
    title: 'Test Page',
    content: '<html><body><h1>Test Page</h1></body></html>',
    elements: new Map(),
    consoleMessages: [],
    errors: [],
    cookies: [],
    localStorage: new Map(),
    ...overrides
  };
}

/**
 * Create a mock element with default state
 */
export function createMockElement(selector: string, overrides: Partial<MockElementState> = {}): MockElementState {
  return {
    selector,
    visible: true,
    enabled: true,
    text: '',
    value: '',
    attributes: {},
    tagName: 'DIV',
    children: [],
    ...overrides
  };
}

/**
 * Create a mock page with a form structure
 */
export function createMockPageWithForm(formConfig: FormConfig): MockPageObject {
  const page = createMockPage({
    title: 'Form Test Page',
    content: generateFormHTML(formConfig)
  });

  // Add form elements to the elements map
  formConfig.fields.forEach((field, index) => {
    const selector = `#${field.name}`;
    page.elements.set(selector, createMockElement(selector, {
      tagName: getFieldTagName(field.type),
      value: field.value || '',
      attributes: {
        name: field.name,
        type: field.type,
        required: field.required ? 'true' : 'false',
        placeholder: field.placeholder || ''
      }
    }));
  });

  // Add submit button
  page.elements.set('#submit', createMockElement('#submit', {
    tagName: 'BUTTON',
    attributes: { type: 'submit' },
    text: formConfig.submitLabel || 'Submit'
  }));

  return page;
}

/**
 * Create a mock page with navigation links
 */
export function createMockPageWithNavigation(links: NavLink[]): MockPageObject {
  const page = createMockPage({
    title: 'Navigation Test Page',
    content: generateNavigationHTML(links)
  });

  // Add navigation elements to the elements map
  links.forEach((link, index) => {
    const selector = `#nav-link-${index}`;
    page.elements.set(selector, createMockElement(selector, {
      tagName: 'A',
      text: link.text,
      attributes: {
        href: link.href,
        target: link.target || '_self'
      }
    }));
  });

  return page;
}

/**
 * Add an element to a mock page
 */
export function addElementToMockPage(
  page: MockPageObject,
  selector: string,
  element: Partial<MockElementState> = {}
): void {
  page.elements.set(selector, createMockElement(selector, element));
}

/**
 * Add a console message to a mock page
 */
export function addConsoleMessage(
  page: MockPageObject,
  level: string,
  text: string
): void {
  page.consoleMessages.push({ level, text });
}

/**
 * Add an error to a mock page
 */
export function addError(page: MockPageObject, error: string): void {
  page.errors.push(error);
}

/**
 * Set a cookie on a mock page
 */
export function setCookie(
  page: MockPageObject,
  name: string,
  value: string,
  domain?: string
): void {
  page.cookies.push({ name, value, domain });
}

/**
 * Set localStorage value on a mock page
 */
export function setLocalStorage(page: MockPageObject, key: string, value: string): void {
  page.localStorage.set(key, value);
}

// Helper function to generate form HTML
function generateFormHTML(config: FormConfig): string {
  const fields = config.fields.map(field => {
    switch (field.type) {
      case 'select':
        const options = field.options?.map(option =>
          `<option value="${option}">${option}</option>`
        ).join('') || '';
        return `
          <label for="${field.name}">${field.label}</label>
          <select id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>
            ${options}
          </select>
        `;
      case 'textarea':
        return `
          <label for="${field.name}">${field.label}</label>
          <textarea id="${field.name}" name="${field.name}"
            placeholder="${field.placeholder || ''}"
            ${field.required ? 'required' : ''}>${field.value || ''}</textarea>
        `;
      case 'checkbox':
        return `
          <label>
            <input type="checkbox" id="${field.name}" name="${field.name}"
              ${field.value === 'true' ? 'checked' : ''}
              ${field.required ? 'required' : ''}>
            ${field.label}
          </label>
        `;
      case 'radio':
        return field.options?.map(option => `
          <label>
            <input type="radio" name="${field.name}" value="${option}"
              ${field.value === option ? 'checked' : ''}>
            ${option}
          </label>
        `).join('') || '';
      default:
        return `
          <label for="${field.name}">${field.label}</label>
          <input type="${field.type}" id="${field.name}" name="${field.name}"
            value="${field.value || ''}"
            placeholder="${field.placeholder || ''}"
            ${field.required ? 'required' : ''}>
        `;
    }
  }).join('');

  return `
    <html>
      <body>
        <form action="${config.action || ''}" method="${config.method || 'POST'}">
          ${fields}
          <button type="submit" id="submit">${config.submitLabel || 'Submit'}</button>
        </form>
      </body>
    </html>
  `;
}

// Helper function to generate navigation HTML
function generateNavigationHTML(links: NavLink[]): string {
  const navItems = links.map((link, index) =>
    `<a id="nav-link-${index}" href="${link.href}" target="${link.target || '_self'}">${link.text}</a>`
  ).join(' | ');

  return `
    <html>
      <body>
        <nav>
          ${navItems}
        </nav>
      </body>
    </html>
  `;
}

// Helper function to get the appropriate tag name for form fields
function getFieldTagName(type: FormField['type']): string {
  switch (type) {
    case 'select':
      return 'SELECT';
    case 'textarea':
      return 'TEXTAREA';
    default:
      return 'INPUT';
  }
}