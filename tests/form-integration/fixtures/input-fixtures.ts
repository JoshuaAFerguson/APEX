/**
 * @fileoverview HTML fixtures for various input types used in integration testing
 *
 * This module provides pre-built HTML templates for different input types
 * to ensure consistent testing across various form control scenarios.
 * Each fixture includes:
 * - Proper semantic HTML structure
 * - Accessibility attributes (labels, ARIA)
 * - Validation attributes where appropriate
 * - Test-friendly data attributes
 */

/**
 * Text Input Fixtures
 */
export const textInputFixtures = {
  basicText: `
    <form data-testid="text-form">
      <div class="form-group">
        <label for="username">Username</label>
        <input
          type="text"
          id="username"
          name="username"
          data-testid="username-input"
          required
          minlength="3"
          maxlength="20"
          placeholder="Enter your username"
          aria-describedby="username-help"
        />
        <small id="username-help">3-20 characters, letters and numbers only</small>
        <div id="username-error" class="error-message" role="alert" aria-live="polite"></div>
      </div>
    </form>
  `,

  emailInput: `
    <form data-testid="email-form">
      <div class="form-group">
        <label for="email">Email Address</label>
        <input
          type="email"
          id="email"
          name="email"
          data-testid="email-input"
          required
          placeholder="user@example.com"
          aria-describedby="email-help"
        />
        <small id="email-help">Enter a valid email address</small>
        <div id="email-error" class="error-message" role="alert" aria-live="polite"></div>
      </div>
    </form>
  `,

  passwordInput: `
    <form data-testid="password-form">
      <div class="form-group">
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          data-testid="password-input"
          required
          minlength="8"
          placeholder="Enter password"
          aria-describedby="password-help"
        />
        <small id="password-help">Minimum 8 characters</small>
        <div id="password-error" class="error-message" role="alert" aria-live="polite"></div>
      </div>
    </form>
  `
};

/**
 * Number Input Fixtures
 */
export const numberInputFixtures = {
  basicNumber: `
    <form data-testid="number-form">
      <div class="form-group">
        <label for="quantity">Quantity</label>
        <input
          type="number"
          id="quantity"
          name="quantity"
          data-testid="number-input"
          min="1"
          max="100"
          step="1"
          placeholder="Enter quantity"
          aria-describedby="quantity-help"
        />
        <small id="quantity-help">Must be between 1 and 100</small>
        <div id="quantity-error" class="error-message" role="alert" aria-live="polite"></div>
      </div>
    </form>
  `,

  rangeSlider: `
    <form data-testid="range-form">
      <div class="form-group">
        <label for="volume">Volume</label>
        <input
          type="range"
          id="volume"
          name="volume"
          data-testid="range-input"
          min="0"
          max="100"
          step="1"
          value="50"
          aria-describedby="volume-help"
        />
        <output for="volume" data-testid="range-output">50</output>
        <small id="volume-help">Adjust volume from 0 to 100</small>
      </div>
    </form>
  `
};

/**
 * File Input Fixtures
 */
export const fileInputFixtures = {
  singleFile: `
    <form data-testid="file-form" enctype="multipart/form-data">
      <div class="form-group">
        <label for="document">Upload Document</label>
        <input
          type="file"
          id="document"
          name="document"
          data-testid="file-input"
          accept=".txt,.pdf"
          aria-describedby="file-help"
        />
        <small id="file-help">Upload a document (TXT, PDF)</small>
        <div id="file-preview" data-testid="file-preview"></div>
        <div id="file-error" class="error-message" role="alert" aria-live="polite"></div>
      </div>
    </form>
  `
};

/**
 * Textarea Fixtures
 */
export const textareaFixtures = {
  basicTextarea: `
    <form data-testid="textarea-form">
      <div class="form-group">
        <label for="message">Message</label>
        <textarea
          id="message"
          name="message"
          data-testid="textarea-input"
          rows="4"
          cols="50"
          maxlength="500"
          placeholder="Enter your message here..."
          aria-describedby="message-help"
        ></textarea>
        <small id="message-help">Maximum 500 characters</small>
        <div class="character-count" data-testid="character-count">0 / 500</div>
        <div id="message-error" class="error-message" role="alert" aria-live="polite"></div>
      </div>
    </form>
  `
};

/**
 * Utility function to create a DOM element from HTML string
 */
export function createElementFromHtml(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild as HTMLElement;
}

/**
 * Utility function to inject fixture into test container
 */
export function loadFixture(container: HTMLElement, fixtureHtml: string): HTMLElement {
  const element = createElementFromHtml(fixtureHtml);
  container.appendChild(element);
  return element;
}

/**
 * Safe test data for form filling
 */
export const testData = {
  text: {
    username: 'testuser',
    message: 'This is a test message'
  },

  numbers: {
    quantity: 5,
    volume: 75
  }
};